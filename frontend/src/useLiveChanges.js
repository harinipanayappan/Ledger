import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { BASE_URL_ROOT } from "./api";

/**
 * Connects once per session token. On reconnect, we deliberately do NOT
 * try to replay missed events — the caller should re-fetch full state
 * (React Query's refetchOnReconnect / manual invalidate) instead.
 */
export function useLiveChanges(token, onChange) {
  const [connected, setConnected] = useState(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!token) return;

    const socket = io(BASE_URL_ROOT, { auth: { token } });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("instrument:changed", (payload) => onChangeRef.current?.(payload));

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return { connected };
}
