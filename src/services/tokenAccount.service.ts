import * as splToken from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { isSOL } from "../utils/isSol.util";

export default class TokenAccountService {
  constructor(private solanaConnection: Connection) {}

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

    if (!mintId || isSOL(mintId))
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
}
