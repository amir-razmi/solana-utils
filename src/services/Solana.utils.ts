import { Connection } from "@solana/web3.js";
import FeeService from "./fee.service";
import NftService from "./nft.service";
import TokenAccountService from "./tokenAccount.service";
import TransactionService from "./transaction.service";
import TransferService from "./transfer.service";
import { IRPCProviders } from "../types/rpcProviders.type";

export type IWallet = { privateKey: string; publicKey: string };

export type IFeeAmount = { withdraw: number; unavailableTokenAccount: number };

type ISolanaServiceConstructor = {
  rpcProvider: IRPCProviders;
  solanaRPCUrl: string;
  ownerWallet: IWallet;
  feeAmount?: IFeeAmount;
};

export class SolanaUtils {
  transactions: TransactionService;
  transfers: TransferService;
  tokenAccounts: TokenAccountService;
  nfts: NftService;
  fees: FeeService;

  constructor({
    rpcProvider,
    ownerWallet,
    solanaRPCUrl,
    feeAmount,
  }: ISolanaServiceConstructor) {
    const solanaConnection = new Connection(solanaRPCUrl, {
      commitment: "confirmed",
    });

    this.transactions = new TransactionService(solanaConnection);
    this.transfers = new TransferService(solanaConnection, ownerWallet, rpcProvider);
    this.tokenAccounts = new TokenAccountService(solanaConnection);
    this.nfts = new NftService(solanaConnection);
    this.fees = new FeeService(this.tokenAccounts, feeAmount);
  }
}
