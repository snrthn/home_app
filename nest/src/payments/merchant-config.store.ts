import { promises as fs } from 'node:fs';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';

// 商户配置存储（管理员在后台配置，用于「一键接入」真实支付通道）。
// 骨架阶段：存于服务端 JSON 文件（加密敏感字段），避免引入迁移；
// 后期可平滑替换为数据库表（SystemConfig），接口不变。

export interface MerchantConfig {
  provider: 'mock' | 'wechat' | 'alipay';
  enabled: boolean; // 真实通道是否启用（false = 全局走 mock）
  appId?: string;
  mchId?: string;
  // 敏感字段：加密落盘，绝不返回给前端明文
  appSecret?: string;
  apiKey?: string;
  certContent?: string;
  remark?: string;
}

const SECRET_FIELDS = ['appSecret', 'apiKey', 'certContent'] as const;

const ALGO = 'aes-256-gcm';
// 密钥取自环境变量，缺失时回退到开发默认值（生产必须配置 MERCHANT_ENC_KEY）
const ENC_KEY =
  process.env.MERCHANT_ENC_KEY ?? 'dev-only-merchant-enc-key-change-me';
const CONFIG_PATH =
  process.env.MERCHANT_CONFIG_PATH ??
  join(process.cwd(), 'config', 'merchant.json');

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

export class MerchantConfigStore {
  async read(): Promise<MerchantConfig> {
    try {
      const raw = await fs.readFile(CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      for (const f of SECRET_FIELDS) {
        if (parsed[f]) parsed[f] = decrypt(parsed[f]);
      }
      return { provider: 'mock', enabled: false, ...parsed };
    } catch {
      return { provider: 'mock', enabled: false };
    }
  }

  async write(cfg: MerchantConfig): Promise<MerchantConfig> {
    const toSave: Record<string, any> = { ...cfg };
    for (const f of SECRET_FIELDS) {
      if (toSave[f]) toSave[f] = encrypt(String(toSave[f]));
    }
    await fs.mkdir(dirname(CONFIG_PATH), { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(toSave, null, 2), 'utf8');
    return mask(cfg); // 回显脱敏副本
  }
}
