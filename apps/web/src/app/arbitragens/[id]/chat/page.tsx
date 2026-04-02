'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { chatApi, ChatMessage } from '@/lib/chat';
import AuthLayout from '@/components/AuthLayout';

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const bottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const token = getToken();
  const user = getUser();

  const loadMessages = async () => {
    if (!token) { router.push('/login'); return; }
    try {
      const msgs = await chatApi.getMessages(id, token);
      setMessages(msgs);
    } catch {
      router.push('/arbitragens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    // Poll a cada 10s
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!token || !newMsg.trim()) return;
    setSending(true);
    try {
      await chatApi.send(id, { conteudo: newMsg.trim() }, token);
      setNewMsg('');
      await loadMessages();
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

  if (loading) {
    return <AuthLayout><div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-500 dark:text-slate-400">Carregando...</p></div></AuthLayout>;
  }

  return (
    <AuthLayout>
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3 flex justify-between items-center dark:bg-slate-800/50 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <Link href={`/arbitragens/${id}`} className="text-primary-600 dark:text-primary-400 hover:underline text-sm">
            &larr;
          </Link>
          <h1 className="font-semibold text-gray-800 dark:text-slate-100">Chat do Caso</h1>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-slate-900/50">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 dark:text-slate-500 py-8">Nenhuma mensagem. Inicie a conversa.</p>
        )}
        {messages.map((msg) => {
          const isMe = msg.user.id === user?.id;
          const isSystem = msg.tipo === 'system';

          if (isSystem) {
            return (
              <div key={msg.id} className="text-center">
                <span className="text-xs text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 dark:text-slate-200 px-3 py-1 rounded-full">
                  {msg.conteudo}
                </span>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-xl px-4 py-2 ${
                isMe ? 'bg-primary-600 text-white' : 'bg-white shadow dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none'
              }`}>
                {!isMe && (
                  <p className={`text-xs font-medium mb-1 ${isMe ? 'text-primary-200' : 'text-primary-600'}`}>
                    {msg.user.nome} ({msg.user.role})
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
            placeholder="Digite sua mensagem..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
          />
          <button
            onClick={handleSend}
            disabled={sending || !newMsg.trim()}
            className="px-6 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
    </AuthLayout>
  );
}
