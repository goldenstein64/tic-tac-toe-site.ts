import { InferInsertModel, InferSelectModel, relations } from "drizzle-orm";
import {
  text,
  sqliteTable as createTable,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";

import { lobbyStatus, number, timestamp } from "./datatypes";
import { UNIX_EPOCH } from "./constants";

export const User = createTable("User", {
  id: number().primaryKey({ autoIncrement: true }),
  username: text().notNull(),
  createdAt: timestamp().notNull().default(UNIX_EPOCH),
  refreshKey: number().notNull().default(1),
});
export type SelectUser = InferSelectModel<typeof User>;
export type InsertUser = InferInsertModel<typeof User>;

export const DiscordUser = createTable("DiscordUser", {
  discordId: text().primaryKey(),
  userId: number()
    .notNull()
    .references(() => User.id),
  accessToken: text().notNull(),
  refreshToken: text().notNull(),
  expiresAt: timestamp().notNull(),
});
export type SelectDiscordUser = InferSelectModel<typeof DiscordUser>;
export type InsertDiscordUser = InferInsertModel<typeof DiscordUser>;

export const IsComputer = createTable("IsComputer", {
  userId: number()
    .primaryKey()
    .references(() => User.id),
});
export type SelectIsComputer = InferSelectModel<typeof IsComputer>;
export type InsertIsComputer = InferInsertModel<typeof IsComputer>;

export const Lobby = createTable("Lobby", {
  id: number().primaryKey({ autoIncrement: true }),
  createdBy: number()
    .notNull()
    .references(() => User.id),
  createdAt: timestamp().notNull().default(UNIX_EPOCH),
  status: lobbyStatus().notNull().default("waiting"),
});
export type SelectLobby = InferSelectModel<typeof Lobby>;
export type InsertLobby = InferInsertModel<typeof Lobby>;

export const FinishedLobby = createTable("FinishedLobby", {
  id: number()
    .primaryKey()
    .references(() => Lobby.id),
  finishedAt: timestamp().notNull().default(UNIX_EPOCH),
  winner: number().references(() => User.id),
});
export type SelectFinishedLobby = InferSelectModel<typeof FinishedLobby>;
export type InsertFinishedLobby = InferInsertModel<typeof FinishedLobby>;

export const Game = createTable("Game", {
  lobbyId: number()
    .primaryKey()
    .references(() => Lobby.id),
  playerX: number()
    .notNull()
    .references(() => User.id),
  playerO: number()
    .notNull()
    .references(() => User.id),
});
export type SelectGame = InferSelectModel<typeof Game>;
export type InsertGame = InferInsertModel<typeof Game>;

export const Move = createTable(
  "Move",
  {
    lobbyId: number()
      .notNull()
      .references(() => Lobby.id),
    ordering: number().notNull(),
    position: number().notNull(),
  },
  (Move) => [
    index("LobbyMove").on(Move.lobbyId),
    primaryKey({ columns: [Move.lobbyId, Move.ordering] }),
  ]
);
export type SelectMove = InferSelectModel<typeof Move>;
export type InsertMove = InferInsertModel<typeof Move>;

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
