import { relations, sql } from "drizzle-orm";
import {
  text,
  integer,
  sqliteTable as createTable,
  primaryKey,
  customType,
} from "drizzle-orm/sqlite-core";

const lobbyStatus = customType<{
  data: "waiting" | "active" | "finished";
  driverData: 0 | 1 | 2;
  notNull: true;
  default: true;
}>({
  dataType() {
    return "integer";
  },
  fromDriver(val) {
    switch (val) {
      case 0:
        return "waiting";
      case 1:
        return "active";
      case 2:
        return "finished";
      default:
        throw new Error("invalid lobby status");
    }
  },
  toDriver(val) {
    switch (val) {
      case "waiting":
        return 0;
      case "active":
        return 1;
      case "finished":
        return 2;
      default:
        throw new Error("invalid lobby status");
    }
  },
});

function number<S extends string>(name: S) {
  return integer(name, { mode: "number" });
}

function timestamp<S extends string>(name: S) {
  return integer(name, { mode: "timestamp" });
}

export const User = createTable("User", {
  id: number("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  winCount: number("winCount").notNull().default(0),
});

export const IsComputer = createTable("IsComputer", {
  userId: number("userId")
    .primaryKey()
    .references(() => User.id),
});

export const Game = createTable("Game", {
  id: number("id").primaryKey({ autoIncrement: true }),
  playerX: number("playerX")
    .notNull()
    .references(() => User.id),
  playerO: number("playerO")
    .notNull()
    .references(() => User.id),
});

export const Move = createTable(
  "Move",
  {
    gameId: number("gameId")
      .notNull()
      .references(() => Game.id),
    ordering: number("ordering").notNull(),
    position: number("position").notNull(),
  },
  (Move) => ({
    primaryKey: primaryKey({ columns: [Move.gameId, Move.ordering] }),
  })
);

export const Lobby = createTable("Lobby", {
  id: number("id").primaryKey({ autoIncrement: true }),
  createdBy: number("createdBy")
    .notNull()
    .references(() => User.id),
  createdAt: timestamp("createdAt")
    .notNull()
    .default(sql`(unixepoch())`),
  status: lobbyStatus("status").notNull().default("waiting"),
});

export const WaitingLobby = createTable("WaitingLobby", {
  id: number("id")
    .primaryKey()
    .references(() => Lobby.id),
  waitingUser: number("waitingUser")
    .notNull()
    .references(() => User.id),
});

export const ActiveLobby = createTable("ActiveLobby", {
  id: number("id")
    .primaryKey()
    .references(() => Lobby.id),
  gameId: number("gameId")
    .notNull()
    .references(() => Game.id),
});

export const FinishedLobby = createTable("FinishedLobby", {
  id: number("id")
    .primaryKey()
    .references(() => Lobby.id),
  finishedAt: timestamp("finishedAt")
    .notNull()
    .default(sql`(unixepoch())`),
  gameId: number("gameId")
    .notNull()
    .references(() => Game.id),
});

/*
- User
  - creates many Lobbies
  - waits in many WaitingLobbies
  - plays as X in many Games
  - plays as O in many Games
- IsComputer
  - records one User
- Game
  - X played by one User
  - O played by one User
  - makes many Moves
- Move
  - belongs to one Game
- Lobby
  - created by one User
- WaitingLobby
  - derives one Lobby
  - waiting with one User
- ActiveLobby
  - derives one Lobby
  - hosts one Game
- FinishedLobby
  - derives one Lobby
  - hosted one Game
*/

export const UserRelations = relations(User, ({ many }) => ({
  creatorOf: many(Lobby),
  waitsIn: many(WaitingLobby),
  playsXsIn: many(Game),
  playsOsIn: many(Game),
}));

export const IsComputerRelations = relations(IsComputer, ({ one }) => ({
  records: one(User, { fields: [IsComputer.userId], references: [User.id] }),
}));

export const GameRelations = relations(Game, ({ one, many }) => ({
  XsPlayedBy: one(User, { fields: [Game.playerX], references: [User.id] }),
  OsPlayedBy: one(User, { fields: [Game.playerO], references: [User.id] }),
  composes: many(Move),
}));

export const LobbyRelations = relations(Lobby, ({ one }) => ({
  createdBy: one(User, { fields: [Lobby.createdBy], references: [User.id] }),
}));

export const WaitingLobbyRelations = relations(WaitingLobby, ({ one }) => ({
  derives: one(Lobby, { fields: [WaitingLobby.id], references: [Lobby.id] }),
  waiting: one(User, {
    fields: [WaitingLobby.waitingUser],
    references: [User.id],
  }),
}));

export const ActiveLobbyRelations = relations(ActiveLobby, ({ one }) => ({
  derives: one(Lobby, { fields: [ActiveLobby.id], references: [Lobby.id] }),
  hosts: one(Game, { fields: [ActiveLobby.gameId], references: [Game.id] }),
}));

export const FinishedLobbyRelations = relations(FinishedLobby, ({ one }) => ({
  derives: one(Lobby, { fields: [FinishedLobby.id], references: [Lobby.id] }),
  hosted: one(Game, { fields: [FinishedLobby.gameId], references: [Game.id] }),
}));
