import { SetMetadata } from '@nestjs/common';

/** 元数据 key：存放接口审计信息 */
export const AUDIT_KEY = 'audit';

export interface AuditMeta {
  /** 模块，如 'users' / 'masters' / 'orders' / 'content' / 'rbac' */
  module: string;
  /** 动作码，如 'users:admin_create' / 'rbac:role_update' */
  action: string;
}

/**
 * 标记某个接口需要被操作审计记录。
 * 配合全局 AuditInterceptor：接口成功返回后自动把操作人/动作/资源/参数摘要/IP 落 OperationLog。
 * 仅打标接口才记录，未标记的接口不受影响。
 */
export const Audit = (module: string, action: string): MethodDecorator =>
  SetMetadata(AUDIT_KEY, { module, action } as AuditMeta);
