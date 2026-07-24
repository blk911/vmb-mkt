const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { URL } = require("url");

const OUT = path.join("data", "research", "hair", "raw_fetches");
fs.mkdirSync(OUT, { recursive: true });

const targets = [
  { id: "klm-hair", url: "https://klm-hair.square.site/" },
  { id: "onpoint-schedulicity", url: "https://www.schedulicity.com/scheduling/VTJ97E/services" },
  { id: "onyx-vagaro", url: "https://www.vagaro.com/onyxandcosalon" },
  { id: "perlino-vagaro", url: "https://www.vagaro.com/perlino" },
  { id: "salongoldyn-schedulicity", url: "https://www.schedulicity.com/scheduling/SGKDFZ/services" },
  { id: "hair-moore-vagaro", url: "https://www.vagaro.com/creatingperfectbeauty/services" },
  { id: "the-place-booksy", url: "https://booksy.com/en-us/690375_denver-s-best-hairstylist-the-place-salon-michael-eatmon_hair-salon_134761_denver" },
  { id: "colorcrush-vagaro", url: "https://www.vagaro.com/colorcrushhairstudio" },
  { id: "tulip-square", url: "https://squareup.com/appointments/book/3o58drn4pdwabf/RPECVBBEZVZTA/start" },
];

function fetchOnce(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 25000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
          const next = new URL(res.headers.location, url).toString();
          res.resume();
          return resolve(fetchOnce(next, redirects + 1));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            finalUrl: url,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.end();
  });
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const SERVICE_HINT =
  /\b(haircut|cut|blowout|blow.?dry|balayage|highlight|color|toner|gloss|root|silk press|keratin|brazilian|extension|sew.?in|braid|loc|wig|weave|treatment|consultation|style|trim|foil|blond|ombre|corrective|install|move.?up|detangl)\b/i;
const PRICE_HINT = /\$\s?\d{1,4}(?:\.\d{2})?|\b\d{2,4}\s*(?:\/|-|to)\s*\$?\d{2,4}\b|starting at|from \$|price varies|consultation required|deposit/i;

(async () => {
  const results = [];
  for (const t of targets) {
    try {
      const res = await fetchOnce(t.url);
      const htmlPath = path.join(OUT, `${t.id}.html`);
      fs.writeFileSync(htmlPath, res.body);
      const text = stripHtml(res.body);
      const textPath = path.join(OUT, `${t.id}.txt`);
      fs.writeFileSync(textPath, text.slice(0, 200000));
      const hasService = SERVICE_HINT.test(text);
      const hasPrice = PRICE_HINT.test(text);
      results.push({
        id: t.id,
        url: t.url,
        status: res.status,
        bytes: res.body.length,
        hasServiceHint: hasService,
        hasPriceHint: hasPrice,
        preview: text.slice(0, 1200),
      });
      console.log(t.id, res.status, res.body.length, "svc", hasService, "price", hasPrice);
    } catch (e) {
      results.push({ id: t.id, url: t.url, error: String(e.message || e) });
      console.log(t.id, "ERR", e.message || e);
    }
  }
  fs.writeFileSync(
    path.join("data", "research", "hair", "live_fetch_summary.json"),
    JSON.stringify({ fetchedAt: new Date().toISOString(), results }, null, 2),
  );
})();
