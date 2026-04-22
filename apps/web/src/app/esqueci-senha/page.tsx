'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar solicitacao');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4 dark:bg-[#0f172a]">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
          <h1 className="text-2xl font-bold text-center text-primary-700 dark:text-white mb-2">Recuperar senha</h1>
          <p className="text-center text-sm text-gray-500 dark:text-slate-400 mb-6">
            Informe o email cadastrado e enviaremos um link para redefinir sua senha.
          </p>

          {sent ? (
            <div className="space-y-4">
              <div className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 p-4 rounded-lg text-sm border border-green-200 dark:border-green-800">
                <p className="font-medium mb-1">Solicitacao recebida!</p>
                <p>
                  Se o email <strong>{email}</strong> estiver cadastrado, voce recebera um link em instantes.
                  Verifique tambem a caixa de <strong>spam</strong> ou <strong>promocoes</strong>.
                </p>
                <p className="mt-2 text-xs">O link expira em <strong>10 minutos</strong>.</p>
              </div>

              <Link
                href="/login"
                className="block text-center w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
              >
                Voltar para o login
              </Link>

              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="block text-center w-full text-sm text-gray-500 dark:text-slate-400 hover:underline"
              >
                Enviar para outro email
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 p-3 rounded-lg mb-4 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                    placeholder="seu@email.com"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Enviar link de recuperacao'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-6">
                Lembrou a senha?{' '}
                <Link href="/login" className="text-primary-600 dark:text-primary-400 hover:underline">
                  Voltar ao login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
