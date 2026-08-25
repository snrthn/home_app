import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { AgreementsService } from './agreements.service';

// 公开：取某端某类型的当前生效协议版本（注册/隐私政策弹窗用，无需登录）
@ApiTags('协议管理')
@Controller('agreements')
export class AgreementsPublicController {
  constructor(private s: AgreementsService) {}

  // GET /agreements/default?scope=customer&type=registration
  // 返回当前 isCurrent && published 的版本；无则显式返回 JSON null（前端据此隐藏入口）
  @ApiOperation({ summary: '获取当前生效协议' })
  @ApiQuery({ name: 'scope', description: '端（customer/master/admin）' })
  @ApiQuery({ name: 'type', description: '协议类型（如 registration/privacy）' })
  @Get('default')
  async getDefault(
    @Query('scope') scope: string,
    @Query('type') type: string,
    @Res() res: Response,
  ) {
    const result = await this.s.getDefault(scope, type);
    // 显式 json(null) 保证空结果也是合法 JSON（避免 200 空 body 让前端解析失败）
    return res.status(200).json(result ?? null);
  }
}
