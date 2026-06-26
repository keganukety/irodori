import './styles.css';
import { applyFadeUpAnimations, mountCommonHeader } from './shared-ui';
import { supabase } from './lib/supabase';
import type { Brand, ProductColor, ProductUploadedImage } from './types';
import { getYouTubeEmbedUrl, getYouTubeThumbnailUrl, isValidYouTubeVideoId } from './youtube';

type Product = {
  id: string | number;
  name?: string | null;
  product_name?: string | null;
  title?: string | null;
  brand?: string | null;
  maker?: string | null;
  manufacturer?: string | null;
  category?: string | null;
  type?: string | null;
  age?: string | null;
  age_range?: string | null;
  target_age?: string | null;
  weight?: string | number | null;
  weight_kg?: string | number | null;
  product_size?: string | null;
  size?: string | null;
  dimensions?: string | null;
  product_dimensions?: string | null;
  length_cm?: string | number | null;
  depth_cm?: string | number | null;
  width_cm?: string | number | null;
  height_cm?: string | number | null;
  folded_size?: string | null;
  folding_size?: string | null;
  storage_position?: string | null;
  folded_length_cm?: string | number | null;
  folded_depth_cm?: string | number | null;
  folded_width_cm?: string | number | null;
  folded_height_cm?: string | number | null;
  applicable_weight?: string | null;
  weight_capacity?: string | null;
  age_weight_limit?: string | null;
  load_capacity?: string | null;
  max_load?: string | null;
  max_weight?: string | null;
  basket_capacity?: string | null;
  shopping_basket?: string | null;
  basket?: string | null;
  accessories?: string | null;
  included_items?: string | null;
  warranty?: string | null;
  guarantee?: string | null;
  manufacturer_country?: string | null;
  brand_country?: string | null;
  country_of_origin?: string | null;
  precautions?: string | null;
  notes?: string | null;
  memo?: string | null;
  model_number?: string | null;
  sku?: string | null;
  jan_code?: string | null;
  product_code?: string | null;
  price_yen?: number | string | null;
  rank_no?: number | string | null;
  feature_tags?: string[] | string | null;
  tags?: string[] | string | null;
  rakuten_url?: string | null;
  rakuten_link?: string | null;
  amazon_url?: string | null;
  amazon_link?: string | null;
  yahoo_url?: string | null;
  yahoo_link?: string | null;
  official_url?: string | null;
  official_link?: string | null;
  brand_id?: string | null;
  [key: string]: unknown;
};

type ProductAffiliateImage = {
  id: string;
  product_id: string | number;
  role?: string | null;
  alt_text?: string | null;
  caption?: string | null;
  title?: string | null;
  rakuten_image_html: string | null;
  is_primary: boolean;
  display_order: number;
  sort_order?: number | null;
  media_type?: 'image' | 'youtube' | null;
  youtube_url?: string | null;
  youtube_video_id?: string | null;
  thumbnail_url?: string | null;
};

type ProductImage = ProductAffiliateImage & {
  src: string;
  mediaType: 'image';
};

type ProductVideo = ProductAffiliateImage & {
  mediaType: 'youtube';
  videoId: string;
  thumbnailSrc: string;
};

type ProductGalleryMedia = ProductImage | ProductVideo;

type ProductImagePair = {
  primary: string;
  secondary: string;
};

type SpecificationRow = {
  label: string;
  value: string | string[];
  sourceKeys: string[];
};

type FeatureBlock = {
  title: string;
  value: string;
  note?: string;
};

const appElement = document.querySelector<HTMLDivElement>('#product-app');
const recentlyViewedKey = 'recentlyViewedProductIds';
const strollerProductsUrl = '/products.html';

if (!appElement) {
  throw new Error('#product-app was not found.');
}

const app: HTMLDivElement = appElement;

mountCommonHeader('other');

renderProductDetail().catch((error) => {
  console.error('Failed to render product detail:', error);
  app.innerHTML = `
    <main class="detail-shell">
      <p class="detail-error">商品詳細の読み込みに失敗しました。</p>
    </main>
  `;
});

async function renderProductDetail() {
  const productId = new URLSearchParams(location.search).get('id');

  if (!productId) {
    app.innerHTML = `<main class="detail-shell"><p class="detail-error">商品IDが指定されていません。</p></main>`;
    return;
  }

  app.innerHTML = `<main class="detail-shell"><p class="detail-loading">商品詳細を読み込んでいます。</p></main>`;

  const [productResult, imagesResult, allProductsResult, allImagesResult, colorsResult, uploadedColorResult, brandsResult] = await Promise.all([
    supabase.from('products').select('*').eq('id', productId).maybeSingle(),
    supabase
      .from('product_affiliate_images')
      .select('*')
      .eq('product_id', productId)
      .order('display_order', { ascending: true }),
    supabase.from('products').select('*').order('id', { ascending: true }),
    supabase
      .from('product_affiliate_images')
      .select('product_id, rakuten_image_html, is_primary, display_order')
      .eq('media_type', 'image')
      .order('display_order', { ascending: true }),
    supabase.from('product_colors').select('*').eq('product_id', productId).order('display_order', { ascending: true }),
    supabase.from('product_uploaded_images').select('*').eq('product_id', productId).eq('role', 'color').order('display_order', { ascending: true }),
    supabase.from('brands').select('*').eq('is_published', true),
  ]);

  if (productResult.error) throw productResult.error;
  if (imagesResult.error) throw imagesResult.error;
  if (allProductsResult.error) console.error('Failed to load recommendation products:', allProductsResult.error);
  if (allImagesResult.error) console.error('Failed to load recommendation images:', allImagesResult.error);
  if (colorsResult.error) console.info('商品カラーはmigration適用後に表示されます。', colorsResult.error.message);
  if (uploadedColorResult.error) console.error('Failed to load uploaded color images:', uploadedColorResult.error);
  if (brandsResult.error) console.info('ブランドページ導線はmigration適用後に有効になります。', brandsResult.error.message);

  const product = productResult.data as Product | null;
  if (!product) {
    app.innerHTML = `
      <main class="detail-shell">
        <a class="back-link" href="${strollerProductsUrl}">ベビーカー一覧へ戻る</a>
        <p class="detail-error">商品が見つかりませんでした。</p>
      </main>
    `;
    return;
  }

  const mediaRows = ((imagesResult.data ?? []) as ProductAffiliateImage[]).sort(
    (a, b) => getMediaOrder(a) - getMediaOrder(b),
  );
  const galleryMedia = mediaRows.flatMap<ProductGalleryMedia>((media) => {
    if (media.media_type === 'youtube') {
      const videoId = media.youtube_video_id ?? '';
      if (!isValidYouTubeVideoId(videoId)) return [];
      return [{
        ...media,
        mediaType: 'youtube',
        videoId,
        thumbnailSrc: media.thumbnail_url || getYouTubeThumbnailUrl(videoId),
      }];
    }

    const src = extractImageSrc(media.rakuten_image_html ?? '');
    return src ? [{ ...media, mediaType: 'image', src }] : [];
  });
  const images = galleryMedia.filter((media): media is ProductImage => media.mediaType === 'image');
  let mainMedia: ProductGalleryMedia | undefined = images.find((image) => image.is_primary);
  if (!mainMedia && images.length > 0) mainMedia = images[0];
  if (!mainMedia && galleryMedia.length > 0) mainMedia = galleryMedia[0];
  const allProducts = (allProductsResult.data ?? []) as Product[];
  const imagePairs = buildProductImagePairs((allImagesResult.data ?? []) as ProductAffiliateImage[]);
  const recommendedProducts = getRecommendedProducts(product, allProducts).slice(0, 4);
  const specificationRows = getProductSpecificationRows(product);
  const colors = (colorsResult.data ?? []) as ProductColor[];
  const uploadedColorImages = (uploadedColorResult.data ?? []) as ProductUploadedImage[];
  const brandsById = new Map(((brandsResult.data ?? []) as Brand[]).map((brand) => [brand.id, brand]));
  const brandRecord = product.brand_id ? brandsById.get(String(product.brand_id)) : undefined;

  if (import.meta.env.DEV) {
    logSpecificationColumnStatus(specificationRows);
  }

  saveRecentlyViewedProduct(String(product.id));
  const recentlyViewedProducts = getRecentlyViewedProducts(allProducts, String(product.id)).slice(0, 6);
  updateProductMetadata(product);

  app.innerHTML = `
    <main class="detail-shell">
      <nav class="detail-breadcrumb" aria-label="パンくず">
        <a class="detail-back-link" href="${strollerProductsUrl}">ベビーカー一覧へ戻る</a>
        <span aria-hidden="true">/</span>
        <a href="${strollerProductsUrl}">ベビーカー一覧</a>
        <span aria-hidden="true">/</span>
        <span>${escapeText(getProductName(product))}</span>
      </nav>

      <article class="detail-layout">
        <section class="detail-gallery">
          <div class="detail-main-image${mainMedia?.mediaType === 'youtube' ? ' is-video' : ''}" id="mainProductMedia">
            ${mainMedia ? renderMainGalleryMedia(mainMedia, product) : `<div class="detail-placeholder">画像準備中</div>`}
          </div>
          ${
            galleryMedia.length > 1
              ? `
                <div class="detail-thumbnails-wrap">
                  <button class="detail-thumbnail-scroll is-prev" type="button" data-thumbnail-scroll="prev" aria-label="前のサムネイルへ">‹</button>
                  <div class="detail-thumbnails" aria-label="商品画像と動画">${galleryMedia.map((media, index) => renderThumbnail(media, mainMedia, product, index)).join('')}</div>
                  <button class="detail-thumbnail-scroll is-next" type="button" data-thumbnail-scroll="next" aria-label="次のサムネイルへ">›</button>
                </div>
              `
              : ''
          }
        </section>

        <section class="detail-info">
          <p class="detail-brand">${brandRecord ? `<a href="/brand.html?slug=${encodeURIComponent(brandRecord.slug)}">${escapeText(brandRecord.display_name)}</a>` : escapeText(getBrand(product))}</p>
          <h1>${escapeText(getProductName(product))}</h1>
          <p class="detail-price">${escapeText(formatPrice(product.price_yen))}</p>
          <ul class="detail-tags">${getDisplayTags(product).map((tag) => `<li>${escapeText(tag)}</li>`).join('')}</ul>
          ${renderProductColors(colors, uploadedColorImages, product)}
          <dl class="detail-specs">
            ${renderSpec('タイプ', getFirstText(product, ['type']))}
            ${renderSpec('対象年齢', getFirstText(product, ['target_age', 'age_range', 'age']))}
            ${renderSpec('重量', weightLabel(product.weight_kg ?? product.weight))}
          </dl>
          <div class="detail-buttons">
            ${renderShopButton('楽天市場で見る', getFirstText(product, ['rakuten_url', 'rakuten_link']))}
            ${renderShopButton('Amazonで見る', getFirstText(product, ['amazon_url', 'amazon_link']))}
            ${renderShopButton('Yahoo!ショッピングで見る', getFirstText(product, ['yahoo_url', 'yahoo_link']))}
            ${renderShopButton('公式サイトで見る', getFirstText(product, ['official_url', 'official_link']))}
          </div>
          ${renderProductSpecifications(specificationRows)}
        </section>
      </article>

      ${renderImageStorySections(images, product, colors, specificationRows)}
      ${renderRecommendedProducts('あなたへのおすすめ', recommendedProducts, imagePairs)}
      ${renderRecommendedProducts('最近チェックした商品', recentlyViewedProducts, imagePairs)}
    </main>
  `;

  bindThumbnailEvents();
  applyFadeUpAnimations(app);
}

function updateProductMetadata(product: Product): void {
  const title = `${getProductName(product)} | iLy.`;
  const description = `${getBrand(product)} ${getProductName(product)}の写真、仕様、価格リンクをiLy.で確認できます。`;
  document.title = title;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (meta) meta.content = description;
  document.querySelectorAll<HTMLMetaElement>('meta[property="og:site_name"]').forEach((element) => {
    element.content = 'iLy.';
  });
  document.querySelectorAll<HTMLMetaElement>('meta[property="og:title"], meta[name="twitter:title"]').forEach((element) => {
    element.content = title;
  });
  document.querySelectorAll<HTMLMetaElement>('meta[property="og:description"], meta[name="twitter:description"]').forEach((element) => {
    element.content = description;
  });
}

function renderProductColors(colors: ProductColor[], uploadedImages: ProductUploadedImage[], product: Product): string {
  if (colors.length > 0) {
    return `
      <section class="detail-colors" aria-labelledby="detail-colors-title">
        <h2 id="detail-colors-title">カラー</h2>
        <div class="color-swatches color-swatches--labeled">
          ${colors.map((color) => `<span class="color-swatch-item${color.is_default ? ' is-default' : ''}"><i style="--swatch:${escapeAttr(color.swatch_hex)}" aria-hidden="true"></i><b>${escapeText(color.name)}${color.is_default ? '<small>標準</small>' : ''}</b></span>`).join('')}
        </div>
      </section>
    `;
  }

  if (uploadedImages.length === 0) return '';
  return `
    <section class="detail-colors detail-colors--images" aria-labelledby="detail-colors-title">
      <h2 id="detail-colors-title">カラー展開</h2>
      <div class="detail-color-images">
        ${uploadedImages.map((image) => `<figure><img src="${escapeAttr(image.public_url)}" alt="${escapeAttr(image.alt_text || `${getProductName(product)} カラー`)}" loading="lazy">${image.caption ? `<figcaption>${escapeText(image.caption)}</figcaption>` : ''}</figure>`).join('')}
      </div>
    </section>
  `;
}

function renderMainGalleryMedia(media: ProductGalleryMedia, product: Product): string {
  if (media.mediaType === 'youtube') {
    return `<iframe
      src="${escapeAttr(getYouTubeEmbedUrl(media.videoId))}"
      title="${escapeAttr(`${getProductName(product)} YouTube動画`)}"
      loading="lazy"
      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
    ></iframe>`;
  }
  return `<img id="mainProductImage" src="${escapeAttr(media.src)}" alt="${escapeAttr(getProductName(product))}" />`;
}

function renderThumbnail(media: ProductGalleryMedia, mainMedia: ProductGalleryMedia | undefined, product: Product, index: number) {
  if (media.mediaType === 'youtube') {
    return `
      <button class="video-thumbnail ${media.id === mainMedia?.id ? 'is-active' : ''}" type="button" data-media-type="youtube" data-video-id="${escapeAttr(media.videoId)}">
        <img src="${escapeAttr(media.thumbnailSrc)}" alt="${escapeAttr(`${getProductName(product)} 動画 ${index + 1}`)}" loading="lazy" />
        <span aria-hidden="true">▶</span>
      </button>
    `;
  }
  return `
    <button class="${media.id === mainMedia?.id ? 'is-active' : ''}" type="button" data-media-type="image" data-image-src="${escapeAttr(media.src)}">
      <img src="${escapeAttr(media.src)}" alt="${escapeAttr(`${getProductName(product)} ${index + 1}`)}" loading="lazy" />
    </button>
  `;
}

function renderImageStorySections(images: ProductImage[], product: Product, colors: ProductColor[], specificationRows: SpecificationRow[]) {
  const storyImages = images.filter((image) => ['detail', 'usage', 'folded', 'color'].includes(String(image.role ?? '')));
  const featureBlocks = getFeatureBlocks(product, colors, specificationRows).slice(0, 4);
  if (storyImages.length === 0 && featureBlocks.length === 0) return '';

  const visibleImages = storyImages.slice(0, 4);
  const hiddenImages = storyImages.slice(4);

  return `
    <section class="detail-story">
      <div class="section-heading-pair">
        <p>FEATURE</p>
        <h2>商品の特徴</h2>
      </div>
      ${featureBlocks.length > 0 ? `<div class="detail-feature-grid">${featureBlocks.map(renderFeatureBlock).join('')}</div>` : ''}
      ${visibleImages.map((image, index) => renderStoryImage(image, product, index)).join('')}
      ${
        hiddenImages.length > 0
          ? `
            <details class="detail-story-more">
              <summary>画像をさらに表示</summary>
              ${hiddenImages.map((image, index) => renderStoryImage(image, product, index + visibleImages.length)).join('')}
            </details>
          `
          : ''
      }
    </section>
  `;
}

function getFeatureBlocks(product: Product, colors: ProductColor[], specificationRows: SpecificationRow[]): FeatureBlock[] {
  const blocks: FeatureBlock[] = [];
  const rowMap = new Map(specificationRows.map((row) => [row.label, specValueToText(row.value)]));
  const tags = getDisplayTags(product);

  addFeatureBlock(blocks, 'タイプ', getFirstText(product, ['type', 'product_type']), '使い方に合う分類を確認できます。');
  addFeatureBlock(blocks, '対象月齢', rowMap.get('対象月齢') || getFirstText(product, ['target_age', 'age_range', 'age']), '使い始めの目安です。');
  addFeatureBlock(blocks, '重量', rowMap.get('重量') || weightLabel(product.weight_kg ?? product.weight), '持ち運びや階段移動の目安です。');
  addFeatureBlock(blocks, '収納サイズ', rowMap.get('収納サイズ') || getFirstText(product, ['folded_size', 'folding_size', 'storage_position']), '玄関や車載時の確認に使えます。');
  addFeatureBlock(blocks, '製品サイズ', rowMap.get('製品サイズ') || getFirstText(product, ['product_size', 'size', 'dimensions', 'product_dimensions']), '使用時のサイズ感を確認できます。');
  addFeatureBlock(blocks, '適応体重', rowMap.get('適応体重') || getFirstText(product, ['applicable_weight', 'weight_capacity', 'age_weight_limit']), '使用できる体重の目安です。');

  const lifestyleTag = tags.find((tag) => /新生児|軽量|コンパクト|折りたたみ|電車|車|マンション|ワンオペ/.test(tag));
  addFeatureBlock(blocks, '注目ポイント', lifestyleTag ?? '', '登録済みタグから表示しています。');

  if (colors.length > 0) {
    addFeatureBlock(blocks, 'カラー展開', `${colors.length}色`, colors.slice(0, 4).map((color) => color.name).join(' / '));
  }

  addFeatureBlock(blocks, 'ブランド', getBrand(product), 'ブランド・メーカー情報です。');
  addFeatureBlock(blocks, '価格', formatPrice(product.price_yen), '登録済み価格です。');

  return blocks;
}

function addFeatureBlock(blocks: FeatureBlock[], title: string, value: string, note?: string): void {
  if (blocks.some((block) => block.title === title)) return;
  if (!isPresentSpecValue(value)) return;
  blocks.push({ title, value, note });
}

function specValueToText(value: string | string[]): string {
  return Array.isArray(value) ? value.join(' / ') : value;
}

function renderFeatureBlock(block: FeatureBlock): string {
  return `
    <article class="detail-feature-card">
      <p>${escapeText(block.title)}</p>
      <strong>${escapeText(block.value)}</strong>
      ${block.note ? `<span>${escapeText(block.note)}</span>` : ''}
    </article>
  `;
}

function renderStoryImage(image: ProductImage, product: Product, index: number) {
  const storyText = getStoryImageText(image);
  return `
    <article class="story-block ${index % 2 === 1 ? 'is-reversed' : ''}">
      <div class="story-image">
        <img src="${escapeAttr(image.src)}" alt="${escapeAttr(storyText.title || getProductName(product))}" loading="lazy" />
      </div>
      ${
        storyText.title || storyText.description
          ? `<div class="story-copy">
              ${storyText.title ? `<h3>${escapeText(storyText.title)}</h3>` : ''}
              ${storyText.description ? `<p>${escapeText(storyText.description)}</p>` : ''}
            </div>`
          : ''
      }
    </article>
  `;
}

function getStoryImageText(image: ProductImage): { title: string; description: string } {
  const title = getCleanImageText(image.title) || getCleanImageText(image.caption);
  const description = title && image.caption && image.caption !== title ? getCleanImageText(image.caption) : '';

  if (title || description) {
    return { title, description };
  }

  if (image.role === 'color') return { title: 'カラー展開', description: '' };
  if (image.role === 'folded') return { title: '折りたたみ時', description: '' };
  if (image.role === 'usage') return { title: '使用イメージ', description: '' };
  return { title: '', description: '' };
}

function getCleanImageText(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  if (/商品画像|商品詳細|ディテール|画像準備/i.test(text)) return '';
  return text;
}

function getProductSpecificationRows(product: Product): SpecificationRow[] {
  const rows: SpecificationRow[] = [];

  addSpecRow(rows, product, '製品サイズ', [
    ['product_size'],
    ['size'],
    ['dimensions'],
    ['product_dimensions'],
    ['length_cm', 'width_cm', 'height_cm'],
    ['depth_cm', 'width_cm', 'height_cm'],
  ]);
  addSpecRow(rows, product, '収納サイズ', [
    ['folded_size'],
    ['folding_size'],
    ['storage_position'],
    ['folded_length_cm', 'folded_width_cm', 'folded_height_cm'],
    ['folded_depth_cm', 'folded_width_cm', 'folded_height_cm'],
  ]);
  addSpecRow(rows, product, '重量', [['weight_kg'], ['weight']], { appendUnit: 'kg' });
  addSpecRow(rows, product, '対象月齢', [['target_age']]);
  addSpecRow(rows, product, '適応体重', [['applicable_weight'], ['weight_capacity'], ['age_weight_limit']]);
  addSpecRow(rows, product, '耐荷重', [['load_capacity'], ['max_load'], ['max_weight']]);
  addSpecRow(rows, product, 'バスケット容量', [['basket_capacity'], ['shopping_basket'], ['basket']]);
  addSpecRow(rows, product, '付属品', [['accessories'], ['included_items']]);
  addSpecRow(rows, product, '保証', [['warranty'], ['guarantee']]);
  addSpecRow(rows, product, 'メーカー所在国', [['manufacturer_country'], ['brand_country'], ['country_of_origin']]);
  addSpecRow(rows, product, '注意事項', [['precautions'], ['notes'], ['memo']], { notes: true });
  addSpecRow(rows, product, '品番', [['model_number'], ['sku'], ['jan_code'], ['product_code']]);

  return rows;
}

function addSpecRow(
  rows: SpecificationRow[],
  product: Product,
  label: string,
  candidateKeyGroups: string[][],
  options: { appendUnit?: string; notes?: boolean } = {},
) {
  for (const keys of candidateKeyGroups) {
    if (!keys.every((key) => hasProductColumn(product, key))) continue;

    const rawValue = keys.length === 1 ? normalizeSpecValue(product[keys[0]]) : formatDimensionValue(product, keys);
    const value = options.appendUnit ? appendUnitIfNeeded(rawValue, options.appendUnit) : rawValue;

    if (!isPresentSpecValue(value)) continue;
    if (options.notes && isManagementMemo(value)) continue;

    rows.push({
      label,
      value: options.notes ? splitNotes(value) : value,
      sourceKeys: keys,
    });
    return;
  }
}

function renderProductSpecifications(rows: SpecificationRow[]) {
  if (rows.length === 0) return '';

  return `
    <section class="specification-section">
      <div class="section-heading-pair">
        <p>SPECIFICATION</p>
        <h2>商品仕様</h2>
      </div>
      <dl class="specification-table">
        ${rows
          .map(
            (row) => `
              <div>
                <dt>${escapeText(row.label)}</dt>
                <dd>${renderSpecificationValue(row.value)}</dd>
              </div>
            `,
          )
          .join('')}
      </dl>
    </section>
  `;
}

function renderRecommendedProducts(title: string, products: Product[], imagePairs: Map<string, ProductImagePair>) {
  if (products.length === 0) return '';
  const titleEn = title.includes('最近') ? 'CHECKED ITEM' : 'RECOMMEND';
  return `
    <section class="recommend-section">
      <div class="section-heading-pair">
        <p>${titleEn}</p>
        <h2>${escapeText(title)}</h2>
      </div>
      <div class="recommend-grid">${products.map((product) => renderRecommendedCard(product, imagePairs)).join('')}</div>
    </section>
  `;
}

function renderRecommendedCard(product: Product, imagePairs: Map<string, ProductImagePair>) {
  const productId = String(product.id);
  const pair = imagePairs.get(productId);
  const href = `product.html?id=${encodeURIComponent(productId)}`;
  return `
    <article class="recommend-card">
      <a class="recommend-image" href="${escapeAttr(href)}">
        ${
          pair?.primary
            ? `<span class="image-hover-stack ${pair.secondary ? 'has-hover-image' : ''}">
                <img class="image-main" src="${escapeAttr(pair.primary)}" alt="${escapeAttr(getProductName(product))}" loading="lazy" />
                ${pair.secondary ? `<img class="image-secondary" src="${escapeAttr(pair.secondary)}" alt="" loading="lazy" />` : ''}
              </span>`
            : `<span>画像準備中</span>`
        }
      </a>
      <p>${escapeText(getBrand(product))}</p>
      <h3><a href="${escapeAttr(href)}">${escapeText(getProductName(product))}</a></h3>
      <strong>${escapeText(formatPrice(product.price_yen))}</strong>
    </article>
  `;
}

function getRecommendedProducts(currentProduct: Product, allProducts: Product[]) {
  const currentId = String(currentProduct.id);
  const currentCategory = String(currentProduct.category ?? '');
  const currentBrand = getBrand(currentProduct).toLowerCase();
  const currentRank = getRankNumber(currentProduct);

  return allProducts
    .filter((product) => String(product.id) !== currentId)
    .filter((product) => String(product.category ?? '') === currentCategory)
    .sort((a, b) => recommendationScore(b, currentBrand, currentRank) - recommendationScore(a, currentBrand, currentRank));
}

function saveRecentlyViewedProduct(productId: string) {
  const ids = getRecentlyViewedIds().filter((id) => id !== productId);
  ids.unshift(productId);
  localStorage.setItem(recentlyViewedKey, JSON.stringify(ids.slice(0, 8)));
}

function getRecentlyViewedProducts(allProducts: Product[], currentProductId: string) {
  const productMap = new Map(allProducts.map((product) => [String(product.id), product]));
  return getRecentlyViewedIds()
    .filter((id) => id !== currentProductId)
    .map((id) => productMap.get(id))
    .filter((product): product is Product => Boolean(product))
    .slice(0, 6);
}

function getRecentlyViewedIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentlyViewedKey) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.map((id) => String(id)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function recommendationScore(product: Product, currentBrand: string, currentRank: number) {
  let score = 0;
  if (getBrand(product).toLowerCase() === currentBrand) score += 20;
  const rank = getRankNumber(product);
  if (Number.isFinite(rank) && Number.isFinite(currentRank)) score += Math.max(0, 12 - Math.abs(rank - currentRank));
  return score;
}

function getRankNumber(product: Product) {
  const value = Number(product.rank_no);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function bindThumbnailEvents() {
  document.querySelectorAll<HTMLButtonElement>('[data-thumbnail-scroll]').forEach((button) => {
    button.addEventListener('click', () => {
      const list = document.querySelector<HTMLElement>('.detail-thumbnails');
      if (!list) return;
      const direction = button.dataset.thumbnailScroll === 'prev' ? -1 : 1;
      list.scrollBy({
        top: 0,
        left: direction * 168,
        behavior: 'smooth',
      });
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.detail-thumbnails button').forEach((button) => {
    button.addEventListener('click', () => {
      const mainMedia = document.querySelector<HTMLElement>('#mainProductMedia');
      if (!mainMedia) return;

      if (button.dataset.mediaType === 'youtube') {
        const videoId = button.dataset.videoId ?? '';
        const embedUrl = getYouTubeEmbedUrl(videoId);
        if (!embedUrl) return;
        const iframe = document.createElement('iframe');
        iframe.src = embedUrl;
        iframe.title = '商品YouTube動画';
        iframe.loading = 'lazy';
        iframe.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        mainMedia.replaceChildren(iframe);
        mainMedia.classList.add('is-video');
      } else {
        const src = button.dataset.imageSrc;
        if (!src) return;
        const image = document.createElement('img');
        image.id = 'mainProductImage';
        image.src = src;
        image.alt = '商品画像';
        mainMedia.replaceChildren(image);
        mainMedia.classList.remove('is-video');
      }

      document.querySelectorAll('.detail-thumbnails button').forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');
    });
  });
}

function getMediaOrder(media: ProductAffiliateImage): number {
  return Number(media.sort_order ?? media.display_order ?? 9999);
}

function renderSpec(label: string, value: string) {
  if (!value) return '';
  return `<div><dt>${escapeText(label)}</dt><dd>${escapeText(value)}</dd></div>`;
}

function renderShopButton(label: string, url: string) {
  if (!url) return '';
  return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeText(label)}</a>`;
}

function hasProductColumn(product: Product, key: string) {
  return Object.prototype.hasOwnProperty.call(product, key);
}

function normalizeSpecValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join('\n');
  return String(value).trim();
}

function formatDimensionValue(product: Product, keys: string[]) {
  const labels = keys.map((key) => {
    if (key.includes('length') || key.includes('depth')) return '長さ';
    if (key.includes('width')) return '幅';
    if (key.includes('height')) return '高さ';
    return '';
  });
  const values = keys.map((key) => normalizeSpecValue(product[key]));
  if (values.some((value) => !isPresentSpecValue(value))) return '';
  return values.map((value, index) => `${labels[index]}${formatCentimeterValue(value)}`).join(' × ');
}

function formatCentimeterValue(value: string) {
  return /cm/i.test(value) ? value : `${value}cm`;
}

function appendUnitIfNeeded(value: string, unit: string) {
  if (!isPresentSpecValue(value)) return '';
  return new RegExp(`${unit}$`, 'i').test(value) ? value : `${value}${unit}`;
}

function isPresentSpecValue(value: string) {
  const normalized = value.trim();
  if (!normalized) return false;
  if (['-', 'undefined', 'null'].includes(normalized)) return false;
  return !/不明|未登録/.test(normalized);
}

function isManagementMemo(value: string) {
  return /未確認|要確認|ランキング|調査|source/i.test(value);
}

function splitNotes(value: string) {
  const items = value
    .split(/\n|・|●/)
    .map((item) => item.trim())
    .filter(isPresentSpecValue);
  return items.length > 1 ? items : value;
}

function renderSpecificationValue(value: string | string[]) {
  if (Array.isArray(value)) {
    return `<ul>${value.map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul>`;
  }
  return escapeText(value);
}

function logSpecificationColumnStatus(rows: SpecificationRow[]) {
  const allLabels = [
    '製品サイズ',
    '収納サイズ',
    '重量',
    '対象月齢',
    '適応体重',
    '耐荷重',
    'バスケット容量',
    '付属品',
    '保証',
    'メーカー所在国',
    '注意事項',
    '品番',
  ];
  const visibleLabels = rows.map((row) => row.label);
  console.log('productsテーブルに既に存在した仕様カラム', rows.flatMap((row) => row.sourceKeys));
  console.log('存在しなかった、または未登録の仕様項目', allLabels.filter((label) => !visibleLabels.includes(label)));
  console.log('現在表示できる仕様項目', visibleLabels);
}

function buildProductImagePairs(images: ProductAffiliateImage[]) {
  const grouped = new Map<string, Array<{ src: string; isPrimary: boolean; order: number }>>();
  for (const image of images) {
    const src = extractImageSrc(image.rakuten_image_html ?? '');
    if (!src) continue;
    const productId = String(image.product_id);
    const list = grouped.get(productId) ?? [];
    list.push({ src, isPrimary: Boolean(image.is_primary), order: Number(image.display_order ?? 9999) });
    grouped.set(productId, list);
  }
  const pairs = new Map<string, ProductImagePair>();
  for (const [productId, list] of grouped) {
    const sorted = [...list].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.order - b.order);
    const primary = sorted.find((image) => image.isPrimary)?.src ?? sorted[0]?.src ?? '';
    const secondary = sorted.filter((image) => !image.isPrimary).sort((a, b) => a.order - b.order).find((image) => image.src !== primary)?.src ?? '';
    if (primary) pairs.set(productId, { primary, secondary });
  }
  return pairs;
}

function extractImageSrc(html: string) {
  if (!html) return '';
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.querySelector('img')?.getAttribute('src') ?? '';
}

function getRoleLabel(role: ProductImage['role']) {
  if (role === 'color') return 'カラー展開';
  if (role === 'folded') return '折りたたみ時';
  if (role === 'usage') return '使用イメージ';
  if (role === 'detail') return '商品のディテール';
  return '商品画像';
}

function getRoleDescription(role: ProductImage['role']) {
  if (role === 'color') return 'カラーバリエーションを確認できます。';
  if (role === 'folded') return '折りたたみ時の形状を確認できます。';
  if (role === 'usage') return '使用時のサイズ感やイメージを確認できます。';
  if (role === 'detail') return '各部のデザインや仕様を確認できます。';
  return '商品画像を確認できます。';
}

function getProductName(product: Product) {
  return getFirstText(product, ['name', 'product_name', 'title']) || `商品ID: ${String(product.id)}`;
}

function getBrand(product: Product) {
  return getFirstText(product, ['brand', 'maker', 'manufacturer', 'category']) || 'Baby item';
}

function getDisplayTags(product: Product) {
  return normalizeTags(product.feature_tags ?? product.tags).slice(0, 6);
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
    } catch {
      // Plain comma-separated strings are handled below.
    }
    return trimmed.split(/[,\n、]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function weightLabel(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value).trim();
  return /kg/i.test(text) ? text : `${text}kg`;
}

function getFirstText(product: Product, keys: string[]) {
  for (const key of keys) {
    const value = product[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function formatPrice(value: Product['price_yen']) {
  if (value === null || value === undefined || value === '') return '価格未登録';
  const numeric = Number(String(value).replace(/[^\d.-]/g, ''));
  if (Number.isFinite(numeric)) return `¥${numeric.toLocaleString('ja-JP')}`;
  return '価格未登録';
}

function escapeText(value: string) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function escapeAttr(value: string) {
  return escapeText(value).replace(/"/g, '&quot;');
}
