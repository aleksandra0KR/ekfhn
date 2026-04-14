import {
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
    VersionedTransaction,
    Keypair,
} from "@solana/web3.js";
import {
    AnchorProvider,
    Program,
    BN,
    Idl,
    Wallet,
} from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
    SOLANA_RPC,
    SIMPLE_TOKEN_PROGRAM,
    WRAPPED_NABOKA_PROGRAM,
    loadSolanaKeypair,
} from "./config";

// Импорт IDL с правильным приведением типов
import simpleTokenIdlRaw from "../../idl/simple_token.json";
import wrappedNabokaIdlRaw from "../../idl/wrapped_naboka.json";

// Приведение к типу Idl (если структура неполная, можно использовать as any)
const simpleTokenIdl = simpleTokenIdlRaw as unknown as Idl;
const wrappedNabokaIdl = wrappedNabokaIdlRaw as unknown as Idl;

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeProvider(): AnchorProvider {
    const keypair = loadSolanaKeypair();
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const wallet = new Wallet(keypair); // Используем встроенный Wallet
    return new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
    });
}

function deriveSimpleTokenMint(programId: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from("mint")], programId)[0];
}

function deriveStatePda(programId: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from("state")], programId)[0];
}

function deriveLockVault(mint: PublicKey, programId: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("lock_vault"), mint.toBuffer()],
        programId
    )[0];
}

function deriveLockVaultAuth(mint: PublicKey, programId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("lock_auth"), mint.toBuffer()],
        programId
    );
}

function deriveWrappedMint(programId: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from("wmint")], programId)[0];
}

function deriveWrappedState(programId: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from("wstate")], programId)[0];
}

function deriveWrappedMintAuth(programId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([Buffer.from("wmint_auth")], programId);
}

// ─── Публичные функции ────────────────────────────────────────────────────────

export async function mintWrappedNaboka(
    recipientSolAddr: string,
    amount: bigint
): Promise<string> {
    console.log(`[solana-minter] mint_wrapped_naboka → ${recipientSolAddr}, amount=${amount}`);

    const provider = makeProvider();
    const programId = new PublicKey(WRAPPED_NABOKA_PROGRAM);
    const program = new Program(wrappedNabokaIdl, programId, provider);

    const recipient = new PublicKey(recipientSolAddr);
    const wrappedMint = deriveWrappedMint(programId);
    const wrappedState = deriveWrappedState(programId);
    const [mintAuth, mintAuthBump] = deriveWrappedMintAuth(programId);
    const recipientAta = await getAssociatedTokenAddress(wrappedMint, recipient);

    const sig = await program.methods
        .mintWrapped(new BN(amount.toString()), mintAuthBump)
        .accounts({
            wrappedState,
            mint: wrappedMint,
            mintAuthority: mintAuth,
            recipientAta,
            recipient,
            bridgeAdmin: provider.wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        })
        .rpc();

    console.log(`[solana-minter] mint_wrapped OK: ${sig}`);
    return sig;
}

export async function releaseSpl(
    recipientSolAddr: string,
    amount: bigint
): Promise<string> {
    console.log(`[solana-minter] release_tokens → ${recipientSolAddr}, amount=${amount}`);

    const provider = makeProvider();
    const programId = new PublicKey(SIMPLE_TOKEN_PROGRAM);
    const program = new Program(simpleTokenIdl, programId, provider);

    const mint = deriveSimpleTokenMint(programId);
    const tokenState = deriveStatePda(programId);
    const lockVault = deriveLockVault(mint, programId);
    const [lockAuth, lockAuthBump] = deriveLockVaultAuth(mint, programId);
    const recipient = new PublicKey(recipientSolAddr);
    const recipientAta = await getAssociatedTokenAddress(mint, recipient);

    const sig = await program.methods
        .releaseTokens(new BN(amount.toString()), lockAuthBump)
        .accounts({
            tokenState,
            mint,
            lockVault,
            lockVaultAuthority: lockAuth,
            recipientTokenAccount: recipientAta,
            recipient,
            bridgeAdmin: provider.wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        })
        .rpc();

    console.log(`[solana-minter] release_tokens OK: ${sig}`);
    return sig;
}