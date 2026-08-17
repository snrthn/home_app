'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PortalNavSetter } from '@/components/PortalShell';
import { getServiceItem } from '@/lib/orders-api';
import { resolveAsset } from '@/lib/api';
import SanitizedHtml from '@/components/admin/SanitizedHtml';

export default function ServiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const serviceId = Array.isArray(id) ? id[0] : id;

  const { data: item, isLoading } = useQuery({
    queryKey: ['serviceDetail', serviceId],
    queryFn: () => getServiceItem(serviceId as string),
    enabled: !!serviceId,
  });

  return (
    <>
      <PortalNavSetter
        title="服务详情"
        showBack
        backHref="/client"
        onBack={() => {
          const sp = new URLSearchParams(window.location.search);
          const oid = sp.get('oid');
          if (sp.get('from') === 'order' && oid) {
            if (window.history.length > 1) router.back();
            else router.push(`/client/orders/${oid}`);
          } else if (window.history.length > 1) {
            router.back();
          } else {
            router.push('/client');
          }
        }}
      />
      <div className="laoma-container">
        {isLoading ? (
          <p className="field-hint">加载中…</p>
        ) : !item ? (
          <div className="card">
            <p className="field-hint">未找到该服务，可能已下架。</p>
          </div>
        ) : (
          <>
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 9',
                overflow: 'hidden',
                borderRadius: 'var(--radius)',
                background: '#eef1f4',
              }}
            >
              {item.coverImage ? (
                <img
                  src={resolveAsset(item.coverImage)}
                  alt={item.name}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)', fontSize: 14 }}>
                  暂无图片
                </div>
              )}
            </div>

            <div className="card" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>{item.name}</h2>
                <div style={{ color: 'var(--color-primary-text)', fontWeight: 700, fontSize: 18, whiteSpace: 'nowrap', marginLeft: 12 }}>
                  ¥{item.price}
                  {item.unit ? <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: 13 }}>/{item.unit}</span> : null}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, marginTop: 10, color: 'var(--color-text-soft)', fontSize: 13 }}>
                {item.category?.name && <span>类目：{item.category.name}</span>}
                {item.estimatedDuration ? <span>预计 {item.estimatedDuration} 分钟</span> : null}
              </div>

              {item.description ? (
                <div style={{ marginTop: 14 }}>
                  <div className="field-label" style={{ marginBottom: 4 }}>服务介绍</div>
                  <SanitizedHtml html={item.description} />
                </div>
              ) : null}
            </div>

            <div className="form-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => router.push(`/client/orders/new?serviceId=${item.id}`)}
              >
                去下单
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
