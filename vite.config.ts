import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { quizCatalog } from './scripts/quiz-catalog.ts';

export default defineConfig({
  plugins: [react(), quizCatalog(fileURLToPath(new URL('.', import.meta.url)))],
  test: { include: ['tests/unit/**/*.test.{ts,tsx}'] },
});
