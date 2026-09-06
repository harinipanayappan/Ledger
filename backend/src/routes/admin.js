import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { redisCmd, FEED_KILL_KEY } from "../services/redisClients.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const adminRouter = Router();
adminRouter.use(requireAuth);

// Deliberately trigger the "feed stopped emitting ticks" failure mode so
// staleness handling can be demoed on demand instead of waiting for a
// real outage. Any logged-in user can toggle this for demo purposes —
// there's no real admin role in this hackathon-scope build (see README).

adminRouter.post("/feed/kill", asyncHandler(async (req, res) => {
  await redisCmd.set(FEED_KILL_KEY, "1");
  res.json({ ok: true, feed_killed: true });
}));

adminRouter.post("/feed/resume", asyncHandler(async (req, res) => {
  await redisCmd.set(FEED_KILL_KEY, "0");
  res.json({ ok: true, feed_killed: false });
}));

adminRouter.get("/feed/status", asyncHandler(async (req, res) => {
  const killed = await redisCmd.get(FEED_KILL_KEY);
  res.json({ feed_killed: killed === "1" });
}));
