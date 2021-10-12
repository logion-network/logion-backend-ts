import { Repository } from "typeorm";
import { WhereExpressionBuilder } from "typeorm/query-builder/WhereExpressionBuilder";
import { EntityTarget } from "typeorm/common/EntityTarget";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { Log } from "../util/Log";

const { logger } = Log;

export abstract class Child {

    public _toAdd?: boolean
    public _toUpdate?: boolean
}

export interface Parameters<T> {
    children: T[],
    entityClass: EntityTarget<T>,
    repository: Repository<any>,
    whereExpression?: <E extends WhereExpressionBuilder>(sql: E, child: T) => E,
    childrenToDelete?: T[]
}

export async function saveChildren<T extends Child>(parameters: Parameters<T>) {

    const { children, entityClass, repository, whereExpression, childrenToDelete } = parameters;

    if (childrenToDelete) {

        if (!whereExpression) {
            throw new Error("Cannot delete children without proper where-clause.")
        }

        for (const i in childrenToDelete) {
            const child = childrenToDelete[i];
            logger.debug("Deleting child %s", entityClass);
            const deleteQuery = repository.createQueryBuilder()
                .delete()
                .from(entityClass)
            await whereExpression(deleteQuery, child).execute();
        }
    }

    for (const i in children) {
        const child = children[i];
        if (child._toAdd) {
            delete child._toAdd
            logger.debug("Inserting child %s", entityClass);
            await repository.createQueryBuilder()
                .insert()
                .into(entityClass)
                .values(child as QueryDeepPartialEntity<T>)
                .execute();
        } else if (child._toUpdate) {
            if (!whereExpression) {
                throw new Error("Cannot update children without proper where-clause.")
            }
            delete child._toUpdate;
            logger.debug("Updating child %s", entityClass);
            const update = repository.manager.createQueryBuilder(entityClass, "some-alias")
                .update()
                .set(child as QueryDeepPartialEntity<T>)
            await whereExpression(update, child).execute();
        }
    }
}

