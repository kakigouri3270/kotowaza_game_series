# ことわざゲームシリーズ — 制作の引き継ぎ

- 日本語でやり取りする。最初にREADME.md、docs/CLOUDFLARE.md、docs/series/IDEAS.mdを読む。
- 主な実装は「糠に釘」。一人称で歩き、好きな位置・タイミングで釘を刺し、滑らかに沈む反応を楽しむ。
- 累計本数と糠場ごとの進捗はlocalStorageへ自動保存。公開サイト共通の累計TOP10を追加。表示名はランキング画面で変更できる。
- ジャンプを追加済み。Spaceと画面の「ジャンプ」で跳び、着地後に再度跳べる。釘はクリック・E・画面ボタンで刺す。Spaceを釘刺しへ戻さない。
- 直近のユーザー指示はCloudflare無料枠での一般公開と、本人のGitでコードを確認できる状態にすること。以前の本人限定公開方針より、この指示を優先する。
- 2026-09-27に一般公開とGitHubへのpushを完了。公開URLとGitHubリンクはREADME.md。mainはgithub/mainを追跡し、旧Sitesのoriginへは公開更新しない。
- 一般公開には `public:*` と `wrangler.public.jsonc` を使う。静的アセットと専用Worker・SQLite Durable Objectを配信する。無料プランを維持し、有料機能を追加しない。
- 既存のSites/Vinext設定と古いランキングAPIは履歴保存用。一般公開ビルドから参照せず、公開用に古いAPIやDBを有効化しない。
- `npm test`、`npm run typecheck`、`npm run public:build` が検証コマンド。
- トークン、認証情報、ローカルの生成物をGitへ含めない。
- 馬を操作して念仏から逃げる案は `docs/series/uma-no-mimi-ni-nenbutsu/CONCEPT.md`。まだ構想段階で、別タスクで扱う。
- ランキングはユーザーの最新指示により累計本数の多い順に10人。同数は到達時刻、IDの順。0本・架空のサンプル記録を載せない。
- 保存・同期はlib/nuka-save.ts、APIはworker/index.ts。匿名の秘密トークンを公開API・ログ・Gitへ出さない。旧Sites API・DBとは別。
- 即時ジャーナル保存とWeb Locksで再読み込み・複数タブに対応。ネットワーク失敗でローカル記録を消さず、同期済みと表示しない。
