"use client";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Volume2, VolumeX, Settings2, Move, MousePointer2, RotateCcw, Play, Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { createNukaScene, type NukaScene, type NukaState } from "@/lib/nuka-scene";
import { NukaAudio } from "@/lib/nuka-audio";
import { STATIONS, PLAYER_START, newProgress, type Progress, type StationId } from "@/lib/nuka-physics";
import { NukaSave, SAVE_KEY, type SavedGame } from "@/lib/nuka-save";
import { NukaRanking } from "@/components/nuka-ranking";
import { MouseLookController, SETTINGS_KEY, defaultSettings, parseSettings, lookDelta, type ControlSettings } from "@/lib/nuka-controls";

export default function Home() {
  const mount = useRef<HTMLDivElement>(null), scene = useRef<NukaScene | null>(null), sound = useRef<NukaAudio | null>(null);
  const playingRef = useRef(false), mutedRef = useRef(false);
  const mouseLook = useRef<MouseLookController | null>(null);
  const settingsRef = useRef<ControlSettings>(defaultSettings());
  const [settings, setSettings] = useState(defaultSettings), [settingsNotice, setSettingsNotice] = useState("");
  const [mouseFallback, setMouseFallback] = useState(false);
  const [ready, setReady] = useState(false), [started, setStarted] = useState(false), [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false), [muted, setMuted] = useState(false), [locked, setLocked] = useState(false);
  const [aimed, setAimed] = useState(false), [sceneError, setSceneError] = useState(""), [notice, setNotice] = useState("");
  const [inserted, setInserted] = useState(false);
  const [grounded, setGrounded] = useState(true);
  const [progress, setProgress] = useState<Progress>(newProgress);
  const saveStore = useRef<NukaSave | null>(null);
  const [saved, setSaved] = useState<SavedGame | null>(null), [saveStatus, setSaveStatus] = useState("記録を準備中…");
  const [rankingOpen, setRankingOpen] = useState(false);
  const [station, setStation] = useState<StationId | null>(null);
  const [position, setPosition] = useState({ x: PLAYER_START.x, z: PLAYER_START.z, yaw: 0 });
  const [reaction, setReaction] = useState("すうっと、糠のなかへ。");
  const progressRef = useRef<Progress | null>(null), stationRef = useRef<StationId | null>(null), positionKey = useRef("");
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const aimRef = useRef(false);
  function audio() {
    try { sound.current ??= new NukaAudio(); sound.current.muted = mutedRef.current; sound.current.unlock(); }
    catch { setNotice("音を再生できません。音なしでも遊べます。"); }
  }
  function insert() {
    if (!playingRef.current) return;
    const stationId = scene.current?.insert();
    if (!stationId) return;
    void saveStore.current?.add(stationId);
    const place = STATIONS.find(s => s.id === stationId)!;
    const tally = scene.current!.getState().progress;
    const milestone = tally.byStation[stationId] === 10;
    setReaction(milestone ? place.name + "、10本達成。" : place.description);
    audio(); sound.current?.insert(stationId); setInserted(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setInserted(false), milestone ? 2200 : 650);
  }
  function pause() {
    playingRef.current = false; setPlaying(false); setPaused(true); scene.current?.setActive(false); drag.current = null;
    mouseLook.current?.stop();
  }
  function jump() {
    if (playingRef.current) scene.current?.jump();
  }
  function openRanking() { if (playingRef.current) pause(); setRankingOpen(true); }
  function enter() {
    if (!ready) return;
    audio(); setStarted(true); setPaused(false); setRankingOpen(false); setMouseFallback(false);
    playingRef.current = true; setPlaying(true); scene.current?.setActive(true);
    const canvas = mount.current?.querySelector("canvas"); canvas?.focus({ preventScroll: true });
    mouseLook.current?.start(!window.matchMedia("(pointer: coarse)").matches);
  }
  function changeSettings(change: Partial<ControlSettings>) {
    const next = { ...settingsRef.current, ...change };
    settingsRef.current = next; setSettings(next);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); setSettingsNotice("設定を保存しました。"); }
    catch { setSettingsNotice("このブラウザーでは設定を保存できません。今回のプレイには適用されます。"); }
  }
  function look(dx: number, dy: number) {
    const delta = lookDelta(dx, dy, settingsRef.current);
    scene.current?.look(delta.x, delta.y);
  }
  function toggleSound() {
    const value = !mutedRef.current; mutedRef.current = value; setMuted(value);
    if (sound.current) sound.current.muted = value;
    if (!value) audio();
    try { localStorage.setItem("nuka-muted", String(value)); } catch {}
  }
  const actions = useRef({ insert, pause, jump });
  useEffect(() => { actions.current = { insert, pause, jump }; });
  useEffect(() => {
    let disposed = false;
    const store = new NukaSave({ getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value), removeItem: key => localStorage.removeItem(key), key: index => localStorage.key(index), get length() { return localStorage.length; } }, (value, status) => {
      if (disposed) return;
      setSaved(value); setSaveStatus(status);
      if (scene.current) scene.current.restoreProgress(value.progress); else setProgress(value.progress);
    }, async fn => navigator.locks ? await navigator.locks.request(SAVE_KEY, fn) : await fn());
    saveStore.current = store;
    const loaded = store.load();
    const sync = () => { void store.sync(); };
    const storageChanged = (event: StorageEvent) => { if (event.key === SAVE_KEY) void store.refresh(); };
    const syncTimer = setInterval(sync, 15000);
    window.addEventListener("online", sync); window.addEventListener("storage", storageChanged);
    // Let the introduction paint before creating the WebGL scene.
    const setupFrame = requestAnimationFrame(async () => {
      await loaded;
      if (disposed) return;
      try { const value = localStorage.getItem("nuka-muted") === "true"; setMuted(value); mutedRef.current = value; } catch {}
      try { const value = parseSettings(localStorage.getItem(SETTINGS_KEY)); settingsRef.current = value; setSettings(value); } catch {}
      try {
        scene.current = createNukaScene(mount.current!, (state: NukaState) => {
          setGrounded(state.player.grounded);
          if (aimRef.current !== state.aimed) { aimRef.current = state.aimed; setAimed(state.aimed); }
          if (progressRef.current !== state.progress) { progressRef.current = state.progress; setProgress(state.progress); }
          if (stationRef.current !== state.station) { stationRef.current = state.station; setStation(state.station); }
          const key = [state.player.x, state.player.z, state.player.yaw].map(v => v.toFixed(2)).join(",");
          if (positionKey.current !== key) { positionKey.current = key; setPosition({ x: state.player.x, z: state.player.z, yaw: state.player.yaw }); }
        }, store.current.progress);
        mouseLook.current = new MouseLookController({
          document, surface: mount.current!.querySelector("canvas")!, look,
          pause: () => actions.current.pause(), lockChanged: value => { setLocked(value); if (value) setMouseFallback(false); },
          unavailable: () => setMouseFallback(true),
        });
        setReady(true);
        sync();
      } catch (error) {
        console.error(error); setSceneError("3D画面を開けませんでした。WebGL対応のブラウザーでお試しください。");
      }
    });
    const controls = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"]);
    const keydown = (event: KeyboardEvent) => {
      if (!playingRef.current || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === "Escape") { event.preventDefault(); actions.current.pause(); return; }
      if (controls.has(event.code)) { event.preventDefault(); scene.current?.setKey(event.code, true); }
      if (event.code === "Space") { event.preventDefault(); if (!event.repeat) actions.current.jump(); }
      if (event.code === "KeyE") { event.preventDefault(); if (!event.repeat) actions.current.insert(); }
    };
    const keyup = (event: KeyboardEvent) => scene.current?.setKey(event.code, false);
    const loseFocus = () => { if (playingRef.current) actions.current.pause(); };
    const visibility = () => { if (document.hidden) { loseFocus(); sync(); } };
    window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup); window.addEventListener("blur", loseFocus);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      clearInterval(syncTimer);
      window.removeEventListener("online", sync); window.removeEventListener("storage", storageChanged);
      cancelAnimationFrame(setupFrame);
      window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); window.removeEventListener("blur", loseFocus);
      document.removeEventListener("visibilitychange", visibility);
      mouseLook.current?.dispose(); mouseLook.current = null;
      if (flashTimer.current) clearTimeout(flashTimer.current);
      scene.current?.dispose(); scene.current = null; sound.current?.dispose();
    };
  }, []);
  useEffect(() => {
    type Context = { registerTool: (tool: object, options: { signal: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: Context }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tool = {
      name: "read_game_state", title: "現在の作業部屋の状態",
      description: "糠の回廊の位置・ジャンプの高さと接地状態、狙っている糠場、保存される累計本数、3か所それぞれの本数、沈んでいる釘を読み取る。保存用の秘密情報は返しません。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true },
      execute(input: unknown) {
        if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) throw new Error("引数は空のオブジェクトにしてください。");
        return { mode: playingRef.current ? "first-person" : "paused-or-intro", ...scene.current?.getState(), pointerLocked: !!document.pointerLockElement, settings: settingsRef.current, sound: mutedRef.current ? "off" : "on" };
      }
    };
    try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(console.error); } catch (error) { console.error(error); }
    return () => lifecycle.abort();
  }, []);
  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!playingRef.current || event.button !== 0) return;
    if (event.pointerType === "mouse") { insert(); return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const p = drag.current;
    if (!p || p.id !== event.pointerId || document.pointerLockElement) return;
    const dx = event.clientX - p.x, dy = event.clientY - p.y;
    p.x = event.clientX; p.y = event.clientY;
    look(dx, dy);
  }
  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const p = drag.current;
    if (!p || p.id !== event.pointerId) return;
    drag.current = null;
  }
  function moveDown(event: ReactPointerEvent<HTMLButtonElement>, x: number, y: number) {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); scene.current?.setTouchMove(x, y);
  }
  const stopMove = () => scene.current?.setTouchMove(0, 0);
  const completed = STATIONS.filter(s => progress.byStation[s.id] >= 10).length;
  const targetStation = STATIONS.find(s => s.id === station);
  return <main className={"game-shell " + (started ? "has-started" : "intro")}>
    <div className={"scene " + (playing ? "is-playing" : "")} ref={mount} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; }} onContextMenu={e => e.preventDefault()} />
    <div className="vignette" aria-hidden="true"/>
    <header className="masthead">
      <div className="brand"><span className="seal">無益</span><div><span className="eyebrow">ことわざ遊戯 ── 第一作</span><h1>糠に釘<span>NUKA NI KUGI</span></h1></div></div>
      <nav aria-label="ゲームの設定">
        <Button variant="ghost" className="icon-button" onClick={openRanking} aria-label="累計ランキングTOP10" title="累計ランキングTOP10"><Trophy size={19}/></Button>
        <Button variant="ghost" className="icon-button" onClick={toggleSound} aria-label={muted ? "音を出す" : "音を消す"} title={muted ? "音を出す" : "音を消す"}>{muted ? <VolumeX/> : <Volume2/>}</Button>
        <Button variant="ghost" className="menu-button" onClick={pause} aria-label="設定・メニュー"><Settings2 size={16}/>メニュー<kbd>ESC</kbd></Button>
      </nav>
    </header>
    {!started && !sceneError && <section className="welcome" aria-label="ゲームを始める">
      <div className="chapter"><span/>自由に、無心に。</div>
      <h2>好きな場所に、一本。<br/>あとは、糠にまかせよう。</h2>
      <p>広い回廊を歩いて、三つの糠をめぐる。<br/>さらさら、ぬるぬる、ねばねば。<br/>まずは、それぞれに10本ずつ。</p>
      <div className="welcome-record">これまでの累計 <strong>{progress.total.toLocaleString()}</strong> 本 <button onClick={openRanking}>TOP 10を見る <ArrowUpRight size={13}/></button></div>
      <Button className="enter-button" onClick={enter} disabled={!ready}>{ready ? <>部屋に入る<ArrowUpRight size={20}/></> : <><Loader2 className="animate-spin"/>部屋を準備中…</>}</Button>
      <p className="entry-hint">マウスを動かして見回す。Escで設定・ランキング。</p>
      <div className="intro-controls"><span><kbd>W A S D</kbd>歩く</span><span><kbd>SPACE</kbd>ジャンプ</span><span><MousePointer2 size={15}/>見回す・刺す</span></div>
    </section>}
    {sceneError && <div className="error-panel" role="alert"><p>{sceneError}</p><Button onClick={() => location.reload()}>再読み込み</Button></div>}
    {playing && <>
      <aside className="tally-hud" aria-label="釘の本数と糠場めぐり">
        <span className="tally-label">これまで刺した釘</span>
        <div className="tally-number"><output aria-label="累計の釘の本数">{progress.total.toLocaleString()}</output><span>本</span></div>
        <div className="tour-heading">{completed === 3 ? "糠場めぐり、達成。" : "三つの糠に10本ずつ"}<span>{completed} / 3</span></div>
        <ul className="station-checklist">{STATIONS.map(s => <li key={s.id} className={(progress.byStation[s.id] >= 10 ? "done " : "") + (station === s.id ? "current" : "")}><span className="station-number" style={{ color: s.accent }}>{progress.byStation[s.id] >= 10 ? "✓" : s.number}</span><span>{s.name}</span><strong>{Math.min(10, progress.byStation[s.id])}<small> / 10</small></strong></li>)}</ul>
        {completed === 3 && <p className="tour-complete">あとは、心ゆくまで。</p>}
      </aside>
      {settings.showMap && <figure className="workshop-map" aria-label="糠場の地図。水色のさらさら糠は奥の左、橙色のねばねば糠は奥の右。白い矢印が現在地。">
        <figcaption>糠の回廊</figcaption>
        <svg viewBox="0 0 120 108" role="img" aria-label="三つの糠場と現在地"><rect x="2" y="2" width="116" height="104" rx="3" fill="#162d24" stroke="#93ab8b66"/><path d="M29 28 L60 68 L91 28" stroke="#abc59b44" strokeWidth="1" fill="none"/>{STATIONS.map(s => <g key={s.id} transform={"translate(" + ((s.x + 10) * 6) + " " + ((s.z + 9) * 6) + ")"}><rect x="-8" y="-5" width="16" height="10" rx="1" fill={s.accent}/><text y="-9" fill={s.accent} textAnchor="middle" fontSize="8">{s.number}</text></g>)}<g transform={"translate(" + ((position.x + 10) * 6) + " " + ((position.z + 9) * 6) + ") rotate(" + (-position.yaw * 180 / Math.PI) + ")"}><circle r="7" fill="#ffffff18"/><path d="M0 -5 L4 4 L0 2 L-4 4 Z" fill="#fff6de"/></g></svg>
        <span>▲ 現在地</span>
      </figure>}
      <div className={"reticle " + (aimed ? "on-target" : "") + (inserted ? " inserted" : "")} aria-hidden="true"><span/></div>
      <div className={"aim-caption " + (inserted ? "soft-feedback" : "")} aria-live="polite">{inserted ? reaction : aimed ? targetStation?.name + "に、一本。" : settings.showMap ? "地図を頼りに、次の糠場へ。" : "次の糠場を探してみよう。"}</div>
      <div className="controls-hud">
        <div className="desktop-controls"><span><kbd>W A S D</kbd>歩く</span><span><kbd>SHIFT</kbd>早歩き</span><span><MousePointer2 size={15}/>マウスで見回す</span><span><kbd>ESC</kbd>設定・ランキング</span></div>
        <div className="touch-move" aria-label="移動">
          {([{ name: "前へ歩く", x: 0, y: -1, icon: <ArrowUp/>, css: "up" }, { name: "左へ歩く", x: -1, y: 0, icon: <ArrowLeft/>, css: "left" }, { name: "後ろへ歩く", x: 0, y: 1, icon: <ArrowDown/>, css: "down" }, { name: "右へ歩く", x: 1, y: 0, icon: <ArrowRight/>, css: "right" }]).map(d => <button key={d.css} className={d.css} aria-label={d.name} onPointerDown={e => moveDown(e, d.x, d.y)} onPointerUp={stopMove} onPointerCancel={stopMove} onLostPointerCapture={stopMove}>{d.icon}</button>)}
          <span><Move size={15}/></span>
        </div>
        <div className="action-buttons">
          <Button className="jump-button" disabled={!grounded} onClick={jump}><ArrowUp size={18}/>ジャンプ<kbd>SPACE</kbd></Button>
          <Button className="insert-button" disabled={!aimed} onClick={insert}><span className="nail-icon" aria-hidden="true"/>釘を刺す<kbd>E</kbd></Button>
        </div>
      </div>
      <span className="touch-look-hint">画面をなぞって、見回す</span>
    </>}
    {!started && <footer className="intro-footer"><span>一人称の、無益なひととき。</span><span>01 / THE PROVERB PLAYROOM</span></footer>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <NukaRanking open={rankingOpen} onClose={() => setRankingOpen(false)} store={saveStore.current} saved={saved} status={saveStatus}/>
    <Dialog open={paused && !rankingOpen}>
      <DialogContent className="game-dialog settings-dialog" showCloseButton={false} onEscapeKeyDown={event => event.preventDefault()} onInteractOutside={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}>
        <DialogHeader><span className="eyebrow">TAKE YOUR TIME</span><DialogTitle>釘も、ひと休み。</DialogTitle><DialogDescription>設定を整えたら、また一本。メニュー中はゲームが止まります。</DialogDescription></DialogHeader>
        <Button className="resume-button" onClick={enter} disabled={!ready}><Play size={17}/>{started ? "ゲームに戻る" : "部屋に入る"}</Button>
        <Button variant="outline" className="ranking-menu-button" onClick={openRanking}><Trophy size={17}/><span>累計 TOP 10</span><strong>{progress.total.toLocaleString()} 本</strong><ArrowUpRight size={16}/></Button>
        <fieldset className="control-settings"><legend>操作と表示</legend>
          <div className="sensitivity-heading"><label htmlFor="look-sensitivity">マウス感度</label><output htmlFor="look-sensitivity">{settings.sensitivity.toFixed(2)} ×</output></div>
          <input id="look-sensitivity" type="range" min="0.25" max="3" step="0.05" value={settings.sensitivity} onChange={event => changeSettings({ sensitivity: Number(event.target.value) })}/>
          <div className="sensitivity-scale"><span>ゆっくり</span><span>すばやく</span></div>
          <label className="setting-toggle"><span>視点の上下を反転</span><input type="checkbox" checked={settings.invertY} onChange={event => changeSettings({ invertY: event.target.checked })}/></label>
          <label className="setting-toggle"><span>地図を表示</span><input type="checkbox" checked={settings.showMap} onChange={event => changeSettings({ showMap: event.target.checked })}/></label>
          <label className="setting-toggle"><span>効果音を鳴らす</span><input type="checkbox" checked={!muted} onChange={toggleSound}/></label>
          <button className="settings-reset" onClick={() => changeSettings(defaultSettings())}>操作・表示設定を初期値に戻す</button>
          <p className="save-status" role="status">{settingsNotice || "設定はこのブラウザーに自動保存されます。"}</p>
        </fieldset>
        {mouseFallback && !locked && <p className="help-note">このブラウザーではカーソル固定が使えません。マウスを動かすだけで見回せます。さらに回りたいときは画面の端へ寄せ、止めたいときは中央へ戻してください。</p>}
        <details className="controls-help"><summary>操作方法と遊び方</summary><div className="help-controls">
          <div><kbd>W A S D / SHIFT</kbd><span>歩く / 走る</span></div>
          <div><MousePointer2/><span>マウスを動かすだけで見回す。矢印キーでも操作できます。</span></div>
          <div><kbd>SPACE</kbd><span>ジャンプ</span></div>
          <div><kbd>E / クリック</kbd><span>中央の目印に釘を刺す</span></div>
          <div><kbd>ESC</kbd><span>メニューを開く。再開は「ゲームに戻る」。</span></div>
        </div><p className="help-note">3か所の糠に10本ずつ刺してみましょう。累計と進捗は同じブラウザーで引き継ぎます。<br/>スマートフォンは左の矢印で移動、画面をなぞって視点移動。右のボタンでジャンプ・釘刺し。</p></details>
        <Button variant="outline" onClick={() => { scene.current?.resetPlayer(); enter(); }} disabled={!ready}><RotateCcw size={16}/>糠の前に戻る</Button>
        <p className="save-status" role="status">{saveStatus}</p>
      </DialogContent>
    </Dialog>
  </main>;
}
