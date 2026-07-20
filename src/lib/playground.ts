// Analisa as respostas do Copilot em busca de "arquivos" de código (cercas ```
// com um cabeçalho tipo "html file=index.html") para montar um projeto executável
// no playground.

export type FileLang = 'html' | 'css' | 'js' | 'ts' | 'jsx' | 'tsx';

export interface PlaygroundFile {
  name: string;
  lang: FileLang;
  content: string;
}

const EXT_LANG: Record<string, FileLang> = {
  html: 'html',
  htm: 'html',
  css: 'css',
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  jsx: 'jsx',
  ts: 'ts',
  tsx: 'tsx',
};

const LANG_ALIAS: Record<string, FileLang> = {
  html: 'html',
  css: 'css',
  js: 'js',
  javascript: 'js',
  jsx: 'jsx',
  ts: 'ts',
  typescript: 'ts',
  tsx: 'tsx',
};

const DEFAULT_NAME: Record<FileLang, string> = {
  html: 'index.html',
  css: 'styles.css',
  js: 'app.js',
  jsx: 'app.jsx',
  ts: 'app.ts',
  tsx: 'app.tsx',
};

export const JS_LANGS: FileLang[] = ['js', 'jsx', 'ts', 'tsx'];

interface ParsedInfo {
  lang: FileLang | null;
  name: string | null;
}

function inferLangFromName(name: string): FileLang | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_LANG[ext] ?? null;
}

// Interpreta o cabeçalho da cerca: "html", "html file=index.html",
// "js title=app.js", "index.html", "tsx:App.tsx".
function parseInfoString(info: string): ParsedInfo {
  const trimmed = info.trim();
  if (!trimmed) return { lang: null, name: null };

  let lang: FileLang | null = null;
  let name: string | null = null;

  for (const token of trimmed.split(/\s+/)) {
    const kv = token.match(/^(?:file|name|title)=(.+)$/i);
    if (kv) {
      name = kv[1].replace(/^["']|["']$/g, '');
      continue;
    }
    const colon = token.match(/^([a-z]+):(.+)$/i);
    if (colon && LANG_ALIAS[colon[1].toLowerCase()]) {
      lang = LANG_ALIAS[colon[1].toLowerCase()];
      name = colon[2];
      continue;
    }
    if (LANG_ALIAS[token.toLowerCase()]) {
      lang = LANG_ALIAS[token.toLowerCase()];
      continue;
    }
    if (token.includes('.') && inferLangFromName(token)) {
      name = token;
    }
  }

  if (!lang && name) lang = inferLangFromName(name);
  return { lang, name };
}

// Extrai a lista de arquivos executáveis de um texto markdown.
export function parseProjectFiles(text: string): PlaygroundFile[] {
  const parts = text.split(/```/);
  const files: PlaygroundFile[] = [];
  const usedNames = new Set<string>();

  for (let i = 1; i < parts.length; i += 2) {
    const block = parts[i];
    const nl = block.indexOf('\n');
    const info = nl >= 0 ? block.slice(0, nl) : '';
    const body = (nl >= 0 ? block.slice(nl + 1) : '').replace(/\n$/, '');
    if (!body.trim()) continue;

    const { lang, name } = parseInfoString(info);
    if (!lang) continue;

    let finalName = name ?? DEFAULT_NAME[lang];
    if (usedNames.has(finalName)) {
      const dot = finalName.lastIndexOf('.');
      const base = dot > 0 ? finalName.slice(0, dot) : finalName;
      const ext = dot > 0 ? finalName.slice(dot) : '';
      let n = 2;
      while (usedNames.has(`${base}-${n}${ext}`)) n += 1;
      finalName = `${base}-${n}${ext}`;
    }
    usedNames.add(finalName);
    files.push({ name: finalName, lang, content: body });
  }

  return files;
}

// Um projeto é "executável" se tiver ao menos um html, ou um js/ts (que pode
// montar em #root sozinho).
export function hasRunnableProject(files: PlaygroundFile[]): boolean {
  return files.some((f) => f.lang === 'html' || JS_LANGS.includes(f.lang));
}
