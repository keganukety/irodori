// 公開商品取得境界のregression test。
// products.memo などの内部管理カラムが公開境界(コード・ビュー定義)へ
// 再混入しないことを静的に検証するcontract test。
// 実行: node --test --test-isolation=none tests/public-product-boundary.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8');

const VIEW_MIGRATION = 'supabase/migrations/20260717000000_public_products_view.sql';
const REVOKE_MIGRATION = 'supabase/migrations/20260717001000_revoke_products_direct_select.sql';
// revoke migrationはStage 2(別PR)で追加される。存在する場合のみ検証する。
const revokeMigrationExists = existsSync(path.join(repoRoot, REVOKE_MIGRATION));
const MIGRATIONS_PRESENT = revokeMigrationExists
  ? [VIEW_MIGRATION, REVOKE_MIGRATION]
  : [VIEW_MIGRATION];
const PUBLIC_PRODUCTS_LIB = 'src/lib/publicProducts.ts';

// 公開してはならない内部管理カラム。
const INTERNAL_COLUMNS = [
  'memo',
  'spec_source_url',
  'spec_checked_date',
  'affiliate_checked_at',
  'affiliate_note',
];

// 公開サイトのバンドルへ入るファイル(管理画面admin/affiliateAdmin/assetsAdminは除く)。
const PUBLIC_SOURCE_FILES = [
  'src/home.ts',
  'src/main.ts',
  'src/product.ts',
  'src/brand.ts',
  'src/compare.ts',
  'src/stroller-guide.ts',
  'src/product-quick-view.ts',
  'src/products-url-filter.ts',
  'src/shared-ui.ts',
  'src/rakuten-affiliate.ts',
  'src/data/fallback-products.ts',
];

// 公開サイトで商品データを取得するファイル。
const PUBLIC_PRODUCT_FETCH_FILES = [
  'src/home.ts',
  'src/main.ts',
  'src/product.ts',
  'src/brand.ts',
  'src/compare.ts',
  'src/stroller-guide.ts',
];

function extractViewColumns(sql) {
  const match = sql.match(/create or replace view public\.public_products as\s+select\s+([\s\S]*?)\s+from public\.products;/);
  assert.ok(match, 'public_productsビュー定義がmigrationに存在すること');
  return match[1]
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean);
}

function extractLibColumns(source) {
  const match = source.match(/export const PUBLIC_PRODUCT_COLUMNS = \[([\s\S]*?)\] as const;/);
  assert.ok(match, 'PUBLIC_PRODUCT_COLUMNSがlibに存在すること');
  return [...match[1].matchAll(/'([^']+)'/g)].map(([, column]) => column);
}

test('公開ビューのカラムallowlistに内部管理カラムが含まれない', () => {
  const columns = extractViewColumns(read(VIEW_MIGRATION));
  assert.ok(columns.length > 0, 'ビューのカラムが1つ以上あること');
  for (const internal of INTERNAL_COLUMNS) {
    assert.ok(!columns.includes(internal), `ビューに内部カラム ${internal} が含まれない`);
  }
});

test('公開ビューはselect *で定義されていない', () => {
  const sql = read(VIEW_MIGRATION);
  const viewBlock = sql.match(/create or replace view[\s\S]*?from public\.products;/)?.[0] ?? '';
  assert.ok(viewBlock, 'ビュー定義ブロックが存在すること');
  assert.ok(!/select\s+\*/i.test(viewBlock), 'ビュー定義がselect *を使わない');
});

test('caution_notesは公開ビューに含まれる(公開用注意事項)', () => {
  const columns = extractViewColumns(read(VIEW_MIGRATION));
  assert.ok(columns.includes('caution_notes'));
});

test('コード側allowlist(PUBLIC_PRODUCT_COLUMNS)とビュー定義が一致する', () => {
  const viewColumns = extractViewColumns(read(VIEW_MIGRATION));
  const libColumns = extractLibColumns(read(PUBLIC_PRODUCTS_LIB));
  assert.deepEqual([...libColumns].sort(), [...viewColumns].sort());
});

test('公開商品型PublicProductは内部管理カラムを型レベルで拒否する', () => {
  const source = read(PUBLIC_PRODUCTS_LIB);
  for (const internal of INTERNAL_COLUMNS) {
    assert.ok(
      source.includes(`${internal}?: never;`),
      `PublicProductで ${internal} がnever型として拒否されている`,
    );
  }
  const libColumns = extractLibColumns(source);
  for (const internal of INTERNAL_COLUMNS) {
    assert.ok(!libColumns.includes(internal), `allowlistに ${internal} が含まれない`);
  }
});

test('ビューmigrationはanonへselectを許可し、RPCはanonに実行を許可しない', () => {
  const sql = read(VIEW_MIGRATION);
  assert.ok(/grant select on public\.public_products to anon, authenticated;/.test(sql));
  assert.ok(/revoke all on function public\.list_products\(\) from anon;/.test(sql));
  assert.ok(/grant execute on function public\.list_products\(\) to authenticated;/.test(sql));
  assert.ok(!/grant execute on function public\.list_products\(\) to [^;]*anon/.test(sql));
});

test('管理RPC list_productsはis_adminを必須にする', () => {
  const sql = read(VIEW_MIGRATION);
  const fnBlock = sql.match(/create or replace function public\.list_products\(\)[\s\S]*?\$\$;/)?.[0] ?? '';
  assert.ok(fnBlock, 'list_products定義が存在すること');
  assert.ok(/security definer/.test(fnBlock));
  assert.ok(/if not public\.is_admin\(\) then/.test(fnBlock));
});

test('revoke migrationがanon/authenticatedのproducts直接アクセスを遮断する', { skip: revokeMigrationExists ? false : 'Stage 2でrevoke migrationを追加予定' }, () => {
  const sql = read(REVOKE_MIGRATION);
  assert.ok(/revoke all on public\.products from anon;/.test(sql));
  assert.ok(/revoke all on public\.products from authenticated;/.test(sql));
});

test('migrationは既存データ・スキーマ本体を変更しない(additive + 権限変更のみ)', () => {
  for (const file of MIGRATIONS_PRESENT) {
    const sql = read(file).toLowerCase();
    assert.ok(!/update\s+public\.products\s+set/.test(sql), `${file}: productsをUPDATEしない`);
    assert.ok(!/delete\s+from\s+public\.products/.test(sql), `${file}: productsをDELETEしない`);
    assert.ok(!/insert\s+into\s+public\.products/.test(sql), `${file}: productsへINSERTしない`);
    assert.ok(!/drop\s+table/.test(sql), `${file}: テーブルをDROPしない`);
    assert.ok(!/alter\s+table\s+public\.products/.test(sql), `${file}: productsのスキーマを変更しない`);
    assert.ok(!/create\s+policy|alter\s+policy|drop\s+policy/.test(sql), `${file}: RLSポリシーを変更しない`);
  }
});

test('migrationに秘密情報らしき文字列が含まれない', () => {
  for (const file of MIGRATIONS_PRESENT) {
    const sql = read(file);
    assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(sql), `${file}: JWTらしき文字列なし`);
    assert.ok(!/(api[_-]?key|secret|password)\s*[:=]/i.test(sql), `${file}: keyらしき代入なし`);
    assert.ok(!/https?:\/\/[a-z0-9]+\.supabase\.co/i.test(sql), `${file}: プロジェクトURLなし`);
  }
});

test('公開コードはproducts本体を直接参照しない', () => {
  for (const file of PUBLIC_SOURCE_FILES) {
    const source = read(file);
    assert.ok(!source.includes("from('products')"), `${file}: from('products')を使わない`);
    assert.ok(!source.includes('from("products")'), `${file}: from("products")を使わない`);
  }
});

test('src全体でproducts本体への直接selectが残っていない(管理画面もRPC経由)', () => {
  const adminFiles = ['src/admin.ts', 'src/affiliateAdmin.ts', 'src/assetsAdmin.ts'];
  for (const file of [...PUBLIC_SOURCE_FILES, ...adminFiles]) {
    const source = read(file);
    assert.ok(!source.includes("from('products')"), `${file}: from('products')を使わない`);
  }
});

test('管理画面はlist_products RPCで商品を取得する', () => {
  assert.ok(read('src/admin.ts').includes("supabase.rpc('list_products')"));
  assert.ok(read('src/affiliateAdmin.ts').includes("supabase.rpc('list_products')"));
});

test('公開コードがmemoを参照しない', () => {
  for (const file of PUBLIC_SOURCE_FILES) {
    const source = read(file);
    assert.ok(!/memo/i.test(source), `${file}: memoへの参照なし`);
  }
});

test('公開コードが他の内部管理カラムを参照しない', () => {
  for (const file of PUBLIC_SOURCE_FILES) {
    const source = read(file);
    for (const internal of ['spec_source_url', 'spec_checked_date', 'affiliate_checked_at', 'affiliate_note']) {
      assert.ok(!source.includes(internal), `${file}: ${internal}への参照なし`);
    }
  }
});

test('公開コードは管理商品型AdminProductをimportしない', () => {
  for (const file of PUBLIC_SOURCE_FILES) {
    assert.ok(!read(file).includes('AdminProduct'), `${file}: AdminProductを使わない`);
  }
});

test('product.tsの注意事項はcaution_notesだけを使い、memoへフォールバックしない', () => {
  const source = read('src/product.ts');
  assert.ok(/addSpecRow\(rows, product, '注意事項', \[\['caution_notes'\]\], \{ notes: true \}\);/.test(source));
});

test('brand.tsの商品説明候補は公開用カラムのみで、memoを含まない', () => {
  const source = read('src/brand.ts');
  const match = source.match(/function getProductDescription[\s\S]*?getFirstText\(product, \[([\s\S]*?)\]\)/);
  assert.ok(match, 'getProductDescriptionが存在すること');
  const candidates = [...match[1].matchAll(/'([^']+)'/g)].map(([, key]) => key);
  assert.ok(candidates.length > 0);
  for (const internal of INTERNAL_COLUMNS) {
    assert.ok(!candidates.includes(internal), `説明候補に ${internal} が含まれない`);
  }
});

test('管理商品型AdminProductはmemoを保持し、公開型と分離されている', () => {
  const typesSource = read('src/types.ts');
  const adminBlock = typesSource.match(/export type AdminProduct = Product & \{[\s\S]*?\};/)?.[0] ?? '';
  assert.ok(adminBlock, 'AdminProduct型が存在すること');
  assert.ok(/memo\?: string \| null;/.test(adminBlock), 'AdminProductがmemoを保持する');
  const libSource = read(PUBLIC_PRODUCTS_LIB);
  assert.ok(/export type PublicProduct = \{/.test(libSource), 'PublicProduct型が存在すること');
});

test('公開取得はselectPublicProducts(公開ビュー+明示カラム)を経由する', () => {
  const libSource = read(PUBLIC_PRODUCTS_LIB);
  assert.ok(/PUBLIC_PRODUCTS_VIEW = 'public_products'/.test(libSource));
  assert.ok(/from\(PUBLIC_PRODUCTS_VIEW\)/.test(libSource));
  assert.ok(/select<string, PublicProduct>\(PUBLIC_PRODUCT_SELECT\)/.test(libSource));
  for (const file of PUBLIC_PRODUCT_FETCH_FILES) {
    assert.ok(read(file).includes('selectPublicProducts()'), `${file}: selectPublicProducts()を使う`);
  }
});

test('フォールバック商品データにmemoが含まれない', () => {
  assert.ok(!/memo/i.test(read('src/data/fallback-products.ts')));
});
