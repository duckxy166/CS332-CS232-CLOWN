import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const db = new DynamoDBClient({ region: "us-east-1" });

const CACHE_TTL_MS = 60_000;
let _cache = null;
let _inflight = null;

async function loadRoster() {
  if (_cache && Date.now() < _cache.expiresAt) return _cache.roster;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const roster = [];
      let lastKey;
      do {
        const res = await db.send(new ScanCommand({
          TableName: "ClassRoaster",
          ExclusiveStartKey: lastKey,
        }));
        (res.Items || []).forEach(i => roster.push(unmarshall(i)));
        lastKey = res.LastEvaluatedKey;
      } while (lastKey);
      _cache = { roster, expiresAt: Date.now() + CACHE_TTL_MS };
      return roster;
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

export const handler = async (event) => {
  try {
    if (event?.queryStringParameters?.fresh) _cache = null;
    const roster = await loadRoster();
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=30",
      },
      body: JSON.stringify({ success: true, roster })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
