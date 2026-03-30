'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

interface User {
  id: string;
  nome: string;
  email: string;
  role: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }

    authApi
      .me(token)
      .then(setUser)
      .catch(() => {
        localStorage.clear();
        router.push('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary-700">Dashboard</h1>
            <p className="text-gray-500">Bem-vindo, {user?.nome}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
              {user?.role}
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-600 hover:text-red-600 transition"
            >
              Sair
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Casos Ativos</h3>
            <p className="text-3xl font-bold text-primary-700 mt-2">0</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Prazos Pendentes</h3>
            <p className="text-3xl font-bold text-yellow-600 mt-2">0</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Notificacoes</h3>
            <p className="text-3xl font-bold text-gray-600 mt-2">0</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Meus Casos</h2>
          <p className="text-gray-500 text-center py-8">
            Nenhum caso encontrado. Inicie uma nova arbitragem para comecar.
          </p>
        </div>
      </div>
    </main>
  );
}
