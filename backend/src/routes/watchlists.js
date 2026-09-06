import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { readLatestPrice } from "../services/priceCache.js";
import { getRollingVolatility } from "../services/volatility.js";
import { evaluateSignificance } from "../services/changeDetection.js";

export const watchlistsRouter = Router();
watchlistsRouter.use(requireAuth);

async function assertOwnedWatchlist(watchlistId, userId) {
  const { rows } = await pool.query(
    `SELECT id, user_id, name FROM watchlists WHERE id = $1`,
    [watchlistId]
  );
  const watchlist = rows[0];
  if (!watchlist || watchlist.user_id !== userId) return null;
  return watchlist;
}

// --- Watchlist CRUD ---------------------------------------------------

watchlistsRouter.get("/", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, created_at FROM watchlists WHERE user_id = $1 ORDER BY created_at`,
    [req.user.id]
  );
  res.json({ watchlists: rows });
}));

watchlistsRouter.post("/", asyncHandler(async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "name is required" });

  const { rows } = await pool.query(
    `INSERT INTO watchlists (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at`,
    [req.user.id, name.trim()]
  );
  res.status(201).json({ watchlist: rows[0] });
}));

watchlistsRouter.patch("/:id", asyncHandler(async (req, res) => {
  const watchlist = await assertOwnedWatchlist(req.params.id, req.user.id);
  if (!watchlist) return res.status(404).json({ error: "Watchlist not found" });

  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "name is required" });

  const { rows } = await pool.query(
    `UPDATE watchlists SET name = $1 WHERE id = $2 RETURNING id, name, created_at`,
    [name.trim(), watchlist.id]
  );
  res.json({ watchlist: rows[0] });
}));

watchlistsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const watchlist = await assertOwnedWatchlist(req.params.id, req.user.id);
  if (!watchlist) return res.status(404).json({ error: "Watchlist not found" });

  await pool.query(`DELETE FROM watchlists WHERE id = $1`, [watchlist.id]);
  res.status(204).send();
}));

// --- Watchlist items ----------------------------------------------------

watchlistsRouter.post("/:id/items", asyncHandler(async (req, res) => {
  const watchlist = await assertOwnedWatchlist(req.params.id, req.user.id);
  if (!watchlist) return res.status(404).json({ error: "Watchlist not found" });

  const { instrument_id } = req.body || {};
  if (!instrument_id) return res.status(400).json({ error: "instrument_id is required" });

  try {
    const { rows } = await pool.query(
      `INSERT INTO watchlist_items (watchlist_id, instrument_id) VALUES ($1, $2)
       RETURNING id, watchlist_id, instrument_id, added_at`,
      [watchlist.id, instrument_id]
    );
    res.status(201).json({ item: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "That instrument is already on this watchlist" });
    }
    if (err.code === "23503") {
      return res.status(400).json({ error: "Unknown instrument_id" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not add instrument" });
  }
}));

watchlistsRouter.delete("/:id/items/:itemId", asyncHandler(async (req, res) => {
  const watchlist = await assertOwnedWatchlist(req.params.id, req.user.id);
  if (!watchlist) return res.status(404).json({ error: "Watchlist not found" });

  await pool.query(`DELETE FROM watchlist_items WHERE id = $1 AND watchlist_id = $2`, [
    req.params.itemId,
    watchlist.id,
  ]);
  res.status(204).send();
}));

// --- The BFF read endpoint: everything the screen needs in one call ----

watchlistsRouter.get("/:id", asyncHandler(async (req, res) => {
  const watchlist = await assertOwnedWatchlist(req.params.id, req.user.id);
  if (!watchlist) return res.status(404).json({ error: "Watchlist not found" });

  const { rows: items } = await pool.query(
    `SELECT wi.id AS item_id, i.id AS instrument_id, i.symbol, i.name, i.baseline_volatility
     FROM watchlist_items wi
     JOIN instruments i ON i.id = wi.instrument_id
     WHERE wi.watchlist_id = $1
     ORDER BY i.symbol`,
    [watchlist.id]
  );

  if (items.length === 0) {
    return res.json({ watchlist: { id: watchlist.id, name: watchlist.name }, items: [] });
  }

  const instrumentIds = items.map((i) => i.instrument_id);
  const { rows: snapshots } = await pool.query(
    `SELECT instrument_id, last_seen_price, last_seen_at
     FROM user_last_seen_snapshots
     WHERE user_id = $1 AND instrument_id = ANY($2::int[])`,
    [req.user.id, instrumentIds]
  );
  const snapshotByInstrument = new Map(snapshots.map((s) => [s.instrument_id, s]));

  const enriched = await Promise.all(
    items.map(async (item) => {
      const priceInfo = await readLatestPrice(item.instrument_id);
      const rollingVolatility = await getRollingVolatility(
        item.instrument_id,
        Number(item.baseline_volatility)
      );
      const snapshot = snapshotByInstrument.get(item.instrument_id);

      const significance = priceInfo
        ? evaluateSignificance({
            currentPrice: priceInfo.price,
            lastSeenPrice: snapshot ? Number(snapshot.last_seen_price) : null,
            rollingVolatility,
          })
        : { changed: false, delta: null, delta_pct: null, z_score: null, reason: "no_price_data" };

      return {
        item_id: item.item_id,
        instrument_id: item.instrument_id,
        symbol: item.symbol,
        name: item.name,
        current_price: priceInfo ? priceInfo.price : null,
        last_updated: priceInfo ? priceInfo.last_updated : null,
        stale: priceInfo ? priceInfo.stale : true,
        last_seen_price: snapshot ? Number(snapshot.last_seen_price) : null,
        last_seen_at: snapshot ? snapshot.last_seen_at : null,
        ...significance,
      };
    })
  );

  res.json({ watchlist: { id: watchlist.id, name: watchlist.name }, items: enriched });
}));

// --- Mark instrument(s) as viewed: updates the per-user snapshot --------

watchlistsRouter.post("/:id/view", asyncHandler(async (req, res) => {
  const watchlist = await assertOwnedWatchlist(req.params.id, req.user.id);
  if (!watchlist) return res.status(404).json({ error: "Watchlist not found" });

  const { instrument_id } = req.body || {};
  if (!instrument_id) return res.status(400).json({ error: "instrument_id is required" });

  const { rowCount } = await pool.query(
    `SELECT 1 FROM watchlist_items WHERE watchlist_id = $1 AND instrument_id = $2`,
    [watchlist.id, instrument_id]
  );
  if (rowCount === 0) {
    return res.status(400).json({ error: "Instrument is not on this watchlist" });
  }

  const priceInfo = await readLatestPrice(instrument_id);
  if (!priceInfo) return res.status(409).json({ error: "No price data yet for this instrument" });

  await pool.query(
    `INSERT INTO user_last_seen_snapshots (user_id, instrument_id, last_seen_price, last_seen_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, instrument_id)
     DO UPDATE SET last_seen_price = EXCLUDED.last_seen_price, last_seen_at = now()`,
    [req.user.id, instrument_id, priceInfo.price]
  );

  res.json({ ok: true, last_seen_price: priceInfo.price });
}));
