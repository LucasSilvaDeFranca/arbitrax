'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { api } from '@/lib/api';

interface Compromisso {
  id: string;
  status: string;
  hashSha256?: string;
  assinReqAt?: string;
  assinReqdoAt?: string;
  signatarios?: Array<{
    nome: string;
    email: string;
    signUrl?: string;
    status: string;
  }>;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  enviado: { label: 'Enviado para assinatura', color: 'bg-blue-100 text-blue-800' },
  assinado: { label: 'Assinado por ambas partes', color: 'bg-green-100 text-green-800' },
};

export default function CompromissoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [compromisso, setCompromisso] = useState<Compromisso | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [acting, setActing] = useState(false);

  const token = getToken();
  const user = getUser();

  const load = async () => {
    if (!token) { router.push('/login'); return; }
    try {
      const data = await api<Compromisso>(`/api/v1/arbitragens/${id}/compromisso`, { token });
      setCompromisso(data);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleAceiteInterno = async () => {
    if (!token) return;
    setActing(true);
    try {
      await api(`/api/v1/arbitragens/${id}/compromisso/aceitar`, { method: 'POST', token });
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Carregando...</p></main>;
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        <Link href={`/arbitragens/${id}`} className="text-primary-600 hover:underline text-sm mb-4 block">
          &larr; Voltar para o caso
        </Link>

        <h1 className="text-3xl font-bold text-primary-700 mb-6">Compromisso Arbitral</h1>

        {notFound ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <p className="text-gray-500 mb-4">Compromisso ainda nao gerado para este caso.</p>
            <p className="text-sm text-gray-400">O administrador ira gerar o termo quando o caso estiver pronto.</p>
          </div>
        ) : compromisso && (
          <div className="space-y-6">
            {/* Status */}
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-gray-800">Status</h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  STATUS_MAP[compromisso.status]?.color || 'bg-gray-100'
                }`}>
                  {STATUS_MAP[compromisso.status]?.label || compromisso.status}
                </span>
              </div>

              {compromisso.hashSha256 && (
                <p className="text-xs text-gray-300 font-mono mt-3">
                  SHA-256: {compromisso.hashSha256}
                </p>
              )}
            </div>

            {/* Signatarios (ZapSign) */}
            {compromisso.signatarios && compromisso.signatarios.length > 0 && (
              <div className="bg-white rounded-xl shadow p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Assinaturas</h2>
                <div className="space-y-3">
                  {compromisso.signatarios.map((s, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{s.nome}</p>
                        <p className="text-sm text-gray-500">{s.email}</p>
                      </div>
                      <div className="text-right">
                        {s.status === 'signed' ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Assinado</span>
                        ) : s.signUrl ? (
                          <a
                            href={s.signUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 transition"
                          >
                            Assinar agora
                          </a>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">Pendente</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aceite interno (fallback sem ZapSign) */}
            {compromisso.status === 'pendente' && !compromisso.signatarios?.length && (
              <div className="bg-white rounded-xl shadow p-6 border-t-4 border-primary-500">
                <h2 className="font-semibold text-gray-800 mb-2">Aceite Digital</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Ao clicar em "Aceitar e Assinar", voce concorda com todos os termos do Compromisso Arbitral
                  conforme a Lei 9.307/96.
                </p>

                <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm text-gray-600">
                  <p className="font-medium mb-2">Resumo dos termos:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Arbitragem como meio exclusivo de resolucao</li>
                    <li>Procedimento 100% digital via plataforma ArbitraX</li>
                    <li>Sentenca final e obrigatoria com forca de decisao judicial</li>
                    <li>IA auxilia, arbitro humano valida e decide</li>
                  </ul>
                </div>

                <button
                  onClick={handleAceiteInterno}
                  disabled={acting}
                  className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50"
                >
                  {acting ? 'Processando...' : 'Aceitar e Assinar Compromisso'}
                </button>
              </div>
            )}

            {compromisso.status === 'assinado' && (
              <div className="bg-green-50 rounded-xl p-6 text-center">
                <p className="text-green-700 font-semibold text-lg">Compromisso assinado por ambas as partes</p>
                <p className="text-sm text-green-600 mt-1">O caso esta em andamento.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
