import { WebSocketServer } from "ws";
import { getState } from "../ui/state.js";

let wss;

export function startWS(server) {
  wss = new WebSocketServer({ server });

  setInterval(() => {
    const state = getState();

    const payload = JSON.stringify({
      type: "STATE_UPDATE",
      state
    });

    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(payload);
      }
    });
  }, 200); // 5fps
}
