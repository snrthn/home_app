// 管理端侧边栏内联 SVG 图标集（纯展示组件，无状态）。
// 统一 18x18 / currentColor / 1.6 描边，跨平台一致，不依赖 emoji。

const paths: Record<string, JSX.Element> = {
  grid: (
    <>
      <rect x="3" y="3" width="6.5" height="6.5" rx="1.5" />
      <rect x="10.5" y="3" width="6.5" height="6.5" rx="1.5" />
      <rect x="3" y="10.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="10.5" y="10.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 6.5a3 3 0 0 1 0 5.8" />
      <path d="M16.5 14c2.2.5 3.5 2.3 3.5 5" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  truck: (
    <>
      <rect x="2" y="7" width="11" height="9" rx="1" />
      <path d="M13 10h5l3 3v3h-8z" />
      <circle cx="6" cy="17.5" r="1.6" />
      <circle cx="17" cy="17.5" r="1.6" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  chat: <path d="M4 5h16v11H10l-5 4v-4H4z" />,
  file: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h4" />
    </>
  ),
  chart: <path d="M5 20V11M12 20V4M19 20v-6" />,
  wallet: (
    <>
      <rect x="3" y="6" width="12" height="10" rx="2" />
      <path d="M15 10h1.6a1.4 1.4 0 0 1 1.4 1.4v1.2A1.4 1.4 0 0 1 16.6 14H15" />
      <circle cx="14.7" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  'chevron-right': <path d="M8 5l6 5-6 5" />,
  'chevron-left': <path d="M12 5l-6 5 6 5" />,
  dot: <circle cx="10" cy="10" r="2" />,
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const body = paths[name] ?? paths.dot;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {body}
    </svg>
  );
}
