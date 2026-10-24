# CI（GitHub Actions）

ワークフロー: `.github/workflows/ci.yml`（ジョブ名 / チェック名: **CI**）

## トリガー

- `pull_request`（全ブランチ宛て）
- `push` to `main`

同一 PR（または同一 ref）の古い実行は `concurrency` で自動キャンセルされる。権限は `contents: read` のみ。

## ステップ（失敗箇所が分かるよう個別ステップ）

1. `npm ci`（Node は `.nvmrc` = 22、npm キャッシュ有効）
2. `npm run lint`
3. `npm run typecheck`
4. `npm run format:check`
5. `npm run test`
6. `npm run build`
7. Python 3.12 + `pip install pillow` → `python3 scripts/validate_assets.py`
   - このステップは `continue-on-error: true`。結果の `qa/validation.json` は
     アーティファクト `asset-validation` として保存され、ジョブサマリーにも出力される。
   - 失敗しても PR はブロックしないが、warning が出るので内容を確認すること。
     manifest やスクリプトを無理に直して PASS させない（`AGENTS.md` 参照）。
   - 2026-10-24 時点のローカル実行結果: `PASS`（assetsChecked 530 / caseCount 5）。

## action のバージョン固定

`uses:` はすべてコミット SHA で固定し、末尾のコメントで対応するリリースタグを示す（例: `actions/checkout@3d3c42e… # v7.0.1`）。タグは移動されうるが SHA は不変なので、サプライチェーン攻撃や意図しない更新を防げる。更新は `.github/dependabot.yml`（`github-actions`、週次）が PR を出す。手動で更新する場合は、リリースタグが指すコミット SHA を `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` で確認してから書き換える。

## 失敗時マージ不可（ブランチ保護）

`main` に対して Required status checks = `CI` を設定済み（2026-10-24、`gh api` で適用）。
設定内容: `strict: false`、`enforce_admins: false`、レビュー必須なし、push 制限なし。

### 手動で再設定する場合

GitHub → Settings → Branches → Branch protection rules → `main` →
「Require status checks to pass before merging」を ON にし、`CI` を追加する。

または CLI:

```sh
gh api -X PUT repos/ysj101/URAMEKU/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": false, "contexts": ["CI"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON
```

確認: `gh api repos/ysj101/URAMEKU/branches/main/protection --jq .required_status_checks.contexts`

注意: 現在の開発ブランチ（`mvp-003-separate-domain` など）には保護を付けていない。
スタック PR のベースにも同じ保護が必要なら、上記の `main` を対象ブランチ名に置き換える。

## ローカルで同じ検査を回す

```sh
npm ci
npm run check   # lint / typecheck / format:check / test
npm run build
python3 scripts/validate_assets.py   # 要 Pillow
```
