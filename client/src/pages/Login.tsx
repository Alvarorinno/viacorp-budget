import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin } from '../api';
import { Building2, Lock, User } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await apiLogin(username, password);
      login(user, token);
    } catch {
      setError('Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-brand-800 p-4 rounded-2xl mb-4">
            <Building2 className="text-white" size={36} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">VíaCorp</h1>
          <p className="text-gray-500 text-sm mt-1">Control de Presupuesto & Facturación 2026</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                placeholder="director / finanzas"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-800 hover:bg-brand-900 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">Usuarios de acceso</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg p-2.5 text-center">
              <p className="text-xs font-semibold text-gray-700">Director</p>
              <p className="text-xs text-gray-500">director / dir2026</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5 text-center">
              <p className="text-xs font-semibold text-gray-700">Finanzas</p>
              <p className="text-xs text-gray-500">finanzas / fin2026</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
