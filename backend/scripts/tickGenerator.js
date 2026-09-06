import "dotenv/config";
import pg from "pg";
import Redis from "ioredis";
import { MOCK_INSTRUMENTS } from "./mockInstruments.js";

/**
 * Simulated market data feed.
 *
 * This stands in for a real exchange connection. It publishes a JSON tick
 * to a single Redis pub/sub channel ("ticks:all") for every instrument on
 * a fixed interval. Each tick carries a per-instrument monotonically
 * increasing sequence_number so downstream consumers can dedupe/idempotently
 * process replayed or duplicated messages.
 *
 * Movement model: most ticks are a small random walk step drawn from the
 * instrument's own baseline volatility (so a jumpy stock like HALO moves
 * more per tick than a calm one like QUARTZ). ~SPIKE_PROBABILITY of ticks
 * are deliberately amplified (4-8x baseline volatility) so the
 * change-detection logic downstream has real spikes to catch.
 *
 * Kill switch: if Redis key "feed:killed" is set to "1", this generator
 * stops publishing entirely (simulating an upstream feed outage) without
 * crashing. The API keeps serving the last known-good price with a
 * `stale: true` flag once it ages past STALE_THRESHOLD_MS. Toggle it with:
 *   redis-cli set feed:killed 1   # simulate outage
 *   redis-cli set feed:killed 0   # resume
 * or via POST /api/admin/feed/kill and /api/admin/feed/resume.
 */

const TICK_CHANNEL = "ticks:all";
const FEED_KILL_KEY = "feed:killed";
const TICK_INTERVAL_MS = Number(process.env.TICK_INTERVAL_MS || 1000);
const SPIKE_PROBABILITY = Number(process.env.SPIKE_PROBABILITY || 0.05);

function randomNormal() {
  // Box-Muller transform for an approx. N(0,1) sample.
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const redisPub = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  const redisCmd = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

  const { rows: instruments } = await pool.query(
    "SELECT id, symbol, baseline_volatility FROM instruments ORDER BY id"
  );
  if (instruments.length === 0) {
    console.error("No instruments found. Run `npm run seed` first.");
    process.exit(1);
  }

  const startPriceBySymbol = new Map(MOCK_INSTRUMENTS.map((i) => [i.symbol, i.startPrice]));

  // In-memory per-instrument state for this generator process.
  const state = new Map();
  for (const inst of instruments) {
    state.set(inst.id, {
      price: startPriceBySymbol.get(inst.symbol) ?? 100,
      // Starting from the current epoch keeps the source sequence monotonic
      // across generator restarts, even though Redis retains its dedupe key.
      seq: Date.now(),
      baselineVolatility: Number(inst.baseline_volatility),
    });
  }

  console.log(`Tick generator started for ${instruments.length} instruments, every ${TICK_INTERVAL_MS}ms.`);

  setInterval(async () => {
    try {
      const killed = await redisCmd.get(FEED_KILL_KEY);
      if (killed === "1") {
        return; // simulated outage: emit nothing this tick
      }

      for (const inst of instruments) {
        const s = state.get(inst.id);
        const isSpike = Math.random() < SPIKE_PROBABILITY;
        const magnitude = isSpike
          ? s.baselineVolatility * (4 + Math.random() * 4) // 4x-8x baseline
          : s.baselineVolatility * 0.6; // normal wobble, sub-baseline most of the time

        const delta = randomNormal() * magnitude;
        s.price = Math.max(0.5, s.price + delta);
        s.seq += 1;

        const tick = {
          instrument_id: inst.id,
          symbol: inst.symbol,
          price: Number(s.price.toFixed(2)),
          sequence_number: s.seq,
          timestamp: new Date().toISOString(),
          is_spike: isSpike,
        };

        await redisPub.publish(TICK_CHANNEL, JSON.stringify(tick));
      }
    } catch (err) {
      console.error("Tick generation cycle failed:", err);
    }
  }, TICK_INTERVAL_MS);
}

main().catch((err) => {
  console.error("Tick generator failed:", err);
  process.exit(1);
});
