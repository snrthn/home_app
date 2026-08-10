-- 修复：master / userprofile 改为 DYNAMIC 行格式（规避 COMPACT 下 VARCHAR(191) utf8mb4
-- 单俄 764 字节计入 8126 行上限导致的 Row size too large 1118），再追加省/市/区 + code 字段。
ALTER TABLE `master` ROW_FORMAT=DYNAMIC,
    ADD COLUMN `cityCode` VARCHAR(191) NULL,
    ADD COLUMN `district` VARCHAR(191) NULL,
    ADD COLUMN `districtCode` VARCHAR(191) NULL,
    ADD COLUMN `province` VARCHAR(191) NULL,
    ADD COLUMN `provinceCode` VARCHAR(191) NULL,
    MODIFY `city` VARCHAR(191) NULL;

ALTER TABLE `userprofile` ROW_FORMAT=DYNAMIC,
    ADD COLUMN `cityCode` VARCHAR(191) NULL,
    ADD COLUMN `district` VARCHAR(191) NULL,
    ADD COLUMN `districtCode` VARCHAR(191) NULL,
    ADD COLUMN `province` VARCHAR(191) NULL,
    ADD COLUMN `provinceCode` VARCHAR(191) NULL;

-- 重建 db push 阶段被本次失败迁移误删的 4 个唯一索引（当前已不存在，直接重建）
CREATE UNIQUE INDEX `Master_userId_key` ON `Master`(`userId`);
CREATE UNIQUE INDEX `Review_orderId_key` ON `Review`(`orderId`);
CREATE UNIQUE INDEX `Settlement_orderId_key` ON `Settlement`(`orderId`);
CREATE UNIQUE INDEX `User_phone_key` ON `User`(`phone`);

-- 创建缺失的 Order 表（order 为保留字，反引号引用；DYNAMIC 行格式规避 8126 限制）
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `orderNo` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `masterId` VARCHAR(191) NULL,
    `addressId` VARCHAR(191) NOT NULL,
    `serviceItemId` VARCHAR(191) NOT NULL,
    `serviceSnapshot` JSON NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `appointmentDate` DATETIME(3) NULL,
    `appointmentSlot` VARCHAR(191) NULL,
    `status` ENUM('pending_accept','accepted','servicing','pending_payment','paid','reviewed','cancelled') NOT NULL DEFAULT 'pending_accept',
    `remark` VARCHAR(191) NULL,
    `customerPhotos` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    UNIQUE INDEX `Order_orderNo_key`(`orderNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- 补建缺失的外键约束（db push 阶段因 Order 表缺失未建立）
ALTER TABLE `Master` ADD CONSTRAINT `Master_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ServiceItem` ADD CONSTRAINT `ServiceItem_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ServiceCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Address` ADD CONSTRAINT `Address_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Order` ADD CONSTRAINT `Order_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Order` ADD CONSTRAINT `Order_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `Master`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Order` ADD CONSTRAINT `Order_addressId_fkey` FOREIGN KEY (`addressId`) REFERENCES `Address`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Order` ADD CONSTRAINT `Order_serviceItemId_fkey` FOREIGN KEY (`serviceItemId`) REFERENCES `ServiceItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `OrderLog` ADD CONSTRAINT `OrderLog_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `Master`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Review` ADD CONSTRAINT `Review_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Review` ADD CONSTRAINT `Review_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Review` ADD CONSTRAINT `Review_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `Master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
