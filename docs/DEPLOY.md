# デプロイ（GitHub Pages）

ワークフロー: `.github/workflows/deploy-pages.yml`（MVP-045）。
公開先は GitHub Pages のプロジェクトサイト `https://<owner>.github.io/URAMEKU/`。
CI（`.github/workflows/ci.yml`、MVP-005）とは独立しており、CI の結果を待たずに走る。

> このリポジトリはスターターであり、デプロイが成功しても「本番公開可能な完成アプリ」になるわけではない。
> 公開判定は `docs/RELEASE_CRITERIA.md`（G0〜G5）と `docs/qa/mvp-acceptance.md` で行う。

## 1. Pages の有効化（初回のみ・手動）

ワークフローは Pages を有効化しない。リポジトリの管理者が GitHub の設定画面で行う。

1. GitHub → リポジトリ → **Settings** → **Pages**
2. **Build and deployment** → **Source** を **GitHub Actions** にする（「Deploy from a branch」ではない）
3. 保存は不要。この時点で `github-pages` 環境が自動で作られる

Environment protection rules で `main` 以外からのデプロイを拒否したい場合は、
**Settings → Environments → github-pages → Deployment branches** に `main` を指定する。

## 2. トリガーと流れ

| トリガー | 動作 |
| --- | --- |
| `main` への push | ビルド → スモークテスト → Pages へ配信 |
| **Actions → Deploy Pages → Run workflow** | 任意のブランチを手動でデプロイ（確認用） |

ジョブ構成:

1. `build`: Node 22（`.nvmrc`）→ `npm ci` → `VITE_BASE_PATH=/URAMEKU/ npm run build` → `npm run smoke:dist` → `actions/upload-pages-artifact`
2. `deploy`: `actions/deploy-pages`（環境 `github-pages`。デプロイ URL が run の画面に出る）

権限は `contents: read` / `pages: write` / `id-token: write` のみ。`concurrency: pages` で同時デプロイを防ぐ（進行中の run はキャンセルしない）。

`404.html` は作らない。画面遷移はハッシュルート（`#/cases`, `#/play/case-01` など）なので、Pages が解決するパスは常に `/URAMEKU/`（index.html）になり、サーバー側のフォールバックは不要。

## 3. ベースパス `VITE_BASE_PATH`

Vite の `base` は環境変数 `VITE_BASE_PATH` で決まる（`vite.config.ts`、詳細は README「公開 URL とベースパス（MVP-004）」）。
ワークフローでは `env.VITE_BASE_PATH: /URAMEKU/` に固定している。

- リポジトリ名を変えた場合は、この値も `/<新しいリポジトリ名>/` に変える
- ユーザー/Organization サイト（`https://<owner>.github.io/`）やカスタムドメインで配信する場合は `/` にする
- ソースコード側は `src/data/assets.ts` の `assetUrl()` と `import.meta.env.BASE_URL` 経由で参照しているので、値を変える以外の修正は不要

## 4. 初回デプロイ後の確認

run の `deploy` ジョブに出る URL（例: `https://<owner>.github.io/URAMEKU/`）に対して、ローカルから確認する。

```bash
# 1) ソースが参照する全アセットが 200/304 で返るか（MVP-033 のチェッカー）
node scripts/check_asset_refs.mjs --serve https://<owner>.github.io/URAMEKU/

# 2) サブパス配信の総合確認（ローカルでビルド → vite preview → curl）
scripts/check_base_path.sh            # /URAMEKU/ で検証

# 3) 配信中の dist 相当に対するスモーク（ローカルビルドで再現）
VITE_BASE_PATH=/URAMEKU/ npm run build && VITE_BASE_PATH=/URAMEKU/ npm run smoke:dist
```

ブラウザでの手動確認は `docs/qa/mvp-acceptance.md` のチェックリストに従う（5 件すべてが開ける、資料画像が表示される、リロード後に進捗が復元される、全件削除できる）。

よくある失敗:

| 症状 | 原因・対処 |
| --- | --- |
| `deploy` ジョブが `Resource not accessible by integration` / `Not Found` で失敗 | Pages が有効化されていない（1 章）。設定後に run を再実行 |
| ページは開くが画像・CSS が 404 | `VITE_BASE_PATH` がリポジトリ名と一致していない（3 章） |
| 古い版が表示される | ブラウザキャッシュ。Pages 側の反映は数十秒〜数分かかる。ハードリロードで確認 |
| ハッシュ無しの URL（例 `/URAMEKU/cases`）が 404 | 仕様どおり。アプリ内リンクはすべて `#/...` を使う |

## 5. ロールバック

Pages は「最後に成功した deploy の成果物」をそのまま配信する。戻したい版の run を再実行すればよい。

1. GitHub → **Actions** → **Deploy Pages** → 戻したいコミットの run を開く
2. 右上 **Re-run all jobs**（その時点のコミットでビルドし直して配信する）
3. 完了後、4 章の確認を再度行う

恒久的に戻す場合は `main` を `git revert` で戻して push する（push で再デプロイされる）。
`git push --force` で履歴を書き換える方法は取らない。

## 6. 手動でデプロイを止める

- **Settings → Pages → Source** を **None** にすると配信が止まる（ワークフローの `deploy` ジョブは失敗するようになる）
- ワークフロー自体を止める場合は **Actions → Deploy Pages → ... → Disable workflow**
