CREATE TABLE User (
	id INT PRIMARY KEY,
	username NVARCHAR(32) CHECK (LENGTH(username) BETWEEN 8 AND 32),
	winCount INT DEFAULT (0)
);

CREATE TABLE IsComputer (
	userId INT PRIMARY KEY REFERENCES User(id)
);

CREATE TABLE Game (
	id INT PRIMARY KEY,
	playerX INT REFERENCES User(id),
	playerO INT REFERENCES User(id)
);

CREATE TABLE Move (
	gameId INT REFERENCES Game(id),
	ordering INT, -- 1-9, odds are X and evens are O
	position INT, -- 1-9, left-to-right, top-to-bottom
	-- the player is inferred from ordering
	PRIMARY KEY (gameId, ordering)
);

INSERT INTO User (id, username, winCount) VALUES
	(1, 'EasyComputer', 0),
	(2, 'MediumComputer', 0),
	(3, 'HardComputer', 0);

INSERT INTO IsComputer (userId) VALUES (1), (2), (3);

INSERT INTO Game (id, playerX, playerO) VALUES (1, 1, 1);
