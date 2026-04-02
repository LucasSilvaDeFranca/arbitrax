'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { arbitragensApi } from '@/lib/arbitragens';
import AuthLayout from '@/components/AuthLayout';

const STATUS_COLORS: Record<string, string> = {
  AGUARDANDO_PAGAMENTO_REGISTRO: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  AGUARDANDO_ACEITE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  EM_INSTRUCAO: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  ANALISE_PROVAS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  GERANDO_SENTENCA: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  SENTENCA_APROVADA: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  ENCERRADA: 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200',
  RECUSADA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  CANCELADA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default function ArbitragemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [arb, setArb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  const load = () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }

    arbitragensApi.getById(id, token)
      .then(setArb)
      .catch(() => router.push('/arbitragens'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleTransition = async (newStatus: string) => {
    const token = getToken();
    if (!token) return;

    setTransitioning(true);
    try {
      const updated = await arbitragensApi.updateStatus(id, newStatus, token);
      setArb(updated);
    } catch (err: any) {
      alert(err.message || 'Erro na transicao');
    } finally {
      setTransitioning(false);
    }
  };

  if (loading) {
    return <AuthLayout><div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-500 dark:text-slate-400">Carregando...</p></div></AuthLayout>;
  }

  if (!arb) return null;

  return (
    <AuthLayout>
      <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/arbitragens" className="text-primary-600 dark:text-primary-400 hover:underline text-sm mb-4 block">
          &larr; Voltar para lista
        </Link>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-primary-700 dark:text-white">{arb.numero}</h1>
            <p className="text-gray-500 dark:text-slate-400">
              Criado em {new Date(arb.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[arb.status] || 'bg-gray-100 dark:bg-slate-700 dark:text-slate-200'}`}>
            {formatStatus(arb.status)}
          </span>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-3">Partes</h3>
            <div className="space-y-2">
              <div>
                <span className="text-xs text-gray-400 dark:text-slate-500">Requerente</span>
                <p className="font-medium">{arb.requerente?.nome}</p>
              </div>
              <div>
                <span className="text-xs text-gray-400 dark:text-slate-500">Requerido</span>
                <p className="font-medium">{arb.requerido?.nome}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-3">Detalhes</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-slate-400">Valor</span>
                <span className="font-medium">R$ {Number(arb.valorCausa).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-slate-400">Categoria</span>
                <span className="font-medium">{arb.categoria}</span>
              </div>
              {arb.urgencia && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Urgencia</span>
                  <span className="font-medium text-orange-600">Sim</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Objeto */}
        <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none mb-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">Objeto da Arbitragem</h3>
          <p className="text-gray-800 dark:text-slate-100">{arb.objeto}</p>
        </div>

        {/* Links rapidos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Link
            href={`/arbitragens/${id}/documentos`}
            className="bg-white rounded-xl shadow p-5 hover:bg-gray-50 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none dark:hover:bg-slate-700/50 transition flex justify-between items-center"
          >
            <div>
              <h3 className="font-medium text-gray-800 dark:text-slate-100">Documentos</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {arb.pecas?.length || 0} pecas, {arb.provas?.length || 0} provas
              </p>
            </div>
            <span className="text-primary-600 dark:text-primary-400">&rarr;</span>
          </Link>
          <Link
            href={`/arbitragens/${id}/sentenca`}
            className="bg-white rounded-xl shadow p-5 hover:bg-gray-50 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none dark:hover:bg-slate-700/50 transition flex justify-between items-center"
          >
            <div>
              <h3 className="font-medium text-gray-800 dark:text-slate-100">Sentenca</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {arb.sentencas?.length ? `v${arb.sentencas[0].versao} - ${arb.sentencas[0].status}` : 'Nenhuma'}
              </p>
            </div>
            <span className="text-primary-600 dark:text-primary-400">&rarr;</span>
          </Link>
          <Link
            href={`/arbitragens/${id}/chat`}
            className="bg-white rounded-xl shadow p-5 hover:bg-gray-50 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none dark:hover:bg-slate-700/50 transition flex justify-between items-center"
          >
            <div>
              <h3 className="font-medium text-gray-800 dark:text-slate-100">Chat</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">Comunicacao do caso</p>
            </div>
            <span className="text-primary-600 dark:text-primary-400">&rarr;</span>
          </Link>
        </div>

        {/* Acoes por role */}
        {(() => {
          const user = getUser();
          const isAdmin = user?.role === 'ADMIN';
          const isRequerido = user?.role === 'REQUERIDO' && arb.requerido?.id === user?.id;

          return (
            <>
              {/* Admin: transicoes de estado */}
              {isAdmin && arb.allowedTransitions?.length > 0 && (
                <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none mb-6">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-3">Acoes Admin</h3>
                  <div className="flex flex-wrap gap-2">
                    {arb.allowedTransitions.map((t: string) => (
                      <button
                        key={t}
                        onClick={() => handleTransition(t)}
                        disabled={transitioning}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                          t === 'CANCELADA'
                            ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
                            : 'bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/40'
                        }`}
                      >
                        {formatStatus(t)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Requerido: aceitar ou recusar */}
              {isRequerido && arb.status === 'AGUARDANDO_ACEITE' && (
                <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none mb-6 border-t-4 border-blue-500">
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-3">Convite de Arbitragem</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Voce foi convidado para participar desta arbitragem.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleTransition('AGUARDANDO_ASSINATURA')}
                      disabled={transitioning}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                    >
                      Aceitar
                    </button>
                    <button
                      onClick={() => handleTransition('RECUSADA')}
                      disabled={transitioning}
                      className="px-6 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition disabled:opacity-50"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* Pecas */}
        {arb.pecas?.length > 0 && (
          <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none mb-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-3">Pecas Processuais</h3>
            <div className="space-y-2">
              {arb.pecas.map((p: any) => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800/30 rounded-lg">
                  <span className="font-medium text-sm">{formatStatus(p.tipo)}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(p.protocoladaAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prazos */}
        {arb.prazos?.length > 0 && (
          <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none mb-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-3">Prazos</h3>
            <div className="space-y-2">
              {arb.prazos.map((p: any) => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800/30 rounded-lg">
                  <span className="font-medium text-sm">{formatStatus(p.tipo)}</span>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      p.status === 'ATIVO' ? 'bg-green-100 text-green-700' :
                      p.status === 'EXPIRADO' ? 'bg-red-100 text-red-700' : 'bg-gray-100'
                    }`}>
                      {p.status}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Vence: {new Date(p.fim).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
    </AuthLayout>
  );
}
