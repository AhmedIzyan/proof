# Proof

Proof turns everyday goals into progress you can see.

This is a static MVP with local browser persistence. It includes:

- Goal creation and daily progress
- Focus timer
- Daily check-ins and streaks
- Private challenge UI
- Weekly coaching report and Proof Score
- Local create-account, sign-in, and sign-out flow
- Installable app shell with offline asset caching

## PWA Builder checklist

Proof includes the requirements PWABuilder needs:

- HTTPS deployment through GitHub Pages or another static host
- `manifest.json` with `id`, `start_url`, `scope`, standalone display, colors, and portrait orientation
- Explicit 192px and 512px PNG icons, including a maskable 512px icon
- Registered service worker with cached app shell and offline navigation fallback
- Apple touch icon for iOS home-screen installation

Run PWABuilder against the deployed HTTPS URL, not localhost:

```text
https://ahmedizyan.github.io/proof/
```

## Run locally

Serve the folder over HTTP. Opening `index.html` directly will prevent the service worker from installing.

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Publish

Upload the folder to any static host such as GitHub Pages, Netlify, Vercel, or Cloudflare Pages. No build step is required.

For automatic GitHub Pages deployment, set the repository's **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The workflow in `.github/workflows/pages.yml` deploys the static site whenever a commit is pushed to `main`.

The account flow is intentionally local for this MVP. Before using real users, replace it with a server-backed authentication provider and never store passwords in `localStorage`.