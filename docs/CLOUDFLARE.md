# Cloudflareで一般公開する

公開URL：https://kotowaza-nuka-ni-kugi.kakigouri3270.workers.dev

2026-09-27に静的ゲームとして初回公開。その後のユーザー指示で、累計保存と公開TOP10を追加した。GitHubは [kakigouri3270/kotowaza_game_series](https://github.com/kakigouri3270/kotowaza_game_series)。mainはgithub/mainを追跡し、旧Sitesのoriginは更新しない。

## 公開構成と無料枠

- Viteの静的アセットをWorkers Static Assetsで配信する。
- /api/*だけworker/index.tsを実行。/api/progressで保存・同期し、/api/leaderboardで上位10人を取得する。
- NukaLeaderboardというSQLite Durable Objectを1個使う。旧SitesのD1、認証、ランキングAPIは使わない。
- wrangler.public.jsoncにバインディングとnew_sqlite_classesの初回マイグレーションを記録。デプロイ時に名前空間を作り、初回リクエストでテーブル・インデックスを自動作成する。更新時に既存データを削除しない。
- 有料プラン・有料オプションは追加しない。

Cloudflare公式の[Durable Objects料金](https://developers.cloudflare.com/durable-objects/platform/pricing/)によるとSQLite版はFreeプランで利用可能。Free枠はリクエスト10万/日、読み取り500万行/日、書き込み10万行/日、合計5GB。Workers自体の無料リクエスト枠も適用される。上限超過時はAPIが失敗するため、端末の記録を維持して再送する。静的配信の料金は[Static Assetsの制限](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)を参照。

クライアントは変更がある場合のみ約15秒間隔で同期。ランキングは開いたとき・更新ボタンで取得し、常時ポーリングしない。

## 記録の仕様

- 同じブラウザーのlocalStorageに秘密のランダム識別トークン、累計、各糠場の本数、表示名を保存する。
- 一本ごとのジャーナルを同期的に保存してから、Web Locksで複数タブの更新を直列化。適用済みIDを先にコミットするので、保存途中で閉じても二重加算しない。Web Locks非対応の古いブラウザーでは単一タブで利用する。
- サーバーは識別トークンのSHA-256ハッシュのみ保存。公開APIは公開ID・表示名・合計だけを返す。秘密トークンをログ、WebMCP、Gitに出さない。
- 本数は各糠場の最大値を合成し、再送や古いタブで減算・二重加算しない。
- 本数降順、到達時刻昇順、公開ID昇順で10人。0本を除外し、同一ブラウザーは1行に更新する。
- 不正な数値、長すぎる入力、危険な表示名文字、クロスオリジンの書き込みを拒否する。IPごとの簡易頻度制限と、登録からの時間に比べて極端に多い本数を保留する確認処理を実装。
- カジュアルゲーム向けの簡易対策。クライアントで動くゲームのため、改造や自動操作を完全に防ぐものではない。賞金などを伴う競技向けには別の検証が必要。
- オフラインの記録は端末に残る。初回をオフラインで長時間遊んだ場合などは、確認処理により反映に時間がかかることがある。
- データ削除・別ブラウザー・別端末は別の記録になる。失われたトークンの復旧やアカウント連携は未実装。保存機能追加前の本数は復元不可。

## ローカル開発・検証

Node.js 22.13以上とnpmを使用。

```sh
npm ci
npm test
npm run typecheck
npm run public:build
npx wrangler dev --config wrangler.public.jsonc --local --port 4173
```

public:dev / public:previewはクライアントだけ。APIも使うときはWrangler開発サーバーを使う。保存先はローカルの.wrangler/stateで、公開の本数と分離される。テストはインメモリSQLiteとブラウザー保存モックを使い、公開ランキングに架空の記録を入れない。

インストール済みWrangler 4.92.0のローカルランタイムが新しい互換日付に未対応の場合は、開発コマンドだけに --compatibility-date 2026-05-22 を付ける。公開設定は変更しない。

## 公開更新

```sh
npm run public:build
npx wrangler deploy --config wrangler.public.jsonc --dry-run
npx wrangler deploy --config wrangler.public.jsonc
git push github main
```

Gitへのpushだけでは自動デプロイされない。Workerの保存データは通常のデプロイ後も維持される。Cloudflareの認証情報はWranglerのローカル設定で管理し、ソースへ含めない。再認証が必要な場合は公式のwrangler loginを使用する。
