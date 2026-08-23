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
    // 安全：AccessKeySecret 绝不外泄给浏览器。统一掩码为空串，并附带是否已配置标记供前端提示。
    // 短信发送所需的真实密钥在服务端内部（auth.service 调用 getGlobal）解密后使用，不经过此接口。
    return res
      .status(200)
      .json({ ...result, smsAccessKeySecret: '', smsSecretSet: !!result.smsAccessKeySecret });
  }
}
