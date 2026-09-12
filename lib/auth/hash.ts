import argon2 from "argon2";

export async function hashPassword(password: string): Promise<string> {
  // argon2.hash generates a fresh cryptographically random salt (16 bytes) for
  // every call and embeds it in the returned Argon2id PHC string. Never supply a
  // static salt — a unique salt per password defeats rainbow-table attacks.
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return argon2.verify(hash, password);
}
