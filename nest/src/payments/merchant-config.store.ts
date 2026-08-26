import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

// 商户配置存储（管理员在后台配置，用于「一键接入」真实支付通道）。
// 原为 JSON 文件存储，现迁移到 DB（MerchantConfig 表），敏感字段加密后存库。

export interface MerchantConfig {
  provider: 'mock' | 'wechat' | 'alipay';
  enabled: boolean; // 真实通道是否启用（false = 全局走 mock）
  appId?: string;
  mchId?: string;
  // 敏感字段：加密落库，绝不返回给前端明文
  appSecret?: string;
  apiKey?: string;
  certContent?: string;
  remark?: string;
}

const SECRET_FIELDS = ['appSecret', 'apiKey', 'certContent'] as const;

const ALGO = 'aes-256-gcm';
const ENC_KEY =
  process.env.MERCHANT_ENC_KEY ?? 'dev-only-merchant-enc-key-change-me';

function getKey(): Buffer {
  return Buffer.from(ENC_KEY.padEnd(32, '0').slice(0, 32));
}

function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

function decrypt(blob: string): string {
  const [ivHex, tagHex, encHex] = blob.split(':');
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

function mask(cfg: MerchantConfig): MerchantConfig {
  const out: MerchantConfig = { ...cfg };
  delete out.appSecret;
  delete out.apiKey;
  delete out.certContent;
  return out;
}

@Injectable()
export class MerchantConfigStore {
  constructor(private readonly prisma: PrismaService) {}

  async read(): Promise<MerchantConfig> {
    const row = await this.prisma.merchantConfig.findUnique({ where: { id: 1 } });
    if (!row) return { provider: 'mock', enabled: false };

    const cfg: MerchantConfig = {
      provider: row.provider as MerchantConfig['provider'],
      enabled: row.enabled,
      appId: row.appId ?? undefined,
      mchId: row.mchId ?? undefined,
      remark: row.remark ?? undefined,
    };
    const secrets: Record<string, string | null> = {
      appSecret: row.appSecret,
      apiKey: row.apiKey,
      certContent: row.certContent,
    };
    for (const f of SECRET_FIELDS) {
      const raw = secrets[f];
      if (raw) (cfg as unknown as Record<string, unknown>)[f] = decrypt(raw);
    }
    return cfg;
  }

  async write(cfg: MerchantConfig): Promise<MerchantConfig> {
    const secretVals: Record<string, string | undefined> = {
      appSecret: cfg.appSecret,
      apiKey: cfg.apiKey,
      certContent: cfg.certContent,
    };
    const data: Record<string, unknown> = {
      provider: cfg.provider,
      enabled: cfg.enabled,
      appId: cfg.appId ?? null,
      mchId: cfg.mchId ?? null,
      remark: cfg.remark ?? null,
    };
    for (const f of SECRET_FIELDS) {
      const val = secretVals[f];
      data[f] = val ? encrypt(String(val)) : null;
    }
    await this.prisma.merchantConfig.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
    return mask(cfg);
  }
}
