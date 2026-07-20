import { Link } from 'react-router-dom';
import { Map, LayoutDashboard, Bot, ArrowRight, Server, CheckCircle2, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useConnections } from '../lib/hooks';
import { getAiHealth } from '../lib/chat';
import { IUBI_BASE_URL } from '../lib/config';
import { Badge } from '../components/ui';

const features = [
  {
    to: '/mapa',
    icon: Map,
    title: 'Explorador de Mapa',
    desc: 'Descubra camadas de servidores GIS, adicione-as a um mapa Leaflet (WMS) e inspecione feições ao clicar.',
  },
  {
    to: '/contextos',
    icon: LayoutDashboard,
    title: 'Contextos',
    desc: 'Navegue pelos contextos salvos (WEBMAP, DASHBOARD, FORM...) do serviço de contexto do IUBI.',
  },
  {
    to: '/copilot',
    icon: Bot,
    title: 'IUBI Copilot',
    desc: 'Assistente de IA aberto (Llama via Groq) que conhece as APIs IUBI e gera código de integração.',
  },
];

export function HomePage() {
  const connections = useConnections();
  const ai = useQuery({ queryKey: ['ai-health'], queryFn: getAiHealth, retry: 0 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <section className="rounded-3xl bg-gradient-to-br from-iubi-700 to-iubi-950 text-white p-8 md:p-12 shadow-xl">
        <p className="text-iubi-200 font-mono text-sm mb-3">FITec · Geosistema IUBI</p>
        <h1 className="text-3xl md:text-5xl font-extrabold max-w-3xl leading-tight">
          Trabalhe com as APIs e componentes de geovisualização do IUBI
        </h1>
        <p className="mt-4 text-iubi-100 max-w-2xl md:text-lg">
          Um demonstrativo prático para desenvolvedores: consuma os serviços REST de catálogo,
          renderização de mapas e dados espaciais, e conte com um assistente de IA aberto para
          acelerar sua integração.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/mapa"
            className="inline-flex items-center gap-2 rounded-xl bg-white text-iubi-800 font-semibold px-5 py-3 hover:bg-iubi-50 transition-colors"
          >
            Abrir explorador de mapa <ArrowRight size={18} />
          </Link>
          <Link
            to="/copilot"
            className="inline-flex items-center gap-2 rounded-xl bg-iubi-500/30 ring-1 ring-white/30 text-white font-semibold px-5 py-3 hover:bg-iubi-500/50 transition-colors"
          >
            Conversar com o Copilot <Bot size={18} />
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-2">
            <Server size={16} /> Gateway das APIs
          </div>
          <code className="block font-mono text-xs text-iubi-700 break-all">
            {ai.data?.iubiUpstream ?? IUBI_BASE_URL}
          </code>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge>/catalog</Badge>
            <Badge>/context</Badge>
            <Badge>/map-render</Badge>
            <Badge>/ogc</Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-slate-500 text-sm font-medium mb-2">Conexões disponíveis</div>
          {connections.isLoading && <div className="text-2xl font-extrabold text-slate-300">…</div>}
          {connections.error && (
            <div className="text-sm text-red-600">Falha ao conectar às APIs.</div>
          )}
          {connections.data && (
            <>
              <div className="text-3xl font-extrabold text-slate-800">
                {connections.data.length}
              </div>
              <div className="text-xs text-slate-400">
                {connections.data.filter((c) => c.type === 'GIS_SERVER').length} servidor(es) GIS ·{' '}
                {connections.data.filter((c) => c.type === 'CATALOG').length} catálogo(s)
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-slate-500 text-sm font-medium mb-2">Assistente de IA</div>
          {ai.isLoading && <div className="text-slate-300 text-sm">verificando…</div>}
          {ai.data?.aiConfigured ? (
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={20} />
              <div>
                <div className="font-semibold">Ativo</div>
                <div className="text-xs font-mono text-slate-400">{ai.data.model}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600">
              <XCircle size={20} />
              <div className="text-sm">
                Não configurado — defina <code className="font-mono">GROQ_API_KEY</code>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        {features.map(({ to, icon: Icon, title, desc }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-iubi-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-iubi-50 text-iubi-700 p-2.5 group-hover:bg-iubi-100">
                <Icon size={22} />
              </div>
              <h3 className="font-bold text-lg text-slate-800">{title}</h3>
            </div>
            <p className="mt-3 text-sm text-slate-500">{desc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-iubi-600">
              Explorar <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
