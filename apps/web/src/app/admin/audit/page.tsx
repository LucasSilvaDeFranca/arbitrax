'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, getUser } from '@/lib/auth';
import { adminApi, AuditLogEntry } from '@/lib/admin';
import AuthLayout from '@/components/AuthLayout';

export default function AuditLogPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const token = getToken();
  const user = getUser();

  useEffect(() => {
    if (!token || user?.role !== 'ADMIN') { router.push('/dashboard'); return; }

    setLoading(true);
    adminApi.getAuditLogs({ page: String(page), limit: '20' }, token)
      .then((res) => { setLogs(res.data); setMeta(res.meta); })
      .catch(() => router.push('/admin'))
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-gray-500">Carregando...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-primary-700">Audit Log</h1>
            <p className="text-gray-500 text-sm mt-1">Registro de acoes do sistema</p>
          </div>

          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acao</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entidade</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {log.user?.nome || log.userId}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                        {log.acao}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {log.entidade}
                      {log.entidadeId && (
                        <span className="text-gray-400 text-xs ml-1">({log.entidadeId.substring(0, 8)}...)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono max-w-xs truncate">
                      {log.dadosDepois ? JSON.stringify(log.dadosDepois) : '-'}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded border text-sm disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="px-3 py-1 text-sm text-gray-600">
                Pagina {page} de {meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                className="px-3 py-1 rounded border text-sm disabled:opacity-50"
              >
                Proxima
              </button>
            </div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
