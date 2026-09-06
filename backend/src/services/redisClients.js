import Redis from "ioredis";
import "dotenv/config";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Separate connections: a pub/sub subscriber cannot run normal commands
// on the same connection, so we keep three roles distinct.
export const redisCmd = new Redis(REDIS_URL); // GET/SET/HSET etc (hot-path cache)
export const redisPub = new Redis(REDIS_URL); // publishing ticks (used by tick generator)
export const redisSub = new Redis(REDIS_URL); // subscribing to tick channel (used by server)

export const TICK_CHANNEL = "ticks:all";
export const FEED_KILL_KEY = "feed:killed"; // "1" when the simulated feed is deliberately stopped
