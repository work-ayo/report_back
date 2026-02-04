export function randomJoinCode(len = 8) {
  // 입력 쉬운 문자만 사용(0/O, 1/I 같은 혼동 제거)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// YYYY-MM-DD -> Date(UTC midnight)
export function parseYmdToUtcDate(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw new Error("INVALID_DATE");
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
}

// 해당 날짜가 속한 주의 "월요일 00:00(UTC)"로 정규화
export function toWeekStartUtc(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diffToMon = (day + 6) % 7; // Mon=0, Tue=1 ... Sun=6
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() - diffToMon);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

export function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatKrw(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

export function diffDays(a: Date, b: Date): number {
  // a - b (일 단위)
  const ms = 24 * 60 * 60 * 1000;
  return Math.floor((a.getTime() - b.getTime()) / ms);
}

// endDate 기준 dDay: 남은 일수(미래면 +), 지나면 -
export function calcDDay(endYmd: string, today = new Date()): number {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const end = parseYmd(endYmd);
  return diffDays(end, t);
}

export function labelDDay(dDay: number): string {
  if (dDay === 0) return "D-DAY";
  if (dDay > 0) return `D-${dDay}`;
  return `D+${Math.abs(dDay)}`;
}
