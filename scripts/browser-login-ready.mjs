/** Observe a real client interaction before native credential input into SSR markup. */
export async function waitForInteractiveLogin({ until, evaluate }) {
  await until(
    'document.readyState === "complete" && document.hasFocus() && !!document.querySelector("input[name=password]:not(:disabled)")',
  );
  // The server-rendered input exists before React attaches handlers. Only its native
  // visibility button can produce this transition; no credentials or form submit are retried.
  await until(`(() => {
    const input = document.querySelector('input[name="password"]');
    if (input?.type === 'text') return true;
    document.querySelector('button[aria-label="Hiện mật khẩu"]:not(:disabled)')?.click();
    return false;
  })()`);
  await evaluate(
    "document.querySelector('button[aria-label=\"Ẩn mật khẩu\"]').click()",
  );
  await until(
    'document.querySelector(\'input[name="password"]\')?.type === "password"',
  );
}

/** Observe harmless client disclosure interaction after full-document SSR navigation. */
export async function waitForInteractiveAccount({ until, evaluate }) {
  await until(
    `document.readyState === "complete" && document.hasFocus() && !!document.querySelector('button[aria-label^="Tài khoản người dùng"]')`,
  );
  await until(`(() => {
    const trigger = document.querySelector('button[aria-label^="Tài khoản người dùng"]');
    if (trigger?.getAttribute("aria-expanded") === "true" && document.querySelector('[role=region][aria-label="Thông tin tài khoản"]')) return true;
    // Only a harmless disclosure toggle is probed; mutations are never retried.
    trigger?.click();
    return false;
  })()`);
  await evaluate(
    "new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))",
  );
}
