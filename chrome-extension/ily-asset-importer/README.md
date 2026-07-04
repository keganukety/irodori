# iLy. Image Manager Saver

Web上の画像URLを、PCへ保存せずに iLy. / IRODORI の画像管理へ登録するChrome拡張です。

## 連携先

- 画像管理画面: `/assets-admin.html`
- 保存API: `/api/assets-import`
- Supabase Storage: `site-assets`
- DB登録: 既存RPC `create_site_asset`
- ブランド紐付け: 既存RPC `link_brand_site_asset`
- 重複URL確認: `site_asset_import_sources`

`site_assets` 本体のカラムは変更していません。メモ欄は既存の `caption` に保存します。categoryは既存DBに専用カラムがないため、asset_keyやtitle/altの命名に使う入力として扱います。

## ファイル構成

```text
chrome-extension/ily-asset-importer/
  manifest.json
  popup.html
  popup.css
  src/
    config.ts
    background.ts
    content-script.ts
    popup.ts
  dist/
    config.js
    background.js
    content-script.js
    popup.js
```

Chromeは `dist/*.js` を読みます。TypeScriptは編集用の元ファイルです。

## 初期設定

1. Supabaseに `supabase/migrations/20260705000000_site_asset_import_sources.sql` を適用します。
2. Cloudflare PagesのVariables and secretsに次を追加します。

```text
ASSET_IMPORT_ALLOWED_ORIGINS=chrome-extension://<拡張機能ID>
ASSET_IMPORT_ENABLE_CLOUDFLARE_IMAGE_RESIZING=false
```

Cloudflare Image Resizingを有効にしている場合だけ、2つ目を `true` にします。

3. Chromeで `chrome://extensions` を開き、デベロッパーモードをONにします。
4. 「パッケージ化されていない拡張機能を読み込む」から `chrome-extension/ily-asset-importer` を選びます。
5. 表示された拡張機能IDを `ASSET_IMPORT_ALLOWED_ORIGINS` に設定し、Cloudflare Pagesを再デプロイします。

## 使い方

1. 自サイトの `/assets-admin.html` で管理者ログインします。
2. 拡張のポップアップで「接続」を押します。
3. 参考ページで画像を右クリックして「iLy.画像管理に保存」を押すか、拡張アイコンからページ内画像を選びます。
4. 用途、asset_key、title、alt、brand slug/category、PC/SP、公開状態などを入力して保存します。
5. 成功後の「画像管理で開く」から登録結果を確認します。

## セキュリティ

- service role keyは拡張にもAPIにも入れません。
- 拡張が送るのは画像URLとメタ情報、管理者本人のSupabase access tokenだけです。
- API側で `is_admin()` を再確認します。
- API側で画像URLをfetchし、Storage uploadと `site_assets` 登録を行います。
- `http` / `https` 以外、`data:` / `file:` / `blob:` などは拒否します。
- localhost、internal host、IP直指定、非標準ポートへのfetchは拒否します。
- リダイレクト先も同じ検証を行います。
- 実バイト列でJPEG / PNG / WebP / AVIFを判定します。
- 元画像は20MBまで、Storage保存画像は既存バケット仕様に合わせて5MBまでです。
- SVGの外部URL取り込みは安全のためAPIでは拒否します。SVGアイコンは既存管理画面から登録してください。

## 独自ドメインで使う場合

次を差し替えます。

- `manifest.json` の `host_permissions`
- `src/config.ts`
- `dist/config.js`
- Cloudflare Pagesの `ASSET_IMPORT_ALLOWED_ORIGINS`

`host_permissions` は自サイトだけにしてください。任意サイトの画像抽出は `activeTab` でユーザー操作時だけ行います。
