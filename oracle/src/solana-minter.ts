import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  AnchorProvider,
  Program,
  BN,
  type Idl,
  Wallet,
} from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  SOLANA_RPC,
  SIMPLE_TOKEN_PROGRAM,
  WRAPPED_NABOKA_PROGRAM,
  loadSolanaKeypair,
} from "./config";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const simpleTokenIdl   = require("./idl/simple_token.json");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const wrappedNabokaIdl = require("./idl/wrapped_naboka.json");

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeProvider(): AnchorProvider {
  const keypair    = loadSolanaKeypair();
  const connection = new Connection(SOLANA_RPC, "confirmed");
  const wallet     = new Wallet(keypair);
  return new AnchorProvider(connection, wallet, {
    commitment:          "confirmed",
    preflightCommitment: "confirmed",
  });
}

const mintPda      = (pid: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("mint")],       pid)[0];
const statePda     = (pid: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("state")],      pid)[0];
const lockVaultPda = (mint: PublicKey, pid: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("lock_vault"), mint.toBuffer()], pid)[0];
const lockAuthPda  = (mint: PublicKey, pid: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("lock_auth"),  mint.toBuffer()], pid);
const wMintPda     = (pid: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("wmint")],      pid)[0];
const wStatePda    = (pid: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("wstate")],     pid)[0];
const wMintAuthPda = (pid: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("wmint_auth")], pid);

// ─── Публичные функции ────────────────────────────────────────────────────────

/**
 * Минтит wNT на Solana.
 * Вызывается когда оракул поймал lock() на NabokaToken (Stellar).
 */
export async function mintWrappedNaboka(
  recipientSolAddr: string,
  amount: bigint
): Promise<string> {
  console.log(`[solana-minter] mint_wrapped → ${recipientSolAddr} amount=${amount}`);
  if (!WRAPPED_NABOKA_PROGRAM) throw new Error("WRAPPED_NABOKA_PROGRAM не задан в .env");

  const provider  = makeProvider();
  const pid       = new PublicKey(WRAPPED_NABOKA_PROGRAM);
  const program   = new Program(wrappedNabokaIdl as Idl, pid, provider);

  const recipient      = new PublicKey(recipientSolAddr);
  const wrappedMint    = wMintPda(pid);
  const wrappedState   = wStatePda(pid);
  const [mintAuth]     = wMintAuthPda(pid);
  const recipientAta   = await getAssociatedTokenAddress(wrappedMint, recipient);

  // ← ИСПРАВЛЕНО: убран лишний аргумент mintAuthBump
  // контракт mint_wrapped принимает только amount
  const sig = await program.methods
    .mintWrapped(new BN(amount.toString()))
    .accounts({
      wrappedState,
      mint:                   wrappedMint,
      mintAuthority:          mintAuth,
      recipientAta,
      recipient,
      bridgeAdmin:            provider.wallet.publicKey,
      tokenProgram:           TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram:          SystemProgram.programId,
    })
    .rpc();

  console.log(`[solana-minter] mint_wrapped OK sig=${sig}`);
  return sig;
}

/**
 * Разблокирует SPL токены на Solana.
 * Вызывается когда оракул поймал bridge_burn() на WrappedSPL (Stellar).
 */
export async function releaseSpl(
  recipientSolAddr: string,
  amount: bigint
): Promise<string> {
  console.log(`[solana-minter] release_tokens → ${recipientSolAddr} amount=${amount}`);

  const provider  = makeProvider();
  const pid       = new PublicKey(SIMPLE_TOKEN_PROGRAM);
  const program   = new Program(simpleTokenIdl as Idl, pid, provider);

  const mint             = mintPda(pid);
  const tokenState       = statePda(pid);
  const lockVault        = lockVaultPda(mint, pid);
  const [lockAuth, bump] = lockAuthPda(mint, pid);
  const recipient        = new PublicKey(recipientSolAddr);
  const recipientAta     = await getAssociatedTokenAddress(mint, recipient);

  const sig = await program.methods
    .releaseTokens(new BN(amount.toString()), bump)
    .accounts({
      tokenState,
      mint,
      lockVault,
      lockVaultAuthority:    lockAuth,
      recipientTokenAccount: recipientAta,
      recipient,
      bridgeAdmin:           provider.wallet.publicKey,
      tokenProgram:           TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram:          SystemProgram.programId,
    })
    .rpc();

  console.log(`[solana-minter] release_tokens OK sig=${sig}`);
  return sig;
}
