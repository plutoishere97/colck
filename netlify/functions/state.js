// A tiny same-origin API for the clock: GET reads the last state for a
// pairing code, POST replaces it. Storage is Netlify Blobs, which needs no
// separate database or account — it's automatically available to any
// function running on Netlify.
const { getStore } = require("@netlify/blobs");

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

exports.handler = async (event) => {
  const code = ((event.queryStringParameters && event.queryStringParameters.code) || "")
    .trim()
    .toUpperCase()
    .slice(0, 24);

  if (!code) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "missing code" }) };
  }

  // Automatic zero-config Blobs (siteID/token injected by the platform)
  // isn't reliable in every deploy setup, so this falls back to explicit
  // credentials from environment variables when they're present.
  const store = process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN
    ? getStore({ name: "redclock", siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN })
    : getStore("redclock");
  const key = "state-" + code;

  if (event.httpMethod === "GET") {
    const data = await store.get(key, { type: "json" }).catch(() => null);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data || null) };
  }

  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "bad json" }) };
    }
    if (!body || (body.mode !== "paused" && body.mode !== "running") || !body.anchorTime) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "bad state shape" }) };
    }
    await store.setJSON(key, body);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "method not allowed" }) };
};
