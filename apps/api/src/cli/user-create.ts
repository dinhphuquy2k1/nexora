import { stdin } from "node:process";
import { readTerminalLine, readPasswordStdin } from "./terminal-input";

function parseArguments(args: string[]): {
  username?: string;
  passwordStdin: boolean;
} {
  let username: string | undefined;
  let passwordStdin = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--password-stdin" && !passwordStdin) passwordStdin = true;
    else if (
      arg === "--username" &&
      !username &&
      args[i + 1] &&
      !args[i + 1].startsWith("-")
    )
      username = args[++i];
    else if (!arg.startsWith("-") && !username) username = arg;
    else
      throw new Error(
        "Usage: user-create [--username username] [--password-stdin]. Password arguments are forbidden.",
      );
  }
  return { username, passwordStdin };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parseArguments(args);
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL is required; use the approved API entrypoint.",
    );
  if (!stdin.isTTY && !options.passwordStdin)
    throw new Error("Noninteractive input requires explicit --password-stdin.");
  const username =
    options.username ?? (await readTerminalLine("Username: ", false));
  const password = options.passwordStdin
    ? await readPasswordStdin()
    : await readTerminalLine("Password: ", true);
  if (
    !options.passwordStdin &&
    password !== (await readTerminalLine("Confirm password: ", true))
  )
    throw new Error("Password confirmation does not match.");
  // Resolve database dependencies only after safe input/terminal cleanup.
  const { provisionUser } = await import(
    "../identity/infrastructure/user-provisioner"
  );
  await provisionUser(process.env.DATABASE_URL, username, password);
  console.log("Operator account created.");
}

if (require.main === module) {
  main().catch(() => {
    // Database/driver errors may include connection details; do not render their message.
    console.error(
      "Account provisioning failed. Check configuration, username uniqueness and password policy.",
    );
    process.exitCode = 1;
  });
}
