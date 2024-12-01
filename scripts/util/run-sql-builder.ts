type stmt = { toSQL(): any; run(): void };

function runSqlPrint(stmt: stmt) {
  console.log(stmt.toSQL());
  stmt.run();
}

function runSqlNoPrint(stmt: stmt) {
  stmt.run();
}

export default function runSqlBuilder(quiet: boolean) {
  return quiet ? runSqlNoPrint : runSqlPrint;
}
