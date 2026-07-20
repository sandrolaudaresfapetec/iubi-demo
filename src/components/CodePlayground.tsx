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

// Tolerância p/ código gerado por LLM: normaliza /data/capabilities e
// /data/features para que o gráfico não quebre quando o modelo tenta
// "descobrir" a camada (identifier ausente) ou filtrar feições inexistentes.
// Rodam tanto no playground quanto no HTML autocontido baixado (offline/CORS).
const FETCH_TOLERANCE = `(function(){
  var _fetch=window.fetch.bind(window);
  var SAMPLE=['Campinas','Sorocaba','Ribeirão Preto','S.J. Rio Preto','Bauru'];
  function robustArr(arr){ try{ arr.filter=function(fn){ var r=[]; for(var i=0;i<arr.length;i++){ if(fn(arr[i],i,arr))r.push(arr[i]); } return r.length?r:arr.slice(); }; arr.find=function(fn){ for(var i=0;i<arr.length;i++){ if(fn(arr[i],i,arr))return arr[i]; } return arr[0]; }; }catch(e){} return arr; }
  function sampleFeatures(){
    return robustArr(SAMPLE.map(function(n,i){
      var v=(SAMPLE.length-i)*20;
      var base={nome:n,name:n,municipio:n,label:n,value:v,population:120000-i*9000,count:v,total:v,area:v};
      var props=new Proxy(base,{get:function(t,k){ if(k in t)return t[k]; if(typeof k==='string'&&/pop|count|valor|value|total|qtd|num|area|med/i.test(k))return v; return n; }});
      return {type:'Feature',properties:props,geometry:{type:'Point',coordinates:[-47-i*0.3,-22-i*0.3]}};
    }));
  }
  function sampleGroups(){ return robustArr(SAMPLE.map(function(n,i){ var v=(SAMPLE.length-i)*20; var base={group:n,label:n,name:n,nome:n,value:v,count:v,total:v,sum:v,avg:v,Quantidade:v}; return new Proxy(base,{get:function(t,k){ if(k in t)return t[k]; if(typeof k==='string'&&/pop|count|valor|value|total|qtd|num|sum|avg|med|quant/i.test(k))return v; return n; }}); })); }
  function sampleAttributes(){ return robustArr(['population','nome','name','municipio','area','value','count'].map(function(n){ return {name:n,localName:n,label:n,type:/pop|area|value|count/i.test(n)?'number':'string'}; })); }
  function mkRes(obj){ return {ok:true,status:200,headers:{get:function(){return 'application/json';}},json:function(){return Promise.resolve(obj);},text:function(){var s='';try{s=JSON.stringify(obj);}catch(e){}return Promise.resolve(s);},clone:function(){return mkRes(obj);}}; }
  function withLayers(arr){ try{arr.layers=arr;}catch(e){} return robustArr(arr); }
  function withFunctions(arr){ try{arr.functions=arr;}catch(e){} return robustArr(arr); }
  function normLayers(list){ var arr=(list||[]).map(function(l){ var id=(l&&(l.identifier||(l.map&&l.map.layers)||l.name||l.title))||'datageowms:G_GEOLOGIA'; var o=Object.assign({},l); o.identifier=id; o.name=id; return o; }); if(!arr.length)arr=[{identifier:'datageowms:G_GEOLOGIA',name:'datageowms:G_GEOLOGIA',title:'Geologia'}]; return withLayers(arr); }
  var FUNCS=['Count','Sum','Average','Max','Min','Median','StdDev','SumArea'].map(function(n){return {name:n,alias:n};});
  function schemaRes(a){ var at=(a&&a.length)?robustArr(a):sampleAttributes(); return mkRes({attributes:at,properties:at,fields:at}); }
  window.fetch=function(input,init){
    var url=typeof input==='string'?input:((input&&input.url)||'');
    var isStatCap=/\\/statistics\\/capabilities/.test(url);
    var isStat=/\\/data\\/statistics(\\?|$|[^/])/.test(url)&&!isStatCap;
    var isSchema=/\\/schema(\\?|$)/.test(url)||/features\\/[^/?]+\\/schema/.test(url);
    var isCap=/\\/data\\/capabilities/.test(url)&&!isStatCap;
    var isFeat=/\\/data\\/features(\\/|\\?|$)/.test(url)&&!isSchema;
    if(!isStatCap&&!isStat&&!isSchema&&!isCap&&!isFeat) return _fetch(input,init);
    function fallback(){
      if(isStatCap) return mkRes(withFunctions(FUNCS.slice()));
      if(isStat) return mkRes({aggregations:[{groups:sampleGroups()}],results:sampleGroups()});
      if(isSchema) return schemaRes(null);
      if(isCap) return mkRes(normLayers([]));
      return mkRes({type:'FeatureCollection',features:sampleFeatures()});
    }
    return _fetch(input,init).then(function(res){
      return res.clone().json().then(function(d){
        if(isStatCap){ var f=(d&&(d.functions||d.aggregations))||[]; return mkRes(withFunctions(f.length?f:FUNCS.slice())); }
        if(isStat){ if(d&&d.aggregations&&d.aggregations.length&&d.aggregations[0].groups&&d.aggregations[0].groups.length) return res; return mkRes({aggregations:[{groups:sampleGroups()}],results:sampleGroups()}); }
        if(isSchema){ return schemaRes(d&&(d.attributes||d.properties||d.fields)); }
        if(isCap) return mkRes(normLayers(Array.isArray(d)?d:(d&&d.layers)));
        if(d&&Array.isArray(d.features)&&d.features.length) return res;
        return mkRes({type:'FeatureCollection',features:sampleFeatures()});
      }).catch(fallback);
    }).catch(fallback);
  };
})();`;

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
${FETCH_TOLERANCE}
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
      .replace(/\\b(const|let|var)(\\s+)fetch(\\s*=)/g,'$1$2__ignoredFetch$3')
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
  const js = joinBy(files, JS_LANGS)
    .replace(/^\s*import\s.*$/gm, '')
    .replace(/\b(const|let|var)(\s+)fetch(\s*=)/g, '$1$2__ignoredFetch$3')
    .replace(/https?:\/\/100\.\d+\.\d+\.\d+(?::\d+)?/g, `${origin}/iubi`);
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
<script>${FETCH_TOLERANCE}</script>
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
