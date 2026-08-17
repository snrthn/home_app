import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from './config.service';

// 公开：取全局配置（系统名称 / 主题色 / 客服电话等），无需登录。
// 前端挂载时拉取以应用主题色，用户端「在线客服」读取客服电话。
@Controller('config')
export class ConfigPublicController {
  constructor(private s: ConfigService) {}

  @Get('global')
  async getGlobal(@Res() res: Response) {
    const result = await this.s.getGlobal();
    return res.status(200).json(result);
  }
}
