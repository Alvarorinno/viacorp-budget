import { useState, useEffect } from 'react';
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

  // Al iniciar sesión, rol 'eventos' va directo a la vista de eventos
  useEffect(() => {
    if (user?.role === 'eventos') setPage('events');
  }, [user?.role]);

  // Navega a Eventos pre-filtrando por mes
  const navToEvents = (month: string) => {
    setEventsMonth(month);
    setPage('events');
  };

  // Cuando el usuario cambia de página desde el sidebar, limpia el filtro de mes
  const handleSetPage = (p: Page) => {
    if (user?.role === 'eventos') return; // no puede cambiar de vista
    setPage(p);
    if (p === 'events') setEventsMonth(''); // navegación directa → sin filtro
  };

  if (!user) return <Login />;

  return (
    <Layout page={page} setPage={handleSetPage}>
      {page === 'dashboard'
        ? <Dashboard onMonthClick={navToEvents} />
        : page === 'budget'
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
