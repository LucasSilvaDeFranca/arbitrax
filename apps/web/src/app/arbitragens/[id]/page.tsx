'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { arbitragensApi } from '@/lib/arbitragens';

const STATUS_COLORS: Record<string, string> = {
  AGUARDANDO_PAGAMENTO_REGISTRO: 'bg-yellow-100 text-yellow-800',
  AGUARDANDO_ACEITE: 'bg-blue-100 text-blue-800',
  EM_INSTRUCAO: 'bg-indigo-100 text-indigo-800',
  ANALISE_PROVAS: 'bg-purple-100 text-purple-800',
  GERANDO_SENTENCA: 'bg-purple-100 text-purple-800',
  SENTENCA_APROVADA: 'bg-green-100 text-green-800',
  ENCERRADA: 'bg-gray-100 text-gray-800',
  RECUSADA: 'bg-red-100 text-red-800',
  CANCELADA: 'bg-red-100 text-red-800',
};

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default function ArbitragemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [arb, setArb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  const load = () => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }

    arbitragensApi.getById(id, token)
      .then(setArb)
      .catch(() => router.push('/arbitragens'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleTransition = async (newStatus: string) => {
    const token = getToken();
    if (!token) return;

    setTransitioning(true);
    try {
      const updated = await arbitragensApi.updateStatus(id, newStatus, token);
      setArb(updated);
    } catch (err: any) {
      alert(err.message || 'Erro na transicao');
    } finally {
      setTransitioning(false);
    }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Carregando...</p></main>;
  }

  if (!arb) return null;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/arbitragens" className="text-primary-600 hover:underline text-sm mb-4 block">
          &larr; Voltar para lista
        </Link>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-primary-700">{arb.numero}</h1>
            <p className="text-gray-500">
              Criado em {new Date(arb.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[arb.status] || 'bg-gray-100'}`}>
            {formatStatus(arb.status)}
          </span>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Partes</h3>
            <div className="space-y-2">
              <div>
                <span className="text-xs text-gray-400">Requerente</span>
                <p className="font-medium">{arb.requerente?.nome}</p>
              </div>
              <div>
                <span className="text-xs text-gray-400">Requerido</span>
                <p className="font-medium">{arb.requerido?.nome}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Detalhes</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Valor</span>
                <span className="font-medium">R$ {Number(arb.valorCausa).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Categoria</span>
                <span className="font-medium">{arb.categoria}</span>
              </div>
              {arb.urgencia && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Urgencia</span>
                  <span className="font-medium text-orange-600">Sim</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Objeto */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Objeto da Arbitragem</h3>
          <p className="text-gray-800">{arb.objeto}</p>
        </div>

        {/* Link Documentos */}
        <Link
          href={`/arbitragens/${id}/documentos`}
          className="block bg-white rounded-xl shadow p-6 mb-6 hover:bg-gray-50 transition"
        >
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium text-gray-800">Documentos</h3>
              <p className="text-sm text-gray-500">
                {arb.pecas?.length || 0} pecas, {arb.provas?.length || 0} provas
              </p>
            </div>
            <span className="text-primary-600">&rarr;</span>
          </div>
        </Link>

        {/* Transicoes de estado */}
        {arb.allowedTransitions?.length > 0 && (
          <div className="bg-white rounded-xl shadow p-6 mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Acoes Disponiveis</h3>
            <div className="flex flex-wrap gap-2">
              {arb.allowedTransitions.map((t: string) => (
                <button
                  key={t}
                  onClick={() => handleTransition(t)}
                  disabled={transitioning}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                    t === 'CANCELADA'
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                  }`}
                >
                  {formatStatus(t)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pecas */}
        {arb.pecas?.length > 0 && (
          <div className="bg-white rounded-xl shadow p-6 mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Pecas Processuais</h3>
            <div className="space-y-2">
              {arb.pecas.map((p: any) => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-sm">{formatStatus(p.tipo)}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(p.protocoladaAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prazos */}
        {arb.prazos?.length > 0 && (
          <div className="bg-white rounded-xl shadow p-6 mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Prazos</h3>
            <div className="space-y-2">
              {arb.prazos.map((p: any) => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-sm">{formatStatus(p.tipo)}</span>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      p.status === 'ATIVO' ? 'bg-green-100 text-green-700' :
                      p.status === 'EXPIRADO' ? 'bg-red-100 text-red-700' : 'bg-gray-100'
                    }`}>
                      {p.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Vence: {new Date(p.fim).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
