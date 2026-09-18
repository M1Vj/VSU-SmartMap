/**
 * Regression coverage for the @humanfs/node 0.16.7 -> 0.16.8 security bump
 * (GHSA-p498-v437-472g, Moderate 5.7, CWE-22: symlink copyFile dereference
 * file-disclosure in copy()/copyAll(), fixed by 22bbaa4; @humanfs/core
 * 0.19.1 -> 0.19.2, new runtime dep @humanfs/types 0.15.0).
 *
 * Behavioral change under test: copy() and copyAll() must preserve symlinks
 * as symlinks (lstat + readlink + symlink) instead of dereferencing them via
 * fs.promises.copyFile(). A symlink inside a copied tree must NOT cause
 * bytes from outside the source tree to materialise as a regular file in the
 * destination.
 *
 * Hermeticity / gating: this test uses only node: builtins and os.tmpdir()
 * scratch space. No network, no Supabase, no external binaries. If
 * @humanfs/node cannot be resolved (transitive dev-only dep via eslint
 * tooling), each test skips with a clear reason instead of failing, so the
 * suite stays hermetic on minimal installs. There are no empty catches:
 * every catch logs.
 */
import assert from "node:assert/strict";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

type NodeHfsCtor = new () => {
  copy(source: string, destination: string): Promise<void>;
  copyAll(source: string, destination: string): Promise<void>;
};

async function loadNodeHfs(): Promise<NodeHfsCtor | null> {
  try {
    const mod = (await import("@humanfs/node")) as unknown as {
      NodeHfs?: NodeHfsCtor;
      default?: { NodeHfs?: NodeHfsCtor };
    };
    const NodeHfs = mod.NodeHfs ?? mod.default?.NodeHfs;
    if (!NodeHfs) {
      console.log(
        "[humanfs-symlink-regression] SKIP: @humanfs/node resolved but did not export NodeHfs.",
      );
      return null;
    }
    return NodeHfs;
  } catch (error) {
    const code =
      error instanceof Error
        ? // @ts-expect-error - loader errors may carry a code property
          (error.code ?? error.message)
        : String(error);
    console.log(
      `[humanfs-symlink-regression] SKIP: @humanfs/node is not resolvable (${String(code)}). Install dev dependencies to enable symlink regression coverage.`,
    );
    return null;
  }
}

async function withScratch(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "humanfs-symlink-"));
  try {
    await fn(root);
  } finally {
    try {
      await rm(root, { recursive: true, force: true });
    } catch (error) {
      console.error(
        `[humanfs-symlink-regression] failed to remove scratch dir ${root}:`,
        error,
      );
    }
  }
}

test("humanfs copy() preserves a symlink as a symlink", async (t) => {
  const NodeHfs = await loadNodeHfs();
  if (!NodeHfs) {
    t.skip(
      "SKIP: @humanfs/node not installed; symlink regression needs dev dependencies.",
    );
    return;
  }

  await withScratch(async (root) => {
    const secret = path.join(root, "secret.txt");
    const link = path.join(root, "link.txt");
    const dest = path.join(root, "dest-link.txt");
    await writeFile(secret, "TOPSECRET", "utf8");
    await symlink(secret, link);

    const hfs = new NodeHfs();
    await hfs.copy(link, dest);

    const destStat = await lstat(dest).catch((error: unknown) => {
      console.error(
        `[humanfs-symlink-regression] lstat(${dest}) failed:`,
        error,
      );
      throw error;
    });
    assert.equal(
      destStat.isSymbolicLink(),
      true,
      "copy() must preserve the symlink instead of dereferencing it into a regular file",
    );
    const target = await readlink(dest).catch((error: unknown) => {
      console.error(
        `[humanfs-symlink-regression] readlink(${dest}) failed:`,
        error,
      );
      throw error;
    });
    assert.equal(
      target,
      secret,
      "copied symlink must point at the original link target",
    );
  });
});

test("humanfs copyAll() does not disclose files outside the source tree", async (t) => {
  const NodeHfs = await loadNodeHfs();
  if (!NodeHfs) {
    t.skip(
      "SKIP: @humanfs/node not installed; symlink regression needs dev dependencies.",
    );
    return;
  }

  await withScratch(async (root) => {
    const secret = path.join(root, "secret.txt");
    const src = path.join(root, "src");
    const dst = path.join(root, "dst");
    await writeFile(secret, "TOPSECRET", "utf8");
    await mkdir(src, { recursive: true });
    await writeFile(path.join(src, "hello.txt"), "hello", "utf8");
    // Attacker-controlled symlink inside the copied tree pointing outside it.
    await symlink(secret, path.join(src, "link.txt"));

    const hfs = new NodeHfs();
    await hfs.copyAll(src, dst);

    const copiedLink = path.join(dst, "link.txt");
    const copiedStat = await lstat(copiedLink).catch((error: unknown) => {
      console.error(
        `[humanfs-symlink-regression] lstat(${copiedLink}) failed:`,
        error,
      );
      throw error;
    });
    assert.equal(
      copiedStat.isSymbolicLink(),
      true,
      "copyAll() must preserve inner symlinks as symlinks (fixed 22bbaa4); a regular file here means the pre-0.16.8 dereference bug is present",
    );
    assert.equal(
      copiedStat.isFile(),
      false,
      "destination link must not be a regular file",
    );
    const target = await readlink(copiedLink).catch((error: unknown) => {
      console.error(
        `[humanfs-symlink-regression] readlink(${copiedLink}) failed:`,
        error,
      );
      throw error;
    });
    assert.equal(
      target,
      secret,
      "copied symlink target must be preserved verbatim",
    );
    // The regular file alongside the link must still be copied normally.
    const hello = await readFile(path.join(dst, "hello.txt"), "utf8").catch(
      (error: unknown) => {
        console.error(
          "[humanfs-symlink-regression] reading copied hello.txt failed:",
          error,
        );
        throw error;
      },
    );
    assert.equal(hello, "hello");
  });
});

test("humanfs copyAll() preserves nested-directory symlinks", async (t) => {
  const NodeHfs = await loadNodeHfs();
  if (!NodeHfs) {
    t.skip(
      "SKIP: @humanfs/node not installed; symlink regression needs dev dependencies.",
    );
    return;
  }

  await withScratch(async (root) => {
    const secret = path.join(root, "secret.txt");
    const src = path.join(root, "src");
    const nested = path.join(src, "nested");
    const dst = path.join(root, "dst");
    await writeFile(secret, "TOPSECRET", "utf8");
    await mkdir(nested, { recursive: true });
    await symlink(secret, path.join(nested, "deep-link.txt"));

    const hfs = new NodeHfs();
    await hfs.copyAll(src, dst);

    const copied = path.join(dst, "nested", "deep-link.txt");
    const st = await lstat(copied).catch((error: unknown) => {
      console.error(
        `[humanfs-symlink-regression] lstat(${copied}) failed:`,
        error,
      );
      throw error;
    });
    assert.equal(
      st.isSymbolicLink(),
      true,
      "nested symlinks must also be preserved as symlinks",
    );
  });
});