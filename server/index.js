import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { ProxyAgent, getGlobalDispatcher } from 'undici';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal .env loader (no extra dependency). Only fills missing vars.
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawVal.replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const PORT = process.env.PORT || 8787;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = process.env.AI_MODEL || 'llama-3.1-8b-instant';
const API_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';

// Limite de tokens/minuto do plano Groq (free = 6000). Como o histórico do chat
// cresce com blocos de código grandes, um request pode estourar o TPM e o Groq
// devolve 413/429 (rate_limit_exceeded). Aparamos as mensagens para caber no
// orçamento antes de enviar. Ajustável por AI_TPM_LIMIT.
const AI_TPM_LIMIT = Number(process.env.AI_TPM_LIMIT || 6000);
const AI_MAX_OUTPUT_TOKENS = Number(process.env.AI_MAX_OUTPUT_TOKENS || 1024);
// Estimativa conservadora de tokens. Português acentuado e código tokenizam mais
// denso que ~4 chars/token, então usamos ~3 chars/token para não subestimar.
const CHARS_PER_TOKEN = 3;
const estimateTokens = (text) => Math.ceil((text ? String(text).length : 0) / CHARS_PER_TOKEN);

// Mantém a mensagem de sistema e o máximo de mensagens recentes que couber no
// orçamento de entrada informado. Preserva a ordem cronológica e, se a última
// mensagem do usuário sozinha exceder o orçamento, ela é truncada.
function fitMessagesToBudget(messages, inputBudget) {
  const budget = Math.max(300, inputBudget);
  const system = messages.find((m) => m.role === 'system');
  const convo = messages.filter((m) => m.role !== 'system');
  let used = system ? estimateTokens(system.content) : 0;

  const kept = [];
  for (let i = convo.length - 1; i >= 0; i--) {
    const msg = convo[i];
    const cost = estimateTokens(msg.content);
    if (used + cost > budget) {
      // A última mensagem (mais recente) é essencial: trunca para caber.
      if (kept.length === 0) {
        const room = Math.max(0, budget - used);
        const chars = room * CHARS_PER_TOKEN;
        if (chars > 0) {
          kept.unshift({ ...msg, content: String(msg.content).slice(0, chars) });
        }
      }
      break;
    }
    used += cost;
    kept.unshift(msg);
  }
  return system ? [system, ...kept] : kept;
}

// Gateway das APIs IUBI. O frontend chama /iubi/* (mesma origem) e o servidor
// repassa para este upstream — evita mixed-content (HTTPS->HTTP) e CORS.
const IUBI_UPSTREAM = (process.env.IUBI_UPSTREAM || 'http://100.52.200.210:32200').replace(/\/$/, '');
// Proxy HTTP de saída (ex.: Tailscale userspace no Fly) para alcançar a rede
// privada onde o gateway IUBI vive. Sem isto, o servidor conecta direto.
const OUTBOUND_HTTP_PROXY = process.env.OUTBOUND_HTTP_PROXY || '';
const iubiDispatcher = OUTBOUND_HTTP_PROXY
  ? new ProxyAgent(OUTBOUND_HTTP_PROXY)
  : getGlobalDispatcher();

const app = express();

// Proxy do gateway IUBI (registrado antes do express.json para repassar o corpo bruto).
app.use('/iubi', express.raw({ type: '*/*', limit: '5mb' }), async (req, res) => {
  const target = `${IUBI_UPSTREAM}${req.originalUrl.replace(/^\/iubi/, '')}`;
  const headers = {};
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
  if (req.headers['accept']) headers['accept'] = req.headers['accept'];
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.body?.length;
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      dispatcher: iubiDispatcher,
    });
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('content-type', ct);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    res.status(502).json({
      error: 'Falha ao contatar o gateway IUBI.',
      detail: String(err),
      upstream: IUBI_UPSTREAM,
    });
  }
});

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    model: DEFAULT_MODEL,
    aiConfigured: Boolean(API_KEY),
    iubiUpstream: IUBI_UPSTREAM,
    outboundProxy: Boolean(OUTBOUND_HTTP_PROXY),
  });
});

// AI Copilot proxy. Streams Server-Sent Events from the OpenAI-compatible backend.
app.post('/api/chat', async (req, res) => {
  if (!API_KEY) {
    res.status(503).json({
      error:
        'Assistente de IA não configurado. Defina GROQ_API_KEY no arquivo .env (veja .env.example).',
    });
    return;
  }

  const { messages, model } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages é obrigatório' });
    return;
  }

  try {
    // Orçamento de entrada inicial (conservador). A cada 413/429 por excesso de
    // tokens, apara mais o histórico e tenta de novo — como o streaming ainda não
    // começou, é seguro reenviar. Garante sucesso mesmo se a estimativa errar.
    let inputBudget = AI_TPM_LIMIT - AI_MAX_OUTPUT_TOKENS - 900;
    let upstream = null;
    let detail = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      upstream = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: model || DEFAULT_MODEL,
          messages: fitMessagesToBudget(messages, inputBudget),
          temperature: 0.2,
          max_tokens: AI_MAX_OUTPUT_TOKENS,
          stream: true,
        }),
      });
      if (upstream.ok && upstream.body) break;
      detail = await upstream.text().catch(() => '');
      const tokenLimited =
        (upstream.status === 429 || upstream.status === 413) && /tokens|too large|rate_limit/i.test(detail);
      if (!tokenLimited || inputBudget <= 400) break;
      inputBudget = Math.floor(inputBudget * 0.6);
    }

    if (!upstream || !upstream.ok || !upstream.body) {
      const status = upstream?.status || 502;
      const isRateLimit = status === 429 || status === 413;
      res.status(status).json({
        error: isRateLimit
          ? 'O assistente de IA atingiu o limite de tokens por minuto do Groq. Aguarde alguns segundos e tente novamente (ou inicie uma nova conversa para reduzir o histórico).'
          : `Falha no backend de IA (${status}).`,
        detail: detail.slice(0, 500),
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'Erro ao contatar o backend de IA.', detail: String(err) });
    } else {
      res.end();
    }
  }
});

// Serve the built frontend in production.
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`[iubi-demo] API/servidor em http://localhost:${PORT}`);
  console.log(`[iubi-demo] IA: ${API_KEY ? DEFAULT_MODEL : 'NÃO configurada (defina GROQ_API_KEY)'}`);
});
