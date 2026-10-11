import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { randomUUID } from "node:crypto";
import {
  createDatabase,
  hashPassword,
} from "../packages/database/dist/index.js";

function readHiddenPassword(promptText) {
  return new Promise((resolve) => {
    output.write(promptText);
    const rl = createInterface({ input, output, terminal: true });

    // In raw mode, hide typed characters
    if (input.isTTY) {
      input.setRawMode(true);
      let password = "";
      const onData = (char) => {
        const c = char.toString("utf8");
        if (c === "\n" || c === "\r" || c === "\u0004") {
          input.setRawMode(false);
          input.removeListener("data", onData);
          output.write("\n");
          rl.close();
          resolve(password);
        } else if (c === "\u0003") {
          // Ctrl+C
          input.setRawMode(false);
          process.exit(1);
        } else if (c === "\b" || c === "\x7f") {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
        } else {
          password += c;
        }
      };
      input.on("data", onData);
    } else {
      // Non-TTY / piped input
      rl.question("").then((answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

export async function provisionUser(options = {}) {
  const databaseUrl =
    options.databaseUrl ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/nexora";

  const db = createDatabase(databaseUrl);

  try {
    let username = options.username;
    if (!username) {
      if (input.isTTY) {
        const rl = createInterface({ input, output });
        username = (await rl.question("Tên đăng nhập (username): ")).trim();
        rl.close();
      } else {
        throw new Error(
          "Tên đăng nhập không được để trống khi chạy non-interactive.",
        );
      }
    }

    if (!username || username.length < 3 || username.length > 50) {
      throw new Error("Tên đăng nhập phải từ 3 đến 50 ký tự.");
    }

    // Check existing
    const existing = await db.localUser.findUnique({
      where: { username },
    });
    if (existing) {
      throw new Error(`Tài khoản "${username}" đã tồn tại trên hệ thống.`);
    }

    let password = options.password;
    if (!password) {
      password = await readHiddenPassword("Mật khẩu: ");
      if (input.isTTY) {
        const confirm = await readHiddenPassword("Xác nhận mật khẩu: ");
        if (password !== confirm) {
          throw new Error("Mật khẩu xác nhận không khớp.");
        }
      }
    }

    if (!password || password.length < 8) {
      throw new Error("Mật khẩu phải có độ dài tối thiểu 8 ký tự.");
    }

    const passwordHash = await hashPassword(password);
    const id = randomUUID();

    await db.localUser.create({
      data: {
        id,
        username,
        passwordHash,
        isActive: true,
      },
    });

    console.log(
      `[OK] Đã khởi tạo tài khoản "${username}" thành công (ID: ${id}).`,
    );
    return { id, username };
  } finally {
    await db.$disconnect();
  }
}

// Direct CLI invocation
if (process.argv[1]?.endsWith("user-create.mjs")) {
  provisionUser()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`[ERROR] ${err.message}`);
      process.exit(1);
    });
}
