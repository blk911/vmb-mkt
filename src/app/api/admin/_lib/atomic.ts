import fs from "node:fs/promises";
import path from "node:path";

export async function writeJsonAtomic(absPath: string, obj: any) {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  const tmp = absPath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await fs.rename(tmp, absPath);
}
