import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SarosSwapAnchor } from "../target/types/saros_swap_anchor";
import { expect } from "chai";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import crypto from "crypto";

// Helper: calculate Anchor discriminator like on-chain
function calculateDiscriminator(accountName: string): Buffer {
  const preimage = `account:${accountName}`;
  const hash = crypto.createHash("sha256").update(preimage).digest();
  return hash.slice(0, 8);
}

// Helper: create mock SwapV1-like layout (324 bytes): [version:1][payload:323]
function createMockSwapV1Data(): Buffer {
  const data = Buffer.alloc(324);
  let offset = 0;

  // Version byte
  data.writeUInt8(1, offset); // version = 1
  offset += 1;

  // Some mock payload (size 323)
  // is_initialized (1), bump_seed (1)
  data.writeUInt8(1, offset); // is_initialized = true
  offset += 1;
  data.writeUInt8(255, offset); // bump_seed = 255
  offset += 1;

  // 7 pubkeys (7 * 32 = 224)
  for (let i = 0; i < 7; i++) {
    Buffer.alloc(32, i).copy(data, offset);
    offset += 32;
  }

  // Fees: 8 * u64 = 64 bytes
  for (let i = 0; i < 8; i++) {
    data.writeBigUInt64LE(BigInt(i * 1000), offset);
    offset += 8;
  }

  // SwapCurve: curve_type (1) + curve_data (32) = 33 bytes
  data.writeUInt8(0, offset); // curve_type
  offset += 1;
  Buffer.alloc(32, 42).copy(data, offset); // curve_data
  offset += 32;

  if (offset !== 324) {
    throw new Error(`Mock data length mismatch: got ${offset}, expected 324`);
  }
  return data;
}

describe("pack_to_anchor_format", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SarosSwapAnchor as Program<SarosSwapAnchor>;

  it("calls program locally, compares on-chain vs off-chain discriminator, and validates packed bytes", async () => {
    const testAccount = Keypair.generate();
    const swapData = createMockSwapV1Data();
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(swapData.length);

    const createAccountIx = SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: testAccount.publicKey,
      lamports,
      space: swapData.length,
      programId: program.programId,
    });
    const createTx = new Transaction().add(createAccountIx);
    await provider.sendAndConfirm(createTx, [testAccount]);

    const txSig = await program.methods
      .packToAnchorFormat(new anchor.BN(1), "SwapV1")
      .accounts({
        solanaAccount: testAccount.publicKey,
      })
      .rpc();

    const txDetails = await provider.connection.getTransaction(txSig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    expect(txDetails, "expected confirmed transaction").to.not.be.null;

    const expectedDiscriminator = Array.from(calculateDiscriminator("SwapV1"));
    const returnDataB64 = (txDetails as any)?.meta?.returnData?.data?.[0];
    expect(returnDataB64, "expected program return data").to.be.a("string");

    const raw = Buffer.from(returnDataB64 as string, "base64");

    const payloadLen = raw.readUInt32LE(0);
    const payload = raw.slice(4);

    expect(Array.from(payload.slice(0, 8))).to.deep.equal(expectedDiscriminator);

    const expectedPayloadLen = 8 + Math.max(0, swapData.length - 1);
    expect(payloadLen).to.equal(expectedPayloadLen);
    expect(payload.length).to.equal(expectedPayloadLen);
  });

  it("unpack_from_anchor_format: returns init_bytes + payload(after discriminator) with correct lengths", async () => {
    const testAccount = Keypair.generate();
  
    const originalLen = 324;
    const initBytesLen = 1;
    const anchorLikeLen = 8 + (originalLen - initBytesLen);
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(anchorLikeLen);
    const createAccountIx = SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: testAccount.publicKey,
      lamports,
      space: anchorLikeLen,
      programId: program.programId,
    });
    const createTx = new Transaction().add(createAccountIx);
    await provider.sendAndConfirm(createTx, [testAccount]);
  
    let txSig;
    try {
      txSig = await program.methods
        .unpackFromAnchorFormat()
        .accounts({
          solanaAccount: testAccount.publicKey,
        })
        .rpc();
    } catch (error) {
      console.error("Transaction failed:", error);
      throw error;
    }
  
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const txDetails = await provider.connection.getTransaction(txSig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    
    if (!txDetails) {
      console.log("Transaction signature:", txSig);
      console.log("Retrying with finalized commitment...");
      const finalizedTx = await provider.connection.getTransaction(txSig, {
        commitment: "finalized",
        maxSupportedTransactionVersion: 0,
      });
      expect(finalizedTx, "expected finalized transaction").to.not.be.null;
    }
    
    const actualTxDetails = txDetails || await provider.connection.getTransaction(txSig, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    });
    expect(actualTxDetails, "expected confirmed transaction").to.not.be.null;
  
    const returnDataB64 = (actualTxDetails as any)?.meta?.returnData?.data?.[0];
    expect(returnDataB64, "expected program return data").to.be.a("string");
  
    const raw = Buffer.from(returnDataB64 as string, "base64");
    const payloadLen = raw.readUInt32LE(0);
    const payload = raw.slice(4);
  
    const expectedPayloadLen = initBytesLen + Math.max(0, anchorLikeLen - 8);
    
    expect(payloadLen).to.equal(expectedPayloadLen);
    expect(payload.length).to.equal(expectedPayloadLen);
    expect(payload[0]).to.equal(0);
    expect(payload.slice(1, 8).every((b) => b === 0)).to.be.true;
    expect(expectedPayloadLen).to.equal(originalLen);
  });
});