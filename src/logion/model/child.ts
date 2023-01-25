import { WhereExpressionBuilder } from "typeorm/query-builder/WhereExpressionBuilder.js";
import { EntityTarget } from "typeorm/common/EntityTarget.js";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity.js";
import { EntityManager } from "typeorm/entity-manager/EntityManager.js";
import { Log } from "@logion/rest-api-core";

import { HasIndex, order } from "../lib/db/collections.js";

const { logger } = Log;

export abstract class Child {

    public _toAdd?: boolean
    public _toUpdate?: boolean
}

export type IndexedChild = Child & HasIndex;

export interface Parameters<T> {
    children: T[] | undefined,
    entityClass: EntityTarget<T>,
    entityManager: EntityManager,
    whereExpression?: <E extends WhereExpressionBuilder>(sql: E, child: T) => E,
    childrenToDelete?: T[]
    updateValuesExtractor?: (entity: T) => QueryDeepPartialEntity<T>,
}

export async function saveIndexedChildren<T extends IndexedChild>(parameters: Parameters<T>) {
    return saveChildren({
        ...parameters,
        children: order(parameters.children),
    })
}

export async function saveChildren<T extends Child>(parameters: Parameters<T>) {

    const { children, entityClass, entityManager, whereExpression, childrenToDelete, updateValuesExtractor } = parameters;

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

    if(children) {
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
                let extractor = updateValuesExtractor;
                if(!extractor) {
                    extractor = () => child as QueryDeepPartialEntity<T>;
                }
                let update = entityManager.createQueryBuilder(entityClass, "some-alias")
                    .update()
                    .set(extractor(child));
                update = whereExpression(update, child);
                await update.execute();
            }
        }
    }
}

export function deleteChild<T extends Child>(arrayIndex: number, children: T[], childrenToDelete: T[]) {
    const childToDelete = children[arrayIndex];
    childrenToDelete.push(childToDelete)
    children.splice(arrayIndex, 1)
}

export function deleteIndexedChild<T extends IndexedChild>(arrayIndex: number, children: T[], childrenToDelete: T[]) {
    const dbIndex = children[arrayIndex].index!;
    deleteChild(arrayIndex, children, childrenToDelete);
    reindexChildren(dbIndex, children)
}

function reindexChildren<T extends IndexedChild>(dbIndex: number, children: T[]) {
    for (let child of children) {
        if (child.index! > dbIndex) {
            child.index = child.index! - 1;
            child._toUpdate = true;
        }
    }
}
