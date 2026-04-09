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
        <div className="p-8 max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="h-8 w-48 bg-gray-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none"
              >
                <div className="h-4 w-24 bg-gray-200 dark:bg-slate-700 rounded animate-pulse mb-3" />
                <div className="h-8 w-16 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
            <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-3 border-b dark:border-slate-700 last:border-0">
                <div className="h-4 w-full bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
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

        {/* Role-based KPI cards */}
        {(() => {
          const role = user?.role;
          const cardClass = 'bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none';

          if (role === 'ADMIN') {
            return (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className={cardClass}>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Total Casos</h3>
                  <p className="text-3xl font-bold text-primary-700 dark:text-white mt-2">{totalCasos}</p>
                </div>
                <div className={cardClass}>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Prazos Ativos</h3>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">{prazosPendentes}</p>
                </div>
                <Link href="/notificacoes" className={`${cardClass} hover:bg-gray-50 dark:hover:bg-slate-700/50 transition block`}>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Notificacoes</h3>
                  <p className="text-3xl font-bold text-gray-600 dark:text-slate-300 mt-2">{naoLidas}</p>
                </Link>
                <div className={cardClass}>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Usuarios</h3>
                  <p className="text-3xl font-bold text-gray-600 dark:text-slate-300 mt-2">0</p>
                </div>
              </div>
            );
          }

          if (role === 'ARBITRO') {
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className={cardClass}>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Casos Designados</h3>
                  <p className="text-3xl font-bold text-primary-700 dark:text-white mt-2">{totalCasos}</p>
                </div>
                <div className={cardClass}>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Sentencas Pendentes</h3>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">0</p>
                </div>
                <Link href="/notificacoes" className={`${cardClass} hover:bg-gray-50 dark:hover:bg-slate-700/50 transition block`}>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Notificacoes</h3>
                  <p className="text-3xl font-bold text-gray-600 dark:text-slate-300 mt-2">{naoLidas}</p>
                </Link>
              </div>
            );
          }

          if (role === 'ADVOGADO') {
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className={cardClass}>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Clientes Representados</h3>
                  <p className="text-3xl font-bold text-primary-700 dark:text-white mt-2">{totalCasos}</p>
                </div>
                <div className={cardClass}>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Prazos dos Clientes</h3>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">{prazosPendentes}</p>
                </div>
                <Link href="/notificacoes" className={`${cardClass} hover:bg-gray-50 dark:hover:bg-slate-700/50 transition block`}>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Notificacoes</h3>
                  <p className="text-3xl font-bold text-gray-600 dark:text-slate-300 mt-2">{naoLidas}</p>
                </Link>
              </div>
            );
          }

          // USUARIO (pessoa fisica/empresa que pode ser requerente ou requerido)
          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className={cardClass}>
                <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Casos Ativos</h3>
                <p className="text-3xl font-bold text-primary-700 dark:text-white mt-2">{totalCasos}</p>
              </div>
              <div className={cardClass}>
                <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Prazos Pendentes</h3>
                <p className="text-3xl font-bold text-yellow-600 mt-2">{prazosPendentes}</p>
              </div>
              <Link href="/notificacoes" className={`${cardClass} hover:bg-gray-50 dark:hover:bg-slate-700/50 transition block`}>
                <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Notificacoes</h3>
                <p className="text-3xl font-bold text-gray-600 dark:text-slate-300 mt-2">{naoLidas}</p>
              </Link>
            </div>
          );
        })()}

        {/* Alerta: convites pendentes (user e requerido em algum caso) */}
        {user?.role === 'USUARIO' && arbitragens.some((a) => a.status === 'AGUARDANDO_ACEITE' && a.requerido?.id === user?.id) && (
          <div className="mb-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700/50">
            <p className="text-yellow-800 dark:text-yellow-300 font-medium">
              Voce tem convites pendentes!
            </p>
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
              Ha casos aguardando seu aceite. Verifique a lista abaixo.
            </p>
          </div>
        )}

        {user?.role === 'ARBITRO' && arbitragens.length > 0 && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-700/50">
            <p className="text-red-800 dark:text-red-300 font-medium">
              {arbitragens.length} caso(s) aguardando sua revisao
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">
              {user?.role === 'ADMIN' ? 'Ultimos Casos' :
               user?.role === 'ARBITRO' ? 'Casos Designados' :
               user?.role === 'ADVOGADO' ? 'Casos dos Clientes' :
               'Meus Casos'}
            </h2>
            <div className="flex gap-2">
              {user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
                >
                  Painel Admin
                </Link>
              )}
              {user?.role === 'USUARIO' && (
                <Link
                  href="/arbitragens/nova"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm"
                >
                  + Nova Arbitragem
                </Link>
              )}
              {user?.role === 'ADVOGADO' && (
                <Link
                  href="/arbitragens/nova"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm"
                >
                  + Iniciar Arbitragem para Cliente
                </Link>
              )}
            </div>
          </div>

          {arbitragens.length === 0 ? (
            <p className="text-gray-500 dark:text-slate-400 text-center py-8">
              Nenhum caso encontrado.
              {user?.role === 'USUARIO' && (
                <>
                  {' '}
                  <Link href="/arbitragens/nova" className="text-primary-600 dark:text-primary-400 hover:underline">
                    Inicie uma nova arbitragem
                  </Link>
                </>
              )}
              {user?.role === 'ADVOGADO' && (
                <>
                  {' '}
                  <Link href="/arbitragens/nova" className="text-primary-600 dark:text-primary-400 hover:underline">
                    Inicie uma arbitragem para um cliente
                  </Link>
                </>
              )}
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
