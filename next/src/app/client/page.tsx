'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PortalNavSetter } from '@/components/PortalShell';
import { getPublicServiceItems, type PublicServiceItem } from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { resolveAsset } from '@/lib/api';
import EmptyState from '@/components/EmptyState';

function ServiceCover({ item }: { item: PublicServiceItem }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4 / 3',
        overflow: 'hidden',
        borderRadius: 'var(--radius)',
        background: '#eef1f4',
      }}
    >
      {item.coverImage ? (
        // object-fit: cover 保证图片不变形，只裁剪溢出部分
        <img
          src={resolveAsset(item.coverImage)}
          alt={item.name}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-muted)',
            fontSize: 13,
          }}
        >
          暂无图片
        </div>
      )}
    </div>
  );
}

export default function ClientHome() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: QK.publicServices,
    queryFn: getPublicServiceItems,
  });

  return (
    <>
      <PortalNavSetter
        title="老马家电"
        menu={[{ label: '关于我们', href: '/client/about' }]}
      />
      <div className="laoma-container">
        <h3 style={{ margin: '18px 4px 10px', fontSize: 16 }}>推荐服务</h3>

        {isLoading ? (
          <p className="data-loading">加载中…</p>
        ) : items.length === 0 ? (
          <div className="card">
            <EmptyState text="暂无可预约的服务项目。" />
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 12,
            }}
          >
            {items.map((it) => (
              <Link
                key={it.id}
                href={`/client/services/${it.id}`}
                className="card"
                style={{ textDecoration: 'none', color: 'inherit', padding: 0, overflow: 'hidden' }}
              >
                <ServiceCover item={it} />
                <div style={{ padding: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.4 }}>{it.name}</div>
                  <div style={{ marginTop: 6, color: 'var(--color-primary-text)', fontWeight: 600 }}>
                    ¥{it.price}
                    {it.unit ? <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: 12 }}>/{it.unit}</span> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
