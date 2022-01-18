// Auto-generated via `yarn polkadot-types-from-chain`, do not edit
/* eslint-disable */

import type { LocId, PeerId } from '../interfaces/default';
import type { ApiTypes } from '@polkadot/api-base/types';
import type { Bytes, Vec, u16, u32, u8 } from '@polkadot/types-codec';
import type { ITuple } from '@polkadot/types-codec/types';
import type { TAssetBalance } from '@polkadot/types/interfaces/assets';
import type { BalanceStatus } from '@polkadot/types/interfaces/balances';
import type { AuthorityList } from '@polkadot/types/interfaces/grandpa';
import type { ProxyType } from '@polkadot/types/interfaces/proxy';
import type { AccountId, AssetId, Balance, CallHash, Hash } from '@polkadot/types/interfaces/runtime';
import type { SessionIndex } from '@polkadot/types/interfaces/session';
import type { DispatchError, DispatchInfo, DispatchResult } from '@polkadot/types/interfaces/system';
import type { Timepoint } from '@polkadot/types/interfaces/utility';

declare module '@polkadot/api-base/types/events' {
  export interface AugmentedEvents<ApiType extends ApiTypes> {
    assets: {
      /**
       * Some asset `asset_id` was frozen. \[asset_id\]
       **/
      AssetFrozen: AugmentedEvent<ApiType, [AssetId]>;
      /**
       * Some asset `asset_id` was thawed. \[asset_id\]
       **/
      AssetThawed: AugmentedEvent<ApiType, [AssetId]>;
      /**
       * Some assets were destroyed. \[asset_id, owner, balance\]
       **/
      Burned: AugmentedEvent<ApiType, [AssetId, AccountId, TAssetBalance]>;
      /**
       * Some asset class was created. \[asset_id, creator, owner\]
       **/
      Created: AugmentedEvent<ApiType, [AssetId, AccountId, AccountId]>;
      /**
       * An asset class was destroyed.
       **/
      Destroyed: AugmentedEvent<ApiType, [AssetId]>;
      /**
       * Some asset class was force-created. \[asset_id, owner\]
       **/
      ForceCreated: AugmentedEvent<ApiType, [AssetId, AccountId]>;
      /**
       * Some assets was transferred by an admin. \[asset_id, from, to, amount\]
       **/
      ForceTransferred: AugmentedEvent<ApiType, [AssetId, AccountId, AccountId, TAssetBalance]>;
      /**
       * Some account `who` was frozen. \[asset_id, who\]
       **/
      Frozen: AugmentedEvent<ApiType, [AssetId, AccountId]>;
      /**
       * Some assets were issued. \[asset_id, owner, total_supply\]
       **/
      Issued: AugmentedEvent<ApiType, [AssetId, AccountId, TAssetBalance]>;
      /**
       * The maximum amount of zombies allowed has changed. \[asset_id, max_zombies\]
       **/
      MaxZombiesChanged: AugmentedEvent<ApiType, [AssetId, u32]>;
      /**
       * New metadata has been set for an asset. \[asset_id, name, symbol, decimals\]
       **/
      MetadataSet: AugmentedEvent<ApiType, [AssetId, Bytes, Bytes, u8]>;
      /**
       * The owner changed \[asset_id, owner\]
       **/
      OwnerChanged: AugmentedEvent<ApiType, [AssetId, AccountId]>;
      /**
       * The management team changed \[asset_id, issuer, admin, freezer\]
       **/
      TeamChanged: AugmentedEvent<ApiType, [AssetId, AccountId, AccountId, AccountId]>;
      /**
       * Some account `who` was thawed. \[asset_id, who\]
       **/
      Thawed: AugmentedEvent<ApiType, [AssetId, AccountId]>;
      /**
       * Some assets were transferred. \[asset_id, from, to, amount\]
       **/
      Transferred: AugmentedEvent<ApiType, [AssetId, AccountId, AccountId, TAssetBalance]>;
      /**
       * Generic event
       **/
      [key: string]: AugmentedEvent<ApiType>;
    };
    balances: {
      /**
       * A balance was set by root. \[who, free, reserved\]
       **/
      BalanceSet: AugmentedEvent<ApiType, [AccountId, Balance, Balance]>;
      /**
       * Some amount was deposited (e.g. for transaction fees). \[who, deposit\]
       **/
      Deposit: AugmentedEvent<ApiType, [AccountId, Balance]>;
      /**
       * An account was removed whose balance was non-zero but below ExistentialDeposit,
       * resulting in an outright loss. \[account, balance\]
       **/
      DustLost: AugmentedEvent<ApiType, [AccountId, Balance]>;
      /**
       * An account was created with some free balance. \[account, free_balance\]
       **/
      Endowed: AugmentedEvent<ApiType, [AccountId, Balance]>;
      /**
       * Some balance was reserved (moved from free to reserved). \[who, value\]
       **/
      Reserved: AugmentedEvent<ApiType, [AccountId, Balance]>;
      /**
       * Some balance was moved from the reserve of the first account to the second account.
       * Final argument indicates the destination balance type.
       * \[from, to, balance, destination_status\]
       **/
      ReserveRepatriated: AugmentedEvent<ApiType, [AccountId, AccountId, Balance, BalanceStatus]>;
      /**
       * Transfer succeeded. \[from, to, value\]
       **/
      Transfer: AugmentedEvent<ApiType, [AccountId, AccountId, Balance]>;
      /**
       * Some balance was unreserved (moved from reserved to free). \[who, value\]
       **/
      Unreserved: AugmentedEvent<ApiType, [AccountId, Balance]>;
      /**
       * Generic event
       **/
      [key: string]: AugmentedEvent<ApiType>;
    };
    grandpa: {
      /**
       * New authority set has been applied. \[authority_set\]
       **/
      NewAuthorities: AugmentedEvent<ApiType, [AuthorityList]>;
      /**
       * Current authority set has been paused.
       **/
      Paused: AugmentedEvent<ApiType, []>;
      /**
       * Current authority set has been resumed.
       **/
      Resumed: AugmentedEvent<ApiType, []>;
      /**
       * Generic event
       **/
      [key: string]: AugmentedEvent<ApiType>;
    };
    loAuthorityList: {
      /**
       * Issued when an LO is added to the list. [accountId]
       **/
      LoAdded: AugmentedEvent<ApiType, [AccountId]>;
      /**
       * Issued when an LO is removed from the list. [accountId]
       **/
      LoRemoved: AugmentedEvent<ApiType, [AccountId]>;
      /**
       * Generic event
       **/
      [key: string]: AugmentedEvent<ApiType>;
    };
    logionLoc: {
      /**
       * Issued when LOC is closed. [locId]
       **/
      LocClosed: AugmentedEvent<ApiType, [LocId]>;
      /**
       * Issued upon LOC creation. [locId]
       **/
      LocCreated: AugmentedEvent<ApiType, [LocId]>;
      /**
       * Issued when LOC is made void. [locId]
       **/
      LocVoid: AugmentedEvent<ApiType, [LocId]>;
      /**
       * Generic event
       **/
      [key: string]: AugmentedEvent<ApiType>;
    };
    multisig: {
      /**
       * A multisig operation has been approved by someone.
       * \[approving, timepoint, multisig, call_hash\]
       **/
      MultisigApproval: AugmentedEvent<ApiType, [AccountId, Timepoint, AccountId, CallHash]>;
      /**
       * A multisig operation has been cancelled. \[cancelling, timepoint, multisig, call_hash\]
       **/
      MultisigCancelled: AugmentedEvent<ApiType, [AccountId, Timepoint, AccountId, CallHash]>;
      /**
       * A multisig operation has been executed. \[approving, timepoint, multisig, call_hash\]
       **/
      MultisigExecuted: AugmentedEvent<ApiType, [AccountId, Timepoint, AccountId, CallHash, DispatchResult]>;
      /**
       * A new multisig operation has begun. \[approving, multisig, call_hash\]
       **/
      NewMultisig: AugmentedEvent<ApiType, [AccountId, AccountId, CallHash]>;
      /**
       * Generic event
       **/
      [key: string]: AugmentedEvent<ApiType>;
    };
    nodeAuthorization: {
      /**
       * The given claim was removed by its owner.
       **/
      ClaimRemoved: AugmentedEvent<ApiType, [PeerId, AccountId]>;
      /**
       * The allowed connections were added to a node.
       **/
      ConnectionsAdded: AugmentedEvent<ApiType, [PeerId, Vec<PeerId>]>;
      /**
       * The allowed connections were removed from a node.
       **/
      ConnectionsRemoved: AugmentedEvent<ApiType, [PeerId, Vec<PeerId>]>;
      /**
       * The given well known node was added.
       **/
      NodeAdded: AugmentedEvent<ApiType, [PeerId, AccountId]>;
      /**
       * The given node was claimed by a user.
       **/
      NodeClaimed: AugmentedEvent<ApiType, [PeerId, AccountId]>;
      /**
       * The given well known node was removed.
       **/
      NodeRemoved: AugmentedEvent<ApiType, [PeerId]>;
      /**
       * The given well known nodes were reset.
       **/
      NodesReset: AugmentedEvent<ApiType, [Vec<ITuple<[PeerId, AccountId]>>]>;
      /**
       * The given well known node was swapped; first item was removed,
       * the latter was added.
       **/
      NodeSwapped: AugmentedEvent<ApiType, [PeerId, PeerId]>;
      /**
       * The node was transferred to another account.
       **/
      NodeTransferred: AugmentedEvent<ApiType, [PeerId, AccountId]>;
      /**
       * Generic event
       **/
      [key: string]: AugmentedEvent<ApiType>;
    };
    proxy: {
      /**
       * An announcement was placed to make a call in the future. \[real, proxy, call_hash\]
       **/
      Announced: AugmentedEvent<ApiType, [AccountId, AccountId, Hash]>;
      /**
       * Anonymous account has been created by new proxy with given
       * disambiguation index and proxy type. \[anonymous, who, proxy_type, disambiguation_index\]
       **/
      AnonymousCreated: AugmentedEvent<ApiType, [AccountId, AccountId, ProxyType, u16]>;
      /**
       * A proxy was executed correctly, with the given \[result\].
       **/
      ProxyExecuted: AugmentedEvent<ApiType, [DispatchResult]>;
      /**
       * Generic event
       **/
      [key: string]: AugmentedEvent<ApiType>;
    };
    recovery: {
      /**
       * Lost account has been successfully recovered by rescuer account.
       * \[lost, rescuer\]
       **/
      AccountRecovered: AugmentedEvent<ApiType, [AccountId, AccountId]>;
      /**
       * A recovery process for lost account by rescuer account has been closed.
       * \[lost, rescuer\]
       **/
      RecoveryClosed: AugmentedEvent<ApiType, [AccountId, AccountId]>;
      /**
       * A recovery process has been set up for an \[account\].
       **/
      RecoveryCreated: AugmentedEvent<ApiType, [AccountId]>;
      /**
       * A recovery process has been initiated for lost account by rescuer account.
       * \[lost, rescuer\]
       **/
      RecoveryInitiated: AugmentedEvent<ApiType, [AccountId, AccountId]>;
      /**
       * A recovery process has been removed for an \[account\].
       **/
      RecoveryRemoved: AugmentedEvent<ApiType, [AccountId]>;
      /**
       * A recovery process for lost account by rescuer account has been vouched for by sender.
       * \[lost, rescuer, sender\]
       **/
      RecoveryVouched: AugmentedEvent<ApiType, [AccountId, AccountId, AccountId]>;
      /**
       * Generic event
       **/
      [key: string]: AugmentedEvent<ApiType>;
    };
    session: {
      /**
       * New session has happened. Note that the argument is the \[session_index\], not the block
       * number as the type might suggest.
       **/
      NewSession: AugmentedEvent<ApiType, [SessionIndex]>;
      /**
       * Generic event
       **/
      [key: string]: AugmentedEvent<ApiType>;
    };
    sudo: {
      /**
       * The \[sudoer\] just switched identity; the old key is supplied.
       **/
      KeyChanged: AugmentedEvent<ApiType, [AccountId]>;
      /**
       * A sudo just took place. \[result\]
       **/
      Sudid: AugmentedEvent<ApiType, [DispatchResult]>;
      /**
       * A sudo just took place. \[result\]
       **/
      SudoAsDone: AugmentedEvent<ApiType, [DispatchResult]>;
      /**
       * Generic event
       **/
      [key: string]: AugmentedEvent<ApiType>;
    };
    system: {
      /**
       * `:code` was updated.
       **/
      CodeUpdated: AugmentedEvent<ApiType, []>;
      /**
       * An extrinsic failed. \[error, info\]
       **/
      ExtrinsicFailed: AugmentedEvent<ApiType, [DispatchError, DispatchInfo]>;
      /**
       * An extrinsic completed successfully. \[info\]
       **/
      ExtrinsicSuccess: AugmentedEvent<ApiType, [DispatchInfo]>;
      /**
       * An \[account\] was reaped.
       **/
      KilledAccount: AugmentedEvent<ApiType, [AccountId]>;
      /**
       * A new \[account\] was created.
       **/
      NewAccount: AugmentedEvent<ApiType, [AccountId]>;
      /**
       * Generic event
       **/
      [key: string]: AugmentedEvent<ApiType>;
    };
    validatorSet: {
      ValidatorAdded: AugmentedEvent<ApiType, [AccountId]>;
      ValidatorRemoved: AugmentedEvent<ApiType, [AccountId]>;
      /**
       * Generic event
       **/
      [key: string]: AugmentedEvent<ApiType>;
    };
    verifiedRecovery: {
      /**
       * Generic event
       **/
      [key: string]: AugmentedEvent<ApiType>;
    };
  } // AugmentedEvents
} // declare module
