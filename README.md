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
docker build -t sma200vue:latest .
docker run -d --name sma200vue --network services-net --restart unless-stopped sma200vue:latest
```
