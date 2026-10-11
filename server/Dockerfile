FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm install
COPY . .
RUN npm run build --workspace=server

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm install --omit=dev --workspace=server
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/node_modules ./node_modules
WORKDIR /app/server
EXPOSE 3001
CMD ["node", "dist/index.js"]
