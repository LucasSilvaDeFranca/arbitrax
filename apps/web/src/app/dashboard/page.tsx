'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi, api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { arbitragensApi, Arbitragem } from '@/lib/arbitragens';
import { notificacoesApi } from '@/lib/notificacoes';
import AuthLayout from '@/components/AuthLayout';

interface User {
  id: string;
  nome: string;
  email: string;
  role: string;
}

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [arbitragens, setArbitragens] = useState<Arbitragem[]>([]);
  const [totalCasos, setTotalCasos] = useState(0);
  const [prazosPendentes, setPrazosPendentes] = useState(0);
  const [naoLidas, setNaoLidas] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }

    Promise.all([
      authApi.me(token),
      arbitragensApi.list({ page: '1', limit: '5' }, token),
      notificacoesApi.list(token).catch(() => ({ naoLidas: 0 })),
      api<{ count: number }>('/api/v1/prazos/count', { token }).catch(() => ({ count: 0 })),
    ])
      .then(([userData, arbData, notifData, prazosData]) => {
        setUser(userData);
        setArbitragens(arbData.data);
        setTotalCasos(arbData.meta.total);
        setNaoLidas(notifData.naoLidas);
        setPrazosPendentes(prazosData.count);
      })
      .catch(() => {
        localStorage.clear();
        router.push('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-gray-400 dark:text-slate-500">Carregando...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary-700 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-slate-400">Bem-vindo, {user?.nome}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Casos Ativos</h3>
            <p className="text-3xl font-bold text-primary-700 dark:text-white mt-2">{totalCasos}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Prazos Pendentes</h3>
            <p className="text-3xl font-bold text-yellow-600 mt-2">{prazosPendentes}</p>
          </div>
          <Link href="/notificacoes" className="bg-white rounded-xl shadow p-6 hover:bg-gray-50 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none dark:hover:bg-slate-700/50 transition block">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Notificacoes</h3>
            <p className="text-3xl font-bold text-gray-600 dark:text-slate-300 mt-2">{naoLidas}</p>
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">Meus Casos</h2>
            <Link
              href="/arbitragens/nova"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm"
            >
              + Nova Arbitragem
            </Link>
          </div>

          {arbitragens.length === 0 ? (
            <p className="text-gray-500 dark:text-slate-400 text-center py-8">
              Nenhum caso encontrado.{' '}
              <Link href="/arbitragens/nova" className="text-primary-600 dark:text-primary-400 hover:underline">
                Inicie uma nova arbitragem
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              {arbitragens.map((arb) => (
                <Link
                  key={arb.id}
                  href={`/arbitragens/${arb.id}`}
                  className="flex justify-between items-center p-4 bg-gray-50 dark:bg-slate-800/30 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                >
                  <div>
                    <span className="font-mono text-sm font-medium">{arb.numero}</span>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {arb.requerente?.nome} vs {arb.requerido?.nome}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">
                      R$ {Number(arb.valorCausa).toLocaleString('pt-BR')}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{formatStatus(arb.status)}</p>
                  </div>
                </Link>
              ))}

              {totalCasos > 5 && (
                <Link href="/arbitragens" className="block text-center text-primary-600 dark:text-primary-400 hover:underline text-sm pt-2">
                  Ver todos ({totalCasos} casos)
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
