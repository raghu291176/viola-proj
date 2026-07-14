# ViolaHub — Architecture

> Detailed **product**, **application**, and **infrastructure** architecture for ViolaHub, the viola practice companion.
> Derived from the Claude Design handoff (`ViolaHub Prototype.dc.html`, `support.js`, Modernist `_ds`).
> **Scope note:** ViolaHub is a **multi-user product** — several/many users, each with their own account, library, and progress. The current build is the client front end; §3 describes the backend it is designed to grow into.

---

## 1. Product Architecture — *what the application does*

### 1.1 Vision & users

ViolaHub is a **practice companion for violists**. It puts the tools a violist reaches for during a practice session — sheet music, metronome, tuner, drone, sight-reading, structured lessons — in one place, and layers AI on top (annotation, transcription, technique feedback).

| User | Needs |
| --- | --- |
| Student violist | Structured courses, sight-reading drills, AI feedback on playing, tuner/drone for intonation |
| Hobbyist / adult learner | Free community music, metronome/tuner, self-paced lessons |
| Advanced / pro violist | Professional sheet music (via Amazon), AI transcription, precise annotation tools |
| Community contributor | Publishes free viola-only sheet music for other users |

Two entitlement tiers, already modelled in the prototype: **Free plan** and **Subscriber**.

### 1.2 Functional modules (what each part *does*)

The application is organized into **feature modules**. This is the functional spine — everything else (state, UI, infra) serves these.

#### M1 · Home
- Personalized greeting + session context (streak, weekly time).
- **Continue practicing** — resume the last-opened piece at its progress %.
- **Quick access** to the four practice tools.
- **Recent music** list → opens the sheet viewer.
- Three interchangeable layouts (`a` continue-first, `b` poster hero, `c` modular dashboard grid) selectable per user preference.

#### M2 · Music (library & discovery)
- **Search** the user's pieces by title.
- Four sources:
  - **Community music** — free, user-published, viola-only. Browse, open, publish your own.
  - **Professional music** — paid, from publishers, purchased via **Amazon** (digital opens in-app; physical ships).
  - **AI transcription** — subscriber feature; turn any audio into sheet music.
  - **Upload your own** — import PDF/scans.
- **Recently opened** list with per-piece rating.

#### M3 · Sheet viewer & annotation
- Renders a piece as staves/measures.
- **Annotation tools:** Select, **Fingerings** (0–4), **Bowings** (up ∨ / down ∏), **Pen** (freehand stroke drawing on the staff).
- **AI markup** (subscriber) — auto-places fingering/bowing suggestions.
- **In-context tools:** metronome overlay and tuner overlay while reading.
- Undo, Save, Share, Bookmark.

#### M4 · Practice tools (real-time audio)
- **Metronome** — 30–240 BPM, time signatures (2/4…12/8…7/8), beat accent, 3 click sounds, animated beat dots. Real Web Audio ticking.
- **Tuner** — chromatic, A=440, live **microphone pitch detection** (autocorrelation), needle gauge, note name + cents + Hz.
- **Drone** — sustained reference pitch, 12 notes × 3 octaves, real oscillator.
- **Sight reading** — generate excerpts by key (30 keys), time signature, note types, plus options (shifting, double stops, treble-clef part).

#### M5 · Learn
- **Courses** (Beginner Viola, Shifting, Vibrato, Intonation …), each with lessons.
- **Lesson types:**
  - *Quiz* — multiple choice "soundcheck", marks lesson complete on correct answer.
  - *Audio* — record yourself playing an excerpt; **AI compares to the sheet music** and returns a match score + strengths + things to work on, targeted to the lesson's skill (shifting, vibrato, intonation, bow, tuning, reading).
- **My progress** — weekly time vs goal, streak, courses in progress, pieces learned.
- Courses gated behind subscription.

#### M6 · AI transcription
- Subscriber feature. Source = upload audio / paste YouTube link / record in app → produces sheet music added to the library.

#### M7 · Profile & account
- User identity, plan badge, subscribe CTA.
- Menu: My library, Downloads, Practice history, Subscription & billing, Settings, Help. (Detail screens out of prototype scope.)

#### M8 · Entitlements (cross-cutting)
- `Free` vs `Subscriber` gate on: courses, AI transcription, AI markup, AI feedback.
- Upgrade action flips the plan and unlocks features live.

### 1.3 Navigation / information architecture

```
Bottom tab bar (persistent, hidden only in full-screen Sheet viewer)
├── Home        (M1)
├── Music       (M2) ──► Browse (community|pro) ──► Sheet viewer (M3)
│                   └──► AI transcription (M6)
├── Practice    (M4) ── tabs: Metronome | Tuner | Drone | Sight reading
├── Learn       (M5) ── tabs: Courses ──► Course ──► Lesson | My progress
└── Profile     (M7) ──► Settings / billing (stubs)
```
Two-level model: a **tab** (home/music/practice/learn/profile) and an optional **sub-screen** (sheet/browse/course/lesson/trans). Sub-screens stack over their tab and are dismissible with Back.

### 1.4 Domain data model (entities)

Per-user, backend-ready (see §3 for multi-user):

- **User** — id, name, location, `plan`, preferences (home variant, A4 reference, device).
- **Piece** — id, title, movement/subtitle, source (community|pro|upload|transcription), rating, owner/publisher.
- **RecentItem** — piece ref + last-opened timestamp + progress %.
- **Annotation set** — per (user, piece): marks (symbol, x, y) and freehand strokes.
- **Course** → **Lesson** (type quiz|audio, skill, media, excerpt, target).
- **Progress** — per (user, lesson): complete flag; per user: weekly minutes, streak, goal.
- **Entitlement** — plan + feature flags.
- **CommunityUpload** — publisher, downloads, piece.

### 1.5 Scope boundaries (honest)
- **Real now (client):** all navigation, all screens, real metronome/drone/tuner audio, annotation drawing, sight-reading option UI, quiz logic, plan gating.
- **Simulated now:** AI feedback (randomized from curated banks), AI markup (random placement), transcription (timed placeholder), Amazon checkout (toast), video playback (toast).
- **Out of prototype scope:** real auth, payments, community publishing backend, actual audio→notation ML, settings/billing detail. These are §3 future services.

---

## 2. Application Architecture — *how the client is built*

### 2.1 Stack & rationale

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **React 19 + TypeScript** | Component-per-screen fits the multi-screen app; types make the store/audio contracts safe across modules and parallel authors. |
| Build/dev | **Vite 8** | Fast HMR dev server (port **5173**), simple static build. |
| State | **Zustand** | Single global store with typed slices + actions; audio engine and any screen can read/write without prop-drilling. Mirrors the prototype's one `state` object. |
| Icons | **lucide-react** | The Modernist design system specifies Lucide; matches the prototype's inline SVGs. |
| Styling | **Ported Modernist CSS** + purple theme override + atomic utilities | Design-system fidelity; no CSS-in-JS overhead. |

### 2.2 Module map (multiple modules across the project)

```
app/src/
├── main.tsx                 # entry
├── App.tsx                  # device frame + header + tab bar + screen router
├── styles/
│   ├── modernist.css        # ported design-system tokens + components (verbatim)
│   ├── theme.css            # ViolaHub purple :root override
│   └── app.css              # ViolaHub component CSS + atomic utilities + device (phone/iPad) rules
├── lib/                     # ── FOUNDATION MODULES (shared contract) ──
│   ├── types.ts             # all domain + state types
│   ├── constants.ts         # TS, SOUNDS, KEYS, NVS, NOTES, tempo names
│   ├── data.ts              # pieces, courses+lessons, community/pro lists, feedback banks
│   └── audio.ts             # Web Audio engine: metronome, drone, tuner (pitch detection)
├── store/                   # ── STATE MODULE (sliced) ──
│   ├── index.ts             # composed Zustand store + persist
│   ├── navSlice.ts          # device, tab, sub, home variant, toast
│   ├── practiceSlice.ts     # bpm/run/beat/ts/accent/sound, drone, tuner, sight-reading
│   ├── musicSlice.ts        # search, browse, piece, recent, annotations
│   ├── learnSlice.ts        # course, lesson, quiz, recording, feedback, progress
│   └── accountSlice.ts      # plan/entitlements, profile
├── components/              # ── SHARED UI MODULE ──
│   ├── Icon.tsx             # Lucide wrapper (.ic sizing)
│   ├── DeviceFrame.tsx      # phone/iPad chrome
│   ├── Header.tsx  TabBar.tsx  Toast.tsx
│   └── primitives.tsx       # Kicker, RowButton, SettingRow, Sheet helpers
└── screens/                 # ── FEATURE MODULES (one per §1.2) ──
    ├── Home.tsx             # M1 (variants a/b/c)
    ├── Music.tsx  Browse.tsx        # M2
    ├── Sheet.tsx            # M3
    ├── Practice.tsx         # M4 (Metronome/Tuner/Drone/SightReading sub-components)
    ├── Learn.tsx  Course.tsx  Lesson.tsx   # M5
    ├── Transcription.tsx    # M6
    └── Profile.tsx          # M7
```

**Ownership rule for parallel work:** foundation (`lib/`, `store/`, `components/`, `App.tsx`, styles) is the shared contract, built first. Each feature module owns **its own file(s)** under `screens/` and only *consumes* the foundation — so screen modules can be authored concurrently without file conflicts.

### 2.3 State architecture (Zustand)

One store, sliced by domain (§2.2). Shape mirrors the prototype's `state`, made typed and per-user-namespaceable:

- **navSlice:** `device`, `tab`, `sub`, `homeVariant`, `toast(msg)`.
- **practiceSlice:** `bpm, run, beat, tsIdx, accent, soundIdx` (metronome) · `droneNote, droneOct, dronePlay` · `listening, heard, cents, hz` (tuner) · `prTool` · sight-reading `srKeyIdx, srTsIdx, srNotes[], srAdd[], srNum` · menu open-state.
- **musicSlice:** `q`, `browse`, `piece`, `recentOpened[]`, `annTool, bowDir, finger, marks[], strokes[]`, `overlay`.
- **learnSlice:** `learnTab, course, lesson, checkPick, checkResult, done{}, recState, recSecs, feedback`.
- **accountSlice:** `plan` (+ derived `subbed`), profile.

Actions live beside their slice; the **audio engine calls store setters** (e.g. metronome advances `beat`, tuner writes `heard/cents/hz`). State is persisted to `localStorage` (see §3.3) so a returning user keeps preferences/library — namespaced by user id when auth lands.

### 2.4 Web Audio engine (`lib/audio.ts`)

A single module wrapping one lazily-created `AudioContext`. Ported from the prototype's `Component` audio methods, decoupled from React:

- **Metronome:** `setInterval` at `60000/bpm`; each tick schedules an oscillator click (square/sine/triangle by sound choice; accent = higher pitch) and advances the beat via callback.
- **Drone:** one sustained oscillator (`sawtooth`, gain 0.06); frequency from equal-temperament formula `220·2^((noteIndex−9)/12)·2^(oct−3)`; live-retunable.
- **Tuner:** `getUserMedia` → `AnalyserApp` → time-domain buffer → **autocorrelation pitch detector** (RMS gate, edge trim, parabolic interpolation) → MIDI/cents/Hz, throttled to ~8 fps via `requestAnimationFrame`.
- **Lifecycle:** explicit `start/stop` for each; all torn down on unmount (`clearInterval`, `cancelAnimationFrame`, stop tracks/oscillators). **Mic audio never leaves the device** (§3.5).

### 2.5 Rendering, routing & responsiveness

- **Router:** derived, not URL-based for the prototype — `screen = sub ?? tab` selects the active screen component. (Upgrade path: React Router with `/tab/sub` when deep-linking is needed for multi-user sharing.)
- **Device frame:** a `.phone` (390×800) or `.phone.ipad` (834×1194) container; iPad-specific overrides (larger type, row layouts, 4-col grids, side toolbar) come from `app.css`, matching the prototype's `.ipad` rules. Toggleable and responsive.
- **Design system:** `modernist.css` (verbatim tokens/components) → `theme.css` overrides `--color-*` to the ViolaHub **purple** (`--color-accent:#8674db` + ramp) → `app.css` adds ViolaHub components and atomic utilities (`.col .f1 .fx .ac .jb .mt8 …`). Flush-left labels, zero radius, 2px rules preserved.

### 2.6 Implementation plan (parallelized)

1. **Foundation (sequential, done first):** styles, `lib/*`, `store/*`, shared `components/*`, `App.tsx` shell. Establishes the typed contract.
2. **Feature modules (parallel agents, one per screen file):** Home · Music+Browse · Sheet · Practice · Learn+Course+Lesson · Transcription+Profile. Each consumes the store/audio/data contract; no shared file writes.
3. **Integration & verification:** wire screens into the router, `tsc` typecheck, run dev server, exercise each flow (metronome ticks, drone sounds, tuner reads mic, annotation draws, quiz/flow completes).

### 2.7 Quality, errors, performance
- **TypeScript strict** across module boundaries; `oxlint` in CI.
- Graceful mic-permission failure → toast, tuner stays idle.
- Audio nodes stopped on navigation away to avoid stuck oscillators.
- Bundle stays small (React + Zustand + lucide, no heavy notation lib yet).
- **Testing:** unit-test the pitch detector and metronome timing math; component/flow tests per feature module.

---

## 3. Infrastructure Architecture — *multi-user, runtime & deployment*

### 3.1 Current runtime (client-only prototype)
- Static SPA built by Vite; runs entirely in the browser.
- Browser APIs: **Web Audio** (metronome/drone/tuner), **getUserMedia** (mic), **localStorage** (persistence), file input (upload).
- No server required to run the prototype.

### 3.2 Deployment (client)
- Static hosting — **Vercel / Netlify / Cloudflare Pages / GitHub Pages**. `npm run build` → `app/dist/`.
- CI/CD: on push → install → `tsc -b` + `oxlint` + `vite build` → deploy preview → promote to prod.
- Dev: `npm --prefix app run dev` (configured in `.claude/launch.json`, port 5173).

### 3.3 Multi-user backend (target architecture)

Because ViolaHub serves **several/many users**, the client is designed as the front end of a multi-tenant service:

```
Client SPA ──HTTPS──► Azure API Management ──► FastAPI core
                        ├── Auth service        (accounts, sessions, OAuth)
                        ├── Library service      (pieces, uploads, recent, ratings)  ──► Azure Blob Storage (PDF/scans/audio)
                        ├── Annotation service   (per-user, per-piece marks/strokes) ──► PostgreSQL (RLS)
                        ├── Progress service      (streak, weekly time, lesson done)  ──► PostgreSQL (RLS)
                        ├── Entitlement/Billing   (Free/Subscriber, Stripe or store)
                        ├── Community service     (publish/browse free viola music, moderation)
                        ├── Commerce bridge       (Amazon purchase + digital unlock)
                        └── AI analysis pipeline  (transcription: audio→notation · feedback: playing vs score)  ── see §3.7
```

- **Data isolation:** every record keyed by `userId`; **PostgreSQL Row-Level Security (RLS)** enforces it at the database — each request sets `SET LOCAL app.current_user_id` so a session only ever sees its own rows. Store state is namespaced per user (see memory note). No shared "Emily" singleton in production.
- **Sync:** client state is a local cache; a sync layer reconciles with services on login (local-first → IndexedDB when offline support is added).
- **AI analysis pipeline** runs server-side on GPU and is **event-driven and elastically scaled** (Azure Service Bus + KEDA/AKS). The client uploads audio directly to object storage via a short-lived token and is notified of results over WebSocket/push — full flow in **§3.7**.

### 3.4 Mobile preparation
- Layout already targets phone + tablet. Wrap with **Capacitor** for iOS/Android when native mic/haptics/offline are needed; the audio engine and Web Audio port to WebViews.

### 3.5 Security & privacy
- **Microphone audio is processed locally** for the tuner and never transmitted; only recordings the user explicitly submits for AI feedback are uploaded.
- **Direct-to-storage uploads use short-lived, write-only SAS tokens** minted per request from **User Delegation Keys** (15-minute TTL, scoped to one blob) — the API never proxies large audio and long-lived storage keys never reach the client.
- **PostgreSQL RLS** is the authorization backstop: every worker/service sets the session's `app.current_user_id`, so cross-tenant reads are impossible even with a bug in application code.
- Auth over HTTPS; per-user authorization on every service; uploads virus-scanned; community uploads moderated (viola-only policy).
- Payment credentials never handled by the client — delegated to Amazon / the billing provider.

### 3.6 Observability
- Client: error boundary + telemetry (feature usage per module, audio-permission failures).
- Services: structured logs, request tracing, AI-job queue metrics, uptime/SLO dashboards.

### 3.7 AI analysis pipeline (recording → AI feedback / transcription)

This is the production design behind the features the client currently **simulates** — the "record & AI check" lessons (§1.5 M5) and AI transcription (M6). It is **asynchronous, direct-to-storage, and elastically GPU-scaled**, so a burst of end-of-practice uploads spins GPU capacity up and back down without blocking the API.

**End-to-end flow**

| # | Component | Action |
| --- | --- | --- |
| 1 | **Vite client** | User ends a practice session; the app requests an authenticated upload URI from the API gateway. |
| 2 | **APIM → FastAPI** | Validates the user session, mints a **15-minute write-only SAS token** from **User Delegation Keys**, returns it to the client. |
| 3 | **Vite client** | Uploads the raw high-fidelity **WAV** directly to **Azure Blob Storage (Premium)** using the SAS token — bypassing the API for the large payload. |
| 4 | **Vite client** | Calls `POST /api/v1/recordings/analyze` with the target file URI + metadata. |
| 5 | **FastAPI core** | Sets session context, checks the DB via **RLS**, inserts a file record `status = processing`, publishes a message to the **Azure Service Bus topic** with `SessionId = user_id`, and returns **202 Accepted**. |
| 6 | **KEDA / AKS** | KEDA sees the queue-depth spike and provisions an **AKS GPU node (NVIDIA T4)** via the scale controller. |
| 7 | **AKS worker** | **Triton Inference Server** boots the model from local cache; the worker locks the message, pulls the WAV from Blob Storage, and runs the audio through the model pipelines (pitch/intonation, rhythm, transcription). |
| 8 | **Database tier** | Worker connects to PostgreSQL, `SET LOCAL app.current_user_id = <user>`, writes the evaluation into `ai_feedback`, flips `status = completed`. |
| 9 | **WebSockets / push** | The state change reaches the client instantly via **Azure Web PubSub** (or mobile push), rendering the violist's intonation/transcription graphs. |

**Sequence**

```mermaid
sequenceDiagram
    participant C as Vite Client
    participant G as APIM / FastAPI
    participant B as Blob Storage (Premium)
    participant Q as Service Bus Topic
    participant K as KEDA / AKS GPU (Triton)
    participant D as PostgreSQL (RLS)
    participant P as Web PubSub / Push

    C->>G: 1. request upload URI (authenticated)
    G-->>C: 2. 15-min write-only SAS token (User Delegation Key)
    C->>B: 3. PUT raw WAV (direct, SAS)
    C->>G: 4. POST /recordings/analyze {fileUri, meta}
    G->>D: 5a. RLS check + insert record (status=processing)
    G->>Q: 5b. publish {SessionId=user_id}
    G-->>C: 5c. 202 Accepted
    Q-->>K: 6. queue-depth spike → provision T4 node
    K->>B: 7a. pull WAV
    K->>K: 7b. Triton inference (intonation / rhythm / transcription)
    K->>D: 8. SET LOCAL app.current_user_id; write ai_feedback; status=completed
    D-->>P: 9a. state change
    P-->>C: 9b. push graphs to client
```

**Why these choices**
- **Direct-to-blob + SAS:** keeps multi-MB WAVs off the API path; the API stays request-light and horizontally cheap. Tokens are write-only, single-blob, 15-min — minimal blast radius.
- **202 + Service Bus + KEDA:** the request returns immediately; GPU work is decoupled and **scales to zero** between bursts (cost control) while absorbing spikes (many users finishing practice at once).
- **Triton on AKS GPU (T4):** one serving layer for both the transcription and technique-feedback models; model cached on-node for fast cold-start.
- **RLS everywhere (API *and* worker):** the async worker runs outside the request context, so it re-establishes `app.current_user_id` before writing — tenant isolation holds across the whole pipeline.
- **Web PubSub / push:** users don't poll; the UI's `recState: analyzing → done` transition (already modelled in the store) is driven by a real server event.

**Client contract (replaces the current simulation).** The store's `stopRecording()` today fakes analysis with a timer; the production client instead: (1) `GET upload URI` → (2) `PUT` WAV to blob → (3) `POST /recordings/analyze` → set `recState:'analyzing'` → (4) subscribe to the user's PubSub channel → on `completed`, populate `feedback` and set `recState:'done'`. The screen UI is unchanged.

---

## 4. AI/ML — models, tiers, and the matching engine

### 4.1 Latency tiers (real-time is the default; async is the exception)

Real-time ≠ expensive GPU. Most live viola feedback is classical DSP + online alignment that runs on-device or on cheap CPU; GPU is reserved for genuinely heavy, non-interactive jobs so it can idle at zero.

| Tier | Where | Latency | Cost | Workloads |
| --- | --- | --- | --- | --- |
| **T1 · on-device** | `app/src/lib/realtime.ts` — Web Audio + tiny WASM/ONNX (CREPE-tiny) + online DTW | <50 ms | free | live intonation cue, tempo/rhythm drift vs. metronome, score-following ("you're on m.12") |
| **T2 · warm stream** | WebSocket → warm CPU/GPU pool on AKS | 100–300 ms | pay for warm capacity | live technique, short-excerpt Soundcheck returned the instant they stop |
| **T3 · async batch** | Blob → Service Bus → KEDA scale-to-zero GPU | seconds–min | ~zero idle | full-song transcription, OMR, deep post-session report |

Push everything possible into **T1** (free, instant). The tuner's autocorrelation pitch detector already runs client-side — that primitive powers live tuning/tempo cues today. The store exposes a `liveCue` selector fed by the audio graph.

### 4.2 Two-pool GPU topology (T3)

| Pool | VM / GPU | Workloads | Scaling |
| --- | --- | --- | --- |
| **Standard** | `NCas_T4_v3` (T4, 16 GB) | CREPE/pYIN pitch, librosa features, DTW + Soundcheck scoring, live technique (T2) | warm min-replicas at peak hours |
| **Heavy** | `NVadsA10_v5` (A10G) default · `NDams_A100_v4` (A100) opt-in | Basic-Pitch AMT, oemer OMR CV | scale-to-zero |

Two Service Bus topics (`analyze-standard`, `analyze-heavy`), each with its own KEDA `ScaledObject`; `POST /recordings/analyze` classifies the job and publishes to the right topic. Workers pin to a pool via `nodeSelector` + `tolerations`. A100 is opt-in per model in AML — A10G is the default heavy pool.

### 4.3 Model stack — commercial-safe, pretrained, real now

ViolaHub is a paid product, so every model is permissively licensed (no non-commercial, no AGPL). Pretrained-real-now, upgradeable to custom AML-trained models later.

| Feature | Model (license) | Tier | Real now? |
| --- | --- | --- | --- |
| Pitch / intonation | CREPE / torchcrepe (MIT); pYIN via librosa (ISC) | T1 + T3 | ✅ cents error per note |
| Onset / tempo | **librosa** onset (ISC) — *not* madmom | T1 | ✅ timing deviation ms |
| Alignment + match score | DTW via synctoolbox/librosa (MIT/ISC) | T1 online / T3 full | ✅ normalized cost → score |
| Transcription (solo) | **Basic Pitch** (Apache-2.0) → MIDI → music21 (BSD) → MusicXML | T3 | ✅ real notation |
| OMR (PDF→sheet) | **oemer** (MIT) — *not* homr/Audiveris (AGPL) | T3 | ✅ MusicXML |
| Source separation | Demucs v4 (MIT) | T3 | ✅ solo / viola-vs-piano only |
| Technique-quality backbone | PANNs / PaSST — *not* MERT (CC-BY-NC) | T2 | ⚠️ **data-gated** |
| Notation render | **Verovio** (LGPL, WASM) | client | ✅ SVG w/ note `xml:id` |

**Honesty caveat (data-gated).** Pitch/timing/note-accuracy ship now — real, no training. **Vibrato** is DSP-doable (detect 4–7 Hz FM on the f0 curve). **Bowing scratchiness / shift cleanliness** have no off-the-shelf model — they need a PANNs/PaSST head fine-tuned on a **labeled viola dataset that doesn't exist publicly**; that dataset (recordings + aligned scores + teacher labels) is the real cost/moat, not the GPUs. Product must be honest: early feedback = intonation/rhythm/notes; bowing/vibrato/shifting depth arrives as labels are collected.

### 4.4 Sheet-music matching — the teaching core

The point of a teaching app is to **point at the exact wrong note**. Three linked problems, one representation:

```
MusicXML (canonical, per piece)
   ├─► Verovio (WASM) ──► rendered staff, every note an SVG element with xml:id  (what the user sees)
   └─► music21 ──► reference events {noteId, midi, onsetBeat, durationBeats, measure} ─┐
                                                                                       ├─► DTW align ─► per-note verdict
played audio ─► CREPE pitch + librosa onset  (Basic-Pitch for double-stops) ─► perf events ─┘        │
                                                                                                     ▼
                                          {noteId → verdict} ─► recolor that exact SVG note + text feedback
```

1. **Encoding — MusicXML is canonical** (§ memory `violahub-notation`). Ground truth for pitch/onset/duration/key and, crucially, addressable note IDs.
2. **Performance → comparable events.** Reference parsed by music21 → ordered expected events. Performance estimated: single line → CREPE f0 + onset segmentation; **double stops → Basic Pitch** (polyphonic) so chords aren't collapsed. Route by what the MusicXML expects.
3. **Align + threshold.** Can't compare index-by-index (students rush/drag/add/drop). **DTW** (offline full report) / **online DTW** (real-time score-follow) maps performed↔reference and surfaces gaps (missed) and insertions (extra). Per-note verdict against a **level policy**:

| Dimension | Measure | Default threshold (by level) |
| --- | --- | --- |
| Wrong note | pitch-class+octave mismatch after alignment | exact |
| Intonation | cents deviation from expected | beginner ±30¢ · intermediate ±20¢ · advanced ±10–15¢ |
| Timing | onset error vs expected beat (tempo-normalized) | ±15–20% of a beat |
| Duration | held length vs notated | ±25% of notated |
| Missing / extra | unaligned reference / performance event | flagged |

Thresholds are a policy keyed to lesson skill + user level — not hardcoded. **Match score = 100 × (aligned notes within threshold / total reference notes)**, dimension-weighted.
4. **Point at the note.** Each verdict carries the reference `noteId`; Verovio recolors that exact SVG node (green in-tune/in-time, red sharp/flat/late/wrong) and the text says "m.2 beat 3: A4 played +24¢ sharp." Live (T1) colors the current note as they play; the deep report (T2/T3) colors the whole excerpt.

The client stores note-id→verdict maps; `lib/realtime.ts` produces them on-device for T1, and the async worker returns them for T3 — same shape, so the Sheet/Lesson UI is identical either way.

### 4.5 Where the models are hosted

Each model runs where it's cheapest while staying real — that's the whole point of the tiers.

| Model | Hosted where | Served by | Cost shape |
| --- | --- | --- | --- |
| CREPE-tiny (T1 pitch) | **In the client bundle** — `app/public/models/*.onnx`, served from **Azure Front Door / Static Web Apps** CDN | ONNX Runtime Web / WASM, in the user's browser | free (one-time download) |
| pyin / DTW / feedback scoring | AKS **T4** pool | worker container (Triton) | scale-to-zero |
| Basic Pitch, oemer, Demucs | AKS **A10G/A100** pool | worker container (Triton) | scale-to-zero |

**Server models — two hosting modes (a serving/ops choice, not a model change):**

1. **Baked into worker images (launch — what's in the repo).** Weights are fetched at *build time* (`worker/fetch_models.py`), the image is pushed to **Azure Container Registry (ACR)**, and inference runs inside the AKS worker pod. Self-contained; one artifact; KEDA scales the pods.
2. **Azure ML Managed Online Endpoints (upgrade path — `infra/aml/`).** Models are registered/versioned in the **AML Model Registry** and served behind managed endpoints; the AKS worker becomes a thin orchestrator that calls the endpoint (set `AML_*_ENDPOINT`). Gives versioning, canary/A-B, and independent scaling. Identical model math.

**Supporting:** multi-GB weights live in **Blob (Premium)** / AML datastore and are cached to node **NVMe (Blobfuse2 / init-container)** so a scaled-up pod never cold-starts on a big download. Registry/versioning = **AML**; secrets = **Key Vault**; latency/metrics = **App Insights**.

> Deploy order: `az deployment group create` (bicep) → build & push images to ACR → `kubectl apply` the `infra/k8s` manifests → (optional) `python infra/aml/register_and_deploy.py` to move models onto managed endpoints.

---

## Appendix — source of truth
- Visual + behavioral spec: `../ViolaHub Prototype.dc.html` (markup + `renderVals`/audio logic) and `../support.js` (DC runtime, atomic utilities).
- Design system: `../_ds/modernist-*/styles.css` + `readme.md` (Modernist), re-skinned purple for ViolaHub.
