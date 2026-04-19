import http from "node:http";
import app from "./core/runtime_server/app.js";
import { startWS } from "./core/runtime_server/ws.js";

const server = http.createServer(app);

startWS(server);

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🧠 Xentari Web UI running on http://localhost:${PORT}`);
});
