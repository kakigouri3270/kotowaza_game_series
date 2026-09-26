"use client";
import { useEffect, useRef, useState } from "react";
import { Hammer, Volume2, VolumeX, Trophy, RotateCcw, CircleHelp, ArrowUpRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { createNukaScene, type NukaScene } from "@/lib/nuka-scene";
import { NukaAudio } from "@/lib/nuka-audio";
import { judgeHit, scoreRun, PERIOD, DURATION, type HitEvent, type Grade } from "@/lib/scoring";

type Mode = "idle" | "starting" | "ranked" | "result" | "free";
type Entry = { name: string; score: number; maxCombo: number; perfect: number; hits: number; createdAt: number };
type Panel = "ranking" | "result" | "help" | null;
const emptyScore = scoreRun([]);
async function requestJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000) });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "通信できませんでした。もう一度お試しください。");
  return data;
}
export default function Home() {
  const mount = useRef<HTMLDivElement>(null), scene = useRef<NukaScene | null>(null), sound = useRef<NukaAudio | null>(null);
  const origin = useRef(0), meter = useRef<HTMLSpanElement>(null), events = useRef<HitEvent[]>([]), lastHit = useRef(-1000);
  const runId = useRef(""), modeRef = useRef<Mode>("idle"), panelRef = useRef<Panel>(null), lastPanel = useRef<Panel>("help"), scoreRef = useRef(emptyScore), savedEvents = useRef<HitEvent[]>([]);
  const [mode, setMode] = useState<Mode>("idle"), [panel, setPanel] = useState<Panel>(null), [stats, setStats] = useState(emptyScore);
  const [remaining, setRemaining] = useState(60), [combo, setCombo] = useState(0), [muted, setMuted] = useState(false), [ready, setReady] = useState(false);
  const [sceneError, setSceneError] = useState(""), [notice, setNotice] = useState(""), [feedback, setFeedback] = useState("ただ、釘を打つ。"), [grade, setGrade] = useState<Grade | "">("");
  const [rows, setRows] = useState<Entry[]>([]), [rankingState, setRankingState] = useState<"idle" | "loading" | "done" | "error">("idle"), [rankingError, setRankingError] = useState("");
  const [name, setName] = useState("名無しの職人"), [saving, setSaving] = useState(false), [savedRank, setSavedRank] = useState<number | null>(null), [saveError, setSaveError] = useState("");
  const lastBeat = useRef(-2), currentCombo = useRef(0), mutedRef = useRef(false);
  function changeMode(next: Mode) { modeRef.current = next; setMode(next); }
  function changePanel(next: Panel) { panelRef.current = next; if (next) lastPanel.current = next; setPanel(next); }
  function finish() {
    if (modeRef.current !== "ranked") return;
    savedEvents.current = [...events.current];
    const final = scoreRun(savedEvents.current); scoreRef.current = final; setStats(final);
    setRemaining(0); changeMode("result"); changePanel("result"); setFeedback("今日も、よく打ちました。"); setGrade("");
  }
  const finishRef = useRef(finish); finishRef.current = finish;
  useEffect(() => {
    origin.current = performance.now();
    try { setName(localStorage.getItem("nuka-nickname") || "名無しの職人"); const silent = localStorage.getItem("nuka-muted") === "true"; setMuted(silent); mutedRef.current = silent; } catch {}
    try { scene.current = createNukaScene(mount.current!); setReady(true); } catch (error) { console.error(error); setSceneError("3D画面を開けませんでした。WebGL対応のブラウザーでお試しください。"); }
    let frame = 0;
    const tick = () => {
      const elapsed = performance.now() - origin.current, phase = (elapsed % PERIOD) / PERIOD;
      if (meter.current) meter.current.style.left = `${phase * 100}%`;
      scene.current?.setPhase(phase);
      if (modeRef.current === "ranked") {
        const seconds = Math.max(0, Math.ceil((DURATION - elapsed) / 1000)); setRemaining(seconds);
        if (elapsed >= DURATION) finishRef.current();
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(frame); scene.current?.dispose(); sound.current?.dispose(); };
  }, []);
  function audio() {
    try { sound.current ??= new NukaAudio(); sound.current.muted = mutedRef.current; sound.current.unlock(); } catch { setNotice("このブラウザーでは音を再生できません。音なしでも遊べます。"); }
  }
  async function start() {
    if (!ready || modeRef.current === "starting" || modeRef.current === "ranked") return;
    audio(); changePanel(null); changeMode("starting"); setNotice(""); setSaveError(""); setSavedRank(null);
    try {
      const data = await requestJson<{ id: string }>("/api/runs", {});
      runId.current = data.id; events.current = []; savedEvents.current = [];
      scoreRef.current = emptyScore; setStats(emptyScore); currentCombo.current = 0; setCombo(0); lastBeat.current = -2;
      origin.current = performance.now(); lastHit.current = -1000; setRemaining(60);
      setFeedback("中央で、一打。"); setGrade(""); changeMode("ranked");
    } catch (error) { setNotice(error instanceof Error ? error.message : "開始できませんでした。再試行するか、自由に打って遊べます。"); changeMode("idle"); }
  }
  function freePlay() {
    audio(); changePanel(null); changeMode("free"); setNotice(""); origin.current = performance.now(); events.current = [];
    lastBeat.current = -2; currentCombo.current = 0; setCombo(0); setStats(emptyScore); scoreRef.current = emptyScore;
    setFeedback("心ゆくまで。"); setGrade("");
  }
  function hit() {
    if (!ready || panelRef.current) return;
    if (modeRef.current === "idle" || modeRef.current === "result") { void start(); return; }
    if (modeRef.current !== "ranked" && modeRef.current !== "free") return;
    const now = performance.now(), elapsed = Math.round(now - origin.current);
    if (modeRef.current === "ranked" && elapsed >= DURATION) { finish(); return; }
    if (now - lastHit.current < 135) return;
    lastHit.current = now;
    const beat = Math.floor(elapsed / PERIOD), result = judgeHit(elapsed);
    const scored = beat !== lastBeat.current;
    const audible = scored ? result.grade : "soft";
    scene.current?.hit(audible);
    try { audio(); sound.current?.hit(audible, currentCombo.current); } catch {}
    if (modeRef.current === "ranked") events.current.push({ t: Math.round(elapsed) });
    if (scored) {
      currentCombo.current = result.grade === "soft" ? 0 : (beat === lastBeat.current + 1 ? currentCombo.current : 0) + 1;
      lastBeat.current = beat; setCombo(currentCombo.current); setGrade(result.grade);
      setFeedback(result.grade === "perfect" ? "いい一打。" : result.grade === "good" ? "いい調子。" : "すとん。");
      const old = scoreRef.current;
      scoreRef.current = { score: old.score + result.base + Math.min(currentCombo.current * 2, 100), maxCombo: Math.max(old.maxCombo, currentCombo.current), perfect: old.perfect + (result.grade === "perfect" ? 1 : 0), good: old.good + (result.grade === "good" ? 1 : 0), hits: old.hits + 1 };
    } else { scoreRef.current = { ...scoreRef.current, hits: scoreRef.current.hits + 1 }; setGrade("soft"); setFeedback("急がず、一打ずつ。"); }
    setStats({ ...scoreRef.current });
  }
  function toggleSound() {
    const next = !mutedRef.current; mutedRef.current = next; setMuted(next);
    if (sound.current) sound.current.muted = next;
    if (!next) audio();
    try { localStorage.setItem("nuka-muted", String(next)); } catch {}
  }
  async function loadRanking() {
    setRankingState("loading"); setRankingError("");
    try { const data = await requestJson<{ entries: Entry[] }>("/api/leaderboard"); setRows(data.entries); setRankingState("done"); return data.entries; }
    catch (error) { setRankingState("error"); const message = error instanceof Error ? error.message : "ランキングを取得できませんでした。"; setRankingError(message); throw error; }
  }
  function openRanking() { changePanel("ranking"); void loadRanking().catch(() => {}); }
  async function saveScore() {
    if (saving || savedRank !== null) return;
    if (!name.trim()) { setSaveError("ランキングに表示する名前を入力してください。"); return; }
    setSaving(true); setSaveError("");
    try {
      const data = await requestJson<{ rank: number; score: number }>("/api/scores", { sessionId: runId.current, name: name.trim(), events: savedEvents.current });
      setSavedRank(data.rank); try { localStorage.setItem("nuka-nickname", name.trim()); } catch {}
    } catch (error) { setSaveError(error instanceof Error ? error.message : "保存できませんでした。再試行できます。"); }
    finally { setSaving(false); }
  }
  const actions = useRef({ hit, openRanking, loadRanking }); actions.current = { hit, openRanking, loadRanking };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || panelRef.current) return;
      const element = event.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(element.tagName) || element.isContentEditable) return;
      if (element.tagName === "BUTTON") return;
      event.preventDefault(); actions.current.hit();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    type Context = { registerTool: (tool: object, options: { signal: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: Context }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const validate = (input: unknown) => { if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) throw new Error("引数は空のオブジェクトにしてください。"); };
    const schema = { type: "object", properties: {}, additionalProperties: false };
    for (const tool of [
      { name: "read_game_state", title: "現在のゲーム状態", description: "画面に表示されるスコアとプレイ状態を読み取る。", inputSchema: schema, annotations: { readOnlyHint: true }, execute(input: unknown) { validate(input); return { mode: modeRef.current, ...scoreRef.current }; } },
      { name: "open_rankings", title: "ランキングを開く", description: "画面のランキングを開き、保存された上位20件を取得する。", inputSchema: schema, annotations: { readOnlyHint: false, untrustedContentHint: true }, async execute(input: unknown) { validate(input); changePanel("ranking"); const entries = await actions.current.loadRanking(); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); return { entries }; } }
    ]) { try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(console.error); } catch (error) { console.error(error); } }
    return () => lifecycle.abort();
  }, []);
  const playing = mode === "ranked" || mode === "free";
  const contentPanel = panel ?? lastPanel.current;
  return <main className="game-shell">
    <header className="masthead">
      <div className="brand"><span className="seal">無益</span><div><span className="eyebrow">ことわざ遊戯 / 第一作</span><h1>糠に釘<span>NUKA NI KUGI</span></h1></div></div>
      <nav aria-label="ゲームの設定"><Button variant="ghost" className="quiet-button" onClick={toggleSound} aria-label={muted ? "音を出す" : "音を消す"}>{muted ? <VolumeX/> : <Volume2/>}<span>音 {muted ? "OFF" : "ON"}</span></Button><Button variant="outline" className="rank-button" onClick={openRanking}><Trophy/>ランキング</Button></nav>
    </header>
    <section className="arena" aria-label="糠に釘の3Dゲーム">
      <div className="scene" ref={mount} onPointerDown={hit}/>
      <div className="score-hud"><span className="eyebrow">{mode === "free" ? "自由に打つ / スコア" : "今回のスコア"}</span><strong data-testid="score">{stats.score.toLocaleString()}</strong><span className="unit">POINTS</span><span className="hit-count">{stats.hits} 本の釘</span></div>
      <div className="session-hud"><span className="eyebrow">{mode === "free" ? "時間を忘れて" : "60秒チャレンジ"}</span><strong className={remaining <= 10 && mode === "ranked" ? "time-low" : ""}>{mode === "free" ? "∞" : String(remaining).padStart(2, "0")}<small>{mode !== "free" && " 秒"}</small></strong><span className="combo">{combo > 1 ? `${combo} COMBO` : "一打ずつ、無心に。"}</span></div>
      <div className={`feedback ${grade}`} key={feedback + stats.hits}><span>{feedback}</span>{grade && <small>{grade === "perfect" ? "PERFECT" : grade === "good" ? "GOOD" : "SOFT"}</small>}</div>
      {sceneError && <p className="scene-error" role="alert">{sceneError}</p>}
      <div className="arena-caption"><span>{mode === "free" ? "FREE PLAY" : "01 — 糠に釘を打つ"}</span><span>手応え、ほぼゼロ。</span></div>
    </section>
    <section className="control-deck" aria-label="タイミングと操作">
      <div className="timing-wrap"><div className="timing-label"><span>中央に重なったら、打つ。</span><span className="eyebrow">TIMING</span></div><div className="timing-track" aria-hidden="true"><span className="good-zone"/><span className="perfect-zone"/><span ref={meter} className="timing-cursor"/><span className="timing-center"/></div><div className="timing-ticks"><span>早め</span><span>ぴったり</span><span>遅め</span></div></div>
      <Button className="strike-button" onClick={hit} disabled={!ready || mode === "starting"}>{mode === "starting" ? <Loader2 className="animate-spin"/> : <Hammer/>}<span>{mode === "starting" ? "準備中…" : playing ? "釘を打つ" : "60秒、打つ"}</span><kbd>SPACE</kbd></Button>
    </section>
    {notice && <p className="notice" role="alert">{notice}</p>}
    <footer className="game-footer"><p>クリック・タップ・スペースで一打。ぴったりで100点、連続成功で加点。</p><div className="footer-actions">{mode !== "ranked" && mode !== "starting" && <Button variant="ghost" onClick={mode === "free" ? start : freePlay}>{mode === "free" ? <><RotateCcw size={15}/>60秒に挑戦</> : <>自由に打つ<ArrowUpRight size={15}/></>}</Button>}<Button variant="ghost" aria-label="遊び方と採点" onClick={() => changePanel("help")}><CircleHelp size={16}/>遊び方</Button></div></footer>
    <Dialog open={panel !== null} onOpenChange={open => { if (!open) changePanel(null); }}>
      <DialogContent className="game-dialog" showCloseButton={false}>
        <DialogHeader><div className="dialog-heading"><span className="eyebrow">{contentPanel === "ranking" ? "LEADERBOARD" : contentPanel === "result" ? "A MINUTE WELL WASTED" : "HOW TO PLAY"}</span><Button variant="ghost" onClick={() => changePanel(null)} aria-label="閉じる">閉じる ×</Button></div><DialogTitle className="dialog-title">{contentPanel === "ranking" ? "糠打ち番付" : contentPanel === "result" ? "おつかれさまでした。" : "釘を打つ。それだけ。"}</DialogTitle><DialogDescription>{contentPanel === "ranking" ? "60秒チャレンジの上位20記録。同点は先に記録した順。" : contentPanel === "result" ? "手応えはなくても、いい一打は残ります。" : "中央の金色に目印が重なる瞬間を狙いましょう。"}</DialogDescription></DialogHeader>
        {contentPanel === "ranking" && <div className="ranking-body">
          {mode === "ranked" && <p className="subtle-note">チャレンジの時計は進んでいます。</p>}
          {rankingState === "loading" && <p className="empty-state"><Loader2 className="animate-spin"/>ランキングを読み込み中…</p>}
          {rankingState === "error" && <div className="empty-state"><p role="alert">{rankingError}</p><Button variant="outline" onClick={() => void loadRanking().catch(() => {})}>再読み込み</Button></div>}
          {rankingState === "done" && !rows.length && <div className="empty-state"><Trophy size={36}/><p>まだ、誰も打っていません。</p><span>60秒遊んで、最初の記録を残しましょう。</span></div>}
          {rankingState === "done" && rows.length > 0 && <Table><TableHeader><TableRow><TableHead>順位</TableHead><TableHead>名前</TableHead><TableHead className="align-right">スコア</TableHead><TableHead className="align-right">連続</TableHead></TableRow></TableHeader><TableBody>{rows.map((row, i) => <TableRow key={row.createdAt + "-" + i}><TableCell className={i < 3 ? "rank-medal" : ""}>{String(i + 1).padStart(2, "0")}</TableCell><TableCell className="player-name">{row.name}</TableCell><TableCell className="rank-score">{row.score.toLocaleString()}</TableCell><TableCell className="align-right">{row.maxCombo}</TableCell></TableRow>)}</TableBody></Table>}
          <Button variant="outline" className="wide" onClick={() => void loadRanking().catch(() => {})} disabled={rankingState === "loading"}><RotateCcw size={16}/>更新する</Button>
        </div>}
        {contentPanel === "result" && <div className="result-body"><div className="result-score">{stats.score.toLocaleString()}<small>POINTS</small></div><div className="result-stats"><div><strong>{stats.perfect}</strong><span>ぴったり</span></div><div><strong>{stats.maxCombo}</strong><span>最大コンボ</span></div><div><strong>{stats.hits}</strong><span>打った釘</span></div></div>
          {savedRank !== null ? <div className="saved-message" role="status"><Check size={19}/>記録しました。現在 {savedRank} 位<Button variant="ghost" onClick={openRanking}>番付を見る<ArrowUpRight size={14}/></Button></div> : stats.hits > 0 ? <form onSubmit={event => { event.preventDefault(); void saveScore(); }}><label htmlFor="player-name">ランキングに載せる名前 <span>16文字まで</span></label><div className="save-row"><Input id="player-name" maxLength={16} value={name} onChange={event => setName(event.target.value)} autoComplete="nickname" disabled={saving}/><Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : <Trophy/>}{saving ? "記録中" : "記録する"}</Button></div></form> : <p className="subtle-note">次は一打だけでも、打ってみましょう。</p>}
          {saveError && <p className="notice" role="alert">{saveError}</p>}
          <div className="result-actions"><Button onClick={start} disabled={saving}><RotateCcw/>もう60秒</Button><Button variant="outline" onClick={freePlay} disabled={saving}>自由に打ち続ける</Button></div>
        </div>}
        {contentPanel === "help" && <div className="help-body"><p>「60秒、打つ」で開始。画面か打撃ボタンを押すと、金槌が釘を打ちます。スペースキーでも遊べます。</p><dl><div><dt>PERFECT</dt><dd>ぴったりの一打。100点＋澄んだ音。</dd></div><div><dt>GOOD</dt><dd>いいタイミング。40点。</dd></div><div><dt>SOFT</dt><dd>糠へすとん。10点。</dd></div></dl><p>PERFECT・GOODが続くと、1コンボにつき2点のボーナス（最大100点）。タイミングの目印が一周するごとに一打だけ得点になります。</p><p>60秒後に名前を付けて番付へ。「自由に打つ」では時間制限なく遊べます。自由プレイはランキングの対象外です。</p><p className="subtle-note">音は最初の操作から流れます。右上でミュートできます。</p></div>}
      </DialogContent>
    </Dialog>
  </main>;
}

