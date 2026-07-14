-- ViolaHub — Row-Level Security. The authorization backstop (ARCHITECTURE.md §3.3):
-- both the API (per request) and the async worker (per job) run
--   SELECT set_config('app.current_user_id', <uuid>, true);
-- so every connection only ever sees its own rows, even if application code has a bug.
--
-- Run as the schema owner. The application should connect as a NON-superuser,
-- non-owner role (RLS is bypassed for superusers and table owners).

-- Helper: the current tenant from the session GUC.
CREATE OR REPLACE FUNCTION app_current_user() RETURNS UUID
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

-- Owner-scoped tables: a row is visible/writable iff its user_id is the caller.
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'recordings', 'ai_feedback', 'annotations', 'progress',
        'practice_stats', 'entitlements'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
        EXECUTE format($f$
            CREATE POLICY %1$s_owner ON %1$I
            USING (user_id = app_current_user())
            WITH CHECK (user_id = app_current_user());
        $f$, t);
    END LOOP;
END $$;

-- users: a caller sees only their own record.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_self ON users
    USING (id = app_current_user())
    WITH CHECK (id = app_current_user());

-- pieces: owner-scoped writes; owner-scoped reads (community reads go through
-- community_uploads below).
ALTER TABLE pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE pieces FORCE ROW LEVEL SECURITY;
CREATE POLICY pieces_owner ON pieces
    USING (owner_id = app_current_user())
    WITH CHECK (owner_id = app_current_user());

-- community_uploads: APPROVED rows are readable by everyone (public library);
-- only the publisher may insert/update/delete their own.
ALTER TABLE community_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_uploads FORCE ROW LEVEL SECURITY;
CREATE POLICY community_read ON community_uploads
    FOR SELECT USING (approved OR publisher_id = app_current_user());
CREATE POLICY community_write ON community_uploads
    FOR ALL USING (publisher_id = app_current_user())
    WITH CHECK (publisher_id = app_current_user());
