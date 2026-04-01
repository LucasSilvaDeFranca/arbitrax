'use client';

import { useState } from 'react';
import Link from 'next/link';

/* ─── FAQ Data ──────────────────────────────────────── */
const faqItems = [
  {
    question: 'O que e arbitragem e qual a validade juridica?',
    answer:
      'Arbitragem e um metodo de resolucao de conflitos previsto na Lei 9.307/96. A sentenca arbitral tem a mesma validade de uma sentenca judicial e nao depende de homologacao do Poder Judiciario. E um titulo executivo vinculante para ambas as partes.',
  },
  {
    question: 'Quanto tempo demora o procedimento?',
    answer:
      'O procedimento no ArbitraX leva em media de 15 a 45 dias, dependendo da complexidade do caso e da colaboracao das partes. Isso e significativamente mais rapido que a media de 3 a 5 anos do Judiciario brasileiro.',
  },
  {
    question: 'Quem pode usar o ArbitraX?',
    answer:
      'Qualquer pessoa fisica ou juridica que possua um conflito patrimonial disponivel pode utilizar a plataforma. Isso inclui disputas comerciais, de consumo, empresariais, trabalhistas e imobiliarias.',
  },
  {
    question: 'Como funciona a inteligencia artificial no processo?',
    answer:
      'A IA auxilia na analise de provas, geracao de rascunhos de sentenca e resumos executivos. Todas as decisoes finais sao sempre revisadas e aprovadas por um arbitro humano certificado, garantindo a imparcialidade e qualidade do julgamento.',
  },
  {
    question: 'Meus dados estao seguros na plataforma?',
    answer:
      'Sim. Utilizamos criptografia de ponta a ponta, autenticacao de dois fatores (2FA), certificados digitais e armazenamento seguro em nuvem. Todos os documentos possuem hash SHA-256 para garantia de integridade. A plataforma segue as normas da LGPD.',
  },
];

/* ─── FAQ Item Component ────────────────────────────── */
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-700/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-lg font-medium text-slate-100 group-hover:text-amber-400 transition-colors">
          {question}
        </span>
        <svg
          className={`w-5 h-5 text-amber-400 flex-shrink-0 ml-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96 pb-5' : 'max-h-0'}`}
      >
        <p className="text-slate-400 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

/* ─── Main Landing Page ─────────────────────────────── */
export default function Home() {
  return (
    <main className="min-h-screen bg-[#0f172a] text-white">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 w-full z-50 bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1e40af] to-[#7c3aed] flex items-center justify-center">
              <span className="text-white font-bold text-sm">AX</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              ArbitraX
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#como-funciona" className="hover:text-white transition-colors">
              Como Funciona
            </a>
            <a href="#vantagens" className="hover:text-white transition-colors">
              Vantagens
            </a>
            <a href="#planos" className="hover:text-white transition-colors">
              Planos
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="px-5 py-2 text-sm bg-gradient-to-r from-[#1e40af] to-[#7c3aed] rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Cadastrar
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#1e3a5f] to-[#0f172a]" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[#7c3aed]/10 rounded-full blur-3xl" />
        <div className="absolute top-40 left-1/4 w-[400px] h-[400px] bg-[#1e40af]/15 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-slate-700 bg-slate-800/50 text-sm text-slate-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Plataforma 100% digital e segura
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              ArbitraX
            </span>
          </h1>

          <p className="text-2xl md:text-3xl font-light text-slate-300 mb-4">
            A justica do futuro, hoje!
          </p>

          <p className="max-w-2xl mx-auto text-lg text-slate-400 mb-10 leading-relaxed">
            Resolva conflitos de forma rapida, acessivel e 100% online com validade juridica
            garantida pela Lei 9.307/96. Arbitragem digital com inteligencia artificial em 15 a 45 dias.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-4 bg-gradient-to-r from-[#1e40af] to-[#7c3aed] rounded-xl text-lg font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all hover:scale-105"
            >
              Comece Gratuitamente
            </Link>
            <a
              href="#como-funciona"
              className="px-8 py-4 border border-slate-600 rounded-xl text-lg font-medium text-slate-300 hover:bg-slate-800 transition-all"
            >
              Saiba Mais
            </a>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto text-center">
            <div>
              <p className="text-3xl font-bold text-[#d4a843]">15-45</p>
              <p className="text-sm text-slate-500">dias em media</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#d4a843]">100%</p>
              <p className="text-sm text-slate-500">digital e online</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#d4a843]">R$0</p>
              <p className="text-sm text-slate-500">para comecar</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Como Funciona ── */}
      <section id="como-funciona" className="py-24 bg-[#0f172a]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Como Funciona</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Quatro passos simples para resolver seu conflito de forma rapida e juridicamente valida.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: '01',
                title: 'Crie o Caso',
                description: 'Cadastre-se, descreva o conflito e envie os documentos iniciais pela plataforma.',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                ),
              },
              {
                step: '02',
                title: 'Convite ao Requerido',
                description: 'A outra parte recebe um convite por email para aderir ao procedimento arbitral.',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                ),
              },
              {
                step: '03',
                title: 'Instrucao Processual',
                description: 'Ambas as partes apresentam pecas, provas e alegacoes. A IA auxilia na analise.',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                ),
              },
              {
                step: '04',
                title: 'Sentenca',
                description: 'O arbitro profere a sentenca arbitral com validade juridica plena (Lei 9.307/96).',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-[#1e40af]/50 transition-all group"
              >
                <div className="absolute -top-3 -left-3 w-10 h-10 rounded-lg bg-gradient-to-br from-[#1e40af] to-[#7c3aed] flex items-center justify-center text-sm font-bold">
                  {item.step}
                </div>
                <div className="text-[#d4a843] mb-4 mt-2">{item.icon}</div>
                <h3 className="text-xl font-semibold mb-2 group-hover:text-[#d4a843] transition-colors">
                  {item.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vantagens ── */}
      <section id="vantagens" className="py-24 bg-gradient-to-b from-[#0f172a] via-[#1e3a5f]/20 to-[#0f172a]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Vantagens do ArbitraX</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Uma solucao completa que combina tecnologia de ponta com seguranca juridica.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Rapido',
                highlight: '15-45 dias',
                description: 'Resolva disputas em semanas, nao anos. Procedimentos ageis com prazos bem definidos.',
                gradient: 'from-blue-500 to-cyan-500',
                icon: (
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                ),
              },
              {
                title: 'Barato',
                highlight: 'A partir de R$0',
                description: 'Plano gratuito disponivel. Custos transparentes e muito abaixo do Judiciario tradicional.',
                gradient: 'from-green-500 to-emerald-500',
                icon: (
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                title: 'Digital',
                highlight: '100% online',
                description: 'Todo o procedimento e digital. Sem deslocamentos, sem filas, sem papelada fisica.',
                gradient: 'from-purple-500 to-violet-500',
                icon: (
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                  </svg>
                ),
              },
              {
                title: 'Seguro',
                highlight: 'Lei 9.307/96',
                description: 'Validade juridica plena, criptografia de ponta, certificados digitais e conformidade com a LGPD.',
                gradient: 'from-amber-500 to-orange-500',
                icon: (
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-all group text-center"
              >
                <div
                  className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${item.gradient} bg-opacity-10 text-white/80 mb-4`}
                >
                  {item.icon}
                </div>
                <h3 className="text-xl font-semibold mb-1">{item.title}</h3>
                <p className="text-[#d4a843] font-bold text-lg mb-3">{item.highlight}</p>
                <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Planos ── */}
      <section id="planos" className="py-24 bg-[#0f172a]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Planos e Precos</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Escolha o plano ideal para suas necessidades. Comece gratuitamente e escale conforme precisar.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: 'Free',
                price: 'R$ 0',
                period: '/mes',
                description: 'Para experimentar a plataforma',
                features: [
                  '1 arbitragem/mes',
                  'Valor ate R$ 10.000',
                  'Arbitro designado',
                  'Chat interno',
                  'Suporte por email',
                ],
                cta: 'Comecar Gratis',
                highlighted: false,
              },
              {
                name: 'Basic',
                price: 'R$ 49',
                period: '/mes',
                description: 'Para profissionais autonomos',
                features: [
                  '5 arbitragens/mes',
                  'Valor ate R$ 50.000',
                  'Arbitro designado',
                  'Chat + notificacoes',
                  'Suporte prioritario',
                  'Analise de provas por IA',
                ],
                cta: 'Assinar Basic',
                highlighted: false,
              },
              {
                name: 'Plus',
                price: 'R$ 199',
                period: '/mes',
                description: 'Para escritorios de advocacia',
                features: [
                  '20 arbitragens/mes',
                  'Valor ate R$ 200.000',
                  'Escolha de arbitro',
                  'Prioridade na fila',
                  'IA completa (provas + sentenca)',
                  'Suporte dedicado',
                  'Relatorios avancados',
                ],
                cta: 'Assinar Plus',
                highlighted: true,
              },
              {
                name: 'Pro',
                price: 'R$ 499',
                period: '/mes',
                description: 'Para grandes empresas',
                features: [
                  'Arbitragens ilimitadas',
                  'Valor ate R$ 1.000.000',
                  'Escolha de arbitro',
                  'Prioridade maxima',
                  'Urgencia disponivel',
                  'IA completa + resumos',
                  'API de integracao',
                  'Gerente de conta',
                ],
                cta: 'Assinar Pro',
                highlighted: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative p-6 rounded-2xl border transition-all ${
                  plan.highlighted
                    ? 'bg-gradient-to-b from-[#1e40af]/20 to-[#7c3aed]/10 border-[#1e40af] scale-105 shadow-lg shadow-blue-500/10'
                    : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#1e40af] to-[#7c3aed] rounded-full text-xs font-bold">
                    Mais Popular
                  </div>
                )}
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-slate-500 text-sm mb-4">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                  <span className="text-slate-500 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                      <svg
                        className="w-5 h-5 text-[#d4a843] flex-shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`block w-full py-3 rounded-xl text-center font-semibold transition-all ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-[#1e40af] to-[#7c3aed] text-white hover:opacity-90'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 bg-gradient-to-b from-[#0f172a] via-[#1e3a5f]/10 to-[#0f172a]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Perguntas Frequentes</h2>
            <p className="text-slate-400">
              Tire suas duvidas sobre arbitragem digital e o ArbitraX.
            </p>
          </div>

          <div className="divide-y divide-slate-700/50">
            {faqItems.map((item) => (
              <FaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className="py-24 bg-[#0f172a]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="p-12 rounded-3xl bg-gradient-to-br from-[#1e3a5f] to-[#1e40af]/50 border border-slate-700/50">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Pronto para resolver seu conflito?
            </h2>
            <p className="text-slate-300 mb-8 max-w-xl mx-auto">
              Cadastre-se gratuitamente e inicie seu primeiro procedimento arbitral em minutos.
              Sem burocracia, sem filas, com validade juridica plena.
            </p>
            <Link
              href="/register"
              className="inline-block px-10 py-4 bg-gradient-to-r from-[#d4a843] to-[#b8922e] rounded-xl text-lg font-bold text-[#0f172a] shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all hover:scale-105"
            >
              Criar Conta Gratuita
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 border-t border-slate-800 bg-[#0b1120]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1e40af] to-[#7c3aed] flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AX</span>
                </div>
                <span className="text-lg font-bold">ArbitraX</span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                Plataforma de arbitragem digital com inteligencia artificial. Resolucao de conflitos rapida, segura e juridicamente valida.
              </p>
            </div>

            {/* Plataforma */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-4">Plataforma</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#como-funciona" className="hover:text-slate-300 transition-colors">Como Funciona</a></li>
                <li><a href="#vantagens" className="hover:text-slate-300 transition-colors">Vantagens</a></li>
                <li><a href="#planos" className="hover:text-slate-300 transition-colors">Planos</a></li>
                <li><a href="#faq" className="hover:text-slate-300 transition-colors">FAQ</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><span className="hover:text-slate-300 transition-colors cursor-pointer">Termos de Uso</span></li>
                <li><span className="hover:text-slate-300 transition-colors cursor-pointer">Politica de Privacidade</span></li>
                <li><span className="hover:text-slate-300 transition-colors cursor-pointer">LGPD</span></li>
                <li><span className="hover:text-slate-300 transition-colors cursor-pointer">Lei 9.307/96</span></li>
              </ul>
            </div>

            {/* Contato */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-4">Contato</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li>contato@arbitrax.com.br</li>
                <li>suporte@arbitrax.com.br</li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              2024-2026 ArbitraX. Todos os direitos reservados.
            </p>
            <p className="text-xs text-slate-700">
              Procedimentos regidos pela Lei 9.307/96 (Lei de Arbitragem) e Lei 13.709/18 (LGPD)
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
