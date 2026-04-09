'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { arbitragensApi } from '@/lib/arbitragens';
import { api } from '@/lib/api';
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

interface TipoDemanda {
  id: string;
  nome: string;
  categoria: string;
  ativo: boolean;
}

interface Arbitro {
  id: string;
  nome: string;
  oabNumero: string | null;
}

export default function NovaArbitragemPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tiposDemanda, setTiposDemanda] = useState<TipoDemanda[]>([]);
  const [arbitros, setArbitros] = useState<Arbitro[]>([]);
  // Escolha de arbitro sempre disponivel agora (feature priorizada pelo cliente - Apr/2026)
  const podeEscolherArbitro = true;
  const [form, setForm] = useState({
    requeridoNome: '',
    requeridoCpfCnpj: '',
    requeridoTelefone: '+55',
    requeridoEmail: '',
    objeto: '',
    valorCausa: 0,
    categoria: 'COMERCIAL',
    urgencia: false,
    tipoDemandaId: '',
    regraLeis: true,
    regraEquidade: false,
    regraCostumes: false,
    modoArbitro: 'escolha', // default agora: cliente escolhe o arbitro
    arbitroId: '',
  });

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    // Buscar tipos de demanda
    api<TipoDemanda[]>('/api/v1/arbitragens/tipos-demanda', { token })
      .then(setTiposDemanda)
      .catch(() => {});

    // Buscar arbitros disponiveis
    api<Arbitro[]>('/api/v1/arbitragens/arbitros-disponiveis', { token })
      .then(setArbitros)
      .catch(() => {});

  }, []);

  const update = (field: string, value: any) => setForm({ ...form, [field]: value });

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const token = getToken();
      if (!token) { router.push('/login'); return; }

      const data: any = { ...form };
      if (!data.requeridoEmail) delete data.requeridoEmail;
      if (!data.tipoDemandaId) delete data.tipoDemandaId;
      if (data.modoArbitro !== 'escolha') delete data.arbitroId;
      if (!data.arbitroId) delete data.arbitroId;

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

  // Agrupar tipos de demanda por categoria
  const tiposAgrupados = tiposDemanda.reduce<Record<string, TipoDemanda[]>>((acc, tipo) => {
    const cat = tipo.categoria;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tipo);
    return acc;
  }, {});

  const inputClass = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500";

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
              <h2 className="text-xl font-semibold dark:text-white mb-4">Dados do Requerido (parte contraria)</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nome completo *</label>
                <input
                  type="text"
                  required
                  value={form.requeridoNome}
                  onChange={(e) => update('requeridoNome', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">CPF / CNPJ *</label>
                <input
                  type="text"
                  required
                  value={form.requeridoCpfCnpj}
                  onChange={(e) => update('requeridoCpfCnpj', e.target.value)}
                  className={inputClass}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">WhatsApp *</label>
                <input
                  type="tel"
                  required
                  value={form.requeridoTelefone}
                  onChange={(e) => {
                    // Garantir que o numero sempre comece com +55
                    let v = e.target.value;
                    if (!v.startsWith('+55')) {
                      // Se usuario apagou o prefixo, recupera
                      const digits = v.replace(/\D/g, '');
                      v = '+55' + digits;
                    }
                    update('requeridoTelefone', v);
                  }}
                  className={inputClass}
                  placeholder="+5511988888888"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email (opcional)</label>
                <input
                  type="email"
                  value={form.requeridoEmail}
                  onChange={(e) => update('requeridoEmail', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Step 1: Detalhes do Conflito */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold dark:text-white mb-4">Detalhes do Conflito</h2>

              {/* Tipo de Demanda */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tipo de Demanda</label>
                <select
                  value={form.tipoDemandaId}
                  onChange={(e) => update('tipoDemandaId', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecione o tipo de demanda</option>
                  {Object.entries(tiposAgrupados).map(([categoria, tipos]) => (
                    <optgroup key={categoria} label={categoria}>
                      {tipos.map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Regras de Julgamento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Regras de Julgamento</label>
                <div className="bg-gray-50 dark:bg-slate-800/30 rounded-lg p-4 space-y-3 border border-gray-200 dark:border-slate-700">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="regraLeis"
                      checked={form.regraLeis}
                      onChange={(e) => update('regraLeis', e.target.checked)}
                      className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                    />
                    <label htmlFor="regraLeis" className="text-sm text-gray-700 dark:text-slate-300">
                      <span className="font-medium">Leis aplicaveis</span>
                      <span className="block text-xs text-gray-400 dark:text-slate-500">Normas juridicas vigentes no Brasil</span>
                    </label>
                  </div>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="regraEquidade"
                      checked={form.regraEquidade}
                      onChange={(e) => update('regraEquidade', e.target.checked)}
                      className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                    />
                    <label htmlFor="regraEquidade" className="text-sm text-gray-700 dark:text-slate-300">
                      <span className="font-medium">Equidade</span>
                      <span className="block text-xs text-gray-400 dark:text-slate-500">A criterio do arbitro, se as partes concordarem</span>
                    </label>
                  </div>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="regraCostumes"
                      checked={form.regraCostumes}
                      onChange={(e) => update('regraCostumes', e.target.checked)}
                      className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                    />
                    <label htmlFor="regraCostumes" className="text-sm text-gray-700 dark:text-slate-300">
                      <span className="font-medium">Costumes do setor</span>
                      <span className="block text-xs text-gray-400 dark:text-slate-500">Praticas comerciais usuais</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Designacao do Arbitro */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Designacao do Arbitro</label>
                <div className="bg-gray-50 dark:bg-slate-800/30 rounded-lg p-4 space-y-3 border border-gray-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id="modoSistema"
                      name="modoArbitro"
                      value="sistema"
                      checked={form.modoArbitro === 'sistema'}
                      onChange={() => { update('modoArbitro', 'sistema'); update('arbitroId', ''); }}
                      className="text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                    />
                    <label htmlFor="modoSistema" className="text-sm text-gray-700 dark:text-slate-300">
                      Sistema escolhe automaticamente
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id="modoEscolha"
                      name="modoArbitro"
                      value="escolha"
                      checked={form.modoArbitro === 'escolha'}
                      onChange={() => update('modoArbitro', 'escolha')}
                      disabled={!podeEscolherArbitro}
                      className="text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 disabled:opacity-50"
                    />
                    <label htmlFor="modoEscolha" className="text-sm text-gray-700 dark:text-slate-300">
                      Quero escolher o arbitro
                    </label>
                  </div>
                  {form.modoArbitro === 'escolha' && podeEscolherArbitro && (
                    <div className="ml-6 mt-2">
                      <select
                        value={form.arbitroId}
                        onChange={(e) => update('arbitroId', e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Selecione o arbitro</option>
                        {arbitros.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nome}{a.oabNumero ? ` (OAB ${a.oabNumero})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Objeto / Descricao */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Descricao do conflito * <span className="text-gray-400 dark:text-slate-500">(min. 50 caracteres)</span>
                </label>
                <textarea
                  required
                  rows={5}
                  value={form.objeto}
                  onChange={(e) => update('objeto', e.target.value)}
                  className={inputClass}
                  placeholder="Descreva detalhadamente o conflito, incluindo fatos, datas e valores envolvidos..."
                />
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{form.objeto.length}/50 caracteres</p>
              </div>

              {/* Valor da Causa - aceita apenas digitos, sem formatacao */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Valor da causa (R$) * <span className="text-gray-400 dark:text-slate-500">(min. R$ 1.000)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.valorCausa > 0 ? String(form.valorCausa) : ''}
                  onChange={(e) => {
                    // Strip tudo que nao e digito. onChange recebe string, armazena int.
                    const digits = e.target.value.replace(/[^0-9]/g, '');
                    const n = digits === '' ? 0 : parseInt(digits, 10);
                    update('valorCausa', Number.isFinite(n) ? n : 0);
                  }}
                  className={inputClass}
                  placeholder="5000"
                />
                {form.valorCausa > 0 && form.valorCausa < 1000 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Valor minimo: R$ 1.000 (voce digitou R$ {form.valorCausa})
                  </p>
                )}
                {form.valorCausa >= 1000 && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    R$ {form.valorCausa.toLocaleString('pt-BR')}
                  </p>
                )}
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Categoria *</label>
                <select
                  value={form.categoria}
                  onChange={(e) => update('categoria', e.target.value)}
                  className={inputClass}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Urgencia */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="urgencia"
                  checked={form.urgencia}
                  onChange={(e) => update('urgencia', e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
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
              <h2 className="text-xl font-semibold dark:text-white mb-4">Revisao do Pedido</h2>
              <div className="bg-gray-50 dark:bg-slate-800/30 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Requerido</span>
                  <span className="font-medium dark:text-slate-200">{form.requeridoNome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">CPF/CNPJ</span>
                  <span className="font-medium dark:text-slate-200">{form.requeridoCpfCnpj}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">WhatsApp</span>
                  <span className="font-medium dark:text-slate-200">{form.requeridoTelefone}</span>
                </div>
                <hr className="border-gray-200 dark:border-slate-700" />

                {/* Tipo de Demanda na revisao */}
                {form.tipoDemandaId && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-slate-400">Tipo de Demanda</span>
                    <span className="font-medium dark:text-slate-200">
                      {tiposDemanda.find((t) => t.id === form.tipoDemandaId)?.nome || '-'}
                    </span>
                  </div>
                )}

                {/* Regras na revisao */}
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Regras de Julgamento</span>
                  <span className="font-medium dark:text-slate-200 text-right text-sm">
                    {[
                      form.regraLeis && 'Leis',
                      form.regraEquidade && 'Equidade',
                      form.regraCostumes && 'Costumes',
                    ].filter(Boolean).join(', ') || 'Nenhuma'}
                  </span>
                </div>

                {/* Modo arbitro na revisao */}
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Arbitro</span>
                  <span className="font-medium dark:text-slate-200">
                    {form.modoArbitro === 'escolha' && form.arbitroId
                      ? arbitros.find((a) => a.id === form.arbitroId)?.nome || 'Selecionado'
                      : 'Designacao automatica'}
                  </span>
                </div>

                <hr className="border-gray-200 dark:border-slate-700" />
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Categoria</span>
                  <span className="font-medium dark:text-slate-200">{form.categoria}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Valor da Causa</span>
                  <span className="font-medium dark:text-slate-200">
                    R$ {form.valorCausa.toLocaleString('pt-BR')}
                  </span>
                </div>
                {form.urgencia && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-slate-400">Urgencia</span>
                    <span className="font-medium text-orange-600 dark:text-orange-400">Sim (+50%)</span>
                  </div>
                )}
                <hr className="border-gray-200 dark:border-slate-700" />
                <div>
                  <span className="text-gray-500 dark:text-slate-400 block mb-1">Objeto</span>
                  <p className="text-sm dark:text-slate-300">{form.objeto}</p>
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
