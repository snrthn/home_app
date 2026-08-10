import Link from 'next/link';

// 管理端首页（工作台）：默认落地页。统计为占位，业务数据后续接入。
export default function AdminHome() {
  const stats = [
    { label: '今日订单', value: '—' },
    { label: '待接单', value: '—' },
    { label: '在线师傅', value: '—' },
    { label: '本月营收', value: '—' },
  ];
  const quick = [
    { label: '订单管理', path: '/admin/orders' },
    { label: '师傅管理', path: '/admin/users/masters' },
    { label: '服务类目', path: '/admin/services/categories' },
    { label: '数据报表', path: '/admin/reports' },
  ];

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: 22 }}>工作台</h1>
      <p style={{ color: 'var(--color-text-soft)', marginTop: -4 }}>
        欢迎回来，这里是管理后台总览。
      </p>

      <div className="stat-grid">
        {stats.map((s) => (
          <div className="card stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, marginTop: 28, marginBottom: 12 }}>快捷入口</h2>
      <div className="quick-grid">
        {quick.map((q) => (
          <Link key={q.path} href={q.path} className="card quick-card">
            {q.label}
          </Link>
        ))}
      </div>

      <p style={{ color: 'var(--color-text-soft)', marginTop: 24, fontSize: 13 }}>
        提示：各业务模块页面为占位骨架，功能后续填充。
      </p>
    </div>
  );
}
