import {
  eq,
  ne,
  and,
  or,
  sql,
  SQL,
  max,
  aliasedTable,
  count,
} from "drizzle-orm";

import { db, typePrepared } from ".";
import { LobbyStatus } from "./datatypes";
import { Move, User, Game, Lobby, FinishedLobby, DiscordUser } from "./schema";

type SQLProps<T extends Record<string, unknown>> = {
  [K in keyof T]: T[K] | SQL<T[K]>;
};

const _placeholders: any = undefined;

export const selectMovesInGame = typePrepared(
  db
    .select({ position: Move.position, ordering: Move.ordering })
    .from(Move)
    .where(eq(Move.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number },
);

export const selectMaxOrdering = typePrepared(
  db
    .select({ maxOrdering: max(Move.ordering) })
    .from(Move)
    .where(eq(Move.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number },
);

export const selectUserById = typePrepared(
  db
    .select()
    .from(User)
    .where(eq(User.id, sql.placeholder("userId")))
    .prepare(),
  _placeholders as { userId: number },
);

export const selectPlayersInGame = typePrepared(
  db
    .select({ playerX: Game.playerX, playerO: Game.playerO })
    .from(Game)
    .where(eq(Game.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number },
);

export const selectGameById = typePrepared(
  db
    .select()
    .from(Game)
    .where(eq(Game.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number },
);

export const selectUserActiveLobbies = (() => {
  const playerX = aliasedTable(User, "playerX");
  const playerO = aliasedTable(User, "playerO");
  return typePrepared(
    db
      .select({
        lobbyId: Lobby.id,
        createdAt: Lobby.createdAt,
        playerX: playerX.username,
        playerO: playerO.username,
      })
      .from(Lobby)
      .innerJoin(Game, eq(Game.lobbyId, Lobby.id))
      .innerJoin(playerX, eq(playerX.id, Game.playerX))
      .innerJoin(playerO, eq(playerO.id, Game.playerO))
      .where(
        and(
          eq(Lobby.status, "active"),
          or(
            eq(playerX.id, sql.placeholder("userId")),
            eq(playerO.id, sql.placeholder("userId")),
          ),
        ),
      )
      .offset(sql.placeholder("offset"))
      .limit(sql.placeholder("limit"))
      .prepare(),
    _placeholders as { userId: number; offset: number; limit: number },
  );
})();

export const countUserActiveLobbies = (() => {
  const playerX = aliasedTable(User, "playerX");
  const playerO = aliasedTable(User, "playerO");
  return typePrepared(
    db
      .select({ count: count() })
      .from(Lobby)
      .innerJoin(Game, eq(Game.lobbyId, Lobby.id))
      .innerJoin(playerX, eq(playerX.id, Game.playerX))
      .innerJoin(playerO, eq(playerO.id, Game.playerO))
      .where(
        and(
          eq(Lobby.status, "active"),
          or(
            eq(playerX.id, sql.placeholder("userId")),
            eq(playerO.id, sql.placeholder("userId")),
          ),
        ),
      )
      .prepare(),
    _placeholders as { userId: number },
  );
})();

export const selectUserFinishedLobbies = (() => {
  const playerX = aliasedTable(User, "playerX");
  const playerO = aliasedTable(User, "playerO");
  return typePrepared(
    db
      .select({
        lobbyId: Lobby.id,
        createdAt: Lobby.createdAt,
        finishedAt: FinishedLobby.finishedAt,
        playerX: playerX.username,
        playerO: playerO.username,
      })
      .from(Lobby)
      .innerJoin(FinishedLobby, eq(FinishedLobby.id, Lobby.id))
      .innerJoin(Game, eq(Game.lobbyId, Lobby.id))
      .innerJoin(playerX, eq(playerX.id, Game.playerX))
      .innerJoin(playerO, eq(playerO.id, Game.playerO))
      .where(
        and(
          eq(Lobby.status, "finished"),
          or(
            eq(playerX.id, sql.placeholder("userId")),
            eq(playerO.id, sql.placeholder("userId")),
          ),
        ),
      )
      .offset(sql.placeholder("offset"))
      .limit(sql.placeholder("limit"))
      .prepare(),
    _placeholders as { userId: number; offset: number; limit: number },
  );
})();

export const countUserFinishedLobbies = (() => {
  const playerX = aliasedTable(User, "playerX");
  const playerO = aliasedTable(User, "playerO");
  return typePrepared(
    db
      .select({ count: count() })
      .from(Lobby)
      .innerJoin(Game, eq(Game.lobbyId, Lobby.id))
      .innerJoin(playerX, eq(playerX.id, Game.playerX))
      .innerJoin(playerO, eq(playerO.id, Game.playerO))
      .where(
        and(
          eq(Lobby.status, "finished"),
          or(
            eq(playerX.id, sql.placeholder("userId")),
            eq(playerO.id, sql.placeholder("userId")),
          ),
        ),
      )
      .prepare(),
    _placeholders as { userId: number },
  );
})();

export const selectUserAvailableLobbies = typePrepared(
  db
    .select({
      lobbyId: Lobby.id,
      opponent: User.username,
      createdAt: Lobby.createdAt,
    })
    .from(Lobby)
    .innerJoin(User, eq(User.id, Lobby.createdBy))
    .where(
      and(
        eq(Lobby.status, "waiting"),
        ne(Lobby.createdBy, sql.placeholder("userId")),
      ),
    )
    .offset(sql.placeholder("offset"))
    .limit(sql.placeholder("limit"))
    .prepare(),
  _placeholders as { userId: number; offset: number; limit: number },
);

export const countUserAvailableLobbies = typePrepared(
  db
    .select({ count: count() })
    .from(Lobby)
    .innerJoin(User, eq(User.id, Lobby.createdBy))
    .where(
      and(
        eq(Lobby.status, "waiting"),
        ne(Lobby.createdBy, sql.placeholder("userId")),
      ),
    )
    .prepare(),
  _placeholders as { userId: number },
);

export const selectUserWaitingLobbies = typePrepared(
  db
    .select({
      lobbyId: Lobby.id,
      createdAt: Lobby.createdAt,
    })
    .from(Lobby)
    .where(
      and(
        eq(Lobby.status, "waiting"),
        eq(Lobby.createdBy, sql.placeholder("userId")),
      ),
    )
    .offset(sql.placeholder("offset"))
    .limit(sql.placeholder("limit"))
    .prepare(),
  _placeholders as { userId: number; offset: number; limit: number },
);

export const countUserWaitingLobbies = typePrepared(
  db
    .select({ count: count() })
    .from(Lobby)
    .where(
      and(
        eq(Lobby.status, "waiting"),
        eq(Lobby.createdBy, sql.placeholder("userId")),
      ),
    )
    .prepare(),
  _placeholders as { userId: number },
);

export const selectDiscordUserById = typePrepared(
  db
    .select({ userId: DiscordUser.userId, refreshKey: User.refreshKey })
    .from(DiscordUser)
    .innerJoin(User, eq(User.id, DiscordUser.userId))
    .where(eq(DiscordUser.discordId, sql.placeholder("discordId")))
    .prepare(),
  _placeholders as SQLProps<{ discordId: string }>,
);

export const insertUser = typePrepared(
  db
    .insert(User)
    .values({ username: sql.placeholder("username") })
    .returning({ userId: User.id, refreshKey: User.refreshKey })
    .prepare(),
  _placeholders as SQLProps<{ username: string }>,
);

export const insertDiscordUser = typePrepared(
  db
    .insert(DiscordUser)
    .values({
      discordId: sql.placeholder("discordId"),
      userId: sql.placeholder("userId"),
      accessToken: sql.placeholder("accessToken"),
      refreshToken: sql.placeholder("refreshToken"),
      expiresAt: sql.placeholder("expiresAt"),
    })
    .prepare(),
  _placeholders as SQLProps<{
    discordId: string;
    userId: number;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }>,
);

export function updateDiscordUser({
  discordId,
  ...values
}: SQLProps<{
  discordId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}>) {
  db.update(DiscordUser)
    .set(values)
    .where(eq(DiscordUser.discordId, discordId))
    .run();
}

export const selectMoves = typePrepared(
  db
    .select({ ordering: Move.ordering, position: Move.position })
    .from(Move)
    .where(eq(Move.lobbyId, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number },
);

export const insertMove = typePrepared(
  db
    .insert(Move)
    .values({
      lobbyId: sql.placeholder("lobbyId"),
      ordering: sql.placeholder("ordering"),
      position: sql.placeholder("position"),
    })
    .prepare(),
  _placeholders as { lobbyId: number; ordering: number; position: number },
);

export const insertFinishedLobby = typePrepared(
  db
    .insert(FinishedLobby)
    .values({
      id: sql.placeholder("lobbyId"),
      winner: sql.placeholder("winner"),
    })
    .returning({ finishedAt: FinishedLobby.finishedAt })
    .prepare(),
  _placeholders as { lobbyId: number; winner?: number },
);

export function updateLobbyStatus({
  lobbyId,
  toStatus,
  fromStatus,
}: {
  lobbyId: number;
  toStatus: LobbyStatus;
  fromStatus: LobbyStatus;
}) {
  return db
    .update(Lobby)
    .set({ status: toStatus })
    .where(and(eq(Lobby.id, lobbyId), eq(Lobby.status, fromStatus)))
    .returning({ status: Lobby.status, createdBy: Lobby.createdBy })
    .get();
}

export const selectUserByIdRefreshKey = typePrepared(
  db
    .select()
    .from(User)
    .where(
      and(
        eq(User.id, sql.placeholder("userId")),
        eq(User.refreshKey, sql.placeholder("refreshKey")),
      ),
    )
    .prepare(),
  _placeholders as { userId: number; refreshKey: number },
);

export const selectUsernameById = typePrepared(
  db
    .select({ username: User.username })
    .from(User)
    .where(eq(User.id, sql.placeholder("userId")))
    .prepare(),
  _placeholders as { userId: number },
);

// A bug with custom types (which `status` is) combined with placeholder values
// in prepared statements causes them not to be converted to the correct type
// during comparison, leading to never finding the lobby unless the raw integer
// value is used for status.
export function selectLobbyByIdStatusCreatedBy({
  lobbyId,
  status,
  createdBy,
}: {
  lobbyId: number;
  status: LobbyStatus;
  createdBy: number;
}) {
  return db
    .select({ id: Lobby.id })
    .from(Lobby)
    .where(
      and(
        eq(Lobby.id, lobbyId),
        eq(Lobby.status, status),
        eq(Lobby.createdBy, createdBy),
      ),
    )
    .get();
}

export const insertGame = typePrepared(
  db
    .insert(Game)
    .values({
      lobbyId: sql.placeholder("lobbyId"),
      playerX: sql.placeholder("playerX"),
      playerO: sql.placeholder("playerO"),
    })
    .prepare(),
  _placeholders as { lobbyId: number; playerX: number; playerO: number },
);

export const insertLobby = typePrepared(
  db
    .insert(Lobby)
    .values({
      createdBy: sql.placeholder("userId"),
      status: sql.placeholder("status"),
    })
    .returning({ id: Lobby.id, createdAt: Lobby.createdAt })
    .prepare(),
  _placeholders as { userId: number; status: LobbyStatus },
);

export const deleteLobbyById = typePrepared(
  db
    .delete(Lobby)
    .where(eq(Lobby.id, sql.placeholder("id")))
    .prepare(),
  _placeholders as { id: number },
);

export const selectPlayerInGame = typePrepared(
  db
    .select({ playerX: Game.playerX, playerO: Game.playerO })
    .from(Game)
    .where(
      and(
        eq(Game.lobbyId, sql.placeholder("lobbyId")),
        or(
          eq(Game.playerX, sql.placeholder("userId")),
          eq(Game.playerO, sql.placeholder("userId")),
        ),
      ),
    )
    .prepare(),
  _placeholders as { lobbyId: number; userId: number },
);

export function insertMoves(args: { lobbyId: number; moves: number[] }) {
  const { lobbyId, moves } = args;
  db.insert(Move)
    .values(moves.map((position, i) => ({ lobbyId, ordering: i, position })))
    .run();
}

export const selectLobbyById = typePrepared(
  db
    .select()
    .from(Lobby)
    .where(eq(Lobby.id, sql.placeholder("lobbyId"))),
  _placeholders as { lobbyId: number },
);

export const selectFinishedLobbyById = typePrepared(
  db
    .select()
    .from(FinishedLobby)
    .where(eq(FinishedLobby.id, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number },
);

export const selectLobbyStatusById = typePrepared(
  db
    .select({ status: Lobby.status })
    .from(Lobby)
    .where(eq(Lobby.id, sql.placeholder("lobbyId")))
    .prepare(),
  _placeholders as { lobbyId: number },
);
