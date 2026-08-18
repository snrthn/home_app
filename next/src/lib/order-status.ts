// 订单状态机：与后端 @laoma/shared OrderStatus 对齐（前端用字符串字面量，避免强耦合 shared 编译产物）。
// 三端（客户/师傅/管理）共用同一套中文文案与语义色，保证体验一致。

export type OrderStatus =
  | 'pending_payment' // 待支付（下单后初始态，资金尚未进入平台托管）
  | 'pending_accept' // 待接单（已支付，资金在平台托管，等待师傅抢单）
  | 'accepted' // 已接单
  | 'departing' // 出发上门中（师傅已出发，前往客户地址）
  | 'arrived' // 已到达（师傅到达现场，待客户验证码确认）
  | 'servicing' // 服务中
  | 'pending_confirm' // 待验收
  | 'reviewed' // 已完成（客户验收，托管金已释放给师傅）
  | 'evaluated' // 已评价（客户完成评价，终态）
  | 'refunding' // 退款中
  | 'refunded' // 已退款（终态）
  | 'cancelled'; // 已取消（仅支付前取消，无退款，终态）

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: '待支付',
  pending_accept: '待接单',
  accepted: '已接单',
  departing: '出发上门中',
  arrived: '已到达',
  servicing: '服务中',
  pending_confirm: '待验收',
  reviewed: '已完成',
  evaluated: '已评价',
  refunding: '退款中',
  refunded: '已退款',
  cancelled: '已取消',
};

// 语义色：蓝=进行中，橙=需用户/师傅操作，绿=成功终态，红=退款，灰=关闭
export const ORDER_STATUS_TONE: Record<
  OrderStatus,
  'green' | 'orange' | 'red' | 'gray' | 'blue'
> = {
  pending_payment: 'orange',
  pending_accept: 'blue',
  accepted: 'blue',
  departing: 'blue',
  arrived: 'blue',
  servicing: 'blue',
  pending_confirm: 'orange',
  reviewed: 'green',
  evaluated: 'green',
  refunding: 'red',
  refunded: 'gray',
  cancelled: 'gray',
};
