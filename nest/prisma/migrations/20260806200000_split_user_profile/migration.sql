-- 2026-08-06 方案 B：User 拆分为「账号核心 User」+「资料画像 UserProfile」(1:1)
-- 并给全部表补充 deletedAt 逻辑删除字段。
-- 手工编写，纯增量、安全；回填在删列之前，避免丢失昵称/头像。
-- 注意：user 表在建库时默认 ROW_FORMAT=COMPACT，COMPACT 下 TEXT 列按 ~768 字节计入
--       8126 行上限，会导致 “Row size too large (1118)”。因此先把 user 转 DYNAMIC，
--       TEXT 列仅占 20 字节指针，行宽立降。

-- 1) 新建 UserProfile 表（userId 为主键，并外键关联 User，级联删除）
CREATE TABLE `UserProfile` (
    `userId` VARCHAR(191) NOT NULL,
    `nickname` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `realName` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `birthday` DATETIME(3) NULL,
    `city` VARCHAR(191) NULL,
    `vipLevel` INTEGER NOT NULL DEFAULT 0,
    `points` INTEGER NOT NULL DEFAULT 0,
    `balance` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `creditScore` INTEGER NOT NULL DEFAULT 100,
    `notifySettings` JSON NULL,
    `tags` JSON NULL,
    `remark` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    PRIMARY KEY (`userId`),
    CONSTRAINT `UserProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2) 回填：将 User 上已有的 nickname/avatar 搬运到 UserProfile（必须在删列之前）
INSERT INTO `UserProfile` (`userId`, `nickname`, `avatar`, `createdAt`, `updatedAt`)
SELECT `id`, `nickname`, `avatar`, NOW(), NOW() FROM `User`;

-- 3a) 删除已迁移到 UserProfile 的昵称/头像列
ALTER TABLE `user` DROP COLUMN `avatar`, DROP COLUMN `nickname`;

-- 3b) 转 DYNAMIC 行格式，使后续 TEXT 列仅占指针（避免 1118 行宽超限）
ALTER TABLE `user` ROW_FORMAT=DYNAMIC;

-- 3c) 新增账号/安全/审计/来源类字段
--     其中 7 个可选长字符串用 TEXT（仅 20 字节指针，计入行上限 8126 安全）
ALTER TABLE `user`
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastLoginIp` TEXT NULL,
    ADD COLUMN `loginCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastActiveAt` DATETIME(3) NULL,
    ADD COLUMN `phoneVerified` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `registerSource` TEXT NULL,
    ADD COLUMN `invitedBy` TEXT NULL,
    ADD COLUMN `inviteCode` TEXT NULL,
    ADD COLUMN `wechatOpenid` TEXT NULL,
    ADD COLUMN `wechatUnionid` TEXT NULL,
    ADD COLUMN `tenantId` TEXT NULL;

-- 4) 其余所有表补充 deletedAt 逻辑删除字段
ALTER TABLE `address` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `master` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `notification` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `orderlog` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `payment` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `paymentqr` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `quotation` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `review` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `servicecategory` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `serviceitem` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `settlement` ADD COLUMN `deletedAt` DATETIME(3) NULL;
-- 注意：`order` 为 MySQL 保留字且（在本库）建表时未能成功创建，
-- 需在补齐 Order 表后再对其加 deletedAt。此处保留语句以适配“全新库”场景。
ALTER TABLE `order` ADD COLUMN `deletedAt` DATETIME(3) NULL;
