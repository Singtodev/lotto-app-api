FROM node:22-alpine
WORKDIR /app
COPY .  ./
RUN npm install --force
RUN npm run build
EXPOSE 3000
CMD ["npm", "run","start"]