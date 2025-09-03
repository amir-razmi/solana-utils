import * as splToken from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { IToken } from "../types/token.type";
import { isSOL } from "../utils/isSol.util";
import { sleep } from "../utils/sleep";
import { IWallet } from "./Solana.utils";

type ITransferSolanaTokenInput = {
  to: string;
  tokensAmount: { token: IToken; amount: number }[];
};

export default class TransferService {
  private ownerWallet?: { publicKey: PublicKey; keypair: Keypair };
  constructor(private solanaConnection: Connection, ownerWallet: IWallet) {
    if (ownerWallet) {
      this.ownerWallet = {
        publicKey: new PublicKey(ownerWallet.publicKey),
        keypair: Keypair.fromSecretKey(bs58.decode(ownerWallet.privateKey)),
      };
    }
  }
  async generateTokenTransferInstruction(
    token: IToken,
    amount: number,
    ownerPublicKey: PublicKey,
    ownerKeypair: Keypair,
    to: string
  ) {
    const { decimals } = token;
    const mintId = new PublicKey(token.mintId);
    const programId = new PublicKey(token.programId);

    const fromTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
      this.solanaConnection,
      ownerKeypair,
      mintId,
      ownerPublicKey
    );

    let associatedDestinationTokenAddr = null;

    for (let i = 0; i < 10; i++) {
      if (associatedDestinationTokenAddr) break;
      try {
        const associatedDestinationTokenAccount =
          await splToken.getOrCreateAssociatedTokenAccount(
            this.solanaConnection,
            ownerKeypair,
            mintId,
            new PublicKey(to)
          );

        associatedDestinationTokenAddr =
          associatedDestinationTokenAccount.address;
        break;
      } catch (error) {
        if (i < 9) await sleep(2000);
        else console.error(error);
      }
    }

    if (!associatedDestinationTokenAddr)
      throw new Error("Failed to generate transfer instruction");

    const instruction = splToken.createTransferCheckedInstruction(
      fromTokenAccount.address,
      mintId,
      associatedDestinationTokenAddr,
      ownerPublicKey,
      amount,
      decimals,
      [ownerPublicKey],
      programId
    );

    return instruction;
  }
  generateSOLTransferInstruction(
    amount: number,
    ownerPublicKey: PublicKey,
    to: string
  ) {
    return SystemProgram.transfer({
      fromPubkey: ownerPublicKey,
      toPubkey: new PublicKey(to),
      lamports: amount,
    });
  }
  async transferTokens(
    transferInputs: ITransferSolanaTokenInput[] | ITransferSolanaTokenInput,
    ownerWallet?: { walletAddress: string; privateKey: string }
  ) {
    try {
      if (!this.ownerWallet && !ownerWallet)
        throw new Error("Owner wallet data not found");

      const { keypair: ownerKeypair, publicKey: ownerPublicKey } = ownerWallet
        ? {
            publicKey: new PublicKey(ownerWallet.walletAddress),
            keypair: Keypair.fromSecretKey(bs58.decode(ownerWallet.privateKey)),
          }
        : this.ownerWallet!;

      const transaction = new Transaction();

      for (const { to, tokensAmount } of Array.isArray(transferInputs)
        ? transferInputs
        : [transferInputs]) {
        for (const { token, amount } of tokensAmount) {
          if (amount <= 0) continue;

          const instruction = isSOL(token.mintId)
            ? this.generateSOLTransferInstruction(amount, ownerPublicKey, to)
            : await this.generateTokenTransferInstruction(
                token,
                amount,
                ownerPublicKey,
                ownerKeypair,
                to
              );

          transaction.add(instruction);
        }
      }

      const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 100000,
      });
      transaction.add(addPriorityFee);

      const blockhash =
        await this.solanaConnection.getLatestBlockhashAndContext();

      transaction.recentBlockhash = blockhash.value.blockhash;
      transaction.lastValidBlockHeight = blockhash.value.lastValidBlockHeight;
      transaction.feePayer = ownerPublicKey;
      transaction.sign(ownerKeypair);
      const transactionSignature = await sendAndConfirmTransaction(
        this.solanaConnection,
        transaction,
        [ownerKeypair]
      );

      return {
        txHash: transactionSignature,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
