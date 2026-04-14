import { listenNabokaLock, listenWrappedSplBurn } from "./stellar-listener";
import { listenSolanaLock, listenSolanaWrapBurn } from "./solana-listener";
import { mintWrappedNaboka, releaseSpl }           from "./solana-minter";
import { mintWrappedSpl, releaseNaboka }           from "./stellar-minter";

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════");
  console.log("  Naboka Bridge Oracle started");
  console.log("═══════════════════════════════════════");

  // ── Stellar → Solana ─────────────────────────────────────────────────────────
  //
  // 1. Пользователь вызвал lock() на NabokaToken (Stellar)
  //    → оракул минтит wNT на Solana

  listenNabokaLock(async (e) => {
    console.log(`\n[ST→SOL] LOCK detected`);
    console.log(`  from:   ${e.from}`);
    console.log(`  amount: ${e.amount}`);
    console.log(`  to Sol: ${e.targetSolAddr}`);
    try {
      const sig = await mintWrappedNaboka(e.targetSolAddr, e.amount);
      console.log(`  ✓ wNT minted on Solana: ${sig}`);
    } catch (err) {
      console.error(`  ✗ mintWrappedNaboka failed:`, err);
    }
  });

  // 2. Пользователь вызвал bridge_burn() на WrappedSPL (Stellar)
  //    → оракул вызывает release_tokens на Solana

  listenWrappedSplBurn(async (e) => {
    console.log(`\n[ST→SOL] BRIDGE_BURN detected`);
    console.log(`  from:   ${e.from}`);
    console.log(`  amount: ${e.amount}`);
    console.log(`  to Sol: ${e.targetSolAddr}`);
    try {
      const sig = await releaseSpl(e.targetSolAddr, e.amount);
      console.log(`  ✓ SPL released on Solana: ${sig}`);
    } catch (err) {
      console.error(`  ✗ releaseSpl failed:`, err);
    }
  });

  // ── Solana → Stellar ──────────────────────────────────────────────────────────
  //
  // 3. Пользователь вызвал lock_tokens() на simple_token (Solana)
  //    → оракул минтит wSPL на Stellar

  listenSolanaLock(async (e) => {
    console.log(`\n[SOL→ST] LOCK_TOKENS detected`);
    console.log(`  from:      ${e.user}`);
    console.log(`  amount:    ${e.amount}`);
    console.log(`  to Stellar: ${e.targetStellarAddr}`);
    try {
      const hash = await mintWrappedSpl(e.targetStellarAddr, e.amount);
      console.log(`  ✓ wSPL minted on Stellar: ${hash}`);
    } catch (err) {
      console.error(`  ✗ mintWrappedSpl failed:`, err);
    }
  });

  // 4. Пользователь вызвал burn_wrapped() на wrapped_naboka (Solana)
  //    → оракул вызывает release() на NabokaToken (Stellar)

  listenSolanaWrapBurn(async (e) => {
    console.log(`\n[SOL→ST] BURN_WRAPPED detected`);
    console.log(`  from:      ${e.user}`);
    console.log(`  amount:    ${e.amount}`);
    console.log(`  to Stellar: ${e.targetStellarAddr}`);
    try {
      const hash = await releaseNaboka(e.targetStellarAddr, e.amount);
      console.log(`  ✓ NT released on Stellar: ${hash}`);
    } catch (err) {
      console.error(`  ✗ releaseNaboka failed:`, err);
    }
  });

  // Держим процесс живым
  await new Promise(() => {});
}

main().catch((e) => {
  console.error("Oracle crashed:", e);
  process.exit(1);
});
