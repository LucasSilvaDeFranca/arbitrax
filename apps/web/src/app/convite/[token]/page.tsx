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
  const [aceiteRegras, setAceiteRegras] = useState(false);
  const [aceiteLei, setAceiteLei] = useState(false);
  const [aceiteEquidade, setAceiteEquidade] = useState(false);
  const [aceiteCostumes, setAceiteCostumes] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/convites/${token}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setConvite)
      .catch(() => setConvite(null))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAceitar = async () => {
    if (senha && senha !== confirmarSenha) {
      alert('As senhas nao coincidem');
      return;
    }
    if (senha && senha.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setActing(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/convites/${token}/aceitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aceiteRegras, aceiteLei, aceiteEquidade, aceiteCostumes, senha: senha || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Erro desconhecido' }));
        throw new Error(err.message);
      }
      const data = await res.json();

      // Se conta foi criada, fazer login automatico
      if (data.contaCriada && data.email && senha) {
        try {
          const loginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: data.email, senha }),
          });
          if (loginRes.ok) {
            const loginData = await loginRes.json();
            if (loginData.accessToken) {
              localStorage.setItem('accessToken', loginData.accessToken);
              localStorage.setItem('refreshToken', loginData.refreshToken);
              localStorage.setItem('user', JSON.stringify(loginData.user));
              window.location.href = `/arbitragens/${data.arbitragemId}`;
              return;
            }
          }
        } catch { /* fallback para tela de resultado */ }
      }

      // Se ja tem conta, redirecionar pro login
      if ((convite as any)?.requeridoTemConta && !senha) {
        setResultado('aceito_login');
      } else {
        setResultado('aceito');
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao aceitar convite');
      setActing(false);
      return;
    }
    setActing(false);
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
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f172a]">
        <p className="text-gray-400 dark:text-slate-500">Carregando convite...</p>
      </main>
    );
  }

  if (!convite) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f172a]">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Convite nao encontrado</h1>
          <p className="text-gray-500 dark:text-slate-400">Este link pode ter expirado ou ser invalido.</p>
        </div>
      </main>
    );
  }

  if (resultado) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f172a]">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-xl dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none p-10">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
            resultado === 'aceito' ? 'bg-green-100' : resultado === 'recusado' ? 'bg-red-100' : 'bg-yellow-100'
          }`}>
            <span className="text-3xl">{resultado === 'aceito' ? '✓' : resultado === 'recusado' ? '✗' : '!'}</span>
          </div>
          <h1 className={`text-2xl font-bold mb-2 ${
            resultado === 'aceito' ? 'text-green-700' : resultado === 'recusado' ? 'text-red-700' : 'text-yellow-700'
          }`}>
            {(resultado === 'aceito' || resultado === 'aceito_login') ? 'Convite Aceito!' : resultado === 'recusado' ? 'Convite Recusado' : 'Erro'}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mb-6">
            {resultado === 'aceito'
              ? 'Conta criada! Voce ja esta logado e sera redirecionado.'
              : resultado === 'aceito_login'
              ? 'Voce aceitou participar da arbitragem. Faca login para acessar o caso.'
              : resultado === 'recusado'
              ? 'Voce recusou o convite. O requerente sera notificado.'
              : 'Ocorreu um erro. Tente novamente.'}
          </p>
          {(resultado === 'aceito' || resultado === 'aceito_login') && (
            <div className="flex gap-3 justify-center">
              <Link href="/login" className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
                Entrar
              </Link>
            </div>
          )}
        </div>
      </main>
    );
  }

  const arb = convite.arbitragem;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f172a] p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700 dark:text-white">ArbitraX</h1>
          <p className="text-gray-400 dark:text-slate-500 text-sm">A justica do futuro, hoje!</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl dark:bg-slate-800/50 dark:border dark:border-slate-700/50 dark:shadow-none overflow-hidden">
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
            <p className="text-gray-600 dark:text-slate-300">
              Prezado(a) <strong>{arb.requerido?.nome}</strong>, voce foi convidado(a) para participar de um procedimento de arbitragem digital.
            </p>

            <div className="bg-gray-50 dark:bg-slate-800/30 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-slate-400">Requerente</span>
                <span className="font-medium">{arb.requerente?.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-slate-400">Valor</span>
                <span className="font-medium">R$ {Number(arb.valorCausa).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-slate-400">Categoria</span>
                <span className="font-medium">{arb.categoria}</span>
              </div>
              <hr />
              <div>
                <span className="text-gray-500 text-sm">Objeto</span>
                <p className="text-sm mt-1">{arb.objeto?.substring(0, 300)}</p>
              </div>
            </div>

            {/* Regras de Arbitragem selecionadas pelo requerente */}
            {convite.status === 'pendente' && (
              <div className="bg-slate-800/30 dark:bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 space-y-3">
                <p className="font-medium text-gray-800 dark:text-slate-200 text-sm mb-2">
                  Regras de arbitragem aplicaveis a este procedimento:
                </p>
                <div className="space-y-2">
                  {arb.regraLeis && (
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={aceiteLei}
                        onChange={(e) => setAceiteLei(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-500 text-primary-600 focus:ring-primary-500 bg-slate-700"
                      />
                      <span className="text-sm text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-slate-100">
                        Leis aplicaveis (normas juridicas vigentes no Brasil)
                      </span>
                    </label>
                  )}
                  {arb.regraEquidade && (
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={aceiteEquidade}
                        onChange={(e) => setAceiteEquidade(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-500 text-primary-600 focus:ring-primary-500 bg-slate-700"
                      />
                      <span className="text-sm text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-slate-100">
                        Equidade (a criterio do arbitro)
                      </span>
                    </label>
                  )}
                  {arb.regraCostumes && (
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={aceiteCostumes}
                        onChange={(e) => setAceiteCostumes(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-500 text-primary-600 focus:ring-primary-500 bg-slate-700"
                      />
                      <span className="text-sm text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-slate-100">
                        Costumes do setor (praticas comerciais)
                      </span>
                    </label>
                  )}
                </div>
                <hr className="border-slate-600/50" />
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={aceiteRegras}
                    onChange={(e) => setAceiteRegras(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-500 text-primary-600 focus:ring-primary-500 bg-slate-700"
                  />
                  <span className="text-sm font-semibold text-gray-800 dark:text-slate-100 group-hover:text-gray-900 dark:group-hover:text-white">
                    Aceito as regras de arbitragem acima e concordo com o procedimento
                  </span>
                </label>
              </div>
            )}

            {/* Info sobre arbitragem digital */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-300">
              <p className="font-medium mb-1">Sobre a arbitragem digital:</p>
              <ul className="list-disc pl-5 space-y-1 text-blue-700 dark:text-blue-400">
                <li>Procedimento 100% online via plataforma ArbitraX</li>
                <li>Conforme Lei 9.307/96 (Lei de Arbitragem)</li>
                <li>Sentenca com mesmos efeitos de decisao judicial</li>
                <li>Prazo para resposta: 5 dias uteis</li>
              </ul>
            </div>

            {/* Criar senha OU info que ja tem conta */}
            {convite.status === 'pendente' && !(convite as any).requeridoTemConta && (
              <div className="bg-slate-800/30 dark:bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 space-y-3">
                <p className="font-medium text-gray-800 dark:text-slate-200 text-sm">
                  Crie sua senha para acessar a plataforma:
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Seus dados ({arb.requerido?.nome} - {arb.requerido?.email}) ja estao cadastrados.
                </p>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Criar senha (min. 6 caracteres)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                />
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Confirmar senha"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                />
              </div>
            )}

            {convite.status === 'pendente' && (convite as any).requeridoTemConta && (
              <div className="bg-green-900/20 dark:bg-green-900/20 border border-green-700/50 rounded-lg p-4">
                <p className="font-medium text-green-700 dark:text-green-300 text-sm">
                  Voce ja tem conta na plataforma ({arb.requerido?.email})
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Ao aceitar, voce sera redirecionado para fazer login e acessar o caso.
                </p>
              </div>
            )}

            {convite.status === 'pendente' && (
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAceitar}
                  disabled={acting || !aceiteRegras || (!(convite as any).requeridoTemConta && (!senha || senha.length < 6 || senha !== confirmarSenha))}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {acting ? '...' : (convite as any).requeridoTemConta ? 'Aceitar Arbitragem' : 'Aceitar e Criar Conta'}
                </button>
                <button
                  onClick={handleRecusar}
                  disabled={acting}
                  className="flex-1 py-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition font-bold disabled:opacity-50"
                >
                  {acting ? '...' : 'Recusar'}
                </button>
              </div>
            )}

            {convite.status !== 'pendente' && (
              <div className="text-center pt-4">
                <p className="text-gray-500 dark:text-slate-400">Este convite ja foi <strong>{convite.status}</strong>.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
