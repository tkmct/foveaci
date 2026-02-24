# Roadmap Validation Against SPEC.md

## Method
This validation maps `SPEC.md` sections to the PR-sequenced roadmap in `implementation_roadmap.md`. Status definitions are:
1. Covered: roadmap PRs fully implement expected capability.
2. Partial: capability is addressed but intentionally narrowed for current product direction.
3. Missing: no concrete roadmap PR currently covers it.

## Coverage Matrix
| Plan Section | Expected Capability | Roadmap PR Coverage | Status |
| --- | --- | --- | --- |
| 1. ゴール（Must） | CIでUX価値を継続評価 | PR0, PR2, PR3でPR単位可視化を実装。固定フロー監視と常時Failは後段化 | Partial |
| 2. 非ゴール | スコープ制御 | PR0で非ゴールを明文化 | Covered |
| 3. ユースケース | PRゲート、UXデバッグ、改善提案 | PR2, PR3, PR4, PR5で可視化と提案を優先。厳格ゲートは後段 | Partial |
| 4. システム概要 | Runner/Recorder/Metrics/Diff/Advisor/Reporter連携 | PR1, PR2, PR4, PR5で現行構成を拡張 | Covered |
| 5. 技術スタック | Node/TS/Playwright/rrweb/GitHub Actions | PR3でActions整備、他PRで現行スタックを維持 | Covered |
| 6. 実行モデル | CLIによる実行と比較 | PR1で`discover`（preview生成）、PR2で承認後`pr-eval`を追加 | Covered |
| 7. 設定DSL | 設定と運用可能なサンプル | PR0でPR評価用サンプル設定を追加 | Covered |
| 8. タスク実行DSL | click/type/expect等の実行基盤 | 既存実装を前提にPR2で運用統合 | Covered |
| 9. Behavior Engine | 人間らしい入力モデル | 現行実装を継続利用。PR6で再現性を強化 | Covered |
| 10. 疑似注視 | 注視イベント記録・活用 | 現時点で明示PRなし | Missing |
| 11. Recording / Replay | rrweb互換記録と可視化 | 現行実装 + PR5で表示改善 | Covered |
| 12. メトリクスとゲート | 指標抽出と判定 | PR2で差分評価、厳格Fail運用は後段 | Partial |
| 13. Diff（Baseline vs PR） | 同条件比較と差分提示 | PR2で承認済みシナリオに限定して比較 | Covered |
| 14. Advisor | 根拠付き改善提案 | PR4で変更サーフェス連動の優先提案 | Covered |
| 15. セキュリティ/プライバシー | PII保護と安全運用 | 現行方針を維持。PR0で運用ルールを補強 | Covered |
| 17. マイルストーン | M0-M5進行 | PR4優先方針を反映しつつ、依存上M3-liteを先行 | Partial |
| 18. Definition of Done | 実行・可視化・判定・再現性 | PR2/PR3/PR5/PR6で段階達成 | Covered |
| 19. 設計制約 | 観測制限・rrweb互換 | PR0で契約化し全PRで準拠 | Covered |

## Conflict Check
1. `SPEC.md` は主要フロー固定監視とCI failを重視するが、現行方針は「PRごとの新機能UX可視化」を優先する。
2. `SPEC.md` のM4優先希望は依存関係上そのまま実装不可で、M3-lite（差分基盤）先行が必要。
3. `SPEC.md` は自動実行前提だが、現行方針では「シナリオ提示→レビュー承認→実行」の手動承認ゲートを導入する。
4. 承認トリガーはPRラベル `ux-eval-approved` に固定する。
5. これらは矛盾ではなく、プロダクト方針変更による段階的導入と解釈する。

## Gaps Found
1. 疑似注視（Section 10）は今回のロードマップに未着手。必要ならPR7として追加する。
2. 厳格Gate（Section 12.3）はPoC外。運用安定後に段階導入PRが必要。
3. シナリオ自動生成の品質保証方法はPR1で決めるが、初期は警告ベース運用が前提。
4. 入力ソースはPR差分とPR本文に限定し、ドキュメントは`README.md`/`SPEC.md`/`docs/`の差分部分のみ参照する。

## Recommended Gap-Closing PRs
1. PR7: Attention Events MVP（hover/idle/scroll-stopの記録と表示）。
2. PR8: Optional Strict Gate Mode（閾値超過時Failをfeature flagで導入）。

## Final Validation Result
Roadmap is valid for the current product direction. Coverage is sufficient for internal PoC launch focused on PR-level UX visualization, with identified intentional gaps tracked as follow-up PRs.
