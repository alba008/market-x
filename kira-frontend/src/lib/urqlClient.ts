import { Client, cacheExchange, fetchExchange } from "urql";
import { authExchange } from "@urql/exchange-auth";
import { getAccess, getRefresh, setTokens, clearTokens } from "../auth/tokens";

const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL as string;

const REFRESH_MUTATION = `
mutation Refresh($refresh: String!) {
  refreshToken(refresh: $refresh) { access refresh }
}
`;

async function refreshTokens(): Promise<{ access: string; refresh: string } | null> {
  const refresh = getRefresh();
  if (!refresh) return null;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: REFRESH_MUTATION,
      variables: { refresh },
    }),
  });

  const json = await res.json();
  const tokens = json?.data?.refreshToken;
  if (!tokens?.access) return null;
  return tokens;
}

export const urqlClient = new Client({
  url: GRAPHQL_URL,
  exchanges: [
    cacheExchange,
    authExchange(async (utils) => {
      return {
        addAuthToOperation(operation) {
          const access = getAccess();
          if (!access) return operation;

          return utils.appendHeaders(operation, {
            Authorization: `Bearer ${access}`,
          });
        },
        didAuthError(error) {
          return error.graphQLErrors.some((e) =>
            (e.message || "").toLowerCase().includes("authentication required")
          );
        },
        async refreshAuth() {
          const tokens = await refreshTokens();
          if (!tokens) {
            clearTokens();
            return;
          }
          setTokens(tokens.access, tokens.refresh);
        },
      };
    }),
    fetchExchange,
  ],
});
