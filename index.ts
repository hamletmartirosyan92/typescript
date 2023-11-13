import { RecStatus } from '@geeqdev/geeq_capnp_ts/dest/recStatus.capnp';

import { ProxyCreateTxPayloadWrapper } from '../../wrappers/uvt/proxy-create-transaction-payload';
import { ProxyCreateNotaryTxWrapper } from '../../wrappers/uvt/proxy-create-notary-transaction';
import { AcctNumMultiUserWrapper } from '../../wrappers/uvt/account-num-multi-user';
import { ValLayLedgerWrapper } from '../../wrappers/validation-layer-ledger';
import { NodeTxListWrapper } from '../../wrappers/node-transaction-list';
import { NetActorRecWrapper } from '../../wrappers/network-actor-record';
import { AccountHashBuffer } from '../../buffers/account-hash';
import { PublicKeyBuffer } from '../../buffers/public-key';
import { UnverValTxWrapper } from '../../wrappers/uvt';
import { Simulator } from '../../geeq/simulator';
import { Config } from '../../../configs/config';
import { BaseBuffer } from '../../buffers/base';
import { GeeqAmount } from '../../geeq-amount';
import { getNonce, randomAcctNum, randomAppHash } from '../../../helper';
import { GeeqNode } from '../../geeq/node';
import { Crypto } from '../../crypto';
import {
  CreateProxyResult,
  FindNar,
  FindRecordInVll,
  FindUvtResult,
} from './interfaces';
import { NftAssetSubgroupWrapper } from '../../wrappers/coin-account-record/nft-asset-sg';
import { CoinAssetTxWrapper } from '../../wrappers/uvt/coin-asset-transaction';
import { CoinTxPayloadWrapper } from '../../wrappers/uvt/coin-tx-payload';
import { TokenAssetSubgroupsWrapper } from '../../wrappers/coin-account-record/token-asset-sg';

export class UVT {
  private readonly crypto: Crypto;

  private readonly mock: boolean;

  constructor(crypto?: Crypto) {
    this.crypto = crypto !== undefined ? crypto : new Crypto();
    this.mock = Config.getInstance().conf.geeq.mock;
  }

  public async createCoinAssetTx(
    chainNum: number,
    blockNum: number,
    activeNodeNum: number,
    senderNonce: number,
    amount: number,
    senderAccount: Crypto,
    senderId: PublicKeyBuffer,
    receiverIdHash: AccountHashBuffer,
    withToken = false,
    withNft = false,
  ): Promise<UnverValTxWrapper> {
    let tokenAssetSGList: Array<TokenAssetSubgroupsWrapper>;
    if (!withToken) {
      const tokenAmount = 1;
      const tokenName = 'GeeqCoin';
      tokenAssetSGList = [
        TokenAssetSubgroupsWrapper.create(
          tokenAmount,
          tokenName,
        ),
      ];
    }

    let nftAssetSGList: Array<NftAssetSubgroupWrapper>;
    if (withNft) {
      const metaData = randomAppHash();
      const acctNumApp = randomAcctNum();
      nftAssetSGList = [
        NftAssetSubgroupWrapper.create(
          activeNodeNum,
          metaData,
          acctNumApp,
        ),
      ];
    }

    const coinAssetTx = CoinAssetTxWrapper.create(
      senderNonce,
      amount,
      senderId,
      receiverIdHash,
      tokenAssetSGList,
      nftAssetSGList,
    );
    const coinTxPayload = CoinTxPayloadWrapper.create(coinAssetTx);
    const uvt = UnverValTxWrapper.createUvt(
      chainNum,
      blockNum,
      activeNodeNum,
      coinTxPayload,
    );
    // Sign and send tx
    uvt.setContext({ crypto: senderAccount });
    await uvt.computeRefHash();
    const refHash = uvt.getRefHash().toString();
    await uvt.sign();

    return uvt;
  }

  public async createProxy(multiUsersCount = 1): Promise<CreateProxyResult> {
    if (multiUsersCount <= 0) {
      throw new Error('MultiUsers is required !!!');
    }

    const simulator = new Simulator();
    const activeNode = await simulator.getActiveNode();
    const geeqNode = new GeeqNode(activeNode.ip);
    const vll = await geeqNode.getCurrentVll();
    const geeqNodeNumber = vll.getNetworkActors().getNodeByIp(geeqNode.IP).nodeNumber1;

    const accIndexes = Array.from(Array(multiUsersCount + 1).keys());
    const cryptoAccts = [];
    const accountHashes: Array<AccountHashBuffer> = accIndexes.map(() => {
      const cryptoAcct = new Crypto();
      cryptoAccts.push(cryptoAcct);
      return cryptoAcct.hashBuffer(cryptoAcct.getPublicKey(), 32) as AccountHashBuffer;
    });

    const adminAccountHash = accountHashes.shift();

    let users: Array<AcctNumMultiUserWrapper> = [];
    if (multiUsersCount > 0) {
      users = accountHashes.map(
        (userAccHash) => AcctNumMultiUserWrapper.create(userAccHash),
      );
    }

    const proxyNotaryTx = ProxyCreateNotaryTxWrapper.create(
      adminAccountHash,
      users,
    );

    const adminPublicKey = adminAccountHash as PublicKeyBuffer;
    const adminNonce = await getNonce(vll, adminPublicKey);
    const proxyPayload = ProxyCreateTxPayloadWrapper.createNotary(
      adminNonce,
      GeeqAmount.fromGeeqs(3),
      adminAccountHash,
      adminPublicKey,
      proxyNotaryTx,
    );

    const uvt = UnverValTxWrapper.createUvt(
      vll.getChainNumber(),
      vll.getBlockNumber(),
      geeqNodeNumber,
      proxyPayload,
    );

    const adminCrypto = cryptoAccts.pop();
    uvt.setContext({ crypto: adminCrypto });
    uvt.updateState();
    await uvt.sign();

    return {
      uvt: uvt.getBuffer(),
      payload: proxyNotaryTx.getBuffer(),
      adminAccountHash,
      users,
    };
  }

  public async findRecordInVll(
    account: string,
    node: GeeqNode,
    startBlock: number,
    finishBlock = startBlock + 10,
  ): Promise<FindRecordInVll> {
    if (startBlock > finishBlock) {
      return {
        record: undefined,
        vll: undefined,
      };
    }

    try {
      const vll = await node.getVllByBlockNumber(startBlock);

      return {
        record: vll.getValLeyRecById(account),
        vll,
      };
    } catch (e) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return this.findRecordInVll(account, node, startBlock + 1, finishBlock);
    }
  }

  public async findNar(
    node: GeeqNode,
    acctNumReceive: AccountHashBuffer,
    startBlock: number,
    finishBlock = startBlock + 10,
  ): Promise<FindNar> {
    if (startBlock > finishBlock) {
      return {
        nar: undefined,
        vll: undefined,
      };
    }

    let vll: ValLayLedgerWrapper;
    let nar: NetActorRecWrapper;
    try {
      vll = await node.getVllByBlockNumber(startBlock);
      nar = vll.getNetworkActors().getAllNodes()
        .find((node) => node.accountNumVal.toString() === acctNumReceive.toString());
    } catch (e) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    if (nar) {
      return {
        nar,
        vll,
      };
    }

    console.log(`Waiting 4 sec; blockNumber = ${startBlock}`);
    await new Promise((resolve) => setTimeout(resolve, 4000));

    return this.findNar(node, acctNumReceive, startBlock + 1, finishBlock);
  }

  public async findLeavingNar(
    node: GeeqNode,
    acctNumReceive: AccountHashBuffer,
    startBlock: number,
    finishBlock = startBlock + 10,
  ): Promise<FindNar> {
    if (startBlock > finishBlock) {
      return {
        nar: undefined,
        vll: undefined,
      };
    }

    const vll = await node.getVllByBlockNumber(startBlock);
    const nar = vll.getNetworkActors().getAllNodes()
      .find((node) => node.accountNumVal.toString() === acctNumReceive.toString());

    if (nar) {
      if (nar.recordStatus === RecStatus.NET_STATUS_LEAVING) {
        return {
          nar,
          vll,
        };
      }
    }

    console.log(`Waiting 4 sec, blockNum = ${startBlock}`);
    await new Promise((resolve) => setTimeout(resolve, 4000));

    return this.findLeavingNar(node, acctNumReceive, startBlock + 1, finishBlock);
  }

  public async checkLastLeavingNar(
    node: GeeqNode,
    acctNumReceive: AccountHashBuffer,
    lastBlockNum: number,
  ): Promise<NetActorRecWrapper> {
    const currentVll = await node.getCurrentVll();
    if (currentVll.getBlockNumber() === lastBlockNum) {
      const nar = currentVll.getNetworkActors().getAllNodes()
        .find((node) => node.accountNumVal === acctNumReceive);

      if (nar) {
        return nar;
      }

      return undefined;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return this.checkLastLeavingNar(node, acctNumReceive, lastBlockNum);
  }

  public async checkDeletedNar(
    node: GeeqNode,
    acctNumReceive: AccountHashBuffer,
    startBlock: number,
  ): Promise<boolean> {
    const currentVll = await node.getCurrentVll();
    if (currentVll.getBlockNumber() > startBlock + 15) {
      return false;
    }

    if (startBlock + 10 < currentVll.getBlockNumber()) {
      const nar = currentVll.getNetworkActors().getAllNodes()
        .find((node) => node.accountNumVal === acctNumReceive);

      if (!nar) {
        return true;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return this.checkDeletedNar(node, acctNumReceive, startBlock);
  }

  public async checkUutStatus(
    refHash: BaseBuffer,
    node: GeeqNode,
    startBlock: number,
    finishBlock = startBlock + 9,
  ): Promise<boolean> {
    if (startBlock > finishBlock) {
      return undefined;
    }

    let vlb = await node.getVlbByBlockNumber(startBlock);
    if (!vlb) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      vlb = await node.getVlbByBlockNumber(startBlock);

      if (!vlb) {
        return undefined;
      }
    }

    if (vlb.getValidTransaction().find(
      (item) => item.getHash().toString() === refHash.toString(),
    )) {
      return true;
    }
    if (vlb.getInvalidTransaction().find(
      (item) => item.getHash().toString() === refHash.toString(),
    )) {
      return false;
    }

    return this.checkUutStatus(refHash, node, startBlock + 1, finishBlock);
  }

  public async findUvtInVlb(
    uvtTx: UnverValTxWrapper,
    node: GeeqNode,
    startBlock: number,
    finishBlock = startBlock + 9,
  ): Promise<FindUvtResult | undefined> {
    if (startBlock > finishBlock) {
      return undefined;
    }

    let uvt;
    let vlb;
    let ntl;
    let blockNumber;
    try {
      vlb = await node.getVlbByBlockNumber(startBlock);
      ntl = vlb.nodeTxLists.find((ntl: NodeTxListWrapper) => {
        const myUvt = ntl
          .getUvts()
          .find(
            (tx: UnverValTxWrapper) => {
              if (tx.getBuffer().toString() === uvtTx.getBuffer().toString()) {
                uvt = tx;
                blockNumber = startBlock;
              }

              return uvt;
            },
          );

        return myUvt !== undefined;
      });
    } catch (err) {
      console.log(startBlock);
      console.log(err);
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }

    if (!ntl) {
      console.log(`Waiting 4 sec, BlockNumber = ${startBlock}`);
      await new Promise((resolve) => setTimeout(resolve, 4000));

      return this.findUvtInVlb(uvtTx, node, startBlock + 1, finishBlock);
    }

    return {
      uvt,
      blockNumber,
    };
  }
}
