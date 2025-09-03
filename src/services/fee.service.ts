import { IToken } from "../types/token.type";
import { isSOL } from "../utils/isSol.util";
import { IFeeAmount } from "./Solana.utils";
import TokenAccountService from "./tokenAccount.service";

export default class FeeService {
  feeAmount = {
    withdraw: 0,
    unavailableTokenAccount: 0,
  };

  constructor(
    private tokenAccountService: TokenAccountService,
    feeAmount?: IFeeAmount
  ) {
    if (feeAmount) this.feeAmount = feeAmount;
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
        if (isSOL(token.mintId)) continue;

        const haveAssociatedAccount =
          await this.tokenAccountService.walletHaveAssociatedTokenAccount(
            token.mintId,
            walletAddress
          );
        if (!haveAssociatedAccount)
          requiredFee += this.feeAmount.unavailableTokenAccount;
      }
    }

    return requiredFee;
  }
}
