import * as fs from "fs";
import * as dotenv from "dotenv";
import { Keypair } from "@solana/web3.js";
import * as StellarSdk from "@stellar/stellar-sdk";

dotenv.config();

export const STELLAR_RPC            = process.env.STELLAR_RPC            ?? "https://soroban-testnet.stellar.org";
export const STELLAR_NETWORK        = process.env.STELLAR_NETWORK        ?? StellarSdk.Networks.TESTNET;
export const NABOKA_TOKEN_CONTRACT  = process.env.NABOKA_TOKEN_CONTRACT  ?? "";
export const WRAPPED_SPL_CONTRACT   = process.env.WRAPPED_SPL_CONTRACT   ?? "";

export const SOLANA_RPC             = process.env.SOLANA_RPC             ?? "https://api.devnet.solana.com";
export const SIMPLE_TOKEN_PROGRAM   = process.env.SIMPLE_TOKEN_PROGRAM   ?? "";
export const WRAPPED_NABOKA_PROGRAM = process.env.WRAPPED_NABOKA_PROGRAM ?? "";

export function loadStellarKeypair(): StellarSdk.Keypair {
  const secret = process.env.ORACLE_STELLAR_SECRET;
  if (!secret) throw new Error("ORACLE_STELLAR_SECRET не задан в .env");
  return StellarSdk.Keypair.fromSecret(secret);
}

export function loadSolanaKeypair(): Keypair {
  const path = process.env.ORACLE_SOLANA_KEYPAIR_PATH ?? "./oracle-solana.json";
  const arr  = JSON.parse(fs.readFileSync(path, "utf-8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}
