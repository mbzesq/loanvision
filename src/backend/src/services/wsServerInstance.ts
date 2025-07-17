import { WebSocketServer } from './websocketServer';

// Global WebSocket server instance
let wsServerInstance: WebSocketServer | null = null;

export function setWSServerInstance(server: WebSocketServer) {
  wsServerInstance = server;
}

export function getWSServerInstance(): WebSocketServer | null {
  return wsServerInstance;
}