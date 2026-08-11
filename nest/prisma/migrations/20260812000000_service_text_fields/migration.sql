-- 服务项目描述与封面图放宽到 TEXT：原 VARCHAR(191) 在 MySQL 严格模式下
-- 超长内容会直接报 Data too long，被 Prisma 转成 500。改为 TEXT 后可容纳长描述/长 URL。
-- AlterTable
ALTER TABLE `serviceitem` MODIFY `description` TEXT NULL, MODIFY `coverImage` TEXT NULL;
