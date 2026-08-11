-- CreateTable
CREATE TABLE `address` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `contactName` VARCHAR(191) NOT NULL,
    `contactPhone` VARCHAR(191) NOT NULL,
    `province` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL,
    `district` VARCHAR(191) NULL,
    `detail` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(191) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `Address_userId_fkey`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agreementtemplate` (
    `id` VARCHAR(191) NOT NULL,
    `scope` ENUM('customer', 'master', 'admin') NOT NULL,
    `type` ENUM('registration', 'privacy') NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AgreementTemplate_code_key`(`code` ASC),
    INDEX `AgreementTemplate_scope_type_idx`(`scope` ASC, `type` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agreementversion` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `contentHtml` TEXT NULL,
    `status` ENUM('draft', 'published', 'offline') NOT NULL DEFAULT 'draft',
    `isCurrent` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `AgreementVersion_isCurrent_idx`(`isCurrent` ASC),
    INDEX `AgreementVersion_templateId_idx`(`templateId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `realName` VARCHAR(191) NOT NULL,
    `idCard` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `skills` JSON NULL,
    `idVerified` BOOLEAN NOT NULL DEFAULT false,
    `rating` DECIMAL(3, 2) NOT NULL DEFAULT 5.00,
    `orderCount` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('pending', 'active', 'disabled') NOT NULL DEFAULT 'pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `cityCode` VARCHAR(191) NULL,
    `district` VARCHAR(191) NULL,
    `districtCode` VARCHAR(191) NULL,
    `province` VARCHAR(191) NULL,
    `provinceCode` VARCHAR(191) NULL,
    `rejectReason` TEXT NULL,

    UNIQUE INDEX `Master_userId_key`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notice` (
    `id` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NULL,
    `contentHtml` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `startAt` DATETIME(3) NULL,
    `endAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `publishedAt` DATETIME(3) NULL,

    INDEX `Notice_scope_status_idx`(`scope` ASC, `status` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order` (
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
    `status` ENUM('pending_accept', 'accepted', 'servicing', 'pending_payment', 'paid', 'reviewed', 'cancelled') NOT NULL DEFAULT 'pending_accept',
    `remark` VARCHAR(191) NULL,
    `customerPhotos` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Order_addressId_fkey`(`addressId` ASC),
    INDEX `Order_customerId_fkey`(`customerId` ASC),
    INDEX `Order_masterId_fkey`(`masterId` ASC),
    UNIQUE INDEX `Order_orderNo_key`(`orderNo` ASC),
    INDEX `Order_serviceItemId_fkey`(`serviceItemId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orderlog` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('pending_accept', 'accepted', 'servicing', 'pending_payment', 'paid', 'reviewed', 'cancelled') NULL,
    `toStatus` ENUM('pending_accept', 'accepted', 'servicing', 'pending_payment', 'paid', 'reviewed', 'cancelled') NULL,
    `operatorId` VARCHAR(191) NULL,
    `photos` JSON NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `OrderLog_orderId_fkey`(`orderId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `masterId` VARCHAR(191) NULL,
    `qrType` VARCHAR(191) NOT NULL,
    `proofUrl` VARCHAR(191) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('pending', 'paid', 'confirmed') NOT NULL DEFAULT 'pending',
    `confirmedBy` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `Payment_customerId_fkey`(`customerId` ASC),
    INDEX `Payment_masterId_fkey`(`masterId` ASC),
    INDEX `Payment_orderId_fkey`(`orderId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paymentqr` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permission` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `resource` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `group` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Permission_code_key`(`code` ASC),
    INDEX `Permission_group_idx`(`group` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotation` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `masterId` VARCHAR(191) NOT NULL,
    `laborFee` DECIMAL(10, 2) NULL,
    `partsFee` DECIMAL(10, 2) NULL,
    `total` DECIMAL(10, 2) NULL,
    `partsDetail` JSON NULL,
    `status` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `Quotation_masterId_fkey`(`masterId` ASC),
    INDEX `Quotation_orderId_fkey`(`orderId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `masterId` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` VARCHAR(191) NULL,
    `anonymous` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `Review_customerId_fkey`(`customerId` ASC),
    INDEX `Review_masterId_fkey`(`masterId` ASC),
    UNIQUE INDEX `Review_orderId_key`(`orderId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `servicecategory` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `deletedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `serviceitem` (
    `id` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('clean', 'repair') NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `ServiceItem_categoryId_fkey`(`categoryId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settlement` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `masterId` VARCHAR(191) NOT NULL,
    `orderAmount` DECIMAL(10, 2) NOT NULL,
    `platformFee` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `masterAmount` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('offline_pending', 'offline_done') NOT NULL DEFAULT 'offline_pending',
    `settledAt` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `Settlement_masterId_fkey`(`masterId` ASC),
    UNIQUE INDEX `Settlement_orderId_key`(`orderId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sitecontent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL DEFAULT '',
    `contentHtml` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SiteContent_key_idx`(`key` ASC),
    UNIQUE INDEX `SiteContent_key_key`(`key` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staffrole` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `StaffRole_key_key`(`key` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staffrolepermission` (
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,

    INDEX `StaffRolePermission_permissionId_fkey`(`permissionId` ASC),
    PRIMARY KEY (`roleId` ASC, `permissionId` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `role` ENUM('admin', 'master', 'customer') NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `lastLoginTime` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `email` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `tokenVersion` INTEGER NOT NULL DEFAULT 0,
    `loginCount` INTEGER NOT NULL DEFAULT 0,
    `lastActiveAt` DATETIME(3) NULL,
    `phoneVerified` BOOLEAN NOT NULL DEFAULT true,
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `lastLoginIp` TEXT NULL,
    `registerSource` TEXT NULL,
    `invitedBy` TEXT NULL,
    `inviteCode` TEXT NULL,
    `wechatOpenid` TEXT NULL,
    `wechatUnionid` TEXT NULL,
    `tenantId` TEXT NULL,
    `staffRoleId` VARCHAR(191) NULL,

    UNIQUE INDEX `User_phone_key`(`phone` ASC),
    INDEX `User_staffRoleId_fkey`(`staffRoleId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `userprofile` (
    `userId` VARCHAR(191) NOT NULL,
    `nickname` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `realName` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `birthday` DATETIME(3) NULL,
    `city` VARCHAR(191) NULL,
    `vipLevel` INTEGER NOT NULL DEFAULT 0,
    `points` INTEGER NOT NULL DEFAULT 0,
    `balance` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `creditScore` INTEGER NOT NULL DEFAULT 100,
    `notifySettings` JSON NULL,
    `tags` JSON NULL,
    `remark` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `cityCode` VARCHAR(191) NULL,
    `district` VARCHAR(191) NULL,
    `districtCode` VARCHAR(191) NULL,
    `province` VARCHAR(191) NULL,
    `provinceCode` VARCHAR(191) NULL,
    `bio` TEXT NULL,

    PRIMARY KEY (`userId` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `address` ADD CONSTRAINT `Address_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agreementversion` ADD CONSTRAINT `AgreementVersion_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `agreementtemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master` ADD CONSTRAINT `Master_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `Order_addressId_fkey` FOREIGN KEY (`addressId`) REFERENCES `address`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `Order_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `Order_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `master`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `Order_serviceItemId_fkey` FOREIGN KEY (`serviceItemId`) REFERENCES `serviceitem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderlog` ADD CONSTRAINT `OrderLog_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `Payment_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `Payment_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `master`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation` ADD CONSTRAINT `Quotation_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation` ADD CONSTRAINT `Quotation_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review` ADD CONSTRAINT `Review_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review` ADD CONSTRAINT `Review_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review` ADD CONSTRAINT `Review_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `serviceitem` ADD CONSTRAINT `ServiceItem_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `servicecategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlement` ADD CONSTRAINT `Settlement_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `master`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlement` ADD CONSTRAINT `Settlement_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staffrolepermission` ADD CONSTRAINT `StaffRolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staffrolepermission` ADD CONSTRAINT `StaffRolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `staffrole`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `User_staffRoleId_fkey` FOREIGN KEY (`staffRoleId`) REFERENCES `staffrole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `userprofile` ADD CONSTRAINT `UserProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

