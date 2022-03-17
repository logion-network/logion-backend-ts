# Import pre-built calc
FROM logionnetwork/logion-backend-calc:v1 AS calc

FROM node:14
RUN apt-get update && apt-get -y --no-install-recommends install postgresql-client ; rm -rf /var/lib/apt/lists/*
WORKDIR /usr/share/logion-backend
