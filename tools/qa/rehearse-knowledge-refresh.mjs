import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
// This standalone rehearsal creates only anonymous, in-memory PGlite databases.
const [previousRoot, candidateRoot, fixtureRoot] = process.argv.slice(2);
if (!previousRoot || !candidateRoot || !fixtureRoot) {
  throw new Error('Usage: node rehearse-knowledge-refresh.mjs OLD_CHECKOUT CANDIDATE_CHECKOUT PGLITE_INSTALL_DIR');
}
const packageDir = resolve(fixtureRoot, 'node_modules', '@electric-sql', 'pglite');
const packageFile = resolve(packageDir, 'package.json');
const tool = JSON.parse(await readFile(packageFile, 'utf8'));
assert.equal(tool.name, '@electric-sql/pglite');
assert.equal(tool.version, '0.6.0', 'use the pinned disposable fixture version');
const { PGlite } = createRequire(packageFile)(packageDir);
const read = (r,n) => readFile(`${r}/supabase/${n}`,'utf8');
const [oldSeed,newSeed,preview] = await Promise.all([
  read(previousRoot,'seed_ai_knowledge_vsu.sql'),
  read(candidateRoot,'seed_ai_knowledge_vsu.sql'),
  read(candidateRoot,'patch_ai_knowledge_vsu_20261127.sql'),
]);
const originalMigration = await read(previousRoot,'migrations/20260530000000_ai_knowledge_entries.sql');
const indexStart = originalMigration.indexOf('CREATE INDEX');
assert.ok(indexStart > 0, 'expected a table definition before indexes in the stock migration');
const ddl = originalMigration.slice(0, indexStart);
const ordered = `SELECT id,title,content,keywords,source,priority,is_active FROM public.ai_knowledge_entries ORDER BY id`;
const get = async (db,title) => (await db.query('select id,title,content,source,keywords,priority,is_active from ai_knowledge_entries where title=$1',[title])).rows;
test('fresh seed fills missing titles and repeated seed preserves editorial edits', async t => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(ddl);
  await db.exec(newSeed);
  const before = (await db.query(ordered)).rows;
  assert.equal(before.length, 23);
  const title = 'VSU Learning Commons Library hours and services';
  let [entry] = await get(db,title);
  assert.match(entry.content,/Saturday hours/);
  await db.query('update ai_knowledge_entries set content=$1,is_active=false where id=$2',['Synthetic local editor text',entry.id]);
  const missing = before.find(row => row.title !== title);
  assert.ok(missing);
  await db.query('delete from ai_knowledge_entries where id=$1', [missing.id]);
  await db.exec(newSeed);
  const [restored] = await get(db, missing.title);
  assert.notEqual(restored.id, missing.id);
  assert.deepEqual({ ...restored, id: missing.id }, missing);
  const [kept] = await get(db,title);
  assert.equal(kept.id,entry.id);
  assert.equal(kept.content,'Synthetic local editor text');
  assert.equal(kept.is_active,false);
  assert.equal((await db.query(ordered)).rows.length,before.length);
});
test('guarded preview rolls back and exact-row apply preserves duplicates, edits and inactive state', async t => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(ddl);
  await db.exec(newSeed);
  const replacements = new Map((await db.query(ordered)).rows.map(({ title, content, source }) => [title, { content, source }]));
  await db.exec('TRUNCATE TABLE public.ai_knowledge_entries');
  await db.exec(oldSeed);
  const edit = 'VSU College Admission Test basics', duplicate = 'VSU SmartMap room code and subject code guidance', reweighted = 'VSU SmartMap location matching rules';
  const inactive = 'VSU SmartMap directions and route limits';
  await db.query('update ai_knowledge_entries set content=$1 where title=$2',['Synthetic local editor correction',edit]);
  await db.query('update ai_knowledge_entries set priority=3 where title=$1',[reweighted]);
  await db.query('update ai_knowledge_entries set is_active=false where title=$1',[inactive]);
  await db.query("insert into ai_knowledge_entries(title, content, keywords, source, priority) values ($1,'Synthetic duplicate', array['fixture'], 'fixture:local', 1)",[duplicate]);
  const before = (await db.query(ordered)).rows;
  assert.ok(/\bROLLBACK;\s*$/.test(preview));
  const affected = results => results.flatMap(r => r.rows);
  const sortById = rows => rows.toSorted((a, b) => a.id.localeCompare(b.id));
  const dryRows = affected(await db.exec(preview));
  const dry = dryRows.map(r => r.title);
  assert.equal(dry.length,12);
  assert.ok(dry.includes(inactive));
  for(const skip of [edit,duplicate,reweighted])assert.ok(!dry.includes(skip));
  assert.deepEqual((await db.query(ordered)).rows,before);
  const commit = preview.replace(/\bROLLBACK;\s*$/,'COMMIT;');
  const applied = affected(await db.exec(commit));
  assert.deepEqual(sortById(applied), sortById(dryRows));
  const after = (await db.query(ordered)).rows;
  assert.equal(before.length,after.length);
  for(const [i,record] of after.entries()){
    const prev=before[i];
    assert.deepEqual([record.id,record.title,record.is_active,record.priority,record.keywords],[prev.id,prev.title,prev.is_active,prev.priority,prev.keywords]);
    if(!dry.includes(record.title))assert.deepEqual(record,prev);
    else {
      assert.notEqual(record.content,prev.content);
      assert.deepEqual({ content: record.content, source: record.source }, replacements.get(record.title));
      assert.ok(applied.some(row => row.id === record.id && row.title === record.title));
    }
  }
  assert.deepEqual(affected(await db.exec(commit)),[]);
});
