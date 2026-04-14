FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm install -g ts-node typescript

CMD ["ts-node", "src/index.ts"]
