import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // IPv4 loopback, not just ::1. `adb reverse` connects over IPv4, so binding to
    // the default leaves a USB-attached phone unable to reach the dev server.
    // Still loopback only — nothing is exposed to the network.
    host: '127.0.0.1',
  },
  test: {
    // Selectors and clock math are pure, so they run in node. Component tests opt into
    // jsdom per file with a `@vitest-environment jsdom` docblock — the split keeps the
    // fast suite fast.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    /*
     * Threads, not the default forks. A fork is a whole node process per test file,
     * and jsdom on top of that is heavy enough that on a memory-constrained machine
     * the worker never answers and the run dies with "Failed to start forks worker" —
     * which reads like a broken test rather than a full machine.
     */
    pool: 'threads',
    // Vitest 4 moved this off poolOptions and onto the config directly.
    maxWorkers: 4,
  },
});
