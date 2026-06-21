import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        products: 'products.html',
        product: 'product.html',
        brand: 'brand.html',
        compare: 'compare.html',
        admin: 'admin.html',
        assetsAdmin: 'assets-admin.html',
        strollerGuide: 'stroller-guide.html',
      },
    },
  },
});
