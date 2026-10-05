import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import BudgetMO from './pages/BudgetMO';
import Layout from './components/Layout';

type Page = 'dashboard' | 'events' | 'budget';

function AppContent() {
  const { user } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [eventsMonth, setEventsMonth] = useState('');

  // Rol 'eventos' siempre ve solo la vista de eventos, sin importar el estado interno
  const activePage: Page = user?.role === 'eventos' ? 'events' : page;

  // Navega a Eventos pre-filtrando por mes
  const navToEvents = (month: string) => {
    setEventsMonth(month);
    setPage('events');
  };

  // Cuando el usuario cambia de página desde el sidebar, limpia el filtro de mes
  const handleSetPage = (p: Page) => {
    if (user?.role === 'eventos') return;
    setPage(p);
    if (p === 'events') setEventsMonth('');
  };

  if (!user) return <Login />;

  return (
    <Layout page={activePage} setPage={handleSetPage}>
      {activePage === 'dashboard'
        ? <Dashboard onMonthClick={navToEvents} />
        : activePage === 'budget'
        ? <BudgetMO />
        : <Events initialMonth={eventsMonth} />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
