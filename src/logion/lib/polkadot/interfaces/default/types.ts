// Auto-generated via `yarn polkadot-types-from-defs`, do not edit
/* eslint-disable */

import type { Bytes, Enum, Option, Struct, Vec, bool, u128, u32, u64, u8 } from '@polkadot/types-codec';
import type { AccountId, Balance, Hash, MultiAddress } from '@polkadot/types/interfaces/runtime';
import type { AccountInfoWithDualRefCount } from '@polkadot/types/interfaces/system';
import type { DepositBalance } from '@polkadot/types/interfaces/uniques';

/** @name AccountInfo */
export interface AccountInfo extends AccountInfoWithDualRefCount {}

/** @name Address */
export interface Address extends MultiAddress {}

/** @name AssetDetails */
export interface AssetDetails extends Struct {
  readonly owner: AccountId;
  readonly issuer: AccountId;
  readonly admin: AccountId;
  readonly freezer: AccountId;
  readonly supply: Balance;
  readonly deposit: DepositBalance;
  readonly max_zombies: u32;
  readonly min_balance: Balance;
  readonly zombies: u32;
  readonly accounts: u32;
  readonly is_frozen: bool;
}

/** @name AssetId */
export interface AssetId extends u64 {}

/** @name AssetMetadata */
export interface AssetMetadata extends Struct {
  readonly deposit: DepositBalance;
  readonly name: Bytes;
  readonly symbol: Bytes;
  readonly decimals: u8;
}

/** @name File */
export interface File extends Struct {
  readonly hash: Hash;
  readonly nature: Bytes;
  readonly submitter: AccountId;
}

/** @name LegalOfficerCaseOf */
export interface LegalOfficerCaseOf extends Struct {
  readonly owner: AccountId;
  readonly requester: Requester;
  readonly metadata: Vec<MetadataItem>;
  readonly files: Vec<File>;
  readonly closed: bool;
  readonly loc_type: LocType;
  readonly links: Vec<LocLink>;
  readonly void_info: Option<LocVoidInfo>;
  readonly replacer_of: Option<LocId>;
}

/** @name LocId */
export interface LocId extends u128 {}

/** @name LocLink */
export interface LocLink extends Struct {
  readonly id: LocId;
  readonly nature: Bytes;
}

/** @name LocType */
export interface LocType extends Enum {
  readonly isTransaction: boolean;
  readonly isIdentity: boolean;
  readonly type: 'Transaction' | 'Identity';
}

/** @name LocVoidInfo */
export interface LocVoidInfo extends Struct {
  readonly replacer: Option<LocId>;
}

/** @name LookupSource */
export interface LookupSource extends MultiAddress {}

/** @name MetadataItem */
export interface MetadataItem extends Struct {
  readonly name: Bytes;
  readonly value: Bytes;
  readonly submitter: AccountId;
}

/** @name PeerId */
export interface PeerId extends Bytes {}

/** @name Requester */
export interface Requester extends Enum {
  readonly isNone: boolean;
  readonly isAccount: boolean;
  readonly asAccount: AccountId;
  readonly isLoc: boolean;
  readonly asLoc: LocId;
  readonly type: 'None' | 'Account' | 'Loc';
}

/** @name StorageVersion */
export interface StorageVersion extends Enum {
  readonly isV1: boolean;
  readonly isV2MakeLocVoid: boolean;
  readonly isV3RequesterEnum: boolean;
  readonly isV4ItemSubmitter: boolean;
  readonly type: 'V1' | 'V2MakeLocVoid' | 'V3RequesterEnum' | 'V4ItemSubmitter';
}

/** @name TAssetBalance */
export interface TAssetBalance extends u128 {}

export type PHANTOM_DEFAULT = 'default';
