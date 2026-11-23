# Cats of Beach Road

Website for Cats of Beach Road, a community cat project for the cats of a Beach Road
estate in Singapore. It is a static, bilingual (English / 日本語) site. Live at
https://cats-of-beach-road.pages.dev (currently served from a temporary
catsofbeachroad.pages.dev until the final URL is reclaimed).

## Hosting and deployment

- Static site on Cloudflare Pages, connected to this GitHub repo.
- Every commit to `main` deploys automatically. No manual uploads.
- To change the site: edit a file here (open it on GitHub, click the pencil, edit,
  commit) or upload a replacement with the same filename. Cloudflare rebuilds in
  about a minute.
- Build settings (already set): Framework preset None, no build command, output
  directory `/`.

## Files

- `index.html`: the homepage (markup, styles and script in one file).
- `visit.html`: the "Near Beach Road" page (nearby places), linked from the nav.
- `privacy.html`, `contact.html`: standalone pages.
- `_worker.js`: a Cloudflare Pages function that reads the Google Sheet server-side
  and serves it at `/api/data`. A browser cannot read the Sheet directly because of
  CORS.
- `icon.png`, `apple-touch-icon.png`: the logo used as the browser-tab and
  home-screen icon.
- `logo.png`: the full emblem logo used in the hero.
- `og.png`: social-share image shown when the link is shared.
- `instagram.png`: Instagram glyph used in the footer and the Follow section.
- `photos/`: cat photos (see Photos below).

## Content comes from a Google Sheet

The site reads its content live from a Google Sheet, so content changes need no code
changes. `_worker.js` fetches the Sheet and serves it at `/api/data`.

- The Sheet ID is in `_worker.js`.
- The Sheet must be shared "Anyone with the link can view".
- The site tolerates an instructions row above the header row, so keeping guidance in
  the Sheet is fine.
- Until a tab has rows, the site shows built-in sample data.

Tabs and the columns the site reads:

- Cats: id, name, name_ja, age, age_ja, personality, personality_ja, trivia,
  trivia_ja, photo_url, status (active / adopted / passed)
- Ledger: date, direction (in / out), category (food / vet / other), amount_sgd,
  description, description_ja
- Posts: date, image_url, caption, caption_ja, link

The `_ja` columns feed the Japanese toggle. Leave them blank to fall back to English.

## Config

Settings live in the `CONFIG` object at the top of the script in `index.html`:

- `colonySize`: the number shown as "20+".
- `ledgerUrl`: paste the view-only Sheet link to turn on the "See the full ledger" link.
- `igUrl`: the Instagram link (also powers the Follow button).
- `heroVideo` / `heroPoster`: optional hero background video.

## Photos

Host cat photos in this repo, not Google Drive or Instagram (those block hotlinking or
expire).

1. Put the image in `photos/`, named after the cat's `id`, for example `photos/puma.jpg`.
2. Resize to about 800px wide and under about 300 KB first, so the page stays fast.
3. Set the cat's `photo_url` in the Sheet to `/photos/puma.jpg` (leading slash).

## Brand

- Colours: coral `#FF5C57`, teal `#14B4A4`, cream `#FFF7F2` (background), ink `#2B2A33`
  (text).
- Fonts: Fredoka (display), Nunito (body), Noto Sans JP (Japanese).

## Security

- This is a public repo. Never commit API keys or tokens.
- Let HitPay handle all payment data. Never collect card numbers on the site.
- Spam-protect the contact form (honeypot or captcha); the Web3Forms key is public.
- Keep private information (home addresses, exact cat locations, personal email) out of
  the public Sheet and pages.
