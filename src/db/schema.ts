import { relations } from "drizzle-orm";
import {
  text,
  sqliteTable as createTable,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { lobbyStatus, number, timestamp } from "./datatypes";
import { UNIX_EPOCH } from "./constants";

export const User = createTable("User", {
  id: number("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().default(UNIX_EPOCH),
});

export const IsComputer = createTable("IsComputer", {
  userId: number("userId")
    .primaryKey()
    .references(() => User.id),
});

export const Lobby = createTable("Lobby", {
  id: number("id").primaryKey({ autoIncrement: true }),
  createdBy: number("createdBy")
    .notNull()
    .references(() => User.id),
  createdAt: timestamp("createdAt").notNull().default(UNIX_EPOCH),
  status: lobbyStatus("status").notNull().default("waiting"),
});

export const FinishedLobby = createTable("FinishedLobby", {
  id: number("id")
    .primaryKey()
    .references(() => Lobby.id),
  finishedAt: timestamp("finishedAt").notNull().default(UNIX_EPOCH),
});

export const Game = createTable("Game", {
  lobbyId: number("lobbyId")
    .primaryKey()
    .references(() => Lobby.id),
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
    lobbyId: number("lobbyId")
      .notNull()
      .references(() => Lobby.id),
    ordering: number("ordering").notNull(),
    position: number("position").notNull(),
  },
  (Move) => ({
    primaryKey: primaryKey({ columns: [Move.lobbyId, Move.ordering] }),
  })
);

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
- ActiveLobby
  - derives one Lobby
  - hosts one Game
- FinishedLobby
  - derives one Lobby
  - hosted one Game
*/

export const UserRelations = relations(User, ({ many }) => ({
  creatorOf: many(Lobby),
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
  belongsTo: one(Lobby, { fields: [Game.lobbyId], references: [Lobby.id] }),
}));

export const MoveRelations = relations(Move, ({ one }) => ({
  belongsTo: one(Lobby, { fields: [Move.lobbyId], references: [Lobby.id] }),
}));

export const LobbyRelations = relations(Lobby, ({ one }) => ({
  createdBy: one(User, { fields: [Lobby.createdBy], references: [User.id] }),
}));

export const FinishedLobbyRelations = relations(FinishedLobby, ({ one }) => ({
  derives: one(Lobby, { fields: [FinishedLobby.id], references: [Lobby.id] }),
  hosted: one(Game, { fields: [FinishedLobby.id], references: [Game.lobbyId] }),
}));
