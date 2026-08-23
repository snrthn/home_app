import { createHmac, randomUUID } from 'node:crypto';

// 阿里云短信（RPC 风格）原生 HTTP 调用，零外部 SDK 依赖。
// 签名算法遵循阿里云 RPC API 规范：HMAC-SHA1，按 key 升序拼接规范化查询串。

export interface AliyunSmsConfig {
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
}

/** 网关参数缺失或发送失败时抛出，auth.service 捕获后转成清晰的接口错误提示。 */
export class AliyunSmsError extends Error {}

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

/**
 * 发送短信验证码。code 会作为模板变量 {code} 下发。
 * 阿里云短信模板参数形如 {"code":"123456"}，模板内需含 ${code} 占位。
 */
export async function sendAliyunSms(
  cfg: AliyunSmsConfig,
  phone: string,
  code: string,
): Promise<void> {
  const missing: string[] = [];
  if (!cfg.accessKeyId) missing.push('accessKeyId');
  if (!cfg.accessKeySecret) missing.push('accessKeySecret');
  if (!cfg.signName) missing.push('signName');
  if (!cfg.templateCode) missing.push('templateCode');
  if (missing.length) {
    throw new AliyunSmsError(
      `短信网关未配置完整（缺少：${missing.join('、')}），请在运营平台「全局配置」填写阿里云短信参数后再切换为真实模式`,
    );
  }

  const params: Record<string, string> = {
    AccessKeyId: cfg.accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: phone,
    RegionId: 'cn-hangzhou',
    SignName: cfg.signName,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: randomUUID(),
    SignatureVersion: '1.0',
    TemplateCode: cfg.templateCode,
    TemplateParam: JSON.stringify({ code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
  };

  const sortedKeys = Object.keys(params).sort();
  const canonicalizedQuery = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&');

  const stringToSign = `GET&${percentEncode('/')}&${percentEncode(canonicalizedQuery)}`;
  const signature = createHmac('sha1', `${cfg.accessKeySecret}&`)
    .update(stringToSign, 'utf8')
    .digest('base64');

  const url = `https://dysmsapi.aliyuncs.com/?Signature=${percentEncode(
    signature,
  )}&${canonicalizedQuery}`;

  const resp = await fetch(url, { method: 'GET' });
  const body: any = await resp.json();
  if (body.Code !== 'OK') {
    throw new AliyunSmsError(`短信发送失败：${body.Code ?? 'Unknown'} - ${body.Message ?? '无错误信息'}`);
  }
}
