// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

export const PORT = process.env.PORT || 3000;
export const AUTHORIZATION = process.env.AUTHORIZATION || '';
export const JAMBO_AUTHORIZATION = process.env.JAMBO_AUTHORIZATION || '';

export const RPC_URL = process.env.RPC_URL ?? '';
export const MNEMONIC = process.env.MNEMONIC ?? '';

export const SENTRY_DSN = process.env.SENTRY_DSN ?? '';

// Postgres
export const DATABASE_URL = process.env.DATABASE_URL ?? '';
export const DATABASE_USE_SSL =
  Number(process.env.DATABASE_USE_SSL ?? '0') || 0;
export const MIGRATE_DB_PROGRAMATICALLY =
  Number(process.env.MIGRATE_DB_PROGRAMATICALLY ?? '0') || 0;

// Blocksync GraphQL endpoint used to discover historical grant messages.
export const BLOCKSYNC_GRAPHQL_URL =
  process.env.BLOCKSYNC_GRAPHQL_URL ??
  'https://blocksync-graphql.ixo.earth/graphql';

// Refresh cron toggles.
export const REFRESH_CRON_ENABLED =
  (process.env.REFRESH_CRON_ENABLED ?? '1') !== '0';
// Cron schedule. Default: every 30 minutes.
export const REFRESH_CRON_SCHEDULE =
  process.env.REFRESH_CRON_SCHEDULE ?? '0 */30 * * * *';
// How long fresh feegrants issued by the cron should last.
export const REFRESH_GRANT_DURATION_DAYS = Number(
  process.env.REFRESH_GRANT_DURATION_DAYS ?? '365',
);
// Max grantees per broadcast tx (matches the existing monthly script).
export const REFRESH_BATCH_SIZE = Number(
  process.env.REFRESH_BATCH_SIZE ?? '180',
);
// Page size for blocksync GraphQL ingest.
export const BLOCKSYNC_PAGE_SIZE = Number(
  process.env.BLOCKSYNC_PAGE_SIZE ?? '1000',
);
// Page size for chain allowancesByGranter pagination.
export const CHAIN_PAGE_SIZE = Number(process.env.CHAIN_PAGE_SIZE ?? '1000');
