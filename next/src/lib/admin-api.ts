import api from './api';

// 管理端「用户」相关接口封装（后台账号 / 客户 / 师傅 / 认证审核）

export interface AdminUser {
  id: string;
  phone: string;
  status: string;
  createdAt?: string;
  profile?: { nickname?: string | null } | null;
}

export interface CustomerUser {
  id: string;
  phone: string;
  status: string;
  createdAt?: string;
  profile?: {
    nickname?: string | null;
    realName?: string | null;
    gender?: string | null;
    city?: string | null;
    vipLevel?: number | null;
    points?: number | null;
    creditScore?: number | null;
  } | null;
  _count?: { customerOrders: number };
}

export interface MasterUser {
  id: string;
  realName: string;
  idCard?: string | null;
  city?: string | null;
  skills?: unknown;
  idVerified: boolean;
  rating: number;
  orderCount: number;
  status: string;
  createdAt?: string;
  user?: { phone?: string; profile?: { nickname?: string | null } | null };
}

// 后台账号列表
export function getAdmins(): Promise<AdminUser[]> {
  return api.get('/users/admins').then((r) => r.data);
}

// 新增后台账号（手机号 + 初始密码 + 选填昵称）
export function createAdmin(dto: {
  phone: string;
  password: string;
  nickname?: string;
}): Promise<AdminUser> {
  return api.post('/users/admins', dto).then((r) => r.data);
}

// 修改后台账号（昵称可改；密码选填，留空不改）
export function updateAdmin(
  id: string,
  dto: { nickname?: string; password?: string },
): Promise<AdminUser> {
  return api.patch(`/users/admins/${id}`, dto).then((r) => r.data);
}

// 启 / 停 / 冻结 后台账号
export function setAdminStatus(
  id: string,
  status: 'active' | 'disabled' | 'frozen',
): Promise<AdminUser> {
  return api.post(`/users/admins/${id}/status`, { status }).then((r) => r.data);
}

// 启 / 停 / 冻结 客户
export function setCustomerStatus(
  id: string,
  status: 'active' | 'disabled' | 'frozen',
): Promise<CustomerUser> {
  return api.post(`/users/customers/${id}/status`, { status }).then((r) => r.data);
}

// 客户列表（后端最多取 200 条，前端再做关键词过滤）
export function getCustomers(): Promise<CustomerUser[]> {
  return api.get('/users/customers').then((r) => r.data);
}

// 师傅列表（可选 city / status 过滤）
export function getMasters(params?: { city?: string; status?: string }): Promise<MasterUser[]> {
  return api.get('/masters', { params }).then((r) => r.data);
}

// 待审核师傅（认证审核页）
export function getPendingMasters(): Promise<MasterUser[]> {
  return api.get('/masters', { params: { pendingOnly: 'true' } }).then((r) => r.data);
}

// 审核师傅：status='active' 通过（并标记已实名认证）；'disabled' 拒绝
export function approveMaster(id: string, status: 'active' | 'disabled', reason?: string) {
  return api.post(`/masters/${id}/approve`, { status, reason }).then((r) => r.data);
}

// 启用 / 停用 师傅（仅 active / disabled）
export function setMasterStatus(
  id: string,
  status: 'active' | 'disabled',
): Promise<MasterUser> {
  return api.post(`/masters/${id}/status`, { status }).then((r) => r.data);
}

// ===================== 协议管理（运营端） =====================

export type AgreementScope = 'customer' | 'master' | 'admin';
export type AgreementType = 'registration' | 'privacy';
export type AgreementStatus = 'draft' | 'published' | 'offline';

// 版本（草稿 / 已上架 / 已下架）
export interface AgreementVersion {
  id: string;
  templateId: string;
  version: number;
  title: string;
  contentHtml: string | null;
  status: AgreementStatus;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

// 协议模板（某端 + 某类型，含全部版本）
export interface AgreementTemplate {
  id: string;
  scope: AgreementScope;
  type: AgreementType;
  code: string;
  title: string;
  versions: AgreementVersion[];
}

// 公开生效版本（注册/隐私弹窗用，字段已脱敏）
export interface AgreementPublic {
  id: string;
  templateId: string;
  scope: AgreementScope;
  type: AgreementType;
  code: string;
  title: string;
  version: number;
  contentHtml: string | null;
  updatedAt: string;
}

// 管理端：协议模板列表（含各版本）
export function getAgreements(): Promise<AgreementTemplate[]> {
  return api.get('/admin/agreements').then((r) => r.data);
}

// 管理端：新建协议类型（某端 + 某类型，唯一）
export function createAgreementTemplate(dto: {
  scope: AgreementScope;
  type: AgreementType;
  title: string;
}): Promise<AgreementTemplate> {
  return api.post('/admin/agreements', dto).then((r) => r.data);
}

// 管理端：修改协议类型名称（创建后允许修正）
export function updateAgreementTemplate(
  id: string,
  dto: { title: string },
): Promise<AgreementTemplate> {
  return api.patch(`/admin/agreements/${id}`, dto).then((r) => r.data);
}

// 管理端：新建版本（草稿，版本号自增）
export function createAgreementVersion(
  id: string,
  dto: { title: string; contentHtml?: string },
): Promise<AgreementVersion> {
  return api.post(`/admin/agreements/${id}/versions`, dto).then((r) => r.data);
}

// 管理端：编辑版本（仅草稿可改）
export function updateAgreementVersion(
  id: string,
  vid: string,
  dto: { title?: string; contentHtml?: string },
): Promise<AgreementVersion> {
  return api
    .patch(`/admin/agreements/${id}/versions/${vid}`, dto)
    .then((r) => r.data);
}

// 管理端：上架版本（置为当前生效）
export function publishAgreementVersion(id: string, vid: string) {
  return api
    .post(`/admin/agreements/${id}/versions/${vid}/publish`)
    .then((r) => r.data);
}

// 管理端：下架版本（失效，若无其他生效版本则公开页隐藏入口）
export function offlineAgreementVersion(id: string, vid: string) {
  return api
    .post(`/admin/agreements/${id}/versions/${vid}/offline`)
    .then((r) => r.data);
}

// 公开：取某端某类型的当前生效版本；无则 null（前端据此隐藏入口）
export function getAgreementDefault(
  scope: AgreementScope,
  type: AgreementType,
): Promise<AgreementPublic | null> {
  return api
    .get('/agreements/default', { params: { scope, type } })
    .then((r) => r.data ?? null);
}

// ===================== 公告通知（运营端） =====================

export type NoticeScope = 'customer' | 'master' | 'admin';
export type NoticeStatus = 'draft' | 'published' | 'offline';

// 管理端完整字段
export interface Notice {
  id: string;
  scope: NoticeScope;
  title: string;
  summary: string | null;
  contentHtml: string;
  status: NoticeStatus;
  pinned: boolean;
  startAt: string | null;
  endAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

// 公开列表字段（含正文，点击即用）
export interface NoticePublic {
  id: string;
  scope: NoticeScope;
  title: string;
  summary: string | null;
  contentHtml: string;
  pinned: boolean;
  publishedAt: string | null;
  createdAt: string;
}

// 管理端：列表（可选 scope 过滤）
export function getNotices(scope?: NoticeScope): Promise<Notice[]> {
  return api
    .get('/admin/notices', { params: scope ? { scope } : {} })
    .then((r) => r.data);
}

// 管理端：新建（默认草稿）
export function createNotice(dto: {
  scope: NoticeScope;
  title: string;
  summary?: string;
  contentHtml?: string;
  pinned?: boolean;
  startAt?: string;
  endAt?: string;
}): Promise<Notice> {
  return api.post('/admin/notices', dto).then((r) => r.data);
}

// 管理端：编辑（标题/正文/所属端/时间窗等）
export function updateNotice(
  id: string,
  dto: {
    scope?: NoticeScope;
    title?: string;
    summary?: string;
    contentHtml?: string;
    pinned?: boolean;
    startAt?: string | null;
    endAt?: string | null;
  },
): Promise<Notice> {
  return api.patch(`/admin/notices/${id}`, dto).then((r) => r.data);
}

// 管理端：发布（置为已发布，记录发布时间）
export function publishNotice(id: string): Promise<Notice> {
  return api.post(`/admin/notices/${id}/publish`).then((r) => r.data);
}

// 管理端：下线（公开页不再展示）
export function offlineNotice(id: string): Promise<Notice> {
  return api.post(`/admin/notices/${id}/offline`).then((r) => r.data);
}

// 管理端：删除
export function deleteNotice(id: string): Promise<void> {
  return api.delete(`/admin/notices/${id}`).then((r) => r.data);
}

// 公开：取某端当前生效的公告列表（无需登录），供用户端/师傅端展示
export function getPublicNotices(scope: NoticeScope): Promise<NoticePublic[]> {
  return api
    .get('/notices', { params: { scope } })
    .then((r) => r.data ?? []);
}

// ===================== 站点内容（关于我们等，运营可维护） =====================

export interface SiteContent {
  id?: number;
  key: string;
  title: string;
  contentHtml: string;
  updatedAt?: string;
}

// 公开：按 key 取站点内容（无需登录）；不存在或异常时返回 null，前端据此回退静态兜底
export function getSiteContent(key: string): Promise<SiteContent | null> {
  return api
    .get(`/site-content/${key}`)
    .then((r) => r.data ?? null)
    .catch(() => null);
}

// 管理端：按 key 取站点内容（供编辑回显）
export function getAdminSiteContent(key: string): Promise<SiteContent | null> {
  return api
    .get(`/admin/site-content/${key}`)
    .then((r) => r.data ?? null)
    .catch(() => null);
}

// 管理端：按 key 覆盖写入（标题 + 富文本正文）
export function upsertSiteContent(
  key: string,
  dto: { title?: string; contentHtml?: string },
): Promise<SiteContent> {
  return api.put(`/admin/site-content/${key}`, dto).then((r) => r.data);
}
