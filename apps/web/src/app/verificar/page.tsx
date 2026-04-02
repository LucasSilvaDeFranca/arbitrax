'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function VerificarPage() {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');

  const handleVerificar = (e: React.FormEvent) => {
    e.preventDefault();
    if (codigo.trim()) {
      router.push(`/verificar/${codigo.trim()}`);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f172a] p-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-primary-700 dark:text-white mb-2">ArbitraX</h1>
        <p className="text-gray-400 dark:text-slate-500 text-sm mb-8">Verificacao de Documento</p>

        <div className="bg-white rounded-2xl shadow-xl p-8 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-3xl">🔍</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2">Verificar Autenticidade</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            Insira o codigo de verificacao da sentenca arbitral para confirmar sua autenticidade.
          </p>

          <form onSubmit={handleVerificar} className="space-y-4">
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="ARB-VRF-XXXXXXXX"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center font-mono text-lg tracking-wider focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <button
              type="submit"
              disabled={!codigo.trim()}
              className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-bold disabled:opacity-50"
            >
              Verificar
            </button>
          </form>
        </div>

        <p className="text-xs text-gray-400 dark:text-slate-500 mt-6">
          Lei 9.307/96 - Arbitragem | Lei 14.063/2020 - Assinatura Eletronica
        </p>
      </div>
    </main>
  );
}
