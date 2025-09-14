# @amir-razmi/solana-utils 🔗

A lightweight, **TypeScript-first** utility library for interacting with the **Solana blockchain**.  
It bundles multiple services — **transactions**, **transfers**, **token accounts**, **NFTs**, and **fees** — into a single, easy-to-use class.

Ideal for developers building wallets, NFT marketplaces, DeFi tools, or other Solana-powered projects.

---

## ✨ Features
- 🪙 **Token Operations** — Manage balances & associated token accounts.
- 🖼 **NFT Tools** — Retrieve NFTs owned by a wallet.
- 💰 **Fee Calculations** — Built-in withdraw and ATA creation fee estimations.
- ⛓ **Transaction Parsing** — Understand both SOL & SPL token transfer activity.
- 🛠 **Structured API** — Access grouped services via `.transactions`, `.transfers`, `.tokenAccounts`, `.nfts`, `.fees`.
- 📦 **TypeScript Ready** — Full typings for an autocomplete-powered development experience.

---

## 📦 Installation
```bash
npm install @amir-razmi/solana-utils
# or
yarn add @amir-razmi/solana-utils
# or
pnpm add @amir-razmi/solana-utils
```

### ⚡ Quick Usage
```javascript
import { SolanaUtils } from "@amir-razmi/solana-utils";

// Create SolanaUtils instance
export const solanaUtils = new SolanaUtils({
  rpcProvider: process.env.SOLANA_RPC_PROVIDER,
  solanaRPCUrl: process.env.SOLANA_RPC_URL,
  ownerWallet: { //Optional
    privateKey: process.env.OWNER_SOLANA_WALLET_PRIVATE_KEY,
    publicKey: process.env.OWNER_SOLANA_WALLET_ADDRESS,
  },
  feeAmount: { //Optional
    unavailableTokenAccount: 21e5,
    withdraw: 15e4,
  },
});

// Example 1 — Get a wallet's NFT list
(async () => {
  const nfts = await solanaUtils.nfts.getWalletNftList("WALLET_PUBLIC_KEY");
  console.log(nfts);
})();

// Example 2 — Get Token Balance
(async () => {
  await solanaUtils.tokenAccounts.getTokenBalance(
    "YOUR_PUBLIC_KEY",
    "MINT_ADDRESS",
  );
})();
```

## 📚 API Reference

Below are the main services and their methods.

### **transactions**
- `getTransactionData(signature: string)`
- `parseSOLTransferHash(signature: string)`
- `parseTokenTransferHash(signature: string)`
- `validateSignature(signature: string)`

### **transfers**
- `transferTokens(sender, recipient, mint, amount)`

### **tokenAccounts**
- `walletHaveAssociatedTokenAccount(wallet: string, mint: string)`
- `generateAssociatedTokenAccount(wallet: string, mint: string)`
- `getTokenBalance(wallet: string, mint: string)`
- `isSOL(mint: string)`

### **nfts**
- `getWalletNftList(wallet: string)`

### **fees**
- `calculateWithdrawFee()`

## 🛠 TypeScript Support
This package is **built with TypeScript** and ships with type definitions — designed for both JavaScript and TypeScript projects.

## 💡 Author
**Amirmohammad Razmi** — Node.js Backend Developer & Blockchain Enthusiast  
[GitHub](https://github.com/amirm-razmi) • [LinkedIn](https://www.linkedin.com/in/amir-mohammad-razmi-b85602217/) • [NPM](https://www.npmjs.com/~amir-razmi)

