import { redisSub, TICK_CHANNEL } from "../services/redisClients.js";
import { acceptAndWriteLatestPrice } from "../services/priceCache.js";
import { updateRollingVolatility, getRollingVolatility } from "../services/volatility.js";
import { evaluateSignificance } from "../services/changeDetection.js";
import { pool } from "../db/pool.js";
import { emitChangeEvent } from "./socketServer.js";

const DEBOUNCE_WINDOW_MS = Number(process.env.DEBOUNCE_WINDOW_MS || 750);

// Per-instrument debounce buffers: instrumentId -> { latestTick, timer }
// Rapid-fire ticks for the same instrument within the window collapse
// down to one evaluation using only the most recent price (last-value
// -within-window-wins), so a burst of 5 ticks in 300ms produces at most
// one "changed" push per affected user instead of five flickering ones.
const debounceBuffers = new Map();

async function processDebouncedInstrument(instrumentId, latestTick, io) {
  debounceBuffers.delete(instrumentId);

  // Find every user who has this instrument on any watchlist.
  const { rows: watchers } = await pool.query(
    `SELECT DISTINCT w.user_id
     FROM watchlist_items wi
     JOIN watchlists w ON w.id = wi.watchlist_id
     WHERE wi.instrument_id = $1`,
    [instrumentId]
  );
  if (watchers.length === 0) return;

  const { rows: instrumentRows } = await pool.query(
    `SELECT baseline_volatility FROM instruments WHERE id = $1`,
    [instrumentId]
  );
  const baselineVolatility = Number(instrumentRows[0]?.baseline_volatility ?? 1);
  const rollingVolatility = await getRollingVolatility(instrumentId, baselineVolatility);

  const userIds = watchers.map((w) => w.user_id);
  const { rows: snapshots } = await pool.query(
    `SELECT user_id, last_seen_price
     FROM user_last_seen_snapshots
     WHERE instrument_id = $1 AND user_id = ANY($2::int[])`,
    [instrumentId, userIds]
  );
  const snapshotByUser = new Map(snapshots.map((s) => [s.user_id, Number(s.last_seen_price)]));

  for (const userId of userIds) {
    const lastSeenPrice = snapshotByUser.get(userId) ?? null;
    const significance = evaluateSignificance({
      currentPrice: latestTick.price,
      lastSeenPrice,
      rollingVolatility,
    });

    if (significance.changed) {
      emitChangeEvent(io, userId, {
        instrument_id: instrumentId,
        symbol: latestTick.symbol,
        current_price: latestTick.price,
        last_updated: latestTick.timestamp,
        ...significance,
      });
    }
  }
}

export function initTickConsumer(io) {
  redisSub.subscribe(TICK_CHANNEL, (err) => {
    if (err) console.error("Failed to subscribe to tick channel:", err);
    else console.log(`Subscribed to ${TICK_CHANNEL}`);
  });

  redisSub.on("message", (channel, message) => {
    processTickMessage(channel, message, io).catch((err) =>
      console.error("Tick processing failed:", err)
    );
  });
}

async function processTickMessage(channel, message, io) {
  if (channel !== TICK_CHANNEL) return;

  let tick;
  try {
    tick = JSON.parse(message);
  } catch {
    return; // malformed tick, drop it
  }

  const accepted = await acceptAndWriteLatestPrice(
    tick.instrument_id,
    tick.price,
    tick.sequence_number,
    tick.timestamp
  );
  if (!accepted) return; // idempotency: ignore replayed/out-of-order sequence numbers

  const { rows } = await pool.query(`SELECT baseline_volatility FROM instruments WHERE id = $1`, [
    tick.instrument_id,
  ]);
  const baselineVolatility = Number(rows[0]?.baseline_volatility ?? 1);
  await updateRollingVolatility(tick.instrument_id, tick.price, baselineVolatility);

  // Debounce the "evaluate + push" step, not the cache write above —
  // the cache should always reflect the freshest price immediately;
  // it's only the client-facing "changed" notification that we batch.
  const existing = debounceBuffers.get(tick.instrument_id);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    processDebouncedInstrument(tick.instrument_id, tick, io).catch((err) =>
      console.error("Debounced processing failed:", err)
    );
  }, DEBOUNCE_WINDOW_MS);

  debounceBuffers.set(tick.instrument_id, { latestTick: tick, timer });
}
