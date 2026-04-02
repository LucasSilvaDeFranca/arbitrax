'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { api } from '@/lib/api';
import AuthLayout from '@/components/AuthLayout';

interface CasoArbitro {
  arbitragem: {
    id: string;
    numero: string;
    status: string;
    valorCausa: number;
    categoria: string;
    createdAt: string;
    requerente?: { nome: string };
    requerido?: { nome: string };
  };
}

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default function ArbitroPage() {
  const router = useRouter();
  const [casos, setCasos] = useState<CasoArbitro[]>([]);
  const [loading, setLoading] = useState(true);

  const token = getToken();
  const user = getUser();

  useEffect(() => {
    if (!token || user?.role !== 'ARBITRO') { router.push('/dashboard'); return; }

    api<CasoArbitro[]>('/api/v1/arbitros/meus-casos', { token })
      .then((data) => setCasos(data))
      .catch(() => router.push('/dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-gray-500">Carregando...</p>
        </div>
      </AuthLayout>
    );
  }

  const sentencasPendentes = casos.filter(
    (c) => ['SENTENCA_EM_REVISAO', 'SENTENCA_APROVADA'].includes(c.arbitragem.status),
  ).length;

  return (
    <AuthLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-primary-700">Meus Casos</h1>
            <p className="text-gray-500 text-sm mt-1">Casos designados para voce</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow p-5">
              <p className="text-sm text-gray-500">Total de Casos</p>
              <p className="text-3xl font-bold text-primary-700">{casos.length}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-5">
              <p className="text-sm text-gray-500">Sentencas Pendentes</p>
              <p className="text-3xl font-bold text-yellow-600">{sentencasPendentes}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-5">
              <p className="text-sm text-gray-500">Encerrados</p>
              <p className="text-3xl font-bold text-green-600">
                {casos.filter((c) => c.arbitragem.status === 'ENCERRADA').length}
              </p>
            </div>
          </div>

          {/* Cases table */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numero</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Partes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {casos.map((c) => (
                  <tr key={c.arbitragem.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono">
                      <Link href={`/arbitragens/${c.arbitragem.id}`} className="text-primary-600 hover:underline">
                        {c.arbitragem.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {c.arbitragem.requerente?.nome || '-'} vs {c.arbitragem.requerido?.nome || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        {formatStatus(c.arbitragem.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      R$ {Number(c.arbitragem.valorCausa).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatStatus(c.arbitragem.categoria)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <Link
                          href={`/arbitragens/${c.arbitragem.id}`}
                          className="text-primary-600 hover:underline text-xs"
                        >
                          Ver caso
                        </Link>
                        <Link
                          href={`/arbitro/impedimento/${c.arbitragem.id}`}
                          className="text-red-500 hover:underline text-xs"
                        >
                          Impedimento
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {casos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Nenhum caso designado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
