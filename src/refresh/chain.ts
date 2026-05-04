import Long from 'long';
import { createQueryClient } from '@ixo/impactxclient-sdk';

import { CHAIN_PAGE_SIZE, RPC_URL } from '../utils/secrets';

type QueryClient = Awaited<ReturnType<typeof createQueryClient>>;

let cached: QueryClient | undefined;

const getQueryClient = async (): Promise<QueryClient> => {
  if (cached) return cached;
  cached = await createQueryClient(RPC_URL);
  return cached;
};

// Fetch the full set of grantee addresses currently active for the granter.
// Paginates through allowancesByGranter using opaque cursor keys.
export const fetchActiveGrantees = async (
  granter: string,
): Promise<Set<string>> => {
  const client = await getQueryClient();
  const active = new Set<string>();

  let key: Uint8Array | undefined;
  while (true) {
    const res = await client.cosmos.feegrant.v1beta1.allowancesByGranter({
      granter,
      pagination: {
        // @ts-ignore — Uint8Array | undefined is what the SDK accepts here
        key: key || new Uint8Array(),
        limit: Long.fromNumber(CHAIN_PAGE_SIZE),
        offset: Long.fromNumber(0),
        countTotal: false,
        reverse: false,
      },
    });

    for (const grant of res.allowances) {
      if (grant.grantee) active.add(grant.grantee);
    }

    key = res.pagination?.nextKey || undefined;
    if (!key || key.length === 0) break;
  }

  return active;
};
