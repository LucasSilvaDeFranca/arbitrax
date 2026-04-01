# ArbitraX - Plano de Implementacao V2 (Itens Faltantes)

> Baseado na analise spec vs implementacao (2026-04-01)
> Exclui: Asaas (pagamentos) e enforcement freemium (adiados)

---

## Fase A: Notificacao por Email (CRITICO)

### Objetivo
Usuarios precisam ser notificados fora da plataforma. Sem email, ninguem sabe que algo aconteceu.

### Entregas
- [ ] Servico de envio de email (SMTP ou API)
- [ ] Emails automaticos em eventos criticos:
  - Convite ao requerido (novo caso)
  - Prazo vencendo (D-3, D-1, D-0)
  - Sentenca gerada/aprovada/ratificada
  - Compromisso pronto para assinar
  - Caso aceito/recusado
- [ ] Template HTML dos emails com branding ArbitraX
- [ ] Configuracao via .env (SMTP_HOST, SMTP_USER, etc)

### Preciso do cliente
- Provedor de email: Resend? SendGrid? SMTP proprio? Gmail SMTP?
- Dominio de envio (ex: noreply@arbitrax.com)

---

## Fase B: Pagina de Convite ao Requerido

### Objetivo
Quando um caso e criado, o requerido precisa de uma pagina dedicada para aceitar ou recusar o convite, acessivel por link (sem login obrigatorio inicialmente).

### Entregas
- [ ] GET /api/v1/convites/:token - consultar convite (publico)
- [ ] POST /api/v1/convites/:token/aceitar - aceitar convite
- [ ] POST /api/v1/convites/:token/recusar - recusar convite
- [ ] Pagina /convite/[token] no frontend (publica)
  - Mostra resumo do caso, nome do requerente, valor
  - Botoes Aceitar / Recusar
  - Se aceitar: redireciona para registro/login
- [ ] Gerar convite automaticamente ao criar arbitragem
- [ ] Email de convite enviado ao requerido (usa Fase A)

### Preciso do cliente
- Nada, ja temos o model Convite no banco

---

## Fase C: Geracao e Download de PDFs

### Objetivo
Gerar PDFs do compromisso arbitral e da sentenca com validade juridica.

### Entregas
- [ ] Instalar pdfkit (leve, sem dependencia de browser)
- [ ] PdfService: gerar PDF do compromisso (7 clausulas + dados)
- [ ] PdfService: gerar PDF da sentenca (ementa + relatorio + fundamentacao + dispositivo + custas)
- [ ] GET /api/v1/arbitragens/:id/compromisso/pdf - download
- [ ] GET /api/v1/arbitragens/:id/sentenca/pdf - download
- [ ] PDF inclui: hash SHA-256, codigo verificacao, data, partes
- [ ] Botoes de download no frontend (compromisso + sentenca)

### Preciso do cliente
- Logo do ArbitraX em alta resolucao (PNG/SVG) para colocar no header do PDF

---

## Fase D: Verificacao Publica de Sentenca

### Objetivo
Qualquer pessoa pode verificar a autenticidade de uma sentenca pelo codigo (ex: ARB-VRF-A3X9K2).

### Entregas
- [ ] GET /api/v1/verificar/:codigo - endpoint publico (sem auth)
- [ ] Pagina /verificar no frontend (input do codigo)
- [ ] Pagina /verificar/[codigo] (resultado: valido ou invalido)
  - Mostra: numero do caso, partes, status, data, hash
  - NAO mostra: CPF, conteudo da sentenca, dados sigilosos
- [ ] QR code no PDF da sentenca apontando para /verificar/:codigo

### Preciso do cliente
- Nada

---

## Fase E: CRUD de Arbitros + Impedimento

### Objetivo
Gestao completa de arbitros pelo admin e funcionalidade de impedimento/suspeicao.

### Entregas
- [ ] POST /api/v1/admin/arbitros - cadastrar arbitro (admin)
- [ ] GET /api/v1/arbitros - listar arbitros (autenticado)
- [ ] GET /api/v1/arbitros/:id/casos - listar casos do arbitro
- [ ] POST /api/v1/arbitros/:id/impedimento - declarar impedimento
- [ ] Pagina de impedimento no frontend do arbitro
- [ ] Admin: tela de cadastro de arbitro (nome, email, OAB)
- [ ] Notificacao quando arbitro declarar impedimento

### Preciso do cliente
- Nada

---

## Fase F: 2FA para Arbitro e Admin

### Objetivo
Seguranca adicional obrigatoria para roles com poder de decisao.

### Entregas
- [ ] Instalar otplib (TOTP - Google Authenticator)
- [ ] POST /api/v1/auth/2fa/setup - gerar QR code TOTP
- [ ] POST /api/v1/auth/2fa/verify - verificar codigo
- [ ] POST /api/v1/auth/2fa/enable - ativar 2FA
- [ ] Login com 2FA: apos email/senha, pedir codigo TOTP
- [ ] Obrigatorio para ARBITRO e ADMIN no primeiro login
- [ ] Pagina de setup 2FA no frontend (/settings)

### Preciso do cliente
- Nada

---

## Fase G: IA Avancada (resumo + config admin)

### Objetivo
Completar funcionalidades de IA conforme spec.

### Entregas
- [ ] POST /api/v1/ia/resumir-caso - gerar resumo executivo
- [ ] GET /api/v1/ia/modelos - listar prompts/modelos (admin)
- [ ] PATCH /api/v1/ia/modelos/:id - atualizar prompt (admin)
- [ ] Tela admin: editor de prompts com teste
- [ ] Seed de prompts padrao (analise, sentenca, refinamento, resumo)

### Preciso do cliente
- Chave da OpenAI (OPENAI_API_KEY) configurada no Easypanel

---

## Fase H: Event Bus + Automacoes

### Objetivo
Transicoes de status disparam acoes automaticamente (criar prazos, enviar emails, gerar cobrancas, notificar).

### Entregas
- [ ] EventEmitter do NestJS para eventos internos
- [ ] Eventos: arbitragem.criada, convite.aceito, compromisso.assinado,
      peca.protocolada, sentenca.gerada, sentenca.ratificada, prazo.expirado
- [ ] Handlers automaticos:
  - arbitragem.criada → gerar convite + enviar email
  - convite.aceito → gerar compromisso + notificar
  - compromisso.assinado → abrir prazo peticao + notificar
  - peca.protocolada (contestacao) → acionar IA analise
  - sentenca.gerada → notificar arbitro
  - sentenca.ratificada → gerar PDF + enviar email partes
  - prazo.expirado → notificar + escalonar

### Preciso do cliente
- Nada

---

## Fase I: Melhorias de UI

### Objetivo
Polir a experiencia do usuario conforme spec.

### Entregas
- [ ] Landing page completa (hero, como funciona, precos, FAQ, CTA)
- [ ] Painel dedicado do advogado (casos dos clientes, prazos)
- [ ] Templates admin (editor de compromisso/sentenca com variaveis)
- [ ] Timeline visual do caso (em vez de lista de audit logs)
- [ ] Responsividade mobile completa

### Preciso do cliente
- Textos da landing page (hero, FAQ, depoimentos)
- Logo em alta resolucao
- Cores exatas da marca (se diferentes do azul atual)

---

## Ordem de Execucao

| Fase | Prioridade | Dependencia | Estimativa |
|------|-----------|-------------|------------|
| A - Email | CRITICO | Provedor de email | 2-3h |
| B - Convite Requerido | CRITICO | Fase A | 2-3h |
| C - PDFs | CRITICO | Logo (opcional) | 3-4h |
| D - Verificacao Publica | ALTO | Nada | 1-2h |
| E - CRUD Arbitros | ALTO | Nada | 2-3h |
| F - 2FA | ALTO | Nada | 2-3h |
| G - IA Avancada | MEDIO | OpenAI key | 2-3h |
| H - Event Bus | MEDIO | Fases A,B,C | 3-4h |
| I - Melhorias UI | MEDIO | Textos/logo | 4-6h |

---

## Resumo do que preciso do cliente

1. **Provedor de email** - Qual usar? (Resend, SendGrid, Gmail SMTP, outro?)
2. **Dominio de envio** - ex: noreply@arbitrax.com
3. **Logo ArbitraX** em alta resolucao (PNG/SVG) para PDFs
4. **OPENAI_API_KEY** configurada no Easypanel (para IA funcionar)
5. **Textos da landing page** - hero, FAQ, depoimentos (para Fase I)
6. **Cores da marca** - se diferentes do azul primario atual
