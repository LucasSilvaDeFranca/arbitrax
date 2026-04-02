'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { pecasApi, provasApi, Peca, Prova, formatFileSize } from '@/lib/documentos';
import AuthLayout from '@/components/AuthLayout';

const PECA_TIPOS = [
  { value: 'PETICAO_INICIAL', label: 'Peticao Inicial' },
  { value: 'CONTESTACAO', label: 'Contestacao' },
  { value: 'REPLICA', label: 'Replica' },
  { value: 'TREPLICA', label: 'Treplica' },
  { value: 'ALEGACOES_FINAIS', label: 'Alegacoes Finais' },
  { value: 'OUTROS', label: 'Outros' },
];

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default function DocumentosPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'pecas' | 'provas'>('pecas');
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [provas, setProvas] = useState<Prova[]>([]);
  const [loading, setLoading] = useState(true);

  // Peca form
  const [pecaTipo, setPecaTipo] = useState('PETICAO_INICIAL');
  const [pecaConteudo, setPecaConteudo] = useState('');
  const [pecaFiles, setPecaFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Prova form
  const [provaDesc, setProvaDesc] = useState('');
  const [provaFile, setProvaFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const token = getToken();

  const load = async () => {
    if (!token) { router.push('/login'); return; }
    try {
      const [p, pr] = await Promise.all([
        pecasApi.list(id, token),
        provasApi.list(id, token),
      ]);
      setPecas(p);
      setProvas(pr);
    } catch {
      router.push('/arbitragens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSubmitPeca = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('tipo', pecaTipo);
      if (pecaConteudo) formData.append('conteudo', pecaConteudo);
      pecaFiles.forEach((f) => formData.append('anexos', f));

      await pecasApi.create(id, formData, token);
      setPecaConteudo('');
      setPecaFiles([]);
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitProva = async () => {
    if (!token || !provaFile) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('arquivo', provaFile);
      if (provaDesc) formData.append('descricao', provaDesc);

      await provasApi.upload(id, formData, token);
      setProvaDesc('');
      setProvaFile(null);
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (provaId: string) => {
    if (!token) return;
    try {
      const { url } = await provasApi.download(id, provaId, token);
      window.open(url, '_blank');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) {
      setProvaFile(e.dataTransfer.files[0]);
    }
  };

  if (loading) {
    return <AuthLayout><div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-500 dark:text-slate-400">Carregando...</p></div></AuthLayout>;
  }

  return (
    <AuthLayout>
      <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <Link href={`/arbitragens/${id}`} className="text-primary-600 dark:text-primary-400 hover:underline text-sm mb-4 block">
          &larr; Voltar para o caso
        </Link>

        <h1 className="text-3xl font-bold text-primary-700 dark:text-white mb-6">Documentos</h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setTab('pecas')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              tab === 'pecas' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            Pecas ({pecas.length})
          </button>
          <button
            onClick={() => setTab('provas')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              tab === 'provas' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            Provas ({provas.length})
          </button>
        </div>

        {/* Pecas Tab */}
        {tab === 'pecas' && (
          <div className="space-y-6">
            {/* Form */}
            <div className="bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
              <h2 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Protocolar Peca</h2>
              <div className="space-y-3">
                <select
                  value={pecaTipo}
                  onChange={(e) => setPecaTipo(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                >
                  {PECA_TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <textarea
                  rows={4}
                  value={pecaConteudo}
                  onChange={(e) => setPecaConteudo(e.target.value)}
                  placeholder="Conteudo da peca (min. 10 caracteres)..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                />
                <div>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setPecaFiles(Array.from(e.target.files || []))}
                    className="text-sm"
                  />
                  {pecaFiles.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{pecaFiles.length} arquivo(s) selecionado(s)</p>
                  )}
                </div>
                <button
                  onClick={handleSubmitPeca}
                  disabled={submitting || (!pecaConteudo && pecaFiles.length === 0)}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Enviando...' : 'Protocolar'}
                </button>
              </div>
            </div>

            {/* List */}
            <div className="space-y-3">
              {pecas.map((p) => (
                <div key={p.id} className="bg-white rounded-xl shadow p-4 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                        {formatStatus(p.tipo)}
                      </span>
                      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">por {p.autor.nome}</p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      {new Date(p.protocoladaAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {p.conteudo && <p className="text-sm mt-3 text-gray-700 dark:text-slate-300">{p.conteudo}</p>}
                  {p.anexos.length > 0 && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">{p.anexos.length} anexo(s)</p>
                  )}
                </div>
              ))}
              {pecas.length === 0 && (
                <p className="text-gray-500 dark:text-slate-400 text-center py-4">Nenhuma peca protocolada.</p>
              )}
            </div>
          </div>
        )}

        {/* Provas Tab */}
        {tab === 'provas' && (
          <div className="space-y-6">
            {/* Upload with drag-and-drop */}
            <div
              className={`bg-white rounded-xl shadow p-6 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none border-2 border-dashed transition ${
                dragOver ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-slate-700'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <h2 className="font-semibold text-gray-800 dark:text-slate-100 mb-4">Enviar Prova</h2>
              <div className="text-center py-4">
                {provaFile ? (
                  <div className="space-y-2">
                    <p className="font-medium">{provaFile.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(provaFile.size)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-500 dark:text-slate-400 mb-2">Arraste um arquivo aqui ou</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition text-sm"
                    >
                      Selecionar arquivo
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && setProvaFile(e.target.files[0])}
                    />
                  </div>
                )}
              </div>
              <input
                type="text"
                value={provaDesc}
                onChange={(e) => setProvaDesc(e.target.value)}
                placeholder="Descricao da prova (opcional)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500 mt-3"
              />
              <button
                onClick={handleSubmitProva}
                disabled={submitting || !provaFile}
                className="mt-3 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
              >
                {submitting ? 'Enviando...' : 'Enviar Prova'}
              </button>
            </div>

            {/* List */}
            <div className="space-y-3">
              {provas.map((p) => (
                <div key={p.id} className="bg-white rounded-xl shadow p-4 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {p.tipo === 'IMAGEM' ? '🖼' : p.tipo === 'VIDEO' ? '🎬' : p.tipo === 'AUDIO' ? '🎵' : '📄'}
                    </span>
                    <div>
                      <p className="font-medium text-sm">{p.descricao || p.tipo}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {p.parte.nome} - {formatFileSize(p.tamanho)} - {new Date(p.createdAt).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-xs text-gray-300 font-mono">SHA-256: {p.hashSha256?.substring(0, 16)}...</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(p.id)}
                    className="px-3 py-1 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition"
                  >
                    Download
                  </button>
                </div>
              ))}
              {provas.length === 0 && (
                <p className="text-gray-500 dark:text-slate-400 text-center py-4">Nenhuma prova enviada.</p>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </AuthLayout>
  );
}
