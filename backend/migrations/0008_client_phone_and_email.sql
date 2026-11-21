-- Migration 0008: Telefone de contato e e-mail estruturados para clientes tomadores

ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
