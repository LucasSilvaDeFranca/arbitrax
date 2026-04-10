'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { api, downloadAuthenticatedFile } from '@/lib/api';
import AuthLayout from '@/components/AuthLayout';

interface Compromisso {
  id: string;
  arbitragemId: string;
  status: string;
  pdfUrl?: string;
  hashSha256?: string;
  assinReqAt?: string;
  assinReqdoAt?: string;
  assinaturaReqCn?: string;
  assinaturaReqdoCn?: string;
  signatarios?: Array<{
    nome: string;
    email: string;
    signUrl?: string;
    status: string;
  }>;
}

interface CertStatus {
  temCertificado: boolean;
  cn?: string;
  expirado?: boolean;
}

interface Arbitragem {
  id: string;
  requerenteId: string;
  requeridoId?: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  enviado: { label: 'Enviado para assinatura', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  assinado: { label: 'Assinado por ambas partes', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function CompromissoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [compromisso, setCompromisso] = useState<Compromisso | null>(null);
  const [certStatus, setCertStatus] = useState<CertStatus | null>(null);
  const [arbitragem, setArbitragem] = useState<Arbitragem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');
  const [signSuccess, setSignSuccess] = useState('');
  const [showSignModal, setShowSignModal] = useState(false);
  // OTP flow states
  const [otpStep, setOtpStep] = useState<'escolha' | 'cpf' | 'codigo' | 'sucesso'>('escolha');
  const [otpCpf, setOtpCpf] = useState('');
  const [otpCodigo, setOtpCodigo] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [gerando, setGerando] = useState(false);
  const [gerarError, setGerarError] = useState('');

  const token = getToken();
  const user = getUser();

  // Carrega todos os dados da pagina em paralelo (compromisso + cert + arbitragem)
  const load = async () => {
    if (!token) { router.push('/login'); return; }
    try {
      const [compData, certData, arbData] = await Promise.all([
        api<Compromisso>(`/api/v1/arbitragens/${id}/compromisso`, { token }).catch(() => null),
        api<CertStatus>(`/api/v1/certificado-digital/status`, { token }).catch(() => null),
        api<any>(`/api/v1/arbitragens/${id}`, { token }).catch(() => null),
      ]);

      if (!compData) {
        setNotFound(true);
      } else {
        setCompromisso(compData);
      }
      setCertStatus(certData);
      if (arbData) setArbitragem(arbData);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleDownloadPdf = async () => {
    if (!token) return;
    try {
      await downloadAuthenticatedFile(
        `/api/v1/arbitragens/${id}/compromisso/pdf`,
        token,
        `compromisso-${id}.pdf`,
      );
    } catch (err: any) {
      alert(err.message || 'Erro ao baixar PDF');
    }
  };

  const handleGerar = async () => {
    if (!token) return;
    setGerando(true);
    setGerarError('');
    try {
      await api(`/api/v1/arbitragens/${id}/compromisso/regerar`, { method: 'POST', token });
      setNotFound(false);
      await load();
    } catch (err: any) {
      setGerarError(err.message || 'Erro ao gerar compromisso');
    } finally {
      setGerando(false);
    }
  };

  const handleAssinar = async () => {
    if (!token) return;
    setSigning(true);
    setSignError('');
    setSignSuccess('');
    try {
      const result = await api<{ success: boolean; cn: string; assinadoEm: string; role: string }>(
        `/api/v1/arbitragens/${id}/compromisso/assinar-digital`,
        { method: 'POST', token },
      );
      setSignSuccess(`Assinado com sucesso por ${result.cn} em ${formatDate(result.assinadoEm)}`);
      await load();
    } catch (err: any) {
      setSignError(err.message || 'Erro ao assinar');
    } finally {
      setSigning(false);
    }
  };

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const isRequerente = user && arbitragem && arbitragem.requerenteId === user.id;
  const isRequerido = user && arbitragem && arbitragem.requeridoId === user.id;
  const isParty = isRequerente || isRequerido;

  const userAlreadySigned = compromisso && (
    (isRequerente && compromisso.assinReqAt) ||
    (isRequerido && compromisso.assinReqdoAt)
  );

  const bothSigned = compromisso?.status === 'assinado';

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-gray-500 dark:text-slate-400">Carregando...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="p-8">
        <div className="max-w-3xl mx-auto">
          <Link href={`/arbitragens/${id}`} className="text-primary-600 dark:text-primary-400 hover:underline text-sm mb-4 block">
            &larr; Voltar para o caso
          </Link>

          <h1 className="text-3xl font-bold text-primary-700 dark:text-white mb-6">Compromisso Arbitral</h1>

          {notFound ? (
            <div className="bg-white rounded-xl shadow p-8 text-center dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
              <p className="text-gray-500 dark:text-slate-400 mb-2">Compromisso ainda nao gerado para este caso.</p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mb-6">
                O documento e criado automaticamente quando o convite e aceito. Se voce esta vendo esta mensagem mas as duas partes ja aceitaram, clique no botao abaixo para gerar manualmente.
              </p>
              {gerarError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
                  {gerarError}
                </div>
              )}
              <button
                onClick={handleGerar}
                disabled={gerando}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50"
              >
                {gerando ? 'Gerando...' : 'Gerar Compromisso Arbitral'}
              </button>
            </div>
          ) : compromisso && (
            <div className="space-y-6">

              {/* 1. Status Card */}
              <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
                <div className="flex justify-between items-center">
                  <h2 className="font-semibold text-gray-800 dark:text-slate-100">Status</h2>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    STATUS_MAP[compromisso.status]?.color || 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    {STATUS_MAP[compromisso.status]?.label || compromisso.status}
                  </span>
                </div>
                {compromisso.hashSha256 && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 font-mono mt-3 break-all">
                    SHA-256: {compromisso.hashSha256}
                  </p>
                )}
              </div>

              {/* 2. PDF Download Card */}
              {compromisso.pdfUrl && (
                <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
                  <h2 className="font-semibold text-gray-800 dark:text-slate-100 mb-3">Documento PDF</h2>
                  <button
                    onClick={handleDownloadPdf}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {bothSigned ? 'Baixar Compromisso Assinado (PDF)' : 'Baixar Termo de Compromisso (PDF)'}
                  </button>
                </div>
              )}

              {/* 3. Assinaturas Section */}
              <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
                <h2 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Assinaturas Digitais</h2>

                <div className="space-y-3">
                  {/* Requerente */}
                  <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800/30 rounded-lg">
                    <span className="font-medium text-gray-700 dark:text-slate-200">Requerente</span>
                    {compromisso.assinReqAt ? (
                      <span className="text-sm text-green-700 dark:text-green-400">
                        Assinado em {formatDate(compromisso.assinReqAt)}{compromisso.assinaturaReqCn ? ` com ${compromisso.assinaturaReqCn}` : ''}
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded text-xs font-medium">
                        Pendente
                      </span>
                    )}
                  </div>

                  {/* Requerido */}
                  <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800/30 rounded-lg">
                    <span className="font-medium text-gray-700 dark:text-slate-200">Requerido</span>
                    {compromisso.assinReqdoAt ? (
                      <span className="text-sm text-green-700 dark:text-green-400">
                        Assinado em {formatDate(compromisso.assinReqdoAt)}{compromisso.assinaturaReqdoCn ? ` com ${compromisso.assinaturaReqdoCn}` : ''}
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded text-xs font-medium">
                        Pendente
                      </span>
                    )}
                  </div>
                </div>

                {/* Sign action for current user */}
                {isParty && !userAlreadySigned && !bothSigned && compromisso.pdfUrl && (
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700/50">
                    {signError && (
                      <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
                        {signError}
                      </div>
                    )}
                    {signSuccess && (
                      <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-sm">
                        {signSuccess}
                      </div>
                    )}

                    <button
                      onClick={() => setShowSignModal(true)}
                      disabled={signing}
                      className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {signing ? (
                        <>
                          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Assinando...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          Assinar Compromisso
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Both signed success card */}
              {bothSigned && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 text-center border border-green-200 dark:border-green-800/50">
                  <svg className="w-12 h-12 mx-auto text-green-600 dark:text-green-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p className="text-green-700 dark:text-green-300 font-semibold text-lg">Compromisso assinado por ambas as partes</p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">O caso esta em andamento.</p>
                  {compromisso.pdfUrl && (
                    <button
                      onClick={handleDownloadPdf}
                      className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Baixar Compromisso Assinado
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal: escolher metodo de assinatura + fluxo OTP */}
      {showSignModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">

            {/* Step: ESCOLHA do metodo */}
            {otpStep === 'escolha' && (
              <>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-2">
                  Como deseja assinar?
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                  Escolha o metodo de assinatura para o Termo de Compromisso Arbitral.
                </p>
                <div className="space-y-3">
                  {certStatus?.temCertificado && !certStatus?.expirado ? (
                    <button
                      onClick={() => { setShowSignModal(false); setOtpStep('escolha'); handleAssinar(); }}
                      className="w-full p-4 border-2 border-green-500 dark:border-green-600 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition text-left flex items-start gap-3"
                    >
                      <div className="text-2xl mt-0.5">{'\u{1F510}'}</div>
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-slate-100">Certificado Digital A1</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Assinatura qualificada ICP-Brasil ({certStatus.cn})</p>
                      </div>
                    </button>
                  ) : (
                    <div className="w-full p-4 border-2 border-gray-200 dark:border-slate-700 rounded-xl opacity-50">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl mt-0.5">{'\u{1F510}'}</div>
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-slate-100">Certificado Digital A1</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                            {certStatus?.expirado ? 'Certificado expirado.' : 'Nenhum certificado configurado.'}
                          </p>
                          <Link href="/certificado-digital" className="text-xs text-primary-600 dark:text-primary-400 hover:underline mt-1 inline-block">
                            Configurar certificado
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => { setOtpStep('cpf'); setOtpError(''); setOtpCpf(''); }}
                    className="w-full p-4 border-2 border-blue-500 dark:border-blue-600 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition text-left flex items-start gap-3"
                  >
                    <div className="text-2xl mt-0.5">{'\u{1F4E7}'}</div>
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-slate-100">Assinatura por Email</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        Validacao por CPF + codigo enviado ao seu email. Assinatura avancada conforme Lei 14.063/2020.
                      </p>
                    </div>
                  </button>
                </div>
                <button onClick={() => { setShowSignModal(false); setOtpStep('escolha'); }}
                  className="w-full mt-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition">
                  Cancelar
                </button>
              </>
            )}

            {/* Step: CONFIRMAR CPF */}
            {otpStep === 'cpf' && (
              <>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-2">
                  Confirme seu CPF/CNPJ
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                  Digite seu CPF ou CNPJ para confirmar sua identidade. Um codigo sera enviado ao seu email cadastrado.
                </p>
                {otpError && (
                  <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
                    {otpError}
                  </div>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  value={otpCpf}
                  onChange={(e) => setOtpCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 mb-4"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('btn-enviar-otp')?.click();
                    }
                  }}
                />
                <button
                  id="btn-enviar-otp"
                  disabled={otpLoading || otpCpf.replace(/\D/g, '').length < 11}
                  onClick={async () => {
                    setOtpLoading(true);
                    setOtpError('');
                    try {
                      const res = await api<{ enviado: boolean; email: string }>(`/api/v1/arbitragens/${id}/compromisso/enviar-otp`, {
                        method: 'POST', token: token!, body: JSON.stringify({ cpf: otpCpf }),
                      });
                      setOtpEmail(res.email);
                      setOtpStep('codigo');
                      setOtpCodigo('');
                      setOtpCooldown(60);
                      // Timer de cooldown pra reenvio
                      const timer = setInterval(() => {
                        setOtpCooldown((prev) => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; });
                      }, 1000);
                    } catch (err: any) {
                      setOtpError(err.message || 'Erro ao enviar codigo');
                    } finally {
                      setOtpLoading(false);
                    }
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
                >
                  {otpLoading ? 'Enviando...' : 'Enviar codigo para meu email'}
                </button>
                <button onClick={() => setOtpStep('escolha')}
                  className="w-full mt-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition">
                  Voltar
                </button>
              </>
            )}

            {/* Step: DIGITAR CODIGO */}
            {otpStep === 'codigo' && (
              <>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-2">
                  Digite o codigo
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                  Codigo enviado para <strong className="text-gray-800 dark:text-slate-200">{otpEmail}</strong>. Valido por 10 minutos.
                </p>
                {otpError && (
                  <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
                    {otpError}
                  </div>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCodigo}
                  onChange={(e) => setOtpCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-4 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-[0.5em] focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 mb-4"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && otpCodigo.length === 6) {
                      e.preventDefault();
                      document.getElementById('btn-validar-otp')?.click();
                    }
                  }}
                />
                <button
                  id="btn-validar-otp"
                  disabled={otpLoading || otpCodigo.length !== 6}
                  onClick={async () => {
                    setOtpLoading(true);
                    setOtpError('');
                    try {
                      const res = await api<{ success: boolean; cn: string; assinadoEm: string; role: string }>(`/api/v1/arbitragens/${id}/compromisso/assinar-avancada`, {
                        method: 'POST', token: token!, body: JSON.stringify({ codigo: otpCodigo }),
                      });
                      setSignSuccess(`Assinado com sucesso por ${res.cn} em ${formatDate(res.assinadoEm)}`);
                      setOtpStep('sucesso');
                      await load();
                    } catch (err: any) {
                      setOtpError(err.message || 'Codigo invalido');
                    } finally {
                      setOtpLoading(false);
                    }
                  }}
                  className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50"
                >
                  {otpLoading ? 'Validando...' : 'Validar e Assinar'}
                </button>
                <div className="mt-3 text-center">
                  {otpCooldown > 0 ? (
                    <p className="text-xs text-gray-400 dark:text-slate-500">Reenviar codigo em {otpCooldown}s</p>
                  ) : (
                    <button
                      onClick={() => { setOtpStep('cpf'); setOtpError(''); }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Nao recebeu? Reenviar codigo
                    </button>
                  )}
                </div>
                <button onClick={() => { setOtpStep('escolha'); setOtpError(''); }}
                  className="w-full mt-2 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition">
                  Cancelar
                </button>
              </>
            )}

            {/* Step: SUCESSO */}
            {otpStep === 'sucesso' && (
              <>
                <div className="text-center py-4">
                  <div className="text-5xl mb-3">{'\u{2705}'}</div>
                  <h2 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-2">
                    Assinado com sucesso!
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Assinatura Avancada por Email + CPF
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    Conforme Lei 14.063/2020
                  </p>
                </div>
                <button
                  onClick={() => { setShowSignModal(false); setOtpStep('escolha'); }}
                  className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
                >
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
