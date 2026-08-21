'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAllOrders,
  assignOrder,
  getOrderCandidates,
  getDispatchStats,
  type OrderLite,
  type CandidateMaster,
  type DispatchStats,
} from '@/lib/orders-api';
import { getMasters, type MasterUser } from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { useOrderSocket } from '@/lib/useOrderSocket';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { formatDateTime } from '@/lib/format';

function addrShort(o: OrderLite) {
  const a = o.address;
  if (!a) return '-';
  return [a.city, a.district].filter(Boolean).join(' ');
}

function poolDuration(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时${min % 60} 分`;
  return `${Math.floor(h / 24)} 天`;
}

export default function DispatchSmartPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<{ order: OrderLite; masterId: string; masterName: string } | null>(null);
  const [acting, setActing] = useState(false);
  const [showAllMasters, setShowAllMasters] = useState(false);

  const { data: allOrders = [], isLoading } = useQuery<OrderLite[]>({
    queryKey: QK.orderAll,
    queryFn: () => getAllOrders(),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const pendingOrders = useMemo(
    () => allOrders.filter((o) => o.status === 'pending_accept' && !o.master),
    [allOrders],
  );

  useEffect(() => {
    if (selectedId && !pendingOrders.find((o) => o.id === selectedId)) {
      setSelectedId(null);
    }
  }, [pendingOrders, selectedId]);

  const selectedOrder = pendingOrders.find((o) => o.id === selectedId) ?? null;

  const { data: candidates = [], isLoading: candLoading } = useQuery<CandidateMaster[]>({
    queryKey: ['dispatch', 'candidates', selectedId],
    queryFn: () => getOrderCandidates(selectedId!),
    enabled: !!selectedId,
    refetchOnMount: 'always',
  });

  const { data: allMasters = [] } = useQuery<MasterUser[]>({
    queryKey: ['dispatch', 'allMasters'],
    queryFn: () => getMasters({ status: 'active' }),
    enabled: showAllMasters,
  });

  // 派单看板统计（Phase 2）：待派/超时/在岗师傅/今日已派/平均接单时长
  const { data: stats } = useQuery<DispatchStats>({
    queryKey: QK.dispatchStats,
    queryFn: () => getDispatchStats(),
    refetchOnMount: 'always',
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: QK.orderAll });
    qc.invalidateQueries({ queryKey: QK.dispatchStats });
    if (selectedId) qc.invalidateQueries({ queryKey: ['dispatch', 'candidates', selectedId] });
  };

  // WS 实时刷新：订单入池 / 被接走 / 自动派单完成时后端推送 dashboard-refresh → 重拉列表与看板，
  // 不再依赖手动刷新（docs/dispatch-design.md §4.2）
  useOrderSocket({ onDashboardRefresh: refresh });

  const confirmAssign = async () => {
    if (!assignTarget) return;
    setActing(true);
    try {
      await assignOrder(assignTarget.order.id, assignTarget.masterId);
      toast.success(`已指派给${assignTarget.masterName}`);
      setAssignTarget(null);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h2>智能派单</h2>
        <span className="page-sub">共 {pendingOrders.length} 单待派</span>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
          <div className="card" style={{ padding: '12px 14px' }}>
            <div className="field-hint" style={{ fontSize: 12 }}>待派订单</div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                marginTop: 2,
                color: stats.overdueCount > 0 ? 'var(--color-danger-text, #A32D2D)' : 'var(--color-text-primary)',
              }}
            >
              {stats.pendingCount}
            </div>
            <div
              className="field-hint"
              style={{ color: stats.overdueCount > 0 ? 'var(--color-danger-text, #A32D2D)' : undefined }}
            >
              {stats.overdueCount > 0 ? `超时 ${stats.overdueCount} 单` : '无超时'}
            </div>
          </div>
          <div className="card" style={{ padding: '12px 14px' }}>
            <div className="field-hint" style={{ fontSize: 12 }}>在岗师傅</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>{stats.activeMasterCount}</div>
            <div className="field-hint">可接单</div>
          </div>
          <div className="card" style={{ padding: '12px 14px' }}>
            <div className="field-hint" style={{ fontSize: 12 }}>今日已派</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>{stats.todayAssigned}</div>
            <div className="field-hint">含抢单 + 指派</div>
          </div>
          <div className="card" style={{ padding: '12px 14px' }}>
            <div className="field-hint" style={{ fontSize: 12 }}>今日新单</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>{stats.todayCreated}</div>
            <div className="field-hint">全状态</div>
          </div>
          <div className="card" style={{ padding: '12px 14px' }}>
            <div className="field-hint" style={{ fontSize: 12 }}>平均接单时长</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>
              {stats.avgAcceptMinutes}
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-tertiary)' }}> 分钟</span>
            </div>
            <div className="field-hint">
              {stats.autoDispatchEnabled
                ? `超时 ${Math.round(stats.timeoutMs / 60000)} 分钟自动派单`
                : '自动派单已关闭'}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="field-hint">加载中…</p>
      ) : pendingOrders.length === 0 ? (
        <div className="card">
          <EmptyState text="暂无待派订单，新支付订单会自动出现在这里。" />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: '38%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingOrders.map((o) => {
              const active = o.id === selectedId;
              const isOverdue =
                !!stats &&
                stats.timeoutMs > 0 &&
                Date.now() - new Date(o.createdAt).getTime() > stats.timeoutMs;
              return (
                <div
                  key={o.id}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    border: active ? '2px solid var(--color-primary)' : '1px solid var(--color-border-tertiary)',
                    padding: 14,
                  }}
                  onClick={() => { setSelectedId(o.id); setShowAllMasters(false); }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{o.serviceItem?.name ?? '家政服务'}</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-primary-text)' }}>¥{o.amount}</span>
                  </div>
                  <div className="field-hint" style={{ marginTop: 6 }}>
                    {o.orderNo}
                  </div>
                  <div className="field-hint">
                    {addrShort(o)} · 联系人 {o.address?.contactName}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <span className="field-hint">{formatDateTime(o.createdAt)}</span>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {isOverdue && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: '#fff',
                            background: '#A32D2D',
                            padding: '1px 6px',
                            borderRadius: 4,
                          }}
                        >
                          已超时
                        </span>
                      )}
                      <span
                        className="field-hint"
                        style={{
                          color: isOverdue ? 'var(--color-danger-text, #A32D2D)' : 'var(--color-warning, #EF9F27)',
                          fontWeight: 500,
                        }}
                      >
                        入池 {poolDuration(o.createdAt)}
                      </span>
                    </span>
                  </div>
                  {o.appointmentDate && (
                    <div className="field-hint" style={{ marginTop: 4 }}>
                      预约 {[o.appointmentDate.slice(0, 10), o.appointmentSlot].filter(Boolean).join(' ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {!selectedOrder ? (
              <div className="card">
                <EmptyState text="从左侧选择一个待派订单，查看推荐师傅。" />
              </div>
            ) : (
              <>
                <div className="card" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>
                      {selectedOrder.serviceItem?.name ?? '家政服务'}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-primary-text)' }}>
                      ¥{selectedOrder.amount}
                    </span>
                  </div>
                  <div className="field-hint" style={{ marginTop: 6 }}>
                    单号 {selectedOrder.orderNo}
                  </div>
                  <div className="field-hint">
                    地址 {[selectedOrder.address?.city, selectedOrder.address?.district, selectedOrder.address?.detail]
                      .filter(Boolean)
                      .join(' ')}
                  </div>
                  <div className="field-hint">
                    联系人 {selectedOrder.address?.contactName} · {selectedOrder.address?.contactPhone}
                  </div>
                  {selectedOrder.appointmentDate && (
                    <div className="field-hint">
                      预约 {[selectedOrder.appointmentDate.slice(0, 10), selectedOrder.appointmentSlot]
                        .filter(Boolean)
                        .join(' ')}
                    </div>
                  )}
                </div>

                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8, color: 'var(--color-text-secondary)' }}>
                  推荐师傅{candidates.length > 0 ? `（${candidates.length} 人匹配）` : ''}
                </div>

                {candLoading ? (
                  <p className="field-hint">加载推荐中…</p>
                ) : candidates.length === 0 && !showAllMasters ? (
                  <div className="card">
                    <EmptyState text="该订单服务区域内暂无在岗师傅。" />
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setShowAllMasters(true)}
                      >
                        查看全部在岗师傅
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(showAllMasters ? allMasters.map((m) => ({
                      masterId: m.id,
                      realName: m.realName,
                      phone: m.user?.phone ?? null,
                      skillMatch: false,
                      skillMatchDetail: null,
                      matchedCategoryName: null,
                      conflict: false,
                      conflictOrderNo: null,
                      activeOrderCount: 0,
                      rating: Number(m.rating),
                      orderCount: m.orderCount,
                    })) : candidates).map((m, idx) => (
                      <div
                        key={m.masterId}
                        className="card"
                        style={{
                          padding: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 500, fontSize: 14 }}>{m.realName}</span>
                            {m.skillMatch && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 500,
                                  color: 'var(--color-success-text, #085041)',
                                  background: 'var(--color-success-bg, #E1F5EE)',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                }}
                              >
                                {m.skillMatchDetail === 'ancestor'
                                  ? `父类目覆盖${m.matchedCategoryName ? `（${m.matchedCategoryName}）` : ''}`
                                  : '技能匹配'}
                              </span>
                            )}
                            {m.conflict && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 500,
                                  color: '#8A5A00',
                                  background: '#FFF4E0',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                }}
                                title={`该师傅 ${m.conflictOrderNo ?? ''} 已预约同一时段`}
                              >
                                时段冲突{m.conflictOrderNo ? `（${m.conflictOrderNo}）` : ''}
                              </span>
                            )}
                            {idx === 0 && !showAllMasters && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 500,
                                  color: 'var(--color-primary-text)',
                                  background: 'var(--color-primary-bg, #EEEDFE)',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                }}
                              >
                                推荐
                              </span>
                            )}
                          </div>
                          <div className="field-hint" style={{ marginTop: 4 }}>
                            {m.phone ?? '无电话'}
                            {' · '}在手 {m.activeOrderCount} 单
                            {' · '}评分 {m.rating.toFixed(1)}
                            {' · '}{m.orderCount} 单经验
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          onClick={() => setAssignTarget({ order: selectedOrder, masterId: m.masterId, masterName: m.realName })}
                        >
                          指派
                        </button>
                      </div>
                    ))}

                    {!showAllMasters && candidates.length > 0 && (
                      <div style={{ textAlign: 'center', paddingTop: 4 }}>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => setShowAllMasters(true)}
                        >
                          没有合适的？查看全部在岗师傅
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!assignTarget}
        title="确认指派"
        message={
          assignTarget
            ? `将订单 ${assignTarget.order.orderNo}（${assignTarget.order.serviceItem?.name ?? ''}）指派给 ${assignTarget.masterName}？`
            : ''
        }
        confirmLabel="确认指派"
        loading={acting}
        onConfirm={confirmAssign}
        onCancel={() => setAssignTarget(null)}
      />
    </>
  );
}
