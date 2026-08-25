import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../gateway/orders.gateway';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// —— AccessKeySecret 加密存储（AES-256-GCM）——
// 仅在服务端加解密：DB 落密文，配置服务内部 getGlobal 解密后供短信发送使用；
// 对外（浏览器）的 GET 由 config.public.controller 统一掩码为空串，绝不外泄明文。
// 密钥取自 SMS_SECRET_ENCRYPT_KEY（32 字节，hex 或 base64 均可）。未配置或非法时降级为明文存储并告警一次。
const SECRET_ALGO = 'aes-256-gcm';
const SECRET_ENV = process.env.SMS_SECRET_ENCRYPT_KEY;
const ENC_PREFIX = 'enc:v1:';
let warnedKey = false;

function getSecretKey(): Buffer | null {
  if (!SECRET_ENV) {
    if (!warnedKey) {
      warnedKey = true;
      console.warn(
        '[sms-secret] 未配置 SMS_SECRET_ENCRYPT_KEY，AccessKeySecret 将以明文存储（仅本地/演示可接受，生产环境务必配置）',
      );
    }
    return null;
  }
  for (const enc of ['hex', 'base64'] as const) {
    try {
      const buf = Buffer.from(SECRET_ENV, enc);
      if (buf.length === 32) return buf;
    } catch {
      /* 尝试下一种编码 */
    }
  }
  if (!warnedKey) {
    warnedKey = true;
    console.warn(
      '[sms-secret] SMS_SECRET_ENCRYPT_KEY 非法（需 32 字节 hex 或 base64），AccessKeySecret 将以明文存储',
    );
  }
  return null;
}

function encryptSecret(plain: string): string {
  const key = getSecretKey();
  if (!key) return plain; // 降级：明文存储
  const iv = randomBytes(12);
  const cipher = createCipheriv(SECRET_ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 格式：enc:v1:<iv>.<tag>.<ciphertext>  （base64，分隔符 . 不会出现在 base64 中）
  return (
    ENC_PREFIX +
    [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.')
  );
}

function decryptSecret(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) {
    // 历史明文或未知格式：原样返回（兼容未加密数据 / 降级明文，保证短信发送不中断）
    return stored;
  }
  const key = getSecretKey();
  if (!key) return stored; // 无密钥时无法解密，原样返回（此时本不该出现密文）
  try {
    const payload = stored.slice(ENC_PREFIX.length);
    const [ivB64, tagB64, encB64] = payload.split('.');
    const decipher = createDecipheriv(SECRET_ALGO, key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(encB64, 'base64')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch {
    // 解密失败（密钥轮换 / 数据损坏）：返回原值，由发码方报错提示重新填写
    return stored;
  }
}

export interface SystemConfigDto {
  siteName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  customerServicePhone: string | null;
  // 短信验证码模式：mock=开发/演示（验证码随响应回传前端 Toast 提示）；real=真实调用阿里云短信网关下发
  smsMode: string;
  // 阿里云短信网关参数（仅 real 模式生效）
  smsAccessKeyId: string | null;
  smsAccessKeySecret: string | null;
  smsSignName: string | null;
  smsTemplateCode: string | null;
  // 浏览器侧提示：AccessKeySecret 是否已配置（不直接返回明文）
  smsSecretSet: boolean;
  // Sentry DSN：前端拉取后据此初始化或关闭错误监控
  sentryDsn: string | null;
}

@Injectable()
export class ConfigService {
  constructor(
    private prisma: PrismaService,
    private ordersGateway: OrdersGateway,
  ) {}

  // 单例读取：不存在则 upsert 默认行（保证 GET 永远有值，无需前端判空分支）
  async getGlobal(): Promise<SystemConfigDto> {
    const cfg = await this.prisma.systemConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, siteName: '老马家电', smsMode: 'mock' },
    });
    return this.toDto(cfg);
  }

  // 单例更新：部分字段，未传字段保持不变；create 兜底防止并发下首写缺失
  async updateGlobal(dto: {
    siteName?: string;
    logoUrl?: string;
    primaryColor?: string;
    customerServicePhone?: string;
    smsMode?: string;
    smsAccessKeyId?: string;
    smsAccessKeySecret?: string;
    smsSignName?: string;
    smsTemplateCode?: string;
    sentryDsn?: string;
  }): Promise<SystemConfigDto> {
    const cfg = await this.prisma.systemConfig.upsert({
      where: { id: 1 },
      update: {
        ...(dto.siteName !== undefined ? { siteName: dto.siteName } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.primaryColor !== undefined ? { primaryColor: dto.primaryColor } : {}),
        ...(dto.customerServicePhone !== undefined
          ? { customerServicePhone: dto.customerServicePhone }
          : {}),
        ...(dto.smsMode !== undefined ? { smsMode: dto.smsMode } : {}),
        ...(dto.smsAccessKeyId !== undefined ? { smsAccessKeyId: dto.smsAccessKeyId } : {}),
        ...(dto.smsAccessKeySecret !== undefined
          ? { smsAccessKeySecret: encryptSecret(dto.smsAccessKeySecret) }
          : {}),
        ...(dto.smsSignName !== undefined ? { smsSignName: dto.smsSignName } : {}),
        ...(dto.smsTemplateCode !== undefined ? { smsTemplateCode: dto.smsTemplateCode } : {}),
        ...(dto.sentryDsn !== undefined ? { sentryDsn: dto.sentryDsn } : {}),
      },
      create: {
        id: 1,
        siteName: dto.siteName ?? '老马家电',
        logoUrl: dto.logoUrl ?? null,
        primaryColor: dto.primaryColor ?? null,
        customerServicePhone: dto.customerServicePhone ?? null,
        smsMode: dto.smsMode ?? 'mock',
        smsAccessKeyId: dto.smsAccessKeyId ?? null,
        smsAccessKeySecret: dto.smsAccessKeySecret != null ? encryptSecret(dto.smsAccessKeySecret) : null,
        smsSignName: dto.smsSignName ?? null,
        smsTemplateCode: dto.smsTemplateCode ?? null,
        sentryDsn: dto.sentryDsn ?? null,
      },
    });
    this.ordersGateway.broadcastSentryConfig(cfg.sentryDsn);
    return this.toDto(cfg);
  }

  private toDto(c: {
    siteName: string;
    logoUrl: string | null;
    primaryColor: string | null;
    customerServicePhone: string | null;
    smsMode: string;
    smsAccessKeyId: string | null;
    smsAccessKeySecret: string | null;
    smsSignName: string | null;
    smsTemplateCode: string | null;
    sentryDsn: string | null;
  }): SystemConfigDto {
    // smsAccessKeySecret 解密后供内部（短信发送）使用；浏览器侧由 public controller 掩码
    const secret = c.smsAccessKeySecret ? decryptSecret(c.smsAccessKeySecret) : null;
    return {
      siteName: c.siteName,
      logoUrl: c.logoUrl,
      primaryColor: c.primaryColor,
      customerServicePhone: c.customerServicePhone,
      smsMode: c.smsMode,
      smsAccessKeyId: c.smsAccessKeyId,
      smsAccessKeySecret: secret,
      smsSignName: c.smsSignName,
      smsTemplateCode: c.smsTemplateCode,
      smsSecretSet: !!c.smsAccessKeySecret,
      sentryDsn: c.sentryDsn,
    };
  }
}
