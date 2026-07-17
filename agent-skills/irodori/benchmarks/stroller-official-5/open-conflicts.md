# stroller-official-5 — 未解決の公式情報内矛盾(open conflicts)

- 作成日: 2026-07-16
- 方針: 公式情報内で食い違いがある場合はconflictingとして**両方を保持**し、推測で解消しない。取説を優先候補としても反対claimを削除しない。

## 1. CYBEX Melio Carbon 2026 — 新生児対応の使用開始時期(既存パイロットから継続)

| 記載 | 内容 | claim |
|---|---|---|
| 公式商品ページ 商品説明 | 「You can use this stroller **from birth** with the included Newborn Nest.」 | clm-melio26-012 (manufacturer_claim) |
| 同ページ 仕様欄 | 「Age range: **From 1 month** to approx. 3 years」 | clm-melio26-004 / clm-melio26-025 |
| 日本語取扱説明書 | 「新生児期を過ぎた**生後1ヶ月から**」(新生児=生後28日/4週間までと定義) | clm-melio26-014 / clm-melio26-026 |

- 状態: `target_age`(値は候補{1,36}のままconflicting)・`newborn_ready`(value: null / conflicting)として**未解決のまま保持**
- 人間向け安全側メモ(既存run review_report.editorial_notes): 「IRODORIでは、現時点では取扱説明書および仕様欄に基づき『生後1か月から』を安全側の基準として扱います」
- 解消条件: メーカーへの確認、または公式ページの表記統一

## 2. 追加4商品 — 公式情報内の矛盾は検出なし

2026-07-16の調査範囲(各公式ページ+取得できた取説2冊)では、アップリカ カルーンエアー メッシュ AC・コンビ スゴカル エッグショック LA・ピジョン Runfee RB5・CYBEX Libelle 2026の**公式情報内の矛盾は検出していない**。

### 矛盾として扱わなかった差異(記録のみ)

| 商品 | 差異 | 扱い |
|---|---|---|
| Runfee RB5 | 展開時サイズが背面位(W516)と対面位(W525)で異なる | 使用状態の違い。両方をclaimに保持し、正規化は背面位を採用(notesに明記) |
| Libelle 2026 | 対象月齢の上限が公式ページ『approx. 4 years』/取説『22kgに達するまで』 | 上限の表現方法の違い(月齢 vs 体重)。開始6ヶ月は一致。両claimを保持 |
| スゴカル LA | 開サイズの奥行/高さが可変範囲(D725-835/H991-1048) | 単一値ではなく範囲。最大値で正規化し全範囲をclaimに保持 |

## 3. 公式情報とローカルproductsの差異(公式内矛盾ではないが人間レビュー要)

| 商品 | 差異 | 対応 |
|---|---|---|
| スゴカル エッグショック LA | ローカル価格32,000円 vs 公式ストア48,000円 | identity-review.mdに記録。ローカル値の由来確認が必要 |
| Libelle 2026 | ローカル重量6.3kg vs 公式仕様6kg。ローカル価格29,975円は公式非表示 | 同上 |

ローカル値は公式根拠に使用していないため、run内のclaim/featureには影響しない。
