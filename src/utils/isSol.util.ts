import { SOL_MINT_ADDRESS } from "../constants/sol.constant";

export const isSOL = (mintId?: string) => {
  return mintId?.toLowerCase() === SOL_MINT_ADDRESS.toLowerCase();
};
