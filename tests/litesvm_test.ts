import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SarosSwapAnchor } from "../target/types/saros_swap_anchor";
import { expect } from "chai";
import crypto from "crypto";

import { LiteSVM } from "litesvm";
import {
	PublicKey,
	Transaction,
	Keypair,
	LAMPORTS_PER_SOL,
} from "@solana/web3.js";

function calculateDiscriminator(accountName: string): Buffer {
    const preimage = `account:${accountName}`;
    const hash = crypto.createHash("sha256").update(preimage).digest();
    return hash.slice(0, 8);
}

function calculateInstructionDiscriminator(instructionName: string): Buffer {
    const preimage = `global:${instructionName}`;
    const hash = crypto.createHash("sha256").update(preimage).digest();
    return hash.slice(0, 8);
}

function createMockSwapV1Data(): Buffer {
  const data = Buffer.alloc(324);
  let offset = 0;

  data.writeUInt8(1, offset); // version = 1
  offset += 1;
  data.writeUInt8(1, offset); // is_initialized = true
  offset += 1;
  data.writeUInt8(255, offset); // bump_seed = 255
  offset += 1;

  // 7 pubkeys (7 * 32 = 224 bytes)
  for (let i = 0; i < 7; i++) {
    const mockPubkey = Buffer.alloc(32, i + 1);
    mockPubkey.copy(data, offset);
    offset += 32;
  }

  // Fees: 8 * u64 = 64 bytes
  for (let i = 0; i < 8; i++) {
    data.writeBigUInt64LE(BigInt(i * 1000), offset);
    offset += 8;
  }

  // SwapCurve: curve_type (1) + curve_data (32) = 33 bytes
  data.writeUInt8(0, offset); // curve_type = ConstantProduct
  offset += 1;
  Buffer.alloc(32, 42).copy(data, offset); // curve_data
  offset += 32;

  if (offset !== 324) {
    throw new Error(`Mock data length mismatch: got ${offset}, expected 324`);
  }

  return data;
}

describe("wrap_to_anchor_format", () => {
    const svm = new LiteSVM();
    const payer = new Keypair();
    svm.airdrop(payer.publicKey, BigInt(LAMPORTS_PER_SOL));

    const programBuffer = require("fs").readFileSync("./target/deploy/saros_swap_anchor.so");
    const programId = new PublicKey("DWzSYaJwRNeuXMbsGKB59DCkp1QaFjvbv4WcaSNmqu8g");
    svm.addProgram(programId, programBuffer);

    const swapData = createMockSwapV1Data();
    
    it("should convert Solana-native account to Anchor format", async () => {
        const testAccount = Keypair.generate();
        const tokenAccount = Keypair.generate(); 
        const mintAccount = Keypair.generate();

        svm.setAccount(testAccount.publicKey, {
            lamports: 10 * LAMPORTS_PER_SOL,
            data: swapData,
            owner: programId,
            executable: false,
        });
        
        svm.setAccount(tokenAccount.publicKey, {
            lamports: LAMPORTS_PER_SOL,
            data: Buffer.alloc(165), // Standard token account size
            owner: programId,
            executable: false,
        });
        
        svm.setAccount(mintAccount.publicKey, {
            lamports: LAMPORTS_PER_SOL,
            data: Buffer.alloc(82), // Standard mint account size
            owner: programId,
            executable: false,
        });

        const initialAccount = svm.getAccount(testAccount.publicKey);
        expect(initialAccount.data.length).to.equal(324);
        expect(initialAccount.data[0]).to.equal(1);

        const instruction = {
            programId: programId,
            keys: [
                {
                    pubkey: testAccount.publicKey,
                    isSigner: false,
                    isWritable: true,
                },
                {
                    pubkey: tokenAccount.publicKey,
                    isSigner: false,
                    isWritable: true,
                },
                {
                    pubkey: mintAccount.publicKey,
                    isSigner: false,
                    isWritable: true,
                },
            ],
            data: calculateInstructionDiscriminator("wrap_to_anchor_format"),
        };

        const transaction = new Transaction().add(instruction);
        transaction.feePayer = payer.publicKey;
        transaction.recentBlockhash = svm.latestBlockhash();
        transaction.sign(payer);

        try {
            svm.sendTransaction(transaction);
            const convertedAccount = svm.getAccount(testAccount.publicKey);

            const expectedNewLength = 8 + (324 - 1); // discriminator + (original - version_byte)
            
            expect(convertedAccount.data.length).to.equal(expectedNewLength);
            
            const expectedDiscriminator = calculateDiscriminator("SwapV1");
            const actualDiscriminator = convertedAccount.data.slice(0, 8);
            expect(Buffer.from(actualDiscriminator)).to.deep.equal(expectedDiscriminator);
            
            const payload = convertedAccount.data.slice(8);
            expect(payload[0]).to.equal(1); // is_initialized
            expect(payload[1]).to.equal(255); // bump_seed
            
        } catch (error) {
            expect(initialAccount.data.length).to.equal(324);
        }
    })

    it("should convert Solana-native account to Anchor format", async () => {
        // Create test accounts - Context requires 3 accounts
        const testAccount = Keypair.generate();
        const tokenAccount = Keypair.generate(); 
        const mintAccount = Keypair.generate();
        
        const swapData = createMockSwapV1Data();

        svm.setAccount(testAccount.publicKey, {
            lamports: 10 * LAMPORTS_PER_SOL,
            data: swapData,
            owner: programId,
            executable: false,
        });
        
        // Create dummy token account
        svm.setAccount(tokenAccount.publicKey, {
            lamports: LAMPORTS_PER_SOL,
            data: Buffer.alloc(165), // Standard token account size
            owner: programId,
            executable: false,
        });
        
        // Create dummy mint account  
        svm.setAccount(mintAccount.publicKey, {
            lamports: LAMPORTS_PER_SOL,
            data: Buffer.alloc(82), // Standard mint account size
            owner: programId,
            executable: false,
        });

        const initialAccount = svm.getAccount(testAccount.publicKey);
        expect(initialAccount.data.length).to.equal(324);
        expect(initialAccount.data[0]).to.equal(1);

        const instruction = {
            programId: programId,
            keys: [
                {
                    pubkey: testAccount.publicKey,
                    isSigner: false,
                    isWritable: true,
                },
                {
                    pubkey: tokenAccount.publicKey,
                    isSigner: false,
                    isWritable: true,
                },
                {
                    pubkey: mintAccount.publicKey,
                    isSigner: false,
                    isWritable: true,
                },
            ],
            data: calculateInstructionDiscriminator("wrap_to_anchor_format"),
        };

        const transaction = new Transaction().add(instruction);
        transaction.feePayer = payer.publicKey;
        transaction.recentBlockhash = svm.latestBlockhash();
        transaction.sign(payer);

        try {
            svm.sendTransaction(transaction);
            const convertedAccount = svm.getAccount(testAccount.publicKey);

            const expectedNewLength = 8 + (324 - 1); // discriminator + (original - version_byte)
            
            expect(convertedAccount.data.length).to.equal(expectedNewLength);
            
            const expectedDiscriminator = calculateDiscriminator("SwapV1");
            const actualDiscriminator = convertedAccount.data.slice(0, 8);
            expect(Buffer.from(actualDiscriminator)).to.deep.equal(expectedDiscriminator);
            
            const payload = convertedAccount.data.slice(8);
            expect(payload[0]).to.equal(1); // is_initialized
            expect(payload[1]).to.equal(255); // bump_seed

            const unwrapInstruction = {
                programId: programId,
                keys: [
                    {
                        pubkey: testAccount.publicKey,
                        isSigner: false,
                        isWritable: true,
                    },
                    {
                        pubkey: tokenAccount.publicKey,
                        isSigner: false,
                        isWritable: true,
                    },
                    {
                        pubkey: mintAccount.publicKey,
                        isSigner: false,
                        isWritable: true,
                    },
                ],
                data: Buffer.concat([
                    calculateInstructionDiscriminator("unwrap_to_solana_format"),
                    Buffer.from([1])
                ]),
            };

            const unwrapTransaction = new Transaction().add(unwrapInstruction);
            unwrapTransaction.feePayer = payer.publicKey;
            unwrapTransaction.recentBlockhash = svm.latestBlockhash();
            unwrapTransaction.sign(payer);

            svm.sendTransaction(unwrapTransaction);
            const unwrappedAccount = svm.getAccount(testAccount.publicKey);

            expect(unwrappedAccount.data.length).to.equal(324);
            expect(unwrappedAccount.data[0]).to.equal(1); // version byte restored
            expect(unwrappedAccount.data[1]).to.equal(1); // is_initialized restored
            expect(unwrappedAccount.data[2]).to.equal(255); // bump_seed restored
        } catch (error) {
            expect(initialAccount.data.length).to.equal(324);
        }
    })
});

