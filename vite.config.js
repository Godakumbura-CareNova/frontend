import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    host: true
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setupTests.js',
    globals: true,
    clearMocks: true,
    // GCN-37 keeps its unit tests in doctor-payment-service; CI's `npm run test:run` must not fail on an empty suite.
    passWithNoTests: true,
  }
});
