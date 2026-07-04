# Chrome拡張 画像直接保存MVP

## 既存仕様への連携

既存の画像管理は `src/assetsAdmin.ts` で、`site-assets` バケットへアップロードした後に `create_site_asset` RPCで `site_assets` へ登録しています。管理者判定は `is_admin()`、ブランド素材は `link_brand_site_asset` で `brands.logo_asset_key` / `brands.hero_asset_key` へ紐付ける形です。

Chrome拡張ではStorageへ直接アップロードせず、`functions/api/assets-import.ts` に画像URLとメタ情報だけを送ります。APIは管理者本人のSupabase access tokenで `is_admin()` を確認し、サーバー側で画像URLをfetchしてから、既存と同じ `site-assets` / `create_site_asset` / `link_brand_site_asset` に流します。

## DB差分

`site_assets` 本体は変更しません。

重複URL警告のためだけに `site_asset_import_sources` を追加します。これは「どの元URLからどのsite_assetsを作ったか」を保存する履歴テーブルで、既存の素材表示や公開処理には影響しません。

```text
supabase/migrations/20260705000000_site_asset_import_sources.sql
```

## 追加API

```text
POST /api/assets-import
```

拡張から送るもの:

- 画像URL
- 取得元ページURL
- 用途
- asset_key
- title / alt
- brand slug または category
- PC画像 / SP画像
- 公開状態
- 表示順
- リンクURL
- メモ

API側で行うこと:

- Supabase access tokenで `is_admin()` を確認
- URLスキームとSSRF対策の検証
- 画像fetch、MIME判定、サイズ上限確認
- 任意でCloudflare Image ResizingによるWebP化
- Supabase Storage `site-assets` へupload
- `create_site_asset` RPC実行
- ブランド素材の場合は `link_brand_site_asset` RPC実行
- 元URL履歴を `site_asset_import_sources` に保存

## 環境変数

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
ASSET_IMPORT_ALLOWED_ORIGINS=chrome-extension://<拡張機能ID>
ASSET_IMPORT_ENABLE_CLOUDFLARE_IMAGE_RESIZING=false
```

service role keyは不要です。

## 動作確認

1. migrationをSupabaseへ適用します。
2. `npm run build` でサイトをビルドします。
3. `powershell -ExecutionPolicy Bypass -File scripts/dev-pages.ps1` でPages Functions込みのローカル環境を起動します。
4. `chrome-extension/ily-asset-importer/manifest.json` の `host_permissions` にローカルURLが含まれていることを確認します。
5. Chrome拡張を読み込みます。
6. `/assets-admin.html` で管理者ログインします。
7. 拡張ポップアップの接続先をローカルURLにして「接続」を押します。
8. 画像のあるページで右クリックまたはポップアップから画像を選択して保存します。
9. 成功後リンクから `/assets-admin.html?asset_key=...` を開き、登録内容を確認します。

## 注意点

- SP画像として保存する場合も、既存DBはPC画像必須のため、同じ元画像をPC/SPそれぞれのStorage pathへ保存します。
- 複数選択では `asset_key_2`, `asset_key_3` のように連番を付けます。
- 外部SVGはAPIでは拒否します。SVGは既存管理画面のファイルアップロードを使います。
- Cloudflare Image Resizingが無効な環境では、5MBを超える元画像は保存できません。
