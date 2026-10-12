import { createDatabase, hashPassword } from "@nexora/database";
import { normalizeUsername, isLoginPassword } from "../domain/credentials";

/** Trusted local CLI infrastructure, never exposed through HTTP. */
export async function provisionUser(
  databaseUrl: string,
  usernameInput: unknown,
  password: unknown,
): Promise<void> {
  const username = normalizeUsername(usernameInput);
  if (!username) throw new Error("Username must contain 3 to 50 characters.");
  if (!isLoginPassword(password) || password.length < 8)
    throw new Error("Password must contain 8 to 1024 characters.");
  if (!databaseUrl)
    throw new Error(
      "DATABASE_URL is required; use the approved API entrypoint.",
    );
  const db = createDatabase(databaseUrl);
  try {
    if (await db.localUser.findUnique({ where: { username } }))
      throw new Error("Username already exists.");
    await db.localUser.create({
      data: {
        username,
        passwordHash: await hashPassword(password),
        isActive: true,
      },
    });
  } finally {
    await db.$disconnect();
  }
}
