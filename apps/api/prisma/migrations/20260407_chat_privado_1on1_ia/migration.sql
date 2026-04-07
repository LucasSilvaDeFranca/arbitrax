-- Chat 1-on-1 com IA: adicionar respondidoParaId e migrar canal 'processos' para 'privado'

-- 1. Adicionar coluna respondido_para_id ao chat_messages
ALTER TABLE "chat_messages" ADD COLUMN "respondido_para_id" TEXT;

-- 2. Alterar default da coluna canal de 'processos' para 'privado'
ALTER TABLE "chat_messages" ALTER COLUMN "canal" SET DEFAULT 'privado';

-- 3. Migrar mensagens existentes do canal 'processos' para 'privado'
UPDATE "chat_messages" SET "canal" = 'privado' WHERE "canal" = 'processos';
