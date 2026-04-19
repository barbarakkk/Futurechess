require("dotenv").config();
const { createServer } = require("node:http");
const { app } = require("./app");
const { attachSocketHandlers } = require("./realtime/socketHub");

const PORT = process.env.PORT || 4000;
const server = createServer(app);

attachSocketHandlers(server);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
