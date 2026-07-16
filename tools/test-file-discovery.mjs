import { readdir } from "node:fs/promises";
import path from "node:path";

const TEST_FILE_PATTERN = /\.test\.tsx?$/;

export function escapeNodeGlobPath(filePath) {
  // Node treats --test file arguments as glob patterns. Match literal route
  // segments such as Next.js `[id]` directories on every platform.
  return filePath.replaceAll("[", "[[]");
}

export async function collectTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectTestFiles(entryPath);
      }

      return entry.isFile() && TEST_FILE_PATTERN.test(entry.name)
        ? [entryPath]
        : [];
    }),
  );

  return files.flat();
}
