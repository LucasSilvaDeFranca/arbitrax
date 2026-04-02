'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { arbitragensApi } from '@/lib/arbitragens';
import AuthLayout from '@/components/AuthLayout';

const CATEGORIAS = [
  { value: 'COMERCIAL', label: 'Comercial' },
  { value: 'CONSUMIDOR', label: 'Consumidor' },
  { value: 'EMPRESARIAL', label: 'Empresarial' },
  { value: 'TRABALHISTA', label: 'Trabalhista' },
  { value: 'IMOBILIARIO', label: 'Imobiliario' },
  { value: 'OUTROS', label: 'Outros' },
];

const STEPS = ['Dados do Requerido', 'Detalhes do Conflito', 'Revisao e Envio'];

export default function NovaArbitragemPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    requeridoNome: '',
    requeridoCpfCnpj: '',
    requeridoTelefone: '',
    requeridoEmail: '',
    objeto: '',
    valorCausa: 0,
    categoria: 'COMERCIAL',
    urgencia: false,
  });

  const update = (field: string, value: any) => setForm({ ...form, [field]: value });

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const token = getToken();
      if (!token) { router.push('/login'); return; }

      const data = { ...form };
      if (!data.requeridoEmail) delete (data as any).requeridoEmail;

      const result = await arbitragensApi.create(data, token);
      router.push(`/arbitragens/${result.id}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar arbitragem');
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    if (step === 0) {
      return form.requeridoNome.length >= 3 && form.requeridoCpfCnpj && form.requeridoTelefone;
    }
    if (step === 1) {
      return form.objeto.length >= 50 && form.valorCausa >= 1000;
    }
    return true;
  };

  return (
    <AuthLayout>
      <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-primary-700 dark:text-white mb-2">Nova Arbitragem</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                i <= step ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
              }`}>
                {i + 1}
              </div>
              <span className={`text-sm ${i <= step ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-gray-400 dark:text-slate-500'}`}>
                {s}
              </span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-gray-300 dark:bg-slate-600" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 p-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-8 dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none">
          {/* Step 0: Dados do Requerido */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Dados do Requerido (parte contraria)</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nome completo *</label>
                <input
                  type="text"
                  required
                  value={form.requeridoNome}
                  onChange={(e) => update('requeridoNome', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">CPF / CNPJ *</label>
                <input
                  type="text"
                  required
                  value={form.requeridoCpfCnpj}
                  onChange={(e) => update('requeridoCpfCnpj', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">WhatsApp *</label>
                <input
                  type="tel"
                  required
                  value={form.requeridoTelefone}
                  onChange={(e) => update('requeridoTelefone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                  placeholder="+5511988888888"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email (opcional)</label>
                <input
                  type="email"
                  value={form.requeridoEmail}
                  onChange={(e) => update('requeridoEmail', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                />
              </div>
            </div>
          )}

          {/* Step 1: Detalhes do Conflito */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Detalhes do Conflito</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Descricao do conflito * <span className="text-gray-400">(min. 50 caracteres)</span>
                </label>
                <textarea
                  required
                  rows={5}
                  value={form.objeto}
                  onChange={(e) => update('objeto', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                  placeholder="Descreva detalhadamente o conflito, incluindo fatos, datas e valores envolvidos..."
                />
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{form.objeto.length}/50 caracteres</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Valor da causa (R$) * <span className="text-gray-400">(min. R$ 1.000)</span>
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  value={form.valorCausa || ''}
                  onChange={(e) => update('valorCausa', Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                  placeholder="25000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Categoria *</label>
                <select
                  value={form.categoria}
                  onChange={(e) => update('categoria', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="urgencia"
                  checked={form.urgencia}
                  onChange={(e) => update('urgencia', e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="urgencia" className="text-sm text-gray-700 dark:text-slate-300">
                  Tramitacao urgente (+50% taxa)
                </label>
              </div>
            </div>
          )}

          {/* Step 2: Revisao */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Revisao do Pedido</h2>
              <div className="bg-gray-50 dark:bg-slate-800/30 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Requerido</span>
                  <span className="font-medium">{form.requeridoNome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">CPF/CNPJ</span>
                  <span className="font-medium">{form.requeridoCpfCnpj}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">WhatsApp</span>
                  <span className="font-medium">{form.requeridoTelefone}</span>
                </div>
                <hr />
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Categoria</span>
                  <span className="font-medium">{form.categoria}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Valor da Causa</span>
                  <span className="font-medium">
                    R$ {form.valorCausa.toLocaleString('pt-BR')}
                  </span>
                </div>
                {form.urgencia && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-slate-400">Urgencia</span>
                    <span className="font-medium text-orange-600">Sim (+50%)</span>
                  </div>
                )}
                <hr />
                <div>
                  <span className="text-gray-500 block mb-1">Objeto</span>
                  <p className="text-sm">{form.objeto}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <button
              onClick={() => step > 0 ? setStep(step - 1) : router.push('/dashboard')}
              className="px-6 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition"
            >
              {step === 0 ? 'Cancelar' : 'Voltar'}
            </button>

            {step < 2 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
              >
                Proximo
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Confirmar e Enviar'}
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </AuthLayout>
  );
}
