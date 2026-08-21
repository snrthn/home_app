-- CreateTable
CREATE TABLE `refund` (
    `id` VARCHAR(191) NOT NULL,
    `refundNo` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `reason` VARCHAR(200) NULL,
    `status` ENUM('pending_review', 'approved', 'rejected') NOT NULL DEFAULT 'pending_review',
    `requestedById` VARCHAR(191) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNote` VARCHAR(200) NULL,
    `refundedAmount` DECIMAL(10, 2) NULL,
    `settlementId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Refund_refundNo_key`(`refundNo` ASC),
    UNIQUE INDEX `Refund_settlementId_key`(`settlementId` ASC),
    INDEX `Refund_status_createdAt_idx`(`status` ASC, `createdAt` ASC),
    INDEX `Refund_orderId_idx`(`orderId` ASC),
    INDEX `Refund_ticketId_idx`(`ticketId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKeyConstraint
ALTER TABLE `refund` ADD CONSTRAINT `Refund_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `refund` ADD CONSTRAINT `Refund_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `ticket`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `refund` ADD CONSTRAINT `Refund_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `refund` ADD CONSTRAINT `Refund_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
