# Build backend
FROM node:16 AS build-backend
WORKDIR /tmp/logion-backend
COPY . .
RUN yarn install --immutable
RUN yarn build

# Backend image
FROM logionnetwork/logion-backend-base:v6

COPY --from=build-backend /tmp/logion-backend/dist dist
COPY --from=build-backend /tmp/logion-backend/node_modules node_modules
COPY --from=build-backend /tmp/logion-backend/resources resources

ENV NODE_ENV=production
ENV WS_PROVIDER_URL=ws://localhost:9944
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
ENV JWT_SECRET=1c482e5368b84abe08e1a27d0670d303351989b3aa281cb1abfc2f48e4530b57
ENV JWT_ISSUER=12D3KooWDCuGU7WY3VaWjBS1E44x4EnmTgK3HRxWFqYG3dqXDfP1
ENV JWT_TTL_SEC=3600
ENV PORT=8080
ENV TYPEORM_CONNECTION=postgres
ENV TYPEORM_HOST=localhost
ENV TYPEORM_USERNAME=postgres
ENV TYPEORM_PASSWORD=secret
ENV TYPEORM_DATABASE=postgres
ENV TYPEORM_PORT=5432
ENV TYPEORM_SYNCHRONIZE=false
ENV TYPEORM_ENTITIES=dist/model/*.model.js
ENV TYPEORM_MIGRATIONS=dist/migration/*.js
ENV PROMETHEUS_PORT=8081

COPY ./docker/backend/. /usr/docker/.
RUN chmod +x /usr/docker/*

ENTRYPOINT ["/usr/docker/docker-entrypoint.sh"]

CMD node ./node_modules/typeorm/cli.js -d ./dist/app-datasource.js migration:run && node ./dist/app.js
EXPOSE ${PORT}
EXPOSE ${PROMETHEUS_PORT}
