import { PublicKey } from "@solana/web3.js";
import tweetnacl from "tweetnacl";

export const validateSignature = (
  message: string,
  publicKey: string,
  signature: string
) => {
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
};
