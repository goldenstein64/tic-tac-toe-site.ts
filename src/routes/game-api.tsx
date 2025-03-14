import type { Mark } from "@goldenstein64/tic-tac-toe";

import { on } from "node:events";
import { Elysia, error, t } from "elysia";
import { Board } from "@goldenstein64/tic-tac-toe";
import html, { Html } from "@elysiajs/html";
import { eq, max, sql } from "drizzle-orm";

import { db, typePrepared } from "../db";
import { FinishedLobby, Game, Lobby, Move } from "../db/schema";
import jwtAuth from "../libs/jwt-auth";
import { orderingToMark } from "../libs/run-game";
import { intString } from "../types";
import { GameRows } from "../components/game-active";
import { LobbyStatus } from "../db/datatypes";
import { GameState, gameStates, GameStateEvents } from "../libs/game-state";

const _placeholders: any = undefined;

const selectMaxOrdering = typePrepared(
  db
    .select({ ordering: max(Move.ordering) })
    .from(Move)
    .where(eq(Move.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number }
);

const insertMove = typePrepared(
  db
    .insert(Move)
    .values({
      lobbyId: sql.placeholder("lobbyId"),
      ordering: sql.placeholder("ordering"),
      position: sql.placeholder("position"),
    })
    .prepare(),
  _placeholders as { lobbyId: number; ordering: number; position: number }
);

const selectGamePlayers = typePrepared(
  db
    .select({ playerX: Game.playerX, playerO: Game.playerO })
    .from(Game)
    .where(eq(Game.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number }
);

function updateLobbyStatus({
  id,
  status,
}: {
  id: number;
  status: LobbyStatus;
}) {
  db.update(Lobby).set({ status: status }).where(eq(Lobby.id, id)).run();
}

const insertFinishedLobby = typePrepared(
  db
    .insert(FinishedLobby)
    .values({ id: sql.placeholder("id"), winner: sql.placeholder("winner") })
    .prepare(),
  _placeholders as { lobbyId: number; winner?: number }
);

type EventProps = { event?: string; data: string };
function event({ event = "message", data }: EventProps): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

type MoveStreamContext = {
  board: Board;
  userIsX: boolean;
  isClientPlaying: boolean;
  lobbyId: number;
  state: GameState;
};

async function* onNewMove(
  { board, userIsX, isClientPlaying, lobbyId, state }: MoveStreamContext,
  ordering: number
): AsyncGenerator<string> {
  const mark = orderingToMark(ordering);

  // update the board
  const endResult = board.ended(mark);
  if (endResult) {
    state.emit("end", endResult.winner);
    return;
  }

  const nextTurn = orderingToMark(ordering + 1);
  const isClientsTurn = userIsX === (nextTurn === "X");
  const enabled = isClientPlaying && isClientsTurn;
  yield event({
    event: "board",
    data: await (
      <GameRows lobbyId={lobbyId} board={board} disabled={!enabled} />
    ),
  });
}

async function* onEnded(
  { board, lobbyId }: MoveStreamContext,
  winnerMark: Mark | null
): AsyncGenerator<string> {
  updateLobbyStatus({ id: lobbyId, status: "finished" });
  const players = selectGamePlayers.get({ lobbyId })!;
  insertFinishedLobby.run({
    lobbyId,
    winner:
      winnerMark == "X" ? players.playerX
      : winnerMark == "O" ? players.playerO
      : undefined,
  });
  yield event({
    event: "board",
    data: await (<GameRows lobbyId={lobbyId} board={board} disabled />),
  });
  yield event({ event: "winner", data: winnerMark ?? "no one" });
  yield event({ event: "status", data: "finished" });
}

export default new Elysia({ prefix: "/api" })
  .use(html())
  .use(jwtAuth())
  .resolve(({ user }) => ({ user: user! }))
  .post(
    "/game-move",
    ({ body: { id: lobbyId, position }, user: { id: userId } }) => {
      const players = selectGamePlayers.get({ lobbyId });
      if (!players) return error("Not Found");
      const { playerX, playerO } = players;
      if (playerX !== userId && playerO !== userId)
        return error("Unauthorized");

      const state = gameStates.getOrCreate(lobbyId, playerX, playerO);
      if (!state.canMark(position)) return error("Unauthorized");

      const maxOrderResult = selectMaxOrdering.get({ lobbyId });
      const ordering = (maxOrderResult?.ordering ?? -1) + 1;
      state.setMark(position, ordering);
    },
    {
      body: t.Object({ id: intString, position: intString }),
      parse: "application/x-www-form-urlencoded",
    }
  )
  .state("abortController", undefined as undefined | AbortController)
  .get(
    "/game-move",
    async function* ({
      query: { id: lobbyId },
      user: { id: userId },
      set,
      store,
    }) {
      const players = selectGamePlayers.get({ lobbyId });
      if (!players) return error("Not Found");

      set.headers["X-Accel-Buffering"] = "no";
      set.headers["Cache-Control"] = "no-cache";
      set.headers["Content-Type"] = "text/event-stream";

      const { playerX, playerO } = players;
      const state = gameStates.getOrCreate(lobbyId, playerX, playerO);
      const board = state.board;
      const userIsX = userId === playerX;
      const userIsO = userId === playerO;
      const isClientPlaying = userIsX || userIsO;

      const abortController = new AbortController();
      store.abortController = abortController;
      const moveStreamCtx: MoveStreamContext = {
        state,
        board,
        userIsX,
        isClientPlaying,
        lobbyId,
      };
      const onMoveStream = on(state, "move-stream", {
        signal: abortController.signal,
      }) as AsyncIterable<GameStateEvents["move-stream"]>;
      moveStream: for await (const [name, args] of onMoveStream) {
        console.log(name);
        switch (name) {
          case "new-move":
            yield* onNewMove(moveStreamCtx, ...args);
            break;
          case "end":
            yield* onEnded(moveStreamCtx, ...args);
            break moveStream;
        }
      }
    },
    {
      query: t.Object({ id: intString }),
      afterHandle({ store }) {
        store.abortController?.abort("aborted for await loop");
      },
    }
  );
