import { stdin, stdout } from "node:process";
import { StringDecoder } from "node:string_decoder";

/** A single raw reader: no readline renderer can independently echo a secret. */
export function readTerminalLine(
  prompt: string,
  hidden: boolean,
  input = stdin,
  output = stdout,
): Promise<string> {
  if (!input.isTTY)
    return Promise.reject(
      new Error("Interactive input requires a TTY; use --password-stdin."),
    );
  return new Promise((resolve, reject) => {
    const wasRaw = input.isRaw;
    const decoder = new StringDecoder("utf8");
    let value = "";
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      input.removeListener("data", onData);
      input.removeListener("end", onEnd);
      input.removeListener("close", onEnd);
      input.removeListener("error", onError);
      process.removeListener("SIGINT", onInterrupt);
      process.removeListener("SIGTERM", onInterrupt);
      let cleanupFailed = false;
      try {
        input.setRawMode(wasRaw);
      } catch {
        cleanupFailed = true;
      }
      try {
        input.pause();
        output.write("\n");
      } catch {
        cleanupFailed = true;
      }
      if (error || cleanupFailed)
        reject(error ?? new Error("Unable to restore terminal input."));
      else resolve(value);
    };
    const onEnd = () => finish(new Error("Input ended before confirmation."));
    const onError = () => finish(new Error("Unable to read terminal input."));
    const onInterrupt = () => finish(new Error("Operation cancelled."));
    const onData = (chunk: Buffer | string) => {
      for (const character of decoder.write(
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
      )) {
        if (character === "\r" || character === "\n") {
          finish();
          break;
        }
        if (character === "\u0003" || character === "\u0004") {
          onInterrupt();
          break;
        }
        if (character === "\b" || character === "\x7f") {
          const characters = [...value];
          if (characters.length) {
            characters.pop();
            value = characters.join("");
            if (!hidden) output.write("\b \b");
          }
        } else if (character >= " " && character !== "\x7f") {
          value += character;
          if (value.length > 1024) {
            finish(new Error("Input exceeds the allowed length."));
            break;
          }
          if (!hidden) output.write(character);
        }
      }
    };
    input.on("data", onData);
    input.once("end", onEnd);
    input.once("close", onEnd);
    input.once("error", onError);
    process.once("SIGINT", onInterrupt);
    process.once("SIGTERM", onInterrupt);
    try {
      input.setRawMode(true);
      output.write(prompt);
      input.resume();
    } catch {
      onError();
    }
  });
}

export async function readPasswordStdin(input = stdin): Promise<string> {
  let content = "";
  for await (const chunk of input) {
    content += chunk.toString("utf8");
    if (Buffer.byteLength(content, "utf8") > 4096)
      throw new Error("Password exceeds the allowed length.");
  }
  const password = content.replace(/[\r\n]+$/, "");
  if (password.includes("\n") || password.includes("\r"))
    throw new Error("Password stdin must contain one line.");
  return password;
}
