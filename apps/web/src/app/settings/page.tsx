'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { authApi } from '@/lib/api';
import { certificadoApi, CertificadoStatus } from '@/lib/certificado-digital';
import AuthLayout from '@/components/AuthLayout';

const ROLE_LABELS: Record<string, string> = {
  USUARIO: 'Usuario (Pessoa/Empresa)',
  ADVOGADO: 'Advogado',
  ARBITRO: 'Arbitro',
  ADMIN: 'Administrador',
};

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [certStatus, setCertStatus] = useState<CertificadoStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }

    Promise.all([
      authApi.me(token),
      certificadoApi.getStatus(token).catch(() => null),
    ])
      .then(([userData, cert]) => {
        setUser(userData);
        setCertStatus(cert);
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-gray-400 dark:text-slate-500">Carregando...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-primary-700 dark:text-white mb-8">Configuracoes</h1>

        {/* Perfil */}
        <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none mb-6">
          <h2 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Meu Perfil</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 dark:text-slate-500 mb-1">Nome</label>
              <p className="font-medium text-gray-800 dark:text-slate-100">{user?.nome}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 dark:text-slate-500 mb-1">Email</label>
              <p className="font-medium text-gray-800 dark:text-slate-100">{user?.email}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 dark:text-slate-500 mb-1">CPF/CNPJ</label>
              <p className="font-medium text-gray-800 dark:text-slate-100">{user?.cpfCnpj}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 dark:text-slate-500 mb-1">Telefone</label>
              <p className="font-medium text-gray-800 dark:text-slate-100">{user?.telefone}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 dark:text-slate-500 mb-1">Perfil</label>
              <span className="inline-block px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium">
                {ROLE_LABELS[user?.role] || user?.role}
              </span>
            </div>
            {user?.oabNumero && (
              <div>
                <label className="block text-xs text-gray-400 dark:text-slate-500 mb-1">OAB</label>
                <p className="font-medium text-gray-800 dark:text-slate-100">{user.oabNumero}</p>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 dark:text-slate-500 mb-1">Conta criada em</label>
              <p className="text-gray-600 dark:text-slate-300 text-sm">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '-'}
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 dark:text-slate-500 mb-1">Status</label>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                user?.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {user?.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        </div>

        {/* Assinatura Digital / Certificado */}
        <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-slate-100">Assinatura Digital</h2>
            <Link href="/certificado-digital" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              Gerenciar &rarr;
            </Link>
          </div>

          {certStatus?.temCertificado ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${certStatus.expirado ? 'bg-red-500' : 'bg-green-500'}`} />
                <span className={`text-sm font-medium ${certStatus.expirado ? 'text-red-600' : 'text-green-600'}`}>
                  {certStatus.expirado ? 'Certificado expirado' : 'Certificado ativo'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-400 dark:text-slate-500">Titular (CN)</span>
                  <p className="font-medium">{certStatus.cn}</p>
                </div>
                <div>
                  <span className="text-gray-400 dark:text-slate-500">Emissor</span>
                  <p className="font-medium">{certStatus.emissor}</p>
                </div>
                <div>
                  <span className="text-gray-400 dark:text-slate-500">Validade</span>
                  <p className="font-medium">
                    {certStatus.validade ? new Date(certStatus.validade).toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 dark:text-slate-500">Dias restantes</span>
                  <p className={`font-medium ${(certStatus.diasRestantes || 0) < 30 ? 'text-orange-600' : ''}`}>
                    {certStatus.diasRestantes ?? '-'} dias
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 dark:text-slate-400 mb-3">Nenhum certificado digital configurado.</p>
              <Link
                href="/certificado-digital"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm inline-block"
              >
                Configurar certificado A1
              </Link>
            </div>
          )}
        </div>

        {/* Plano */}
        <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none mb-6">
          <h2 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Meu Plano</h2>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
              Plano Gratuito
            </span>
            <span className="text-xs text-gray-400">1 arbitragem/mes ate R$ 5.000</span>
          </div>
        </div>

        {/* Seguranca */}
        <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none mb-6">
          <h2 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Seguranca</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800/30 rounded-lg">
              <div>
                <p className="font-medium text-sm">Alterar senha</p>
                <p className="text-xs text-gray-400">Atualize sua senha de acesso</p>
              </div>
              <button className="px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition">
                Alterar
              </button>
            </div>
          </div>
        </div>

        {/* Info legal */}
        <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
          <h2 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Informacoes Legais</h2>
          <div className="space-y-2 text-sm text-gray-500 dark:text-slate-400">
            <ul className="list-disc pl-5 space-y-1">
              <li>Lei 9.307/96 - Lei de Arbitragem</li>
              <li>Lei 14.063/2020 - Assinatura Eletronica</li>
              <li>LGPD - Protecao de Dados Pessoais</li>
            </ul>
            <p className="mt-3 text-xs text-gray-400">ArbitraX v1.0.0 - A justica do futuro, hoje!</p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
