'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { adminApi, AdminStats, ArbitroInfo } from '@/lib/admin';
import AuthLayout from '@/components/AuthLayout';

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
  const [novoArbitro, setNovoArbitro] = useState({ nome: '', cpfCnpj: '', email: '', telefone: '', oabNumero: '' });
  const [criandoArbitro, setCriandoArbitro] = useState(false);

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
    return <AuthLayout><div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-500 dark:text-slate-400">Carregando...</p></div></AuthLayout>;
  }

  return (
    <AuthLayout>
      <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary-700 dark:text-white">Painel Admin</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-6">
          {(['overview', 'casos', 'arbitros'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg font-medium transition capitalize ${
                tab === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
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
              <div className="bg-white rounded-xl shadow p-5 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
                <p className="text-sm text-gray-500 dark:text-slate-400">Total Casos</p>
                <p className="text-3xl font-bold text-primary-700">{stats.totalCasos}</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
                <p className="text-sm text-gray-500 dark:text-slate-400">Ativos</p>
                <p className="text-3xl font-bold text-blue-600">{stats.casosAtivos}</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
                <p className="text-sm text-gray-500 dark:text-slate-400">Sentencas Pendentes</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.sentencasPendentes}</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
                <p className="text-sm text-gray-500 dark:text-slate-400">Arbitros</p>
                <p className="text-3xl font-bold text-indigo-600">{stats.totalArbitros}</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
                <p className="text-sm text-gray-500 dark:text-slate-400">Usuarios</p>
                <p className="text-3xl font-bold text-gray-600">{stats.totalUsuarios}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
                <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-3">Casos por Status</h3>
                <div className="space-y-2">
                  {stats.casosPorStatus.map((c) => (
                    <div key={c.status} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-slate-300">{formatStatus(c.status)}</span>
                      <span className="font-bold">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
                <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-3">Casos por Categoria</h3>
                <div className="space-y-2">
                  {stats.casosPorCategoria.map((c) => (
                    <div key={c.categoria} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-slate-300">{formatStatus(c.categoria)}</span>
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
          <div className="bg-white rounded-xl shadow overflow-hidden dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Numero</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Partes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Arbitro</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Acao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {casos.data.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-sm font-mono">
                      <Link href={`/arbitragens/${c.id}`} className="text-primary-600 dark:text-primary-400 hover:underline">
                        {c.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {c.requerente?.nome} vs {c.requerido?.nome}
                    </td>
                    <td className="px-4 py-3 text-xs dark:text-slate-300">{formatStatus(c.status)}</td>
                    <td className="px-4 py-3 text-sm">
                      {c.arbitros?.length ? c.arbitros.map((a: any) => a.arbitro.nome).join(', ') : (
                        <span className="text-orange-500">Nenhum</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!c.arbitros?.length && arbitros.length > 0 && (
                        <select
                          onChange={(e) => e.target.value && handleDesignar(c.id, e.target.value)}
                          className="text-xs border rounded px-2 py-1 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
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
          <div className="space-y-6">
          {/* Form de cadastro */}
          <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Cadastrar Novo Arbitro</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!token) return;
                setCriandoArbitro(true);
                try {
                  await adminApi.criarArbitro(novoArbitro, token);
                  setNovoArbitro({ nome: '', cpfCnpj: '', email: '', telefone: '', oabNumero: '' });
                  const a = await adminApi.listarArbitros(token);
                  setArbitros(a);
                  alert('Arbitro cadastrado com sucesso');
                } catch (err: any) {
                  alert(err.message);
                } finally {
                  setCriandoArbitro(false);
                }
              }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <input
                type="text"
                placeholder="Nome completo"
                value={novoArbitro.nome}
                onChange={(e) => setNovoArbitro({ ...novoArbitro, nome: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                required
              />
              <input
                type="text"
                placeholder="CPF/CNPJ"
                value={novoArbitro.cpfCnpj}
                onChange={(e) => setNovoArbitro({ ...novoArbitro, cpfCnpj: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={novoArbitro.email}
                onChange={(e) => setNovoArbitro({ ...novoArbitro, email: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                required
              />
              <input
                type="text"
                placeholder="Telefone"
                value={novoArbitro.telefone}
                onChange={(e) => setNovoArbitro({ ...novoArbitro, telefone: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                required
              />
              <input
                type="text"
                placeholder="OAB (opcional)"
                value={novoArbitro.oabNumero}
                onChange={(e) => setNovoArbitro({ ...novoArbitro, oabNumero: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <button
                type="submit"
                disabled={criandoArbitro}
                className="bg-primary-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {criandoArbitro ? 'Cadastrando...' : 'Cadastrar Arbitro'}
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {arbitros.map((a) => (
              <div key={a.id} className="bg-white rounded-xl shadow p-5 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
                <h3 className="font-semibold text-gray-800 dark:text-slate-100">{a.nome}</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">{a.email}</p>
                {a.oabNumero && <p className="text-sm text-gray-400 dark:text-slate-500">{a.oabNumero}</p>}
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
          </div>
        )}
      </div>
      </div>
    </AuthLayout>
  );
}
