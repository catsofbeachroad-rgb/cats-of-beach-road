// Cats of Beach Road
// Reads the Google Sheet server-side (so the browser never hits a cross-origin block)
// and hands the raw CSV to the page at /api/data.
// Every other request is a static file. Pages runs this worker in front of the assets,
// so missing files, repo docs, and response headers are handled here.
//
// REQUIREMENT: the Google Sheet must be shared "Anyone with the link -> Viewer",
// otherwise this cannot read it.

const SHEET_ID = "14o260gl11T8JGqKU8yGN6aIMzKLxFTfjedPnWNpoTds";

// Present only in index.html. A 200 HTML body with this marker, on any other path,
// is Pages falling back to the homepage (there is no real file for that URL).
const HOMEPAGE_MARKER = 'id="heroStats"';
// Present only in 404.html. If Pages serves that file with status 200 for some other path, still return 404.
const NOT_FOUND_MARKER = 'id="not-found"';

// Inline scripts and style attributes live in the HTML files, which are edited by hand,
// so script-src and style-src allow 'unsafe-inline'. Remote scripts, frames, and
// connections stay limited to what the pages actually use, plus hCaptcha for later.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://api.web3forms.com",
  "script-src 'self' 'unsafe-inline' https://hcaptcha.com https://*.hcaptcha.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://hcaptcha.com https://*.hcaptcha.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self'",
  "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://api.web3forms.com https://hcaptcha.com https://*.hcaptcha.com",
  "frame-src https://maps.google.com https://www.google.com https://hcaptcha.com https://*.hcaptcha.com",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "content-security-policy": CONTENT_SECURITY_POLICY,
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=(), display-capture=(), browsing-topics=(), interest-cohort=()",
};

const BLOCKED_DIRS = new Set(["docs", "doc", "node_modules"]);
const BLOCKED_BASENAMES = new Set([
  "readme", "readme.md", "readme.txt", "readme.markdown",
  "license", "license.md", "license.txt", "copying", "copying.md",
  "changelog", "changelog.md", "contributing.md", "code_of_conduct.md", "security.md",
  "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
  "wrangler.toml", "wrangler.json", "wrangler.jsonc",
  "tsconfig.json", "jsconfig.json",
  "dockerfile", "makefile", "gemfile", "gemfile.lock",
  "requirements.txt", "cargo.toml", "cargo.lock", "go.mod", "go.sum",
  "composer.json", "composer.lock",
]);
const BLOCKED_EXTENSIONS = [".md", ".markdown", ".toml", ".lock", ".yml", ".yaml"];

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

function decodePath(pathname) {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
    decoded = decodeURIComponent(decoded);
  } catch (_) {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return null;
  return decoded;
}

function isHome(pathname) {
  return pathname === "/" || pathname === "";
}

function isNotFoundPath(pathname) {
  const bare = pathname.replace(/\/+$/, "") || "/";
  const lower = bare.toLowerCase();
  return lower === "/404" || lower === "/404.html";
}

// Repo files that ship with the site because the Pages output directory is the
// repo root. They stay in git; they are not part of the public site.
function isRepoOnly(pathname) {
  const decoded = decodePath(pathname);
  if (decoded == null) return true;
  const parts = decoded.split("/").filter(Boolean);
  if (parts.length === 0) return false;
  if (parts.some((part) => part === "." || part === "..")) return true;
  const lower = parts.map((part) => part.toLowerCase());
  if (lower.some((part) => part.startsWith(".") || part.startsWith("_"))) return true;
  if (lower.some((part) => BLOCKED_DIRS.has(part))) return true;
  const base = lower[lower.length - 1];
  if (BLOCKED_BASENAMES.has(base) || base.startsWith(".env")) return true;
  return BLOCKED_EXTENSIONS.some((ext) => base.endsWith(ext));
}

function withSecurity(response, status) {
  const headers = new Headers(response.headers);
  // Pages adds this on static files. The site only talks to itself.
  headers.delete("access-control-allow-origin");
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, {
    status: status || response.status,
    statusText: status === 404 ? "Not Found" : response.statusText,
    headers,
  });
}

async function isMissing(pathname, response) {
  if (response.status === 404) return true;
  if (response.status !== 200) return false;
  const type = (response.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("text/html")) return false;
  if (isHome(pathname)) return false;
  const text = await response.clone().text();
  if (text.includes(HOMEPAGE_MARKER)) return true;
  return text.includes(NOT_FOUND_MARKER) && !isNotFoundPath(pathname);
}

async function load404(request, env) {
  const origin = new URL(request.url).origin;
  let url = origin + "/404.html";
  for (let i = 0; i < 3; i++) {
    const res = await env.ASSETS.fetch(new Request(url, { method: "GET", redirect: "manual" }));
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      url = new URL(loc, url).toString();
      continue;
    }
    const type = (res.headers.get("content-type") || "").toLowerCase();
    // /404.html is a real file, but Pages may still answer it with status 404.
    if ((res.ok || res.status === 404) && type.includes("text/html")) return res;
    break;
  }
  return new Response("Page not found\nページが見つかりません\n", {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate" },
  });
}

async function notFound(request, env) {
  const page = await load404(request, env);
  const secured = withSecurity(page, 404);
  if (request.method === "HEAD") {
    return new Response(null, { status: 404, statusText: "Not Found", headers: secured.headers });
  }
  return secured;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/data") {
      const [cats, ledger, postsCsv] = await Promise.all([getCsv("Cats"), getCsv("Ledger"), getCsv("Posts")]);
      // There is no Posts tab yet. Don't pass the instructions sheet through as posts.
      const posts = csvHasColumn(postsCsv, "image_url") ? postsCsv : "";
      return withSecurity(new Response(JSON.stringify({ cats, ledger, posts }), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      }));
    }

    if (isRepoOnly(url.pathname)) return notFound(request, env);

    // HEAD has no body, so a missing path would look like a real file. Fetch GET, then drop the body.
    const assetRequest = request.method === "HEAD"
      ? new Request(request, { method: "GET" })
      : request;
    const asset = await env.ASSETS.fetch(assetRequest);
    if (await isMissing(url.pathname, asset)) return notFound(request, env);

    const secured = withSecurity(asset);
    if (request.method === "HEAD") {
      return new Response(null, { status: secured.status, statusText: secured.statusText, headers: secured.headers });
    }
    return secured;
  },
};
