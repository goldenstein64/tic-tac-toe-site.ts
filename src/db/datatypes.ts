import { customType, integer } from "drizzle-orm/sqlite-core";

type UnionOf<S extends string[]> = S extends [
  infer Str extends string,
  ...infer Rest extends string[]
]
  ? Str | UnionOf<Rest>
  : never;

export type InferEnum<T> = T extends ReturnType<
  typeof customType<{
    data: infer S extends string;
    driverData: number;
    notNull: true;
    default: true;
  }>
>
  ? S
  : never;

export function enumType<S extends string[]>(values: S) {
  type ConvertedData = UnionOf<S>;
  type DriverData = number;
  const fromMap = new Map<DriverData, ConvertedData>();
  const toMap = new Map<ConvertedData, DriverData>();
  for (const [key, value] of values.entries()) {
    fromMap.set(key as DriverData, value as ConvertedData);
    toMap.set(value as ConvertedData, key as DriverData);
  }
  return customType<{
    data: ConvertedData;
    driverData: DriverData;
    notNull: true;
    default: true;
  }>({
    dataType: () => "integer",
    fromDriver(key) {
      const value = fromMap.get(key);
      if (value === undefined) {
        throw new Error(`invalid internal enum '${value}'`);
      }
      return value;
    },
    toDriver(value) {
      const key = toMap.get(value);
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
