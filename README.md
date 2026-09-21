# jobly

Search once, see how many listings exist and exactly which sources they came from.

v1 covers jobs, pulled from two free, no-key APIs:
- RemoteOK
- Arbeitnow

## Run locally

```
npm i -g vercel
vercel dev
```

Then open http://localhost:3000

## Deploy for free

1. Push this folder to a new GitHub repo
2. Go to https://vercel.com → "Add New Project" → import the repo
3. Leave all settings default and click Deploy
4. You'll get a free `your-project.vercel.app` URL — no card required

## How it works

- `public/index.html` — the search UI (static, no framework)
- `api/search.js` — a serverless function that queries RemoteOK + Arbeitnow in
  parallel, filters both by your search term, and returns a merged result:
  total count + each source's own count and listings

## Adding a new source later

Add a new `fetchX(matches)` function in `api/search.js` following the same
shape as `fetchRemoteOK` / `fetchArbeitnow`, then push it into the
`Promise.allSettled([...])` array and the `sources` array below it. The
frontend already renders any number of sources automatically.

## Next steps (not built yet)

- Product sources (eBay Browse API, Etsy Open API — both have free tiers)
- Caching popular searches so you don't burn API quota
- Email alerts for saved searches (first candidate for a paid feature)
