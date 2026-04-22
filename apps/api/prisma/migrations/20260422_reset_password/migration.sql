-- AlterTable: adicionar campos de recuperacao de senha
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "reset_password_token" TEXT,
  ADD COLUMN IF NOT EXISTS "reset_password_expires_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "password_changed_at" TIMESTAMPTZ;

-- Indice unico parcial (apenas onde token nao eh null)
CREATE UNIQUE INDEX IF NOT EXISTS "users_reset_password_token_key"
  ON "users"("reset_password_token")
  WHERE "reset_password_token" IS NOT NULL;
