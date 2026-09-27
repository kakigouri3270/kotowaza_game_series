"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { validName, type NukaSave, type RankingEntry, type SavedGame } from "@/lib/nuka-save";

export function NukaRanking({ open, onClose, store, saved, status }: { open: boolean; onClose: () => void; store: NukaSave | null; saved: SavedGame | null; status: string }) {
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [name, setName] = useState(""), [saving, setSaving] = useState(false), [nameMessage, setNameMessage] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!open) return;
    setName(store?.current.name ?? ""); setNameMessage("");
  }, [open, store]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true); setError("");
    void (async () => {
      await store?.sync();
      try {
        const response = await fetch("/api/leaderboard", { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error("unavailable");
        const body = await response.json() as { entries: RankingEntry[] };
        if (!Array.isArray(body.entries)) throw new Error("invalid response");
        if (!cancelled) setEntries(body.entries);
      } catch { if (!cancelled) setError("ランキングを読み込めませんでした。通信を確認して、更新してください。"); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open, revision, store]);
  async function rename(event: React.FormEvent) {
    event.preventDefault();
    const next = name.trim();
    if (!validName(next)) { setNameMessage("表示名は1〜16文字で入力してください。記号の一部は使えません。"); return; }
    setSaving(true); setNameMessage("");
    const ok = await store?.sync(next);
    setSaving(false);
    setNameMessage(ok ? "表示名を保存しました。" : "表示名を保存できませんでした。通信を確認して再度お試しください。");
    if (ok) setRevision(value => value + 1);
  }
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent className="game-dialog ranking-dialog" onCloseAutoFocus={event => event.preventDefault()}>
      <DialogHeader><span className="eyebrow">積み重ねた、無益。</span><DialogTitle><Trophy size={24}/>累計 TOP 10</DialogTitle><DialogDescription>みんなが刺した釘の総数。多い順に10人を掲載します。</DialogDescription></DialogHeader>
      <div className="personal-record"><span>あなたの累計</span><strong>{(saved?.progress.total ?? 0).toLocaleString()}<small> 本</small></strong><span>{saved?.name || "糠の旅人"}</span></div>
      <p className="save-status" role="status">{status}</p>
      <div className="ranking-toolbar"><span>全期間・全プレイヤー</span><Button variant="ghost" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={14} className={loading ? "animate-spin" : ""}/>更新</Button></div>
      {error ? <p className="ranking-empty" role="alert">{error}</p> : loading ? <p className="ranking-empty" role="status">記録を読み込み中…</p> : entries.length ? <table className="ranking-table"><thead><tr><th scope="col">順位</th><th scope="col">表示名</th><th scope="col">累計本数</th></tr></thead><tbody>{entries.map((entry, i) => <tr key={entry.id} className={entry.id === saved?.id ? "is-you" : ""}><td>{String(i + 1).padStart(2, "0")}</td><td>{entry.name}{entry.id === saved?.id && <small>あなた</small>}</td><td>{entry.total.toLocaleString()}<small> 本</small></td></tr>)}</tbody></table> : <p className="ranking-empty">まだ記録がありません。最初の一本をどうぞ。</p>}
      <form className="ranking-name" onSubmit={rename}><label htmlFor="ranking-name">ランキングの表示名</label><div><input id="ranking-name" value={name} onChange={event => setName(event.target.value)} maxLength={32} placeholder={saved?.name || "糠の旅人"} autoComplete="off"/><Button type="submit" disabled={saving || !store}>{saving ? "保存中…" : "保存"}</Button></div><p>表示名と累計本数が公開されます。本名などは入力しないでください。</p>{nameMessage && <p role="status">{nameMessage}</p>}</form>
      <p className="help-note">記録は同じブラウザーで引き継ぎます。ブラウザーのデータ削除や別端末への移動には対応していません。同数の場合は、先にその本数へ到達した人が上位になります。</p>
      <Button variant="outline" onClick={onClose}>閉じる</Button>
    </DialogContent>
  </Dialog>;
}
