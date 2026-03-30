'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { adminApi, AdminStats, ArbitroInfo } from '@/lib/admin';

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [arbitros, setArbitros] = useState<ArbitroInfo[]>([]);
  const [casos, setCasos] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'casos' | 'arbitros'>('overview');

  const token = getToken();
  const user = getUser();

  useEffect(() => {
    if (!token || user?.role !== 'ADMIN') { router.push('/dashboard'); return; }

    Promise.all([
      adminApi.getStats(token),
      adminApi.listarArbitros(token),
      adminApi.listarCasos({ page: '1', limit: '10' }, token),
    ])
      .then(([s, a, c]) => { setStats(s); setArbitros(a); setCasos(c); })
      .catch(() => router.push('/dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const handleDesignar = async (arbitragemId: string, arbitroId: string) => {
    if (!token) return;
    try {
      await adminApi.designarArbitro(arbitragemId, arbitroId, token);
      alert('Arbitro designado com sucesso');
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Carregando...</p></main>;
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700">Painel Admin</h1>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">&larr; Dashboard</Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-6">
          {(['overview', 'casos', 'arbitros'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg font-medium transition capitalize ${
                tab === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-xl shadow p-5">
                <p className="text-sm text-gray-500">Total Casos</p>
                <p className="text-3xl font-bold text-primary-700">{stats.totalCasos}</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5">
                <p className="text-sm text-gray-500">Ativos</p>
                <p className="text-3xl font-bold text-blue-600">{stats.casosAtivos}</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5">
                <p className="text-sm text-gray-500">Sentencas Pendentes</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.sentencasPendentes}</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5">
                <p className="text-sm text-gray-500">Arbitros</p>
                <p className="text-3xl font-bold text-indigo-600">{stats.totalArbitros}</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5">
                <p className="text-sm text-gray-500">Usuarios</p>
                <p className="text-3xl font-bold text-gray-600">{stats.totalUsuarios}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="font-semibold text-gray-800 mb-3">Casos por Status</h3>
                <div className="space-y-2">
                  {stats.casosPorStatus.map((c) => (
                    <div key={c.status} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{formatStatus(c.status)}</span>
                      <span className="font-bold">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="font-semibold text-gray-800 mb-3">Casos por Categoria</h3>
                <div className="space-y-2">
                  {stats.casosPorCategoria.map((c) => (
                    <div key={c.categoria} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{formatStatus(c.categoria)}</span>
                      <span className="font-bold">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Casos */}
        {tab === 'casos' && casos && (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numero</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Partes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Arbitro</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {casos.data.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono">
                      <Link href={`/arbitragens/${c.id}`} className="text-primary-600 hover:underline">
                        {c.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {c.requerente?.nome} vs {c.requerido?.nome}
                    </td>
                    <td className="px-4 py-3 text-xs">{formatStatus(c.status)}</td>
                    <td className="px-4 py-3 text-sm">
                      {c.arbitros?.length ? c.arbitros.map((a: any) => a.arbitro.nome).join(', ') : (
                        <span className="text-orange-500">Nenhum</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!c.arbitros?.length && arbitros.length > 0 && (
                        <select
                          onChange={(e) => e.target.value && handleDesignar(c.id, e.target.value)}
                          className="text-xs border rounded px-2 py-1"
                          defaultValue=""
                        >
                          <option value="">Designar...</option>
                          {arbitros.map((a) => (
                            <option key={a.id} value={a.id}>{a.nome} ({a.casosAtivos} casos)</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Arbitros */}
        {tab === 'arbitros' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {arbitros.map((a) => (
              <div key={a.id} className="bg-white rounded-xl shadow p-5">
                <h3 className="font-semibold text-gray-800">{a.nome}</h3>
                <p className="text-sm text-gray-500">{a.email}</p>
                {a.oabNumero && <p className="text-sm text-gray-400">{a.oabNumero}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                    {a.casosAtivos} casos ativos
                  </span>
                </div>
              </div>
            ))}
            {arbitros.length === 0 && (
              <p className="text-gray-500 col-span-full text-center py-8">Nenhum arbitro cadastrado.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
