FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY unfazed-backend/package.json unfazed-backend/package.json
COPY unfazed-frontend/package.json unfazed-frontend/package.json
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/unfazed-backend ./unfazed-backend
COPY --from=build --chown=node:node /app/unfazed-frontend/package.json ./unfazed-frontend/package.json
COPY --from=build --chown=node:node /app/unfazed-frontend/dist ./unfazed-frontend/dist
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/assets ./assets
USER node
EXPOSE 5000
CMD ["node", "unfazed-backend/server.js"]
