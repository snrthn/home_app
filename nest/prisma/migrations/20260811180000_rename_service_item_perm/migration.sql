-- 权限码重命名：服务项目（原"服务规格"）services:spec_manage -> services:item_manage
-- 仅更新权限码标识与展示名；StaffRolePermission 通过 permissionId 关联，不受影响。
UPDATE `Permission`
SET `code` = 'services:item_manage',
    `name` = '服务项目管理',
    `resource` = 'services',
    `action` = 'item_manage'
WHERE `code` = 'services:spec_manage';
