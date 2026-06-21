# IRODORI

## ローカル起動

通常の画面確認はViteで起動します。

```bash
npm run dev
```

この起動方法では、`functions/`配下のCloudflare Pages Functionsは実行されません。そのため、楽天の「商品URLだけで生成」は確認できません。Viteは未知の`/api/...`にTOPページのHTMLを返すため、API確認には次のCloudflare Pages環境を使用してください。

## 楽天URLだけ生成APIを含めたローカル確認

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev-pages.ps1
```

このコマンドはViteでサイトを`dist/`へビルドし、Wranglerで`dist/`と`functions/`をまとめて起動します。Wranglerが表示するローカルURLを開いてください。通常の`http://localhost:5173`ではAPIは動作しません。

スクリプトは内部的に次のコマンドを使用します。

```bash
npm run build
npx --yes wrangler@4 pages dev dist --compatibility-date=2026-06-21
```

Wranglerが未導入の場合は、初回実行時に`npx`がWrangler 4を一時取得します。

API確認例：

```text
/api/rakuten-product-info?url=https%3A%2F%2Fitem.rakuten.co.jp%2Fnatural-living%2Fu518999%2F
```

正常時は`application/json`で次の情報が返ります。

- `normalized_item_url`
- `shop_key`
- `item_code`
- `title`
- `image_urls`
- `detected_item_id`
- `detected_me_id`

楽天側の取得がタイムアウトした場合も、HTTP 502ではなく判定可能なJSONを返します。

```json
{
  "ok": false,
  "error": "楽天商品ページの取得がタイムアウトしました。",
  "fallbackAvailable": true
}
```

`fallbackAvailable`が`true`の場合、管理画面では既存の楽天アフィHTML貼り付け登録へ戻れます。

楽天商品ページの取得はサーバー側で行います。ブラウザから楽天商品ページを直接取得する実装にはしないでください。

## ビルド

```bash
npm run build
```
