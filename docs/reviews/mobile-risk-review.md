# iOS Safari / Android Chrome 実機固有リスクのコードレビュー（MVP-042）

対象ブランチ: `integration/wave-2a`（2026-10-24 時点）
対象ファイル: `src/audio/soundManager.ts`、`src/state/useGame.ts`、`src/components/DocumentDialog.tsx`、`index.html`、`public/manifest.webmanifest`（補助的に `src/app/global.css`、`src/components/CalculationDesk.tsx`、`src/screens/InvestigationScreen.tsx`、`public/assets/audio/*.wav`）
方針: **修正は提案のみ**（本 Issue では `src/` を変更しない）。各項目は `docs/qa/device-test-plan.md` のシナリオ ID に対応づけ、実機で確認すべき観点を示す。重大度の定義は手順書 2.3 と同じ（S1 重大〜S4 低）。

実機検証は未実施のため、以下は「コード上このように振る舞う可能性がある」という指摘であり、実機での再現有無は記録表で確定させる。

## 要約

| # | 箇所 | リスク | 重大度（見込み） | 対応 Issue 案 | 確認シナリオ |
| --- | --- | --- | --- | --- | --- |
| R1 | `soundManager.ts` `unlock()` / `play()` | バックグラウンド復帰・着信後に AudioContext が `suspended` / `interrupted` のままで無音になる。再 resume の経路が無い | S2 | 音（MVP-037 系の後続） | M03, M13 |
| R2 | `soundManager.ts`、`docs/AUDIO.md` | iOS のサイレントスイッチで Web Audio は無音になる。`docs/AUDIO.md` の記述（「無視されることがある」）は逆 | S4 | ドキュメント修正 | M02 |
| R3 | `useSound.ts` の利用箇所 | 統合ブランチでは `installAutoUnlock` が `AudioControl` マウント時にしか登録されず、設定画面がプレースホルダーのため効果音は鳴らない | S4（情報） | 効果音組み込み PR | M01（前提） |
| R4 | `installAutoUnlock` | `pointerdown` は iOS で「ユーザー操作」と認められない場合があり、初回は `touchend` まで resume が通らないことがある（実装は成功まで再試行するので設計どおり） | S4 | — | M01 |
| R5 | `useGame.ts` の離脱時フラッシュ | `pagehide` / `beforeunload` のみで `visibilitychange` が無い。バックグラウンドで OS に強制終了されると最大 150 ms 分の変更が失われうる | S3 | 保存（MVP-030 系の後続） | M03, M04 |
| R6 | `useGame.ts` / localStorage | iOS Safari の ITP により、7 日間（Safari 利用日ベース）サイトを操作しないと localStorage が消去されうる。ホーム画面追加版は対象外 | S3 | ドキュメント（`docs/SAVE_DATA.md`）・将来の書き出し機能 | （長期・手動） |
| R7 | `useGame.ts` / bfcache | 戻る/進むキャッシュから復帰したとき、他タブの変更を取り込む `storage` イベントは発火済みの可能性がある | S4 | — | — |
| R8 | `InvestigationScreen.tsx` / `App.tsx` の `window.confirm` | Android Chrome で「このページでダイアログを表示しない」を選ばれると `confirm` が常に false になり、やり直し・全削除ができなくなる | S4 | 将来 UI ダイアログ化 | T09, T11 |
| R9 | `DocumentDialog.tsx` | 履歴を積まないため、iOS の戻るスワイプは「ダイアログを閉じる」ではなく画面ごと戻る。Android Chrome は CloseWatcher によりダイアログだけ閉じる。挙動が OS で異なる | S2 | MVP-022（「タップ・Esc・戻るで開閉」） | M10 |
| R10 | `DocumentDialog.tsx` の `showModal` フォールバック | `open` 属性のみの非モーダル表示は背景・Esc・フォーカス閉じ込めが無く、ページ先頭に絶対配置される。対象 OS（iOS 15.4+）では到達しない | S4 | — | — |
| R11 | `DocumentDialog.tsx` + `global.css` `dialog` | モーダル中も iOS Safari では背景ページがスクロールできることがある（スクロールチェーン） | S3 | MVP-022 / MVP-040 | M09 |
| R12 | `global.css` `dialog` `max-height: 86dvh` | `dvh` 非対応（iOS < 15.4、Chrome < 108）では `max-height` が無効になり画面からはみ出す。対象外の OS のみ | S4 | — | M06 |
| R13 | `index.html` `viewport-fit=cover` + CSS に `env(safe-area-inset-*)` 無し | standalone / 横向きでノッチ・ホームインジケータに内容が重なりうる | S3 | MVP-040（`layout.css` の `.app-main` 余白） | M06, M12 |
| R14 | `index.html` `theme-color` | 単一値のみ。ダークモード用の `media` 指定が無い。`apple-mobile-web-app-status-bar-style` 無し | S4 | MVP-045 | M12 |
| R15 | `public/manifest.webmanifest` | `id` 無し（Chrome の重複インストール判定）、`screenshots` 無し（Android のリッチインストール UI）。Service Worker 無しのためオフライン起動不可 | S4 | MVP-045 / MVP-028 | M05, M12 |
| R16 | `CalculationDesk.tsx` `type="number"` | iOS の `type=number` は不正文字を黙って捨てる、Android の一部 IME で全角数字が入る。`inputmode=decimal` は設定済み | S3 | MVP-024 | M08 |
| R17 | `global.css` `.calc-field input` | フォントが 16px（`--font-size-base`）なので iOS のフォーカス時自動ズームは起きない（肯定的な確認） | — | — | M07 |
| R18 | `index.html` viewport | `user-scalable=no` / `maximum-scale` を付けていない（ピンチズーム可能。アクセシビリティ上正しい） | — | — | M11 |

## 詳細

### R1. 復帰後に AudioContext が再開されない（S2）

`SoundManager.unlock()` は `ctx.state !== 'running'` のときだけ `resume()` し、成功すると `unlocked = true` にする。`installAutoUnlock()` は unlock 成功後にリスナーを外す。`play()` は `unlocked` が true なら `ctx.state` を見ずに `start()` する。

- iOS Safari はバックグラウンド移行、着信、Siri、他アプリの音声再生で AudioContext を `interrupted`（Safari 独自の state）または `suspended` にする。復帰後に自動で `running` に戻るとは限らない。
- Android Chrome もタブのバックグラウンド化で `suspended` になることがある。
- その状態で `play()` を呼んでも `unlocked` は true のまま、リスナーも外れているので、以後ずっと無音になる。

提案（修正はしない）:

1. `play()` の先頭で `if (this.ctx.state !== 'running') { void this.ctx.resume(); }` を入れ、ユーザー操作内の呼び出しで再開を試みる（`play()` は通常タップハンドラから呼ばれる）。
2. `installAutoUnlock()` のリスナーを外さず残す（`unlock()` は冪等で安価）か、`document.visibilitychange` で `visible` に戻ったとき `unlocked = ctx.state === 'running'` に更新して必要なら再登録する。
3. `unlock()` の `state` 判定で `'interrupted'` を `running` ではない側として扱う（文字列比較なので現状でも `!== 'running'` に入るが、`AudioContextState` の型に無いのでコメントで明示する）。

実機: M03 / M13 で「復帰後のタップで鳴るか」を記録する。

### R2. iOS サイレントスイッチと Web Audio（S4）

iOS では Web Audio（AudioContext）の出力はサイレントスイッチ（着信/サイレント）に従い、スイッチが ON だと無音になる。`<audio>` / `<video>` の再生は従わない。`docs/AUDIO.md` の「OS 側のサイレントスイッチ（iOS）は Web Audio では無視されることがある」は逆の記述なので、「サイレントスイッチ ON では Web Audio は無音になる。鳴らすための回避策（無音の `<audio>` を再生してオーディオセッションを切り替える手法）は採用しない」と直すことを提案する。アプリ内ミュート（`urameku-audio-settings`）を必ず用意するという結論自体は正しい。

実機: M02 では「スイッチ ON で無音」を仕様として記録し、fail にしない。

### R3. 統合ブランチでは自動 unlock が登録されない（情報）

`useSound()` が `installAutoUnlock()` を登録するが、`integration/wave-2a` で `useSound` を呼ぶのは `src/components/AudioControl.tsx` だけで、`App.tsx` の設定画面はプレースホルダーのため `AudioControl` はマウントされない。したがってこのビルドでは効果音は 1 つも鳴らない。これは組み込み担当 Issue の統合待ちであり不具合ではない。手順書 2.2 の前提として明記した。

### R4. `pointerdown` と iOS のユーザー操作判定（S4）

iOS Safari が `AudioContext.resume()` を許可するのは「ユーザー操作イベントのハンドラ内」で、`touchend` / `click` / `keydown` は確実だが `pointerdown` / `touchstart` は認められないことがある。`installAutoUnlock()` は `pointerdown` → `touchend` の順に同じハンドラを呼び、成功するまでリスナーを残すので、初回タップの `touchend` で通る設計になっている。`unlock()` 内で `resume()` の前に `await` が無いことも確認した（`createGain` 等は同期）。実機では M01 で「鳴り始めたタップの回数」を記録する。

### R5. 離脱時フラッシュに `visibilitychange` が無い（S3）

`useGame.ts` は `pagehide` / `beforeunload` と unmount でフラッシュする。iOS Safari は `beforeunload` を発火せず `pagehide` も「タブを閉じる」「別ページへ遷移」では発火するが、**バックグラウンドのまま OS がプロセスを終了**した場合はどちらも発火しない。Android Chrome も同様。保存デバウンスは 150 ms なので失われるのは直前 150 ms 以内の変更に限られ、通常の操作では実害が小さい。

提案: `document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); })` を追加する（Page Lifecycle API の推奨）。既存の `pagehide` は残す。実機: M03 / M04 で「入力直後 1 秒以内に離脱」を試す。

### R6. iOS Safari の ITP による localStorage 消去（S3）

Safari の Intelligent Tracking Prevention は、利用者がそのサイトを操作しないまま「Safari を使った日」が 7 日経つと、スクリプトから書けるストレージ（localStorage を含む）を削除する。ホーム画面に追加した Web アプリは対象外。本アプリはサーバ保存が無いため、しばらく遊ばなかった利用者の進捗が消える可能性がある。

提案: `docs/SAVE_DATA.md` に制限事項として明記し、将来的に進捗の書き出し/読み込み（JSON）を検討する。実機では短期に再現できないため記録表の対象外とし、Issue として残す。

### R7. bfcache からの復帰（S4）

iOS Safari / Android Chrome はハッシュ遷移を跨がない「戻る/進む」で bfcache からページを復元する。その間に他タブが保存した変更は `storage` イベントを取りこぼす可能性がある。単一タブ利用が前提のスマホでは実害が小さい。提案: `pageshow` で `event.persisted` のときに `loadSaveDataDetailed` を再読込して `resolveConflict` にかける。

### R8. `window.confirm` の抑止（S4）

`InvestigationScreen.tsx`（やり直し）と `App.tsx`（全削除）が `window.confirm` を使う。Android Chrome では同一ページで複数回ダイアログを出すと「このページでダイアログを表示しない」のチェックが現れ、選ばれると以降 `confirm` は即 false を返し、やり直しができなくなる。iOS の standalone でも `confirm` は表示されるが、見た目がブラウザ依存。提案: 将来的にアプリ内の確認 UI（`<dialog>`）に置き換える。実機: T09 / T11 で確認ダイアログが出ることを見る。

### R9. 戻る操作とダイアログの関係が OS で異なる（S2）

`DocumentDialog.tsx` は `showModal()` を呼ぶだけで履歴（`history.pushState`）を積まず、`popstate` も見ない。

- Android Chrome（120 前後以降）はモーダル `<dialog>` を CloseWatcher として扱い、戻るジェスチャーで `cancel` → `close` が発火する。`onCancel={onClose}` があるので**ダイアログだけ閉じて調査画面に残る**（期待どおり）。
- iOS Safari は CloseWatcher を実装していないため、戻るスワイプは履歴を 1 つ戻す。ハッシュルート（`#/play/case-01` → `#/cases` 等）が変わり `PlayScreen` ごと unmount されるので、利用者には「資料を閉じようとしたら事件一覧に飛ばされた」と見える。進捗は `useGame` が保持するので消えない。

提案（MVP-022 の受け入れ条件「タップ・Esc・戻るで開閉」に合わせる）:

1. ダイアログを開くときに `history.pushState({ dialog: id }, '')` を積み、`popstate` で `onClose()` を呼ぶ。閉じるボタン・Esc で閉じたときは `history.back()` で積んだ分を消す（`popstate` 内で二重に閉じないようフラグを持つ）。
2. もしくは `#/play/case-01?doc=ad` のようにクエリで開いている資料を表現し、`navigation.ts` の `parseHash` に載せる。
3. Android の CloseWatcher と組み合わせたときに「戻る 1 回でダイアログも履歴も 1 つだけ戻る」ことを実機で確認する（M10）。

### R10. `showModal` 非対応時のフォールバック（S4）

`typeof dialog.showModal !== 'function'` のときは `setAttribute('open', '')` で非モーダル表示にする。この経路では `::backdrop` が無く、背景操作が可能で、Esc（`cancel` イベント）も発火せず、`dialog[open]` の既定配置（絶対配置・ページ上端）のためスクロール位置によっては見えない。`showModal` は iOS 15.4 / Chrome 37 以降で使えるので、手順書の対象（最新 2 版）では到達しない。提案: フォールバック時はダイアログを `position: fixed` にして「閉じる」ボタンに初期フォーカスを当てる最低限の対応を入れるか、対応範囲外として `README` に明記する。

### R11. モーダル中の背景スクロール（S3）

`showModal()` の top layer でも iOS Safari はタッチでの背景スクロール（スクロールチェーン）を止めないことがある。`global.css` の `dialog { overflow: auto }` に `overscroll-behavior: contain` を足し、`body:has(dialog[open]) { overflow: hidden }` で背景を固定する提案をする（`:has` は iOS 15.4+ / Chrome 105+）。`global.css` の既存ルール変更は MVP-022 / MVP-040 の範囲。実機: M09。

### R12. `max-height: 86dvh`（S4）

`dvh` は iOS 15.4 / Chrome 108 以降。非対応では宣言が無視され `max-height` 無し（＝内容分の高さ）になり、長い資料で画面を超える。対象 OS では問題ない。`width: min(680px, calc(100vw - 24px))` はスマホでは問題ない（`100vw` がスクロールバー幅を含むのはデスクトップのみ）。

### R13. セーフエリア（S3）

`index.html` は `viewport-fit=cover` を宣言しているが、CSS のどこにも `env(safe-area-inset-*)` が無い（`grep` で確認）。`viewport-fit=cover` は「画面全体に描いてよい」という宣言なので、standalone（PWA）や横向きでは内容がノッチ・ホームインジケータの下に入りうる。縦向きのブラウザモードでは Safari / Chrome が自前でツールバー領域を確保するため影響は小さい。

提案（`layout.css` の `.app-main`、MVP-040 の範囲）:

```css
.app-main {
  padding-left: max(var(--space-4), env(safe-area-inset-left));
  padding-right: max(var(--space-4), env(safe-area-inset-right));
  padding-bottom: calc(var(--space-12) + env(safe-area-inset-bottom));
}
```

実機: M06（横向き）、M12（standalone の上下端）。

### R14. `theme-color` と iOS 用 meta（S4）

`<meta name="theme-color" content="#242322">` は 1 つだけ。ダークモードで別色にしたい場合は `media="(prefers-color-scheme: dark)"` 付きの 2 つ目を足す。iOS は manifest の `display: standalone` を読むので `apple-mobile-web-app-capable` は必須ではないが、ステータスバーの見た目は `apple-mobile-web-app-status-bar-style` で決まる（無ければ既定）。`apple-touch-icon.png` は 180×180 で適切。`/assets/brand/...` の絶対パスは Vite が `base` に書き換える（`scripts/check_base_path.sh` で確認済み）。

### R15. manifest（S4）

`display: standalone`、`start_url: "./"`、`scope: "./"`（サブパス配信に追従）、`icons` に `any` 192/512 と `maskable` 512 があり、インストール要件を満たす。不足は `id`（Chrome が同じアプリと判定する識別子。無いと `start_url` が使われる）、`screenshots`（Android のリッチインストール UI。任意）、`orientation`（未指定＝両対応で問題ない）。Service Worker が無いため**オフラインでの新規起動はできない**。これは MVP の範囲外として手順書 M05 で「新規読み込み不可は S4」とした。導入する場合は MVP-028（オフライン表示）/ MVP-045（デプロイ）で検討する。

### R16. 数値入力欄（S3）

`CalculationDesk.tsx` は `type="number" inputMode="decimal" step="any"`。

- iOS: `inputmode=decimal` で小数点付きの数字パッドが出る。マイナスは打てない（本アプリの期待値は正の数なので問題ない）。`type=number` は数値として解釈できない文字を黙って捨て `value` が空になるため、利用者が「入力したのに消えた」と感じる場面がありうる。
- Android: Gboard 等で `inputmode=decimal` を尊重し「.」付きの数字キーボードになる。一部 IME が全角数字を返すと `type=number` が拒否して空になる。

提案（MVP-024 の範囲）: `type="text" inputMode="decimal" pattern="[0-9.]*"` にして文字列のまま受け取り、`interpretInput`（`src/domain/calculation.ts`）側で全角→半角の正規化を行う。デスクトップで `type=number` のホイール操作で値が変わる副作用も消える。実機: M08。

### R17. 入力欄のフォントサイズ（肯定的な確認）

`.calc-field input { font-size: var(--font-size-base) }` ＝ 16px。iOS Safari は 16px 未満の入力欄にフォーカスすると自動ズームするが、この実装では起きない。M07 で確認する。

### R18. ピンチズームの許可（肯定的な確認）

viewport に `user-scalable=no` / `maximum-scale` が無く、拡大操作が可能。`docs/MVP_SPEC.md` 12 章の「文字倍率 200%」要件と整合する。M11 で確認する。

## 付記: 効果音ファイルの形式

`public/assets/audio/*.wav` は 11 本すべて 16-bit PCM / mono / 22,050 Hz / 0.11〜0.85 秒（Python `wave` で確認）。Safari の `decodeAudioData` が扱える形式で、24-bit や float WAV のようなデコード失敗の懸念は無い。

## エミュレーションで確認したこと（本 Issue で実施）

- `npm run build && vite preview` を起動し、iOS Safari / Android Chrome の UA で `curl` した結果、`/`、`index.html`、JS、CSS、`manifest.webmanifest`、`apple-touch-icon.png`、`app-icon-192.png`、`maskable-icon-512.png`、`audio/stamp.wav`、`cases/case-01/documents/ad.png` がすべて HTTP 200 かつ期待する Content-Type（`application/manifest+json`、`audio/wav` 等）で返ることを確認した。
- それ以上（レンダリング、音、保存、ジェスチャー）は未実施。
