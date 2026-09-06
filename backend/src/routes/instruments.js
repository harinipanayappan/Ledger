import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const instrumentsRouter = Router();

instrumentsRouter.get("/", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, symbol, name, baseline_volatility FROM instruments ORDER BY symbol`
  );
  res.json({ instruments: rows });
}));
