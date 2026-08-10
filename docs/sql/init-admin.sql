-- 老马家电：初始化默认管理员账号
-- 账号：admin
-- 密码：admin123
-- 执行前请先确认 MySQL 未处于 innodb_force_recovery 模式

USE laoma_jiadian;

INSERT INTO user (id, phone, passwordHash, role, nickname, status, createdAt, updatedAt)
SELECT UUID(), 'admin', '$2a$10$cB8eePnkWJYEc6FmLHT2veb70hsUABbrcU9PwW64ceF1DHpoY9ECa', 'admin', '系统管理员', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM user WHERE role = 'admin' LIMIT 1);

SELECT id, phone, role, nickname, status FROM user WHERE role = 'admin';
