# tic-tac-toe-site2

A website that lets users play tic-tac-toe against each other online. It keeps a record of saved games and uses Discord OAuth2 to implement user authentication and individual game history.

## Outline

- `/login`
  - shows an interface for logging in
    - with Discord
- `/`
  - redirects to `/login` if unauthorized
  - shows a link to a game creation API
  - shows a list of lobbies
    - that are active
    - that are waiting for another player (that isn't you) to join
    - that are available for you to join
    - that are finished
- `/new-lobby`
  - redirects to `/login` if unauthorized
  - shows options for creating a new lobby
    - Player X and Player O types, human or one of three computer difficulties
  - send the user to the newly created lobby once finished
- `/game`
  - redirects to `/login` if unauthorized
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

## Getting Started

To get started, clone this repo and run:

```bash
bun install
```

## Development

To start the development server, run:

```bash
bun dev start --watch
```

Open http://localhost:3000/ with your browser to see the result.

## Testing

To run tests, run:

```bash
bun run test
```

## Deployment

To start the production server, run:

```bash
bun prod start
```
