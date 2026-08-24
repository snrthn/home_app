'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { updateMasterMe, getApiErrorMsg } from '@/lib/api';
import { getCategoryTree, type ServiceCategoryNode } from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { useCurrentUser, fetchProfile } from '@/lib/useCurrentUser';
import { PortalNavSetter } from '@/components/PortalShell';
import { useToast } from '@/components/Toast';
import {
  PickerTrigger,
  RegionPickerModal,
  RegionCascader,
  CategoryPickerModal,
  formatRegionScope,
  FormCard,
  SubmitButton,
  type RegionValue,
} from '@/components/form';

// 类目扁平化（用于展示已选擅长技能名称）
interface FlatNode {
  id: string;
  name: string;
  parentId: string | null;
}
function flattenCategories(
  nodes: ServiceCategoryNode[],
  acc: FlatNode[] = [],
): FlatNode[] {
  nodes.forEach((n) => {
    acc.push({ id: n.id, name: n.name, parentId: n.parentId ?? null });
    if (n.children?.length) flattenCategories(n.children, acc);
  });
  return acc;
}

export default function AcceptSettingsPage() {
  useCurrentUser('master');
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: QK.profile('master'),
    queryFn: fetchProfile,
  });
  const profile = data;
  const master = profile?.master ?? {};

  const [skills, setSkills] = useState<string[]>([]);
  const [region, setRegion] = useState<RegionValue>({});
  const [serviceAreas, setServiceAreas] = useState<RegionValue[]>([]);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [areasOpen, setAreasOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // 类目树（与擅长技能弹窗共享），用于展示已选技能名称
  const { data: catTree = [] } = useQuery({
    queryKey: ['categoryTree'],
    queryFn: getCategoryTree,
  });
  const catNameMap = useMemo(() => {
    const m = new Map<string, string>();
    flattenCategories(catTree).forEach((n) => m.set(n.id, n.name));
    return m;
  }, [catTree]);

  // 地区去重 key（用于已选接单范围的移除）
  const regionScopeKey = (v: RegionValue) =>
    [v.provinceCode, v.cityCode, v.districtCode].filter(Boolean).join('/');

  useEffect(() => {
    if (!master) return;
    setSkills(Array.isArray(master.skills) ? (master.skills as string[]) : []);
    setRegion({
      province: master.province ?? null,
      provinceCode: master.provinceCode ?? null,
      city: master.city ?? null,
      cityCode: master.cityCode ?? null,
      district: master.district ?? null,
      districtCode: master.districtCode ?? null,
    });
    setServiceAreas(
      Array.isArray(master.serviceAreas)
        ? master.serviceAreas.map((s: any) => ({
            province: s.province ?? null,
            provinceCode: s.provinceCode ?? null,
            city: s.city ?? null,
            cityCode: s.cityCode ?? null,
            district: s.district ?? null,
            districtCode: s.districtCode ?? null,
          }))
        : [],
    );
  }, [master?.skills, master?.serviceAreas, master?.province, master?.city, master?.district]);

  const save = async () => {
    setSaving(true);
    try {
      await updateMasterMe({
        skills,
        province: region.province ?? undefined,
        provinceCode: region.provinceCode ?? undefined,
        city: region.city ?? undefined,
        cityCode: region.cityCode ?? undefined,
        district: region.district ?? undefined,
        districtCode: region.districtCode ?? undefined,
        serviceAreas: serviceAreas.map((s) => ({
          province: s.province ?? undefined,
          provinceCode: s.provinceCode ?? undefined,
          city: s.city ?? undefined,
          cityCode: s.cityCode ?? undefined,
          district: s.district ?? undefined,
          districtCode: s.districtCode ?? undefined,
        })),
      });
      qc.invalidateQueries({ queryKey: QK.profile('master') });
      toast.success('接单设置已保存');
    } catch (e: any) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const onBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/master/me');
  };

  return (
    <>
      <PortalNavSetter title="接单设置" showBack backHref="/master/me" onBack={onBack} />

      <div className="laoma-container">
        {/* 擅长技能：从服务类目树多选（与修改资料页同构） */}
        <FormCard
          title="擅长技能"
          extra={
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => setSkillsOpen(true)}
            >
              {skills.length ? `已选 ${skills.length} 项 · 修改` : '选择擅长技能'}
            </button>
          }
        >
          <PickerTrigger hint="从服务类目树选择你擅长的类目节点（可多选；选到业务域即覆盖其下所有服务），用于精准派单匹配">
            {skills.length > 0 && (
              <div className="region-chips" style={{ marginTop: 12 }}>
                {skills.map((id) => (
                  <span key={id} className="region-chip">
                    {catNameMap.get(id) ?? '未知类目'}
                    <button
                      type="button"
                      className="region-chip-remove"
                      aria-label="移除"
                      onClick={() => setSkills(skills.filter((x) => x !== id))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <CategoryPickerModal
              open={skillsOpen}
              onClose={() => setSkillsOpen(false)}
              value={skills}
              onChange={setSkills}
            />
          </PickerTrigger>
        </FormCard>

        {/* 所在地：单值常驻地址（原 master/me/edit 搬入，统一在此配置） */}
        <FormCard title="所在地">
          <PickerTrigger hint="你的常驻地址，作为接单范围的一条隐含规则（与接单范围并集判定），并影响本地公告可见性">
            <div style={{ marginTop: 12 }}>
              <RegionCascader value={region} onChange={setRegion} />
            </div>
          </PickerTrigger>
        </FormCard>

        {/* 接单范围：多省/市/区（与修改资料页同构） */}
        <FormCard
          title="接单范围"
          extra={
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => setAreasOpen(true)}
            >
              {serviceAreas.length ? `已选 ${serviceAreas.length} 项 · 修改` : '设置接单范围'}
            </button>
          }
        >
          <PickerTrigger hint="可添加多个省/市/区（仅选省即代表该省全部）。与所在地共同决定可见订单，两者都未配置时将看不到任何订单">
            {serviceAreas.length > 0 && (
              <div className="region-chips" style={{ marginTop: 12 }}>
                {serviceAreas.map((r) => (
                  <span key={regionScopeKey(r)} className="region-chip">
                    {formatRegionScope(r)}
                    <button
                      type="button"
                      className="region-chip-remove"
                      aria-label="移除"
                      onClick={() =>
                        setServiceAreas(
                          serviceAreas.filter((x) => regionScopeKey(x) !== regionScopeKey(r)),
                        )
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <RegionPickerModal
              open={areasOpen}
              onClose={() => setAreasOpen(false)}
              title="设置接单范围"
              value={serviceAreas}
              onChange={setServiceAreas}
            />
          </PickerTrigger>
        </FormCard>

        <div className="form-actions">
          <SubmitButton type="button" onClick={save} disabled={saving}>
            {saving ? '保存中…' : '保存设置'}
          </SubmitButton>
        </div>
      </div>
    </>
  );
}
