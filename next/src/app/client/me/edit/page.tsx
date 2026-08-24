'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { updateProfile } from '@/lib/api';
import { QK } from '@/lib/query-keys';
import { useUserStore } from '@/lib/user-store';
import { useCurrentUser, fetchProfile } from '@/lib/useCurrentUser';
import { useToast } from '@/components/Toast';
import { PortalNavSetter } from '@/components/PortalShell';
import {
  Field,
  TextInput,
  Textarea,
  RadioGroup,
  RegionCascader,
  SubmitButton,
  FormCard,
  AvatarField,
  type RegionValue,
} from '@/components/form';

const BIO_MAX = 500;

export default function ClientMeEdit() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useCurrentUser('customer');
  const setUser = useUserStore((s) => s.setUser);
  const toast = useToast();

  // 复用 me 页的 profile 查询（QK.profile），进入编辑页不额外发请求
  const { data, isLoading } = useQuery({
    queryKey: QK.profile('customer'),
    queryFn: fetchProfile,
  });

  const [saving, setSaving] = useState(false);
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('');
  const [realName, setRealName] = useState('');
  const [gender, setGender] = useState('');
  const [birthday, setBirthday] = useState('');
  const [region, setRegion] = useState<RegionValue>({});
  const [bio, setBio] = useState('');

  useEffect(() => {
    if (!data) return;
    const p = data;
    setNickname(p.nickname ?? '');
    setAvatar(p.avatar ?? '');
    setRealName(p.realName ?? '');
    setGender(p.gender ?? '');
    setBirthday(p.birthday ? String(p.birthday).slice(0, 10) : '');
    setRegion({
      province: p.province ?? null,
      provinceCode: p.provinceCode ?? null,
      city: p.city ?? null,
      cityCode: p.cityCode ?? null,
      district: p.district ?? null,
      districtCode: p.districtCode ?? null,
    });
    setBio(p.bio ?? '');
  }, [data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProfile({
        nickname,
        avatar,
        realName,
        gender: gender || undefined,
        birthday: birthday || undefined,
        province: region.province ?? undefined,
        provinceCode: region.provinceCode ?? undefined,
        city: region.city ?? undefined,
        cityCode: region.cityCode ?? undefined,
        district: region.district ?? undefined,
        districtCode: region.districtCode ?? undefined,
        bio,
      });
      setUser('customer', updated.data);
      // 失效个人资料缓存，返回我的页时即时刷新昵称/头像
      queryClient.invalidateQueries({ queryKey: QK.profile('customer') });
      toast.success('保存成功');
      router.push('/client/me');
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

  return (
    <>
      <PortalNavSetter title="修改资料" showBack backHref="/client/me" />
      <div className="laoma-container me-page">
        <form id="client-me-edit-form" onSubmit={save}>
          <FormCard title="账户资料">
            <Field label="昵称">
              <TextInput
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="展示名称"
              />
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

          <FormCard title="个人资料">
            <Field label="真实姓名" hint="选填，用于实名相关服务">
              <TextInput value={realName} onChange={(e) => setRealName(e.target.value)} placeholder="选填" />
            </Field>
            <Field label="所在地区" required>
              <RegionCascader value={region} onChange={setRegion} />
            </Field>
            <Field label="个人描述" hint={`选填，一句话介绍自己（${bio.length}/${BIO_MAX}）`}>
              <Textarea
                value={bio}
                maxLength={BIO_MAX}
                onChange={(e) => setBio(e.target.value)}
                placeholder="例如：常住朝阳区，工作日白天在家，方便上门服务"
              />
            </Field>
          </FormCard>
        </form>

        <div className="form-actions">
          <SubmitButton type="submit" form="client-me-edit-form" disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </SubmitButton>
        </div>
      </div>
    </>
  );
}
