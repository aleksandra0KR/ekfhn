import { Connection, PublicKey, type Logs } from "@solana/web3.js";
import { BorshCoder, EventParser } from "@coral-xyz/anchor";
import { SOLANA_RPC, SIMPLE_TOKEN_PROGRAM, WRAPPED_NABOKA_PROGRAM } from "./config";

// IDL импортируем так — партнёры должны прислать wrapped_naboka.json
// и положить его рядом с simple_token.json
import simpleTokenIdl    from "../../idl/simple_token.json";
import wrappedNabokaIdl  from "../../idl/wrapped_naboka.json";

// ─── Типы событий ─────────────────────────────────────────────────────────────

export interface SolanaLockEvent {
  user:               string;  // Solana pubkey
  amount:             bigint;
  targetStellarAddr:  string;  // G... адрес на Stellar
}

export interface SolanaWrapBurnEvent {
  user:               string;  // Solana pubkey
  amount:             bigint;
  targetStellarAddr:  string;  // G... адрес на Stellar
}

// ─── Слушатели ────────────────────────────────────────────────────────────────

/**
 * Подписывается на логи simple_token и слушает событие TokensLocked.
 * Срабатывает когда пользователь вызвал lock_tokens() — нужно минтить wSPL на Stellar.
 */
export function listenSolanaLock(
  onLock: (e: SolanaLockEvent) => Promise<void>
): void {
  const connection  = new Connection(SOLANA_RPC, "confirmed");
  const programId   = new PublicKey(SIMPLE_TOKEN_PROGRAM);
  const parser      = new EventParser(programId, new BorshCoder(simpleTokenIdl as any));

  connection.onLogs(programId, async (logs: Logs) => {
    if (logs.err) return;
    try {
      for (const event of parser.parseLogs(logs.logs)) {
        if (event.name !== "TokensLocked") continue;
        const data = event.data as {
          user:               { toString(): string };
          amount:             { toString(): string };
          targetStellarAddr:  string;
        };
        await onLock({
          user:              data.user.toString(),
          amount:            BigInt(data.amount.toString()),
          targetStellarAddr: data.targetStellarAddr,
        });
      }
    } catch (e) {
      console.error("[solana-listener][lock] parse error:", e);
    }
  }, "confirmed");

  console.log("[solana-listener] watching SimpleToken lock events...");
}

/**
 * Подписывается на логи wrapped_naboka и слушает событие WrappedBurned.
 * Срабатывает когда пользователь вызвал burn_wrapped() — нужно release на Stellar.
 */
export function listenSolanaWrapBurn(
  onBurn: (e: SolanaWrapBurnEvent) => Promise<void>
): void {
  const connection  = new Connection(SOLANA_RPC, "confirmed");
  const programId   = new PublicKey(WRAPPED_NABOKA_PROGRAM);
  const parser      = new EventParser(programId, new BorshCoder(wrappedNabokaIdl as any));

  connection.onLogs(programId, async (logs: Logs) => {
    if (logs.err) return;
    try {
      for (const event of parser.parseLogs(logs.logs)) {
        if (event.name !== "WrappedBurned") continue;
        const data = event.data as {
          user:               { toString(): string };
          amount:             { toString(): string };
          targetStellarAddr:  string;
        };
        await onBurn({
          user:              data.user.toString(),
          amount:            BigInt(data.amount.toString()),
          targetStellarAddr: data.targetStellarAddr,
        });
      }
    } catch (e) {
      console.error("[solana-listener][wrapBurn] parse error:", e);
    }
  }, "confirmed");

  console.log("[solana-listener] watching WrappedNaboka burn events...");
}
