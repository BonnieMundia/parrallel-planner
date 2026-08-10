import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Selectors and clock math are pure — no DOM, no jsdom dependency.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
