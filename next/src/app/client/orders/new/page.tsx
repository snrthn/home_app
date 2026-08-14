'use client';

import { PortalNavSetter } from '@/components/PortalShell';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPublicServiceItems,
  getMyAddresses,
  createOrder,
} from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';

// 预约时段预设（服务商常用上门时段）
const TIME_SLOTS = [
  '09:00-11:00',
  '11:00-13:00',
  '13:00-15:00',
  '15:00-17:00',
  '17:00-19:00',
  '19:00-21:00',
];

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 预约「起码」时间校验：日期不早于今天；若选今天，时段起始不得早于当前时间
function validateAppointment(date: string, slot: string): string | null {
  if (!date) return null;
  const today = todayStr();
  if (date < today) return '预约日期不能早于今天';
  if (date === today && slot) {
    const start = slot.split('-')[0];
    if (start < nowHHMM()) return '预约时间不能早于当前时间';
  }
  return null;
}

function NewOrderForm() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const presetServiceId = searchParams.get('serviceId');

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: QK.publicServices,
    queryFn: getPublicServiceItems,
  });
  const { data: addresses = [], isLoading: addrLoading } = useQuery({
    queryKey: QK.myAddresses,
    queryFn: getMyAddresses,
  });

  const [serviceId, setServiceId] = useState(presetServiceId ?? '');
  const [addressId, setAddressId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentSlot, setAppointmentSlot] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 选择地址弹窗（选完即关；无地址时底部「新建」跳转地址维护页）
  const [addrPickerOpen, setAddrPickerOpen] = useState(false);

  const selectedItem = items.find((i) => i.id === serviceId);
  // 从首页/服务详情带 serviceId 进入时，锁定该服务、隐藏选择列表
  const presetMode = !!presetServiceId && !!selectedItem;
  const selectedAddress = addresses.find((a) => a.id === addressId);

  // 进入下单页自动预选默认地址（后端已按默认优先排序），无需每次手动点选
  useEffect(() => {
    if (addresses.length && !addressId) {
      const def = addresses.find((a) => a.isDefault) ?? addresses[0];
      setAddressId(def.id);
    }
  }, [addresses, addressId]);

  const submit = async () => {
    if (!serviceId) {
      toast.warning('请选择服务项目');
      return;
    }
    if (!addressId) {
      toast.warning('请选择服务地址');
      return;
    }
    const apptErr = validateAppointment(appointmentDate, appointmentSlot);
    if (apptErr) {
      toast.warning(apptErr);
      return;
    }
    setSubmitting(true);
    try {
      const order = await createOrder({
        serviceItemId: serviceId,
        addressId,
        appointmentDate: appointmentDate || undefined,
        appointmentSlot: appointmentSlot || undefined,
        remark: remark || undefined,
      });
      toast.success('下单成功，请完成支付');
      qc.invalidateQueries({ queryKey: QK.orderMine });
      router.push(`/client/orders/${order.id}`);
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PortalNavSetter title="下单" showBack backHref="/client/orders" />
      <div className="laoma-container">
        <div className="card">
          <div className="field">
            <label className="field-label">服务项目</label>
            {presetMode ? (
              <div className="card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{selectedItem!.name}</div>
                    <div className="field-hint" style={{ marginTop: 2 }}>
                      ¥{selectedItem!.price}
                      {selectedItem!.unit ? `/${selectedItem!.unit}` : ''}
                    </div>
                  </div>
                  <button type="button" className="btn-link btn-md" onClick={() => router.push('/client')}>
                    重选服务
                  </button>
                </div>
              </div>
            ) : itemsLoading ? (
              <p className="field-hint">加载中…</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className={`cell${serviceId === it.id ? ' cell-active' : ''}`}
                    onClick={() => setServiceId(it.id)}
                    style={{
                      border:
                        serviceId === it.id
                          ? '1px solid var(--color-primary)'
                          : '1px solid #eef0f2',
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    <span className="cell-label">{it.name}</span>
                    <span className="cell-value">¥{it.price}</span>
                  </button>
                ))}
                {items.length === 0 && <p className="field-hint">暂无可下单的服务项目</p>}
              </div>
            )}
            {!presetMode && selectedItem && (
              <p className="field-hint" style={{ marginTop: 6 }}>
                已选：{selectedItem.name}（¥{selectedItem.price}
                {selectedItem.unit ? `/${selectedItem.unit}` : ''}）
              </p>
            )}
          </div>

          <div className="field">
            <label className="field-label">服务地址</label>
            <button
              type="button"
              className="cell cell-block"
              onClick={() => setAddrPickerOpen(true)}
              style={{ textAlign: 'left', width: '100%' }}
            >
              {addrLoading ? (
                <span className="cell-label">加载中…</span>
              ) : selectedAddress ? (
                <>
                  <span className="cell-label">
                    {selectedAddress.contactName} {selectedAddress.contactPhone}
                    {selectedAddress.isDefault && (
                      <span className="tag" style={{ marginLeft: 6 }}>默认</span>
                    )}
                  </span>
                  <span className="cell-value">
                    {[selectedAddress.province, selectedAddress.city, selectedAddress.district, selectedAddress.detail]
                      .filter(Boolean)
                      .join('')}
                  </span>
                </>
              ) : (
                <span className="cell-label" style={{ color: 'var(--color-muted)' }}>
                  请选择服务地址
                </span>
              )}
            </button>
          </div>

          <div className="field">
            <label className="field-label">预约日期（选填）</label>
            <input
              className="input"
              type="date"
              min={todayStr()}
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label">预约时段（选填）</label>
            <select
              className="input"
              value={appointmentSlot}
              onChange={(e) => setAppointmentSlot(e.target.value)}
            >
              <option value="">不指定</option>
              {TIME_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label">备注（选填）</label>
            <textarea
              className="input textarea"
              rows={3}
              placeholder="特殊需求，如：重点清洁区域、有无电梯等"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={submitting}
              onClick={submit}
            >
              {submitting ? '提交中…' : '提交订单'}
            </button>
          </div>
        </div>
      </div>

      <Modal open={addrPickerOpen} onClose={() => setAddrPickerOpen(false)} title="选择服务地址" width="md">
        {addrLoading ? (
          <p className="field-hint">加载中…</p>
        ) : addresses.length === 0 ? (
          <p className="field-hint">还没有保存的地址，点击下方「新建地址」去添加。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {addresses.map((a) => (
              <button
                key={a.id}
                type="button"
                className="cell"
                onClick={() => {
                  setAddressId(a.id);
                  setAddrPickerOpen(false);
                }}
                style={{
                  border:
                    addressId === a.id
                      ? '1px solid var(--color-primary)'
                      : '1px solid #eef0f2',
                  borderRadius: 'var(--radius)',
                }}
              >
                <span className="cell-label">
                  {a.contactName} {a.contactPhone}
                  {a.isDefault && <span className="tag" style={{ marginLeft: 6 }}>默认</span>}
                </span>
                <span className="cell-value">
                  {[a.province, a.city, a.district, a.detail].filter(Boolean).join('')}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={() => setAddrPickerOpen(false)}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => router.push('/client/me/addresses')}
          >
            新建地址
          </button>
        </div>
      </Modal>
    </>
  );
}

// useSearchParams 需置于 Suspense 边界内，避免在预渲染阶段报错
export default function NewOrderPage() {
  return (
    <Suspense
      fallback={
        <>
          <PortalNavSetter title="下单" showBack backHref="/client" />
          <div className="laoma-container">
            <p className="field-hint">加载中…</p>
          </div>
        </>
      }
    >
      <NewOrderForm />
    </Suspense>
  );
}
