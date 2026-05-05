// اسم متغیر محیطی در نتلیفای رو هم چک کن که درست ست کرده باشی
const SYNC_TARGET = (Deno.env.get("TARGET_DOMAIN") || "").replace(/\/$/, "");

const EXCLUDED_METADATA = new Set([
  "host",
  "connection",
  "keep-alive",
  ["proxy", "authenticate"].join("-"),
  ["proxy", "authorization"].join("-"),
  "te",
  "trailer",
  ["transfer", "encoding"].join("-"),
  "upgrade",
  "forwarded",
  ["x", "forwarded", "host"].join("-"),
  ["x", "forwarded", "proto"].join("-"),
  ["x", "forwarded", "port"].join("-"),
]);

export default async function (req, context) {
  if (!SYNC_TARGET) {
    return new Response(
      JSON.stringify({ status: "error", message: "Configuration missing." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const syncEndpoint = SYNC_TARGET + url.pathname + url.search;

    const payloadHeaders = new Headers(req.headers);
    
    // پاک کردن هدرهای مخصوص نتلیفای برای استتار
    const nfKeyPrefix = ["x", "nf", ""].join("-");
    
    for (const [k, v] of req.headers) {
      const normalizedKey = k.toLowerCase();
      if (EXCLUDED_METADATA.has(normalizedKey) || normalizedKey.startsWith(nfKeyPrefix)) {
        payloadHeaders.delete(k);
      }
    }

    return await fetch(syncEndpoint, {
      method: req.method,
      headers: payloadHeaders,
      body: (req.method !== "GET" && req.method !== "HEAD") ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ status: "error", message: "Target unreachable." }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
