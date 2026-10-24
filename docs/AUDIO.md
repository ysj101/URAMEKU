# 効果音（SFX）の設計と音量正規化（MVP-037）

## 方針

- **再生経路は 1 本**: `src/audio/soundManager.ts` の `SoundManager` が Web Audio API（`AudioContext`）で 11 種の wav を再生する。画面側は `useSound()` が返す `play('stamp')` だけを呼ぶ。
- **スマホの自動再生制限に従う**: `AudioContext` はユーザー操作（pointerdown / keydown / touchend）の後にだけ生成・`resume()` する（`unlock()` / `installAutoUnlock()`）。unlock 前の `play()` は何もしない。iOS Safari で最初の `resume()` が拒否された場合はリスナーを残し、次の操作で再試行する。
- **ミュート・音量はマスター `GainNode`**: 設定（`{ muted, volume }`）は `src/audio/audioSettings.ts` が localStorage キー `urameku-audio-settings` に保存する。既定はミュート OFF・音量 0.6。ミュート時はマスターゲイン 0 で、ソースも生成しない。進行状況のセーブデータ（`urameku-mvp-v1`）とは別キーで、移行・競合処理の対象外。
- **失敗は無音**: `AudioContext` 非対応、`fetch` 失敗、`decodeAudioData` 失敗はすべて握りつぶす。UI に例外やエラー表示を出さない。失敗した音は同一セッション内で再試行しない。
- **遅延ロード**: wav は初回再生時に取得・デコードしてメモリにキャッシュする。`preload(id)` で取得だけ先に済ませることもできる。
- **連打の間引き**: 同じ効果音は 60 ms 未満の間隔では鳴らさない（`DEFAULT_MIN_INTERVAL_MS`）。別の音は間引かない。
- **音量正規化はコード側で行う**: wav 本体は書き換えない（アセット変更は手動レビュー対象）。各音の相対ゲイン `SOUND_GAIN` を再生時に掛ける。
- `prefers-reduced-motion` は音には関係しないため参照しない。OS 側のサイレントスイッチ（iOS）は Web Audio では無視されることがあるため、アプリ内ミュートを必ず用意する。

## 各音の用途

| ID              | 鳴らす操作                                       | 組み込み先 Issue（予定） |
| --------------- | ------------------------------------------------ | ------------------------ |
| `ui-tap`        | ボタンやタブ等の一般的なタップ                   | 設定画面・各画面の組み込み Issue |
| `menu-open`     | メニュー・ダイアログを開く                       | 同上                     |
| `paper-flip`    | 調査資料を開く（`tryOpenDocument` 成功時）       | 資料画面の Issue         |
| `paper-place`   | 資料を机・ボードに配置する                       | 証拠ボードの Issue       |
| `evidence-pin`  | 証拠をピン留めする（`canPinDocument` 成功時）    | 証拠ボードの Issue       |
| `evidence-link` | 2 つの証拠を照合する（`linkStatus` が揃った時） | 証拠ボードの Issue       |
| `discovery`     | 新しい事実の発見・ヒント開示                     | 資料/ヒントの Issue      |
| `stamp`         | 記事を提出する（`publishVerdict` 直前）          | 記事提出の Issue         |
| `correct`       | 正解（提出結果が正）                             | 記事提出の Issue         |
| `incorrect`     | 不正解（提出結果が否）                           | 記事提出の Issue         |
| `case-complete` | 事件クリア（デブリーフ表示時）                   | 結果画面の Issue         |

画面への組み込み（`App.tsx` / `useGame.ts` / 各 screen への `play()` 呼び出しと、`AudioControl` の設定画面配置・`global.css` の `.audio-control` スタイル）は本 Issue の対象外で、別 Issue で行う。

## 音量の計測結果と相対ゲイン

`python3 scripts/normalize_audio.py --markdown` の出力（解析のみ。ファイルは変更しない）。
全ファイルは 16 bit / mono / 22050 Hz。

目標: -18 dBFS RMS / ピーク上限 -1 dBFS

| file              | ms  | RMS dBFS | peak dBFS | gain dB | gain | note         |
| ----------------- | --- | -------- | --------- | ------- | ---- | ------------ |
| case-complete.wav | 850 | -25.0    | -9.9      | +7.0    | 2.24 |              |
| correct.wav       | 380 | -21.7    | -9.9      | +3.7    | 1.54 |              |
| discovery.wav     | 580 | -22.7    | -12.1     | +4.7    | 1.72 |              |
| evidence-link.wav | 240 | -19.3    | -12.1     | +1.3    | 1.16 |              |
| evidence-pin.wav  | 180 | -26.8    | -9.7      | +8.7    | 2.73 | peak-limited |
| incorrect.wav     | 300 | -26.5    | -13.7     | +8.5    | 2.65 |              |
| menu-open.wav     | 200 | -28.0    | -14.5     | +10.0   | 3.17 |              |
| paper-flip.wav    | 420 | -21.6    | -2.4      | +1.4    | 1.18 | peak-limited |
| paper-place.wav   | 250 | -26.7    | -12.3     | +8.7    | 2.74 |              |
| stamp.wav         | 320 | -28.0    | -13.1     | +10.0   | 3.15 |              |
| ui-tap.wav        | 110 | -24.5    | -8.8      | +6.5    | 2.11 |              |

- `gain` 列が `SOUND_GAIN` の初期値。再生時の実効ゲインは `SOUND_GAIN[id] × volume`（既定 0.6）で、全音のピークは -1 dBFS + 20·log10(0.6) ≈ -5.4 dBFS 以下に収まり、クリップしない。
- `peak-limited`: RMS を -18 dBFS に揃えるとピークが -1 dBFS を超えるため、ピーク基準で係数を抑えた。`evidence-pin` は -0.3 dB、`paper-flip` は -0.4 dB 目標に届かないが聴感上は許容範囲。
- 元ファイルの RMS は -19.3〜-28.0 dBFS とばらつきが約 9 dB あり、特に `stamp` / `menu-open` が小さい。

### アセット側で正規化する場合の提案（手動レビュー対象・本 PR では未実施）

将来 wav 本体を差し替えるなら、上表の `gain dB` をそのまま適用し、`SOUND_GAIN` をすべて 1.0 に戻す。`paper-flip` はピークが -2.4 dBFS と高く、他と比べて波形の尖りが強いため、差し替え時は軽いリミッタを検討する。差し替え後は `assets.manifest.json` のハッシュ更新と `python3 scripts/validate_assets.py` の再実行が必要。

## API

```ts
import { useSound, useAudioSettings } from './audio/useSound';
import { getSoundManager, installAutoUnlock, SOUND_GAIN } from './audio/soundManager';
import { AudioControl } from './components/AudioControl';

const play = useSound(); // マウント時に自動 unlock リスナーを登録
play('stamp');

const { settings, toggleMuted, setVolume } = useAudioSettings();
```

- `SoundManager` はテスト用に `createContext` / `fetchBuffer` / `now` を注入できる（`src/audio/soundManager.test.ts` 参照）。
- `AudioControl` はミュートトグル（`aria-pressed`）と音量スライダー（`input[type=range]`、`aria-label="音量"`）。文言は `data/ui/ja.json` の `settings.audio.*`。

## 再現手順（スマホ）

1. iOS Safari / Android Chrome でアプリを開き、何も触らずに待つ → 音は鳴らない（自動再生制限に従う）。
2. 画面をタップする → 以後 `play()` で音が鳴る。
3. `AudioControl` でミュート ON → 音が止まる。リロードしても ON のまま（localStorage）。
4. 音量スライダーを動かす → 直後の `ui-tap` の大きさが変わる。
