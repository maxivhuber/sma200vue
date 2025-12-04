To run the frontend:

Build the container:
docker build -t sma200vue:latest .

Run the container:
docker run -d --name sma200vue --network services-net --restart unless-stopped sma200vue:latest
