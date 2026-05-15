FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm install -D typescript && npx tsc && npm uninstall typescript

EXPOSE 3000

CMD ["node", "dist/app.js"]