export function randomJoinCode(len = 8) {
  // 입력 쉬운 문자만 사용(0/O, 1/I 같은 혼동 제거)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
