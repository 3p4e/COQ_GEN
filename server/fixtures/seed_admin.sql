-- ===========================================================================
-- Production admin bootstrap — a SINGLE real admin user, no demo data.
-- Use this instead of seed_demo.sql for a clean production database.
-- Run AFTER db/schema.sql (or `alembic upgrade head`). Idempotent.
--
-- The password is supplied at call time and bcrypt-hashed via pgcrypto
-- (gen_salt('bf')) — it is never stored here. Pass it as a psql variable so
-- it stays out of this file and out of git:
--
--   psql ... -v ON_ERROR_STOP=1 \
--     -v admin_username=azu \
--     -v admin_email=azu.sozon@gmail.com \
--     -v admin_password='<secret>' \
--     -f server/fixtures/seed_admin.sql
-- ===========================================================================
BEGIN;

INSERT INTO app_user (username, full_name, role, email, password_hash, is_active)
VALUES (
  :'admin_username',
  'Administrator',
  'admin',
  :'admin_email',
  crypt(:'admin_password', gen_salt('bf')),
  TRUE
)
ON CONFLICT (username) DO UPDATE
   SET role          = 'admin',
       email         = EXCLUDED.email,
       password_hash = EXCLUDED.password_hash,
       is_active     = TRUE;

COMMIT;
