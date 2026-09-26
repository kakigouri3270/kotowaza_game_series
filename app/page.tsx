"use client";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Volume2, VolumeX, Pause, Move, MousePointer2, RotateCcw, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { createNukaScene, type NukaScene, type NukaState } from "@/lib/nuka-scene";
import { NukaAudio } from "@/lib/nuka-audio";

export default function Home() {
  const mount = useRef<HTMLDivElement>(null), scene = useRef<NukaScene | null>(null), sound = useRef<NukaAudio | null>(null);
  const playingRef = useRef(false), mutedRef = useRef(false), lockedRef = useRef(false);
  const [ready, setReady] = useState(false), [started, setStarted] = useState(false), [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false), [muted, setMuted] = useState(false), [locked, setLocked] = useState(false);
  const [aimed, setAimed] = useState(false), [sceneError, setSceneError] = useState(""), [notice, setNotice] = useState("");
  const [inserted, setInserted] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookMode = useRef<"mouse" | "drag">("mouse");
  const drag = useRef<{ id: number; x: number; y: number; travel: number; type: string } | null>(null);
  const aimRef = useRef(false);
  function audio() {
    try { sound.current ??= new NukaAudio(); sound.current.muted = mutedRef.current; sound.current.unlock(); }
    catch { setNotice("音を再生できません。音なしでも遊べます。"); }
  }
  function insert() {
    if (!playingRef.current || !scene.current?.insert()) return;
    audio(); sound.current?.insert(); setInserted(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setInserted(false), 480);
  }
  function pause() {
    if (!playingRef.current) return;
    playingRef.current = false; setPlaying(false); setPaused(true); scene.current?.setActive(false); drag.current = null;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function enter(mode = lookMode.current) {
    if (!ready) return;
    lookMode.current = mode; audio(); setStarted(true); setPaused(false);
    playingRef.current = true; setPlaying(true); scene.current?.setActive(true);
    const canvas = mount.current?.querySelector("canvas"); canvas?.focus({ preventScroll: true });
    if (mode === "mouse" && !window.matchMedia("(pointer: coarse)").matches && canvas?.requestPointerLock) {
      try {
        void Promise.resolve(canvas.requestPointerLock()).catch(() => {
          lookMode.current = "drag"; setLocked(false); lockedRef.current = false;
        });
      } catch { lookMode.current = "drag"; }
    }
  }
  function toggleSound() {
    const value = !mutedRef.current; mutedRef.current = value; setMuted(value);
    if (sound.current) sound.current.muted = value;
    if (!value) audio();
    try { localStorage.setItem("nuka-muted", String(value)); } catch {}
  }
  const actions = useRef({ insert, pause });
  useEffect(() => { actions.current = { insert, pause }; });
  useEffect(() => {
    // Let the introduction paint before creating the WebGL scene.
    const setupFrame = requestAnimationFrame(() => {
      try { const value = localStorage.getItem("nuka-muted") === "true"; setMuted(value); mutedRef.current = value; } catch {}
      try {
        scene.current = createNukaScene(mount.current!, (state: NukaState) => {
          if (aimRef.current !== state.aimed) { aimRef.current = state.aimed; setAimed(state.aimed); }
        });
        setReady(true);
      } catch (error) {
        console.error(error); setSceneError("3D画面を開けませんでした。WebGL対応のブラウザーでお試しください。");
      }
    });
    const controls = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
    const keydown = (event: KeyboardEvent) => {
      if (!playingRef.current || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === "Escape") { event.preventDefault(); actions.current.pause(); return; }
      if (controls.has(event.code)) { event.preventDefault(); scene.current?.setKey(event.code, true); }
      if ((event.code === "Space" || event.code === "KeyE") && !event.repeat) { event.preventDefault(); actions.current.insert(); }
    };
    const keyup = (event: KeyboardEvent) => scene.current?.setKey(event.code, false);
    const pointer = (event: MouseEvent) => { if (document.pointerLockElement && playingRef.current) scene.current?.look(event.movementX, event.movementY); };
    const lockChange = () => {
      const value = !!document.pointerLockElement;
      const wasLocked = lockedRef.current; lockedRef.current = value; setLocked(value);
      if (wasLocked && !value && playingRef.current) actions.current.pause();
    };
    const lockError = () => { lookMode.current = "drag"; setLocked(false); lockedRef.current = false; };
    const loseFocus = () => actions.current.pause();
    const visibility = () => { if (document.hidden) actions.current.pause(); };
    window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup); window.addEventListener("blur", loseFocus);
    document.addEventListener("mousemove", pointer); document.addEventListener("pointerlockchange", lockChange);
    document.addEventListener("pointerlockerror", lockError); document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(setupFrame);
      window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); window.removeEventListener("blur", loseFocus);
      document.removeEventListener("mousemove", pointer); document.removeEventListener("pointerlockchange", lockChange);
      document.removeEventListener("pointerlockerror", lockError); document.removeEventListener("visibilitychange", visibility);
      if (document.pointerLockElement) document.exitPointerLock();
      if (flashTimer.current) clearTimeout(flashTimer.current);
      scene.current?.dispose(); sound.current?.dispose();
    };
  }, []);
  useEffect(() => {
    type Context = { registerTool: (tool: object, options: { signal: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: Context }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tool = {
      name: "read_game_state", title: "現在の作業部屋の状態",
      description: "一人称ゲームのプレイ状態、位置、糠を狙っているか、現在見えている釘の本数を読み取る。得点やランキングは現在ありません。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true },
      execute(input: unknown) {
        if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) throw new Error("引数は空のオブジェクトにしてください。");
        return { mode: playingRef.current ? "first-person" : "paused-or-intro", ...scene.current?.getState(), sound: mutedRef.current ? "off" : "on" };
      }
    };
    try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(console.error); } catch (error) { console.error(error); }
    return () => lifecycle.abort();
  }, []);
  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!playingRef.current || event.button !== 0) return;
    if (document.pointerLockElement) { insert(); return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, travel: 0, type: event.pointerType };
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const p = drag.current;
    if (!p || p.id !== event.pointerId || document.pointerLockElement) return;
    const dx = event.clientX - p.x, dy = event.clientY - p.y;
    p.travel += Math.hypot(dx, dy); p.x = event.clientX; p.y = event.clientY;
    scene.current?.look(dx, dy);
  }
  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const p = drag.current;
    if (!p || p.id !== event.pointerId) return;
    drag.current = null;
    if (p.travel < 6 && p.type !== "touch") insert();
  }
  function moveDown(event: ReactPointerEvent<HTMLButtonElement>, x: number, y: number) {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); scene.current?.setTouchMove(x, y);
  }
  const stopMove = () => scene.current?.setTouchMove(0, 0);
  return <main className={"game-shell " + (started ? "has-started" : "intro")}>
    <div className="scene" ref={mount} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; }} onContextMenu={e => e.preventDefault()} />
    <div className="vignette" aria-hidden="true"/>
    <header className="masthead">
      <div className="brand"><span className="seal">無益</span><div><span className="eyebrow">ことわざ遊戯 ── 第一作</span><h1>糠に釘<span>NUKA NI KUGI</span></h1></div></div>
      <nav aria-label="ゲームの設定">
        <Button variant="ghost" className="icon-button" onClick={toggleSound} aria-label={muted ? "音を出す" : "音を消す"} title={muted ? "音を出す" : "音を消す"}>{muted ? <VolumeX/> : <Volume2/>}</Button>
        {started && <Button variant="ghost" className="menu-button" onClick={pause}><Pause size={16}/>ひと休み<kbd>ESC</kbd></Button>}
      </nav>
    </header>
    {!started && !sceneError && <section className="welcome" aria-label="ゲームを始める">
      <div className="chapter"><span/>自由に、無心に。</div>
      <h2>好きな場所に、一本。<br/>あとは、糠にまかせよう。</h2>
      <p>小さな部屋を歩いて、釘を刺す。<br/>手応えもなく、ぬるっと沈む。<br/>ただ、それだけの時間。</p>
      <Button className="enter-button" onClick={() => enter("mouse")} disabled={!ready}>{ready ? <>部屋に入る<ArrowUpRight size={20}/></> : <><Loader2 className="animate-spin"/>部屋を準備中…</>}</Button>
      <button className="drag-entry" onClick={() => enter("drag")} disabled={!ready}>ドラッグ操作で入る</button>
      <div className="intro-controls"><span><kbd>W A S D</kbd>歩く</span><span><MousePointer2 size={15}/>見回す・刺す</span></div>
    </section>}
    {sceneError && <div className="error-panel" role="alert"><p>{sceneError}</p><Button onClick={() => location.reload()}>再読み込み</Button></div>}
    {playing && <>
      <div className={"reticle " + (aimed ? "on-target" : "") + (inserted ? " inserted" : "")} aria-hidden="true"><span/></div>
      <div className={"aim-caption " + (inserted ? "soft-feedback" : "")} aria-live="polite">{inserted ? "すうっと、糠のなかへ。" : aimed ? "ここに、一本。" : "糠に近づいて、表面を見よう。"}</div>
      <div className="controls-hud">
        <div className="desktop-controls"><span><kbd>W A S D</kbd>歩く</span><span><MousePointer2 size={15}/>{locked ? "マウスで見回す" : "ドラッグで見回す"}</span><span><kbd>↑ ↓ ← →</kbd>見回す</span></div>
        <div className="touch-move" aria-label="移動">
          {([{ name: "前へ歩く", x: 0, y: -1, icon: <ArrowUp/>, css: "up" }, { name: "左へ歩く", x: -1, y: 0, icon: <ArrowLeft/>, css: "left" }, { name: "後ろへ歩く", x: 0, y: 1, icon: <ArrowDown/>, css: "down" }, { name: "右へ歩く", x: 1, y: 0, icon: <ArrowRight/>, css: "right" }]).map(d => <button key={d.css} className={d.css} aria-label={d.name} onPointerDown={e => moveDown(e, d.x, d.y)} onPointerUp={stopMove} onPointerCancel={stopMove} onLostPointerCapture={stopMove}>{d.icon}</button>)}
          <span><Move size={15}/></span>
        </div>
        <Button className="insert-button" disabled={!aimed} onClick={insert}><span className="nail-icon" aria-hidden="true"/>釘を刺す<kbd>SPACE</kbd></Button>
      </div>
      <span className="touch-look-hint">画面をなぞって、見回す</span>
    </>}
    {!started && <footer className="intro-footer"><span>一人称の、無益なひととき。</span><span>01 / THE PROVERB PLAYROOM</span></footer>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <Dialog open={paused} onOpenChange={value => { if (!value) enter("drag"); }}>
      <DialogContent className="game-dialog" showCloseButton={false} onCloseAutoFocus={event => event.preventDefault()}>
        <DialogHeader><span className="eyebrow">TAKE YOUR TIME</span><DialogTitle>釘も、ひと休み。</DialogTitle><DialogDescription>時間はたっぷり。自分のペースでどうぞ。</DialogDescription></DialogHeader>
        <div className="help-controls">
          <div><kbd>W A S D</kbd><span>部屋を歩く</span></div>
          <div><MousePointer2/><span>マウス、ドラッグ、または矢印キーで見回す</span></div>
          <div><kbd>SPACE / E</kbd><span>中央の目印に釘を刺す。クリックでも。</span></div>
        </div>
        <p className="help-note">糠の上に目印を合わせると、好きな場所へ刺せます。<br/>スマートフォンは左の矢印で移動、画面をなぞって視点を動かします。</p>
        <Button className="resume-button" onClick={() => enter()}><Play size={17}/>部屋に戻る</Button>
        <div className="pause-actions"><Button variant="outline" onClick={() => { scene.current?.resetPlayer(); enter("drag"); }}><RotateCcw size={16}/>糠の前に戻る</Button><Button variant="ghost" onClick={() => enter("drag")}>ドラッグ操作にする</Button></div>
      </DialogContent>
    </Dialog>
  </main>;
}
