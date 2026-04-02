'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { notificacoesApi, Notificacao } from '@/lib/notificacoes';
import AuthLayout from '@/components/AuthLayout';

const TIPO_ICON: Record<string, string> = {
  prazo: '⏰',
  sentenca: '⚖',
  pagamento: '💰',
  sistema: '🔔',
};

export default function NotificacoesPage() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [loading, setLoading] = useState(true);

  const token = getToken();

  const load = async () => {
    if (!token) { router.push('/login'); return; }
    try {
      const res = await notificacoesApi.list(token);
      setNotifs(res.data);
      setNaoLidas(res.naoLidas);
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleMarcarLida = async (id: string) => {
    if (!token) return;
    await notificacoesApi.marcarLida(id, token);
    await load();
  };

  const handleMarcarTodas = async () => {
    if (!token) return;
    await notificacoesApi.marcarTodasLidas(token);
    await load();
  };

  if (loading) {
    return <AuthLayout><div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-500 dark:text-slate-400">Carregando...</p></div></AuthLayout>;
  }

  return (
    <AuthLayout>
      <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-primary-700 dark:text-white">Notificacoes</h1>
            {naoLidas > 0 && (
              <p className="text-sm text-gray-500 dark:text-slate-400">{naoLidas} nao lida(s)</p>
            )}
          </div>
          {naoLidas > 0 && (
            <button
              onClick={handleMarcarTodas}
              className="px-4 py-2 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>

        {notifs.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
            <p className="text-gray-500 dark:text-slate-400">Nenhuma notificacao.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifs.map((n) => (
              <div
                key={n.id}
                className={`bg-white rounded-xl shadow p-4 flex items-start gap-3 transition dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none ${
                  !n.lida ? 'border-l-4 border-primary-500' : 'opacity-70'
                }`}
              >
                <span className="text-xl mt-0.5">{TIPO_ICON[n.tipo] || '🔔'}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className={`font-medium text-sm ${!n.lida ? 'text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}`}>
                      {n.titulo}
                    </h3>
                    <span className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap ml-2">
                      {new Date(n.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">{n.mensagem}</p>
                  <div className="flex gap-3 mt-2">
                    {n.link && (
                      <Link href={n.link} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
                        Ver caso
                      </Link>
                    )}
                    {!n.lida && (
                      <button
                        onClick={() => handleMarcarLida(n.id)}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
                      >
                        Marcar como lida
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </AuthLayout>
  );
}
