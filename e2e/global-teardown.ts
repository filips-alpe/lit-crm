import { dropDatabase, TEMPLATE_DB } from './support/db';

export default async function globalTeardown() {
  await dropDatabase(TEMPLATE_DB);
}
