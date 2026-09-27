import test from 'node:test';
import assert from 'node:assert/strict';
import { MouseLookController, defaultSettings, parseSettings, lookDelta } from '../lib/nuka-controls.ts';

function harness(request = () => Promise.resolve()) {
  const document = new EventTarget(), surface = new EventTarget();
  const moves = []; let requests = 0, pauses = 0, unavailable = 0, overSurface = true;
  surface.contains = () => overSurface;
  surface.getBoundingClientRect = () => ({left:0,top:0,right:1280,bottom:720});
  let nextFrame;
  document.defaultView = {requestAnimationFrame:fn=>{nextFrame=fn;return 1},cancelAnimationFrame:()=>{nextFrame=null}};
  surface.requestPointerLock = () => { requests++; return request(); };
  document.pointerLockElement = null;
  document.exitPointerLock = () => { document.pointerLockElement = null; document.dispatchEvent(new Event('pointerlockchange')); };
  const controller = new MouseLookController({document,surface,look:(x,y)=>moves.push([x,y]),pause:()=>{pauses++;controller.stop()},lockChanged:()=>{},unavailable:()=>unavailable++});
  return { controller, moves, get requests(){return requests}, get pauses(){return pauses}, get unavailable(){return unavailable},
    move(x,y,dx=0,dy=0){ document.dispatchEvent(Object.assign(new Event('mousemove'),{clientX:x,clientY:y,movementX:dx,movementY:dy,buttons:0})); },
    lock(value){document.pointerLockElement=value?surface:null;document.dispatchEvent(new Event('pointerlockchange'));},
    leave(){surface.dispatchEvent(new Event('mouseleave'));}, outside(value){overSurface=!value}, frame(now){const fn=nextFrame;nextFrame=null;fn?.(now)},
  };
}
test('free-look uses mouse movement with no button held when pointer lock is unavailable', () => {
  const h = harness(() => {throw new Error('not supported')});
  h.controller.start(); h.move(10,20); h.move(45,10);
  assert.deepEqual(h.moves,[[35,-10]]); assert.equal(h.unavailable,1);
  h.leave(); h.move(200,200); assert.equal(h.moves.length,1);
  h.move(210,205); assert.deepEqual(h.moves[1],[10,5]);
  h.controller.dispose();
});
test('every resume retries pointer lock and handles escape without moving in the menu', () => {
  const h = harness();
  h.controller.start(); h.lock(true); h.move(0,0,12,-4);
  assert.deepEqual(h.moves,[[12,-4]]);
  h.lock(false); assert.equal(h.pauses,1);
  h.move(20,40,10,10); assert.equal(h.moves.length,1);
  h.controller.start(); h.lock(true); h.move(0,0,8,2);
  assert.equal(h.requests,2); assert.deepEqual(h.moves[1],[8,2]);
  h.controller.dispose(); h.move(0,0,99,99); assert.equal(h.moves.length,2);
});
test('menu/UI movement and a delayed lock rejection do not restart or change paused controls', async () => {
  let reject;
  const h = harness(() => new Promise((_,r)=>{reject=r}));
  h.controller.start(); h.move(0,0); h.outside(true); h.move(900,500); h.outside(false); h.move(20,20);
  assert.deepEqual(h.moves,[]);
  h.controller.stop(); reject(new Error('denied')); await Promise.resolve();
  assert.equal(h.unavailable,0); assert.equal(h.pauses,0);
  h.lock(true); assert.equal(h.pauses,0);
  h.controller.dispose();
});
test('touch start does not request mouse capture; sensitivity scales both axes and inversion only flips vertical', () => {
  const h = harness(); h.controller.start(false); assert.equal(h.requests,0); h.controller.dispose();
  assert.deepEqual(lookDelta(20,-10,{sensitivity:2,invertY:false,showMap:true}),{x:40,y:-20});
  assert.deepEqual(lookDelta(20,-10,{sensitivity:0.5,invertY:true,showMap:false}),{x:10,y:5});
});
test('fallback edge turning continues without a held button, and stops on leaving or opening the menu', () => {
  const h = harness(() => { throw new Error('unsupported'); });
  h.controller.start(); h.move(1275,350); h.frame(0); h.frame(20); h.frame(40);
  assert.deepEqual(h.moves,[[12,0],[12,0]]);
  h.leave(); h.frame(60); assert.equal(h.moves.length,2);
  h.move(1275,350); h.frame(80); h.controller.stop(); h.frame(100); assert.equal(h.moves.length,2);
  h.controller.dispose();
});
test('settings restore, clamp invalid values, and recover from malformed local data', () => {
  assert.deepEqual(parseSettings('bad json'),defaultSettings());
  assert.deepEqual(parseSettings(JSON.stringify({sensitivity:1.75,invertY:true,showMap:false})),{sensitivity:1.75,invertY:true,showMap:false});
  assert.equal(parseSettings('{"sensitivity":-10}').sensitivity,0.25);
  assert.equal(parseSettings('{"sensitivity":100}').sensitivity,3);
  assert.equal(parseSettings('{"sensitivity":"2"}').sensitivity,1);
  assert.deepEqual(parseSettings('null'),defaultSettings());
});
