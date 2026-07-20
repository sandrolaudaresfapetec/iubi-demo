import { NavLink, Outlet } from 'react-router-dom';
import { Map, LayoutDashboard, BarChart3, Bot, Globe2 } from 'lucide-react';
import { IUBI_BASE_URL } from '../lib/config';

const navItems = [
  { to: '/', label: 'Início', icon: Globe2, end: true },
  { to: '/mapa', label: 'Explorador de Mapa', icon: Map },
  { to: '/contextos', label: 'Contextos', icon: LayoutDashboard },
  { to: '/estatisticas', label: 'Estatísticas', icon: BarChart3 },
  { to: '/copilot', label: 'IUBI Copilot', icon: Bot },
];

export function Layout() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-[1000]">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center gap-6">
          <NavLink to="/" className="flex items-center gap-3 shrink-0">
            <img src="/iubi-logo.png" alt="IUBI Geosistema" className="h-10 w-auto" />
            <div className="leading-tight border-l border-slate-200 pl-3 hidden sm:block">
              <div className="font-extrabold text-iubi-800 text-sm">Demo</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Geovisualização & APIs
              </div>
            </div>
          </NavLink>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-iubi-50 text-iubi-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 min-h-0">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <span>
            Demonstrativo das APIs IUBI · via{' '}
            <code className="font-mono text-slate-500">{IUBI_BASE_URL}</code>
          </span>
          <span>Assistente por Llama (open-weight) via Groq</span>
        </div>
      </footer>
    </div>
  );
}
