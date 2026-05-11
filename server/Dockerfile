# syntax=docker/dockerfile:1.6

FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install --include=dev

COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://localhost:3001/health >/dev/null || exit 1

CMD ["node", "dist/index.js"]
