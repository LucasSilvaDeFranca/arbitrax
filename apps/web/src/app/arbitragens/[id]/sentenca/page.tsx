'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { sentencaApi, Sentenca, VersaoResumo } from '@/lib/sentenca';

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

const STATUS_BADGE: Record<string, string> = {
  RASCUNHO: 'bg-yellow-100 text-yellow-800',
  EM_REVISAO: 'bg-blue-100 text-blue-800',
  APROVADA: 'bg-green-100 text-green-800',
  RATIFICADA: 'bg-emerald-100 text-emerald-800',
  PUBLICADA: 'bg-purple-100 text-purple-800',
};

export default function SentencaPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [sentenca, setSentenca] = useState<Sentenca | null>(null);
  const [versoes, setVersoes] = useState<VersaoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sugestoes, setSugestoes] = useState('');
  const [acting, setActing] = useState(false);
  const [tab, setTab] = useState<'sentenca' | 'versoes'>('sentenca');

  const token = getToken();
  const user = getUser();
  const isArbitro = user?.role === 'ARBITRO';

  const load = async () => {
    if (!token) { router.push('/login'); return; }
    try {
      const [s, v] = await Promise.all([
        sentencaApi.getCurrent(id, token).catch(() => null),
        sentencaApi.getVersoes(id, token).catch(() => []),
      ]);
      setSentenca(s);
      setVersoes(v);
    } catch {
      setError('Erro ao carregar sentenca');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleAprovar = async () => {
    if (!token) return;
    setActing(true);
    try {
      await sentencaApi.aprovar(id, token);
      await load();
    } catch (err: any) { setError(err.message); }
    finally { setActing(false); }
  };

  const handleSugerir = async () => {
    if (!token || sugestoes.length < 20) return;
    setActing(true);
    try {
      await sentencaApi.sugerir(id, sugestoes, token);
      setSugestoes('');
      await load();
    } catch (err: any) { setError(err.message); }
    finally { setActing(false); }
  };

  const handleRatificar = async () => {
    if (!token) return;
    setActing(true);
    try {
      await sentencaApi.ratificar(id, token);
      await load();
    } catch (err: any) { setError(err.message); }
    finally { setActing(false); }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Carregando...</p></main>;
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <Link href={`/arbitragens/${id}`} className="text-primary-600 hover:underline text-sm mb-4 block">
          &larr; Voltar para o caso
        </Link>

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-primary-700">Sentenca Arbitral</h1>
          {sentenca && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">v{sentenca.versao}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[sentenca.status] || 'bg-gray-100'}`}>
                {formatStatus(sentenca.status)}
              </span>
            </div>
          )}
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

        {!sentenca ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <p className="text-gray-500">Nenhuma sentenca gerada ainda.</p>
            <p className="text-sm text-gray-400 mt-2">A IA gerara o projeto quando as provas forem suficientes.</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setTab('sentenca')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  tab === 'sentenca' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                Sentenca
              </button>
              <button
                onClick={() => setTab('versoes')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  tab === 'versoes' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                Versoes ({versoes.length})
              </button>
            </div>

            {tab === 'sentenca' && (
              <div className="space-y-6">
                {/* Ementa */}
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Ementa</h3>
                  <p className="text-gray-800 italic">{sentenca.conteudo.ementa}</p>
                </div>

                {/* Relatorio */}
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Relatorio</h3>
                  <p className="text-gray-800 whitespace-pre-wrap">{sentenca.conteudo.relatorio}</p>
                </div>

                {/* Fundamentacao */}
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Fundamentacao</h3>
                  <p className="text-gray-800 whitespace-pre-wrap">{sentenca.conteudo.fundamentacao}</p>
                </div>

                {/* Dispositivo */}
                <div className="bg-white rounded-xl shadow p-6 border-l-4 border-primary-500">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Dispositivo (Decisao)</h3>
                  <p className="text-gray-800 font-medium whitespace-pre-wrap">{sentenca.conteudo.dispositivo}</p>
                </div>

                {/* Custas */}
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Custas</h3>
                  <div className="flex gap-8">
                    <div>
                      <span className="text-gray-500 text-sm">Requerente</span>
                      <p className="font-bold text-lg">R$ {sentenca.conteudo.custas?.requerente?.toLocaleString('pt-BR') || '0'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-sm">Requerido</span>
                      <p className="font-bold text-lg">R$ {sentenca.conteudo.custas?.requerido?.toLocaleString('pt-BR') || '0'}</p>
                    </div>
                  </div>
                </div>

                {/* Codigo verificacao */}
                {sentenca.codigoVerif && (
                  <div className="bg-emerald-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500">Codigo de verificacao</p>
                    <p className="text-2xl font-mono font-bold text-emerald-700">{sentenca.codigoVerif}</p>
                  </div>
                )}

                {/* Hash */}
                {sentenca.hashSha256 && (
                  <p className="text-xs text-gray-300 font-mono text-center">
                    SHA-256: {sentenca.hashSha256}
                  </p>
                )}

                {/* Acoes do Arbitro */}
                {isArbitro && (sentenca.status === 'RASCUNHO' || sentenca.status === 'EM_REVISAO') && (
                  <div className="bg-white rounded-xl shadow p-6 border-t-4 border-indigo-500">
                    <h3 className="font-semibold text-gray-800 mb-4">Acoes do Arbitro</h3>
                    <div className="flex gap-3 mb-4">
                      <button
                        onClick={handleAprovar}
                        disabled={acting}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                      >
                        Aprovar
                      </button>
                    </div>
                    <div className="space-y-2">
                      <textarea
                        rows={4}
                        value={sugestoes}
                        onChange={(e) => setSugestoes(e.target.value)}
                        placeholder="Escreva sugestoes de melhoria (min. 20 caracteres)..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                      <button
                        onClick={handleSugerir}
                        disabled={acting || sugestoes.length < 20}
                        className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition disabled:opacity-50"
                      >
                        Enviar Sugestoes (gera nova versao)
                      </button>
                    </div>
                  </div>
                )}

                {isArbitro && sentenca.status === 'APROVADA' && (
                  <div className="bg-white rounded-xl shadow p-6 border-t-4 border-emerald-500">
                    <h3 className="font-semibold text-gray-800 mb-4">Ratificacao Final</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Ao ratificar, a sentenca sera publicada e enviada as partes.
                    </p>
                    <button
                      onClick={handleRatificar}
                      disabled={acting}
                      className="px-8 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium disabled:opacity-50"
                    >
                      RATIFICAR Sentenca
                    </button>
                  </div>
                )}
              </div>
            )}

            {tab === 'versoes' && (
              <div className="space-y-3">
                {versoes.map((v) => (
                  <div key={v.id} className="bg-white rounded-xl shadow p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">Versao {v.versao}</span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs ${STATUS_BADGE[v.status] || 'bg-gray-100'}`}>
                          {formatStatus(v.status)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(v.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {v.aprovacoes.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {v.aprovacoes.map((a, i) => (
                          <p key={i} className="text-xs text-gray-500">
                            {a.arbitro.nome}: <span className="font-medium">{a.acao}</span> em {new Date(a.createdAt).toLocaleString('pt-BR')}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
