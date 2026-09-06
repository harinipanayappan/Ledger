import { redisCmd } from "./redisClients.js";

/**
 * Rolling ("live") volatility estimate per instrument, kept in Redis as a
 * hash: volatility:{instrumentId} -> { variance, last_price }.
 *
 * Seeded at first tick with the instrument's synthetic baseline_volatility
 * from Postgres (variance = baseline^2), then updated on every tick with an
 * exponentially-weighted moving average of squared price changes:
 *
 *   variance_t = ALPHA * (price_t - price_t-1)^2 + (1 - ALPHA) * variance_t-1
 *
 * This lets each instrument's notion of "normal" drift over the session
 * (e.g. if HALO gets genuinely choppier, its bar for "meaningful" rises
 * with it) while starting from a sane, documented default instead of cold
 * -starting at zero, which the hackathon's short tick history couldn't
 * support on its own.
 */

const ALPHA = 0.2; // weight on the newest squared move; higher = more reactive

function volatilityKey(instrumentId) {
  return `volatility:${instrumentId}`;
}

export async function updateRollingVolatility(instrumentId, newPrice, baselineVolatility) {
  const key = volatilityKey(instrumentId);
  const existing = await redisCmd.hgetall(key);

  if (!existing || !existing.variance) {
    await redisCmd.hset(key, {
      variance: String(baselineVolatility ** 2),
      last_price: String(newPrice),
    });
    return baselineVolatility;
  }

  const prevPrice = Number(existing.last_price);
  const prevVariance = Number(existing.variance);
  const diff = newPrice - prevPrice;
  const nextVariance = ALPHA * diff ** 2 + (1 - ALPHA) * prevVariance;

  await redisCmd.hset(key, {
    variance: String(nextVariance),
    last_price: String(newPrice),
  });

  return Math.sqrt(nextVariance);
}

export async function getRollingVolatility(instrumentId, fallbackBaseline) {
  const key = volatilityKey(instrumentId);
  const existing = await redisCmd.hget(key, "variance");
  if (!existing) return fallbackBaseline;
  return Math.sqrt(Number(existing));
}
