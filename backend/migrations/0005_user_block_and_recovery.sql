-- Migration 0005: Controle de bloqueio de acesso do usuário para validação em 2 etapas e recuperação do autenticador

ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;
