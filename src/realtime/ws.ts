import type { ServerWebSocket } from "bun";

const clients: Set<ServerWebSocket<unknown>> = new Set();

export function broadcast(type: string, data?: any) {
  const payload = JSON.stringify({ type, data });
  for (const ws of clients) {
    try {
      ws.send(payload);
    } catch (e) {
      // drop broken socket silently
    }
  }
}

export function onOpen(ws: ServerWebSocket<unknown>) {
  clients.add(ws);
}

export function onClose(ws: ServerWebSocket<unknown>) {
  clients.delete(ws);
}

export function clientCount() {
  return clients.size;
}
