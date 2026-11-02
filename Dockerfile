FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg chromium ca-certificates fonts-liberation && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 8080
CMD ["npm","--workspace","apps/api","start"]
