import { Metaplex } from "@metaplex-foundation/js";
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
import tweetnacl from "tweetnacl";
import { IToken } from "../types/token.type";
import { ISolConfirmedTransaction } from "../types/solanaTransaction.type";
import { sleep } from "../utils/sleep";
import { SOL_MINT_ADDRESS } from "../constants/sol.constant";

type ITransferSolanaTokenInput = {
  to: string;
  tokensAmount: { token: IToken; amount: number }[];
};

type ISolanaServiceConstructor = {
  solanaRPCUrl: string;
  ownerWallet: { privateKey: string; publicKey: string };
  feeAmount?: { withdraw: number; unavailableTokenAccount: number };
};

export class SolanaUtils {
  solanaConnection: Connection;
  metaplex: Metaplex;
  private ownerWallet?: { publicKey: PublicKey; keypair: Keypair };
  feeAmount = {
    withdraw: 0,
    unavailableTokenAccount: 0,
  };

  constructor({
    ownerWallet,
    solanaRPCUrl,
    feeAmount,
  }: ISolanaServiceConstructor) {
    this.solanaConnection = new Connection(solanaRPCUrl, {
      commitment: "confirmed",
    });

    this.metaplex = new Metaplex(this.solanaConnection);

    if (ownerWallet) {
      this.ownerWallet = {
        publicKey: new PublicKey(ownerWallet.publicKey),
        keypair: Keypair.fromSecretKey(bs58.decode(ownerWallet.privateKey)),
      };
    }

    if (feeAmount) this.feeAmount = feeAmount;
  }

  async getTransactionData(txHash: string, retries = 3) {
    let transactionData: ISolConfirmedTransaction | null = null;
    for (let i = 0; i < retries; i++) {
      transactionData = (await this.solanaConnection.getParsedTransaction(
        txHash
      )) as unknown as ISolConfirmedTransaction;
      if (transactionData) break;
      await sleep(3000);
    }

    return transactionData;
  }

  async calculateWithdrawFee(
    walletAddresses: string[] | string,
    withdrawingTokens: IToken[]
  ) {
    const walletAddressesCount = Array.isArray(walletAddresses)
      ? walletAddresses.length
      : 1;
    let requiredFee =
      this.feeAmount.withdraw *
      Math.ceil((walletAddressesCount * withdrawingTokens.length) / 5);

    for (const walletAddress of Array.isArray(walletAddresses)
      ? walletAddresses
      : [walletAddresses]) {
      for (const token of withdrawingTokens) {
        if (this.isSOL(token.mintId)) continue;
        const haveAssociatedAccount =
          await this.walletHaveAssociatedTokenAccount(
            token.mintId,
            walletAddress
          );
        if (!haveAssociatedAccount)
          requiredFee += this.feeAmount.unavailableTokenAccount;
      }
    }

    return requiredFee;
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
      throw new Error(
        "Failed to generate transfer instruction"
      );

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
  isSOL(mintId?: string) {
    return mintId?.toLowerCase() === SOL_MINT_ADDRESS.toLowerCase();
  }
  async transferTokens(
    transferInputs: ITransferSolanaTokenInput[] | ITransferSolanaTokenInput,
    ownerWallet?: { walletAddress: string; privateKey: string }
  ) {
    try {
      if (!this.ownerWallet && !ownerWallet)
        throw new Error(
          "Owner wallet data not found"
        );

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

          const instruction = this.isSOL(token.mintId)
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

  validateSignature(message: string, publicKey: string, signature: string) {
    const error = new Error("Invalid signature");
    try {
      const { sign } = tweetnacl;
      const isValid = sign.detached.verify(
        new Uint8Array(Buffer.from(message, "utf-8")),
        new Uint8Array(Buffer.from(signature, "base64")),
        new PublicKey(publicKey).toBytes()
      );
      if (!isValid) throw error;
    } catch {
      throw error;
    }
  }

  async parseSOLTransferHash(txHash: string, destination: string) {
    const txData = await this.getTransactionData(txHash, 6);
    if (!txData) throw new Error("Transaction not found");

    const transferInstruction = txData.transaction.message.instructions.find(
      (i) => {
        try {
          return (
            i.programId.toString() === "11111111111111111111111111111111" &&
            i.parsed.type === "transfer" &&
            i.parsed.info.destination.toLowerCase() ===
              destination.toLowerCase()
          );
        } catch {
          return false;
        }
      }
    );

    if (!transferInstruction)
      throw new Error("Invalid transaction");

    const [playerPreBalance, ownerPreBalance] = txData.meta.preBalances;
    const [playerPostBalance, ownerPostBalance] = txData.meta.postBalances;
    if (
      playerPreBalance === playerPostBalance ||
      ownerPreBalance === ownerPostBalance
    )
      throw Error("Transaction failed");

    return {
      date: (+txData.blockTime || 1) * 1000,
      from: transferInstruction.parsed.info.source.toLowerCase(),
      to: transferInstruction.parsed.info.destination,
      amount: transferInstruction.parsed.info.lamports ?? 0,
    };
  }

  async parseTokenTransferHash(
    txHash: string,
    token: IToken,
    destination: string
  ) {
    const confirmedTransaction = await this.getTransactionData(txHash);
    if (!confirmedTransaction)
      throw new Error("Transaction not found");

    const { postTokenBalances, preTokenBalances } = confirmedTransaction.meta;
    let to = "";
    let from = "";

    postTokenBalances.forEach((postValue) => {
      const preValue = preTokenBalances.filter(
        (j) => j.owner === postValue.owner
      )[0];
      if (!preValue)
        throw new Error("Pre value data not found");

      if (postValue.uiTokenAmount.uiAmount > preValue?.uiTokenAmount.uiAmount)
        to = postValue.owner;
      else if (
        postValue.uiTokenAmount.uiAmount < preValue?.uiTokenAmount.uiAmount
      )
        from = postValue.owner;
    });

    if (!to || destination.toLowerCase() !== to.toLowerCase())
      throw new Error("Wrong destination");

    const transferInstruction =
      confirmedTransaction.transaction.message.instructions.find(
        (instruction) => {
          return instruction.programId.toString() === token.programId;
        }
      );
    if (!transferInstruction)
      throw new Error("Invalid transaction hash");

    return {
      date: (+confirmedTransaction.blockTime || 1) * 1000,
      amount: +transferInstruction.parsed.info.tokenAmount.amount,
      from,
      to,
    };
  }

  async walletHaveAssociatedTokenAccount(
    mintId: string,
    walletAddress: string
  ) {
    const associatedWalletAddress = await splToken.getAssociatedTokenAddress(
      new PublicKey(mintId),
      new PublicKey(walletAddress)
    );

    const accountInfo = await this.solanaConnection.getAccountInfo(
      associatedWalletAddress
    );

    return !!accountInfo;
  }
  async generateAssociatedTokenAccount(
    mintId: string,
    walletAddress: string,
    privateKey: string
  ) {
    const account = await splToken.getOrCreateAssociatedTokenAccount(
      this.solanaConnection,
      Keypair.fromSecretKey(bs58.decode(privateKey)),
      new PublicKey(mintId),
      new PublicKey(walletAddress)
    );

    return account?.address.toString();
  }
  async getTokenBalance(walletAddress: string, mintId?: string) {
    const publicKey = new PublicKey(walletAddress);

    if (!mintId || this.isSOL(mintId))
      return await this.solanaConnection.getBalance(publicKey);

    const tokenAccounts = await splToken.getAssociatedTokenAddress(
      new PublicKey(mintId),
      publicKey
    );

    try {
      const tokenAccountInfo = await splToken.getAccount(
        this.solanaConnection,
        tokenAccounts
      );
      return parseInt(tokenAccountInfo.amount.toString());
    } catch (error) {
      return 0;
    }
  }
  async getWalletNftList(walletAddress: string) {
    const walletNftList = (await this.metaplex.nfts().findAllByOwner({
      owner: new PublicKey(walletAddress),
    })) as unknown as Record<string, string>[];
    return walletNftList.map((n) => (n.mintAddress ?? "").toString());
  }
}
