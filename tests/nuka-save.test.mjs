import test from 'node:test';
import assert from 'node:assert/strict';
import { NukaSave, SAVE_KEY, parseSave, parseProgress, mergeProgress, validName, emptyProgress } from '../lib/nuka-save.ts';

const memory = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k), key: i => [...data.keys()][i] ?? null, get length() { return data.size; } }; };
const lock = () => { let pending = Promise.resolve(); return fn => { const next = pending.then(fn); pending = next.catch(() => {}); return next; }; };
const offline = async () => { throw new Error('offline'); };

test('restores total, per-station progress and the same private identity after reload', async () => {
  const storage = memory(); const sharedLock = lock();
  const first = new NukaSave(storage, () => {}, sharedLock, offline);
  await first.load(); await first.add('standard'); await first.add('sticky');
  assert.equal(await first.sync(), false);
  const next = new NukaSave(storage, () => {}, sharedLock, offline);
  await next.load();
  assert.equal(next.current.token, first.current.token);
  assert.deepEqual(next.current.progress, { total: 2, byStation: { standard: 1, silky: 0, sticky: 1 } });
});
test('two browser tabs serialize simultaneous nails without duplicate or lost counts', async () => {
  const storage = memory(); const sharedLock = lock();
  const a = new NukaSave(storage, () => {}, sharedLock, offline);
  const b = new NukaSave(storage, () => {}, sharedLock, offline);
  await Promise.all([a.load(), b.load()]);
  assert.equal(a.current.token, b.current.token);
  await Promise.all(Array.from({length:40}, (_, i) => (i % 2 ? a : b).add(i % 2 ? 'standard' : 'silky')));
  await a.refresh();
  assert.deepEqual(a.current.progress, { total: 40, byStation: { standard: 20, silky: 20, sticky: 0 } });
});
test('an in-flight sync cannot erase nails inserted after the request started', async () => {
  let finish; let entered;
  const requestStarted = new Promise(resolve => { entered = resolve; });
  const responseReady = new Promise(resolve => { finish = resolve; });
  const store = new NukaSave(memory(), () => {}, lock(), async () => { entered(); return responseReady; });
  await store.load(); await store.add('standard');
  const syncing = store.sync(); await requestStarted;
  await store.add('sticky');
  finish(Response.json({ id: 'public-id', name: '糠の旅人', progress: { total: 1, byStation: { standard: 1, silky: 0, sticky: 0 } }, pending: false }));
  assert.equal(await syncing, true);
  assert.equal(store.current.progress.total, 2);
  assert.equal(store.current.syncedTotal, 1);
});
test('a nail survives an immediate reload before the async lock runs, and is replayed only once', async () => {
  const storage = memory();
  const initial = new NukaSave(storage, () => {}, lock(), offline);
  await initial.load();
  const blocked = new NukaSave(storage, () => {}, () => new Promise(() => {}), offline);
  blocked.current = initial.current;
  void blocked.add('sticky');
  const restored = new NukaSave(storage, () => {}, lock(), offline);
  const remove = storage.removeItem;
  storage.removeItem = () => { throw new Error('closed after commit'); };
  await restored.load(); assert.equal(restored.current.progress.total, 1);
  storage.removeItem = remove;
  const replay = new NukaSave(storage, () => {}, lock(), offline);
  await replay.load(); assert.equal(replay.current.progress.total, 1);
});
test('storage failure keeps session counts and reports that persistence is unavailable', async () => {
  const storage = memory(); let status = '';
  const store = new NukaSave(storage, (_, text) => { status = text; }, lock(), offline);
  await store.load();
  storage.setItem = () => { throw new Error('quota'); };
  await store.add('standard'); await store.add('standard');
  assert.equal(store.current.progress.total, 2);
  assert.equal(store.persistent, false);
  assert.match(status, /保存できません/);
});
test('corrupt saves are not overwritten; invalid totals and names are rejected', async () => {
  const storage = memory(); storage.setItem(SAVE_KEY, '{broken');
  const store = new NukaSave(storage, () => {}, lock(), offline);
  await store.load(); await store.add('standard');
  assert.equal(storage.getItem(SAVE_KEY), '{broken');
  assert.equal(parseSave('{broken'), null);
  for (const total of [-1, NaN, 1.5, 1e15]) assert.equal(parseProgress({total, byStation:{standard:total,silky:0,sticky:0}}), null);
  assert.equal(parseProgress({total:10,byStation:{standard:1,silky:0,sticky:0}}), null);
  assert.equal(validName('<script>'), false); assert.equal(validName('a\n'), false);
  assert.equal(validName('釘を刺す人'), true);
  assert.equal(mergeProgress(emptyProgress(), {total:2,byStation:{standard:1,silky:1,sticky:0}}).total, 2);
});
