import { GM_xmlhttpRequest } from '$';
import { CBL_GRAPHQL_URL } from '../constants';
import type { CblPayload } from '../types';

/** Community Ban List GraphQL client + response mapper. */

const minimalQuery =
  'query Search($id: String!) {\n' +
  '  steamUser(id: $id) {\n' +
  '    id\n' +
  '    name\n' +
  '    reputationPoints\n' +
  '    riskRating\n' +
  '    reputationRank\n' +
  '  }\n' +
  '}';

export const CblGraphqlClient = {
  minimalQuery,

  fetchSteamUser(steamId64: string): Promise<unknown> {
    const body = JSON.stringify({ query: minimalQuery, variables: { id: steamId64 } });
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: CBL_GRAPHQL_URL,
        headers: { 'Content-Type': 'application/json' },
        data: body,
        onload(r) {
          if (r.status < 200 || r.status >= 300) {
            reject(new Error('CBL HTTP ' + r.status));
            return;
          }
          try {
            resolve(JSON.parse(r.responseText || '{}'));
          } catch (e) {
            reject(e);
          }
        },
        onerror(e) {
          reject(e);
        },
        ontimeout() {
          reject(new Error('timeout'));
        },
        timeout: 25000,
      });
    });
  },
};

interface CblGraphqlShape {
  errors?: unknown[];
  data?: {
    steamUser?: {
      name?: unknown;
      reputationPoints?: unknown;
      riskRating?: unknown;
      reputationRank?: unknown;
    } | null;
  } | null;
}

/** Map a raw CBL GraphQL response into the discriminated {@link CblPayload}. */
export function mapCblResponse(gqlJson: unknown): CblPayload {
  if (!gqlJson) return { kind: 'error' };
  const j = gqlJson as CblGraphqlShape;
  if (j.errors && j.errors.length) return { kind: 'error' };
  const su = j.data && j.data.steamUser;
  if (!su) return { kind: 'notFound' };
  return {
    kind: 'ok',
    reputationPoints: su.reputationPoints != null ? Number(su.reputationPoints) : null,
    riskRating: su.riskRating != null ? String(su.riskRating) : null,
    reputationRank: su.reputationRank != null ? Number(su.reputationRank) : null,
    displayName: su.name != null ? String(su.name) : null,
  };
}
