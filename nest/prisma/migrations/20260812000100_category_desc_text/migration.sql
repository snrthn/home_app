-- 服务类目描述放宽到 TEXT（与项目描述一致，避免长描述在 MySQL 严格模式下触发 500）
-- AlterTable
ALTER TABLE `servicecategory` MODIFY `description` TEXT NULL;
