import {
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction, Keypair,
} from "@solana/web3.js";
import {
    AnchorProvider,
    Program,
    BN,
    type Idl,
    Wallet,
} from "@coral-xyz/anchor";
import {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
    SOLANA_RPC,
    SIMPLE_TOKEN_PROGRAM,
    WRAPPED_NABOKA_PROGRAM,
    loadSolanaKeypair,
} from "./config";

const simpleTokenIdl   = require("./idl/simple_token.json");
const wrappedNabokaIdl = require("./idl/wrapped_naboka.json");


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


async function ensureAta(
    connection: Connection,
    payerKeypair: Keypair,
    mint: PublicKey,
    owner: PublicKey
): Promise<PublicKey> {
    const ata = await getAssociatedTokenAddress(mint, owner);
    const accountInfo = await connection.getAccountInfo(ata);
    if (!accountInfo) {
        const createIx = createAssociatedTokenAccountInstruction(
            payerKeypair.publicKey,
            ata,
            owner,
            mint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
        const tx = new Transaction().add(createIx);
        const signature = await sendAndConfirmTransaction(connection, tx, [payerKeypair]);
        console.log(`[solana-minter] created ATA ${ata.toString()} tx=${signature}`);
    }
    return ata;
}

export async function mintWrappedNaboka(
    recipientSolAddr: string,
    amount: bigint
): Promise<string> {
    console.log(`[solana-minter] mint_wrapped → ${recipientSolAddr} amount=${amount}`);
    if (!WRAPPED_NABOKA_PROGRAM) throw new Error("WRAPPED_NABOKA_PROGRAM не задан в .env");

    const provider = makeProvider();
    const payerKeypair = loadSolanaKeypair();
    const pid = new PublicKey(WRAPPED_NABOKA_PROGRAM);
    const program = new Program(wrappedNabokaIdl as Idl, pid, provider);

    const recipient = new PublicKey(recipientSolAddr);
    const wrappedMint = wMintPda(pid);
    const wrappedState = wStatePda(pid);
    const [mintAuth] = wMintAuthPda(pid);

    console.log(`[solana-minter] wrappedMint   = ${wrappedMint.toBase58()}`);
    console.log(`[solana-minter] wrappedState  = ${wrappedState.toBase58()}`);
    console.log(`[solana-minter] mintAuth      = ${mintAuth.toBase58()}`);
    console.log(`[solana-minter] bridgeAdmin   = ${provider.wallet.publicKey.toBase58()}`);

    const mintInfo = await provider.connection.getAccountInfo(wrappedMint);
    const stateInfo = await provider.connection.getAccountInfo(wrappedState);
    if (!mintInfo) console.error("[solana-minter] ❌ wrappedMint НЕ СУЩЕСТВУЕТ! Возможно, не вызвана initialize()");
    if (!stateInfo) console.error("[solana-minter] ❌ wrappedState НЕ СУЩЕСТВУЕТ! Возможно, не вызвана initialize()");

    const recipientAta = await ensureAta(
        provider.connection,
        payerKeypair,
        wrappedMint,
        recipient
    );

    const sig = await program.methods
        .mintWrapped(new BN(amount.toString()))
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

    console.log(`[solana-minter] mint_wrapped OK sig=${sig}`);
    return sig;
}

export async function releaseSpl(
    recipientSolAddr: string,
    amount: bigint
): Promise<string> {
    console.log(`[solana-minter] release_tokens → ${recipientSolAddr} amount=${amount}`);

    const provider = makeProvider();
    const payerKeypair = loadSolanaKeypair();
    const pid = new PublicKey(SIMPLE_TOKEN_PROGRAM);
    const program = new Program(simpleTokenIdl as Idl, pid, provider);

    const mint = mintPda(pid);
    const tokenState = statePda(pid);
    const lockVault = lockVaultPda(mint, pid);
    const [lockAuth, bump] = lockAuthPda(mint, pid);
    const recipient = new PublicKey(recipientSolAddr);

    const recipientAta = await ensureAta(
        provider.connection,
        payerKeypair,
        mint,
        recipient
    );

    const sig = await program.methods
        .releaseTokens(new BN(amount.toString()), bump)
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

    console.log(`[solana-minter] release_tokens OK sig=${sig}`);
    return sig;
}