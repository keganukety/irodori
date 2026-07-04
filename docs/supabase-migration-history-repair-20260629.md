# Supabase migration履歴整理 20260629

## 目的

`20260629_product_affiliate_urls.sql` と `20260629_product_affiliate_urls_product_name.sql` がどちらもversion `20260629` として扱われる状態を解消し、今後 `npx supabase db push` で新規migrationだけを安全に適用できるようにする。

## 変更したローカルファイル名

```text
supabase/migrations/20260629_product_affiliate_urls.sql
-> supabase/migrations/20260629000000_product_affiliate_urls.sql

supabase/migrations/20260629_product_affiliate_urls_product_name.sql
-> supabase/migrations/20260629000100_product_affiliate_urls_product_name.sql
```

SQL本文は変更しない。versionだけを14桁timestampへ分離する。

## 作業前バックアップ

本番DBに対してrepairやpushを行う前に、最低1つは実施する。

```powershell
npx supabase db dump --linked --file "backups/prod-before-migration-repair-20260629.sql"
```

またはSupabase DashboardのDatabase Backups / PITRで、復元可能なバックアップ時刻を確認する。

## 反映済み確認SQL

Supabase SQL Editorで次を実行する。

```text
supabase/checks/20260629_affiliate_migrations_applied_check.sql
```

反映済みと判断できる条件:

- `product_column` の6行がすべて `exists_in_db = true`
- `function` の2行がすべて `exists_in_db = true`
- `function` の2行がすべて `authenticated_can_execute = true`

この条件を満たさない場合、migration履歴を `applied` にしない。先に不足内容を確認する。

## 履歴だけを同期する手順

確認SQLで反映済みと判断できた場合だけ実行する。これはSQL本文を再実行せず、Supabaseのmigration履歴だけを補正する。

```powershell
npx supabase migration repair --status applied 20260629000000
npx supabase migration repair --status applied 20260629000100
```

もし確認SQLの `migration_history` で旧version `20260629` が `exists_in_remote_history = true` だった場合は、リネーム後の2つと重複しないよう、状況確認後に旧履歴をrevertedへ寄せる。

```powershell
npx supabase migration repair --status reverted 20260629
```

通常、今回の現象では旧version `20260629` はRemote側に存在しない想定。

## 新しいmigrationの適用

20260629の2件をrepairで `applied` にした後、migration listでこの2件のLocal/Remoteが揃っていることを確認する。

```powershell
npx supabase migration list
```

その状態で、未適用の新規migrationだけをpushする。

```powershell
npx supabase db push
```

今回の新規migration:

```text
supabase/migrations/20260705000000_site_asset_import_sources.sql
```

push後に再度確認する。

```powershell
npx supabase migration list
```

## 今後のルール

- migrationは必ず `npx supabase migration new 名前` で作る
- `20260629_xxx.sql` のような8桁日付ファイルを手作業で作らない
- 同じtimestampのmigrationを複数作らない
- Supabase SQL Editorで手動適用した場合は、すぐに `migration repair --status applied <version>` で履歴とのズレを解消する
- 手動適用したSQLを後から `db push` で再実行しない
- repair前には必ず確認SQLか実DB差分で「既に反映済み」を確認する
