const SYNC_TARGET = (Deno.env.get("TARGET_DOMAIN") || "").replace(/\/$/, "");

const EXCLUDED_METADATA = new Set([
  "host", "connection", "keep-alive", "te", "trailer", "upgrade", "forwarded"
]);

export default async function (req, context) {
  // بررسی وجود متغیر محیطی
  if (!SYNC_TARGET) {
    return new Response(
      JSON.stringify({ status: "error", message: "TARGET_DOMAIN variable is missing!" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    
    // ۱. تمیز کردن مسیر (حذف بخش ردگم‌کنی نتلیفای قبل از ارسال به سرور اصلی)
    const cleanPath = url.pathname.replace("/api/v1/sync/data", "");
    const syncEndpoint = SYNC_TARGET + (cleanPath === "" ? "/" : cleanPath) + url.search;

    const payloadHeaders = new Headers(req.headers);
    const nfKeyPrefix = "x-nf-";
    
    for (const [k, v] of req.headers) {
      const normalizedKey = k.toLowerCase();
      if (EXCLUDED_METADATA.has(normalizedKey) || normalizedKey.startsWith(nfKeyPrefix)) {
        payloadHeaders.delete(k);
      }
    }

    // تنظیم دستی هاست برای جلوگیری از ریجکت شدن توسط سرور مقصد
    const targetUrlObj = new URL(SYNC_TARGET);
    payloadHeaders.set("Host", targetUrlObj.host);

    const response = await fetch(syncEndpoint, {
      method: req.method,
      headers: payloadHeaders,
      body: (req.method !== "GET" && req.method !== "HEAD") ? req.body : undefined,
      redirect: "follow",
      duplex: "half" // 👈 این همون خط حیاتی برای استریم ترافیک تونله
    });

    // ۲. ساخت ریپانس تمیز و حذف هدرهایی که باعث کرش کردن مرورگر میشن
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("transfer-encoding");
    responseHeaders.delete("strict-transport-security");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ status: "error", message: "Target unreachable.", details: err.message }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
