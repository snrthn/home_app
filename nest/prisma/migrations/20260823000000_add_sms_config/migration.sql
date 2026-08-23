-- 为 SystemConfig 增加短信验证码（阿里云）配置字段
-- smsMode: mock=开发/演示（验证码随响应回传前端 Toast 提示）；real=真实调用阿里云短信网关下发
-- 其余字段仅 real 模式生效；缺失时发码接口返回明确错误提示

ALTER TABLE `SystemConfig`
  ADD COLUMN `smsMode` VARCHAR(191) NOT NULL DEFAULT 'mock',
  ADD COLUMN `smsAccessKeyId` VARCHAR(191),
  ADD COLUMN `smsAccessKeySecret` VARCHAR(191),
  ADD COLUMN `smsSignName` VARCHAR(191),
  ADD COLUMN `smsTemplateCode` VARCHAR(191);
