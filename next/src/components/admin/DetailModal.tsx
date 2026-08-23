'use client';

import { useEscClose } from '@/lib/useEscClose';

/**
 * 详情弹窗（只读）：与 ConfirmModal / EditModal 同风格，
 * 用于用户、师傅等列表的「查看详情」场景。
 *
 * 用法（Descriptions 风格，推荐）：
 *   <DetailModal open={!!detail} title="用户详情" onClose={() => setDetail(null)}>
 *     <Descriptions title="基本信息">
 *       <Descriptions.Item label="手机号">{detail.phone}</Descriptions.Item>
 *       <Descriptions.Item label="昵称">{detail.nickname}</Descriptions.Item>
 *     </Descriptions>
 *   </DetailModal>
 *
 * 用法（旧版 DetailRow，兼容保留）：
 *   <DetailModal ...>
 *     <DetailRow label="手机号" value={detail.phone} />
 *   </DetailModal>
 */
export default function DetailModal({
  open,
  title,
  onClose,
  children,
  size = 'md',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEscClose(onClose);
  if (!open) return null;

  const sizeClass =
    size === 'lg' ? 'modal-lg' : size === 'sm' ? 'modal-sm' : 'modal-md';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={`modal-panel ${sizeClass}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>{title}</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Descriptions 描述列表                         */
/* -------------------------------------------------------------------------- */

/**
 * 描述列表：B 端常见的 label-value 分组展示组件（类 Ant Design Descriptions）。
 * - 自带分组标题 + 边框表格样式
 * - 默认 2 列布局，可通过 column 调整
 * - label 右对齐、带冒号，value 左对齐
 */
function DescriptionsImpl({
  title,
  column = 2,
  children,
  className,
}: {
  title?: string;
  column?: 1 | 2 | 3;
  children: React.ReactNode;
  className?: string;
}) {
  const gridClass =
    column === 1
      ? 'desc-grid-1'
      : column === 3
        ? 'desc-grid-3'
        : 'desc-grid-2';

  return (
    <div className={'desc-card ' + (className || '')}>
      {title && <div className="desc-card-title">{title}</div>}
      <div className={`desc-grid ${gridClass}`}>{children}</div>
    </div>
  );
}

/**
 * 描述项：label + value 的单元格。
 * - label 右对齐、120px 固定宽度、灰色字重 500、带冒号
 * - value 左对齐、主色字
 * - 可通过 span 跨列（预留，暂未实现，后续需要再加）
 */
function DescItem({
  label,
  children,
  value,
}: {
  label: string;
  children?: React.ReactNode;
  value?: string | number | null;
}) {
  const content = children ?? value;
  return (
    <div className="desc-item">
      <div className="desc-item-label">
        <span>{label}</span>
        <span className="desc-item-colon">：</span>
      </div>
      <div className="desc-item-value">
        {content != null && content !== '' ? (
          content
        ) : (
          <span className="desc-item-empty">—</span>
        )}
      </div>
    </div>
  );
}

// 组合式导出：Descriptions + Descriptions.Item
export const Descriptions = Object.assign(DescriptionsImpl, { Item: DescItem });

/* -------------------------------------------------------------------------- */
/*                                Tag 标签组件                                 */
/* -------------------------------------------------------------------------- */

/**
 * 轻量标签：用于技能、分类等多值展示，与 StatusBadge 风格呼应但更中性。
 */
export function Tag({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'blue' | 'green' }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

/* -------------------------------------------------------------------------- */
/*                               兼容旧版 DetailRow                            */
/* -------------------------------------------------------------------------- */

/**
 * 详情行：label + value 的两列布局（纵向堆叠）。
 * 保留用于简单场景，复杂分组建议用 Descriptions。
 */
export function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | number | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="field">
      <div className="field-label" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ color: 'var(--color-text-primary)', fontSize: 14, lineHeight: 1.6 }}>
        {children ?? value ?? <span style={{ color: 'var(--color-text-soft)' }}>—</span>}
      </div>
    </div>
  );
}
