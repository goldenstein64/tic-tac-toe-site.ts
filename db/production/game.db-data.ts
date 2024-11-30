import type { DataConfig } from "../../scripts/reset-db";

import { User, IsComputer } from "../../src/db/schema";
import { db } from "../../src/db";
import runSqlBuilder from "../../scripts/util/run-sql-builder";

export default function prodInitialData({ quiet = false }: DataConfig) {
  const runSql = runSqlBuilder(quiet);

  // UTC, 24-hour time
  const easyCreated = new Date(Date.UTC(2024, 3 - 1, 6, 1, 47)); // 2024/3/6 1:47
  const mediumCreated = new Date(Date.UTC(2023, 8 - 1, 4, 22, 35)); // 2023/8/4 22:35
  const hardCreated = new Date(Date.UTC(2023, 7, 8 - 1, 1, 23)); // 2023/8/7 1:23

  const refreshKey = 1;
  runSql(
    db.insert(User).values([
      { id: 1, username: "EasyComputer", createdAt: easyCreated, refreshKey },
      {
        id: 2,
        username: "MediumComputer",
        createdAt: mediumCreated,
        refreshKey,
      },
      { id: 3, username: "HardComputer", createdAt: hardCreated, refreshKey },
    ])
  );

  runSql(
    db.insert(IsComputer).values([{ userId: 1 }, { userId: 2 }, { userId: 3 }])
  );
}
