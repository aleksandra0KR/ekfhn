import { Connection, PublicKey } from "@solana/web3.js";
import { SOLANA_RPC, SIMPLE_TOKEN_PROGRAM, WRAPPED_NABOKA_PROGRAM } from "./config";

export interface SolanaLockEvent     { user: string; amount: bigint; targetStellarAddr: string; }
export interface SolanaWrapBurnEvent { user: string; amount: bigint; targetStellarAddr: string; }

function parseTokensLocked(base64: string): SolanaLockEvent | null {
  try {
    const buf    = Buffer.from(base64, "base64");
    let offset   = 8;
    const { PublicKey: PK } = require("@solana/web3.js");
    const user = new PK(buf.slice(offset, offset + 32)).toString();
    offset += 32;
    const amount = buf.readBigUInt64LE(offset);
    offset += 8;
    const strLen = buf.readUInt32LE(offset);
    offset += 4;
    const targetStellarAddr = buf.slice(offset, offset + strLen).toString("utf8");
    return { user, amount, targetStellarAddr };
  } catch {
    return null;
  }
}

function parseWrappedBurned(base64: string): SolanaWrapBurnEvent | null {
  try {
    const buf    = Buffer.from(base64, "base64");
    let offset   = 8;
    const { PublicKey: PK } = require("@solana/web3.js");
    const user = new PK(buf.slice(offset, offset + 32)).toString();
    offset += 32;
    const amount = buf.readBigUInt64LE(offset);
    offset += 8;
    const strLen = buf.readUInt32LE(offset);
    offset += 4;
    const targetStellarAddr = buf.slice(offset, offset + strLen).toString("utf8");
    return { user, amount, targetStellarAddr };
  } catch {
    return null;
  }
}

async function pollProgram<T>(
    connection: Connection,
    programId:  PublicKey,
    seen:       Set<string>,
    parseLog:   (dataB64: string) => T | null,
    cb:         (parsed: T) => Promise<void>
): Promise<void> {
  const sigs = await connection.getSignaturesForAddress(
      programId, { limit: 10 }, "confirmed"
  );

  for (const sigInfo of sigs.reverse()) {
    if (sigInfo.err || seen.has(sigInfo.signature)) continue;
    seen.add(sigInfo.signature);
    if (seen.size > 500) seen.delete(<string>seen.values().next().value);

    let tx;
    try {
      tx = await connection.getTransaction(sigInfo.signature, {
        commitment:                     "confirmed",
        maxSupportedTransactionVersion: 0,
      });
    } catch { continue; }

    if (!tx?.meta?.logMessages) continue;

    for (const log of tx.meta.logMessages) {
      if (!log.startsWith("Program data: ")) continue;
      const b64    = log.slice("Program data: ".length);
      const parsed = parseLog(b64);
      if (!parsed) continue;
      console.log(`[solana-listener] event parsed from sig=${sigInfo.signature}`);
      await cb(parsed);
    }
  }
}

export function listenSolanaLock(
    onLock: (e: SolanaLockEvent) => Promise<void>,
    intervalMs = 8000
): void {
  if (!SIMPLE_TOKEN_PROGRAM) {
    console.warn("[solana-listener] SIMPLE_TOKEN_PROGRAM не задан"); return;
  }

  const connection = new Connection(SOLANA_RPC, "confirmed");
  const programId  = new PublicKey(SIMPLE_TOKEN_PROGRAM);
  const seen       = new Set<string>();

  setInterval(async () => {
    try {
      await pollProgram(connection, programId, seen, parseTokensLocked, async (e) => {
        console.log(`[SOL lock] user=${e.user} amount=${e.amount} → ${e.targetStellarAddr}`);
        await onLock(e);
      });
    } catch (err) {
      console.error("[solana-listener][lock] poll error:", err);
    }
  }, intervalMs);

  console.log("[solana-listener] watching SimpleToken lock events (polling)...");
}

export function listenSolanaWrapBurn(
    onBurn: (e: SolanaWrapBurnEvent) => Promise<void>,
    intervalMs = 8000
): void {
  if (!WRAPPED_NABOKA_PROGRAM) {
    console.warn("[solana-listener] WRAPPED_NABOKA_PROGRAM не задан"); return;
  }

  const connection = new Connection(SOLANA_RPC, "confirmed");
  const programId  = new PublicKey(WRAPPED_NABOKA_PROGRAM);
  const seen       = new Set<string>();

  setInterval(async () => {
    try {
      await pollProgram(connection, programId, seen, parseWrappedBurned, async (e) => {
        console.log(`[SOL wrapBurn] user=${e.user} amount=${e.amount} → ${e.targetStellarAddr}`);
        await onBurn(e);
      });
    } catch (err) {
      console.error("[solana-listener][wrapBurn] poll error:", err);
    }
  }, intervalMs);

  console.log("[solana-listener] watching WrappedNaboka burn events (polling)...");
}