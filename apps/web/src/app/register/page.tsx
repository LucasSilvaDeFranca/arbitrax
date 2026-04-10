'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: '',
    cpfCnpj: '',
    email: '',
    telefone: '',
    senha: '',
    role: 'USUARIO',
    oabNumero: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = { ...form };
      if (!data.oabNumero) delete (data as any).oabNumero;

      const result = await authApi.register(data);
      localStorage.setItem('accessToken', result.accessToken);
      localStorage.setItem('refreshToken', result.refreshToken);
      localStorage.setItem('user', JSON.stringify(result.user));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  return (
    <main className="flex min-h-screen items-center justify-center p-4 dark:bg-[#0f172a]">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
          <h1 className="text-2xl font-bold text-center text-primary-700 dark:text-white mb-6">Cadastro ArbitraX</h1>

          {error && (
            <div className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 p-3 rounded-lg mb-4 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nome completo</label>
              <input
                type="text"
                required
                minLength={3}
                value={form.nome}
                onChange={(e) => update('nome', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">CPF / CNPJ</label>
              <input
                type="text"
                required
                value={form.cpfCnpj}
                onChange={(e) => update('cpfCnpj', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">WhatsApp</label>
              <input
                type="tel"
                required
                value={form.telefone}
                onChange={(e) => update('telefone', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                placeholder="+5511999999999"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.senha}
                onChange={(e) => update('senha', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Voce e</label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`cursor-pointer border-2 rounded-lg p-3 text-center transition ${
                    form.role === 'USUARIO'
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 dark:border-primary-500'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="USUARIO"
                    checked={form.role === 'USUARIO'}
                    onChange={() => update('role', 'USUARIO')}
                    className="sr-only"
                  />
                  <div className="text-2xl mb-1">{'\u{1F464}'}</div>
                  <div className="text-sm font-medium text-gray-800 dark:text-slate-100">Pessoa Fisica / Empresa</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">Quero abrir casos ou responder convites</div>
                </label>
                <label
                  className={`cursor-pointer border-2 rounded-lg p-3 text-center transition ${
                    form.role === 'ADVOGADO'
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 dark:border-primary-500'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="ADVOGADO"
                    checked={form.role === 'ADVOGADO'}
                    onChange={() => update('role', 'ADVOGADO')}
                    className="sr-only"
                  />
                  <div className="text-2xl mb-1">{'\u{2696}\u{FE0F}'}</div>
                  <div className="text-sm font-medium text-gray-800 dark:text-slate-100">Advogado</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">Vou representar partes nos casos</div>
                </label>
              </div>
            </div>

            {form.role === 'ADVOGADO' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Numero OAB</label>
                <input
                  type="text"
                  value={form.oabNumero}
                  onChange={(e) => update('oabNumero', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                  placeholder="OAB/SP 123.456"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50"
            >
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-6">
            Ja tem conta?{' '}
            <Link href="/login" className="text-primary-600 dark:text-primary-400 hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
