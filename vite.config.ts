import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/radar/broadcast3': {
          target: 'https://www.radar-aviator.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/radar\/broadcast3/, '/broadcast3.php'),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        },
        '/api/radar/broadcast2': {
          target: 'https://www.radar-aviator.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/radar\/broadcast2/, '/broadcast2.php'),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        },
        '/api/radar/broadcast': {
          target: 'https://www.radar-aviator.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/radar\/broadcast/, '/broadcast.php'),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        },
        '/api/radar': {
          target: 'https://www.radar-aviator.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/radar/, '/broadcast2.php'),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        },
      },
    },
  };
});
