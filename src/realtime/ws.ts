import type { ServerWebSocket } from "bun";

const clients: Set<ServerWebSocket<unknown>> = new Set();

const MAX_CLIENTS = Number(process.env.WS_MAX_CLIENTS || 1000);

let scoresPending: Set<number> = new Set();
let scoresFlushTimer: ReturnType<typeof setTimeout> | null = null;
const SCORES_COALESCE_MS = Number(process.env.WS_SCORES_COALESCE_MS || 100);

function send(ws: ServerWebSocket<unknown>, payload: string) {
  try {
    ws.send(payload);
  } catch {
    clients.delete(ws);
  }
}

function broadcastNow(type: string, data?: any) {
  const payload = JSON.stringify({ type, data });
  for (const ws of clients) send(ws, payload);
}

/**
 * Public broadcast. Score updates are coalesced into a single
 * `scores_updated` event per ~100ms window — during a burst of submits the
 * server emits one fan-out event with the union of project_ids instead of N.
 * Other event types pass through synchronously.
 */
export function broadcast(type: string, data?: any) {
  if (type === "scores_updated") {
    const pid = data?.project_id;
    if (typeof pid === "number") scoresPending.add(pid);
    if (scoresFlushTimer === null) {
      scoresFlushTimer = setTimeout(() => {
        scoresFlushTimer = null;
        const ids = Array.from(scoresPending);
        scoresPending = new Set();
        broadcastNow("scores_updated", { project_ids: ids });
      }, SCORES_COALESCE_MS);
    }
    return;
  }
  broadcastNow(type, data);
}

export function onOpen(ws: ServerWebSocket<unknown>) {
  if (clients.size >= MAX_CLIENTS) {
    try { ws.close(1013, "server at capacity"); } catch {}
    return;
  }
  clients.add(ws);
}

export function onMessage(ws: ServerWebSocket<unknown>, message: string | Buffer) {
  // Heartbeat — clients send "ping" every ~25s; echo so they can detect
  // a one-way-broken connection by tracking the last pong they received.
  const text = typeof message === "string" ? message : message.toString();
  if (text === "ping") {
    try { ws.send("pong"); } catch { clients.delete(ws); }
  }
}

export function onClose(ws: ServerWebSocket<unknown>) {
  clients.delete(ws);
}

export function clientCount() {
  return clients.size;
}
