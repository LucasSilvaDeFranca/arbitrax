'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { arbitragensApi, Arbitragem, ArbitragemListResponse } from '@/lib/arbitragens';
import AuthLayout from '@/components/AuthLayout';

const STATUS_COLORS: Record<string, string> = {
  AGUARDANDO_PAGAMENTO_REGISTRO: 'bg-yellow-100 text-yellow-800',
  AGUARDANDO_ACEITE: 'bg-blue-100 text-blue-800',
  AGUARDANDO_ASSINATURA: 'bg-blue-100 text-blue-800',
  AGUARDANDO_PAGAMENTO_TAXA: 'bg-yellow-100 text-yellow-800',
  EM_INSTRUCAO: 'bg-indigo-100 text-indigo-800',
  AGUARDANDO_PETICAO: 'bg-orange-100 text-orange-800',
  AGUARDANDO_CONTESTACAO: 'bg-orange-100 text-orange-800',
  ANALISE_PROVAS: 'bg-purple-100 text-purple-800',
  GERANDO_SENTENCA: 'bg-purple-100 text-purple-800',
  SENTENCA_EM_REVISAO: 'bg-purple-100 text-purple-800',
  SENTENCA_APROVADA: 'bg-green-100 text-green-800',
  SENTENCA_RATIFICADA: 'bg-green-100 text-green-800',
  ENCERRADA: 'bg-gray-100 text-gray-800',
  RECUSADA: 'bg-red-100 text-red-800',
  CANCELADA: 'bg-red-100 text-red-800',
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
    return <AuthLayout><div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-500">Carregando...</p></div></AuthLayout>;
  }

  return (
    <AuthLayout>
      <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700">Minhas Arbitragens</h1>
          <Link
            href="/arbitragens/nova"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            + Nova Arbitragem
          </Link>
        </div>

        {!data?.data.length ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <p className="text-gray-500 mb-4">Nenhuma arbitragem encontrada.</p>
            <Link href="/arbitragens/nova" className="text-primary-600 hover:underline">
              Iniciar nova arbitragem
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numero</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Partes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.data.map((arb: Arbitragem) => (
                  <tr
                    key={arb.id}
                    onClick={() => router.push(`/arbitragens/${arb.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 text-sm font-mono font-medium">{arb.numero}</td>
                    <td className="px-6 py-4 text-sm">
                      {arb.requerente?.nome} vs {arb.requerido?.nome}
                    </td>
                    <td className="px-6 py-4 text-sm">R$ {Number(arb.valorCausa).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[arb.status] || 'bg-gray-100'}`}>
                        {formatStatus(arb.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(arb.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.meta.totalPages > 1 && (
              <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500">
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
