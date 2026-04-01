'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ConvitePage() {
  const params = useParams();
  const token = params.token as string;

  const [convite, setConvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/convites/${token}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setConvite)
      .catch(() => setConvite(null))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAceitar = async () => {
    setActing(true);
    try {
      await fetch(`${API_URL}/api/v1/convites/${token}/aceitar`, { method: 'POST' });
      setResultado('aceito');
    } catch { setResultado('erro'); }
    finally { setActing(false); }
  };

  const handleRecusar = async () => {
    setActing(true);
    try {
      await fetch(`${API_URL}/api/v1/convites/${token}/recusar`, { method: 'POST' });
      setResultado('recusado');
    } catch { setResultado('erro'); }
    finally { setActing(false); }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Carregando convite...</p>
      </main>
    );
  }

  if (!convite) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Convite nao encontrado</h1>
          <p className="text-gray-500">Este link pode ter expirado ou ser invalido.</p>
        </div>
      </main>
    );
  }

  if (resultado) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-xl p-10">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
            resultado === 'aceito' ? 'bg-green-100' : resultado === 'recusado' ? 'bg-red-100' : 'bg-yellow-100'
          }`}>
            <span className="text-3xl">{resultado === 'aceito' ? '✓' : resultado === 'recusado' ? '✗' : '!'}</span>
          </div>
          <h1 className={`text-2xl font-bold mb-2 ${
            resultado === 'aceito' ? 'text-green-700' : resultado === 'recusado' ? 'text-red-700' : 'text-yellow-700'
          }`}>
            {resultado === 'aceito' ? 'Convite Aceito!' : resultado === 'recusado' ? 'Convite Recusado' : 'Erro'}
          </h1>
          <p className="text-gray-500 mb-6">
            {resultado === 'aceito'
              ? 'Voce aceitou participar da arbitragem. Faca login ou cadastre-se para acompanhar o caso.'
              : resultado === 'recusado'
              ? 'Voce recusou o convite. O requerente sera notificado.'
              : 'Ocorreu um erro. Tente novamente.'}
          </p>
          {resultado === 'aceito' && (
            <div className="flex gap-3 justify-center">
              <Link href="/login" className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
                Entrar
              </Link>
              <Link href="/register" className="px-6 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition">
                Cadastrar
              </Link>
            </div>
          )}
        </div>
      </main>
    );
  }

  const arb = convite.arbitragem;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700">ArbitraX</h1>
          <p className="text-gray-400 text-sm">A justica do futuro, hoje!</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Banner */}
          <div className="bg-gradient-to-r from-blue-900 via-blue-700 to-purple-700 p-6 text-white">
            <h2 className="text-xl font-bold">Convite para Arbitragem</h2>
            <p className="text-blue-200 text-sm mt-1">Caso {arb.numero}</p>
          </div>

          {/* Status */}
          {convite.status === 'expirado' && (
            <div className="bg-red-50 p-4 text-center">
              <p className="text-red-600 font-semibold">Este convite expirou.</p>
            </div>
          )}

          {/* Detalhes */}
          <div className="p-6 space-y-4">
            <p className="text-gray-600">
              Prezado(a) <strong>{arb.requerido?.nome}</strong>, voce foi convidado(a) para participar de um procedimento de arbitragem digital.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Requerente</span>
                <span className="font-medium">{arb.requerente?.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Valor</span>
                <span className="font-medium">R$ {Number(arb.valorCausa).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Categoria</span>
                <span className="font-medium">{arb.categoria}</span>
              </div>
              <hr />
              <div>
                <span className="text-gray-500 text-sm">Objeto</span>
                <p className="text-sm mt-1">{arb.objeto?.substring(0, 300)}</p>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-1">Sobre a arbitragem digital:</p>
              <ul className="list-disc pl-5 space-y-1 text-blue-700">
                <li>Procedimento 100% online via plataforma ArbitraX</li>
                <li>Conforme Lei 9.307/96 (Lei de Arbitragem)</li>
                <li>Sentenca com mesmos efeitos de decisao judicial</li>
                <li>Prazo para resposta: 5 dias uteis</li>
              </ul>
            </div>

            {convite.status === 'pendente' && (
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAceitar}
                  disabled={acting}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold disabled:opacity-50"
                >
                  {acting ? '...' : 'Aceitar Arbitragem'}
                </button>
                <button
                  onClick={handleRecusar}
                  disabled={acting}
                  className="flex-1 py-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition font-bold disabled:opacity-50"
                >
                  {acting ? '...' : 'Recusar'}
                </button>
              </div>
            )}

            {convite.status !== 'pendente' && (
              <div className="text-center pt-4">
                <p className="text-gray-500">Este convite ja foi <strong>{convite.status}</strong>.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
