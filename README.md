# Elysia with Bun runtime

## Outline

- `/`
  - shows a link to a game creation API
  - shows an interface for logging in
    - try logging in with Discord OAuth instead of a "one-day login"
  - shows a list of lobbies
    - shows a list of active lobbies
    - shows a list of waiting lobbies
    - shows a list of available lobbies
    - shows a history of past lobbies
- `/create-game`
  - shows options for creating a new lobby
    - Player X and Player O types, human or one of three computer difficulties
  - send the user to the newly created lobby once finished
- `/game`
  - shows an active or finished game
  - uses SSEs to stream the state of the board and control what players can do
  - Whenever a user starts watching the game:
    - load the current board configuration (X/O placement and winner)
    - set their permissions
    - start an event stream that sends any changes to their permissions or the board configuration
  - For a user with no permissions, they are only allowed to watch the game
  - For a user with `player` permissions:
    - Has all capabiilities of a user with no permissions
    - If it's their turn, the user can place their own mark on any empty space on the board
    - At any time, the user may forfeit, ending the game early
  - If the board is in a finished state, users cannot modify the board any further
  - If the board is in an unfinished state, one user can

## Getting Started

To get started with this template, simply paste this command into your terminal:

```bash
bun create elysia ./elysia-example
```

## Development

To start the development server run:

```bash
bun run dev
```

Open http://localhost:3000/ with your browser to see the result.
