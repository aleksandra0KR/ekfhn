import * as StellarSdk from "@stellar/stellar-sdk";
import { STELLAR_RPC, NABOKA_TOKEN_CONTRACT, WRAPPED_SPL_CONTRACT } from "./config";

const server = new StellarSdk.SorobanRpc.Server(STELLAR_RPC);

export interface LockEvent  { from: string; amount: bigint; targetSolAddr: string; }
export interface BburnEvent { from: string; amount: bigint; targetSolAddr: string; }


function scValToAddress(val: StellarSdk.xdr.ScVal): string {
  return StellarSdk.Address.fromScVal(val).toString();
}

function scValToBigInt(val: StellarSdk.xdr.ScVal): bigint {
  const i128 = val.i128();
  return (BigInt(i128.hi().toString()) << 64n) | BigInt(i128.lo().toString());
}

function scValToStr(val: StellarSdk.xdr.ScVal): string {
  try {
    return StellarSdk.Address.fromScVal(val).toString();
  } catch {
    const b = val.str();
    return b ? b.toString() : "";
  }
}

function parseEventValue(value: StellarSdk.xdr.ScVal): { from: string; amount: bigint; target: string } | null {
  try {
    const vec = value.vec();
    if (!vec || vec.length < 3) return null;
    return {
      from:   scValToAddress(vec[0]),
      amount: scValToBigInt(vec[1]),
      target: scValToStr(vec[2]),
    };
  } catch (e) {
    console.error("[stellar-listener] parse error:", e);
    return null;
  }
}

function getTopicSymbol(topic: StellarSdk.xdr.ScVal): string | null {
  try {
    return topic.sym()?.toString() ?? null;
  } catch {
    return null;
  }
}

async function pollEvents(
    contractId:  string,
    symbolName:  string,
    lastLedger:  { seq: number },
    cb: (from: string, amount: bigint, target: string, ledger: number) => Promise<void>
): Promise<void> {
  const current = await server.getLatestLedger();
  if (current.sequence <= lastLedger.seq) return;

  const resp = await server.getEvents({
    startLedger: lastLedger.seq + 1,
    filters: [
      {
        type:        "contract",
        contractIds: [contractId],
      },
    ],
    limit: 200,
  });

  for (const ev of resp.events) {
    if (!ev.topic || ev.topic.length === 0) continue;
    const sym = getTopicSymbol(ev.topic[0]);
    if (sym !== symbolName) continue;

    const parsed = parseEventValue(ev.value);
    if (!parsed) continue;

    await cb(parsed.from, parsed.amount, parsed.target, ev.ledger);
  }

  lastLedger.seq = current.sequence;
}

export function listenNabokaLock(
    onLock: (e: LockEvent) => Promise<void>,
    intervalMs = 5000
): void {
  if (!NABOKA_TOKEN_CONTRACT) {
    console.warn("[stellar-listener] NABOKA_TOKEN_CONTRACT не задан в .env");
    return;
  }

  const last = { seq: 0 };
  server.getLatestLedger().then((l) => { last.seq = l.sequence; });

  setInterval(async () => {
    try {
      await pollEvents(NABOKA_TOKEN_CONTRACT, "lock", last, async (from, amount, target, ledger) => {
        console.log(`[ST lock] ledger=${ledger} from=${from} amount=${amount} → ${target}`);
        await onLock({ from, amount, targetSolAddr: target });
      });
    } catch (e) {
      console.error("[stellar-listener][lock] poll error:", e);
    }
  }, intervalMs);

  console.log("[stellar-listener] watching NabokaToken lock events...");
}

export function listenWrappedSplBurn(
    onBurn: (e: BburnEvent) => Promise<void>,
    intervalMs = 5000
): void {
  if (!WRAPPED_SPL_CONTRACT) {
    console.warn("[stellar-listener] WRAPPED_SPL_CONTRACT не задан в .env");
    return;
  }

  const last = { seq: 0 };
  server.getLatestLedger().then((l) => { last.seq = l.sequence; });

  setInterval(async () => {
    try {
      await pollEvents(WRAPPED_SPL_CONTRACT, "bburn", last, async (from, amount, target, ledger) => {
        console.log(`[ST bburn] ledger=${ledger} from=${from} amount=${amount} → ${target}`);
        await onBurn({ from, amount, targetSolAddr: target });
      });
    } catch (e) {
      console.error("[stellar-listener][bburn] poll error:", e);
    }
  }, intervalMs);

  console.log("[stellar-listener] watching WrappedSPL bridge_burn events...");
}