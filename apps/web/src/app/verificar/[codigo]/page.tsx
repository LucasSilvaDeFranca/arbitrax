'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function VerificarResultadoPage() {
  const params = useParams();
  const codigo = params.codigo as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/verificar/${codigo}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [codigo]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Verificando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary-700">ArbitraX</h1>
          <p className="text-gray-400 text-sm">Verificacao de Documento</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {notFound ? (
            <div className="p-10 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-4xl">✗</span>
              </div>
              <h2 className="text-2xl font-bold text-red-600 mb-2">Documento Nao Encontrado</h2>
              <p className="text-gray-500 mb-2">Codigo: <span className="font-mono font-bold">{codigo}</span></p>
              <p className="text-sm text-gray-400">
                Este codigo nao corresponde a nenhuma sentenca arbitral registrada.
                Verifique se o codigo foi digitado corretamente.
              </p>
            </div>
          ) : (
            <>
              {/* Selo de verificacao */}
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-center text-white">
                <div className="w-16 h-16 mx-auto mb-3 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-3xl">✓</span>
                </div>
                <h2 className="text-xl font-bold">Documento Verificado</h2>
                <p className="text-green-200 text-sm">Sentenca arbitral autentica</p>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Codigo</span>
                    <span className="font-mono font-bold text-green-700">{data.codigoVerif}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Caso</span>
                    <span className="font-medium">{data.numero}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">{data.status}</span>
                  </div>
                  {data.requerente && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Requerente</span>
                      <span className="font-medium">{data.requerente}</span>
                    </div>
                  )}
                  {data.requerido && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Requerido</span>
                      <span className="font-medium">{data.requerido}</span>
                    </div>
                  )}
                  {data.dataRatificacao && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ratificada em</span>
                      <span className="font-medium">{new Date(data.dataRatificacao).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                </div>

                {data.hashSha256 && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400">Hash SHA-256 do documento:</p>
                    <p className="font-mono text-xs text-gray-600 break-all mt-1">{data.hashSha256}</p>
                  </div>
                )}

                <div className="text-center text-xs text-gray-400 pt-2">
                  <p>Sentenca arbitral com validade juridica conforme Lei 9.307/96</p>
                  <p>Verificado em {new Date().toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="text-center mt-4">
          <Link href="/verificar" className="text-primary-600 hover:underline text-sm">
            &larr; Verificar outro documento
          </Link>
        </div>
      </div>
    </main>
  );
}
