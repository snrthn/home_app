import { PortalNavSetter } from '@/components/PortalShell';

export default function MasterHome() {
  return (
    <>
      <PortalNavSetter
        title="老马家电 · 师傅端"
        menu={[{ label: '关于我们', href: '/master/about' }]}
      />
      <div className="laoma-container">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>师傅端首页（占位）</h2>
          <p>抢单池 · 我的订单 · 上门打卡/照片 · 收款信息</p>
          <p style={{ color: 'var(--color-text-soft)' }}>
            MVP 骨架已就绪，业务页面后续填充。
          </p>
        </div>
      </div>
    </>
  );
}
