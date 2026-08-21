// P2-3 区域匹配算法验证（纯逻辑，复刻 gateway 内联实现，无需 DB/网络）
// 房间约定：zone:<provinceCode>:<cityCode>:<districtCode>，空段=通配
// 网关 dispatchZones() 决定订单推哪些房间；handleJoinPool() 决定师傅进哪些房间。
// 师傅收到 new-order 当且仅当 两者房间集合有交集。
function dispatchZones(addr) {
  const p = addr?.provinceCode, c = addr?.cityCode, d = addr?.districtCode;
  const rooms = ['pool']; // 全平台可见兜底
  if (p) {
    rooms.push(`zone:${p}::`);
    if (c) rooms.push(`zone:${p}:${c}:`);
    if (d) rooms.push(`zone:${p}:${c}:${d}`);
  }
  return rooms;
}
function masterRooms(areas) {
  const rooms = new Set();
  let joined = false;
  for (const a of (Array.isArray(areas) ? areas : [])) {
    const p = a?.provinceCode, c = a?.cityCode, d = a?.districtCode;
    if (!p) continue; // 缺省级无法定位区域
    rooms.add(`zone:${p}::`);
    if (c) rooms.add(`zone:${p}:${c}:`);
    if (d) rooms.add(`zone:${p}:${c}:${d}`);
    joined = true;
  }
  if (!joined) rooms.add('pool'); // serviceAreas 为空=全平台可见
  return rooms;
}
function receives(orderAddr, masterAreas) {
  const push = dispatchZones(orderAddr);
  const joined = masterRooms(masterAreas);
  return push.some((r) => joined.has(r));
}

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name); }
}

const bjChaoyang = { provinceCode: '11', cityCode: '1101', districtCode: '110105' };
const shPudong = { provinceCode: '31', cityCode: '3101', districtCode: '310115' };

console.log('订单推送房间(北京朝阳):', dispatchZones(bjChaoyang));
console.log('订单推送房间(上海浦东):', dispatchZones(shPudong));
console.log('\n用例:');
assert('北京全境师傅 收 北京朝阳单', receives(bjChaoyang, [{ provinceCode: '11' }]));
assert('上海师傅 不收 北京朝阳单', !receives(bjChaoyang, [{ provinceCode: '31' }]));
assert('北京朝阳师傅 收 北京朝阳单', receives(bjChaoyang, [{ provinceCode: '11', cityCode: '1101' }]));
assert('北京师傅 不收 上海单', !receives(shPudong, [{ provinceCode: '11' }]));
assert('全平台师傅(空serviceAreas) 收 北京单', receives(bjChaoyang, []));
assert('全平台师傅(空serviceAreas) 收 上海单', receives(shPudong, []));
assert('缺省级 serviceAreas 项 视为全平台 收 北京单', receives(bjChaoyang, [{ cityCode: '1101' }]));
assert('上海师傅 收 上海浦东单', receives(shPudong, [{ provinceCode: '31' }]));
assert('北京师傅 不收 上海单(反例)', !receives(shPudong, [{ provinceCode: '11' }]));

console.log(`\n结果: ${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
