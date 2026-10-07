CREATE SCHEMA IF NOT EXISTS patrimonio;
CREATE TABLE IF NOT EXISTS patrimonio.companies (
 id text PRIMARY KEY, name text NOT NULL, logo_url text NOT NULL DEFAULT '',
 primary_color text NOT NULL DEFAULT '#005b5b', background_color text NOT NULL DEFAULT '#f5f5f5', accent_color text NOT NULL DEFAULT '#f4a90d',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS patrimonio.users (
 company_id text NOT NULL REFERENCES patrimonio.companies(id), id text NOT NULL,
 name text NOT NULL, email text NOT NULL CHECK(email=lower(trim(email))), password_hash text NOT NULL,
 role text NOT NULL CHECK(role IN ('Gestor','Corretor')), active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(company_id,id), UNIQUE(company_id,email)
);
CREATE TABLE IF NOT EXISTS patrimonio.developers (
 company_id text NOT NULL REFERENCES patrimonio.companies(id), id text NOT NULL, name text NOT NULL, contact text NOT NULL,
 PRIMARY KEY(company_id,id)
);
CREATE TABLE IF NOT EXISTS patrimonio.products (
 company_id text NOT NULL, id text NOT NULL, developer_id text NOT NULL, name text NOT NULL, location text NOT NULL,
 description text NOT NULL DEFAULT '', map_url text NOT NULL DEFAULT '', launch boolean NOT NULL, construction boolean NOT NULL, active boolean NOT NULL,
 commission_percent numeric(9,6) NOT NULL CHECK(commission_percent BETWEEN 0 AND 100), payment_day integer NOT NULL CHECK(payment_day BETWEEN 1 AND 31),
 PRIMARY KEY(company_id,id), FOREIGN KEY(company_id,developer_id) REFERENCES patrimonio.developers(company_id,id)
);
CREATE TABLE IF NOT EXISTS patrimonio.product_conditions (
 company_id text NOT NULL, product_id text NOT NULL, id text NOT NULL,
 entry_mode text NOT NULL CHECK(entry_mode IN ('none','with')), entry_installments integer NOT NULL,
 commission_mode text NOT NULL CHECK(commission_mode IN ('entry','fixed')), commission_installments integer NOT NULL CHECK(commission_installments BETWEEN 1 AND 120),
 PRIMARY KEY(company_id,product_id,id), UNIQUE(company_id,product_id,entry_mode,entry_installments) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(company_id,product_id) REFERENCES patrimonio.products(company_id,id) ON DELETE CASCADE,
 CHECK((entry_mode='none' AND entry_installments=0 AND commission_mode='fixed') OR (entry_mode='with' AND entry_installments BETWEEN 1 AND 120)),
 CHECK(commission_mode<>'entry' OR commission_installments=entry_installments)
);
CREATE TABLE IF NOT EXISTS patrimonio.product_photos (
 company_id text NOT NULL, product_id text NOT NULL, position integer NOT NULL CHECK(position BETWEEN 0 AND 4), data_url text NOT NULL,
 PRIMARY KEY(company_id,product_id,position), FOREIGN KEY(company_id,product_id) REFERENCES patrimonio.products(company_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS patrimonio.lands (
 company_id text NOT NULL, id text NOT NULL, neighborhood text NOT NULL, block text NOT NULL, lot text NOT NULL, duplicate_key text NOT NULL,
 area numeric(16,4) NOT NULL CHECK(area>0), condition text NOT NULL CHECK(condition IN ('Ágio','Quitado')),
 price numeric(16,2), premium numeric(16,2), balance numeric(16,2), balance_date date,
 owner text NOT NULL, contact text NOT NULL, address text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
 payment_terms text NOT NULL DEFAULT '', payment_options text[] NOT NULL DEFAULT '{}', broker_id text NOT NULL,
 availability text NOT NULL CHECK(availability IN ('Disponível','Reservado','Vendido','Inativo')),
 PRIMARY KEY(company_id,id), UNIQUE(company_id,duplicate_key), FOREIGN KEY(company_id,broker_id) REFERENCES patrimonio.users(company_id,id),
 CHECK(price IS NULL OR price>0), CHECK(premium IS NULL OR premium>=0), CHECK(balance IS NULL OR balance>=0),
 CHECK((condition='Quitado' AND price IS NOT NULL) OR (condition='Ágio' AND premium IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS patrimonio.land_photos (
 company_id text NOT NULL, land_id text NOT NULL, position integer NOT NULL CHECK(position BETWEEN 0 AND 4), data_url text NOT NULL,
 PRIMARY KEY(company_id,land_id,position), FOREIGN KEY(company_id,land_id) REFERENCES patrimonio.lands(company_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS patrimonio.sales (
 company_id text NOT NULL, id text NOT NULL, client text NOT NULL, contact text NOT NULL,
 product_id text NOT NULL, product_name text NOT NULL, developer_id text NOT NULL, broker_id text NOT NULL,
 block text NOT NULL, lot text NOT NULL, sale_date date NOT NULL, value numeric(16,2) NOT NULL CHECK(value>0),
 contract text NOT NULL CHECK(contract IN ('Aguardando assinatura','Assinado')), signed_at date,
 lead_source text NOT NULL CHECK(lead_source IN ('Indicação','Marketplace','Disparo em massa','Tráfego pago','TikTok','Base de contatos')),
 option_id text NOT NULL, entry_mode text NOT NULL CHECK(entry_mode IN ('with','none')), entry_installments integer NOT NULL,
 commission_mode text NOT NULL CHECK(commission_mode IN ('entry','fixed')), commission_installments integer NOT NULL CHECK(commission_installments BETWEEN 1 AND 120),
 commission_percent numeric(9,6) NOT NULL CHECK(commission_percent BETWEEN 0 AND 100), payment_day integer NOT NULL CHECK(payment_day BETWEEN 1 AND 31),
 initial numeric(16,2) NOT NULL CHECK(initial>=0), initial_due date, paid_at date, notes text NOT NULL DEFAULT '',
 status text NOT NULL CHECK(status IN ('Em andamento','Concluída','Cancelada')), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(company_id,id), FOREIGN KEY(company_id,product_id) REFERENCES patrimonio.products(company_id,id),
 FOREIGN KEY(company_id,developer_id) REFERENCES patrimonio.developers(company_id,id), FOREIGN KEY(company_id,broker_id) REFERENCES patrimonio.users(company_id,id),
 CHECK(contract<>'Assinado' OR signed_at IS NOT NULL),
 CHECK((entry_mode='none' AND entry_installments=0 AND initial=0 AND initial_due IS NULL AND commission_mode='fixed') OR (entry_mode='with' AND entry_installments BETWEEN 1 AND 120 AND initial>0 AND initial_due IS NOT NULL)),
 CHECK(commission_mode<>'entry' OR commission_installments=entry_installments)
);
CREATE TABLE IF NOT EXISTS patrimonio.entry_installments (
 company_id text NOT NULL, id text NOT NULL, sale_id text NOT NULL, number integer NOT NULL CHECK(number>0),
 amount numeric(16,2) NOT NULL CHECK(amount>0), due date NOT NULL, paid_at date,
 PRIMARY KEY(company_id,id), UNIQUE(company_id,sale_id,number), FOREIGN KEY(company_id,sale_id) REFERENCES patrimonio.sales(company_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS patrimonio.commission_installments (
 company_id text NOT NULL, id text NOT NULL, sale_id text NOT NULL, number integer NOT NULL CHECK(number>0),
 amount numeric(16,2) NOT NULL CHECK(amount>=0), due date NOT NULL, received numeric(16,2) NOT NULL DEFAULT 0 CHECK(received>=0 AND received<=amount), received_at date,
 PRIMARY KEY(company_id,id), UNIQUE(company_id,sale_id,number), FOREIGN KEY(company_id,sale_id) REFERENCES patrimonio.sales(company_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS patrimonio.goals (
 company_id text NOT NULL REFERENCES patrimonio.companies(id), type text NOT NULL CHECK(type IN ('month','year')), period text NOT NULL,
 individual numeric(16,2) NOT NULL CHECK(individual>0), team numeric(16,2) NOT NULL CHECK(team>0), updated_at timestamptz NOT NULL, updated_by text NOT NULL,
 PRIMARY KEY(company_id,type,period), FOREIGN KEY(company_id,updated_by) REFERENCES patrimonio.users(company_id,id),
 CHECK((type='month' AND period ~ '^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])$') OR (type='year' AND period ~ '^(20[0-9]{2}|2100)$'))
);
CREATE TABLE IF NOT EXISTS patrimonio.invitations (
 company_id text NOT NULL, id text NOT NULL, email text NOT NULL CHECK(email=lower(trim(email))), role text NOT NULL CHECK(role IN ('Gestor','Corretor')),
 token_hash text NOT NULL, created_at timestamptz NOT NULL, created_by text NOT NULL, created_by_name text NOT NULL,
 expires_at timestamptz NOT NULL, used_at timestamptz, revoked_at timestamptz,
 PRIMARY KEY(company_id,id), UNIQUE(company_id,token_hash), FOREIGN KEY(company_id,created_by) REFERENCES patrimonio.users(company_id,id)
);
CREATE TABLE IF NOT EXISTS patrimonio.sessions (
 company_id text NOT NULL, token_hash text NOT NULL, user_id text NOT NULL, expires_at timestamptz NOT NULL,
 PRIMARY KEY(company_id,token_hash), FOREIGN KEY(company_id,user_id) REFERENCES patrimonio.users(company_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS patrimonio.login_attempts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, company_id text NOT NULL REFERENCES patrimonio.companies(id), email text NOT NULL, ip text NOT NULL, attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS patrimonio.password_resets (
 company_id text NOT NULL, token_hash text NOT NULL, user_id text NOT NULL, email text NOT NULL, password_hash text NOT NULL, expires_at timestamptz NOT NULL,
 PRIMARY KEY(company_id,token_hash), FOREIGN KEY(company_id,user_id) REFERENCES patrimonio.users(company_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS patrimonio.reset_requests (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, company_id text NOT NULL REFERENCES patrimonio.companies(id), email_key text NOT NULL, ip_key text NOT NULL, requested_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS patrimonio.admin_recoveries (
 company_id text NOT NULL REFERENCES patrimonio.companies(id), request_hash text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(company_id,request_hash)
);
CREATE TABLE IF NOT EXISTS patrimonio.audit_events (
 company_id text NOT NULL, id text NOT NULL, at timestamptz NOT NULL, author text NOT NULL, author_id text NOT NULL, action text NOT NULL, details text NOT NULL DEFAULT '',
 PRIMARY KEY(company_id,id), FOREIGN KEY(company_id,author_id) REFERENCES patrimonio.users(company_id,id)
);
CREATE TABLE IF NOT EXISTS patrimonio.land_history (
 company_id text NOT NULL, id text NOT NULL, land_id text NOT NULL, at timestamptz NOT NULL, author text NOT NULL, author_id text NOT NULL, action text NOT NULL, details text NOT NULL DEFAULT '',
 PRIMARY KEY(company_id,id), FOREIGN KEY(company_id,land_id) REFERENCES patrimonio.lands(company_id,id) ON DELETE CASCADE, FOREIGN KEY(company_id,author_id) REFERENCES patrimonio.users(company_id,id)
);
CREATE TABLE IF NOT EXISTS patrimonio.sale_history (
 company_id text NOT NULL, id text NOT NULL, sale_id text NOT NULL, at timestamptz NOT NULL, author text NOT NULL, author_id text NOT NULL, action text NOT NULL, details text NOT NULL DEFAULT '',
 PRIMARY KEY(company_id,id), FOREIGN KEY(company_id,sale_id) REFERENCES patrimonio.sales(company_id,id) ON DELETE CASCADE, FOREIGN KEY(company_id,author_id) REFERENCES patrimonio.users(company_id,id)
);
CREATE TABLE IF NOT EXISTS patrimonio.commission_history (
 company_id text NOT NULL, id text NOT NULL, commission_id text NOT NULL, at timestamptz NOT NULL, author text NOT NULL, author_id text NOT NULL, action text NOT NULL, details text NOT NULL DEFAULT '',
 PRIMARY KEY(company_id,id), FOREIGN KEY(company_id,commission_id) REFERENCES patrimonio.commission_installments(company_id,id) ON DELETE CASCADE, FOREIGN KEY(company_id,author_id) REFERENCES patrimonio.users(company_id,id)
);
CREATE INDEX IF NOT EXISTS sales_broker_date ON patrimonio.sales(company_id,broker_id,sale_date);
CREATE INDEX IF NOT EXISTS sales_date ON patrimonio.sales(company_id,sale_date);
CREATE INDEX IF NOT EXISTS sales_product ON patrimonio.sales(company_id,product_id);
CREATE INDEX IF NOT EXISTS lands_broker ON patrimonio.lands(company_id,broker_id);
CREATE INDEX IF NOT EXISTS commissions_due ON patrimonio.commission_installments(company_id,due);
CREATE INDEX IF NOT EXISTS entries_due ON patrimonio.entry_installments(company_id,due);
CREATE INDEX IF NOT EXISTS sessions_user ON patrimonio.sessions(company_id,user_id);
CREATE INDEX IF NOT EXISTS attempts_email_time ON patrimonio.login_attempts(company_id,email,attempted_at);
CREATE INDEX IF NOT EXISTS attempts_ip_time ON patrimonio.login_attempts(company_id,ip,attempted_at);
CREATE INDEX IF NOT EXISTS reset_requests_time ON patrimonio.reset_requests(company_id,requested_at);
CREATE INDEX IF NOT EXISTS audit_time ON patrimonio.audit_events(company_id,at);
CREATE INDEX IF NOT EXISTS products_developer ON patrimonio.products(company_id,developer_id);
CREATE INDEX IF NOT EXISTS sales_developer ON patrimonio.sales(company_id,developer_id);
CREATE INDEX IF NOT EXISTS invitations_email ON patrimonio.invitations(company_id,email);
CREATE INDEX IF NOT EXISTS sessions_expiry ON patrimonio.sessions(company_id,expires_at);
CREATE INDEX IF NOT EXISTS resets_user ON patrimonio.password_resets(company_id,user_id);
CREATE INDEX IF NOT EXISTS land_history_parent ON patrimonio.land_history(company_id,land_id,at DESC);
CREATE INDEX IF NOT EXISTS sale_history_parent ON patrimonio.sale_history(company_id,sale_id,at DESC);
CREATE INDEX IF NOT EXISTS commission_history_parent ON patrimonio.commission_history(company_id,commission_id,at DESC);

-- Version 3: additive profile fields; existing accounts and business records are preserved.
ALTER TABLE patrimonio.users ADD COLUMN IF NOT EXISTS cpf text NOT NULL DEFAULT '' CHECK(cpf='' OR cpf ~ '^[0-9]{11}$');
ALTER TABLE patrimonio.users ADD COLUMN IF NOT EXISTS creci text NOT NULL DEFAULT '' CHECK(length(creci)<=40);
ALTER TABLE patrimonio.users ADD COLUMN IF NOT EXISTS photo_data_url text NOT NULL DEFAULT '' CHECK(length(photo_data_url)<=200000);

ALTER TABLE patrimonio.companies ADD COLUMN IF NOT EXISTS favicon_url text NOT NULL DEFAULT '';
ALTER TABLE patrimonio.companies ADD COLUMN IF NOT EXISTS tagline text NOT NULL DEFAULT '';
