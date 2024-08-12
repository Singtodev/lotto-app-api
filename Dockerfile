FROM node:22-alpine
WORKDIR /app
COPY .  ./
RUN npm install pm2 -g
RUN npm install --force
RUN npm run build
EXPOSE 8000
CMD ["pm2-runtime","start","dist/index.js","-i","1"]