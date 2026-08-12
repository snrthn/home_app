-- 公告通知范围（地域定向）：基于已开通服务区域（ServiceArea）做范围匹配
ALTER TABLE `Notice` ADD COLUMN `targetRegions` JSON NULL;
