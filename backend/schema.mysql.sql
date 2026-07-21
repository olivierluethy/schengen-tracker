-- Schengen Tracker — MySQL port. Same shape, MySQL-native types.

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36) PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(255),
  settings      TEXT NOT NULL,
  created_at    CHAR(24) NOT NULL,
  updated_at    CHAR(24) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tokens (
  id         CHAR(36) PRIMARY KEY,
  user_id    CHAR(36) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  created_at CHAR(24) NOT NULL,
  expires_at CHAR(24) NOT NULL,
  INDEX idx_tokens_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stays (
  id         CHAR(36) PRIMARY KEY,
  owner_id   CHAR(36) NOT NULL,
  name       VARCHAR(255) NOT NULL,
  country    VARCHAR(255),
  start_date CHAR(10) NOT NULL,
  end_date   CHAR(10) NOT NULL,
  created_at CHAR(24) NOT NULL,
  updated_at CHAR(24) NOT NULL,
  deleted    TINYINT NOT NULL DEFAULT 0,
  seq        BIGINT NOT NULL,
  INDEX idx_stays_owner_seq (owner_id, seq),
  FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS partnerships (
  id            CHAR(36) PRIMARY KEY,
  from_user_id  CHAR(36) NOT NULL,
  to_email      VARCHAR(255) NOT NULL,
  to_user_id    CHAR(36),
  status        VARCHAR(16) NOT NULL,
  sharing_level VARCHAR(16) NOT NULL,
  created_at    CHAR(24) NOT NULL,
  updated_at    CHAR(24) NOT NULL,
  INDEX idx_partnerships_from (from_user_id),
  INDEX idx_partnerships_to (to_user_id),
  INDEX idx_partnerships_email (to_email),
  FOREIGN KEY (from_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
