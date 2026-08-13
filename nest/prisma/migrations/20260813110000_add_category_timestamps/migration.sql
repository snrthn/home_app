-- 服务类目补充创建/更新时间字段
-- 此前 ServiceCategory 漏建审计时间戳，导致无法按「创建时间」稳定排序。
-- createdAt 用于默认排序（创建时间正序），updatedAt 为常规审计字段。

ALTER TABLE `ServiceCategory` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `ServiceCategory` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
