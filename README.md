# Lotto APP API DOCUMENT

#Step Build Application

docker build -t lotto-app-api .

docker run -p 3000:3000 -d --name lotto-app-api lotto-app-api

docker ps

docker stop lotto-app-api


# docker-compose

docker-compose up -d

docker-compose down

docker exec -it lotto-app-api-app-1 /bin/sh