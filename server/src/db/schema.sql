-- Pura Suerte: esquema de base de datos (PostgreSQL)
-- Las monedas son virtuales y no tienen valor monetario.

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  google_sub    TEXT UNIQUE,
  birth_date    DATE NOT NULL,
  balance       BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  daily_spend_limit_cents INTEGER,          -- límite de compra diario elegido por el jugador
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Libro contable: cada movimiento de monedas queda registrado y es inmutable.
CREATE TABLE IF NOT EXISTS ledger (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  delta       BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  reason      TEXT NOT NULL,                -- welcome, bet, win, daily_wheel, ad_reward, gift, purchase
  game        TEXT,
  ref         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_user_time ON ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ledger_user_reason ON ledger(user_id, reason, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Enlaces mágicos para entrar con correo.
CREATE TABLE IF NOT EXISTS email_tokens (
  token       TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  display_name TEXT,
  birth_date  DATE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT false
);

-- Estado de giros gratis del slot por jugador.
CREATE TABLE IF NOT EXISTS slot_state (
  user_id     BIGINT NOT NULL REFERENCES users(id),
  game        TEXT NOT NULL,
  free_spins  INTEGER NOT NULL DEFAULT 0,
  free_bet    BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, game)
);

-- Rondas de Cohete (modo individual). El punto de explosión vive solo en el servidor.
CREATE TABLE IF NOT EXISTS crash_rounds (
  id          TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  bet         BIGINT NOT NULL,
  auto_cashout NUMERIC(10,2),
  crash_point NUMERIC(12,2) NOT NULL,
  server_seed TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status      TEXT NOT NULL DEFAULT 'flying', -- flying, cashed, crashed
  cashout_at  NUMERIC(12,2),
  payout      BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS crash_user_status ON crash_rounds(user_id, status);

CREATE TABLE IF NOT EXISTS purchases (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  pack_id     TEXT NOT NULL,
  coins       BIGINT NOT NULL,
  price_cents INTEGER NOT NULL,
  status      TEXT NOT NULL,               -- pending, paid
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
