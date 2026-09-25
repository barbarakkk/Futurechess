const { Server } = require("socket.io");
const { prisma } = require("../lib/prisma");
const { verifyAccessToken } = require("../utils/jwt");
const {
  getGameState,
  getPlayerColor,
  handleDrawResponse,
  offerDraw,
  resignGame,
  submitMove,
} = require("./gameRuntime");
const { joinQueue, leaveQueue } = require("./matchmakingQueue");

let io;

function getRoomName(gameId) {
  return `game:${gameId}`;
}

async function getSocketUser(token) {
  const decoded = verifyAccessToken(token);

  if (!decoded?.sub) {
    throw new Error("Invalid authentication token");
  }

  return prisma.user.findUnique({
    where: { id: decoded.sub },
    select: {
      id: true,
      username: true,
      email: true,
      userCode: true,
      createdAt: true,
    },
  });
}

function attachSocketHandlers(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        throw new Error("Missing authentication token");
      }

      const user = await getSocketUser(token);

      if (!user) {
        throw new Error("User not found for token");
      }

      socket.user = user;
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on("connection", (socket) => {
    socket.on("game:join", async ({ gameId }, ack) => {
      try {
        const state = await getGameState(gameId);
        const playerColor = getPlayerColor(state, socket.user.id);

        if (!playerColor && state.status !== "waiting") {
          throw new Error("You are not a participant in this game");
        }

        socket.join(getRoomName(gameId));
        ack?.({ ok: true, game: state, playerColor });
      } catch (error) {
        ack?.({ ok: false, message: error.message || "Could not join game room" });
      }
    });

    socket.on("game:move", async ({ gameId, move }, ack) => {
      try {
        const state = await submitMove(gameId, socket.user.id, move);
        io.to(getRoomName(gameId)).emit("game:state", state);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: error.message || "Move was rejected" });
      }
    });

    socket.on("game:resign", async ({ gameId }, ack) => {
      try {
        const state = await resignGame(gameId, socket.user.id);
        io.to(getRoomName(gameId)).emit("game:state", state);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: error.message || "Could not resign game" });
      }
    });

    socket.on("game:draw-offer", async ({ gameId }, ack) => {
      try {
        const state = await offerDraw(gameId, socket.user.id);
        io.to(getRoomName(gameId)).emit("game:state", state);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: error.message || "Could not offer draw" });
      }
    });

    socket.on("game:draw-response", async ({ gameId, accept }, ack) => {
      try {
        const state = await handleDrawResponse(gameId, socket.user.id, accept);
        io.to(getRoomName(gameId)).emit("game:state", state);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: error.message || "Could not update draw offer" });
      }
    });

    // "Play Online" matchmaking — pairs two searching sockets and hands them off to the
    // same realtime game flow as friend games (`game:join` etc. above). See matchmakingQueue.js.
    socket.on("matchmaking:join", async (_payload, ack) => {
      try {
        await joinQueue(socket);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: error.message || "Could not join matchmaking queue" });
      }
    });

    socket.on("matchmaking:cancel", (_payload, ack) => {
      leaveQueue(socket);
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      leaveQueue(socket);
    });
  });

  return io;
}

async function broadcastGameState(gameId) {
  if (!io) {
    return;
  }

  const state = await getGameState(gameId);
  io.to(getRoomName(gameId)).emit("game:state", state);
}

/** After a game row is deleted from the DB — tell clients still in the room. `reason` is optional
 * ("expired" | "cancelled") so the client can explain why the game disappeared. */
function emitGameRemoved(gameId, reason) {
  if (!io) {
    return;
  }

  io.to(getRoomName(gameId)).emit("game:removed", { gameId, reason });
}

module.exports = {
  attachSocketHandlers,
  broadcastGameState,
  emitGameRemoved,
};
