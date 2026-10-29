# syntax=docker/dockerfile:1

FROM node:26.13.0-alpine AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install --global "$(node -p 'require("./package.json").packageManager')" \
    && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM nginx:1.31.8-alpine

COPY --from=build /app/build/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/build/client /usr/share/nginx/html

# The official Nginx entrypoint substitutes this value into the configuration
# template before starting. It must point to a production-authenticated API.
ENV ATOM_CRM_API_UPSTREAM=http://atom-crm:8080

EXPOSE 8080
