import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SCRYPT_SALT = "clarwiz-linkup-account-id";

function getEncryptionKey() {
  const secret = process.env.SECRET?.trim();
  if (!secret) {
    throw new Error("SECRET is not configured");
  }
  return scryptSync(secret, SCRYPT_SALT, KEY_LENGTH);
}

/** Encrypts a LinkupAPI account_id for storage (AES-256-GCM, key derived from SECRET). */
export function encryptAccountId(plainText) {
  if (!plainText) {
    throw new Error("Cannot encrypt empty account id");
  }
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/** Decrypts a stored account_id. Supports legacy plaintext rows from before encryption. */
export function decryptAccountId(stored) {
  if (!stored) {
    throw new Error("Missing stored account id");
  }

  try {
    const buf = Buffer.from(stored, "base64");
    if (buf.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error("Ciphertext too short");
    }
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const key = getEncryptionKey();
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      "utf8"
    );
  } catch {
    // Pre-encryption rows stored the raw LinkupAPI account_id
    if (/^[a-f0-9]{24}$/i.test(stored)) {
      return stored;
    }
    throw new Error("Failed to decrypt LinkupAPI account id");
  }
}
