'use client';

import { useState } from 'react';
import { setPassword } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Field } from './Field';
import { TextInput } from './TextInput';
import { SubmitButton } from './SubmitButton';

// 纯表单（不含外框），供「个人中心直接布局」与「弹窗」两种形态复用。
// hasPassword=true：账号已有密码，走重置（需先验证旧密码）；
// hasPassword=false：首次设置（无需旧密码）。
// 成功后触发 onSuccess（用于关闭弹窗并刷新父页 hasPassword 状态）。
export function PasswordForm({
  hasPassword,
  onSuccess,
}: {
  hasPassword: boolean;
  onSuccess?: () => void;
}) {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 6) {
      toast.error('新密码至少 6 位');
      return;
    }
    if (newPwd !== confirm) {
      toast.error('两次输入的密码不一致');
      return;
    }
    if (hasPassword && !oldPwd) {
      toast.error('请输入当前密码');
      return;
    }
    setSaving(true);
    try {
      await setPassword({
        oldPassword: hasPassword ? oldPwd : undefined,
        newPassword: newPwd,
      });
      toast.success(
        hasPassword
          ? '密码已重置，下次请用新密码登录'
          : '密码已设置，下次可用密码登录',
      );
      setOldPwd('');
      setNewPwd('');
      setConfirm('');
      // 先展示成功提示，再关闭弹窗并通知父页刷新
      setTimeout(() => onSuccess?.(), 800);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '操作失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <p
        style={{
          fontSize: 13,
          color: 'var(--color-text-soft)',
          margin: '0 0 16px',
        }}
      >
        {hasPassword
          ? '重置登录密码：需先验证当前密码'
          : '尚未设置登录密码，设置后可使用「密码登录」方式登录'}
      </p>
      {hasPassword && (
        <Field label="当前密码">
          <TextInput
            type="password"
            value={oldPwd}
            onChange={(e) => setOldPwd(e.target.value)}
            placeholder="请输入当前密码"
          />
        </Field>
      )}
      <Field label="新密码">
        <TextInput
          type="password"
          value={newPwd}
          onChange={(e) => setNewPwd(e.target.value)}
          placeholder="至少 6 位"
        />
      </Field>
      <Field label="确认新密码">
        <TextInput
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="再次输入新密码"
        />
      </Field>
      <SubmitButton type="submit" disabled={saving} style={{ width: '100%' }}>
        {saving ? '提交中…' : hasPassword ? '重置密码' : '设置密码'}
      </SubmitButton>
    </form>
  );
}
