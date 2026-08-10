import { PortalNavSetter } from '@/components/PortalShell';

export default function ClientHome() {
  return (
    <>
      <PortalNavSetter
        title="老马家电"
        menu={[{ label: '关于我们', href: '/client/about' }]}
      />
      <div className="laoma-container">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>客户端首页（占位）</h2>
          <p>选城市 → 选服务 → 下单 → 上门 → 付款 → 评价</p>
          <p style={{ color: 'var(--color-text-soft)' }}>
            MVP 骨架已就绪，业务页面后续填充。
          </p>
        </div>
      </div>
    </>
  );
}
