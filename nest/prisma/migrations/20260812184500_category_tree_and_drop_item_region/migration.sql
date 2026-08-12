-- 类目树形化：新增 parentId / level / skillTag（自关联树，最多三级）
ALTER TABLE `ServiceCategory` ADD COLUMN `parentId` VARCHAR(191) NULL, ADD COLUMN `level` INT NOT NULL DEFAULT 1, ADD COLUMN `skillTag` VARCHAR(191) NULL;

-- 服务模板化：删除 ServiceItem 上的单点省市区字段。
-- 区域可用性改为运行时动态判定：平台开通区域 ∩ 师傅接单范围 ∩ 订单地址，不再写死在模板上。
ALTER TABLE `ServiceItem` DROP COLUMN `province`, DROP COLUMN `provinceCode`, DROP COLUMN `city`, DROP COLUMN `cityCode`, DROP COLUMN `district`, DROP COLUMN `districtCode`;
