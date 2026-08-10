// 通用日期格式化：YYYY-MM-DD HH:mm，空值返回 '-'
export function formatDateTime(s?: string | Date | null): string {
  if (!s) return '-';
  const d = typeof s === 'string' ? new Date(s) : s;
  if (isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
