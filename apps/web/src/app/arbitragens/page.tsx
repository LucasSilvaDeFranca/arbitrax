'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { arbitragensApi, Arbitragem, ArbitragemListResponse } from '@/lib/arbitragens';
import { papelSimples } from '@/lib/papel-no-caso';
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

type PapelFiltro = 'todos' | 'requerente' | 'requerido';

/**
 * Retorna o papel processual do user logado nesta arbitragem (por caso).
 * O user.id deve bater com requerente.id ou requerido.id do caso.
 */
export default function ArbitragensListPage() {
  const router = useRouter();
  const [data, setData] = useState<ArbitragemListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busca, setBusca] = useState('');
  const [papelFiltro, setPapelFiltro] = useState<PapelFiltro>('todos');

  const user = typeof window !== 'undefined' ? getUser() : null;

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }

    arbitragensApi.list({ page: '1', limit: '50' }, token)
      .then(setData)
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const arbsFiltradas = useMemo(() => {
    if (!data?.data) return [];
    const termo = busca.trim().toLowerCase();
    return data.data.filter((arb) => {
      // Filtro por papel processual
      if (papelFiltro !== 'todos') {
        const papel = papelSimples(arb, user?.id);
        if (papel !== papelFiltro) return false;
      }
      // Filtro por texto (numero, nome requerente, nome requerido, status)
      if (termo) {
        const haystack = [
          arb.numero,
          arb.requerente?.nome,
          arb.requerido?.nome,
          arb.status,
          arb.categoria,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(termo)) return false;
      }
      return true;
    });
  }, [data, busca, papelFiltro, user?.id]);

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
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-primary-700 dark:text-white">Minhas Arbitragens</h1>
            <Link
              href="/arbitragens/nova"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              + Nova Arbitragem
            </Link>
          </div>

          {/* Barra de filtros */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Buscar por numero, nome, status..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>
            <div className="flex gap-2">
              {(['todos', 'requerente', 'requerido'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPapelFiltro(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                    papelFiltro === p
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {p === 'todos' ? 'Todos' : p === 'requerente' ? 'Como Requerente' : 'Como Requerido'}
                </button>
              ))}
            </div>
          </div>

          {!data?.data.length ? (
            <div className="bg-white rounded-xl shadow p-8 text-center dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
              <p className="text-gray-500 dark:text-slate-400 mb-4">Nenhuma arbitragem encontrada.</p>
              <Link href="/arbitragens/nova" className="text-primary-600 dark:text-primary-400 hover:underline">
                Iniciar nova arbitragem
              </Link>
            </div>
          ) : arbsFiltradas.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-8 text-center dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
              <p className="text-gray-500 dark:text-slate-400">Nenhum caso bate com os filtros aplicados.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow overflow-hidden dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Numero</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Seu Papel</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Partes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Valor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {arbsFiltradas.map((arb: Arbitragem) => {
                    const papel = papelSimples(arb, user?.id);
                    return (
                      <tr
                        key={arb.id}
                        onClick={() => router.push(`/arbitragens/${arb.id}`)}
                        className="hover:bg-gray-50 dark:hover:bg-slate-700/30 cursor-pointer"
                      >
                        <td className="px-6 py-4 text-sm font-mono font-medium">{arb.numero}</td>
                        <td className="px-6 py-4">
                          {papel === 'requerente' && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                              Requerente
                            </span>
                          )}
                          {papel === 'requerido' && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                              Requerido
                            </span>
                          )}
                          {papel === 'outro' && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              Outro
                            </span>
                          )}
                        </td>
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
                    );
                  })}
                </tbody>
              </table>

              <div className="px-6 py-3 bg-gray-50 dark:bg-slate-800/50 text-sm text-gray-500 dark:text-slate-400">
                {arbsFiltradas.length} de {data.meta.total} {data.meta.total === 1 ? 'caso' : 'casos'}
                {papelFiltro !== 'todos' && ` (filtrado por ${papelFiltro === 'requerente' ? 'requerente' : 'requerido'})`}
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
