import fs from "node:fs";
import path from "node:path";
import type { OperatorRecord } from "./types";

const FILE_PATH = path.join(process.cwd(), "runtime-data/operator_master.v1.json");

export function saveMaster(data: OperatorRecord[]) {
  fs.writeFileSync(FILE_PATH, `${JSON.stringify(data, null, 2)}\n`);
}

export function loadMaster(): OperatorRecord[] {
  if (!fs.existsSync(FILE_PATH)) return [];
  return JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
}
