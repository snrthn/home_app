import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { MerchantConfigStore, type MerchantConfig } from './merchant-config.store';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { PermGuard } from '../common/perm.guard';
import { Roles } from '../common/roles.decorator';
import { RequirePerm } from '../common/perm.decorator';
import { Audit } from '../common/audit.decorator';
import { Role } from '@laoma/shared';

@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  // ===== 支付前置（平台托管）相关 =====

  // 客户发起支付：预创建支付单，返回调起参数
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Post('charge')
  charge(@Req() req: any, @Body() dto: { orderId: string }) {
    return this.payments.charge(req.user.sub, dto.orderId);
  }

  // 模拟支付成功回调（等价于真实通道的异步 notify）
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Post('mock/notify')
  mockNotify(@Req() req: any, @Body() dto: { orderId: string; token: string }) {
    return this.payments.mockNotify(dto.orderId, dto.token);
  }

  // 退款（支付后取消触发）
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Post('refund')
  refund(@Req() req: any, @Body() dto: { orderId: string }) {
    return this.payments.refund(req.user.sub, dto.orderId);
  }

  // 真实通道异步回调（公开，无鉴权）：微信/支付宝服务器主动推送
  @Post('notify/wechat')
  async wechatNotify(@Body() body: any) {
    await this.payments.handleNotify('wechat', { raw: body });
    return { code: 'SUCCESS', message: '成功' };
  }

  @Post('notify/alipay')
  async alipayNotify(@Body() body: any) {
    await this.payments.handleNotify('alipay', body);
    return 'success';
  }

  // ===== 后台商户配置（一键接入真实支付） =====

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin)
  @Get('config')
  getConfig() {
    return this.payments.getConfig();
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin)
  @Put('config')
  saveConfig(@Req() req: any, @Body() dto: MerchantConfig) {
    return this.payments.saveConfig(dto);
  }

  // ===== 旧二维码凭证支付（保留，与前置支付并存） =====

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Customer)
  @Post()
  create(
    @Req() req: any,
    @Body()
    dto: { orderId: string; qrType: string; proofUrl?: string },
  ) {
    return this.payments.create(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin)
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @Req() req: any) {
    return this.payments.confirm(id, req.user.sub);
  }

  // ===== 退款台账（管理端「订单管理 → 退款/售后」，orders:refund） =====
  // 审核流：投诉处置 result=refund 只创建退款申请（pending_review），
  // 在本台账「通过 / 驳回」后才真正执行阶梯退款。详见 docs/refund-aftersale-design.md。

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @RequirePerm('orders:refund')
  @Get('refunds')
  listRefunds(@Query() q: any) {
    return this.payments.listRefunds(q);
  }

  // 运营主动发起退款（非投诉来源，进审核流）
  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @RequirePerm('orders:refund')
  @Audit('payments', 'orders:refund')
  @Post('refunds')
  createRefund(
    @Req() req: any,
    @Body() dto: { orderNo: string; amount?: number; reason?: string },
  ) {
    return this.payments.createRefundByOrderNo({
      orderNo: dto.orderNo,
      amount: dto.amount,
      reason: dto.reason,
      requestedBy: req.user.sub,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @RequirePerm('orders:refund')
  @Audit('payments', 'orders:refund')
  @Post('refunds/:id/approve')
  approveRefund(@Req() req: any, @Param('id') id: string, @Body() dto: { note?: string }) {
    return this.payments.reviewRefund(id, req.user.sub, {
      action: 'approve',
      note: dto?.note,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermGuard)
  @Roles(Role.Admin)
  @RequirePerm('orders:refund')
  @Audit('payments', 'orders:refund')
  @Post('refunds/:id/reject')
  rejectRefund(@Req() req: any, @Param('id') id: string, @Body() dto: { note?: string }) {
    return this.payments.reviewRefund(id, req.user.sub, {
      action: 'reject',
      note: dto?.note,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin)
  @Get()
  list() {
    return this.payments.list();
  }
}
