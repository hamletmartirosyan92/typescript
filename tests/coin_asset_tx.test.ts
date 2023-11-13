// ************ THIS IS JUST EXAMPLE ************

import something ....

jest.setTimeout(10 ** 9);

describe('COIN_ASSET_TX', () => {
  const case1 = 'C429 .... ';
  const case2 = 'C430 .... ';
  const case3 = 'C431 .... ';
  const case4 = 'C432 .... ';
  const case5 = 'C434 .... ';
  const case6 = 'C461 .... ';
  const case7 = 'C462 .... ';

  it(case1, async () => {
    // Precondition ====================================================================================================
    const simulator = new Simulator();

    const nodes = await simulator.getActiveNodes();
    const [activeNode] = nodes;
    expect(activeNode).toBeDefined();

    const geeqNode = new GeeqNode(activeNode.ip);
    const vll = await geeqNode.getCurrentVll();
    const activeNodeNum = vll.getNetworkActors().getNodeByIp(activeNode.ip).nodeNumber1;

    const chainNumber = vll.getChainNumber();
    const blockNumber = vll.getBlockNumber() + 1;

    const index1 = 1;
    const index2 = 2;

    const senderAccount = await simulator.getCoinAccount(index1);
    const receiverAccount = await simulator.getCoinAccount(index2);

    const senderId = senderAccount.getPublicKey();
    const receiverId = receiverAccount.getPublicKey();

    const nonce1 = await getNonce(vll, senderId);
    const nonce2 = await getNonce(vll, receiverId);

    const senderIdHash = senderAccount.hashBuffer(senderId) as AccountHashBuffer;
    const receiverIdHash = receiverAccount.hashBuffer(receiverId) as AccountHashBuffer;

    const senderBeforeTransfer = vll.getValLeyRecById(senderIdHash.toString()).getRecord() as CoinAcctRecWrapper;
    const receiverBeforeTransfer = vll.getValLeyRecById(receiverIdHash.toString()).getRecord() as CoinAcctRecWrapper;

    // WebSocket client connection
    const client = new GeeqWebSocket(activeNode.ip);
    await client.sendSubscriberEvent([senderId]);
    await client.sendListenEvent(blockNumber);

    // Step 1 ==========================================================================================================
    // Creating COIN_ASSET_TX
    const amount = 1;
    const coinAssetTx = CoinAssetTxWrapper.create(
      nonce1,
      amount,
      senderId,
      receiverIdHash,
      [],
      [],
    );
    const coinTxPayload = CoinTxPayloadWrapper.create(coinAssetTx);
    const uvt = UnverValTxWrapper.createUvt(
      chainNumber,
      blockNumber,
      activeNodeNum,
      coinTxPayload,
    );
    // Sign and send tx
    uvt.setContext({ crypto: senderAccount });
    await uvt.computeRefHash();
    const refHash = uvt.getRefHash().toString();
    await uvt.sign();
    const response = await geeqNode.sendUvt(uvt);
    expect(response.errorMessage).toBeUndefined();

    // Step 2 ==========================================================================================================
    return new Promise<void>(async (resolve, reject) => {
      const uutPayload = await new Promise<UutStatus>((resolve, reject) => {
        const timer = setTimeout(() => reject(), 30000);

        client.on(Events.uutStatus, (payload) => {
          if (payload.refHash === refHash) {
            clearTimeout(timer);
            resolve(payload);
          }
        });
      });

      try {
        expect(uutPayload.publicKey).toEqual(senderId.toString());
        expect(uutPayload.refHash).toEqual(uvt.getRefHash().toString());
        expect(uutPayload.blockNumber).toEqual(blockNumber);
        expect(uutPayload.status).toEqual(EventStatus.valid);
        expect(uutPayload.isValid).toBeTruthy();
        expect(uutPayload.error).toBe('');

        const currentVll = await geeqNode.getCurrentVll();

        const senderAfterTransfer = currentVll.getValLeyRecById(senderIdHash.toString()).getRecord();
        const receiverAfterTransfer = currentVll.getValLeyRecById(receiverIdHash.toString()).getRecord();

        expect(senderAfterTransfer).toBeDefined();
        expect(receiverAfterTransfer).toBeDefined();

        const amount1 = (senderAfterTransfer as CoinAcctRecWrapper).amountBalance.toNumber();
        const amount2 = (receiverAfterTransfer as CoinAcctRecWrapper).amountBalance.toNumber();

        expect(amount1).toEqual(senderBeforeTransfer.amountBalance.toNumber() - amount);
        expect(amount2).toEqual(receiverBeforeTransfer.amountBalance.toNumber() + amount);

        expect(senderAfterTransfer.getNonce()).toEqual(nonce1 + 1);
        expect(receiverAfterTransfer.getNonce()).toEqual(nonce2);

        client.close();
        resolve();
      } catch (e) {
        client.close();
        reject(e);
      }
    });
  });

  // case2,3,4 should be tested after 3-rd milestone
  it.skip(case2, async () => {
    // Precondition ====================================================================================================
    const simulator = new Simulator();

    const nodes = await simulator.getActiveNodes();
    const [activeNode] = nodes;
    expect(activeNode).toBeDefined();

    const geeqNode = new GeeqNode(activeNode.ip);
    const vll = await geeqNode.getCurrentVll();
    const activeNodeNum = vll.getNetworkActors().getNodeByIp(activeNode.ip).nodeNumber1;

    const chainNumber = vll.getChainNumber();
    const blockNumber = vll.getBlockNumber() + 1;

    const index1 = 2;
    const index2 = 1;

    const senderAccount = await simulator.getCoinAccount(index1);
    const receiverAccount = await simulator.getCoinAccount(index2);

    const senderId = senderAccount.getPublicKey();
    const receiverId = receiverAccount.getPublicKey();

    const nonce1 = await getNonce(vll, senderId);
    const nonce2 = await getNonce(vll, receiverId);

    const senderIdHash = senderAccount.hashBuffer(senderId) as AccountHashBuffer;
    const receiverIdHash = receiverAccount.hashBuffer(receiverId) as AccountHashBuffer;

    const senderBeforeTransfer = vll
      .getValLeyRecById(senderIdHash.toString()).getRecord() as CoinAcctRecWrapper;
    const receiverBeforeTransfer = vll
      .getValLeyRecById(receiverIdHash.toString()).getRecord() as CoinAcctRecWrapper;

    // WebSocket client connection
    const client = new GeeqWebSocket(activeNode.ip);
    await client.sendSubscriberEvent([senderId]);
    await client.sendListenEvent(blockNumber);

    // Step 1 ==========================================================================================================
    // Creating COIN_ASSET_TX
    const coinAmount = 1;
    const tokenAmount = 2;
    const tokenName = 'GeeqCoin';
    const tokenAssetSG = TokenAssetSubgroupsWrapper.create(tokenAmount, tokenName);

    const coinAssetTx = CoinAssetTxWrapper.create(
      nonce1,
      coinAmount,
      senderId,
      receiverIdHash,
      [tokenAssetSG],
      [],
    );
    const coinTxPayload = CoinTxPayloadWrapper.create(coinAssetTx);
    const uvt = UnverValTxWrapper.createUvt(
      chainNumber,
      blockNumber,
      activeNodeNum,
      coinTxPayload,
    );
    // Sign and send tx
    uvt.setContext({ crypto: senderAccount });
    await uvt.computeRefHash();
    const refHash = uvt.getRefHash().toString();
    await uvt.sign();
    const response = await geeqNode.sendUvt(uvt);
    expect(response.errorMessage).toBeUndefined();

    // Step 2 ==========================================================================================================
    return new Promise<void>(async (resolve, reject) => {
      const uutPayload = await new Promise<UutStatus>((resolve, reject) => {
        const timer = setTimeout(() => reject(), 30000);

        client.on(Events.uutStatus, (payload) => {
          if (payload.refHash === refHash) {
            clearTimeout(timer);
            resolve(payload);
          }
        });
      });

      try {
        expect(uutPayload.publicKey).toEqual(senderId.toString());
        expect(uutPayload.refHash).toEqual(uvt.getRefHash().toString());
        expect(uutPayload.blockNumber).toEqual(blockNumber);
        expect(uutPayload.status).toEqual(EventStatus.valid);
        expect(uutPayload.isValid).toBeTruthy();
        expect(uutPayload.error).toBeUndefined();

        const currentVll = await geeqNode.getCurrentVll();

        const senderAfterTransfer = currentVll
          .getValLeyRecById(senderIdHash.toString()).getRecord() as CoinAcctRecWrapper;
        const receiverAfterTransfer = currentVll
          .getValLeyRecById(receiverIdHash.toString()).getRecord() as CoinAcctRecWrapper;

        expect(senderAfterTransfer).toBeDefined();
        expect(receiverAfterTransfer).toBeDefined();

        const amount1 = senderAfterTransfer.amountBalance.toNumber();
        const amount2 = receiverAfterTransfer.amountBalance.toNumber();

        expect(amount1).toEqual(senderBeforeTransfer.amountBalance.toNumber() - coinAmount);
        expect(amount2).toEqual(receiverBeforeTransfer.amountBalance.toNumber() + coinAmount);

        expect(senderAfterTransfer.getNonce()).toEqual(nonce1 + 1);
        expect(receiverAfterTransfer.getNonce()).toEqual(nonce2);

        // TokenAssetSG should be transferred
        const receiverTokenList = (receiverAfterTransfer.getRecord() as CoinAssetRecordWrapper).tokenAssetList;
        const [receiverToken] = receiverTokenList;
        expect(receiverTokenList.length).toBeGreaterThan(0);
        expect(receiverToken.getAmtToken()).toEqual(tokenAmount);
        expect(receiverToken.getTokenName()).toEqual(tokenName);

        client.close();
        resolve();
      } catch (e) {
        client.close();
        reject(e);
      }
    });
  });

  it.skip(case3, async () => {
    // Precondition ====================================================================================================
    const simulator = new Simulator();

    const nodes = await simulator.getActiveNodes();
    const [activeNode] = nodes;
    expect(activeNode).toBeDefined();

    const geeqNode = new GeeqNode(activeNode.ip);
    const vll = await geeqNode.getCurrentVll();
    const activeNodeNum = vll.getNetworkActors().getNodeByIp(activeNode.ip).nodeNumber1;

    const chainNumber = vll.getChainNumber();
    const blockNumber = vll.getBlockNumber() + 1;

    const index1 = 1;
    const index2 = 2;

    const senderAccount = await simulator.getCoinAccount(index1);
    const receiverAccount = await simulator.getCoinAccount(index2);

    const senderId = senderAccount.getPublicKey();
    const receiverId = receiverAccount.getPublicKey();

    const nonce1 = await getNonce(vll, senderId);
    const nonce2 = await getNonce(vll, receiverId);

    const senderIdHash = senderAccount.hashBuffer(senderId) as AccountHashBuffer;
    const receiverIdHash = receiverAccount.hashBuffer(receiverId) as AccountHashBuffer;

    const senderBeforeTransfer = vll
      .getValLeyRecById(senderIdHash.toString()).getRecord() as CoinAcctRecWrapper;
    const receiverBeforeTransfer = vll
      .getValLeyRecById(receiverIdHash.toString()).getRecord() as CoinAcctRecWrapper;

    // WebSocket client connection
    const client = new GeeqWebSocket(activeNode.ip);
    await client.sendSubscriberEvent([senderId]);
    await client.sendListenEvent(blockNumber);

    // Step 1 ==========================================================================================================
    // Creating COIN_ASSET_TX
    // Params
    const metaData = randomAppHash();
    const acctNumApp = randomAcctNum();
    const nftAssetSG = NftAssetSubgroupWrapper.create(
      activeNodeNum,
      metaData,
      acctNumApp,
    );
    const amount = 1;

    const coinAssetTx = CoinAssetTxWrapper.create(
      nonce1,
      amount,
      senderId,
      receiverIdHash,
      [],
      [nftAssetSG],
    );
    const coinTxPayload = CoinTxPayloadWrapper.create(coinAssetTx);
    const uvt = UnverValTxWrapper.createUvt(
      chainNumber,
      blockNumber,
      activeNodeNum,
      coinTxPayload,
    );
    // Sign and send tx
    uvt.setContext({ crypto: senderAccount });
    await uvt.computeRefHash();
    const refHash = uvt.getRefHash().toString();
    await uvt.sign();
    const response = await geeqNode.sendUvt(uvt);
    expect(response.errorMessage).toBeUndefined();

    // Step 2 ==========================================================================================================
    return new Promise<void>(async (resolve, reject) => {
      const uutPayload = await new Promise<UutStatus>((resolve, reject) => {
        const timer = setTimeout(() => reject(), 30000);

        client.on(Events.uutStatus, (payload) => {
          if (payload.refHash === refHash) {
            clearTimeout(timer);
            resolve(payload);
          }
        });
      });

      try {
        expect(uutPayload.publicKey).toEqual(senderId.toString());
        expect(uutPayload.refHash).toEqual(uvt.getRefHash().toString());
        expect(uutPayload.blockNumber).toEqual(blockNumber);
        expect(uutPayload.status).toEqual(EventStatus.valid);
        expect(uutPayload.isValid).toBeTruthy();
        expect(uutPayload.error).toBeUndefined();

        const currentVll = await geeqNode.getCurrentVll();

        const senderAfterTransfer = currentVll
          .getValLeyRecById(senderIdHash.toString()).getRecord() as CoinAcctRecWrapper;
        const receiverAfterTransfer = currentVll
          .getValLeyRecById(receiverIdHash.toString()).getRecord() as CoinAcctRecWrapper;

        expect(senderAfterTransfer).toBeDefined();
        expect(receiverAfterTransfer).toBeDefined();

        const amount1 = senderAfterTransfer.amountBalance.toNumber();
        const amount2 = receiverAfterTransfer.amountBalance.toNumber();

        expect(amount1).toEqual(senderBeforeTransfer.amountBalance.toNumber() - amount);
        expect(amount2).toEqual(receiverBeforeTransfer.amountBalance.toNumber() + amount);

        expect(senderAfterTransfer.getNonce()).toEqual(nonce1 + 1);
        expect(receiverAfterTransfer.getNonce()).toEqual(nonce2);

        // NftAssetSG should be transferred
        const receiverNftList = (receiverAfterTransfer.getRecord() as CoinAssetRecordWrapper).nftAssetList;
        const [receiverNft] = receiverNftList;

        expect(receiverNftList.length).toBeGreaterThan(0);
        expect(receiverNft.nodeNumber).toEqual(activeNodeNum);
        expect(receiverNft.meta).toEqual(metaData);
        expect(receiverNft.accountNum).toEqual(acctNumApp);

        client.close();
        resolve();
      } catch (e) {
        client.close();
        reject(e);
      }
    });
  });

  it.skip(case4, async () => {
    // Precondition ====================================================================================================
    const simulator = new Simulator();

    const nodes = await simulator.getActiveNodes();
    const [activeNode] = nodes;
    expect(activeNode).toBeDefined();

    const geeqNode = new GeeqNode(activeNode.ip);
    const vll = await geeqNode.getCurrentVll();
    const activeNodeNum = vll.getNetworkActors().getNodeByIp(activeNode.ip).nodeNumber1;

    const chainNumber = vll.getChainNumber();
    const blockNumber = vll.getBlockNumber() + 1;

    const index1 = 2;
    const index2 = 1;

    const senderAccount = await simulator.getCoinAccount(index1);
    const receiverAccount = await simulator.getCoinAccount(index2);

    const senderId = senderAccount.getPublicKey();
    const receiverId = receiverAccount.getPublicKey();

    const nonce1 = await getNonce(vll, senderId);
    const nonce2 = await getNonce(vll, receiverId);

    const senderIdHash = senderAccount.hashBuffer(senderId) as AccountHashBuffer;
    const receiverIdHash = receiverAccount.hashBuffer(receiverId) as AccountHashBuffer;

    const senderBeforeTransfer = vll
      .getValLeyRecById(senderIdHash.toString()).getRecord() as CoinAcctRecWrapper;
    const receiverBeforeTransfer = vll
      .getValLeyRecById(receiverIdHash.toString()).getRecord() as CoinAcctRecWrapper;

    // WebSocket client connection
    const client = new GeeqWebSocket(activeNode.ip);
    await client.sendSubscriberEvent([senderId]);
    await client.sendListenEvent(blockNumber);

    // Step 1 ==========================================================================================================
    // Creating COIN_ASSET_TX
    // TokenAsset
    const coinAmount = 1;
    const tokenAmount = 2;
    const tokenName = 'BombasticCoin';
    const tokenAssetSG = TokenAssetSubgroupsWrapper.create(tokenAmount, tokenName);
    // NftAsset
    const metaData = randomAppHash();
    const acctNumApp = randomAcctNum();
    const nftAssetSG = NftAssetSubgroupWrapper.create(
      activeNodeNum,
      metaData,
      acctNumApp,
    );

    const coinAssetTx = CoinAssetTxWrapper.create(
      nonce1,
      coinAmount,
      senderId,
      receiverIdHash,
      [tokenAssetSG],
      [nftAssetSG],
    );
    const coinTxPayload = CoinTxPayloadWrapper.create(coinAssetTx);
    const uvt = UnverValTxWrapper.createUvt(
      chainNumber,
      blockNumber,
      activeNodeNum,
      coinTxPayload,
    );
    // Sign and send tx
    uvt.setContext({ crypto: senderAccount });
    await uvt.computeRefHash();
    const refHash = uvt.getRefHash().toString();
    await uvt.sign();
    const response = await geeqNode.sendUvt(uvt);
    expect(response.errorMessage).toBeUndefined();

    // Step 2 ==========================================================================================================
    return new Promise<void>(async (resolve, reject) => {
      const uutPayload = await new Promise<UutStatus>((resolve, reject) => {
        const timer = setTimeout(() => reject(), 30000);

        client.on(Events.uutStatus, (payload) => {
          if (payload.refHash === refHash) {
            clearTimeout(timer);
            resolve(payload);
          }
        });
      });

      try {
        expect(uutPayload.publicKey).toEqual(senderId.toString());
        expect(uutPayload.refHash).toEqual(uvt.getRefHash().toString());
        expect(uutPayload.blockNumber).toEqual(blockNumber);
        expect(uutPayload.status).toEqual(EventStatus.valid);
        expect(uutPayload.isValid).toBeTruthy();
        expect(uutPayload.error).toBeUndefined();

        const currentVll = await geeqNode.getCurrentVll();

        const senderAfterTransfer = currentVll
          .getValLeyRecById(senderIdHash.toString()).getRecord() as CoinAcctRecWrapper;
        const receiverAfterTransfer = currentVll
          .getValLeyRecById(receiverIdHash.toString()).getRecord() as CoinAcctRecWrapper;

        expect(senderAfterTransfer).toBeDefined();
        expect(receiverAfterTransfer).toBeDefined();

        const amount1 = senderAfterTransfer.amountBalance.toNumber();
        const amount2 = receiverAfterTransfer.amountBalance.toNumber();

        expect(amount1).toEqual(senderBeforeTransfer.amountBalance.toNumber() - coinAmount);
        expect(amount2).toEqual(receiverBeforeTransfer.amountBalance.toNumber() + coinAmount);

        expect(senderAfterTransfer.getNonce()).toEqual(nonce1 + 1);
        expect(receiverAfterTransfer.getNonce()).toEqual(nonce2);

        // TokenAssetSG should be transferred
        const receiverTokenList = (receiverAfterTransfer.getRecord() as CoinAssetRecordWrapper).tokenAssetList;
        const [receiverToken] = receiverTokenList;
        expect(receiverTokenList.length).toBeGreaterThan(0);
        expect(receiverToken.getAmtToken()).toEqual(tokenAmount);
        expect(receiverToken.getTokenName()).toEqual(tokenName);

        // NftAssetSG should be transferred
        const receiverNftList = (receiverAfterTransfer.getRecord() as CoinAssetRecordWrapper).nftAssetList;
        const [receiverNft] = receiverNftList;
        expect(receiverNftList.length).toBeGreaterThan(0);
        expect(receiverNft.nodeNumber).toEqual(activeNodeNum);
        expect(receiverNft.meta).toEqual(metaData);
        expect(receiverNft.accountNum).toEqual(acctNumApp);

        client.close();
        resolve();
      } catch (e) {
        client.close();
        reject(e);
      }
    });
  });

  // Skipped by BUG: https://geeq.atlassian.net/browse/TC-2074
  it.skip(case5, async () => {
    // Precondition ====================================================================================================
    const simulator = new Simulator();

    const nodes = await simulator.getActiveNodes();
    const [activeNode] = nodes;
    expect(activeNode).toBeDefined();

    const geeqNode = new GeeqNode(activeNode.ip);
    const vll = await geeqNode.getCurrentVll();
    const activeNodeNum = vll.getNetworkActors().getNodeByIp(activeNode.ip).nodeNumber1;

    const chainNumber = vll.getChainNumber();
    const blockNumber = vll.getBlockNumber() + 1;

    const index1 = 3;
    const index2 = 2;

    const senderAccount = await simulator.getCoinAccount(index1);
    const receiverAccount = await simulator.getCoinAccount(index2);

    const senderId = senderAccount.getPublicKey();
    const receiverId = receiverAccount.getPublicKey();

    const nonce1 = await getNonce(vll, senderId);

    const senderIdHash = senderAccount.hashBuffer(senderId) as AccountHashBuffer;
    const receiverIdHash = receiverAccount.hashBuffer(receiverId) as AccountHashBuffer;

    const senderBefore = vll.getValLeyRecById(senderIdHash.toString()).getRecord() as CoinAcctRecWrapper;
    const receiverBefore = vll.getValLeyRecById(receiverIdHash.toString()).getRecord() as CoinAcctRecWrapper;

    // WebSocket client connection
    const client = new GeeqWebSocket(activeNode.ip);
    await client.sendSubscriberEvent([senderId]);
    await client.sendListenEvent(blockNumber);

    // Step 1 ==========================================================================================================
    // Creating COIN_ASSET_TX
    const amount = senderBefore.amountBalance.toNumber() + 1;
    const coinAssetTx = CoinAssetTxWrapper.create(
      nonce1,
      amount,
      senderId,
      receiverIdHash,
      [],
      [],
    );
    const coinTxPayload = CoinTxPayloadWrapper.create(coinAssetTx);
    const uvt = UnverValTxWrapper.createUvt(
      chainNumber,
      blockNumber,
      activeNodeNum,
      coinTxPayload,
    );
    // Sign and send the UVT to process
    uvt.setContext({ crypto: senderAccount });
    await uvt.computeRefHash();
    const refHash = uvt.getRefHash().toString();
    await uvt.sign();
    const response = await geeqNode.sendUvt(uvt);
    expect(response.errorMessage).toBeUndefined();

    // Step 2 ==========================================================================================================
    return new Promise<void>(async (resolve, reject) => {
      const uutPayload = await new Promise<UutStatus>((resolve, reject) => {
        const timer = setTimeout(() => reject(), 30000);

        client.on(Events.uutStatus, (payload) => {
          if (payload.refHash === refHash) {
            clearTimeout(timer);
            resolve(payload);
          }
        });
      });

      try {
        expect(uutPayload.publicKey).toEqual(senderId.toString());
        expect(uutPayload.refHash).toEqual(refHash);
        expect(uutPayload.blockNumber).toEqual(blockNumber);
        expect(uutPayload.status).toEqual(EventStatus.invalid);
        expect(uutPayload.isValid).toEqual(false);
        expect(uutPayload.error).toEqual(BAD_REQUEST);

        const currentVll = await geeqNode.getCurrentVll();
        const senderAfter = currentVll.getValLeyRecById(senderIdHash.toString()).getRecord() as CoinAcctRecWrapper;
        const receiverAfter = currentVll.getValLeyRecById(receiverIdHash.toString()).getRecord() as CoinAcctRecWrapper;

        expect(senderAfter.amountBalance.toNumber()).toEqual(senderBefore.amountBalance.toNumber());
        expect(receiverAfter.amountBalance.toNumber()).toEqual(receiverBefore.amountBalance.toNumber());

        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });

  // Skipped by BUG: https://geeq.atlassian.net/browse/TC-2080
  it.skip(case6, async () => {
    // Precondition ====================================================================================================
    const simulator = new Simulator();

    const nodes = await simulator.getActiveNodes();
    expect(nodes).toBeDefined();
    const [firstNode] = nodes;

    const geeqNode = new GeeqNode(nodes[0].ip);
    const vll = await geeqNode.getCurrentVll();
    const firstNodeNum = vll.getNetworkActors().getNodeByIp(firstNode.ip).nodeNumber1;

    const chainNumber = vll.getChainNumber();
    const blockNumber = vll.getBlockNumber() + 1;

    const index1 = 8;
    const index2 = 9;

    const senderAccount = await simulator.getCoinAccount(index1);
    const receiverAccount = await simulator.getCoinAccount(index2);

    const senderId = senderAccount.getPublicKey();
    const receiverId = receiverAccount.getPublicKey();

    const nonce1 = await getNonce(vll, senderId);
    const nonce2 = await getNonce(vll, receiverId);

    const senderIdHash = senderAccount.hashBuffer(senderId) as AccountHashBuffer;
    const receiverIdHash = receiverAccount.hashBuffer(receiverId) as AccountHashBuffer;

    const senderBeforeTransfer = vll.getValLeyRecById(senderIdHash.toString()).getRecord() as CoinAcctRecWrapper;
    const receiverBeforeTransfer = vll.getValLeyRecById(receiverIdHash.toString()).getRecord() as CoinAcctRecWrapper;

    // WebSocket client connection
    const client = new GeeqWebSocket(firstNode.ip);
    await client.sendSubscriberEvent([senderId]);
    await client.sendListenEvent(blockNumber);

    // Step 1 ==========================================================================================================
    // Creating COIN_ASSET_TX 1 ***************************************************
    const amount1 = senderBeforeTransfer.amountBalance.toNumber();
    const coinAssetTx1 = CoinAssetTxWrapper.create(
      nonce1,
      amount1,
      senderId,
      receiverIdHash,
      [],
      [],
    );
    const coinTxPayload1 = CoinTxPayloadWrapper.create(coinAssetTx1);
    const uvt1 = UnverValTxWrapper.createUvt(
      chainNumber,
      blockNumber,
      firstNodeNum,
      coinTxPayload1,
    );
    // Sign and send tx
    uvt1.setContext({ crypto: senderAccount });
    await uvt1.sign();

    // Creating COIN_ASSET_TX 2 ***************************************************
    const amount2 = 1;
    const coinAssetTx2 = CoinAssetTxWrapper.create(
      nonce1 + 1,
      amount2,
      senderId,
      receiverIdHash,
      [],
      [],
    );
    const coinTxPayload2 = CoinTxPayloadWrapper.create(coinAssetTx2);
    const uvt2 = UnverValTxWrapper.createUvt(
      chainNumber,
      blockNumber,
      firstNodeNum,
      coinTxPayload2,
    );
    // Sign and send tx
    uvt2.setContext({ crypto: senderAccount });
    await uvt2.computeRefHash();
    await uvt2.sign();
    const refHash2 = uvt2.getRefHash();

    const response1 = await geeqNode.sendUvt(uvt1);
    const response2 = await geeqNode.sendUvt(uvt2);
    expect(response1.errorMessage).toBeUndefined();
    expect(response2.errorMessage).toBeUndefined();

    // Step 2 ==========================================================================================================
    return new Promise<void>(async (resolve, reject) => {
      const uutPayload = await new Promise<UutStatus>((resolve, reject) => {
        const timer = setTimeout(() => reject(), 10000);

        client.on(Events.uutStatus, (payload) => {
          if (payload.refHash === refHash2.toString()) {
            clearTimeout(timer);
            resolve(payload);
          }
        });
      });
      try {
        expect(uutPayload.refHash).toEqual(refHash2.toString());

        const currentVll = await geeqNode.getCurrentVll();
        const senderAfterTransfer = currentVll.getValLeyRecById(senderIdHash.toString()).getRecord();
        const receiverAfterTransfer = currentVll.getValLeyRecById(receiverIdHash.toString()).getRecord();
        expect(senderAfterTransfer).toBeDefined();
        expect(receiverAfterTransfer).toBeDefined();

        const amount1 = (senderAfterTransfer as CoinAcctRecWrapper).amountBalance.toNumber();
        const amount2 = (receiverAfterTransfer as CoinAcctRecWrapper).amountBalance.toNumber();
        expect(amount1).toEqual(senderBeforeTransfer.amountBalance.toNumber());
        expect(amount2).toEqual(receiverBeforeTransfer.amountBalance.toNumber());
        expect(senderAfterTransfer.getNonce()).toEqual(nonce1 + 2);
        expect(receiverAfterTransfer.getNonce()).toEqual(nonce2);

        client.close();
        resolve();
      } catch (e) {
        client.close();
        reject(e);
      }
    });
  });

  // Skipped by BUG: https://geeq.atlassian.net/browse/TC-2080
  it.skip(case7, async () => {
    // Precondition ====================================================================================================
    const simulator = new Simulator();

    const nodes = await simulator.getActiveNodes();
    expect(nodes.length).toBeGreaterThanOrEqual(2);

    const geeqNode = new GeeqNode(nodes[0].ip);
    const vll = await geeqNode.getCurrentVll();

    const chainNumber = vll.getChainNumber();
    const blockNumber = vll.getBlockNumber() + 1;

    const index1 = 3;
    const index2 = 2;

    const senderAccount = await simulator.getCoinAccount(index1);
    const receiverAccount = await simulator.getCoinAccount(index2);

    const senderId = senderAccount.getPublicKey();
    const receiverId = receiverAccount.getPublicKey();

    const nonce1 = await getNonce(vll, senderId);
    const nonce2 = await getNonce(vll, receiverId);

    const senderIdHash = senderAccount.hashBuffer(senderId) as AccountHashBuffer;
    const receiverIdHash = receiverAccount.hashBuffer(receiverId) as AccountHashBuffer;

    const senderBeforeTransfer = vll.getValLeyRecById(senderIdHash.toString())
      .getRecord() as CoinAcctRecWrapper;
    const receiverBeforeTransfer = vll.getValLeyRecById(receiverIdHash.toString())
      .getRecord() as CoinAcctRecWrapper;

    const refHashList: Array<string> = [];
    await Promise.all(
      nodes.map(
        async (activeNode) => {
          const geeqNode = new GeeqNode(activeNode.ip);
          const vll = await geeqNode.getCurrentVll();
          const activeNodeNum = vll.getNetworkActors().getNodeByIp(activeNode.ip).nodeNumber1;
          const senderNonce = await getNonce(vll, senderId);

          // Step 1, 2 =================================================================================================
          // Creating COIN_ASSET_TX
          const amount1 = 1;
          const nonce = activeNode.ip === nodes[1].ip ? senderNonce + 1 : senderNonce;
          const coinAssetTx1 = CoinAssetTxWrapper.create(
            nonce,
            amount1,
            senderId,
            receiverIdHash,
            [],
            [],
          );
          const coinTxPayload1 = CoinTxPayloadWrapper.create(coinAssetTx1);
          const uvt1 = UnverValTxWrapper.createUvt(
            chainNumber,
            blockNumber,
            activeNodeNum,
            coinTxPayload1,
          );
          // Sign and send tx
          uvt1.setContext({ crypto: senderAccount });
          await uvt1.computeRefHash();
          refHashList.push(uvt1.getRefHash().toString());

          await uvt1.sign();
          const response1 = await geeqNode.sendUvt(uvt1);
          expect(response1.errorMessage).toBeUndefined();
        },
      ),
    );

    // WebSocket client connection
    const client1 = new GeeqWebSocket(nodes[0].ip);
    await client1.sendSubscriberEvent([senderId]);
    await client1.sendListenEvent(blockNumber);

    const client2 = new GeeqWebSocket(nodes[1].ip);
    await client2.sendSubscriberEvent([senderId]);
    await client2.sendListenEvent(blockNumber);

    // Step 3 ==========================================================================================================
    return new Promise<void>(async (resolve, reject) => {
      const uutPayload1 = await new Promise<UutStatus>((resolve, reject) => {
        const timer = setTimeout(() => reject(), 10000);
        client1.on(Events.uutStatus, (payload) => {
          if (payload.refHash === refHashList[0]) {
            clearTimeout(timer);
            resolve(payload);
          }
        });
      });
      const uutPayload2 = await new Promise<UutStatus>((resolve, reject) => {
        const timer = setTimeout(() => reject(), 10000);
        client2.on(Events.uutStatus, (payload) => {
          if (payload.refHash === refHashList[1]) {
            clearTimeout(timer);
            resolve(payload);
          }
        });
      });

      try {
        expect(uutPayload1.publicKey).toEqual(senderId.toString());
        expect(uutPayload1.refHash).toEqual(refHashList[0]);
        expect(uutPayload1.blockNumber).toEqual(blockNumber);
        // expect(uutPayload1.status).toEqual(EventStatus.invalid);
        // expect(uutPayload1.isValid).toBeFalsy();
        // expect(uutPayload1.error).toBeDefined();

        expect(uutPayload2.publicKey).toEqual(senderId.toString());
        expect(uutPayload2.refHash).toEqual(refHashList[1]);
        expect(uutPayload2.blockNumber).toEqual(blockNumber);
        // expect(uutPayload2.status).toEqual(EventStatus.invalid);
        // expect(uutPayload2.isValid).toBeFalsy();
        // expect(uutPayload2.error).toBeDefined();

        const currentVll = await geeqNode.getCurrentVll();
        const senderAfterTransfer = currentVll.getValLeyRecById(senderIdHash.toString()).getRecord();
        const receiverAfterTransfer = currentVll.getValLeyRecById(receiverIdHash.toString()).getRecord();
        expect(senderAfterTransfer).toBeDefined();
        expect(receiverAfterTransfer).toBeDefined();

        const amount1 = (senderAfterTransfer as CoinAcctRecWrapper).amountBalance.toNumber();
        const amount2 = (receiverAfterTransfer as CoinAcctRecWrapper).amountBalance.toNumber();
        expect(amount1).toEqual(senderBeforeTransfer.amountBalance.toNumber());
        expect(amount2).toEqual(receiverBeforeTransfer.amountBalance.toNumber());
        expect(senderAfterTransfer.getNonce()).toEqual(nonce1);
        expect(receiverAfterTransfer.getNonce()).toEqual(nonce2);

        client1.close();
        client2.close();
        resolve();
      } catch (e) {
        client1.close();
        client2.close();
        reject(e);
      }
    });
  });
});
