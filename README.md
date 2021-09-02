# Logion TypeScript backend

This project was initially created from [this project](https://github.com/ParallelTask/dinoloop-inversify-starter)
and features:

- A Spring-like framework for Java-boys: [Dinoloop](https://github.com/ParallelTask/dinoloop)
- Web framework: [Express](https://expressjs.com/)
- Dependency Injection: [Inversify](https://inversify.io/)
- ORM: [TypeORM](https://typeorm.io/)
- Unit testing: [Jasmine](https://jasmine.github.io/pages/getting_started.html)
- Service Mocking: [Moq.ts](https://dvabuzyarov.github.io/moq.ts/)
- Automated API doc with Swagger: [express-oas-generator](https://github.com/mpashkovskiy/express-oas-generator#express-oas-generator)
- Coverage: [nyc](https://github.com/istanbuljs/nyc#nyc)

## Logion API

### Protection requests

Request IDs are randomly generated upon creation. Please note down the request ID you get on creation in order to use
it as a path variable in the other queries.

- Create: `curl -v http://127.0.0.1:8088/api/protection-request -H "Content-Type: application/json" -d @sample-data/create.json  | jq`
- Fetch by requester: `curl -vX PUT http://127.0.0.1:8088/api/protection-request -H "Content-Type: application/json" -d @sample-data/fetch_pending_by_requester.json | jq`
- Fetch by legal officer: `curl -vX PUT http://127.0.0.1:8088/api/protection-request -H "Content-Type: application/json" -d @ sample-data/fetch_pending_by_legal_officer.json | jq`
- Reject: `curl -v http://127.0.0.1:8088/api/protection-request/<id>/reject -H "Content-Type: application/json" -d @sample-data/reject.json  | jq`
- Accept: `curl -v http://127.0.0.1:8088/api/protection-request/<id>/accept -H "Content-Type: application/json" -d @sample-data/accept.json  | jq`
- Check: `curl -v http://127.0.0.1:8088/api/protection-request/<id>/check-activation -H "Content-Type: application/json" -d @sample-data/check.json  | jq`

## Quick start

### Build

The sub-package `calc` must be built first !

```shell
calc/build.sh
yarn install
yarn build
```



