import type { OperatorRecord } from "./types";
import { rankOperator } from "./ranking";

export function getOutreachTargets(operators: OperatorRecord[]) {
  return operators
    .filter((op) => op.status === "hot")
    .map((op) => ({
      ...op,
      rank: rankOperator(op),
    }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 25);
}
