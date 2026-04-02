'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getToken, getUser } from '@/lib/auth';
import { api } from '@/lib/api';
import AuthLayout from '@/components/AuthLayout';

export default function ImpedimentoPage() {
  const router = useRouter();
  const params = useParams();
  const arbitragemId = params.arbitragemId as string;

  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const token = getToken();
  const user = getUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !motivo.trim()) return;

    setEnviando(true);
    try {
      await api(`/api/v1/arbitros/${arbitragemId}/impedimento`, {
        method: 'POST',
        body: JSON.stringify({ motivo }),
        token,
      });
      setSucesso(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (!token || user?.role !== 'ARBITRO') {
    router.push('/dashboard');
    return null;
  }

  return (
    <AuthLayout>
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-primary-700 dark:text-white">Declarar Impedimento</h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
              Declare impedimento ou suspeicao para o caso selecionado
            </p>
          </div>

          {sucesso ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
              <p className="text-green-700 font-semibold text-lg mb-2">
                Impedimento declarado com sucesso
              </p>
              <p className="text-green-600 text-sm mb-4">
                O administrador sera notificado e podera designar outro arbitro.
              </p>
              <button
                onClick={() => router.push('/arbitro')}
                className="bg-primary-600 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-primary-700"
              >
                Voltar para Meus Casos
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="motivo" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Motivo do impedimento/suspeicao
                  </label>
                  <textarea
                    id="motivo"
                    rows={6}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Descreva detalhadamente o motivo pelo qual voce declara impedimento ou suspeicao para atuar neste caso..."
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={enviando || !motivo.trim()}
                    className="bg-red-600 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {enviando ? 'Enviando...' : 'Declarar Impedimento'}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/arbitro')}
                    className="bg-gray-100 text-gray-600 rounded-lg px-6 py-2 text-sm font-medium hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
