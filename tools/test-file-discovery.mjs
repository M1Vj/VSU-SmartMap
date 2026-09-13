import { readdir } from "node:fs/promises";
import path from "node:path";

const TEST_FILE_PATTERN = /\.test\.tsx?$/;
const PROJECT_TEST_ROOTS = ["app", "components", "lib", "tools"];

export async function collectProjectTestFiles() {
  const [nestedTestFiles, rootEntries] = await Promise.all([
    Promise.all(PROJECT_TEST_ROOTS.map(collectTestFiles)),
    readdir(".", { withFileTypes: true }),
  ]);
  const rootTestFiles = rootEntries
    .filter((entry) => entry.isFile() && TEST_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name);

  return [...nestedTestFiles.flat(), ...rootTestFiles].sort();
}

export function escapeNodeGlobPath(filePath) {
  // Node treats --test file arguments as glob patterns. Match literal route
  // segments such as Next.js `[id]` directories on every platform.
  return filePath.replaceAll("[", "[[]");
}

export function toNodeTestArgument(filePath, nodeMajorVersion) {
  // Node 22+ expands --test arguments as globs. Node 20 expects literal paths.
  return nodeMajorVersion >= 22 ? escapeNodeGlobPath(filePath) : filePath;
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
