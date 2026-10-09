FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.34.3 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build && pnpm exec tsc --noEmit && pnpm test

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-swe gosu && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/league.ts ./src/league.ts
COPY --from=build /app/package.json ./package.json
RUN mkdir /data && chown node:node /data
ENV LEAGUE_DATA_DIR=/data PORT=8443 OCR_LANG=eng+swe
RUN chmod 755 /app/server/docker-entrypoint.sh
ENTRYPOINT ["/app/server/docker-entrypoint.sh"]
EXPOSE 8443
CMD ["node", "server/start.ts"]
