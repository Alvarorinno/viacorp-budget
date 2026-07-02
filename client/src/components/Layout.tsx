import { ReactNode, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart3, Table2, LogOut, Building2, Menu, TrendingUp } from 'lucide-react';

type Page = 'dashboard' | 'events' | 'budget';

interface Props {
  page: Page;
  setPage: (p: Page) => void;
  children: ReactNode;
}

export default function Layout({ page, setPage, children }: Props) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { id: 'dashboard' as Page, label: 'Dashboard', icon: BarChart3 },
    { id: 'events' as Page, label: 'Eventos / Proyectos', icon: Table2 },
    ...(['director', 'viewer'].includes(user?.role ?? '')
      ? [{ id: 'budget' as Page, label: 'Presupuesto MO', icon: TrendingUp }]
      : []),
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 bg-brand-900 text-white flex flex-col
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-brand-700">
          <div className="flex items-center gap-3">
            <div className="bg-brand-700 p-2 rounded-xl">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">MrTom</h1>
              <p className="text-brand-200 text-xs leading-tight">Presupuesto Fauna BTL</p>
              <p className="text-brand-400 text-xs">2026</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setPage(id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                page === id
                  ? 'bg-brand-600 text-white'
                  : 'text-brand-300 hover:bg-brand-800 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-brand-700">
          <div className="px-4 py-2 mb-2">
            <p className="text-xs text-brand-400">Sesión activa</p>
            <p className="text-sm font-semibold">{user?.nombre}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
              user?.role === 'director' ? 'bg-amber-500/20 text-amber-300' :
              user?.role === 'viewer'   ? 'bg-purple-500/20 text-purple-300' :
                                          'bg-emerald-500/20 text-emerald-300'
            }`}>
              {user?.role === 'director' ? 'Director' : user?.role === 'viewer' ? 'Solo lectura' : 'Gte. Finanzas'}
            </span>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-brand-300 hover:bg-brand-800 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between lg:justify-end">
          <button className="lg:hidden text-gray-600" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="text-sm text-gray-500">
            {page === 'dashboard' ? 'Dashboard — Vista general 2026' : page === 'budget' ? 'Presupuesto MO 2026' : 'Gestión de Eventos & Proyectos'}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
