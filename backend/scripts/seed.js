import "dotenv/config";
import pg from "pg";
import { MOCK_INSTRUMENTS } from "./mockInstruments.js";

// 18 mock instruments with a starting price (used only to seed the Redis
// live-price cache on first tick) and a synthetic baseline volatility
// (standard deviation of "typical" price change per tick, in currency units).
// Higher baseline_volatility = the instrument normally jumps around more,
// so it takes a bigger absolute move to count as "meaningful" for it.
async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Seeding instruments...");
  for (const inst of MOCK_INSTRUMENTS) {
    await pool.query(
      `INSERT INTO instruments (symbol, name, baseline_volatility)
       VALUES ($1, $2, $3)
       ON CONFLICT (symbol) DO UPDATE SET name = EXCLUDED.name, baseline_volatility = EXCLUDED.baseline_volatility`,
      [inst.symbol, inst.name, inst.baselineVolatility]
    );
  }
  console.log(`Seeded ${MOCK_INSTRUMENTS.length} instruments.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
