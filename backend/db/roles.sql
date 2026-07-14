-- Non-owner application role. RLS is BYPASSED for table owners/superusers, so the
-- API/worker must connect as a role that owns nothing and lacks BYPASSRLS. Run
-- this as the schema owner (the Postgres admin) AFTER schema.sql + rls.sql.
--
--   psql "$ADMIN_URL" -v app_pw="'<appPassword>'" -f roles.sql

CREATE ROLE violahub_app WITH LOGIN PASSWORD :app_pw;

GRANT USAGE ON SCHEMA public TO violahub_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO violahub_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO violahub_app;   -- incl. SECURITY DEFINER auth fns

-- Future tables/functions created by the owner are granted automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO violahub_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO violahub_app;

-- Belt-and-suspenders: this role must never bypass RLS.
ALTER ROLE violahub_app NOBYPASSRLS;
