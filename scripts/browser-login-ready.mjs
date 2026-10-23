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
