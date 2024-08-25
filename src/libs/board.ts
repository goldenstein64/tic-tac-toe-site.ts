export type Mark = "X" | "O";

export const WIN_PATTERNS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export class Board {
  data: [
    Mark | undefined,
    Mark | undefined,
    Mark | undefined,
    Mark | undefined,
    Mark | undefined,
    Mark | undefined,
    Mark | undefined,
    Mark | undefined,
    Mark | undefined
  ];

  constructor() {
    this.data = [
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ];
  }

  won(mark: Mark): boolean {
    return WIN_PATTERNS.some((pattern) =>
      pattern.every((pos) => this.data[pos] === mark)
    );
  }

  full(): boolean {
    return this.data.every((value) => value !== undefined);
  }

  empty(): boolean {
    return this.data.every((value) => value === undefined);
  }
}
