'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { certificadoApi, CertificadoStatus } from '@/lib/certificado-digital';

export default function CertificadoDigitalPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<CertificadoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [uploading, setUploading] = useState(false);

  // Action states
  const [validando, setValidando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [confirmRemover, setConfirmRemover] = useState(false);

  const token = getToken();
  const user = getUser();

  const rolesPermitidas = ['ARBITRO', 'ADVOGADO', 'ADMIN'];
  const temPermissao = user && rolesPermitidas.includes(user.role);

  const loadStatus = async () => {
    if (!token) { router.push('/login'); return; }
    try {
      const data = await certificadoApi.getStatus(token);
      setStatus(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleUpload = async () => {
    if (!token || !file || !senha) return;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const result = await certificadoApi.upload(file, senha, token);
      setSuccess(result.message);
      setFile(null);
      setSenha('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleValidar = async () => {
    if (!token) return;
    setValidando(true);
    setError('');
    setSuccess('');
    try {
      const result = await certificadoApi.validar(token);
      setSuccess(result.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setValidando(false);
    }
  };

  const handleRemover = async () => {
    if (!token) return;
    setRemovendo(true);
    setError('');
    setSuccess('');
    try {
      const result = await certificadoApi.remover(token);
      setSuccess(result.message);
      setConfirmRemover(false);
      await loadStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRemovendo(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  if (!temPermissao) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Acesso Restrito</h1>
          <p className="text-gray-500">Apenas Arbitros, Advogados e Administradores podem gerenciar certificados digitais.</p>
          <Link href="/dashboard" className="text-primary-600 hover:underline mt-4 inline-block">
            Voltar ao Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="text-primary-600 hover:underline text-sm mb-4 block">
          &larr; Voltar ao Dashboard
        </Link>

        <h1 className="text-3xl font-bold text-primary-700 mb-2">Certificado Digital A1</h1>
        <p className="text-gray-500 mb-8">
          Configure seu certificado ICP-Brasil para assinar documentos digitalmente.
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">
            {success}
          </div>
        )}

        {/* Status do Certificado */}
        {status?.temCertificado ? (
          <div className="bg-white rounded-xl shadow p-6 mb-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Certificado Configurado</h2>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  status.expirado
                    ? 'bg-red-100 text-red-700'
                    : (status.diasRestantes || 0) < 30
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {status.expirado
                  ? 'Expirado'
                  : `Valido (${status.diasRestantes} dias)`}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Titular (CN)</span>
                <p className="font-medium text-gray-800">{status.cn}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Autoridade Certificadora</span>
                <p className="font-medium text-gray-800">{status.emissor}</p>
              </div>
              <div className="flex gap-8">
                <div>
                  <span className="text-sm text-gray-500">Validade</span>
                  <p className="font-medium text-gray-800">
                    {status.validade
                      ? new Date(status.validade).toLocaleDateString('pt-BR')
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Serial</span>
                  <p className="font-mono text-sm text-gray-600">
                    {status.serial ? status.serial.substring(0, 20) + '...' : 'N/A'}
                  </p>
                </div>
              </div>
              {status.atualizadoEm && (
                <p className="text-xs text-gray-400">
                  Configurado em: {new Date(status.atualizadoEm).toLocaleString('pt-BR')}
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleValidar}
                disabled={validando}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50"
              >
                {validando ? 'Validando...' : 'Validar Certificado'}
              </button>

              {!confirmRemover ? (
                <button
                  onClick={() => setConfirmRemover(true)}
                  className="px-4 py-2 bg-gray-100 text-red-600 rounded-lg hover:bg-red-50 transition text-sm"
                >
                  Remover Certificado
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleRemover}
                    disabled={removendo}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm disabled:opacity-50"
                  >
                    {removendo ? 'Removendo...' : 'Confirmar Remocao'}
                  </button>
                  <button
                    onClick={() => setConfirmRemover(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Nenhum Certificado Configurado</h2>
            <p className="text-sm text-gray-500 mb-4">
              Faca upload do seu certificado A1 (.pfx ou .p12) para assinar documentos digitalmente.
            </p>
          </div>
        )}

        {/* Upload Form */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {status?.temCertificado ? 'Atualizar Certificado' : 'Enviar Certificado'}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arquivo do Certificado (.pfx / .p12)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pfx,.p12"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-1 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha do Certificado
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite a senha do arquivo PFX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={uploading || !file || !senha}
              className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Enviando e validando...' : 'Enviar Certificado'}
            </button>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <p className="text-xs text-yellow-700">
              <strong>Seguranca:</strong> A senha do certificado e criptografada com AES-256-GCM antes de ser armazenada.
              O arquivo PFX e processado exclusivamente no servidor. Nenhum dado sensivel fica armazenado no navegador.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
