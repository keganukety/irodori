# iLy. 演出・アニメーション カタログ

iLy.（irodori）に入れたい演出・アニメーション案を、実装しやすい形でカタログ化したメモです。**このドキュメントは設計・整理用で、本番ページにはまだ組み込みません。** DB / Supabase migration には一切触れません。

## 0. 前提（既存の実装資産）

新しく作り始める前に、すでにサイトに入っている仕組みを再利用するのが基本方針です。

| 既存の仕組み | 場所 | 内容 |
| --- | --- | --- |
| fade-up リビール | [src/shared-ui.ts](../src/shared-ui.ts) `setupFadeUpAnimations` / `injectFadeUpStyles` | `IntersectionObserver` で `.is-visible` を付与。`data-fade-up` 要素を下から18pxフェードイン。`prefers-reduced-motion` 対応済み |
| 画像リビール（マスク） | [src/home.css:3250](../src/home.css) `.reveal-wrapper` / `.reveal-img` | `reveal-wrapper` + `reveal-img` で画像のクリップ/フェード表示 |
| スマートヘッダー（簡易版） | [src/shared-ui.ts:378](../src/shared-ui.ts) `syncHomeHeaderScrollState` | scrollY>12 で `is-scrolled` を付与（**現状 home のみ・スクロール方向は未対応**） |
| クイックビュー | [src/product-quick-view.ts](../src/product-quick-view.ts) / [src/product-quick-view.css](../src/product-quick-view.css) | `.quick-view-dialog` / `.quick-view-panel`。モーダル基盤あり |
| 商品カード hover（画像切替） | [src/home.ts:965](../src/home.ts) `home-product-card__img--secondary` | hover で2枚目画像に差し替える下地あり |
| 診断フロー | [src/stroller-guide.ts:105](../src/stroller-guide.ts) `diagnosisQuestions` | アイコン付き選択肢カードの多段質問フロー |
| デザイントークン | [src/styles.css:11](../src/styles.css) `:root` | `--ily-ease-fast` / `--ily-ease-smooth` / `--ily-duration-fast` / `--ily-duration-slow` |
| back-to-top | [src/back-to-top.ts](../src/back-to-top.ts) / [src/back-to-top.css](../src/back-to-top.css) | スクロール量でトグル表示 |

**構成メモ:** MPA（Vite マルチページ）。`index.html` / `products.html` / `product.html` / `brand.html` / `compare.html` / `stroller-guide.html` が個別エントリで、ページ間はフルリロード（SPA ルーターなし）。→「ページ遷移フェード」は View Transitions API か軽量オーバーレイで擬似的に行う必要あり。

**共通ルール（[irodori-design-system.md](./irodori-design-system.md) 準拠）:**
- 上品・軽い・詰め込まない。派手すぎる演出はブランド方針に反する
- すべての演出は `prefers-reduced-motion: reduce` で無効化する（既存パターンを踏襲）
- 値は直書きせず `:root` のトークン（ease / duration）に寄せる
- 影の多用・強いカード枠は避ける

---

## 1. 控えめなキネティック・タイポグラフィ

見出し・英字ラベル・TOPコピーを、1文字ずつ or 1行ずつ静かに立ち上げる演出。

| 項目 | 内容 |
| --- | --- |
| 使うページ | TOP（ヒーローコピー / セクション英字ラベル）、ブランドページ（ブランドコピー） |
| 目的 | ブランドサイトらしい上質さ。読み物としての導入感を出す |
| 難易度 | 中（文字分割 + stagger。1行単位なら低） |
| SP向きか | ○（1行/ワード単位なら軽い。1文字splitは重くなりがちなので抑制） |
| 優先度 | 中 |
| 触るファイル候補 | [src/shared-ui.ts](../src/shared-ui.ts)（既存 fade-up を拡張して stagger 対応）、[src/home.css](../src/home.css)、[src/brand.css](../src/brand.css) |
| 実装メモ | 既存 `data-fade-up` に `--fade-delay` を足して line/word stagger を作るのが最短。文字splitは Mamelon の丸みと letter-spacing を崩さない範囲で。動きは translateY 6〜10px + opacity のみ、回転・弾みは入れない |

---

## 2. スマートヘッダー

下スクロールで隠す / 上スクロールで出す + スクロール時に背景を濃く（縮小）する。

| 項目 | 内容 |
| --- | --- |
| 使うページ | 全ページ共通ヘッダー |
| 目的 | 閲覧領域を広げつつ、戻りたい時にすぐナビを出す |
| 難易度 | 低〜中（既存 `is-scrolled` の拡張。方向検知を追加） |
| SP向きか | ◎（SPでこそ効果大） |
| 優先度 | **高** |
| 触るファイル候補 | [src/shared-ui.ts](../src/shared-ui.ts) `syncHomeHeaderScrollState`（home限定→全ページ化 + 方向検知）、[src/styles.css](../src/styles.css)（`.site-header--hidden` の transform） |
| 実装メモ | 直前 scrollY と比較して方向判定 → `is-hidden` クラスで `transform: translateY(-100%)`。クイックビュー/ドロワー展開中は隠さない。比較バーやモバイルメニュー開閉との干渉に注意。しきい値は現状の12pxを流用しつつヒステリシスを持たせる |

---

## 3. グラスモーフィズム・クイックビュー

既存クイックビューのオーバーレイ/パネルにすりガラス（`backdrop-filter: blur`）を適用し、開閉をふわっと。

| 項目 | 内容 |
| --- | --- |
| 使うページ | 商品一覧（TOP / products / brand）→ クイックビュー起動箇所すべて |
| 目的 | 商品画像を主役にしたまま、モーダルの浮遊感・高級感を出す |
| 難易度 | 低（基盤あり。CSS中心） |
| SP向きか | △（`backdrop-filter` は低スペック端末で重い。SPは blur 弱め or フォールバック） |
| 優先度 | 中〜高 |
| 触るファイル候補 | [src/product-quick-view.css](../src/product-quick-view.css) `.quick-view-dialog` / `.quick-view-panel`、必要なら [src/product-quick-view.ts](../src/product-quick-view.ts)（開閉クラス付与） |
| 実装メモ | オーバーレイ `background: rgba(255,255,255,0.6)` + `backdrop-filter: blur(14px)`（既存で blur 使用実績あり）。パネルは scale(0.98)→1 + opacity。`@supports not (backdrop-filter: blur())` で不透明フォールバック。白基調・淡い枠を保ちデザイン方針を崩さない |

---

## 4. fade-up / blur-in

スクロールでセクション・カードが下から浮かび上がる（+軽いピント合わせ blur）。

| 項目 | 内容 |
| --- | --- |
| 使うページ | 全ページ（TOP各セクション、一覧カード、詳細、比較、診断） |
| 目的 | ページの流れ・リズムを作る。iLy. の基礎トーン |
| 難易度 | 低（**ほぼ実装済み**） |
| SP向きか | ◎ |
| 優先度 | **高（=土台。他演出の前提）** |
| 触るファイル候補 | [src/shared-ui.ts](../src/shared-ui.ts) `injectFadeUpStyles`（blur を1〜2px足すオプション追加）、対象セレクタの追加登録 |
| 実装メモ | 既に `data-fade-up` + `IntersectionObserver` で稼働中。blur-in は `filter: blur(4px)→0` を transition に足すだけ。ただし blur はSPで負荷が出るので必要な要素に限定。新規セクションを作る際は `setupFadeUpAnimations` の対象リストに追加するだけで揃う |

---

## 5. 商品カード hover

hover で画像2枚目に切替 / 軽い持ち上げ / クイックビューボタンの出現。

| 項目 | 内容 |
| --- | --- |
| 使うページ | 商品一覧（TOP / products / brand / compare 候補） |
| 目的 | 商品の別カット・操作導線を自然に見せる |
| 難易度 | 低（画像切替の下地あり） |
| SP向きか | △（hoverなし。SPは常時表示 or タップで対応。過度な演出は不要） |
| 優先度 | 中 |
| 触るファイル候補 | [src/home.css](../src/home.css) `.home-product-card`、[src/styles.css](../src/styles.css)（products一覧カード）、[src/brand.css](../src/brand.css) |
| 実装メモ | `home-product-card__img--secondary` の hover 表示を整える。持ち上げは `translateY(-2px)` 程度・影は最小（デザイン方針で影多用NG）。画像だけ角丸ルール維持。SPは image swap を無効化しレイアウトを触らない |

---

## 6. ページ遷移フェード

ページ移動時に白フェードで繋ぐ（MPAのフルリロードの断絶感を和らげる）。

| 項目 | 内容 |
| --- | --- |
| 使うページ | 全ページ間（特に一覧→詳細、TOP→カテゴリ） |
| 目的 | フルリロードのちらつきを消し、連続した体験にする |
| 難易度 | 中（MPAなので工夫が要る） |
| SP向きか | ○ |
| 優先度 | 中（体感効果は高いが、実装/検証コスト注意） |
| 触るファイル候補 | [src/shared-ui.ts](../src/shared-ui.ts)（遷移オーバーレイの共通注入）、[src/main.ts](../src/main.ts) 初期化、`*.html` の `<head>`（View Transitions 用 meta） |
| 実装メモ | 2案。(A) **View Transitions API**（`@view-transition { navigation: auto }`）: 対応ブラウザで最小コード。非対応は素の遷移でOK。(B) **手動オーバーレイ**: リンククリックで白幕フェードイン→遷移、`pageshow` でフェードアウト。BFCache・戻る操作・外部リンク/アフィリンクの除外に注意。まずは (A) を推奨、非対応環境は何もしない設計で |

---

## 7. 診断カードのスワイプ演出

ベビーカー診断の質問を、カードが横にスワイプして次の質問へ切り替わる演出。

| 項目 | 内容 |
| --- | --- |
| 使うページ | stroller-guide（診断フロー）、将来の共通診断 |
| 目的 | 一問一答をアプリライクに。回答の達成感・テンポを出す |
| 難易度 | 中（状態遷移 + タッチジェスチャ対応） |
| SP向きか | ◎（SPのタッチ操作と好相性） |
| 優先度 | 中 |
| 触るファイル候補 | [src/stroller-guide.ts](../src/stroller-guide.ts) `diagnosisQuestions` レンダリング/遷移、[src/stroller-guide.css](../src/stroller-guide.css) |
| 実装メモ | 選択→現カード左スライドアウト + 次カード右からイン。進捗インジケータを付けると親切。タッチスワイプでの戻る/進むはオプション（アクセシビリティのためボタン操作も必ず残す）。`prefers-reduced-motion` 時はクロスフェードのみ。診断ロジック自体は既存のまま演出だけ被せる |

---

## 8. カテゴリヒーローの画像・文字レイヤー演出

カテゴリ/ブランドのヒーローで、背景画像とロゴ・コピーを別レイヤーで動かす（軽いパララックス / ずらしイン）。

| 項目 | 内容 |
| --- | --- |
| 使うページ | ブランドページ（`brand-showcase-hero`）、将来のカテゴリ一覧ヒーロー、TOPヒーロー |
| 目的 | 世界観の演出。ブランドページの「見せるページ」性を強める |
| 難易度 | 中 |
| SP向きか | △〜○（パララックスはSPで効きにくい/重い。ずらしフェードに留めると安全） |
| 優先度 | 中〜低 |
| 触るファイル候補 | [src/brand.ts](../src/brand.ts) `renderShowcaseHero`、[src/brand.css](../src/brand.css) `.brand-hero-photo` / `.brand-hero-copy`、TOPは [src/home.ts](../src/home.ts) / [src/home.css](../src/home.css) |
| 実装メモ | 初期表示: 画像はマスク/ズームイン（既存 `reveal-wrapper` 活用）、ロゴ・コピーは遅延 fade-up で1テンポ後に。スクロールパララックスは `transform: translateY` を控えめに（数十px以内）、`will-change` を絞る。文字が画像に埋もれないコントラストを維持。デザイン方針上、動きは上品な範囲に抑える |

---

## 9. 優先度まとめ

| 演出 | 難易度 | SP | 優先度 | 分類 |
| --- | --- | --- | --- | --- |
| 4. fade-up / blur-in | 低 | ◎ | 高 | 今すぐ（土台） |
| 2. スマートヘッダー | 低〜中 | ◎ | 高 | 今すぐ |
| 3. グラス クイックビュー | 低 | △ | 中〜高 | 今すぐ |
| 5. 商品カード hover | 低 | △ | 中 | 次点 |
| 1. キネティック・タイポ | 中 | ○ | 中 | 次点 |
| 7. 診断カードスワイプ | 中 | ◎ | 中 | 次点 |
| 6. ページ遷移フェード | 中 | ○ | 中 | 後回し（要検証） |
| 8. ヒーロー・レイヤー演出 | 中 | △ | 中〜低 | 後回し |
