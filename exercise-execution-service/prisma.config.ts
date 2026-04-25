import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  },
  migrations: {
    seed: 'npx tsx --require ./prisma/patch-prisma-client.cjs prisma/seed.ts',
  },
});
