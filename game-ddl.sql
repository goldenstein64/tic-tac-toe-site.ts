CREATE TABLE "User" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"username" TEXT UNIQUE CHECK (LENGTH(username) BETWEEN 1 AND 32),
	"createdAt" INTEGER DEFAULT (unixepoch()) NOT NULL
) STRICT;

CREATE TABLE "IsComputer" (
	"userId" INTEGER PRIMARY KEY REFERENCES "User"("id")
) STRICT;

CREATE TABLE "Game" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"playerX" INTEGER REFERENCES "User"("id") NOT NULL,
	"playerO" INTEGER REFERENCES "User"("id") NOT NULL
) STRICT;

CREATE TABLE "Move" (
	"gameId" INTEGER REFERENCES "Game"("id"),
	"ordering" INTEGER, -- 1-9, odds are X and evens are O
	"position" INTEGER, -- 1-9, left-to-right, top-to-bottom
	-- the player is inferred from ordering
	PRIMARY KEY ("gameId", "ordering")
) STRICT;

CREATE TABLE "Lobby" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"createdBy" INTEGER REFERENCES "User"("id") NOT NULL,
	"createdAt" INTEGER DEFAULT (unixepoch()) NOT NULL,
	-- 0 = waiting, 1 = active, 2 = finished
	"lobbyStatus" INTEGER DEFAULT 0 NOT NULL
) STRICT;

CREATE TABLE "ActiveLobby" (
	"id" INTEGER PRIMARY KEY REFERENCES "Lobby"("id"),
	"gameId" INTEGER REFERENCES "Game"("id") NOT NULL
) STRICT;

CREATE TABLE "FinishedLobby" (
	"id" INTEGER PRIMARY KEY REFERENCES "Lobby"("id"),
	"finishedAt" INTEGER DEFAULT (unixepoch()) NOT NULL,
	"gameId" INTEGER REFERENCES "Game"("id") NOT NULL
) STRICT;

INSERT INTO "User" ("id", "username") VALUES
	(1, 'EasyComputer'),
	(2, 'MediumComputer'),
	(3, 'HardComputer');

INSERT INTO "IsComputer" ("userId") VALUES (1), (2), (3);

INSERT INTO "Game" ("id", "playerX", "playerO") VALUES (1, 1, 1);
