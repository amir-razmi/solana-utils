import { Metaplex } from "@metaplex-foundation/js";
import { Connection, PublicKey } from "@solana/web3.js";

export default class NftService {
  metaplex: Metaplex;

  constructor(private solanaConnection: Connection) {
    this.metaplex = new Metaplex(this.solanaConnection);
  }

  async getWalletNftList(walletAddress: string) {
    const walletNftList = (await this.metaplex.nfts().findAllByOwner({
      owner: new PublicKey(walletAddress),
    })) as unknown as Record<string, string>[];
    return walletNftList.map((n) => (n.mintAddress ?? "").toString());
  }
}
