import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const db = new DynamoDBClient({ region: "us-east-1" });

/* In-memory cache survives between invocations on the same warm container.
   Labs change infrequently (TA edits) so a 30s TTL is safe and cuts the
   per-page-load DynamoDB Scan to ~1 per 30s per container. */
const CACHE_TTL_MS = 30_000;
let _cache = null;       // { labs, expiresAt }
let _inflight = null;    // Promise — coalesce concurrent cold requests

async function loadLabs() {
  if (_cache && Date.now() < _cache.expiresAt) return _cache.labs;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const labs = [];
      let lastKey;
      do {
        const res = await db.send(new ScanCommand({
          TableName: "Labs",
          ExclusiveStartKey: lastKey,
        }));
        (res.Items || []).forEach(i => labs.push(unmarshall(i)));
        lastKey = res.LastEvaluatedKey;
      } while (lastKey);
      _cache = { labs, expiresAt: Date.now() + CACHE_TTL_MS };
      return labs;
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

export const handler = async (event) => {
  try {
    /* allow forced refresh via ?fresh=1 — useful right after TA edits a lab */
    if (event?.queryStringParameters?.fresh) _cache = null;

    const labs = await loadLabs();
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=15",
      },
      body: JSON.stringify({ success: true, labs })
    };
  } catch(err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
