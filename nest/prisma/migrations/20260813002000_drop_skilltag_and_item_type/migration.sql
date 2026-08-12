-- 移除「工种类型」字段（ServiceCategory.skillTag 与 ServiceItem.type）
-- 业务域已由树形一级类目表达，工种类型轴冗余且带来配置负担，整体移除。
-- 关联逻辑：原 ServiceItem.type 由一级类目 skillTag 派生，现一并删除；
-- 公开列表 /createItem/updateItem 的 type 过滤与派生逻辑已在前端与服务端同步移除。

ALTER TABLE `ServiceCategory` DROP COLUMN `skillTag`;

ALTER TABLE `ServiceItem` DROP COLUMN `type`;
