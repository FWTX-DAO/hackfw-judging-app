import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "../lib/queryClient";

/**
 * Single WebSocket connection that invalidates TanStack queries on server events.
 *
 * Hardened for live-judging conditions:
 *  - 25s ping keepalive — ALBs / nginx / Cloudflare drop idle WS at ~60s.
 *  - On reconnect, re-invalidates queries so observers catch up on any
 *    events that fired while the socket was down.
 *  - Cancels pending reconnect timers on unmount to prevent leaks.
 */
const PING_INTERVAL_MS = 25_000;
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
        const wasReconnect = retry > 0;
        retry = 0;
        // Catch up on anything we missed while disconnected
        if (wasReconnect) resyncAll();
        // Keepalive — proxies drop idle WS after ~60s
        stopPing();
        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (e) => {
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
          }
        } catch {
          // ignore parse errors (incl. server pong/keepalive)
        }
      };

      ws.onclose = () => {
        stopPing();
        if (closedByUnmount.current) return;
        retry++;
        const delay = Math.min(MAX_RECONNECT_DELAY_MS, 500 * 2 ** retry);
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
