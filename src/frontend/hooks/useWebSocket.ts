import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "../lib/queryClient";

/**
 * Single WebSocket connection that invalidates TanStack queries on server events.
 *
 * Hardened for live-judging conditions:
 *  - 25s ping keepalive — ALBs / nginx / Cloudflare drop idle WS at ~60s.
 *  - Server echoes "pong"; we force-close if too long elapses without one,
 *    so a half-broken connection (one-way TCP stall) reconnects instead of
 *    appearing alive but stale.
 *  - Reconnect backoff has random jitter so a server restart doesn't cause
 *    every client to reconnect in lockstep.
 *  - Always resync on (re)connect so we catch up on events that fired in
 *    the gap between initial query fetch and WS open.
 */
const PING_INTERVAL_MS = 25_000;
const PONG_TIMEOUT_MS = 60_000;
const MAX_RECONNECT_DELAY_MS = 8_000;

export function useRealtimeSync() {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const closedByUnmount = useRef(false);

  useEffect(() => {
    closedByUnmount.current = false;

    let retry = 0;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;
    let lastPongAt = 0;

    const stopPing = () => {
      if (pingTimer !== null) {
        window.clearInterval(pingTimer);
        pingTimer = null;
      }
    };

    const stopReconnect = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const resyncAll = () => {
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.leaderboard });
      qc.invalidateQueries({ queryKey: qk.criteria });
    };

    const connect = () => {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      // Vite dev proxy routes /ws → server; prod is same-origin Bun
      const url = `${proto}//${window.location.host}/ws`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        retry = 0;
        lastPongAt = Date.now();
        // Resync unconditionally — closes the gap between initial query
        // fetches and WS open, where a broadcast could be missed.
        resyncAll();
        stopPing();
        pingTimer = window.setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          // If server stopped echoing pongs, the link is one-way dead.
          if (lastPongAt && Date.now() - lastPongAt > PONG_TIMEOUT_MS) {
            try { ws.close(); } catch {}
            return;
          }
          try { ws.send("ping"); } catch {}
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (e) => {
        if (e.data === "pong") {
          lastPongAt = Date.now();
          return;
        }
        try {
          const { type } = JSON.parse(e.data);
          switch (type) {
            case "scores_updated":
            case "projects_updated":
              qc.invalidateQueries({ queryKey: qk.projects });
              qc.invalidateQueries({ queryKey: qk.leaderboard });
              break;
            case "criteria_updated":
              qc.invalidateQueries({ queryKey: qk.criteria });
              qc.invalidateQueries({ queryKey: qk.projects });
              qc.invalidateQueries({ queryKey: qk.leaderboard });
              break;
            case "judges_updated":
              qc.invalidateQueries({ queryKey: qk.judges });
              qc.invalidateQueries({ queryKey: qk.leaderboard });
              break;
          }
        } catch {
          // ignore parse errors (incl. server keepalive)
        }
      };

      ws.onclose = () => {
        stopPing();
        if (closedByUnmount.current) return;
        retry++;
        // Exponential backoff with jitter — random factor in [0.5, 1.0]
        // so a server restart doesn't trigger a thundering-herd reconnect.
        const base = Math.min(MAX_RECONNECT_DELAY_MS, 500 * 2 ** retry);
        const delay = base * (0.5 + Math.random() * 0.5);
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closedByUnmount.current = true;
      stopReconnect();
      stopPing();
      wsRef.current?.close();
    };
  }, [qc]);
}
