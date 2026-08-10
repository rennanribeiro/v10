import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    include: ['vjsc/**/*.test.ts'],
  },
});
