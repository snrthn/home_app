import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';

@WebSocketGateway({ cors: true, path: '/ws' })
export class OrdersGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: any;
  private logger = new Logger('OrdersGateway');

  handleConnection() {
    this.logger.log('client connected');
  }

  handleDisconnect() {
    this.logger.log('client disconnected');
  }

  // 新订单入池时推送给在线师傅端
  broadcastNewOrder(order: any) {
    this.server?.emit('new-order', order);
  }

  // 订单状态变更通知客户端
  broadcastOrderUpdate(order: any) {
    this.server?.emit('order-update', order);
  }
}
