-- CreateTable
CREATE TABLE `ticket` (
    `id` VARCHAR(191) NOT NULL,
    `ticketNo` VARCHAR(191) NOT NULL,
    `type` ENUM('consult', 'complaint', 'refund', 'report', 'system') NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `content` TEXT NOT NULL,
    `images` JSON NULL,
    `status` ENUM('open', 'processing', 'pendingUser', 'resolved', 'rejected', 'closed') NOT NULL DEFAULT 'open',
    `priority` ENUM('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal',
    `orderId` VARCHAR(191) NULL,
    `reviewId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `masterId` VARCHAR(191) NULL,
    `assigneeId` VARCHAR(191) NULL,
    `firstResponseDeadline` DATETIME(3) NULL,
    `resolveDeadline` DATETIME(3) NULL,
    `escalatedFirstResponse` BOOLEAN NOT NULL DEFAULT false,
    `escalatedResolve` BOOLEAN NOT NULL DEFAULT false,
    `escalationLevel` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `closedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Ticket_ticketNo_key`(`ticketNo` ASC),
    INDEX `Ticket_status_priority_idx`(`status` ASC, `priority` ASC),
    INDEX `Ticket_assigneeId_status_idx`(`assigneeId` ASC, `status` ASC),
    INDEX `Ticket_orderId_idx`(`orderId` ASC),
    INDEX `Ticket_customerId_idx`(`customerId` ASC),
    INDEX `Ticket_masterId_idx`(`masterId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `complaint` (
    `ticketId` VARCHAR(191) NOT NULL,
    `againstMasterId` VARCHAR(191) NULL,
    `reason` ENUM('attitude', 'quality', 'fee', 'late', 'damage', 'other') NOT NULL,
    `expectation` VARCHAR(191) NULL,
    `result` ENUM('refund', 'compensate', 'redispatch', 'no_fault') NULL,
    `handledById` VARCHAR(191) NULL,
    `refundSettlementId` VARCHAR(191) NULL,
    `handledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`ticketId` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticketcomment` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `operatorId` VARCHAR(191) NULL,
    `content` TEXT NOT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT false,
    `visibleTo` VARCHAR(191) NOT NULL DEFAULT 'all',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `TicketComment_ticketId_idx`(`ticketId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKeyConstraint
ALTER TABLE `ticket` ADD CONSTRAINT `Ticket_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ticket` ADD CONSTRAINT `Ticket_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `review`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ticket` ADD CONSTRAINT `Ticket_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ticket` ADD CONSTRAINT `Ticket_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `master`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ticket` ADD CONSTRAINT `Ticket_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKeyConstraint
ALTER TABLE `complaint` ADD CONSTRAINT `Complaint_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `ticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `complaint` ADD CONSTRAINT `Complaint_againstMasterId_fkey` FOREIGN KEY (`againstMasterId`) REFERENCES `master`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `complaint` ADD CONSTRAINT `Complaint_handledById_fkey` FOREIGN KEY (`handledById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `complaint` ADD CONSTRAINT `Complaint_refundSettlementId_fkey` FOREIGN KEY (`refundSettlementId`) REFERENCES `settlement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKeyConstraint
ALTER TABLE `ticketcomment` ADD CONSTRAINT `TicketComment_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `ticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ticketcomment` ADD CONSTRAINT `TicketComment_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
