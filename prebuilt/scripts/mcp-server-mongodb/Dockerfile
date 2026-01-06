FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --production --no-fund --no-audit

COPY . .

ENTRYPOINT ["node", "index.js"]
