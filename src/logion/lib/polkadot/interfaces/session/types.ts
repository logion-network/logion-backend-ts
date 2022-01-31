// Auto-generated via `yarn polkadot-types-from-defs`, do not edit
/* eslint-disable */

import type { Bytes, Struct, Vec, u32 } from '@polkadot/types-codec';
import type { ITuple } from '@polkadot/types-codec/types';
import type { AccountId, ValidatorId } from '@polkadot/types/interfaces/runtime';
import type { Exposure } from '@polkadot/types/interfaces/staking';

/** @name FullIdentification */
export interface FullIdentification extends Exposure {}

/** @name IdentificationTuple */
export interface IdentificationTuple extends ITuple<[ValidatorId, FullIdentification]> {}

/** @name Keys */
export interface Keys extends SessionKeys2 {}

/** @name MembershipProof */
export interface MembershipProof extends Struct {
  readonly session: SessionIndex;
  readonly trieNodes: Vec<Bytes>;
  readonly validatorCount: ValidatorCount;
}

/** @name SessionIndex */
export interface SessionIndex extends u32 {}

/** @name SessionKeys2 */
export interface SessionKeys2 extends ITuple<[AccountId, AccountId]> {}

/** @name ValidatorCount */
export interface ValidatorCount extends u32 {}

export type PHANTOM_SESSION = 'session';
