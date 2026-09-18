// 纪事内容加密工具（构建期使用）
// 真加密：正文用 AES-256-GCM 加密成 Base64 写入页面，明文不进源码；
// 浏览器端用「答案」经 PBKDF2 派生密钥本地解密。
//
// 注意（纯静态站的安全边界）：密文+谜面都在页面里，懂技术且耐心的人可离线破解。
// 因此「答案」必须足够长且唯一（建议完整句子，而非单词/名字/生日）。

import { createCipheriv, randomBytes, pbkdf2Sync } from "node:crypto";

export interface LockPayload {
  question: string;
  hint?: string;
  answer: string; // 明文只在构建期使用，绝不写入产物
}

export interface EncryptedBlock {
  ciphertext: string; // base64
  salt: string; // base64
  iv: string; // base64
}

const PBKDF2_ITERATIONS = 120_000;
const KEY_LEN = 32;

// 答案经 PBKDF2 派生 AES 密钥（与浏览器端实现保持一致）
export function deriveKey(answer: string, salt: Buffer): Buffer {
  return pbkdf2Sync(answer.normalize("NFC").trim(), salt, PBKDF2_ITERATIONS, KEY_LEN, "sha256");
}

export function encryptContent(plaintext: string, answer: string): EncryptedBlock {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(answer, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // WebCrypto AES-GCM 期望 ciphertext 末尾携带 GCM tag，因此存储顺序为 [ciphertext | tag]
  const combined = Buffer.concat([ciphertext, tag]);
  return {
    ciphertext: combined.toString("base64"),
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
  };
}
