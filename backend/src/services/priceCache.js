import { redisCmd } from "./redisClients.js";

const STALE_THRESHOLD_MS = Number(process.env.STALE_THRESHOLD_MS || 10000);

function priceKey(instrumentId) {
  return `price:${instrumentId}`;
}

function seqKey(instrumentId) {
  return `seq:${instrumentId}`;
}

const ACCEPT_AND_WRITE_TICK = `
  local lastSeq = redis.call("GET", KEYS[1])
  if lastSeq and tonumber(ARGV[1]) <= tonumber(lastSeq) then
    return 0
  end

  redis.call("SET", KEYS[1], ARGV[1])
  redis.call("HSET", KEYS[2],
    "price", ARGV[2],
    "last_updated", ARGV[3],
    "sequence_number", ARGV[1]
  )
  return 1
`;

/**
 * Atomically accepts a strictly newer tick and writes it to the cache. Doing
 * both operations in one Redis script means an older concurrent tick cannot
 * pass the sequence check and overwrite a newer cached price.
 */
export async function acceptAndWriteLatestPrice(instrumentId, price, sequenceNumber, timestampIso) {
  const accepted = await redisCmd.eval(
    ACCEPT_AND_WRITE_TICK,
    2,
    seqKey(instrumentId),
    priceKey(instrumentId),
    String(sequenceNumber),
    String(price),
    timestampIso
  );
  return accepted === 1;
}

export async function readLatestPrice(instrumentId) {
  const data = await redisCmd.hgetall(priceKey(instrumentId));
  if (!data || !data.price) return null;

  const lastUpdated = new Date(data.last_updated);
  const ageMs = Date.now() - lastUpdated.getTime();

  return {
    price: Number(data.price),
    last_updated: data.last_updated,
    sequence_number: Number(data.sequence_number),
    stale: ageMs > STALE_THRESHOLD_MS,
    age_ms: ageMs,
  };
}
