import { stdin, stdout } from "node:process";
import { readTerminalLine } from "./terminal-input";
import { normalizeUsername } from "../identity/domain/credentials";
import {
  generateTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  matchTotpStep,
  encodeBase32,
} from "../identity/infrastructure/totp";

export async function main(args = process.argv.slice(2)): Promise<void> {
  if (args.length || !stdin.isTTY || !stdout.isTTY || !process.env.DATABASE_URL)
    throw new Error("MFA_ENROLLMENT_FAILED");
  const username = normalizeUsername(
    await readTerminalLine("ADMIN username: ", false),
  );
  if (!username) throw new Error("MFA_ENROLLMENT_FAILED");
  const password = await readTerminalLine("Nexora password: ", true);
  const { IdentityMfaAdapter } = await import(
    "../identity/infrastructure/mfa.adapter"
  );
  const { SecretCipher } = await import("../common/crypto/secret-cipher");
  const { EnvironmentKeyring } = await import(
    "../common/crypto/environment-keyring"
  );
  const adapter = new IdentityMfaAdapter(
    process.env.DATABASE_URL,
    new SecretCipher(new EnvironmentKeyring(process.env, "IDENTITY")),
  );
  try {
    await runEnrollment(
      adapter,
      (prompt, hidden) => readTerminalLine(prompt, hidden),
      (text) => {
        stdout.write(text);
      },
      username,
      password,
    );
  } finally {
    await adapter.onApplicationShutdown();
  }
}
export async function runEnrollment(
  adapter: Pick<
    import("../identity/infrastructure/mfa.adapter").IdentityMfaAdapter,
    "enrollmentIdentity" | "enroll"
  >,
  read: (prompt: string, hidden: boolean) => Promise<string>,
  write: (text: string) => void,
  username: string,
  password: string,
): Promise<void> {
  let secret: Buffer | undefined;
  try {
    const user = await adapter.enrollmentIdentity(username, password);
    secret = generateTotpSecret();
    const codes = generateRecoveryCodes();
    write(
      `Trusted local terminal only. Do not record or share this setup key.\nTOTP setup key: ${encodeBase32(secret)}\nIssuer: Nexora; account: ${username}; SHA1,6 digits,30 seconds.\n`,
    );
    const code = await read("Initial TOTP code: ", true);
    const step = matchTotpStep(secret, code, Date.now());
    if (step === null) throw new Error("MFA_ENROLLMENT_FAILED");
    await adapter.enroll(
      user.id,
      user.passwordHash,
      secret,
      step,
      codes.map((c) => hashRecoveryCode(c)!),
    );
    write(
      "MFA enrollment committed. Store these single-use recovery codes securely; shown once only.\n" +
        codes.join("\n") +
        "\n",
    );
  } finally {
    secret?.fill(0);
  }
}
if (require.main === module)
  main().catch(() => {
    console.error(
      "MFA enrollment failed. Check configuration, active ADMIN credentials, confirmation code and existing enrollment. No enrollment was overwritten.",
    );
    process.exitCode = 1;
  });
