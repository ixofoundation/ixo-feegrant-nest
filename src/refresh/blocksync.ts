import { BLOCKSYNC_GRAPHQL_URL, BLOCKSYNC_PAGE_SIZE } from '../utils/secrets';

const GRANT_TYPE_URL = '/cosmos.feegrant.v1beta1.MsgGrantAllowance';

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

type MessagePage = {
  messages: {
    nodes: Array<{
      id: number;
      value: { granter?: string; grantee?: string };
    }>;
  };
};

const QUERY = `
  query GrantMessages($lastId: Int!, $first: Int!) {
    messages(
      filter: {
        typeUrl: { equalTo: "${GRANT_TYPE_URL}" },
        id: { greaterThan: $lastId }
      },
      orderBy: ID_ASC,
      first: $first
    ) {
      nodes {
        id
        value
      }
    }
  }
`;

const postGraphql = async <T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const res = await fetch(BLOCKSYNC_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(
      `blocksync GraphQL HTTP ${res.status}: ${await res.text()}`,
    );
  }
  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(
      `blocksync GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`,
    );
  }
  if (!json.data) throw new Error('blocksync GraphQL: empty data');
  return json.data;
};

export type GrantMessagesPage = {
  // Highest id seen in this page (or null if empty).
  maxId: number | null;
  // Grantees in this page that were granted by the target granter.
  grantees: string[];
  // Whether more pages may follow.
  hasMore: boolean;
};

// Fetch one page of MsgGrantAllowance messages with id > lastId, return only
// grantees whose `value.granter` matches the target. The cursor advances on
// the page max id regardless of granter match — once the chain message id is
// observed, we never re-process it.
export const fetchGrantMessagesPage = async (
  lastId: number,
  ourGranter: string,
): Promise<GrantMessagesPage> => {
  const data = await postGraphql<MessagePage>(QUERY, {
    lastId,
    first: BLOCKSYNC_PAGE_SIZE,
  });

  const nodes = data.messages.nodes;
  if (nodes.length === 0) {
    return { maxId: null, grantees: [], hasMore: false };
  }

  const maxId = nodes.reduce((acc, n) => (n.id > acc ? n.id : acc), 0);
  const grantees = nodes
    .filter(
      (n) =>
        n.value?.granter === ourGranter &&
        typeof n.value?.grantee === 'string' &&
        n.value.grantee.length > 0 &&
        // The chain rejects MsgGrantAllowance when granter == grantee. Defensive
        // filter — if a self-grant somehow exists in history, don't ingest it.
        n.value.grantee !== ourGranter,
    )
    .map((n) => n.value.grantee as string);

  return {
    maxId,
    grantees,
    // If the page is full, there may be more. If short, we've reached the tail.
    hasMore: nodes.length >= BLOCKSYNC_PAGE_SIZE,
  };
};
