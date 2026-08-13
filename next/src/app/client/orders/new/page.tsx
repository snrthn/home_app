'use client';

import { PortalNavSetter } from '@/components/PortalShell';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPublicServiceItems,
  getMyAddresses,
  createAddress,
  createOrder,
  type Address,
} from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';

export default function NewOrderPage() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: QK.publicServices,
    queryFn: getPublicServiceItems,
  });
  const { data: addresses = [], isLoading: addrLoading } = useQuery({
    queryKey: QK.myAddresses,
    queryFn: getMyAddresses,
  });

  const [serviceId, setServiceId] = useState('');
  const [addressId, setAddressId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentSlot, setAppointmentSlot] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 新建地址弹窗
  const [addrOpen, setAddrOpen] = useState(false);
  const [aName, setAName] = useState('');
  const [aPhone, setAPhone] = useState('');
  const [aProvince, setAProvince] = useState('');
  const [aCity, setACity] = useState('');
  const [aDistrict, setADistrict] = useState('');
  const [aDetail, setADetail] = useState('');
  const [savingAddr, setSavingAddr] = useState(false);

  const selectedItem = items.find((i) => i.id === serviceId);

  const submit = async () => {
    if (!serviceId) {
      toast.warning('请选择服务项目');
      return;
    }
    if (!addressId) {
      toast.warning('请选择服务地址');
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

  const saveAddress = async () => {
    if (!aName.trim() || !aPhone.trim() || !aCity.trim() || !aDetail.trim()) {
      toast.warning('请填写完整地址');
      return;
    }
    setSavingAddr(true);
    try {
      const addr: Address = await createAddress({
        contactName: aName.trim(),
        contactPhone: aPhone.trim(),
        province: aProvince.trim() || null,
        city: aCity.trim(),
        district: aDistrict.trim() || null,
        detail: aDetail.trim(),
      });
      toast.success('地址已保存');
      qc.invalidateQueries({ queryKey: QK.myAddresses });
      setAddressId(addr.id);
      setAddrOpen(false);
      setAName('');
      setAPhone('');
      setAProvince('');
      setACity('');
      setADistrict('');
      setADetail('');
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setSavingAddr(false);
    }
  };

  return (
    <>
      <PortalNavSetter title="下单" showBack backHref="/client/orders" />
      <div className="laoma-container">
        <div className="card">
          <div className="field">
            <label className="field-label">服务项目</label>
            {itemsLoading ? (
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
            {selectedItem && (
              <p className="field-hint" style={{ marginTop: 6 }}>
                已选：{selectedItem.name}（¥{selectedItem.price}
                {selectedItem.unit ? `/${selectedItem.unit}` : ''}）
              </p>
            )}
          </div>

          <div className="field">
            <label className="field-label">服务地址</label>
            {addrLoading ? (
              <p className="field-hint">加载中…</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {addresses.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="cell"
                    onClick={() => setAddressId(a.id)}
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
                      {a.isDefault && (
                        <span className="tag" style={{ marginLeft: 6 }}>默认</span>
                      )}
                    </span>
                    <span className="cell-value">
                      {[a.province, a.city, a.district, a.detail].filter(Boolean).join('')}
                    </span>
                  </button>
                ))}
                <button type="button" className="btn-secondary btn-md" onClick={() => setAddrOpen(true)}>
                  + 新建地址
                </button>
              </div>
            )}
          </div>

          <div className="field">
            <label className="field-label">预约日期（选填）</label>
            <input
              className="input"
              type="date"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label">预约时段（选填）</label>
            <input
              className="input"
              placeholder="如：上午 9:00-11:00"
              value={appointmentSlot}
              onChange={(e) => setAppointmentSlot(e.target.value)}
            />
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

      <Modal open={addrOpen} onClose={() => setAddrOpen(false)} title="新建地址" width="md">
        <div className="field">
          <label className="field-label">联系人</label>
          <input className="input" value={aName} onChange={(e) => setAName(e.target.value)} placeholder="收货人姓名" />
        </div>
        <div className="field">
          <label className="field-label">手机号</label>
          <input className="input" value={aPhone} onChange={(e) => setAPhone(e.target.value)} placeholder="11 位手机号" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">省</label>
            <input className="input" value={aProvince} onChange={(e) => setAProvince(e.target.value)} placeholder="选填" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">市</label>
            <input className="input" value={aCity} onChange={(e) => setACity(e.target.value)} placeholder="如：深圳市" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">区</label>
            <input className="input" value={aDistrict} onChange={(e) => setADistrict(e.target.value)} placeholder="选填" />
          </div>
        </div>
        <div className="field">
          <label className="field-label">详细地址</label>
          <input className="input" value={aDetail} onChange={(e) => setADetail(e.target.value)} placeholder="街道/门牌号" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={() => setAddrOpen(false)} disabled={savingAddr}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={saveAddress} disabled={savingAddr}>
            {savingAddr ? '保存中…' : '保存'}
          </button>
        </div>
      </Modal>
    </>
  );
}
