# DB Migrations

DB migrations are managed using [TypeORM built-in tools](https://typeorm.io/#/migrations).

Pre-requisite:
* The Postgres Database is up-and-running.  
* The file `ormconfig.json` contains the necessary properties, see [`ormconfig.json.sample`](/ormconfig.json.sample)  

This is the step-by-step sequence to upgrade the database schema:

* Adapt the model with the proper annotations.
* **Build the project.**
* Choose a name for the migration, for instance `MyMigration`.
* Run `yarn typeorm migration:generate ./src/logion/migration/MyMigration` - this will generate a new migration `TIMESTAMP-MyMigration.ts` under [migration](/src/logion/migration).
* (Optional) Modify the generated file.
* Apply the migration(s): `yarn typeorm migration:run`.
* (Optional) Revert the last migration: `yarn typeorm migration:revert`.
