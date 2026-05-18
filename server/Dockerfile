# syntax=docker/dockerfile:1.6

FROM node:22-alpine AS build
WORKDIR /app

# better-sqlite3 native bağımlılıkları (Alpine):
RUN apk add --no-cache python3 make g++ gcc libc-dev sqlite

COPY package*.json tsconfig.json ./
RUN npm install --include=dev

COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Runtime'da da SQLite'ın libstdc++/libgcc bağımlılığı gerek.
RUN apk add --no-cache libstdc++ libgcc

# build-deps prod install için de gerekli (npm rebuild native module).
RUN apk add --no-cache --virtual .build-deps python3 make g++ gcc libc-dev

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force \
 && apk del .build-deps

COPY --from=build /app/dist ./dist

# Data dizini volume mount point.
RUN mkdir -p /data
VOLUME ["/data"]
ENV DATA_DIR=/data

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://localhost:3001/health >/dev/null || exit 1

CMD ["node", "dist/index.js"]
