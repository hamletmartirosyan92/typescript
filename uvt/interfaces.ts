import { AcctNumMultiUserWrapper } from '../../wrappers/uvt/account-num-multi-user';
import { ValLayRecWrapper } from '../../wrappers/validation-layer-record';
import { ValLayLedgerWrapper } from '../../wrappers/validation-layer-ledger';
import { NetActorRecWrapper } from '../../wrappers/network-actor-record';
import { AccountHashBuffer } from '../../buffers/account-hash';
import { UnverValTxWrapper } from '../../wrappers/uvt';
import { BaseBuffer } from '../../buffers/base';

export interface CreateProxyResult {
  uvt: BaseBuffer,
  payload: BaseBuffer,
  adminAccountHash: AccountHashBuffer,
  users: Array<AcctNumMultiUserWrapper>
}

export interface FindRecordInVll {
  record: ValLayRecWrapper,
  vll: ValLayLedgerWrapper,
}

export interface FindNar {
  nar: NetActorRecWrapper,
  vll: ValLayLedgerWrapper,
}

export interface FindUvtResult {
  uvt: UnverValTxWrapper,
  blockNumber: number,
}
