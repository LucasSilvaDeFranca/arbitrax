'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';

/** Icone olho aberto (senha visivel) */
function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

/** Icone olho riscado (senha oculta) */
function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
      <line x1="2" x2="22" y1="2" y2="22"/>
    </svg>
  );
}

/** Input de senha com olhinho. Cada instancia tem seu proprio estado de visibilidade. */
function PasswordInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  id: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required
        minLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 pr-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        tabIndex={-1}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function RecuperarSenhaInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Validacao do link na entrada
  const linkInvalido = !token || !email;

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => {
        router.push('/login?reset=ok');
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [done, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (novaSenha.length < 6) {
      setError('A senha deve ter no minimo 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmaSenha) {
      setError('As senhas nao conferem.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, novaSenha);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  };

  if (linkInvalido) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4 dark:bg-[#0f172a]">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg p-8 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
            <h1 className="text-2xl font-bold text-center text-red-600 dark:text-red-400 mb-4">Link invalido</h1>
            <p className="text-center text-sm text-gray-500 dark:text-slate-400 mb-6">
              O link de recuperacao esta incompleto ou expirado. Solicite um novo.
            </p>
            <Link
              href="/esqueci-senha"
              className="block text-center w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
            >
              Solicitar novo link
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 dark:bg-[#0f172a]">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
          <h1 className="text-2xl font-bold text-center text-primary-700 dark:text-white mb-2">Redefinir senha</h1>
          <p className="text-center text-sm text-gray-500 dark:text-slate-400 mb-6">
            Escolha uma nova senha para sua conta.
          </p>

          {done ? (
            <div className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 p-4 rounded-lg text-sm border border-green-200 dark:border-green-800 text-center">
              <p className="font-medium mb-1">Senha alterada com sucesso!</p>
              <p>Redirecionando para o login...</p>
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
                    value={email}
                    readOnly
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-400"
                  />
                </div>

                <div>
                  <label htmlFor="nova-senha" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Nova senha
                  </label>
                  <PasswordInput
                    id="nova-senha"
                    value={novaSenha}
                    onChange={setNovaSenha}
                    placeholder="Minimo 6 caracteres"
                  />
                </div>

                <div>
                  <label htmlFor="confirma-senha" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Confirmar nova senha
                  </label>
                  <PasswordInput
                    id="confirma-senha"
                    value={confirmaSenha}
                    onChange={setConfirmaSenha}
                    placeholder="Digite novamente"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50"
                >
                  {loading ? 'Redefinindo...' : 'Redefinir senha'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-6">
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

export default function RecuperarSenhaPage() {
  return (
    <Suspense fallback={null}>
      <RecuperarSenhaInner />
    </Suspense>
  );
}
