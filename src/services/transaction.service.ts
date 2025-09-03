import { Connection } from "@solana/web3.js";
import { ISolConfirmedTransaction } from "../types/solanaTransaction.type";
import { IToken } from "../types/token.type";
import { sleep } from "../utils/sleep";

export default class TransactionService {
  constructor(private solanaConnection: Connection) {}
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

    if (!transferInstruction) throw new Error("Invalid transaction");

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
    if (!confirmedTransaction) throw new Error("Transaction not found");

    const { postTokenBalances, preTokenBalances } = confirmedTransaction.meta;
    let to = "";
    let from = "";

    postTokenBalances.forEach((postValue) => {
      const preValue = preTokenBalances.filter(
        (j) => j.owner === postValue.owner
      )[0];
      if (!preValue) throw new Error("Pre value data not found");

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
    if (!transferInstruction) throw new Error("Invalid transaction hash");

    return {
      date: (+confirmedTransaction.blockTime || 1) * 1000,
      amount: +transferInstruction.parsed.info.tokenAmount.amount,
      from,
      to,
    };
  }
}
