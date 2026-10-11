# God's Eye View on a server: build on the supported Node, serve the bundle
# with the preview server and its provider middleware. See docs/DEPLOY-VPS.md.
FROM node:24-alpine AS build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    HOST=0.0.0.0 \
    PORT=4173
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY build ./build
COPY server ./server
COPY src ./src
COPY config ./config
COPY public ./public
COPY vite.config.js index.html style.css ./
EXPOSE 4173
USER node
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "4173", "--strictPort"]
