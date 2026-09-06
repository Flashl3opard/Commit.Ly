import "dotenv/config";
import { createServer } from "node:http";
import app from "./app";
import { attachWebSocketServer } from "./modules/ws/wsServer";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4004;

// A plain http.Server is created explicitly (rather than app.listen()
// directly) so the WebSocket server can hook the same server's 'upgrade'
// event — ws runs alongside the REST API on the same port, not as a
// separate service.
const server = createServer(app);
attachWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
