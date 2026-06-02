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

  if (!user) return <Login />;

  return (
    <Layout page={page} setPage={setPage}>
      {page === 'dashboard' ? <Dashboard /> : page === 'budget' ? <BudgetMO /> : <Events />}
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
