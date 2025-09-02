export interface ISolConfirmedTransaction {
  blockTime: number;
  meta: Meta;
  slot: number;
  transaction: Transaction;
}

interface Meta {
  computeUnitsConsumed: number;
  err: null;
  fee: number;
  innerInstructions: string[];
  logMessages: string[];
  postBalances: number[];
  postTokenBalances: TokenBalance[];
  preBalances: number[];
  preTokenBalances: TokenBalance[];
  rewards: string[];
  status: Status;
}

interface TokenBalance {
  accountIndex: number;
  mint: string;
  owner: string;
  programId: string;
  uiTokenAmount: TokenAmount;
}

interface TokenAmount {
  amount: string;
  decimals: number;
  uiAmount: number;
  uiAmountString: string;
}

interface Status {
  Ok: null;
}

interface Transaction {
  message: Message;
  signatures: string[];
}

interface Message {
  accountKeys: AccountKey[];
  addressTableLookups: null;
  instructions: Instruction[];
  recentBlockhash: string;
}

interface AccountKey {
  pubkey: string;
  signer: boolean;
  source: string;
  writable: boolean;
}

interface Instruction {
  parsed: Parsed;
  program: string;
  programId: string;
}

interface Parsed {
  info: Info;
  type: string;
}

interface Info {
  authority: string;
  destination: string;
  mint: string;
  source: string;
  lamports?: number;
  tokenAmount: TokenAmount;
}
