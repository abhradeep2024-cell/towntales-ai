FROM node:22-bookworm-slim
WORKDIR /app
COPY . .
RUN npm install --no-audit --no-fund && npm run build
ENV NODE_ENV=production
EXPOSE 10000
CMD ["npm","--workspace","apps/api","start"]
