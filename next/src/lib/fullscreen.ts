// 全屏切换工具函数，三端 header 共用。
// 浏览器安全策略：进入/退出全屏必须由用户手势（如 click/dblclick）触发，
// 因此不能在页面加载或路由跳转时自动进入全屏。

export function toggleFullscreen(): void {
  if (typeof document === 'undefined') return;
  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {
      /* 某些浏览器在非全屏时调用 exitFullscreen 会抛错，忽略即可 */
    });
  } else {
    document.documentElement.requestFullscreen?.().catch(() => {
      /* 用户未手势触发或浏览器不支持时会失败，静默降级 */
    });
  }
}

/**
 * 安全退出全屏：不抛错、不阻塞调用方。
 * 用于退出登录等场景——跳转到登录页时浏览器会保持全屏状态，
 * 需要手动解除（虽然跳转后全屏会自动退出，但为了体验一致性主动调用）。
 */
export function exitFullscreenSafe(): void {
  if (typeof document === 'undefined') return;
  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {});
  }
}
