/**
 * Volatility-relative significance check ("is this move meaningful?").
 *
 * Formula:
 *   z = |current_price - last_seen_price| / rolling_volatility
 *   meaningful = z >= SIGNIFICANCE_Z_SCORE
 *
 * rolling_volatility is the instrument's own EWMA-estimated standard
 * deviation of price moves (see services/volatility.js), seeded from a
 * synthetic baseline_volatility per instrument. This makes the bar
 * relative to how much *that instrument* normally jumps around, rather
 * than a single global percentage (a 20-rupee move on a ₹350 stock and a
 * ₹4200 stock mean very different things).
 *
 * SIGNIFICANCE_Z_SCORE defaults to 1.5, i.e. a move has to be at least 1.5
 * standard deviations from the user's last-seen price to be flagged.
 */

const Z_THRESHOLD = Number(process.env.SIGNIFICANCE_Z_SCORE || 1.5);

export function evaluateSignificance({ currentPrice, lastSeenPrice, rollingVolatility }) {
  if (lastSeenPrice === null || lastSeenPrice === undefined) {
    // Never viewed before: nothing to diff against, so nothing to flag.
    return {
      changed: false,
      delta: null,
      delta_pct: null,
      z_score: null,
      reason: "no_prior_view",
    };
  }

  const delta = currentPrice - lastSeenPrice;
  const safeVolatility = rollingVolatility > 0 ? rollingVolatility : 0.0001;
  const z = Math.abs(delta) / safeVolatility;
  const changed = z >= Z_THRESHOLD;

  return {
    changed,
    delta: Number(delta.toFixed(2)),
    delta_pct: Number(((delta / lastSeenPrice) * 100).toFixed(2)),
    z_score: Number(z.toFixed(2)),
    reason: changed ? (z >= Z_THRESHOLD * 2 ? "large_move" : "threshold_crossed") : "within_normal_range",
  };
}
