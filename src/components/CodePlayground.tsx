import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, X, RotateCcw, Terminal, Download, FileCode } from 'lucide-react';
import { JS_LANGS, type FileLang, type PlaygroundFile } from '../lib/playground';

interface LogEntry {
  level: 'log' | 'info' | 'warn' | 'error';
  text: string;
}

const CDN = {
  leafletCss: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  react: 'https://unpkg.com/react@18/umd/react.production.min.js',
  reactDom: 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  leaflet: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  chart: 'https://unpkg.com/chart.js@4/dist/chart.umd.js',
  babel: 'https://unpkg.com/@babel/standalone@7/babel.min.js',
};

function pick(files: PlaygroundFile[], lang: FileLang): PlaygroundFile | undefined {
  return files.find((f) => f.lang === lang);
}

function joinBy(files: PlaygroundFile[], langs: FileLang[]): string {
  return files
    .filter((f) => langs.includes(f.lang))
    .map((f) => f.content)
    .join('\n\n');
}

// Extrai só o conteúdo do <body> caso o modelo mande um HTML completo.
function bodyMarkup(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (m ? m[1] : html).trim();
}

const PAGE_CSS = `html,body{margin:0;min-height:100%;font-family:system-ui,-apple-system,sans-serif;color:#334155;}
#root{min-height:100vh;box-sizing:border-box;}
.leaflet-container{min-height:320px;}`;

// Monta o documento do iframe combinando html + css + js. React/ReactDOM/Leaflet/
// Chart.js ficam como globais e Babel transpila JSX/TS. Usa allow-same-origin
// para que fetch('/iubi/...') seja de mesma origem (o backend não envia CORS);
// é código do próprio demo gerado pelo Copilot, então o trade-off é aceitável.
function buildSrcDoc(files: PlaygroundFile[], origin: string): string {
  const html = pick(files, 'html');
  let body = html ? bodyMarkup(html.content) : '<div id="root"></div>';
  // Garante um contêiner #root caso o código monte React nele.
  if (!/id=["']root["']/.test(body)) body += '\n<div id="root"></div>';
  const css = joinBy(files, ['css']);
  const js = joinBy(files, JS_LANGS);
  const safeJs = js.replace(/<\/script>/gi, '<\\/script>');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<base href="${origin}/" />
<link rel="stylesheet" href="${CDN.leafletCss}" />
<script src="${CDN.react}"></script>
<script src="${CDN.reactDom}"></script>
<script src="${CDN.leaflet}"></script>
<script src="${CDN.chart}"></script>
<script src="${CDN.babel}"></script>
<style>${PAGE_CSS}</style>
<style>${css}</style>
</head>
<body>
${body}
<script>
(function(){
  function fmt(v){ if(typeof v==='string')return v; try{return JSON.stringify(v);}catch(e){return String(v);} }
  function send(level,args){
    try{ parent.postMessage({__iubiPlayground:true,level:level,text:Array.prototype.map.call(args,fmt).join(' ')},'*'); }catch(e){}
  }
  ['log','info','warn','error'].forEach(function(k){
    var orig=console[k]?console[k].bind(console):function(){};
    console[k]=function(){ send(k,arguments); orig.apply(console,arguments); };
  });
  window.addEventListener('error',function(e){ send('error',[e.message]); });
  window.addEventListener('unhandledrejection',function(e){ send('error',['Promise não tratada: '+((e.reason&&e.reason.message)||e.reason)]); });
  window.IUBI_BASE='${origin}/iubi';
})();
</script>
<script data-user-code type="text/plain">${safeJs}</script>
<script>
(function(){
  try{
    var raw=document.querySelector('script[data-user-code]').textContent;
    if(!raw.trim()) return;
    if(typeof Babel==='undefined'){ console.error('Falha ao carregar o Babel (verifique a conexão).'); return; }
    var stripped=raw
      .replace(/^\\s*import\\s.*$/gm,'')
      .replace(/^\\s*export\\s+default\\s+/gm,'')
      .replace(/^\\s*export\\s+/gm,'')
      .replace(/^\\s*(?:const|let|var)\\s+IUBI_BASE\\s*=.*$/gm,'')
      .replace(/https?:\\/\\/100\\.\\d+\\.\\d+\\.\\d+(?::\\d+)?/g, window.IUBI_BASE);
    var out=Babel.transform(stripped,{presets:['react',['typescript',{allExtensions:true,isTSX:true}]],filename:'playground.tsx'}).code;
    (0,eval)(out);
  }catch(err){ console.error((err&&err.message)||String(err)); }
})();
</script>
</body>
</html>`;
}

// HTML autocontido para o usuário baixar e abrir localmente (CSS/JS inline,
// bibliotecas via CDN, IUBI_BASE apontando para o demo público).
function buildStandalone(files: PlaygroundFile[], origin: string): string {
  const html = pick(files, 'html');
  const body = html ? bodyMarkup(html.content) : '<div id="root"></div>';
  const css = joinBy(files, ['css']);
  const js = joinBy(files, JS_LANGS);
  const safeJs = js.replace(/<\/script>/gi, '<\\/script>');
  const hasJsx = JS_LANGS.some((l) => l !== 'js' && files.some((f) => f.lang === l))
    || /<[A-Za-z][^>]*>/.test(js);
  const jsScript = hasJsx
    ? `<script type="text/babel" data-presets="react,typescript">${safeJs}</script>`
    : `<script>${safeJs}</script>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>IUBI Playground</title>
<link rel="stylesheet" href="${CDN.leafletCss}" />
<script src="${CDN.react}"></script>
<script src="${CDN.reactDom}"></script>
<script src="${CDN.leaflet}"></script>
<script src="${CDN.chart}"></script>
${hasJsx ? `<script src="${CDN.babel}"></script>` : ''}
<style>${PAGE_CSS}
${css}</style>
</head>
<body>
${body}
<script>window.IUBI_BASE=${JSON.stringify(`${origin}/iubi`)};</script>
${jsScript}
</body>
</html>`;
}

function download(name: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const LEVEL_STYLE: Record<LogEntry['level'], string> = {
  log: 'text-slate-200',
  info: 'text-sky-300',
  warn: 'text-amber-300',
  error: 'text-rose-400',
};

export function CodePlayground({
  files: initialFiles,
  onClose,
}: {
  files: PlaygroundFile[];
  onClose: () => void;
}) {
  const [files, setFiles] = useState<PlaygroundFile[]>(initialFiles);
  const [activeIdx, setActiveIdx] = useState(0);
  const [srcDoc, setSrcDoc] = useState('');
  const [runKey, setRunKey] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const active = files[activeIdx] ?? files[0];

  const run = useCallback(() => {
    setLogs([]);
    setSrcDoc(buildSrcDoc(files, window.location.origin));
    setRunKey((k) => k + 1);
  }, [files]);

  const setActiveContent = useCallback(
    (content: string) => {
      setFiles((prev) => prev.map((f, i) => (i === activeIdx ? { ...f, content } : f)));
    },
    [activeIdx],
  );

  const downloadAll = useCallback(() => {
    download('iubi-playground.html', buildStandalone(files, window.location.origin), 'text/html');
  }, [files]);

  const canDownloadActive = useMemo(() => active && active.content.trim().length > 0, [active]);

  useEffect(() => {
    // roda automaticamente ao abrir
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { __iubiPlayground?: boolean; level?: LogEntry['level']; text?: string };
      if (!data || !data.__iubiPlayground) return;
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;
      setLogs((prev) => [...prev, { level: data.level ?? 'log', text: data.text ?? '' }]);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Playground de código"
        className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
          <Terminal size={17} className="text-iubi-600" />
          <span className="font-semibold text-slate-700">Playground</span>
          <span className="hidden text-xs text-slate-400 sm:inline">
            React · Leaflet (L) · Chart · fetch para <code className="font-mono">/iubi</code>
          </span>
          <button
            onClick={run}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-iubi-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-iubi-700"
          >
            <Play size={14} /> Executar
          </button>
          <button
            onClick={downloadAll}
            title="Baixar HTML completo (roda na sua máquina)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Download size={14} /> Baixar HTML
          </button>
          <button
            onClick={() => setFiles(initialFiles)}
            title="Restaurar código original"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
          <div className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 px-2 py-1">
              {files.map((f, i) => (
                <button
                  key={f.name}
                  onClick={() => setActiveIdx(i)}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ${
                    i === activeIdx
                      ? 'bg-iubi-50 text-iubi-700'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <FileCode size={12} /> {f.name}
                </button>
              ))}
              {canDownloadActive && (
                <button
                  onClick={() => download(active.name, active.content)}
                  title={`Baixar ${active.name}`}
                  className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                >
                  <Download size={14} />
                </button>
              )}
            </div>
            <textarea
              value={active?.content ?? ''}
              onChange={(e) => setActiveContent(e.target.value)}
              spellCheck={false}
              className="flex-1 resize-none bg-slate-900 p-3 font-mono text-[12.5px] leading-relaxed text-slate-100 focus:outline-none"
            />
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="border-b border-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Resultado
            </div>
            <div className="relative min-h-0 flex-1 bg-slate-50">
              {srcDoc ? (
                <iframe
                  key={runKey}
                  ref={iframeRef}
                  title="preview"
                  srcDoc={srcDoc}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  className="h-full w-full border-0 bg-white"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
                  Clique em “Executar” para rodar o projeto.
                </div>
              )}
            </div>
            <div className="flex h-40 flex-col border-t border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span>Console</span>
                {logs.length > 0 && (
                  <button onClick={() => setLogs([])} className="text-[11px] normal-case text-slate-400 hover:text-slate-600">
                    limpar
                  </button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-900 p-2 font-mono text-[12px] leading-relaxed">
                {logs.length === 0 ? (
                  <div className="text-slate-500">Sem saída ainda.</div>
                ) : (
                  logs.map((l, i) => (
                    <div key={i} className={`whitespace-pre-wrap break-words ${LEVEL_STYLE[l.level]}`}>
                      {l.level === 'error' ? '✕ ' : l.level === 'warn' ? '⚠ ' : ''}
                      {l.text}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
