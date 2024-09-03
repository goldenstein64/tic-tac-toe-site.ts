CREATE TABLE User (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT CHECK (LENGTH(username) BETWEEN 8 AND 32),
	winCount INTEGER DEFAULT (0)
) STRICT;

CREATE TABLE IsComputer (
	userId INTEGER PRIMARY KEY REFERENCES User(id)
) STRICT;

CREATE TABLE Game (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	playerX INTEGER REFERENCES User(id),
	playerO INTEGER REFERENCES User(id)
) STRICT;

CREATE TABLE Move (
	gameId INTEGER REFERENCES Game(id),
	ordering INTEGER, -- 1-9, odds are X and evens are O
	position INTEGER, -- 1-9, left-to-right, top-to-bottom
	-- the player is inferred from ordering
	PRIMARY KEY (gameId, ordering)
) STRICT;

INSERT INTO User (id, username, winCount) VALUES
	(1, 'EasyComputer', 0),
	(2, 'MediumComputer', 0),
	(3, 'HardComputer', 0);

INSERT INTO IsComputer (userId) VALUES (1), (2), (3);

INSERT INTO Game (id, playerX, playerO) VALUES (1, 1, 1);
