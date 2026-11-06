# ChartLab

## Development

```sh
npm install
npm run dev
```

With mock backend (no real API needed):

```sh
npm run mock:generate   # generate fixture data (once)
npm run dev:mock        # starts mock server + vite dev server
```

## Production

```sh
docker build --pull --no-cache -t sma200vue:latest .
docker stop sma200vue && docker rm sma200vue   # if already running
docker run -d --name sma200vue --network services-net --restart unless-stopped \
  --log-opt max-size=10m --log-opt max-file=3 \
  sma200vue:latest
```

`--log-opt` caps the container's nginx logs at ~30 MB; without it Docker's default
json-file driver grows unbounded.

## Keeping dependencies up to date

The build installs exactly what `package-lock.json` pins (`npm ci`), so every server
builds the same, tested versions. Updates arrive as pull requests instead:

- **Dependabot** (`.github/dependabot.yml`) opens a weekly PR with all minor/patch
  bumps grouped, separate PRs for major versions, and monthly PRs for GitHub Actions.
  TypeScript is held below 6.1 until `vue-tsc` and `typescript-eslint` support TS 7.
- **CI** (`.github/workflows/ci.yml`) runs type-check, lint, format check and build
  on every PR and push to `main`.

Merge the PRs that pass CI, then `git pull` and rebuild (see Production). A fresh
clone of `main` is always as current as the last merged update.
