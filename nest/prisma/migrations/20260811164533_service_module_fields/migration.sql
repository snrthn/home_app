-- AlterTable
ALTER TABLE `servicecategory` ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `serviceitem` ROW_FORMAT=DYNAMIC, ADD COLUMN `cityCode` VARCHAR(191) NULL,
    ADD COLUMN `coverImage` VARCHAR(191) NULL,
    ADD COLUMN `district` VARCHAR(191) NULL,
    ADD COLUMN `districtCode` VARCHAR(191) NULL,
    ADD COLUMN `estimatedDuration` INTEGER NULL,
    ADD COLUMN `province` VARCHAR(191) NULL,
    ADD COLUMN `provinceCode` VARCHAR(191) NULL,
    MODIFY `type` ENUM('clean', 'repair', 'cleaning', 'dredging') NOT NULL,
    MODIFY `city` VARCHAR(191) NULL;
