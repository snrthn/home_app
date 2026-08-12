-- CreateTable
CREATE TABLE `ServiceArea` (
    `id` VARCHAR(191) NOT NULL,
    `level` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `parentCode` VARCHAR(191) NULL,
    `province` VARCHAR(191) NULL,
    `provinceCode` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `cityCode` VARCHAR(191) NULL,
    `district` VARCHAR(191) NULL,
    `districtCode` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `ServiceArea_level_idx`(`level`),
    INDEX `ServiceArea_parentCode_idx`(`parentCode`),
    INDEX `ServiceArea_provinceCode_idx`(`provinceCode`),
    UNIQUE INDEX `ServiceArea_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

