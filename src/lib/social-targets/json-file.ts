import fs from "fs/promises";
import path from "path";

export async function readJsonArrayFile<T>(filePath: string, fallback: T[]): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const trimmed = raw.trim();
    if (!trimmed) return [...fallback];
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) ? (parsed as T[]) : [...fallback];
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? (e as NodeJS.ErrnoException).code : "";
    if (code === "ENOENT") return [...fallback];
    return [...fallback];
  }
}

export async function writeJsonFilePretty(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const text = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(filePath, text, "utf8");
}
