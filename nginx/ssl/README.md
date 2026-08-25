# SSL 证书

此目录挂载到容器 `/etc/nginx/ssl/`（只读），nginx.conf 引用以下文件：

| 文件 | 说明 |
|------|------|
| `fullchain.pem` | 证书链（含中间证书） |
| `privkey.pem` | 私钥 |

## 获取证书

### 方式一：Let's Encrypt（免费，推荐）

在服务器上用 certbot 签发（需先开放 80 端口并停止 nginx 占用）：

```bash
# 停止 nginx 释放 80 端口
docker compose -f docker-compose.prod.yml stop nginx

# 签发证书
certbot certonly --standalone -d laoma.snrthn.com

# 复制到项目目录
cp /etc/letsencrypt/live/laoma.snrthn.com/fullchain.pem ./nginx/ssl/
cp /etc/letsencrypt/live/laoma.snrthn.com/privkey.pem  ./nginx/ssl/

# 重启 nginx
docker compose -f docker-compose.prod.yml start nginx
```

### 方式二：已有证书

将 `fullchain.pem` 和 `privkey.pem` 放入此目录即可。

## 证书续期

Let's Encrypt 证书 90 天过期，续期后复制新文件并 reload nginx：

```bash
certbot renew
cp /etc/letsencrypt/live/laoma.snrthn.com/fullchain.pem ./nginx/ssl/
cp /etc/letsencrypt/live/laoma.snrthn.com/privkey.pem  ./nginx/ssl/
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## 安全提示

- **切勿将证书提交到 Git** — `.gitignore` 已排除 `*.pem`
- 证书文件权限设为 600：`chmod 600 nginx/ssl/*.pem`
