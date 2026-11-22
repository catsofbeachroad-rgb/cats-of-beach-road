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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/data") {
      const [cats, ledger, posts] = await Promise.all([getCsv("Cats"), getCsv("Ledger"), getCsv("Posts")]);
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
