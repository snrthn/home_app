'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PortalNavSetter } from '@/components/PortalShell';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RegionCascader } from '@/components/form/RegionCascader';
import { provinceOptions, getCities, getAreas, type RegionValue } from '@/data/region';
import { useUserStore } from '@/lib/user-store';
import type { UserInfo } from '@/lib/auth';
import {
  getMyAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  type Address,
} from '@/lib/orders-api';
import { QK } from '@/lib/query-keys';
import { getApiErrorMsg } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import EmptyState from '@/components/EmptyState';

const EMPTY_REGION: RegionValue = {
  province: null,
  provinceCode: null,
  city: null,
  cityCode: null,
  district: null,
  districtCode: null,
};

interface FormState {
  id?: string;
  contactName: string;
  contactPhone: string;
  region: RegionValue;
  detail: string;
  isDefault: boolean;
}

const EMPTY: FormState = {
  contactName: '',
  contactPhone: '',
  region: { ...EMPTY_REGION },
  detail: '',
  isDefault: false,
};

// 由 UserProfile 所在地构造级联默认值（带出用户所在区域，可改）
function userRegionValue(me?: UserInfo): RegionValue {
  if (!me) return { ...EMPTY_REGION };
  return {
    province: me.province ?? null,
    provinceCode: me.provinceCode ?? null,
    city: me.city ?? null,
    cityCode: me.cityCode ?? null,
    district: me.district ?? null,
    districtCode: me.districtCode ?? null,
  };
}

// 编辑既有地址时，优先使用已存储的 code（新数据已有），缺 code 时按名称反查兜底
function regionFromNames(
  province?: string | null,
  provinceCode?: string | null,
  city?: string | null,
  cityCode?: string | null,
  district?: string | null,
  districtCode?: string | null,
): RegionValue {
  // 新数据已有 code，直接用
  if (provinceCode || cityCode) {
    return {
      province: province ?? null,
      provinceCode: provinceCode ?? null,
      city: city ?? null,
      cityCode: cityCode ?? null,
      district: district ?? null,
      districtCode: districtCode ?? null,
    };
  }
  // 旧数据缺 code，按名称反查兜底
  const p = provinceOptions.find((o) => o.name === province);
  if (!p) {
    return {
      province: province ?? null,
      provinceCode: null,
      city: city ?? null,
      cityCode: null,
      district: district ?? null,
      districtCode: null,
    };
  }
  const cities = getCities(p.code);
  const c = cities.find((o) => o.name === city);
  if (!c) {
    return {
      province: p.name,
      provinceCode: p.code,
      city: city ?? null,
      cityCode: null,
      district: district ?? null,
      districtCode: null,
    };
  }
  const areas = getAreas(p.code, c.code);
  const d = areas.find((o) => o.name === district);
  return {
    province: p.name,
    provinceCode: p.code,
    city: c.name,
    cityCode: c.code,
    district: d?.name ?? null,
    districtCode: d?.code ?? null,
  };
}

export default function AddressBookPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const me = useUserStore((s) => s.users.customer);
  const { data: list = [], isLoading } = useQuery({
    queryKey: QK.myAddresses,
    queryFn: getMyAddresses,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const [delId, setDelId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: QK.myAddresses });

  const openCreate = () => {
    // 新建默认带出用户所在区域，可改
    setForm({ ...EMPTY, region: userRegionValue(me) });
    setOpen(true);
  };
  const openEdit = (a: Address) => {
    setForm({
      id: a.id,
      contactName: a.contactName,
      contactPhone: a.contactPhone,
      region: regionFromNames(a.province, a.provinceCode, a.city, a.cityCode, a.district, a.districtCode),
      detail: a.detail ?? '',
      isDefault: !!a.isDefault,
    });
    setOpen(true);
  };

  const save = async () => {
    if (
      !form.contactName.trim() ||
      !form.contactPhone.trim() ||
      !form.region.province ||
      !form.region.city ||
      !form.detail.trim()
    ) {
      toast.warning('请填写联系人、手机号、所在地区与详细地址');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        province: form.region.province?.trim() || null,
        provinceCode: form.region.provinceCode?.trim() || null,
        city: form.region.city!.trim(),
        cityCode: form.region.cityCode?.trim() || null,
        district: form.region.district?.trim() || null,
        districtCode: form.region.districtCode?.trim() || null,
        detail: form.detail.trim(),
        isDefault: form.isDefault,
      };
      if (form.id) {
        await updateAddress(form.id, payload);
        toast.success('地址已更新');
      } else {
        await createAddress(payload);
        toast.success('地址已保存');
      }
      setOpen(false);
      setForm(EMPTY);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (id: string) => {
    setSettingDefaultId(id);
    try {
      await setDefaultAddress(id);
      toast.success('已设为默认地址');
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setSettingDefaultId(null);
    }
  };

  const remove = async () => {
    if (!delId) return;
    try {
      await deleteAddress(delId);
      toast.success('地址已删除');
      setDelId(null);
      refresh();
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
      setDelId(null);
    }
  };

  return (
    <>
      <PortalNavSetter title="我的地址" showBack backHref="/client/me" />
      <div className="laoma-container" style={{ paddingBottom: 80 }}>
        {isLoading ? (
          <p className="field-hint">加载中…</p>
        ) : list.length === 0 ? (
          <div className="card">
            <EmptyState text="还没有保存的地址，点击下方「新增地址」开始添加。" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map((a) => (
              <div className="card" key={a.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 600, minWidth: 0 }}>
                    {a.contactName}
                    <span style={{ color: 'var(--color-muted)', fontWeight: 400, marginLeft: 8 }}>
                      {a.contactPhone}
                    </span>
                  </div>
                  {a.isDefault && <span className="tag" style={{ flex: '0 0 auto' }}>默认</span>}
                </div>
                <p className="field-hint" style={{ marginTop: 6, overflowWrap: 'anywhere' }}>
                  {[a.province, a.city, a.district, a.detail].filter(Boolean).join('')}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8 }}>
                  <span className="field-hint" style={{ margin: 0, flex: '1 1 auto', minWidth: 0, overflowWrap: 'anywhere' }}>
                    创建时间 {a.createdAt ? formatDateTime(a.createdAt) : '-'}
                  </span>
                  <div style={{ display: 'flex', gap: 14, flex: '0 0 auto' }}>
                    {!a.isDefault && (
                      <button
                        type="button"
                        className="btn-link"
                        disabled={settingDefaultId === a.id}
                        onClick={() => setDefault(a.id)}
                      >
                        设为默认
                      </button>
                    )}
                    <button type="button" className="btn-link" onClick={() => openEdit(a)}>
                      编辑
                    </button>
                    <button type="button" className="btn-link btn-link-danger" onClick={() => setDelId(a.id)}>
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bottom-fixed-bar">
          <button type="button" className="btn-primary" onClick={openCreate}>
            + 新增地址
          </button>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? '编辑地址' : '新增地址'} width="md">
        <div className="field">
          <label className="field-label">联系人</label>
          <input
            className="input"
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            placeholder="收货人姓名"
          />
        </div>
        <div className="field">
          <label className="field-label">手机号</label>
          <input
            className="input"
            value={form.contactPhone}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            placeholder="11 位手机号"
          />
        </div>
        <div className="field">
          <label className="field-label">所在地区</label>
          <RegionCascader
            value={form.region}
            onChange={(v) => setForm({ ...form, region: v })}
          />
        </div>
        <div className="field">
          <label className="field-label">详细地址</label>
          <input className="input" value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} placeholder="街道/门牌号" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          />
          <span className="field-label" style={{ margin: 0 }}>设为默认地址</span>
        </label>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={saving}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!delId}
        title="删除地址"
        message="确定删除该地址吗？此操作不可恢复。"
        confirmLabel="删除"
        onConfirm={remove}
        onCancel={() => setDelId(null)}
      />
    </>
  );
}
