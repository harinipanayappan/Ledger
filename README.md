# Ledger — Smart Market Watchlist

A watchlist that answers one question: **what has meaningfully changed since I last checked** — not since the market opened, not since the last refresh, since *your* last actual view of that instrument.

Built for a 72-hour hackathon. Full stack, runs locally, no real exchange access — market data is simulated.

---

## 100-word pitch

Every watchlist shows you a price. None of them tell you whether that price actually *means* anything to you personally. Ledger tracks, per user and per instrument, the price you last actually looked at — then re-evaluates every move against that instrument's own normal volatility, not a flat percentage. A ₹20 move on a calm stock is a big deal; the same ₹20 move on a naturally jumpy one is noise. Ledger flags only the moves that clear that bar, shows you exactly why (the z-score, the delta), and never hides a stale price behind a confident-looking number.

---

## Tech stack

- **Frontend**: React + Vite, Tailwind CSS v4, TanStack Query, Socket.IO client
- **Backend**: Node.js + Express, Socket.IO server, JWT auth
- **Data**: PostgreSQL (source of truth — users, watchlists, snapshots), Redis (hot path only — latest price cache + tick pub/sub)
- **Market data**: a simulated tick generator (no real exchange access)

---

## Setup & run

### Prerequisites
- Node.js 18+
- PostgreSQL running locally (or reachable)
- Redis running locally (or reachable)

### 1. Database

```bash
createuser watchlist_user --pwprompt   # set password: watchlist_pass (or update .env below)
createdb smart_watchlist -O watchlist_user
```

(Or point `DATABASE_URL` at any Postgres instance you already have.)

### 2. Backend

```bash
cd backend
cp .env.example .env        # edit DATABASE_URL / REDIS_URL if yours differ
npm install
npm run migrate             # creates tables
npm run seed                # seeds 18 mock instruments with baseline volatility
npm run start                # starts the API + Socket.IO server on :4000
```

In a **second terminal**, start the simulated market feed (separate process, matching how a real ingest pipeline would be deployed):

```bash
cd backend
npm run tick-generator       # publishes ticks to Redis every 400ms
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env         # points at http://localhost:4000/api by default
npm install
npm run dev                  # http://localhost:5173
```

Open `http://localhost:5173`, register an account, create a watchlist, and add a few instruments. Prices will start moving within a second; give it 15-30 seconds and watch a "notable move" or "big move" badge appear on whichever instrument has actually drifted meaningfully since you added it.

**Demo tip:** the header has a "Simulate feed outage" button. Click it, wait ~10 seconds, and every price in view will pick up a "delayed" badge instead of silently going stale.

---

## The change-detection formula, in plain language

Most watchlists ask "did the price move by more than X%?" — the same X for every stock. That's a bad question, because a ₹4,200 semiconductor stock and a ₹350 minerals stock don't move by the same amount on a normal day.

Instead, Ledger asks: **"is this move big relative to how much this specific instrument normally jumps around?"**

1. Each instrument starts with a synthetic **baseline volatility** (seeded at setup — see `backend/scripts/seed.js`), representing its typical price swing per tick.
2. As real (simulated) ticks arrive, Ledger keeps a **rolling estimate** of that volatility using an exponentially-weighted moving average of squared price changes, so the "normal" bar can drift over the session instead of being frozen forever at the seed value.
3. When you view a watchlist, Ledger compares the current price to **your personal last-seen price** for that instrument (stored in Postgres, updated only when you actually view it — never on a background poll or tick).
4. It computes a z-score: `z = |current_price − your_last_seen_price| / rolling_volatility`.
5. If `z ≥ 1.5` (configurable via `SIGNIFICANCE_Z_SCORE`), the move is flagged as meaningful, and the UI shows the delta, the percentage, and (on hover) the z-score itself — never a silent "trust me" flag.

This is implemented in `backend/src/services/changeDetection.js` (the formula) and `backend/src/services/volatility.js` (the rolling estimate).

---

## Built vs. Documented

**Actually implemented:**
- JWT auth (register/login), full watchlist CRUD, add/remove instruments
- Simulated tick generator as its own process, publishing to Redis pub/sub, with realistic random-walk movement plus ~5% deliberate spikes
- Per-user, per-instrument last-seen snapshot in Postgres, updated only on `POST /watchlists/:id/view`
- Volatility-relative (z-score) change detection against a rolling, EWMA-estimated volatility seeded from a synthetic baseline
- Debouncing (750ms window, last-value-wins) on the live "changed" push so rapid ticks don't flicker
- Idempotent tick processing via per-instrument monotonic `sequence_number` dedup
- Staleness flagging: any cached price older than `STALE_THRESHOLD_MS` (default 10s) is marked `stale: true` and the UI shows a "delayed" badge instead of a silently-frozen number
- A deliberate kill switch (`POST /api/admin/feed/kill` / `/resume`, also a UI button) to demo the feed-outage failure mode on demand
- Single BFF read endpoint (`GET /api/watchlists/:id`) returning everything the screen needs — price, staleness, diff — in one call
- Socket.IO per-user rooms pushing coalesced change events; on reconnect the client re-fetches full state rather than expecting a replayed backlog

**Documented as a future scaling path, not built:**
- **Kafka**: the Redis pub/sub tick channel stands in for a real message bus. Swapping it is a transport-layer config change in `tickConsumer.js` and `tickGenerator.js`, not a rewrite — both already treat "publish a tick" / "consume a tick" as the only contract.
- **DB sharding / read replicas**: at hackathon scale a single Postgres instance is fine. The natural shard key would be `user_id` for snapshots and `watchlist_id` for items; read replicas would serve the `GET /api/watchlists/:id` read path once it's under real load.
- **OAuth / 2FA / biometric auth**: intentionally out of scope; JWT-only for this build.
- **Buy/sell execution flow**: this is a watchlist, not a broker — no order routing exists or is planned here.
- **GraphQL layer, sparkline charts, "why it changed" tagging beyond the current `reason` field**: noted as nice-to-haves if time allowed; the REST BFF endpoint and the `reason: "threshold_crossed" | "large_move"` field cover the MVP of both.

---

## Environment variables

See `backend/.env.example` and `frontend/.env.example`. Key tunables:

| Variable | Purpose | Default |
|---|---|---|
| `SIGNIFICANCE_Z_SCORE` | How many standard deviations a move must clear to be flagged | `1.5` |
| `STALE_THRESHOLD_MS` | How old a cached price can get before it's marked stale | `10000` |
| `DEBOUNCE_WINDOW_MS` | Window for coalescing rapid ticks before pushing a change event | `750` |
| `TICK_INTERVAL_MS` | How often the simulated feed emits a tick per instrument | `400` |
| `SPIKE_PROBABILITY` | Fraction of ticks deliberately amplified into a spike | `0.05` |
