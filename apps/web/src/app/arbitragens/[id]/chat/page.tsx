'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { chatApi, ChatMessage, CanalChat } from '@/lib/chat';
import AuthLayout from '@/components/AuthLayout';

/**
 * Dois canais por arbitragem:
 *
 * - 'processo' (Chat 1): grupo publico - requerente, requerido, advogados, arbitros.
 *   SEM IA. Usado para comunicacao normal do caso.
 *
 * - 'sentenca' (Chat 2): grupo privado - apenas arbitros + IA.
 *   INVISIVEL para as partes e advogados. Usado pelo arbitro para conversar com a
 *   IA durante a construcao da sentenca. Arbitro pode encaminhar mensagens da IA
 *   como "pergunta oficial" para o Chat 1.
 */

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const bottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeCanal, setActiveCanal] = useState<CanalChat>('processo');
  const [forwardingMsgId, setForwardingMsgId] = useState<string | null>(null);
  const [forwardText, setForwardText] = useState('');
  const [forwarding, setForwarding] = useState(false);

  const token = getToken();
  const user = getUser();
  const isArbitroOrAdmin = user?.role === 'ARBITRO' || user?.role === 'ADMIN';

  const loadMessages = async (canal: CanalChat = activeCanal) => {
    if (!token) {
      router.push('/login');
      return;
    }
    try {
      const msgs = await chatApi.getMessages(id, token, canal);
      setMessages(msgs);
    } catch (err: any) {
      // 403 no canal sentenca e esperado pra nao-arbitros
      if (err.message?.includes('privado') || err.message?.includes('arbitros')) {
        setMessages([]);
      } else {
        console.error('Erro ao carregar mensagens:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadMessages(activeCanal);
    // Polling a cada 20s (antes era 10s). Reduz carga no backend em 50%.
    const interval = setInterval(() => loadMessages(activeCanal), 20000);
    return () => clearInterval(interval);
  }, [id, activeCanal]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // No Chat 1 (processo): envia mensagem normal para o grupo
  // No Chat 2 (sentenca): envia pergunta para IA
  const handleSend = async () => {
    if (!token || !newMsg.trim()) return;
    setSending(true);
    try {
      if (activeCanal === 'sentenca') {
        await chatApi.askIa(id, newMsg.trim(), token);
      } else {
        await chatApi.send(id, { conteudo: newMsg.trim(), canal: 'processo' }, token);
      }
      setNewMsg('');
      await loadMessages(activeCanal);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const switchCanal = (canal: CanalChat) => {
    if (canal === activeCanal) return;
    setActiveCanal(canal);
    setMessages([]);
    setForwardingMsgId(null);
  };

  const openForwardModal = (msg: ChatMessage) => {
    setForwardingMsgId(msg.id);
    setForwardText(msg.conteudo || '');
  };

  const closeForwardModal = () => {
    setForwardingMsgId(null);
    setForwardText('');
  };

  const confirmForward = async () => {
    if (!token || !forwardingMsgId || !forwardText.trim()) return;
    setForwarding(true);
    try {
      await chatApi.encaminhar(
        id,
        { messageId: forwardingMsgId, textoEditado: forwardText.trim() },
        token,
      );
      closeForwardModal();
      alert('Pergunta encaminhada ao Chat do Processo. As partes serao notificadas.');
    } catch (err: any) {
      alert(err.message || 'Erro ao encaminhar');
    } finally {
      setForwarding(false);
    }
  };

  // Labels por canal
  const inputPlaceholder =
    activeCanal === 'sentenca'
      ? 'Converse com a IA sobre a sentenca...'
      : 'Escreva uma mensagem para o grupo...';

  const sendButtonLabel =
    activeCanal === 'sentenca'
      ? sending
        ? 'Analisando...'
        : 'Perguntar a IA'
      : sending
      ? 'Enviando...'
      : 'Enviar';

  const emptyStateMsg =
    activeCanal === 'sentenca'
      ? 'Nenhuma mensagem no chat de sentenca. Converse com a IA para construir a sentenca.'
      : 'Nenhuma mensagem no chat do processo. Seja o primeiro a escrever.';

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-gray-500 dark:text-slate-400">Carregando...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="flex flex-col h-[calc(100vh-0px)]">
        {/* Header */}
        <div className="bg-white border-b dark:bg-slate-800/50 dark:border-slate-700">
          <div className="px-6 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link
                href={`/arbitragens/${id}`}
                className="text-primary-600 dark:text-primary-400 hover:underline text-sm"
              >
                &larr;
              </Link>
              <h1 className="font-semibold text-gray-800 dark:text-slate-100">Chat do Caso</h1>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0 border-t dark:border-slate-700">
            <button
              onClick={() => switchCanal('processo')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeCanal === 'processo'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400 bg-primary-50/50 dark:bg-primary-900/20'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              Chat do Processo
            </button>
            {isArbitroOrAdmin && (
              <button
                onClick={() => switchCanal('sentenca')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeCanal === 'sentenca'
                    ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span>{'\u{1F512}'}</span>
                Chat de Sentenca (IA)
              </button>
            )}
          </div>

          {/* Contexto do canal */}
          {activeCanal === 'sentenca' && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800/50 px-6 py-2">
              <p className="text-xs text-indigo-700 dark:text-indigo-300">
                🔒 Canal privado - apenas arbitros e IA. As partes nao tem acesso.
                Use o botao "Encaminhar" em mensagens da IA para enviar perguntas oficiais ao Chat do Processo.
              </p>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-slate-900/50">
          {messages.length === 0 && (
            <p className="text-center text-gray-400 dark:text-slate-500 py-8">{emptyStateMsg}</p>
          )}

          {messages.map((msg) => {
            const isMe = msg.user?.id === user?.id;
            const isSystem = msg.tipo === 'system';
            const isIa = msg.tipo === 'ia';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="max-w-[85%] text-center">
                    <div className="inline-block px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg text-sm text-amber-800 dark:text-amber-200 whitespace-pre-wrap">
                      {msg.conteudo}
                    </div>
                    <p className="text-xs mt-1 text-gray-400 dark:text-slate-500">
                      {new Date(msg.createdAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            }

            if (isIa) {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[85%] rounded-xl px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700/50">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{'\u{1F916}'}</span>
                        <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          ArbitraX IA
                        </p>
                      </div>
                      {/* Botao Encaminhar - so no Chat 2 e so pra arbitros */}
                      {activeCanal === 'sentenca' && isArbitroOrAdmin && (
                        <button
                          onClick={() => openForwardModal(msg)}
                          className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition whitespace-nowrap"
                          title="Encaminhar como pergunta oficial ao Chat do Processo"
                        >
                          ↗ Encaminhar
                        </button>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-slate-200">
                      {msg.conteudo}
                    </p>
                    <p className="text-xs mt-2 text-indigo-400 dark:text-indigo-500">
                      {new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-xl px-4 py-2 ${
                    isMe
                      ? 'bg-primary-600 text-white'
                      : 'bg-white shadow dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none'
                  }`}
                >
                  {!isMe && (
                    <p
                      className={`text-xs font-medium mb-1 ${
                        isMe ? 'text-primary-200' : 'text-primary-600 dark:text-primary-400'
                      }`}
                    >
                      {msg.user?.nome || 'Usuario'} ({msg.user?.role || ''})
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.conteudo}</p>
                  <p
                    className={`text-xs mt-1 ${
                      isMe ? 'text-primary-200' : 'text-gray-400 dark:text-slate-500'
                    }`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })}

          {/* IA typing indicator */}
          {sending && activeCanal === 'sentenca' && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-xl px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{'\u{1F916}'}</span>
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">ArbitraX IA</p>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                  <span className="ml-2 text-xs text-indigo-500 dark:text-indigo-400">Analisando...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t p-4 dark:bg-slate-800/50 dark:border-slate-700">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <textarea
              rows={1}
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={inputPlaceholder}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <button
              onClick={handleSend}
              disabled={sending || !newMsg.trim()}
              className={`px-6 py-2 text-white rounded-xl transition disabled:opacity-50 text-sm font-medium whitespace-nowrap flex items-center gap-2 ${
                activeCanal === 'sentenca'
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {activeCanal === 'sentenca' && <span>{'\u{1F916}'}</span>}
              {sendButtonLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Modal: encaminhar mensagem */}
      {forwardingMsgId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-2">
              Encaminhar como pergunta oficial
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              Esta pergunta sera postada no Chat do Processo como pergunta oficial do arbitro.
              As partes (requerente, requerido, advogados) poderao ver e responder. Voce pode editar o texto antes de enviar.
            </p>
            <textarea
              rows={8}
              value={forwardText}
              onChange={(e) => setForwardText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={closeForwardModal}
                disabled={forwarding}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={confirmForward}
                disabled={forwarding || !forwardText.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm font-medium"
              >
                {forwarding ? 'Encaminhando...' : 'Encaminhar ao Chat do Processo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
