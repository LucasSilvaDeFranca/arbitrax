# ArbitraX

**A justica do futuro, hoje!**

Plataforma de arbitragem virtual 100% digital com IA assistida, chat interno e modelo freemium. Resolucao de conflitos de R$ 5.000 a R$ 1.000.000 em 15 a 45 dias, com validade juridica garantida pela Lei 9.307/96.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 14 + Tailwind CSS |
| Backend | NestJS + Prisma ORM |
| Banco de Dados | PostgreSQL (Supabase) |
| IA | OpenAI GPT-4o |
| Assinatura Digital | ZapSign (ou aceite interno) |
| Deploy | Docker + Easypanel |

## Arquitetura

```
arbitrax/
├── apps/
│   ├── api/          # NestJS Backend (14 modules)
│   └── web/          # Next.js Frontend (14 paginas)
├── packages/
│   ├── types/        # Enums e DTOs compartilhados
│   └── validators/   # Zod validators
├── Dockerfile.front  # Deploy frontend (Easypanel)
├── Dockerfile.back   # Deploy backend (Easypanel)
└── docker-compose.yml
```

## Modules do Backend

| Module | Funcionalidade |
|--------|---------------|
| **Auth** | JWT access/refresh tokens, registro, login, RBAC |
| **Arbitragens** | CRUD + State Machine (17 transicoes) |
| **Pecas** | Protocolo de peticoes e contestacoes |
| **Provas** | Upload com hash SHA-256, deteccao automatica de tipo |
| **Prazos** | Controle automatico D-3/D-1/D-0 com cron |
| **Notificacoes** | Sistema de notificacoes com marcar lida |
| **Sentenca** | IA gera projeto, arbitro aprova/sugere/ratifica (max 5 versoes) |
| **Chat** | Chat interno por caso (substitui WhatsApp) |
| **Compromisso** | Termo de Compromisso Arbitral + assinatura digital |
| **Planos** | Freemium / Basic / Plus / Pro |
| **Admin** | Dashboard com KPIs, gestao de casos e arbitros |
| **Storage** | Upload S3/MinIO com fallback local |
| **IA** | OpenAI GPT-4o: analise de provas + geracao de sentenca |

## Paginas do Frontend

| Pagina | Descricao |
|--------|-----------|
| `/` | Landing page |
| `/login` | Login |
| `/register` | Cadastro (Requerente/Advogado) |
| `/dashboard` | Dashboard com KPIs e casos recentes |
| `/admin` | Painel admin (overview, casos, arbitros) |
| `/arbitragens` | Lista de arbitragens |
| `/arbitragens/nova` | Formulario multi-step (3 etapas) |
| `/arbitragens/[id]` | Detalhe do caso |
| `/arbitragens/[id]/chat` | Chat interno do caso |
| `/arbitragens/[id]/documentos` | Pecas e provas (upload drag-and-drop) |
| `/arbitragens/[id]/sentenca` | Painel do arbitro (aprovar/sugerir/ratificar) |
| `/arbitragens/[id]/compromisso` | Assinatura do compromisso arbitral |
| `/notificacoes` | Central de notificacoes |

## Modelo de Negocio

| Motor | Descricao |
|-------|-----------|
| **Freemium** | 1 arbitragem/mes gratis ate R$ 5.000 |
| **Pay-per-case** | R$ 49 (ate 20k), R$ 99 (ate 50k), R$ 199 (ate 100k) |
| **Assinatura** | Basic R$ 49, Plus R$ 199, Pro R$ 499 |
| **Marketplace** | 20% comissao sobre arbitros/peritos premium |

## Roles (RBAC)

| Role | Acesso |
|------|--------|
| **Requerente** | Criar caso, enviar pecas/provas, chat, assinar compromisso |
| **Requerido** | Aceitar convite, contestar, enviar provas, chat |
| **Advogado** | Acompanhar casos, peticionar, gerenciar prazos |
| **Arbitro** | Revisar caso, aprovar/sugerir/ratificar sentenca (100% web) |
| **Admin** | Tudo + designar arbitros, config IA, dashboard |

## Setup Local

```bash
# Clonar
git clone https://github.com/LucasSilvaDeFranca/arbitrax.git
cd arbitrax

# Instalar dependencias
npm install

# Configurar variaveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Gerar Prisma client
npx prisma generate --schema=apps/api/prisma/schema.prisma

# Rodar backend
npm run dev:api

# Rodar frontend (outro terminal)
npm run dev:web
```

## Deploy (Easypanel)

| Servico | Dockerfile | Porta |
|---------|-----------|-------|
| arbitrax-front | `Dockerfile.front` | 80 |
| arbitrax-back | `Dockerfile.back` | 80 |

### Variaveis de ambiente (back)

```
DATABASE_URL=postgresql://...supabase pooler...
DIRECT_URL=postgresql://...supabase direct...
JWT_ACCESS_SECRET=sua-chave-secreta
JWT_REFRESH_SECRET=sua-chave-secreta
APP_URL=https://seu-frontend.easypanel.host
NODE_ENV=production
PORT=80
OPENAI_API_KEY=sua-key-openai
```

### Variaveis de ambiente (front)

```
NEXT_PUBLIC_API_URL=https://seu-backend.easypanel.host
```

## Testes

```bash
cd apps/api
npx jest
```

53 testes unitarios cobrindo:
- State Machine (17 transicoes validas + invalidas)
- AuthService (registro, login, duplicados, senha, inativo)
- RolesGuard (RBAC por endpoint)

## Seguranca

- JWT com access (15min) + refresh (7d)
- Rate limiting: 60 req/min por IP
- Helmet (headers HTTP)
- CORS restrito
- Hash SHA-256 em todos os documentos
- Append-only: pecas e provas nao editaveis
- Audit log de todas as acoes
- Swagger desabilitado em producao

## Conformidade Legal

- **Lei 9.307/96** - Lei de Arbitragem
- **Lei 14.063/2020** - Assinatura Eletronica
- **LGPD** - Protecao de Dados

---

Desenvolvido com NestJS + Next.js + Prisma + OpenAI
