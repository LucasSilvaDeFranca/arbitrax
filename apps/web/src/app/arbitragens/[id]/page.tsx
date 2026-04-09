'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { arbitragensApi } from '@/lib/arbitragens';
import { downloadAuthenticatedFile } from '@/lib/api';
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

        {/* Acoes contextuais por papel processual e status */}
        {(() => {
          const user = getUser();
          const role = user?.role;
          const isAdmin = role === 'ADMIN';
          // Papel processual e por CASO (nao pelo role do user)
          const isRequerente = arb.requerente?.id === user?.id;
          const isRequerido = arb.requerido?.id === user?.id;
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

              {/* Requerente ou Requerido: assinar compromisso */}
              {(isRequerente || isRequerido) && status === 'AGUARDANDO_ASSINATURA' && (
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

              {/* Requerente: aguardando aceite do requerido */}
              {isRequerente && status === 'AGUARDANDO_ACEITE' && (
                <div className={`${actionCardBase} border-blue-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-2">Aguardando Aceite do Requerido</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Um convite foi enviado para {arb.requerido?.nome}. O requerido tem 5 dias uteis para aceitar ou recusar. Voce sera notificado quando houver resposta.
                  </p>
                </div>
              )}

              {/* Requerente: aguardando defesa do requerido (fluxo novo) */}
              {isRequerente && (status === 'AGUARDANDO_CONTESTACAO' || status === 'EM_INSTRUCAO') && (
                <div className={`${actionCardBase} border-indigo-500`}>
                  <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-2">Aguardando Defesa</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    O requerido tem 15 dias para apresentar a contestacao. Voce sera notificado quando ela for protocolada.
                  </p>
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

              {/* Arbitro: card unificado com 3 botoes durante a fase ativa de analise/sentenca.
                  Visivel de ANALISE_PROVAS ate SENTENCA_APROVADA. */}
              {isArbitro && (
                status === 'ANALISE_PROVAS' ||
                status === 'AGUARDANDO_PROVAS_ADICIONAIS' ||
                status === 'GERANDO_SENTENCA' ||
                status === 'SENTENCA_EM_REVISAO' ||
                status === 'SENTENCA_APROVADA'
              ) && (() => {
                // Label dinamico do botao de sentenca conforme o status
                let sentencaLabel = 'Gerar Sentenca com IA';
                let sentencaColor = 'bg-purple-600 hover:bg-purple-700';
                if (status === 'SENTENCA_EM_REVISAO' || status === 'GERANDO_SENTENCA') {
                  sentencaLabel = 'Revisar Sentenca';
                  sentencaColor = 'bg-yellow-600 hover:bg-yellow-700';
                } else if (status === 'SENTENCA_APROVADA') {
                  sentencaLabel = 'Ratificar e Assinar';
                  sentencaColor = 'bg-green-600 hover:bg-green-700';
                }

                // Descricao contextual
                let descricao = 'A contestacao foi protocolada. Use o chat com a IA para construir a minuta e o chat das partes para perguntas oficiais.';
                if (status === 'AGUARDANDO_PROVAS_ADICIONAIS') {
                  descricao = 'Aguardando provas adicionais das partes. Quando chegarem, retome a analise.';
                } else if (status === 'GERANDO_SENTENCA' || status === 'SENTENCA_EM_REVISAO') {
                  descricao = 'Uma minuta de sentenca existe. Revise o texto, ajuste se necessario, e aprove.';
                } else if (status === 'SENTENCA_APROVADA') {
                  descricao = 'A sentenca foi aprovada. Proximo passo: ratificar com assinatura digital A1.';
                }

                return (
                  <div className={`${actionCardBase} border-indigo-500`}>
                    <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-2">Acoes do Arbitro</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">{descricao}</p>
                    <div className="flex gap-2 flex-wrap">
                      <Link
                        href={`/arbitragens/${id}/chat?canal=processo`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium"
                        title="Chat publico com requerente, requerido e advogados"
                      >
                        <span>{'\u{1F4AC}'}</span>
                        Chat das Partes
                      </Link>
                      <Link
                        href={`/arbitragens/${id}/chat?canal=sentenca`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
                        title="Chat privado com a IA para construir a sentenca"
                      >
                        <span>{'\u{1F916}'}</span>
                        Chat com IA
                      </Link>
                      <Link
                        href={`/arbitragens/${id}/sentenca`}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg transition text-sm font-medium ${sentencaColor}`}
                        title={sentencaLabel}
                      >
                        <span>{'\u{1F4DC}'}</span>
                        {sentencaLabel}
                      </Link>
                    </div>
                  </div>
                );
              })()}

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
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Prazos</h3>
              {arb.compromisso?.id && (
                <button
                  onClick={async () => {
                    const tok = getToken();
                    if (!tok) return;
                    try {
                      await downloadAuthenticatedFile(
                        `/api/v1/arbitragens/${id}/compromisso/pdf`,
                        tok,
                        `compromisso-${arb.numero}.pdf`,
                      );
                    } catch (err: any) {
                      alert(err.message || 'Erro ao baixar termo');
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-xs font-medium"
                  title="Baixar Termo de Compromisso Arbitral"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Baixar Termo de Compromisso
                </button>
              )}
            </div>
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
