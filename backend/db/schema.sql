-- ViolaHub — PostgreSQL schema (multi-user). Apply rls.sql after this.
-- Every user-owned table carries user_id and is protected by Row-Level Security
-- keyed on the session GUC `app.current_user_id` (see db/rls.sql).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    name          TEXT NOT NULL,
    city          TEXT,
    password_hash TEXT,                         -- bcrypt; null for SSO-only accounts
    role          TEXT NOT NULL DEFAULT 'student'
                      CHECK (role IN ('student', 'teacher', 'admin')),
    plan          TEXT NOT NULL DEFAULT 'Free plan'
                      CHECK (plan IN ('Free plan', 'Subscriber')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(lower(email));

CREATE TABLE IF NOT EXISTS pieces (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    subtitle    TEXT,
    source      TEXT NOT NULL DEFAULT 'upload'
                    CHECK (source IN ('community', 'pro', 'upload', 'transcription')),
    rating      SMALLINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pieces_owner_idx ON pieces(owner_id);

CREATE TABLE IF NOT EXISTS recordings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK (kind IN ('feedback', 'transcription')),
    skill       TEXT,
    lesson_id   TEXT,
    status      TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    blob_url    TEXT,
    musicxml    TEXT,                    -- transcription result (audio -> notation)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recordings_user_idx ON recordings(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_feedback (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id  UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score         SMALLINT NOT NULL,
    strengths     TEXT[] NOT NULL,
    work          TEXT[] NOT NULL,
    metrics       JSONB NOT NULL DEFAULT '{}',
    note_verdicts JSONB NOT NULL DEFAULT '[]',  -- [{noteId, kind, detail, cents?, timing_ms?}] — recolors Verovio notes
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_feedback_rec_idx ON ai_feedback(recording_id);

CREATE TABLE IF NOT EXISTS annotations (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    piece_id    UUID NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
    marks       JSONB NOT NULL DEFAULT '[]',   -- [{x,y,sym}]
    strokes     JSONB NOT NULL DEFAULT '[]',   -- [{pts}]
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, piece_id)
);

CREATE TABLE IF NOT EXISTS progress (
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id     TEXT NOT NULL,
    done          BOOLEAN NOT NULL DEFAULT false,
    completed_at  TIMESTAMPTZ,
    PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS practice_stats (
    user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    weekly_minutes INTEGER NOT NULL DEFAULT 0,
    streak_days    INTEGER NOT NULL DEFAULT 0,
    goal_minutes   INTEGER NOT NULL DEFAULT 360,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entitlements (
    user_id   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    plan      TEXT NOT NULL DEFAULT 'Free plan',
    features  JSONB NOT NULL DEFAULT '{}'      -- {courses, transcription, ai_markup, ai_feedback}
);

-- Teacher assessments — the labeled training data (technique moat). Owned by the
-- assessing teacher; `consent` gates use in model training.
CREATE TABLE IF NOT EXISTS assessments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_name  TEXT NOT NULL,
    level         TEXT,
    piece_title   TEXT,
    recording_id  UUID REFERENCES recordings(id) ON DELETE SET NULL,
    grades        JSONB NOT NULL DEFAULT '{}',   -- {Intonation:1..5, Bowing:.., Vibrato:.., ...}
    notes         TEXT,
    consent       BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assessments_teacher_idx ON assessments(teacher_id, created_at DESC);

-- Community publishing is public-readable, owner-writable (policy in rls.sql).
CREATE TABLE IF NOT EXISTS community_uploads (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    piece_id      UUID NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
    downloads     INTEGER NOT NULL DEFAULT 0,
    approved      BOOLEAN NOT NULL DEFAULT false,  -- viola-only moderation
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
