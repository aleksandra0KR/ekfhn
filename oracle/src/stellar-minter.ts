import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc, Networks } from '@stellar/stellar-sdk';

import {
  STELLAR_RPC,
  STELLAR_NETWORK,
  WRAPPED_SPL_CONTRACT,
  NABOKA_TOKEN_CONTRACT,
  loadStellarKeypair,
} from "./config";

const server = new StellarSdk.rpc.Server(STELLAR_RPC);

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Ждёт пока транзакция попадёт в ledger, возвращает финальный статус. */
async function waitForTx(
  hash: string
): Promise<StellarSdk.rpc.Api.GetTransactionResponse> {
  for (let i = 0; i < 30; i++) {
    const resp = await server.getTransaction(hash);
    if (resp.status !== StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
      return resp;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Tx ${hash} не подтверждена за 60 секунд`);
}

/** Собирает, подписывает и отправляет Soroban транзакцию. */
async function sendSorobanTx(
  operation: StellarSdk.xdr.Operation
): Promise<string> {
  const keypair  = loadStellarKeypair();
  const account  = await server.getAccount(keypair.publicKey());

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee:              StellarSdk.BASE_FEE,
    networkPassphrase: STELLAR_NETWORK,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(keypair);

  const sent = await server.sendTransaction(prepared);

  if (sent.status === "ERROR") {
    throw new Error(`Stellar sendTransaction error: ${JSON.stringify(sent.errorResult)}`);
  }

  const final = await waitForTx(sent.hash);

  if (final.status !== StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Stellar tx failed: ${sent.hash}`);
  }

  return sent.hash;
}

// ─── Публичные функции ────────────────────────────────────────────────────────

/**
 * Минтит wSPL на Stellar.
 * Вызывается когда оракул поймал lock_tokens на Solana.
 *
 * @param stellarAddr  — адрес G... на Stellar куда минтить
 * @param amount       — количество (в минимальных единицах, 9 decimals)
 */
export async function mintWrappedSpl(
  stellarAddr: string,
  amount: bigint
): Promise<string> {
  console.log(`[stellar-minter] mint_wrapped_spl → ${stellarAddr}, amount=${amount}`);

  const contract = new StellarSdk.Contract(WRAPPED_SPL_CONTRACT);

  const op = contract.call(
    "bridge_mint",
    StellarSdk.Address.fromString(stellarAddr).toScVal(),
    StellarSdk.nativeToScVal(amount, { type: "i128" })
  );

  const hash = await sendSorobanTx(op);
  console.log(`[stellar-minter] bridge_mint OK: ${hash}`);
  return hash;
}

/**
 * Разблокирует NT на Stellar.
 * Вызывается когда оракул поймал burn_wrapped на Solana.
 *
 * @param stellarAddr  — адрес G... куда вернуть NT
 * @param amount       — количество (в минимальных единицах, 7 decimals)
 */
export async function releaseNaboka(
  stellarAddr: string,
  amount: bigint
): Promise<string> {
  console.log(`[stellar-minter] release → ${stellarAddr}, amount=${amount}`);

  const contract = new StellarSdk.Contract(NABOKA_TOKEN_CONTRACT);

  const op = contract.call(
    "release",
    StellarSdk.Address.fromString(stellarAddr).toScVal(),
    StellarSdk.nativeToScVal(amount, { type: "i128" })
  );

  const hash = await sendSorobanTx(op);
  console.log(`[stellar-minter] release OK: ${hash}`);
  return hash;
}
