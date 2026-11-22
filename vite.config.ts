import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 相対パスで出力して、dist/ をどこに置いても（静的ホスティングでも）動くようにする
  base: './',
  server: { port: 5173 },
  build: {
    // ページは2つ: ルート = LP（紹介ページ）、/play/ = ゲーム本体
    rollupOptions: {
      input: {
        lp: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play/index.html'),
      },
    },
  },
});
