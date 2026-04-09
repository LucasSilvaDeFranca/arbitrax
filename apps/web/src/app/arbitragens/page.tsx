'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { arbitragensApi, Arbitragem, ArbitragemListResponse } from '@/lib/arbitragens';
import AuthLayout from '@/components/AuthLayout';

const STATUS_COLORS: Record<string, string> = {
  AGUARDANDO_PAGAMENTO_REGISTRO: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  AGUARDANDO_ACEITE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  AGUARDANDO_ASSINATURA: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  AGUARDANDO_PAGAMENTO_TAXA: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  EM_INSTRUCAO: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  AGUARDANDO_PETICAO: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  AGUARDANDO_CONTESTACAO: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  ANALISE_PROVAS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  GERANDO_SENTENCA: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  SENTENCA_EM_REVISAO: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  SENTENCA_APROVADA: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  SENTENCA_RATIFICADA: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  ENCERRADA: 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200',
  RECUSADA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  CANCELADA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default function ArbitragensListPage() {
  const router = useRouter();
  const [data, setData] = useState<ArbitragemListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }

    arbitragensApi.list({ page: '1', limit: '20' }, token)
      .then(setData)
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <AuthLayout>
        <div className="p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div className="h-8 w-64 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-10 w-40 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
            <div className="bg-white rounded-xl shadow overflow-hidden dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="px-6 py-4 border-b dark:border-slate-700 last:border-0 flex gap-4">
                  <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
                  <div className="h-4 flex-1 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
                  <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700 dark:text-white">Minhas Arbitragens</h1>
          <Link
            href="/arbitragens/nova"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            + Nova Arbitragem
          </Link>
        </div>

        {!data?.data.length ? (
          <div className="bg-white rounded-xl shadow p-8 text-center dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
            <p className="text-gray-500 dark:text-slate-400 mb-4">Nenhuma arbitragem encontrada.</p>
            <Link href="/arbitragens/nova" className="text-primary-600 dark:text-primary-400 hover:underline">
              Iniciar nova arbitragem
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Numero</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Partes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Valor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {data.data.map((arb: Arbitragem) => (
                  <tr
                    key={arb.id}
                    onClick={() => router.push(`/arbitragens/${arb.id}`)}
                    className="hover:bg-gray-50 dark:hover:bg-slate-700/30 cursor-pointer"
                  >
                    <td className="px-6 py-4 text-sm font-mono font-medium">{arb.numero}</td>
                    <td className="px-6 py-4 text-sm">
                      {arb.requerente?.nome} vs {arb.requerido?.nome}
                    </td>
                    <td className="px-6 py-4 text-sm">R$ {Number(arb.valorCausa).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[arb.status] || 'bg-gray-100 dark:bg-slate-700 dark:text-slate-200'}`}>
                        {formatStatus(arb.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">
                      {new Date(arb.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.meta.totalPages > 1 && (
              <div className="px-6 py-3 bg-gray-50 dark:bg-slate-800/50 text-sm text-gray-500 dark:text-slate-400">
                Pagina {data.meta.page} de {data.meta.totalPages} ({data.meta.total} casos)
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </AuthLayout>
  );
}
