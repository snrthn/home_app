// 内存级 token 黑名单（单实例 MVP 适用）。
// - 进程重启即清空；多实例不共享（后续可换 Redis）。
// - key = JWT 的 jti，value = 过期时间戳(秒)，用于惰性清理。
const blacklist = new Map<string, number>();

export function blacklistToken(jti: string, exp?: number): void {
  blacklist.set(jti, exp ?? Math.floor(Date.now() / 1000) + 60);
}

export function isBlacklisted(jti?: string): boolean {
  if (!jti) return false;
  const exp = blacklist.get(jti);
  if (exp === undefined) return false;
  if (exp * 1000 <= Date.now()) {
    blacklist.delete(jti);
    return false;
  }
  return true;
}
