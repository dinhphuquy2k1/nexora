/** Observe disclosure interaction; never retry logout or an auth assertion. */
export async function openInteractiveAccountMenu({ until }) {
  await until(`(() => {
    if (document.readyState !== 'complete') return false;
    const trigger = document.querySelector('button[aria-label^="Tài khoản người dùng"]:not(:disabled)');
    if (!trigger) return false;
    if (trigger.getAttribute('aria-expanded') === 'true') return true;
    trigger.click();
    return false;
  })()`);
  await until(`(() => {
    const trigger = document.querySelector('button[aria-label^="Tài khoản người dùng"]');
    const panel = document.getElementById(trigger?.getAttribute('aria-controls'));
    return trigger?.getAttribute('aria-expanded') === 'true' &&
      !!panel?.querySelector('button[aria-label="Đăng xuất khỏi hệ thống"]:not(:disabled)');
  })()`);
}
