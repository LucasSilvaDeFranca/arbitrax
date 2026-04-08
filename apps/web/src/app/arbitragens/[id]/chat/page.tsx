'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { chatApi, ChatMessage } from '@/lib/chat';
import AuthLayout from '@/components/AuthLayout';

type Canal = 'privado' | 'arbitragem';

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const bottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [askingIa, setAskingIa] = useState(false);
  const [activeCanal, setActiveCanal] = useState<Canal>('privado');

  const token = getToken();
  const user = getUser();
  const isArbitroOrAdmin = user?.role === 'ARBITRO' || user?.role === 'ADMIN';

  const loadMessages = async () => {
    if (!token) { router.push('/login'); return; }
    try {
      const msgs = await chatApi.getMessages(id, token, activeCanal);
      setMessages(msgs);
    } catch {
      router.push('/arbitragens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [id, activeCanal]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAskIa = async () => {
    if (!token || !newMsg.trim()) return;
    setAskingIa(true);
    try {
      await chatApi.askIa(id, newMsg.trim(), activeCanal, token);
      setNewMsg('');
      await loadMessages();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAskingIa(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskIa();
    }
  };

  const switchCanal = (canal: Canal) => {
    if (canal === activeCanal) return;
    setActiveCanal(canal);
    setMessages([]);
  };

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
              <Link href={`/arbitragens/${id}`} className="text-primary-600 dark:text-primary-400 hover:underline text-sm">
                &larr;
              </Link>
              <h1 className="font-semibold text-gray-800 dark:text-slate-100">Chat do Caso</h1>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0 border-t dark:border-slate-700">
            <button
              onClick={() => switchCanal('privado')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeCanal === 'privado'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400 bg-primary-50/50 dark:bg-primary-900/20'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              Chat com IA
            </button>
            {isArbitroOrAdmin && (
              <button
                onClick={() => switchCanal('arbitragem')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeCanal === 'arbitragem'
                    ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                }`}
              >
                Analise Juridica
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-slate-900/50">
          {messages.length === 0 && (
            <p className="text-center text-gray-400 dark:text-slate-500 py-8">
              Nenhuma mensagem{activeCanal === 'arbitragem' ? ' na analise juridica' : ''}. Inicie a conversa com a IA.
            </p>
          )}

          {messages.map((msg) => {
            const isMe = msg.user?.id === user?.id;
            const isSystem = msg.tipo === 'system';
            const isIa = msg.tipo === 'ia';

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center">
                  <span className="text-xs text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 dark:text-slate-200 px-3 py-1 rounded-full">
                    {msg.conteudo}
                  </span>
                </div>
              );
            }

            if (isIa) {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[80%] rounded-xl px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{'\u{1F916}'}</span>
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        ArbitraX IA
                      </p>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-slate-200">{msg.conteudo}</p>
                    <p className="text-xs mt-1 text-indigo-400 dark:text-indigo-500">
                      {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-xl px-4 py-2 ${
                  isMe
                    ? 'bg-primary-600 text-white'
                    : 'bg-white shadow dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none'
                }`}>
                  {!isMe && (
                    <p className={`text-xs font-medium mb-1 ${isMe ? 'text-primary-200' : 'text-primary-600 dark:text-primary-400'}`}>
                      {msg.user?.nome || 'Usuario'} ({msg.user?.role || ''})
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.conteudo}</p>
                  <p className={`text-xs mt-1 ${isMe ? 'text-primary-200' : 'text-gray-400 dark:text-slate-500'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}

          {/* IA typing indicator */}
          {askingIa && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-xl px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{'\u{1F916}'}</span>
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">ArbitraX IA</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
              placeholder={
                activeCanal === 'arbitragem'
                  ? 'Pergunte a IA sobre analise juridica...'
                  : 'Pergunte algo a IA sobre o caso...'
              }
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <button
              onClick={handleAskIa}
              disabled={askingIa || !newMsg.trim()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 text-sm font-medium whitespace-nowrap flex items-center gap-2"
            >
              <span>{'\u{1F916}'}</span>
              {askingIa ? 'Analisando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
