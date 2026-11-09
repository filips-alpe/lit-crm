import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
    // Only the drift check needs it (prisma migrate diff --from-migrations ... --exit-code,
    // see README). Point it at an empty, disposable database. Unset, Prisma creates its own
    // shadow database for `migrate dev`.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
