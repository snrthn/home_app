'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { updateProfile, updateMasterMe } from '@/lib/api';
import { getCategoryTree, type ServiceCategoryNode } from '@/lib/admin-api';
import { QK } from '@/lib/query-keys';
import { useUserStore } from '@/lib/user-store';
import { useCurrentUser, fetchProfile } from '@/lib/useCurrentUser';
import { useToast } from '@/components/Toast';
import { PortalNavSetter } from '@/components/PortalShell';
import {
  Field,
  PickerTrigger,
  TextInput,
  Textarea,
  RadioGroup,
  RegionCascader,
  RegionPickerModal,
  CategoryPickerModal,
  formatRegionScope,
  SubmitButton,
  FormCard,
  AvatarField,
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

const BIO_MAX = 500;

export default function MasterMeEdit() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useCurrentUser('master');
  const setUser = useUserStore((s) => s.setUser);
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: QK.profile('master'),
    queryFn: fetchProfile,
  });

  const [saving, setSaving] = useState(false);
  const [masterStatus, setMasterStatus] = useState('');

  // 账户资料（UserProfile）
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('');
  const [gender, setGender] = useState('');
  const [birthday, setBirthday] = useState('');

  // 师傅专属资料（Master）
  const [realName, setRealName] = useState('');
  const [idCard, setIdCard] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [region, setRegion] = useState<RegionValue>({});
  const [serviceAreas, setServiceAreas] = useState<RegionValue[]>([]);
  const [bio, setBio] = useState('');
  const [serviceAreasPickerOpen, setServiceAreasPickerOpen] = useState(false);
  const [skillsPickerOpen, setSkillsPickerOpen] = useState(false);

  // 类目树（与擅长技能弹窗共享 queryKey，react-query 自动去重），用于展示已选技能名称
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
    if (!data) return;
    const p = data as any;
    setNickname(p.nickname ?? '');
    setAvatar(p.avatar ?? '');
    setGender(p.gender ?? '');
    setBirthday(p.birthday ? String(p.birthday).slice(0, 10) : '');
    setBio(p.bio ?? '');
    const m = p.master ?? {};
    setMasterStatus(m.status ?? '');
    setRealName(m.realName ?? '');
    setIdCard(m.idCard ?? '');
    setSkills(Array.isArray(m.skills) ? (m.skills as string[]) : []);
    setRegion({
      province: m.province ?? null,
      provinceCode: m.provinceCode ?? null,
      city: m.city ?? null,
      cityCode: m.cityCode ?? null,
      district: m.district ?? null,
      districtCode: m.districtCode ?? null,
    });
    setServiceAreas(
      Array.isArray(m.serviceAreas)
        ? m.serviceAreas.map((s: any) => ({
            province: s.province ?? null,
            provinceCode: s.provinceCode ?? null,
            city: s.city ?? null,
            cityCode: s.cityCode ?? null,
            district: s.district ?? null,
            districtCode: s.districtCode ?? null,
          }))
        : [],
    );
  }, [data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const [profileRes] = await Promise.all([
        updateProfile({
          nickname,
          avatar,
          gender: gender || undefined,
          birthday: birthday || undefined,
          bio,
        }),
        updateMasterMe({
          realName,
          idCard,
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
        }),
      ]);
      setUser('master', profileRes.data);
      queryClient.invalidateQueries({ queryKey: QK.profile('master') });
      toast.success('保存成功');
      router.push('/master/me');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="laoma-container">
        <div className="card">加载中…</div>
      </div>
    );
  }

  const statusPassed = masterStatus === 'active';

  return (
    <>
      <PortalNavSetter title="修改资料" showBack backHref="/master/me" />
      <div className="laoma-container me-page">
        <form id="master-me-edit-form" onSubmit={save}>
          <FormCard title="账户资料">
            <Field label="昵称">
              <TextInput value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="展示名称" />
            </Field>
            <Field label="头像" hint="支持本地上传，或填写图片 URL，留空则不显示头像">
              <AvatarField value={avatar} onChange={setAvatar} />
            </Field>
            <Field label="性别">
              <RadioGroup
                value={gender}
                onChange={setGender}
                options={[
                  { label: '男', value: 'male' },
                  { label: '女', value: 'female' },
                  { label: '保密', value: 'unknown' },
                ]}
              />
            </Field>
            <Field label="生日">
              <TextInput type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
            </Field>
          </FormCard>

          <FormCard title="师傅资料">
            <Field label="真实姓名" required>
              <TextInput value={realName} onChange={(e) => setRealName(e.target.value)} placeholder="用于接单实名" />
            </Field>
            <Field label="身份证号" hint="选填，用于实名认证">
              <TextInput value={idCard} onChange={(e) => setIdCard(e.target.value)} placeholder="选填" />
            </Field>
            <PickerTrigger
              label="擅长技能"
              buttonText={skills.length ? `已选 ${skills.length} 项 · 修改` : '选择擅长技能'}
              onOpen={() => setSkillsPickerOpen(true)}
              hint="从服务类目树选择你擅长的类目节点（可多选；选到业务域即覆盖其下所有服务），用于精准派单匹配"
            >
              {skills.length > 0 && (
                <div className="region-chips" style={{ marginTop: 8 }}>
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
                open={skillsPickerOpen}
                onClose={() => setSkillsPickerOpen(false)}
                value={skills}
                onChange={setSkills}
              />
            </PickerTrigger>
            <Field label="服务地区" required>
              <RegionCascader value={region} onChange={setRegion} />
            </Field>
            <PickerTrigger
              label="接单范围"
              buttonText={serviceAreas.length ? `已选 ${serviceAreas.length} 项 · 修改` : '设置接单范围'}
              onOpen={() => setServiceAreasPickerOpen(true)}
              hint="可添加多个省/市/区（仅选省即代表该省全部）。空 = 全平台可接单"
            >
              {serviceAreas.length > 0 && (
                <div className="region-chips" style={{ marginTop: 8 }}>
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
                open={serviceAreasPickerOpen}
                onClose={() => setServiceAreasPickerOpen(false)}
                title="设置接单范围"
                value={serviceAreas}
                onChange={setServiceAreas}
              />
            </PickerTrigger>
            <Field
              label="个人描述"
              hint={`选填，向客户介绍你的经验与服务特色（${bio.length}/${BIO_MAX}）`}
            >
              <Textarea
                value={bio}
                maxLength={BIO_MAX}
                onChange={(e) => setBio(e.target.value)}
                placeholder="例如：十年家电维修经验，擅长各品牌空调加氟与深度清洗，可预约周末上门"
              />
            </Field>
          </FormCard>
        </form>

        <div className="form-actions">
          <SubmitButton type="submit" form="master-me-edit-form" disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </SubmitButton>
        </div>

        {!statusPassed && (
          <p className="field-hint" style={{ marginTop: 12, marginBottom: 0 }}>
            资料修改后需重新提交审核，审核通过后方可接单。
          </p>
        )}
      </div>
    </>
  );
}
