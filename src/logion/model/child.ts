import { WhereExpressionBuilder } from "typeorm/query-builder/WhereExpressionBuilder";
import { EntityTarget } from "typeorm/common/EntityTarget";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { Log } from "../util/Log";
import { EntityManager } from "typeorm/entity-manager/EntityManager";
import { HasIndex } from "../lib/db/collections";

const { logger } = Log;

export abstract class Child {

    public _toAdd?: boolean
    public _toUpdate?: boolean
}

export interface Parameters<T> {
    children: T[],
    entityClass: EntityTarget<T>,
    entityManager: EntityManager,
    whereExpression?: <E extends WhereExpressionBuilder>(sql: E, child: T) => E,
    childrenToDelete?: T[]
}

export async function saveChildren<T extends Child>(parameters: Parameters<T>) {

    const { children, entityClass, entityManager, whereExpression, childrenToDelete } = parameters;

    if (childrenToDelete) {

        if (!whereExpression) {
            throw new Error("Cannot delete children without proper where-clause.")
        }

        for (const i in childrenToDelete) {
            const child = childrenToDelete[i];
            logger.debug("Deleting child %s", entityClass);
            const deleteQuery = entityManager.createQueryBuilder()
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
            await entityManager.createQueryBuilder()
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
            const update = entityManager.createQueryBuilder(entityClass, "some-alias")
                .update()
                .set(child as QueryDeepPartialEntity<T>)
            await whereExpression(update, child).execute();
        }
    }
}

export function deleteChild<T extends Child>(childToDeleteIndex: number, children: T[], childrenToDelete: T[]) {
    const childToDelete = children[childToDeleteIndex];
    childrenToDelete.push(childToDelete)
    children.splice(childToDeleteIndex, 1)
}

export function deleteIndexedChild<T extends Child & HasIndex>(childToDeleteIndex: number, children: T[], childrenToDelete: T[]) {
    deleteChild(childToDeleteIndex, children, childrenToDelete)
    reindexChildren(childToDeleteIndex, children)
}

function reindexChildren<T extends Child & HasIndex>(deletedChildIndex: number, children: T[]) {
    for (let i = deletedChildIndex; i < children.length; ++i) {
        const child: T = children[i];
        child.index = child.index! - 1;
        child._toUpdate = true;
    }
}
