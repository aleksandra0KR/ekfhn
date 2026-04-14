import { Address, xdr } from "@stellar/stellar-sdk";
import { rpc, Networks } from '@stellar/stellar-sdk';

import { STELLAR_RPC, NABOKA_TOKEN_CONTRACT, WRAPPED_SPL_CONTRACT } from "./config";

const server = new rpc.Server(STELLAR_RPC);

// ─── Типы событий ─────────────────────────────────────────────────────────────

export interface LockEvent {
  from:          string;
  amount:        bigint;
  targetSolAddr: string;
  ledger:        number;
}

export interface BurnEvent {
  from:          string;
  amount:        bigint;
  targetSolAddr: string;
  ledger:        number;
}

// ─── Парсинг ScVal ────────────────────────────────────────────────────────────

function scValToAddress(val: xdr.ScVal): string {
  return Address.fromScVal(val).toString();
}

function scValToBigInt(val: xdr.ScVal): bigint {
  const i128Val = val.i128();
  if (!i128Val) throw new Error("Expected i128");
  const hi = BigInt(i128Val.hi().toString());
  const lo = BigInt(i128Val.lo().toString());
  return (hi << 64n) | lo;
}

function scValToString(val: xdr.ScVal): string {
  try {
    return Address.fromScVal(val).toString();
  } catch {
    const str = val.str();
    return str ? str.toString() : "";
  }
}

function parseVec(raw: string): { from: string; amount: bigint; target: string } | null {
  try {
    const scVal = xdr.ScVal.fromXDR(raw, "base64");
    const vec = scVal.vec();
    if (!vec || vec.length < 3) return null;
    return {
      from:   scValToAddress(vec[0]),
      amount: scValToBigInt(vec[1]),
      target: scValToString(vec[2]),
    };
  } catch (e) {
    console.error("[stellar-listener] parse error:", e);
    return null;
  }
}

// ─── Polling ──────────────────────────────────────────────────────────────────

async function poll(
    contractId: string,
    topicSymbol: string,
    lastLedger: { seq: number },
    onEvent: (parsed: { from: string; amount: bigint; target: string }, ledger: number) => Promise<void>
): Promise<void> {
  const current = await server.getLatestLedger();
  if (current.sequence <= lastLedger.seq) return;

  const resp = await server.getEvents({
    startLedger: lastLedger.seq + 1,
    filters: [
      {
        type: "contract",
        contractIds: [contractId],
        topics: [[topicSymbol]],
      },
    ],
    limit: 100,
  });

  for (const ev of resp.events) {
    const parsed = parseVec((ev as any).xdr);
    if (parsed) await onEvent(parsed, ev.ledger);
  }

  lastLedger.seq = current.sequence;
}

// ─── Публичные функции ────────────────────────────────────────────────────────

export function listenNabokaLock(
    onLock: (e: LockEvent) => Promise<void>,
    intervalMs = 5000
): void {
  const last = { seq: 0 };
  server.getLatestLedger().then(l => { last.seq = l.sequence; });

  setInterval(async () => {
    try {
      await poll(NABOKA_TOKEN_CONTRACT, "lock", last, async (p, ledger) => {
        await onLock({
          from: p.from,
          amount: p.amount,
          targetSolAddr: p.target,
          ledger,
        });
      });
    } catch (e) {
      console.error("[stellar-listener][lock] poll error:", e);
    }
  }, intervalMs);

  console.log("[stellar-listener] watching NabokaToken lock events...");
}

export function listenWrappedSplBurn(
    onBurn: (e: BurnEvent) => Promise<void>,
    intervalMs = 5000
): void {
  const last = { seq: 0 };
  server.getLatestLedger().then(l => { last.seq = l.sequence; });

  setInterval(async () => {
    try {
      await poll(WRAPPED_SPL_CONTRACT, "bburn", last, async (p, ledger) => {
        await onBurn({
          from: p.from,
          amount: p.amount,
          targetSolAddr: p.target,
          ledger,
        });
      });
    } catch (e) {
      console.error("[stellar-listener][bburn] poll error:", e);
    }
  }, intervalMs);

  console.log("[stellar-listener] watching WrappedSPL bridge_burn events...");
}