// Cats of Beach Road
// Reads the Google Sheet server-side (so the browser never hits a cross-origin block)
// and hands the raw CSV to the page at /api/data. Every other request serves the static site.
//
// REQUIREMENT: the Google Sheet must be shared "Anyone with the link -> Viewer",
// otherwise this cannot read it.

const SHEET_ID = "14o260gl11T8JGqKU8yGN6aIMzKLxFTfjedPnWNpoTds";

function csvUrl(tab) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
}

async function getCsv(tab) {
  try {
    const r = await fetch(csvUrl(tab), { cf: { cacheTtl: 300, cacheEverything: true } });
    return r.ok ? await r.text() : "";
  } catch (_) {
    return "";
  }
}

// Google answers a missing tab name with HTTP 200 and the first sheet (the
// instructions), not an error. Only treat a body as that tab when it has the column.
function csvHasColumn(text, key) {
  if (!text || !key) return false;
  const want = key.toLowerCase();
  let row = [];
  let field = "";
  let quoted = false;
  const hit = () => row.some((cell) => cell.trim().toLowerCase() === want);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") {
      row.push(field);
      if (hit()) return true;
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (hit()) return true;
  }
  return false;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/data") {
      const [cats, ledger, postsCsv] = await Promise.all([getCsv("Cats"), getCsv("Ledger"), getCsv("Posts")]);
      // There is no Posts tab yet. Don't pass the instructions sheet through as posts.
      const posts = csvHasColumn(postsCsv, "image_url") ? postsCsv : "";
      return new Response(JSON.stringify({ cats, ledger, posts }), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      });
    }

    // Everything else: serve the static files (index.html and friends).
    return env.ASSETS.fetch(request);
  },
};
