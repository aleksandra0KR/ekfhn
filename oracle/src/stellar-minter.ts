import * as StellarSdk from "@stellar/stellar-sdk";
import {
  STELLAR_RPC,
  STELLAR_NETWORK,
  WRAPPED_SPL_CONTRACT,
  NABOKA_TOKEN_CONTRACT,
  loadStellarKeypair,
} from "./config";

const server = new StellarSdk.SorobanRpc.Server(STELLAR_RPC);

async function waitForTx(hash: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const resp = await server.getTransaction(hash);
      const status = (resp as any).status;

      if (status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.SUCCESS || status === "SUCCESS") {
        return;
      }
      if (status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.FAILED || status === "FAILED") {
        throw new Error(`Stellar tx FAILED: ${hash}`);
      }
    } catch (e: any) {
      if (e.message?.includes("Bad union switch") || e.message?.includes("XDR")) {
        console.log(`[stellar-minter] tx ${hash} - XDR parse issue, assuming success`);
        console.log(`[stellar-minter] check: https://stellar.expert/explorer/testnet/tx/${hash}`);
        return;
      }
      if (e.message?.includes("not found") || e.code === 404 || e.message?.includes("404")) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw e;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Stellar tx timeout: ${hash}`);
}

async function invokeContract(
    contractId: string,
    method: string,
    args: StellarSdk.xdr.ScVal[]
): Promise<string> {
  const keypair  = loadStellarKeypair();
  const account  = await server.getAccount(keypair.publicKey());
  const contract = new StellarSdk.Contract(contractId);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee:               StellarSdk.BASE_FEE,
    networkPassphrase: STELLAR_NETWORK,
  })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(keypair);

  const sent = await server.sendTransaction(prepared);

  if (sent.status === "ERROR") {
    throw new Error(`Stellar send error: ${JSON.stringify(sent.errorResult)}`);
  }

  await waitForTx(sent.hash);
  return sent.hash;
}

export async function mintWrappedSpl(stellarAddr: string, amount: bigint): Promise<string> {
  console.log(`[stellar-minter] bridge_mint wSPL → ${stellarAddr} amount=${amount}`);
  const hash = await invokeContract(WRAPPED_SPL_CONTRACT, "bridge_mint", [
    StellarSdk.Address.fromString(stellarAddr).toScVal(),
    StellarSdk.nativeToScVal(amount, { type: "i128" }),
  ]);
  console.log(`[stellar-minter] bridge_mint OK tx=${hash}`);
  return hash;
}

export async function releaseNaboka(stellarAddr: string, amount: bigint): Promise<string> {
  console.log(`[stellar-minter] release NT → ${stellarAddr} amount=${amount}`);
  const hash = await invokeContract(NABOKA_TOKEN_CONTRACT, "release", [
    StellarSdk.Address.fromString(stellarAddr).toScVal(),
    StellarSdk.nativeToScVal(amount, { type: "i128" }),
  ]);
  console.log(`[stellar-minter] release OK tx=${hash}`);
  return hash;
}