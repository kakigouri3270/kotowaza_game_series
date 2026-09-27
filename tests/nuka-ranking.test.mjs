import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker, { NukaLeaderboard } from '../worker/index.ts';

function database() {
  const db = new DatabaseSync(':memory:');
  const sql = { exec(query, ...args) {
    if (query.startsWith('CREATE TABLE')) { db.exec(query); return { toArray: () => [] }; }
    const rows = db.prepare(query).all(...args);
    return { toArray: () => rows };
  }};
  return new NukaLeaderboard({storage:{sql}});
}
const token = n => n.toString(16).padStart(64, '0');
function sync(board, n, count, extra = {}) {
  return board.fetch(new Request('https://game.test/api/progress', {method:'POST', headers:{Authorization:'Bearer '+token(n),'Content-Type':'application/json','CF-Connecting-IP':'test-'+n}, body:JSON.stringify({progress:{total:count,byStation:{standard:count,silky:0,sticky:0}},...extra})}));
}
const top = async board => (await (await board.fetch(new Request('https://game.test/api/leaderboard'))).json()).entries;

test('shared ranking contains at most ten real players, in descending cumulative order', async () => {
  const board = database();
  for(let i=1;i<=12;i++) assert.equal((await sync(board,i,i,{name:'プレイヤー'+i})).status,200);
  const entries = await top(board);
  assert.equal(entries.length,10);
  assert.deepEqual(entries.map(e=>e.total),[12,11,10,9,8,7,6,5,4,3]);
  assert.deepEqual(Object.keys(entries[0]).sort(),['id','name','total']);
  assert.equal(JSON.stringify(entries).includes(token(12)),false);
});
test('retries and stale totals cannot double count or decrease a record; naming keeps identity', async () => {
  const board = database();
  const first = await (await sync(board,1,5)).json();
  await sync(board,1,5); await sync(board,1,2);
  const renamed = await (await sync(board,1,5,{name:'ぬか太郎'})).json();
  assert.equal(renamed.id,first.id); assert.equal(renamed.name,'ぬか太郎');
  const entries = await top(board);
  assert.equal(entries.length,1); assert.equal(entries[0].total,5);
});
test('empty and tied rankings are stable; zero counts do not get listed', async () => {
  const board = database(); assert.deepEqual(await top(board),[]);
  await sync(board,1,0); assert.deepEqual(await top(board),[]);
  const a = await (await sync(board,1,5)).json();
  await new Promise(r => setTimeout(r,5));
  const b = await (await sync(board,2,5)).json();
  await sync(board,1,5,{name:'変更後'});
  assert.deepEqual((await top(board)).map(e=>e.id),[a.id,b.id]);
});
test('invalid payloads, unauthenticated writes, impossible scores and cross-origin writes are blocked', async () => {
  const board = database();
  assert.equal((await board.fetch(new Request('https://game.test/api/progress',{method:'POST'}))).status,401);
  assert.equal((await sync(board,1,-1)).status,400);
  assert.equal((await sync(board,1,1,{name:'<script>'})).status,400);
  const suspicious = await (await sync(board,1,999999)).json();
  assert.equal(suspicious.pending,true); assert.equal(suspicious.progress.total,0);
  assert.deepEqual(await top(board),[]);
  const response = await worker.fetch(new Request('https://game.test/api/progress',{method:'POST',headers:{Origin:'https://other.test'}}),{});
  assert.equal(response.status,403);
});
test('local progress survives an API outage response', async () => {
  const response = await worker.fetch(new Request('https://game.test/api/leaderboard'),{LEADERBOARD:{idFromName:()=>1,get:()=>({fetch:()=>{throw new Error('quota')}})}});
  assert.equal(response.status,503);
  assert.match((await response.json()).error,/端末/);
});
