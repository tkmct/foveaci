# Synthetic User Swarm UX-CI (v0.1) — 要件定義・設計

> 目的：**合成ユーザー(synthetic user)が“人っぽく”Web UIを操作**し、その様子を **Session Replay（rrweb/OpenReplay互換）として可視化**。  
> さらに **UX回帰（改悪）をCIで検知してFail** させ、結果から **改善案をAIが根拠付きで提示**する。

---

## 0. 前提・用語

- **Synthetic User**：ペルソナ（目的・性格・制約）を持ち、タスクを遂行するエージェント。
- **Run**：CIまたはローカルで行う一回の実行単位（複数セッションを含む）。
- **Session**：1 synthetic user が1タスクを実行する単位。
- **Artifact**：記録・ログ・レポート（rrwebイベントJSON、動画、スクショ、メトリクス等）。
- **Baseline**：main(または指定ブランチ)の結果。PRとの差分比較に使う。

---

## 1. ゴール（Must）

### 1.1 CIで守るべき価値
- PRごとに主要フロー（例：登録/初回設定/購入/課金）を synthetic user が実行
- **UX回帰を検出**し、閾値超過なら **CIをFail**
- 失敗/劣化の根拠を **Session Replay + 秒単位のハイライト**で提示

### 1.2 “人っぽさ”の要件（見せる / 実際にそう動く）
- **カーソルが見える**（偽カーソルDOMを注入して表示）
- **マウス移動・クリック・スクロール・入力**が人間の速度/ゆらぎで再現される
- “視線”はMVPでは **疑似注視（ホバー/停止/スクロール停止）**を採用し、将来拡張でフィクセーションモデルへ

### 1.3 観測制限（ズルを禁止）
- 意思決定ロジックは原則 **スクリーンショット（ビューポート）由来の情報だけ**で行う
- DOMの全文読解（innerText全取得など）を **禁止**（実装レベルでガード）
- 実行のための要素特定は許可（locator等）するが、**判断材料に使わない**

---

## 2. 非ゴール（Not now）
- 眼球追跡の正確な再現（ハードウェア不要の“それっぽさ”に留める）
- モバイルネイティブアプリのリプレイ（Webに限定）
- 高度な統計推定/因果推論（v1以降）
- OpenReplayの全機能互換（MVPは rrweb互換イベント + 自前ViewerでOK）

---

## 3. ユースケース
- **PRゲート**：主要タスクの達成率や時間が悪化したらFail
- **UXデバッグ**：Failしたセッションのリプレイで「どこで迷った/詰まった」を即確認
- **改善提案**：該当秒とDOM要素を根拠に「何をどう直すべきか」を提示

---

## 4. システム概要

### 4.1 コンポーネント
1) **Runner**（Playwright）
2) **Behavior Engine**（人間らしい入力モデル + ペルソナ）
3) **Recorder**（rrweb注入 + 偽カーソル + ログ収集）
4) **Metrics Extractor**（成功/時間/エラー/迷い指標）
5) **Diff Comparator**（Baseline vs PR）
6) **Advisor**（AI/ルールで改善案、根拠リンク付き）
7) **Reporter**（HTMLレポート生成、CIサマリ、PRコメント用出力）

### 4.2 主要データフロー
- config.yml → Run生成 → 各Sessionを並列実行 → rrwebイベント/ログ/メトリクス生成  
→ Baseline比較（任意）→ Gate判定 → Report生成 → Exit code（CI）

---

## 5. 技術スタック（推奨）
- Node.js + TypeScript
- Playwright（chromium中心）
- rrweb（record + player）
- レポート：静的HTML（rrweb player埋め込み）+ JSON
- CI：GitHub Actions想定（汎用）

---

## 6. 実行モデル

### 6.1 CLI
- `uxci run --config ./config/uxci.yml --out ./artifacts`
- `uxci compare --baseline ./baseline --candidate ./artifacts --out ./report`
- `uxci report --run ./artifacts --out ./report`

### 6.2 並列化
- デフォルト：同時 4〜8 セッション（設定可能）
- 失敗時：同一条件で **リトライ1回**（flaky判定用）

---

## 7. 設定DSL（YAML）
### 7.1 例（最小）
```yaml
project:
  name: "myapp"
  baseUrl: "http://localhost:3000"

run:
  browser: "chromium"
  headless: true
  video: true
  trace: true
  concurrency: 6
  timeoutMs: 180000

recording:
  rrweb: true
  maskInputs: true
  fakeCursor: true

personas:
  - id: "fast_confident"
    speed: 1.2
    jitterPx: 1.5
    misclickRate: 0.01
    typoRate: 0.01
    patienceMs: 1500
  - id: "careful_slow"
    speed: 0.8
    jitterPx: 2.5
    misclickRate: 0.02
    typoRate: 0.03
    patienceMs: 4500

tasks:
  - id: "signup"
    entry: "/"
    goal: "ユーザー登録してダッシュボードに到達"
    steps:
      - kind: "click"
        target: { role: "button", name: "Sign up" }
      - kind: "type"
        target: { label: "Email" }
        value: "test+{{runId}}@example.com"
      - kind: "type"
        target: { label: "Password" }
        value: "Passw0rd!{{runId}}"
      - kind: "click"
        target: { role: "button", name: "Create account" }
      - kind: "expect"
        target: { text: "Dashboard" }

gates:
  - metric: "taskSuccessRate"
    op: ">="
    value: 0.95
  - metric: "medianTaskTimeMs"
    op: "<="
    value: 45000
```

> 注：MVPでは `target` を locator（role/label/text/css）で指定。  
> “意思決定はスクショ由来”を守るため、将来 `visionTarget`（座標クリック）も追加可能。

---

## 8. タスク実行（Task DSL）
### 8.1 Step種類（MVP）
- `goto`：URLへ移動
- `click`：ターゲットをクリック（人間風マウス移動→クリック）
- `type`：入力（遅延・誤字・修正をペルソナに応じて）
- `scroll`：要素/ページへスクロール（慣性/行き過ぎ戻り）
- `wait`：待機（ローディング/アニメーション）
- `expect`：文言/URL/要素の可視性チェック
- `snapshot`：スクショ採取（任意）

### 8.2 Executionの原則
- **クリックは座標**で行う（`locator.boundingBox()`→`page.mouse.move/click`）
- locatorは “どこを押すか” の手段。判断材料には使わない。
- すべての入力イベントは **タイムラインに記録**（rrweb + 独自ログ）

---

## 9. 人間らしい入力モデル（Behavior Engine）

### 9.1 パラメータ
- `speed`：全体速度倍率
- `jitterPx`：マウス到達点のばらつき
- `misclickRate`：ミスクリック（要素近辺に外す）
- `typoRate`：誤字率（Backspaceで修正）
- `patienceMs`：待てる時間（これを超えるとリロード/戻る/離脱などの分岐）
- `hesitationMsRange`：読む/迷う時間（ホバー/停止）

### 9.2 マウス移動
- 直線禁止：ベジェ曲線 + ease-in/out
- moveは 10〜40ms刻みで分割
- 時々 “微調整” を入れる（最後に小さく動く）

### 9.3 スクロール
- 目標位置まで複数ホイール刻み + 停止
- 10%程度で行き過ぎ→戻る

### 9.4 タイピング
- 1文字ごとに遅延（persona速度依存）
- 一定確率で誤字→Backspace→修正
- 重要：入力値はrrwebでマスク（PII保護）

---

## 10. 疑似注視（Attention）MVP仕様
> MVPでは“視線そのもの”は作らず、**注視っぽい行動**を作る。

- 注視イベント発火条件：
  - hover継続が閾値（例：>350ms）
  - mouse停止が閾値（例：>250ms）
  - scroll停止が閾値（例：>400ms）
- 記録：
  - `attention_events.json` に (timestamp, type, bbox, durationMs) を格納
- レポート表示：
  - リプレイのタイムラインに注視マーカーを表示

将来拡張（v0.2+）：
- fixation点(x,y)を内部状態として持ち、中心窩半径だけ高解像で読む（foveated）。

---

## 11. Recording / Replay

### 11.1 rrweb注入
- `page.addInitScript()` で rrweb recorder + masking + console/network hook を注入
- `maskAllInputs`/`maskTextClass`等で秘匿
- rrwebイベントは `events.jsonl` または `events.json` として保存

### 11.2 偽カーソル
- ページに `div#uxci-cursor` を注入し、mousemove/clickの座標を反映
- rrweb側に座標イベントが残るよう、必要ならカスタムイベントも追加

### 11.3 追加ログ
- console logs
- network (failed requests, long TTFBなど)
- Playwright trace / video（任意）

---

## 12. メトリクスとゲート

### 12.1 セッションメトリクス（MVP）
- `taskSuccess`（bool）
- `taskTimeMs`
- `numErrors`（console error + uncaught + HTTP>=400）
- `numBacks`（history.back/戻る導線）
- `numRageClicks`（同一要素を短時間に連打）
- `numRetries`（同じ入力のやり直し）
- `scrollDepth` / `scrollOscillation`（行ったり来たり）

### 12.2 Run集計
- successRate
- median/p95 taskTime
- errorRate
- frictionScore（加重合算でOK）

### 12.3 Gate判定
- YAMLの `gates` に基づき判定（Fail時は exit 1）
- ベースライン比較モード：
  - `deltaMedianTaskTimeMs <= +10%`
  - `deltaSuccessRate >= -2%` など

---

## 13. Diff（Baseline vs PR）
- 同一 config / 同一 persona seed / 同一 task を使う
- 乱数seed固定で再現性確保
- レポートで「分岐点（最初に差が出た時刻）」を表示
  - 例：PRではSignupボタンが見つからずスクロール増→時間悪化

---

## 14. Advisor（AI改善提案）

### 14.1 入力
- failing sessionsの：
  - スナップショット（数枚）
  - 注視イベント
  - 主要メトリクス
  - 失敗の周辺ログ（console/network）
  - クリック対象のrole/name/selector（判断材料ではなく根拠提示として）

### 14.2 出力（必須フォーマット）
- Findings（事実）：根拠リンク（時刻・セッションID）
- Hypothesis（原因仮説）：UXカテゴリ（情報不足/入力負荷/フィードバック不足/信頼不足…）
- Suggestions（提案）：具体案 + 期待インパクト（高/中/低）
- Verification（確認方法）：反事実テスト案

> MVPではAIはオプション（`--advisor=off`）。  
> まずはルールベース（rage click/scroll oscillation/エラー文検知）からでも可。

---

## 15. セキュリティ / プライバシー
- PIIを含む入力は **必ずマスク**（rrweb + 自前ログもマスク）
- アクセストークン等は artifact に絶対に残さない（ヘッダ除外）
- CIではテスト用環境/テスト用アカウントのみを対象にする
- 外部送信（AI API）はオプション＆明示設定が必要

---

## 16. リポジトリ構成（提案）
```
uxci/
  packages/
    runner/           # Playwright runner
    recorder/         # rrweb injection, cursor overlay
    behavior/         # human-like input model
    metrics/          # extract + aggregate + gates
    reporter/         # html report + assets
    advisor/          # optional ai / rules
  config/
    schema.json
    examples/
  bin/
    uxci.ts
  docs/
    SPEC.md
```

---

## 17. 実装マイルストーン（最短で価値を出す順）
### M0: Skeleton
- CLI骨格、YAML読み込み、artifactディレクトリ作成

### M1: Runner + rrweb replay（MVPの核）
- Playwrightでtask実行
- rrwebイベント保存
- 偽カーソル注入
- HTML reportでリプレイ再生（1セッションでもOK）

### M2: Metrics + Gate
- success/time/errors/rage clicks/scrollを計測
- gatesでCI Failが動く

### M3: Baseline Diff
- baseline読込、差分集計、レポートで比較

### M4: Advisor（最小）
- ルールベース提案（rage clickやエラー文から）
- （任意）AI提案の導入

### M5: Swarm
- concurrency, seed固定, flakyリトライ

---

## 18. Definition of Done（MVP）
- `uxci run` がローカルで動く（サンプルWebでも可）
- rrwebリプレイがHTMLで再生でき、**カーソルが動いてクリック/入力が見える**
- メトリクスがJSONで出る
- GateでFailできる
- すべてartifactに保存される（再現可能）

---

## 19. 重要な設計制約（守る）
- “人っぽさ”は **入力の出し方**と**観測制限**で作る  
- 判断材料としてDOM全文取得をしない（禁止事項をコードでガード）  
- リプレイは **既存のrrweb互換**に寄せる（自作しない）
