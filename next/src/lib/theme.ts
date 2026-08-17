// 主题色应用：由管理端配置的「主色 hex」推导整套品牌 CSS 变量，写入 :root。
// 覆盖 globals.css 中 :root 的 --color-primary* 系列，使全端主色可运营动态切换。
//
// 推导规则（与主色相对关系，近似原冷蓝配色梯度）：
//   --color-primary        = 主色本身
//   --color-primary-deep   = 主色加深 12%（hover / active）
//   --color-primary-weak   = 主色提亮 22%（弱按钮 / 浅处理）
//   --color-primary-soft   = 主色接近白 86%（选中 / hover 浅底）
//   --color-primary-text   = 主色加深 30%（标题 / 强调文字，保证可读性）

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '').trim();
  if (m.length === 3) {
    return [
      parseInt(m[0] + m[0], 16),
      parseInt(m[1] + m[1], 16),
      parseInt(m[2] + m[2], 16),
    ];
  }
  if (m.length === 6) {
    return [
      parseInt(m.slice(0, 2), 16),
      parseInt(m.slice(2, 4), 16),
      parseInt(m.slice(4, 6), 16),
    ];
  }
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => clamp(x).toString(16).padStart(2, '0'))
      .join('')
  );
}

// t∈[0,1]：0=原色，1=目标色
function mix(hex: string, target: [number, number, number], t: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  return rgbToHex(
    r * (1 - t) + target[0] * t,
    g * (1 - t) + target[1] * t,
    b * (1 - t) + target[2] * t,
  );
}

const darken = (hex: string, amt: number) => mix(hex, [0, 0, 0], amt);
const lighten = (hex: string, amt: number) => mix(hex, [255, 255, 255], amt);

/**
 * 将主色应用到 :root。hex 非法或为空时跳过（保留 globals.css 默认冷蓝）。
 */
export function applyThemeColor(hex?: string | null): void {
  if (typeof document === 'undefined') return; // SSR 保护
  if (!hex) return;
  const rgb = hexToRgb(hex);
  if (!rgb) return; // 非法 hex 不污染默认主题

  const root = document.documentElement;
  const normalized = rgbToHex(rgb[0], rgb[1], rgb[2]);
  root.style.setProperty('--color-primary', normalized);
  root.style.setProperty('--color-primary-deep', darken(normalized, 0.12));
  root.style.setProperty('--color-primary-weak', lighten(normalized, 0.22));
  root.style.setProperty('--color-primary-soft', lighten(normalized, 0.86));
  root.style.setProperty('--color-primary-text', darken(normalized, 0.3));
}
