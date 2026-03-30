# ArbitraX - Plano de Implementacao Faseado

> Baseado em: PRD v1.0, Especificacao Tecnica v1.0, SDD v1.0
> Deploy: Docker + Easypanel (nao Vercel/Railway/Supabase)
> Stack: NestJS + Next.js 14+ + PostgreSQL + Redis + MinIO

---

## Fase 0: Infraestrutura e Arquitetura (Dias 1-2)

### Objetivo
Setup completo do ambiente de desenvolvimento com Docker.

### Entregas
- [x] Monorepo configurado (npm workspaces)
- [x] Tipos compartilhados (@arbitrax/types)
- [ ] Docker Compose (PostgreSQL, Redis, MinIO)
- [ ] Dockerfile API (NestJS)
- [ ] Dockerfile Web (Next.js)
- [ ] Prisma schema completo (todos os models)
- [ ] Migrations iniciais
- [ ] Health check endpoints

### Criterio de Aceite
- `docker compose up` sobe todos os servicos
- `npx prisma migrate dev` roda sem erro
- `GET /api/health` retorna 200

---

## Fase 1: Autenticacao JWT + RBAC (Dias 3-4)

### Objetivo
Sistema de auth completo com JWT access/refresh tokens e controle por role.

### Entregas
- [ ] POST /api/v1/auth/register (REQUERENTE, ADVOGADO)
- [ ] POST /api/v1/auth/login
- [ ] POST /api/v1/auth/refresh
- [ ] GET /api/v1/auth/me
- [ ] Guards RBAC por endpoint
- [ ] Middleware de validacao JWT
- [ ] Paginas Next.js: Login, Registro
- [ ] Context de autenticacao no frontend

### Criterio de Aceite
- Registro cria usuario no banco
- Login retorna access + refresh token
- Refresh renova o access token
- Endpoints protegidos retornam 401 sem token
- Roles incorretas retornam 403
- Frontend faz login e persiste sessao

---

## Fase 2: CRUD de Arbitragens + State Machine (Dias 5-6)

### Objetivo
Criacao e gestao de casos de arbitragem com maquina de estados.

### Entregas
- [ ] POST /api/v1/arbitragens (criar pedido)
- [ ] GET /api/v1/arbitragens (listar do usuario)
- [ ] GET /api/v1/arbitragens/:id (detalhe)
- [ ] PATCH /api/v1/arbitragens/:id/status (transicao)
- [ ] State machine com 17 transicoes validas
- [ ] Geracao automatica de numero (ARB-YYYY-NNNNN)
- [ ] Formulario multi-step no frontend

### Criterio de Aceite
- Criar arbitragem retorna status AGUARDANDO_PAGAMENTO_REGISTRO
- Transicoes invalidas retornam erro 400
- Cada usuario so ve seus proprios casos
- Numero sequencial unico gerado

---

## Fase 3: Pecas, Provas e Documentos (Dias 7-8)

### Objetivo
Upload e gestao de pecas processuais e provas com storage MinIO.

### Entregas
- [ ] POST /api/v1/arbitragens/:id/pecas (protocolar)
- [ ] GET /api/v1/arbitragens/:id/pecas
- [ ] POST /api/v1/arbitragens/:id/provas (upload)
- [ ] GET /api/v1/arbitragens/:id/provas
- [ ] GET /api/v1/arbitragens/:id/provas/:pid/download
- [ ] Hash SHA-256 de cada documento
- [ ] Catalogacao automatica por tipo (doc, img, video, audio)
- [ ] Tela de upload no frontend com drag-and-drop

### Criterio de Aceite
- Upload de arquivo salva no MinIO com hash
- Download retorna arquivo correto
- Pecas sao append-only (nao editaveis)
- Tipos de prova categorizados automaticamente

---

## Fase 4: Prazos e Notificacoes (Dias 9-10)

### Objetivo
Controle automatico de prazos processuais com notificacoes.

### Entregas
- [ ] POST /api/v1/arbitragens/:id/prazos
- [ ] GET /api/v1/arbitragens/:id/prazos
- [ ] Cron job para verificar prazos expirando
- [ ] BullMQ job para lembretes D-3, D-1, D-0
- [ ] GET /api/v1/notificacoes
- [ ] PATCH /api/v1/notificacoes/:id/lida
- [ ] Tela de prazos no frontend

### Criterio de Aceite
- Prazo criado com status ATIVO
- Cron marca prazos como EXPIRADO quando vencem
- Notificacoes criadas nos momentos D-3, D-1, D-0
- Frontend lista prazos com contagem regressiva

---

## Fase 5: Sentenca + IA Assistida (Dias 11-12)

### Objetivo
Motor de IA para analise de provas e geracao de sentencas com revisao por arbitro.

### Entregas
- [ ] POST /api/v1/ia/analisar-provas
- [ ] POST /api/v1/ia/gerar-sentenca
- [ ] POST /api/v1/ia/refinar-sentenca
- [ ] POST /api/v1/arbitragens/:id/sentenca/aprovar
- [ ] POST /api/v1/arbitragens/:id/sentenca/sugerir
- [ ] POST /api/v1/arbitragens/:id/sentenca/ratificar
- [ ] Versionamento de sentencas (max 5 versoes)
- [ ] Painel do arbitro para revisao

### Criterio de Aceite
- IA gera projeto de sentenca com ementa, relatorio, fundamentacao, dispositivo
- Arbitro pode aprovar ou sugerir melhorias
- Sugestoes geram nova versao (max 5)
- Ratificacao gera versao final com hash e codigo verificacao

---

## Fase 6: Pagamentos - Asaas (Dias 13-14)

### Objetivo
Integracao com Asaas para cobancas (PIX, boleto, cartao).

### Entregas
- [ ] POST /api/v1/billing/cobrancas (gerar)
- [ ] GET /api/v1/billing/cobrancas (listar)
- [ ] POST /webhooks/pagamento (webhook Asaas)
- [ ] Calculo automatico de taxas por faixa de valor
- [ ] Split 50/50 taxa arbitral
- [ ] Tela de pagamentos no frontend

### Criterio de Aceite
- Cobranca gerada com QR Code PIX
- Webhook Asaas atualiza status da cobranca
- Pagamento de registro avanca caso para AGUARDANDO_ACEITE
- Tabela de custas aplicada corretamente

---

## Fase 7: Paineis Web (Dias 15-16)

### Objetivo
Dashboards para cada perfil de usuario.

### Entregas
- [ ] Dashboard Parte: casos, prazos, pagamentos
- [ ] Dashboard Arbitro: casos designados, sentencas pendentes
- [ ] Dashboard Admin: overview, gestao casos, gestao arbitros
- [ ] Dashboard Advogado: casos dos clientes, prazos
- [ ] Designacao de arbitros (admin)

### Criterio de Aceite
- Cada perfil ve apenas dados permitidos
- Admin consegue designar arbitro para caso
- Metricas calculadas corretamente
- Responsivo (mobile + desktop)

---

## Fase 8: WhatsApp Bot 1-on-1 (Dias 17-18)

### Objetivo
Integracao com Meta Cloud API para conversas individuais com partes.

### Entregas
- [ ] POST /webhooks/whatsapp (receber mensagens)
- [ ] Envio de templates (convite, lembrete, sentenca)
- [ ] Catalogacao automatica de midia
- [ ] Roteamento por telefone + arbitragem_id
- [ ] Tabela whatsapp_messages para audit trail

### Criterio de Aceite
- Bot envia convite ao requerido
- Parte envia documento e bot cataloga
- Lembretes de prazo enviados automaticamente
- Cada parte so ve sua propria conversa

---

## Fase 9: Assinatura Digital - Clicksign (Dias 19)

### Objetivo
Compromisso arbitral com assinatura digital juridicamente valida.

### Entregas
- [ ] POST /api/v1/arbitragens/:id/compromisso
- [ ] POST /webhooks/assinatura (webhook Clicksign)
- [ ] Geracao de PDF do compromisso
- [ ] Envio para assinatura de ambas partes

### Criterio de Aceite
- Compromisso gerado em PDF
- Ambas partes recebem link para assinar
- Webhook confirma assinatura
- Caso avanca apos ambos assinarem

---

## Fase 10: Testes, Integracao e Deploy (Dia 20)

### Objetivo
Testes end-to-end, integracao final e deploy para producao.

### Entregas
- [ ] Testes unitarios (state machine, calculos, RBAC)
- [ ] Testes de integracao (fluxo completo)
- [ ] Ajustes de seguranca (HMAC webhooks, rate limiting)
- [ ] Deploy via Easypanel
- [ ] Monitoramento (health checks, logs)

### Criterio de Aceite
- Fluxo completo funciona: registro -> sentenca publicada
- Todos os testes passam
- Deploy em producao operacional
- Logs e metricas funcionando
