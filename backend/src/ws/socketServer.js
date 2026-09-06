import { Server } from "socket.io";
import jwt from "jsonwebtoken";

export function attachSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN || "*" },
  });

  // Auth handshake: client connects with { auth: { token } }.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Missing auth token"));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.sub;
      next();
    } catch (err) {
      next(new Error("Invalid auth token"));
    }
  });

  io.on("connection", (socket) => {
    const room = `user:${socket.userId}`;
    socket.join(room);

    // On (re)connect the client should re-fetch full state via the REST
    // BFF endpoint rather than expect a backlog of missed ticks — we
    // deliberately do not queue/replay events for a socket that was
    // offline (last-value-wins).
    socket.emit("connected", { ok: true });
  });

  return io;
}

export function emitChangeEvent(io, userId, payload) {
  io.to(`user:${userId}`).emit("instrument:changed", payload);
}
