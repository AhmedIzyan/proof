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

## Run locally

Serve the folder over HTTP. Opening `index.html` directly will prevent the service worker from installing.

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Publish

Upload the folder to any static host such as GitHub Pages, Netlify, Vercel, or Cloudflare Pages. No build step is required.

The account flow is intentionally local for this MVP. Before using real users, replace it with a server-backed authentication provider and never store passwords in `localStorage`.