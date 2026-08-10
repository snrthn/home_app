import { OrderStatus, ORDER_STATUS_FLOW } from '@laoma/shared';

export function canTransition(from: string, to: string): boolean {
  return ORDER_STATUS_FLOW[from as OrderStatus]?.includes(to as OrderStatus) ?? false;
}
