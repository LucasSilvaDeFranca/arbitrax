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
  const [advogadoEmail, setAdvogadoEmail] = useState('');
  const [indicandoAdvogado, setIndicandoAdvogado] = useState(false);

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

  const handleIndicarAdvogado = async () => {
    const token = getToken();
    if (!token || !advogadoEmail.trim()) return;

    setIndicandoAdvogado(true);
    try {
      await arbitragensApi.indicarAdvogado(id, advogadoEmail.trim(), token);
      setAdvogadoEmail('');
      load();
    } catch (err: any) {
      alert(err.message || 'Erro ao indicar advogado');
    } finally {
      setIndicandoAdvogado(false);
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

        {/* Acoes contextuais por role e status */}
        {(() => {
          const user = getUser();
          const role = user?.role;
          const isAdmin = role === 'ADMIN';
          const isRequerido = role === 'REQUERIDO' && arb.requerido?.id === user?.id;
          const isRequerente = role === 'REQUERENTE' && arb.requerente?.id === user?.id;
          const isAdvogado = role === 'ADVOGADO';
          const isArbitro = role === 'ARBITRO';
          const status = arb.status as string;

          const actionCardBase = 'bg-white rounded-xl shadow p-5 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none mb-4 border-l-4';

          return (
            <div className="mb-6 space-y-0">
              {/* Admin: transicoes de estado */}
              {isAdmin && arb.allowedTransitions?.length > 0 && (
                <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none mb-4">
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

              {/* Requerido: aceitar ou recusar (existing) */}
              {isRequerido && status === 'AGUARDANDO_ACEITE' && (
                <div className={`${actionCardBase} border-blue-500`}>
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

              {/* Requerido: assinar compromisso */}
              {isRequerido && status === 'AGUARDANDO_ASSINATURA' && (
                <div className={`${actionCardBase} border-yellow-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-2">Assinar Compromisso Arbitral</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">O compromisso arbitral esta pronto para sua assinatura.</p>
                  <Link href={`/arbitragens/${id}/compromisso`} className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm">
                    Assinar Compromisso
                  </Link>
                </div>
              )}

              {/* Requerido: enviar contestacao */}
              {isRequerido && status === 'AGUARDANDO_CONTESTACAO' && (
                <div className={`${actionCardBase} border-yellow-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-2">Enviar Contestacao</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Voce tem prazo para enviar sua contestacao.</p>
                  <Link href={`/arbitragens/${id}/documentos`} className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm">
                    Enviar Contestacao
                  </Link>
                </div>
              )}

              {/* Requerido: indicar advogado */}
              {isRequerido && !arb.advRequerido && (
                <div className={`${actionCardBase} border-purple-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-2">Indicar Advogado</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
                    Voce pode indicar um advogado cadastrado na plataforma para representa-lo neste caso.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="Email do advogado"
                      value={advogadoEmail}
                      onChange={(e) => setAdvogadoEmail(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-600 bg-slate-700/50 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={handleIndicarAdvogado}
                      disabled={indicandoAdvogado || !advogadoEmail.trim()}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {indicandoAdvogado ? '...' : 'Indicar Advogado'}
                    </button>
                  </div>
                </div>
              )}

              {/* Requerido: advogado ja indicado */}
              {isRequerido && arb.advRequerido && (
                <div className={`${actionCardBase} border-purple-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-1">Seu Advogado</h3>
                  <p className="text-sm text-gray-700 dark:text-slate-300">
                    Dr. {arb.advRequerido.nome}
                  </p>
                </div>
              )}

              {/* Requerido: sentenca disponivel */}
              {isRequerido && (status === 'SENTENCA_RATIFICADA' || status === 'ENCERRADA') && (
                <div className={`${actionCardBase} border-green-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-2">Sentenca Disponivel</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">A sentenca deste caso esta disponivel para consulta.</p>
                  <div className="flex gap-2">
                    <Link href={`/arbitragens/${id}/sentenca`} className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm">
                      Ver Sentenca
                    </Link>
                  </div>
                </div>
              )}

              {/* Requerente: aguardando pagamento */}
              {isRequerente && status === 'AGUARDANDO_PAGAMENTO_REGISTRO' && (
                <div className={`${actionCardBase} border-blue-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-2">Aguardando Pagamento do Registro</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400">O pagamento da taxa de registro e necessario para prosseguir com a arbitragem.</p>
                </div>
              )}

              {/* Requerente: enviar peticao inicial */}
              {isRequerente && (status === 'EM_INSTRUCAO' || status === 'AGUARDANDO_PETICAO') && (
                <div className={`${actionCardBase} border-indigo-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-2">Enviar Peticao Inicial</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Protocole sua peticao inicial para dar andamento ao caso.</p>
                  <Link href={`/arbitragens/${id}/documentos`} className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm">
                    Ir para Documentos
                  </Link>
                </div>
              )}

              {/* Requerente: enviar provas adicionais */}
              {isRequerente && status === 'AGUARDANDO_PROVAS_ADICIONAIS' && (
                <div className={`${actionCardBase} border-yellow-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-2">Enviar Provas Adicionais</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">O arbitro solicitou provas adicionais para este caso.</p>
                  <Link href={`/arbitragens/${id}/documentos`} className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm">
                    Enviar Provas
                  </Link>
                </div>
              )}

              {/* Requerente: alerta - parte contraria constituiu advogado */}
              {isRequerente && arb.advRequerido && !arb.advRequerente && (
                <div className={`${actionCardBase} border-orange-500`}>
                  <h3 className="font-semibold text-orange-700 dark:text-orange-300 mb-2">Parte contraria constituiu advogado</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
                    A parte contraria constituiu advogado. Deseja indicar um advogado para representa-lo?
                  </p>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="email"
                      placeholder="Email do advogado"
                      value={advogadoEmail}
                      onChange={(e) => setAdvogadoEmail(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-600 bg-slate-700/50 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button
                      onClick={handleIndicarAdvogado}
                      disabled={indicandoAdvogado || !advogadoEmail.trim()}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {indicandoAdvogado ? '...' : 'Indicar Meu Advogado'}
                    </button>
                  </div>
                  <button className="px-4 py-2 bg-slate-600/50 text-slate-300 rounded-lg hover:bg-slate-600 transition text-sm">
                    Prosseguir sem advogado
                  </button>
                </div>
              )}

              {/* Requerente: advogado ja indicado */}
              {isRequerente && arb.advRequerente && (
                <div className={`${actionCardBase} border-purple-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-1">Seu Advogado</h3>
                  <p className="text-sm text-gray-700 dark:text-slate-300">
                    Dr. {arb.advRequerente.nome}
                  </p>
                </div>
              )}

              {/* Requerente: sentenca disponivel */}
              {isRequerente && (status === 'SENTENCA_RATIFICADA' || status === 'ENCERRADA') && (
                <div className={`${actionCardBase} border-green-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-2">Sentenca Disponivel</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">A sentenca deste caso esta disponivel para consulta e download.</p>
                  <div className="flex gap-2">
                    <Link href={`/arbitragens/${id}/sentenca`} className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm">
                      Ver Sentenca
                    </Link>
                  </div>
                </div>
              )}

              {/* Advogado: info de representacao */}
              {isAdvogado && (
                <div className={`${actionCardBase} border-purple-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-1">Representacao</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Voce representa: <span className="font-medium text-gray-700 dark:text-slate-200">{arb.requerente?.nome || arb.requerido?.nome || 'Cliente'}</span>
                  </p>
                </div>
              )}

              {/* Advogado: protocolar em nome do cliente */}
              {isAdvogado && (status === 'EM_INSTRUCAO' || status === 'AGUARDANDO_PETICAO' || status === 'AGUARDANDO_CONTESTACAO') && (
                <div className={`${actionCardBase} border-indigo-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-2">Protocolar em Nome do Cliente</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Submeta documentos e pecas processuais representando seu cliente.</p>
                  <Link href={`/arbitragens/${id}/documentos`} className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm">
                    Ir para Documentos
                  </Link>
                </div>
              )}

              {/* Arbitro: sentenca aguardando revisao */}
              {isArbitro && (status === 'SENTENCA_EM_REVISAO' || status === 'GERANDO_SENTENCA') && (
                <div className={`${actionCardBase} border-yellow-500`}>
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Sentenca Aguardando sua Revisao</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Ha uma sentenca pendente de revisao neste caso.</p>
                  <Link href={`/arbitragens/${id}/sentenca`} className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm">
                    Revisar Sentenca
                  </Link>
                </div>
              )}

              {/* Arbitro: ratificar sentenca */}
              {isArbitro && status === 'SENTENCA_APROVADA' && (
                <div className={`${actionCardBase} border-green-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-2">Ratificar Sentenca</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">A sentenca foi aprovada e esta pronta para ratificacao.</p>
                  <Link href={`/arbitragens/${id}/sentenca`} className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm">
                    Ratificar Sentenca
                  </Link>
                </div>
              )}

              {/* Arbitro: declarar impedimento (always visible) */}
              {isArbitro && (
                <div className={`${actionCardBase} border-red-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-1">Impedimento</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Caso identifique conflito de interesse ou impedimento, declare aqui.</p>
                  <button className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition text-sm font-medium">
                    Declarar Impedimento
                  </button>
                </div>
              )}
            </div>
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
