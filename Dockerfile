FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY shared ./shared
COPY server ./server
COPY tsconfig.json ./

EXPOSE 3000

CMD ["npm", "run", "dev"]
