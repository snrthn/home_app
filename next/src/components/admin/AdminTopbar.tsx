'use client';

import UserBadge from '../UserBadge';
import AdminBrand from './AdminBrand';
import AdminUserMenu from './AdminUserMenu';
import { toggleFullscreen } from '@/lib/fullscreen';

// 运营端顶栏：品牌区 + 用户菜单。
// 双击顶栏任意空白处切换全屏（与用户/师傅端 PageNav 行为一致）。
// 抽离为客户端组件，避免 admin/layout 加 'use client' 导致 metadata 失效。
export default function AdminTopbar() {
  return (
    <div className="topbar" onDoubleClick={toggleFullscreen} title="双击切换全屏">
      <AdminBrand />
      <div className="topbar-right">
        <UserBadge role="admin" />
        <AdminUserMenu />
      </div>
    </div>
  );
}
