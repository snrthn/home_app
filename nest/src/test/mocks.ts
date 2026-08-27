/** P1 service 级测试共享 mock 工厂。
 *  每个 spec 文件导入后按需 mockResolvedValue / mockRejectedValue。 */

export function createMockPrisma() {
  return {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    settlement: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    withdrawal: {
      create: jest.fn(),
      aggregate: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    master: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    serviceItem: {
      findUnique: jest.fn(),
    },
    serviceCategory: {
      findUnique: jest.fn(),
    },
    commissionRule: {
      findMany: jest.fn(),
    },
    ticket: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    complaint: {
      create: jest.fn(),
    },
    review: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    orderLog: {
      create: jest.fn(),
    },
    smsCode: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;
}

export function createMockCommission() {
  return {
    snapshotFromOrder: jest.fn(),
    splitNormal: jest.fn(),
    splitRefund: jest.fn(),
    resolve: jest.fn(),
    upsert: jest.fn(),
    preview: jest.fn(),
  } as any;
}

export function createMockOrders() {
  return {
    transition: jest.fn(),
    cancel: jest.fn(),
    pool: jest.fn(),
    grab: jest.fn(),
    findCandidates: jest.fn(),
  } as any;
}

export function createMockSettlements() {
  return {
    createCompensation: jest.fn(),
    releaseToMaster: jest.fn(),
    credit: jest.fn(),
    reject: jest.fn(),
  } as any;
}

export function createMockGateway() {
  return {
    broadcastNewOrder: jest.fn(),
    broadcastOrderUpdate: jest.fn(),
    broadcastPoolUpdate: jest.fn(),
    broadcastSettlementUpdate: jest.fn(),
  } as any;
}

export function createMockProvider() {
  return {
    name: 'mock' as const,
    createCharge: jest.fn(),
    verifyNotify: jest.fn(),
    refund: jest.fn().mockResolvedValue({ refundNo: 'REF-MOCK-001' }),
  } as any;
}
