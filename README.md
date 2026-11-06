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
