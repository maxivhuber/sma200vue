To run the frontend:

Build the container:
docker build -t sma200vue:latest .

Run the container:
docker run --rm -d --name sma200vue --network services-net sma200vue:latest
