'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { updateProfile, updateMasterMe } from '@/lib/api';
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
  SubmitButton,
  FormCard,
  AvatarField,
} from '@/components/form';

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
  const [bio, setBio] = useState('');

  useEffect(() => {
    if (!data) return;
    const p = data;
    setNickname(p.nickname ?? '');
    setAvatar(p.avatar ?? '');
    setGender(p.gender ?? '');
    setBirthday(p.birthday ? String(p.birthday).slice(0, 10) : '');
    setBio(p.bio ?? '');
    const m = p.master ?? {};
    setMasterStatus(m.status ?? '');
    setRealName(m.realName ?? '');
    setIdCard(m.idCard ?? '');
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
