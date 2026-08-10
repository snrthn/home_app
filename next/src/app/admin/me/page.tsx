'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { updateProfile } from '@/lib/api';
import { QK } from '@/lib/query-keys';
import { useUserStore } from '@/lib/user-store';
import { useCurrentUser, fetchProfile } from '@/lib/useCurrentUser';
import { useToast } from '@/components/Toast';
import {
  Field,
  TextInput,
  Textarea,
  RadioGroup,
  RegionCascader,
  SubmitButton,
  FormCard,
  AvatarField,
  PasswordDialog,
  type RegionValue,
} from '@/components/form';

const BIO_MAX = 500;

export default function AdminMe() {
  useCurrentUser('admin');
  const setUser = useUserStore((s) => s.setUser);
  const toast = useToast();

  // 与 layout 的 CurrentUserLoader 共用 QK.profile，一轮初始化只发一次 /auth/profile
  const { data, isLoading } = useQuery({
    queryKey: QK.profile('admin'),
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
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => {
    if (!data) return;
    const p = data as any;
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
    setHasPassword(!!p.hasPassword);
  }, [data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProfile({
        nickname,
        avatar,
        realName: realName || undefined,
        gender: gender || undefined,
        birthday: birthday || undefined,
        province: region.province ?? undefined,
        provinceCode: region.provinceCode ?? undefined,
        city: region.city ?? undefined,
        cityCode: region.cityCode ?? undefined,
        district: region.district ?? undefined,
        districtCode: region.districtCode ?? undefined,
        bio, // 空串 = 清空个人描述
      });
      setUser('admin', updated.data);
      toast.success('保存成功');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="card">加载中…</div>;
  }

  return (
    <>
      <div className="page-head">
        <h2>个人中心</h2>
      </div>
      <form id="admin-me-form" onSubmit={save}>
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
        </FormCard>

        <FormCard title="个人资料">
          <Field label="真实姓名" hint="选填，用于后台操作留痕与实名">
            <TextInput
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              placeholder="选填"
            />
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
            <TextInput
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </Field>
          <Field label="所在地区">
            <RegionCascader value={region} onChange={setRegion} />
          </Field>
          <Field
            label="个人描述"
            hint={`选填，一句话介绍自己（${bio.length}/${BIO_MAX}）`}
          >
            <Textarea
              value={bio}
              maxLength={BIO_MAX}
              onChange={(e) => setBio(e.target.value)}
              placeholder="例如：负责订单调度与售后，工作日 9:00-18:00 在线"
            />
          </Field>
        </FormCard>
      </form>

      <PasswordDialog
        hasPassword={hasPassword}
        onSuccess={() => {
          // 改密成功：仅本地把入口文案切到「修改登录密码」，不刷新 profile，
          // 以免覆盖用户尚未提交的个人信息编辑。
          setHasPassword(true);
        }}
      />

      <SubmitButton
        type="submit"
        form="admin-me-form"
        disabled={saving}
        style={{ width: '100%' }}
      >
        {saving ? '保存中…' : '保存修改'}
      </SubmitButton>
    </>
  );
}
