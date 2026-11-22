import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 相対パスで出力して、dist/ をどこに置いても（静的ホスティングでも）動くようにする
  base: './',
  server: { port: 5173 },
});
