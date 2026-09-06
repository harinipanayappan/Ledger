import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";

import { authRouter } from "./routes/auth.js";
import { instrumentsRouter } from "./routes/instruments.js";
import { watchlistsRouter } from "./routes/watchlists.js";
import { adminRouter } from "./routes/admin.js";
import { attachSocketServer } from "./ws/socketServer.js";
import { initTickConsumer } from "./ws/tickConsumer.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/instruments", instrumentsRouter);
app.use("/api/watchlists", watchlistsRouter);
app.use("/api/admin", adminRouter);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const httpServer = http.createServer(app);
const io = attachSocketServer(httpServer);
initTickConsumer(io);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Smart Watchlist API listening on :${PORT}`);
});
