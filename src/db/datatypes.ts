import { customType, integer } from "drizzle-orm/sqlite-core";

type UnionOf<A extends unknown[]> = A extends [
  infer Str extends unknown,
  ...infer Rest extends unknown[]
]
  ? Str | UnionOf<Rest>
  : A extends []
  ? never
  : A extends (infer T)[]
  ? T
  : unknown;

type IndexUnionOf<A extends unknown[]> = A extends [
  unknown,
  ...infer Rest extends unknown[]
]
  ? Rest extends { length: infer N extends number }
    ? N | IndexUnionOf<Rest>
    : never
  : A extends []
  ? never
  : number;

export type InferEnum<T> = T extends ReturnType<
  typeof customType<{
    data: infer S;
    driverData: infer _;
  }>
>
  ? S
  : never;

export function enumType<S extends string[]>(values: S) {
  type ConvertedData = UnionOf<S>;
  type DriverData = IndexUnionOf<S>;
  const fromMap = values;
  const toMap = {} as { [_ in ConvertedData]: DriverData };
  for (const [key, value] of values.entries()) {
    toMap[value as ConvertedData] = key as DriverData;
  }
  return customType<{
    data: ConvertedData;
    driverData: DriverData;
  }>({
    dataType: () => "integer",
    fromDriver(key) {
      const value = fromMap[key] as ConvertedData;
      if (value === undefined) {
        throw new Error(`invalid internal enum '${value}'`);
      }
      return value;
    },
    toDriver(value) {
      const key = toMap[value];
      if (key === undefined) {
        throw new Error(`invalid external enum '${key}'`);
      }
      return key;
    },
  });
}

export const lobbyStatus = enumType(["waiting", "active", "finished"] as const);
export type LobbyStatus = InferEnum<typeof lobbyStatus>;

export function number<S extends string>(name: S) {
  return integer(name, { mode: "number" });
}

export function timestamp<S extends string>(name: S) {
  return integer(name, { mode: "timestamp" });
}
