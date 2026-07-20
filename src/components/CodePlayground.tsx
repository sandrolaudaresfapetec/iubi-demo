import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, X, RotateCcw, Terminal } from 'lucide-react';

interface LogEntry {
  level: 'log' | 'info' | 'warn' | 'error';
  text: string;
}

// Monta o documento do iframe: React/ReactDOM/Leaflet como globais, Babel para
// transpilar JSX/TS, captura de console via postMessage e o código do usuário.
// Usa allow-same-origin para que chamadas fetch('/iubi/...') sejam de mesma
// origem (o backend do demo não envia CORS); é um sandbox de código do próprio
// demo, gerado pelo Copilot, então o trade-off é aceitável aqui.
function buildSrcDoc(code: string, origin: string): string {
  const safe = code.replace(/<\/script>/gi, '<\\/script>');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<base href="${origin}/" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>
<style>
  html,body{margin:0;height:100%;font-family:system-ui,-apple-system,sans-serif;color:#334155;}
  #root{height:100vh;width:100%;box-sizing:border-box;}
  .leaflet-container{height:100%;width:100%;}
</style>
</head>
<body>
<div id="root"></div>
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
<script data-user-code type="text/plain">${safe}</script>
<script>
(function(){
  try{
    if(typeof Babel==='undefined'){ console.error('Falha ao carregar o Babel (verifique a conexão).'); return; }
    var raw=document.querySelector('script[data-user-code]').textContent;
    var stripped=raw
      .replace(/^\\s*import\\s.*$/gm,'')
      .replace(/^\\s*export\\s+default\\s+/gm,'')
      .replace(/^\\s*export\\s+/gm,'');
    var out=Babel.transform(stripped,{presets:['react',['typescript',{allExtensions:true,isTSX:true}]],filename:'playground.tsx'}).code;
    (0,eval)(out);
  }catch(err){ console.error((err&&err.message)||String(err)); }
})();
</script>
</body>
</html>`;
}

const LEVEL_STYLE: Record<LogEntry['level'], string> = {
  log: 'text-slate-200',
  info: 'text-sky-300',
  warn: 'text-amber-300',
  error: 'text-rose-400',
};

export function CodePlayground({
  initialCode,
  onClose,
}: {
  initialCode: string;
  onClose: () => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [srcDoc, setSrcDoc] = useState('');
  const [runKey, setRunKey] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const run = useCallback(() => {
    setLogs([]);
    setSrcDoc(buildSrcDoc(code, window.location.origin));
    setRunKey((k) => k + 1);
  }, [code]);

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
            React · ReactDOM · Leaflet (L) · fetch para <code className="font-mono">/iubi</code>
          </span>
          <button
            onClick={run}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-iubi-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-iubi-700"
          >
            <Play size={14} /> Executar
          </button>
          <button
            onClick={() => setCode(initialCode)}
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
            <div className="border-b border-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Código
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="flex-1 resize-none bg-slate-900 p-3 font-mono text-[12.5px] leading-relaxed text-slate-100 focus:outline-none"
            />
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="border-b border-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Pré-visualização
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
                  Clique em “Executar” para rodar o código neste sandbox.
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
