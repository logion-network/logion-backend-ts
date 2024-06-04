# Logion TypeScript backend

The backend stores data which cannot be exposed publicly, or which wait legal officer's approval.
It was initially written in [Java]((https://github.com/logion-network/logion-backend-java)) - now deprecated.

This project features:

- A Spring-like framework for Java-boys: [Dinoloop](https://github.com/ParallelTask/dinoloop)
- Web framework: [Express](https://expressjs.com/)
- Dependency Injection: [Inversify](https://inversify.io/)
- ORM: [TypeORM](https://typeorm.io/)
- Unit testing: [Jasmine](https://jasmine.github.io/pages/getting_started.html)
- Service Mocking: [Moq.ts](https://dvabuzyarov.github.io/moq.ts/)
- Automated API doc with Swagger: [express-oas-generator](https://github.com/mpashkovskiy/express-oas-generator#express-oas-generator)
- Coverage: [nyc](https://github.com/istanbuljs/nyc#nyc)

## Requirements

- A PostgreSQL database to connect to
- A PostgreSQL client installed on host
- A [logion node](https://github.com/logion-network/logion-node) to connect to
- [IPFS Cluster CLI](https://dist.ipfs.io/#ipfs-cluster-ctl) installed on host
- [exiftool](https://exiftool.org/) installed on host

## Logion API

### Authentication
Authentication process is described [here](doc/Authentication.md).

For testing purpose, you may generate your own token [here](https://jwt.io/) and set the following fields:

Header:
```
{
  "alg": "HS384",
  "typ": "JWT"
}
```

Payload:
```
{
    "iat": 1623674099,
    "exp": 1823674099,
    "legalOfficer": true,
    "iss": "localhost",
    "sub": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
}
```
Note that the value of `iss` must match `JWT_ISSUER`.

Verify signature: check the "base 64 encoded" box and paste the value of `JWT_SECRET`.

The generated token may be sent to the API with `Authorization: Bearer $TOKEN` header. With `curl`, the command would look like this:
```
curl -v http://localhost:8090/api/$PATH -H "Authorization: Bearer $TOKEN" ...
```

## Quick start

### DB
First, run a PostgreSQL server:

`docker run --name logion-postgres -e POSTGRES_PASSWORD=secret -p 5432:5432 -d logionnetwork/logion-postgres:latest`

(or `docker start logion-postgres` if you already executed the above command).

Then copy the file [`ormconfig.json.sample`](ormconfig.json.sample) to `ormconfig.json`, and adapt to your database setup if needed.

Create the database schema using `yarn typeorm migration:run`. More info about [DB migrations](doc/DbMigration.md).

Note that in order to run the backend itself or the integration tests, you'll need `psql` to be installed locally.

Logion backend is using a custom PostgreSQL image `logionnetwork/logion-postgres`. It may be built with the following command:

`docker build logion-postgres/ -t logionnetwork/logion-postgres:latest`

See `./logion-postgres/Dockerfile` for more information about the customizations.

### Connection to a node

By default, the backend connects to `ws://localhost:9944`, i.e. a logion node running on your local machine.

In order to change this behavior, copy the file [`.env.sample`](.env.sample) to `.env`, and adapt it to match your needs:
* `WS_PROVIDER_URL`: the url to a logion node.
* `NODE_TLS_REJECT_UNAUTHORIZED`: equals to 0 to disable certificate verification

### Run
`yarn start`

## Tests
Coverage report is generated using `yarn coverage` (all tests) or `yarn coverage-unit` (unit tests only).
It's located under [`coverage/index.html`](coverage/index.html).


## Logion Components

* The [Node](https://github.com/logion-network/logion-node) is the implementation of the chain.
* The [Typescript backend](https://github.com/logion-network/logion-backend-ts) stores data which cannot be exposed publicly, or which wait legal officer's approval.
* The [Wallet](https://github.com/logion-network/logion-wallet) is the user application.

## Docker

The backend's Docker image can be built with the following command:

`docker build . -t logionnetwork/logion-backend:latest`

When building `logionnetwork/logion-backend`, a build image is required (it is publicly available through `hub.docker.com`):

- `logionnetwork/logion-backend-base` which comes with a preconfigured Node.JS distribution as a pre-installed IPFS Cluster client

`logionnetwork/logion-backend-base` can be rebuilt with `docker build docker/base/ -t logionnetwork/logion-backend-base:vX`
where `X` is a build number.

**Update your local node image on a regular time basis `docker pull node:18`**
