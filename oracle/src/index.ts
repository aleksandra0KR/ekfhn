import { listenNabokaLock, listenWrappedSplBurn } from "./stellar-listener";
import { listenSolanaLock, listenSolanaWrapBurn } from "./solana-listener";
import { mintWrappedNaboka, releaseSpl }           from "./solana-minter";
import { mintWrappedSpl, releaseNaboka }           from "./stellar-minter";

let stellarQueue = Promise.resolve();

function enqueueStella(fn: () => Promise<void>): void {
  stellarQueue = stellarQueue.then(() => fn().catch((e) => {
    console.error("[queue] error:", e?.message ?? e);
  }));
}

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════");
  console.log("        Naboka Bridge Oracle  v1.0.0");
  console.log("═══════════════════════════════════════════════");

  listenSolanaLock(async (e) => {
    console.log(`\n[SOL→ST] LOCK  user=${e.user}  amount=${e.amount}  to=${e.targetStellarAddr}`);
    enqueueStella(async () => {
      const hash = await mintWrappedSpl(e.targetStellarAddr, e.amount);
      console.log(`[SOL→ST] ✓ wSPL minted  tx=${hash}`);
    });
  });

  listenSolanaWrapBurn(async (e) => {
    console.log(`\n[SOL→ST] BURN_WRAP  user=${e.user}  amount=${e.amount}  to=${e.targetStellarAddr}`);
    enqueueStella(async () => {
      const hash = await releaseNaboka(e.targetStellarAddr, e.amount);
      console.log(`[SOL→ST] ✓ NT released  tx=${hash}`);
    });
  });

  listenNabokaLock(async (e) => {
    console.log(`\n[ST→SOL] LOCK  from=${e.from}  amount=${e.amount}  to=${e.targetSolAddr}`);
    try {
      const sig = await mintWrappedNaboka(e.targetSolAddr, e.amount);
      console.log(`[ST→SOL] ✓ wNT minted  sig=${sig}`);
    } catch (err: any) {
      console.error(`[ST→SOL] ✗ mintWrappedNaboka failed:`, err?.message ?? err);
      if (err.logs) console.error("Transaction logs:", err.logs);
      if (err.getLogs) {
        const logs = await err.getLogs();
        console.error("Logs from getLogs:", logs);
      }
    }
  });

  listenWrappedSplBurn(async (e) => {
    console.log(`\n[ST→SOL] BBURN  from=${e.from}  amount=${e.amount}  to=${e.targetSolAddr}`);
    try {
      const sig = await releaseSpl(e.targetSolAddr, e.amount);
      console.log(`[ST→SOL] ✓ SPL released  sig=${sig}`);
    } catch (err: any) {
      console.error(`[ST→SOL] ✗ releaseSpl failed:`, err?.message ?? err);
    }
  });

  await new Promise(() => {});
}

main().catch((e) => { console.error("Oracle crashed:", e); process.exit(1); });