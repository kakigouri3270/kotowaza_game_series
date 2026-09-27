import test from 'node:test';
import assert from 'node:assert/strict';
import { movePlayer, canPlaceNail, nailDepth, PLAYER_START, BRAN_X, BRAN_Z, REACH, ROOM, STATIONS, newProgress, recordNail } from '../lib/nuka-physics.ts';

test('walks freely, collides with table even at large steps, slides along edge', () => {
  const free = movePlayer(PLAYER_START, 0.5, 0);
  assert.ok(Math.abs(free.x - 0.5) < 1e-9);
  const stopped = movePlayer(PLAYER_START, 0, -8);
  assert.ok(stopped.z >= 1.29 && stopped.z < 1.38);
  const slide = movePlayer(stopped, 2.2, -0.1);
  assert.ok(slide.x > 2 && slide.z > 1.1);
});
test('keeps the player inside room boundaries from every direction', () => {
  assert.deepEqual(movePlayer({x:8,z:7},10,10),{x:ROOM.x,z:ROOM.z});
  assert.deepEqual(movePlayer({x:-8,z:-7},-10,-10),{x:-ROOM.x,z:-ROOM.z});
});
test('permits all reachable spots but not rim, floor, or distant bran', () => {
  assert.ok(canPlaceNail(0,0,2));
  assert.ok(canPlaceNail(BRAN_X-.08,BRAN_Z-.08,REACH));
  assert.equal(canPlaceNail(BRAN_X,0,1),false);
  assert.equal(canPlaceNail(0,BRAN_Z,1),false);
  assert.equal(canPlaceNail(0,0,REACH+.01),false);
  assert.equal(canPlaceNail(NaN,0,1),false);
  assert.equal(canPlaceNail(0,0,-1),false);
});
test('nails sink continuously and fully disappear, regardless of chosen lifetime', () => {
  for (const duration of STATIONS.map(s => s.duration)) {
    let previous=nailDepth(0,duration);
    assert.equal(previous,0.1);
    for(let age=.01;age<=duration;age+=.01) {
      const current=nailDepth(age,duration);
      assert.ok(current>=previous && current-previous<.012);
      previous=current;
    }
    assert.ok(nailDepth(duration,duration)>.6);
    assert.equal(nailDepth(duration+100,duration),nailDepth(duration,duration));
    assert.ok(nailDepth(.2,duration)<.22);
  }
});

test('all three stations accept nails and stop the player at their front edge', () => {
  for (const station of STATIONS) {
    assert.ok(canPlaceNail(station.x, station.z, 2));
    assert.equal(canPlaceNail(station.x + BRAN_X, station.z, 2), false);
    const stopped = movePlayer({x:station.x,z:station.z+2.3},0,-2);
    assert.ok(stopped.z >= station.z+1.29 && stopped.z < station.z+1.4);
  }
  assert.equal(canPlaceNail(3,3,1),false);
});
test('cumulative and per-station counts stay consistent beyond the tour goal', () => {
  const initial = newProgress();
  let progress = initial;
  for (const station of STATIONS) for (let i=0;i<10;i++) progress=recordNail(progress,station.id);
  assert.equal(initial.total,0);
  assert.deepEqual(progress,{total:30,byStation:{standard:10,silky:10,sticky:10}});
  progress=recordNail(progress,'sticky');
  assert.equal(progress.total,31);
  assert.equal(progress.byStation.sticky,11);
  assert.equal(progress.total,Object.values(progress.byStation).reduce((a,b)=>a+b,0));
});
