# Cloudflareで一般公開する

公開URL：https://kotowaza-nuka-ni-kugi.kakigouri3270.workers.dev

2026-09-27に一般公開。初回公開時のWorker versionは `990e9755-f6c5-470e-84df-165cfce12802`。

現在のゲームはクライアントだけで動作するため、Cloudflare Workers Static Assetsへ静的ファイルだけを配信する。サーバーコード、D1、R2、有料プラン、独自ドメインは不要。公開URLはデプロイ時に表示される `workers.dev` ドメインを使用する。

Cloudflare公式の[料金・制限](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)では、静的アセットへのリクエストは無料・無制限。無料プランのファイル数などの制限は適用される。今回の設定にはWorkerの `main` がなく、サーバー処理へのリクエストを発生させない。

## ローカル開発

Node.js 22.13以上とnpmが必要。

```sh
npm ci
npm run public:dev
```

## 検証と公開

```sh
npm test
npm run typecheck
npm run public:build
npx wrangler deploy --config wrangler.public.jsonc --dry-run
npx wrangler login --scopes account:read user:read workers_scripts:write
npm run deploy:cloudflare
```

ブラウザーに表示されるCloudflare公式画面でログインする。トークンをソースやGitへ保存しない。複数アカウントがある場合は対象を選択してから公開する。`wrangler.public.jsonc` の `name` が公開するアプリ名で、既存の別アプリと同名にしない。

認証後に `localhost:8976` で接続拒否になる場合は、CLIの認証待機が期限切れになっていないか確認する。`wrangler login` を再実行し、表示された新しい認証画面で完了する。古いコールバックURLは再利用しない。

## 構成

- `index.html` / `public-entry.tsx`：一般公開用の入り口。
- `vite.public.config.ts`：既存の `app/page.tsx` とゲーム処理を、そのまま静的アプリとしてビルドする。
- `public-dist/`：生成物。Gitには含めず、Cloudflareへ配信する。
- `wrangler.public.jsonc`：静的配信だけを行う公開設定。
- `vite.config.ts` / `.openai/hosting.json`：以前のSites版の設定。一般公開のビルドからは読み込まない。
- `app/api/` / `db/` / `drizzle/`：以前のランキング実装のソース。今回の公開物には含まれず、データ移行も行わない。

ログイン不要でゲームを開始できる。本数はプレイ中のみ保持し、ページ再読み込みで0になる。ミュート設定は各ブラウザーのlocalStorageに保存する。ランキング・アカウント・クラウド保存はまだ追加しない。

## 次回更新

同じリポジトリでゲームを修正し、検証後に `npm run deploy:cloudflare` で更新する。Gitのpushだけでは自動デプロイされない。

将来、ランキングやAPIを公開する場合は、認証、不正送信対策、DBとWorkersの無料枠を別途設計する。現状の古いAPIをそのまま公開しない。
