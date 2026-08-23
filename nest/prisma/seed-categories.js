/**
 * 服务类目三级树种子（prisma/seed-categories.js）。
 *
 * 作用：把老马家电 MVP 阶段的三级服务类目写入 ServiceCategory 表。
 * 运行：node prisma/seed-categories.js  或  pnpm seed-categories
 *
 * 幂等策略：
 *   - 用「层级 + 名称 + 父级名称」定位已有类目（三字段组合唯一）
 *   - 存在则 update（description/icon/sort/isActive），不存在则 create
 *   - 不会删除已存在的其他类目（管理员自建的保留）
 *
 * 结构：一级 4 个 / 二级 12 个 / 三级 37 个，共 53 条。
 * ServiceItem 挂在三级叶子上，由后台或另一份 seed 创建。
 */
const { PrismaClient } = require('../node_modules/.prisma/client');
const prisma = new PrismaClient();

// 数据：children 递归嵌套；顶层为一级类目。
const TREE = [
  {
    name: '家电清洗',
    icon: '🧹',
    sort: 10,
    description: '专业家电深度清洗、除菌除味，上门服务',
    children: [
      {
        name: '空调清洗',
        sort: 10,
        description: '家用空调全系列清洗',
        children: [
          { name: '挂机空调清洗', sort: 10, description: '1~1.5匹壁挂式空调常规清洗' },
          { name: '柜机空调清洗', sort: 20, description: '2~3匹立柜式空调清洗' },
          { name: '中央空调风口清洗', sort: 30, description: '家用中央空调风口+滤网清洗' },
          { name: '空调深度除菌洗', sort: 40, description: '含蒸发器深度清洁+高温除菌' },
        ],
      },
      {
        name: '油烟机清洗',
        sort: 20,
        description: '家用油烟机深度去油',
        children: [
          { name: '油烟机免拆洗', sort: 10, description: '整机外观+风轮免拆蒸汽洗' },
          { name: '油烟机全拆洗', sort: 20, description: '风轮/网罩全拆，浸泡+高压冲洗' },
          { name: '油烟机深度去油', sort: 30, description: '全拆洗+蜗壳/止回阀深度去油' },
        ],
      },
      {
        name: '洗衣机清洗',
        sort: 30,
        description: '波轮/滚筒洗衣机内筒清洗',
        children: [
          { name: '波轮洗衣机清洗', sort: 10, description: '波轮式内筒拆卸清洗' },
          { name: '滚筒洗衣机清洗', sort: 20, description: '滚筒式免拆高温除菌洗' },
          { name: '洗衣机杀菌除螨', sort: 30, description: '含洗剂除菌+除螨程序' },
        ],
      },
      {
        name: '冰箱清洗',
        sort: 40,
        description: '冰箱深度清洁除菌',
        children: [
          { name: '冰箱深度清洗', sort: 10, description: '内胆/门封/搁架全面清洁' },
          { name: '冰箱除菌除味', sort: 20, description: '深度清洗+臭氧/紫外除菌' },
        ],
      },
      {
        name: '热水器清洗',
        sort: 50,
        description: '电/燃气热水器水垢清洗',
        children: [
          { name: '电热水器清洗', sort: 10, description: '储水式电热水器除垢+镁棒检查' },
          { name: '燃气热水器清洗', sort: 20, description: '燃气热水器燃烧舱+水路清洁' },
        ],
      },
      {
        name: '其他家电清洗',
        sort: 90,
        description: '微波炉、饮水机等小家电清洗',
        children: [
          { name: '微波炉/烤箱清洗', sort: 10, description: '微波炉、嵌入式烤箱内部清洁' },
          { name: '饮水机清洗', sort: 20, description: '饮水机内胆+管路除菌清洗' },
        ],
      },
    ],
  },
  {
    name: '家电维修',
    icon: '🔧',
    sort: 20,
    description: '常见家电故障检测与维修、配件更换',
    children: [
      {
        name: '空调维修',
        sort: 10,
        description: '家用空调各类故障上门检测维修',
        children: [
          { name: '空调不制冷/不制热', sort: 10, description: '上门检测，含常见故障排查' },
          { name: '空调漏水维修', sort: 20, description: '室内机/外机漏水排查与修复' },
          { name: '空调加氟', sort: 30, description: '冷媒补充，含压力检测' },
          { name: '空调移机拆装', sort: 40, description: '拆机+装机（含运输协商）' },
        ],
      },
      {
        name: '油烟机维修',
        sort: 20,
        description: '油烟机故障检测与配件更换',
        children: [
          { name: '油烟机不启动', sort: 10, description: '电源/开关/电机故障排查' },
          { name: '油烟机噪音大', sort: 20, description: '风轮/电机异响排查与调整' },
          { name: '油烟机更换配件', sort: 30, description: '按键板/照明灯/止回阀等更换' },
        ],
      },
      {
        name: '洗衣机维修',
        sort: 30,
        description: '洗衣机常见故障维修',
        children: [
          { name: '洗衣机不排水', sort: 10, description: '排水泵/排水管故障排查' },
          { name: '洗衣机不脱水', sort: 20, description: '门开关/电脑板/皮带故障排查' },
          { name: '洗衣机门锁/电脑板故障', sort: 30, description: '门锁损坏、程序报错等' },
        ],
      },
      {
        name: '冰箱维修',
        sort: 40,
        description: '冰箱不制冷、结冰、压缩机等故障',
        children: [
          { name: '冰箱不制冷', sort: 10, description: '冷媒/压缩机/温控器故障排查' },
          { name: '冰箱结冰/漏水', sort: 20, description: '门封/化霜系统/排水管排查' },
          { name: '冰箱压缩机故障', sort: 30, description: '压缩机异响、不启动等' },
        ],
      },
      {
        name: '热水器维修',
        sort: 50,
        description: '电/燃气热水器故障维修',
        children: [
          { name: '热水器不出热水', sort: 10, description: '加热管/温控/燃气阀排查' },
          { name: '热水器漏水', sort: 20, description: '内胆/安全阀/管路漏水排查' },
          { name: '热水器点火故障', sort: 30, description: '燃气热水器点火针/电磁阀故障' },
        ],
      },
    ],
  },
  {
    name: '家电安装',
    icon: '🛠️',
    sort: 30,
    description: '新机安装、拆机、移机，标准化作业',
    children: [
      {
        name: '空调安装',
        sort: 10,
        description: '家用空调安装、拆机、移机',
        children: [
          { name: '空调新机安装', sort: 10, description: '挂机/柜机新机标准安装' },
          { name: '空调拆机', sort: 20, description: '回收冷媒后安全拆机' },
          { name: '空调移机', sort: 30, description: '拆机+装机整套服务' },
        ],
      },
      {
        name: '油烟机/灶具安装',
        sort: 20,
        description: '油烟机、燃气灶安装',
        children: [
          { name: '油烟机安装', sort: 10, description: '顶吸/侧吸油烟机安装' },
          { name: '燃气灶安装', sort: 20, description: '嵌入式/台式燃气灶安装' },
          { name: '油烟机+灶具套装安装', sort: 30, description: '烟灶套装整体安装调试' },
        ],
      },
      {
        name: '热水器安装',
        sort: 30,
        description: '电/燃气热水器安装',
        children: [
          { name: '电热水器安装', sort: 10, description: '储水式电热水器挂装+水路' },
          { name: '燃气热水器安装', sort: 20, description: '燃气热水器安装+烟管调试' },
        ],
      },
    ],
  },
  {
    name: '商用设备服务',
    icon: '🏢',
    sort: 40,
    description: '商户/门店的中央空调、厨房设备维保',
    children: [
      {
        name: '中央空调维保',
        sort: 10,
        description: '商用/多联机中央空调维保',
        children: [
          { name: '中央空调季度维保', sort: 10, description: '季度清洗+检查+滤网更换' },
          { name: '中央空调故障检修', sort: 20, description: '商用多联机/风管机故障排查' },
        ],
      },
      {
        name: '商用厨房设备',
        sort: 20,
        description: '饭店/食堂厨房设备清洗维修',
        children: [
          { name: '商用油烟机清洗', sort: 10, description: '油烟净化器+管道+风机深度清洗' },
          { name: '商用燃气灶维修', sort: 20, description: '大锅灶/煲仔炉等商用灶维修' },
        ],
      },
    ],
  },
];

/**
 * 递归创建/更新类目树。
 * @param {Array} nodes  本级节点列表
 * @param {string|null} parentId  父级 id（一级为 null）
 * @param {number} level  当前层级 1/2/3
 */
async function upsertLevel(nodes, parentId, level) {
  let created = 0;
  let updated = 0;
  for (const node of nodes) {
    // 同层级同父级下，name 唯一
    const existing = await prisma.serviceCategory.findFirst({
      where: {
        name: node.name,
        level,
        parentId,
        deletedAt: null,
      },
    });

    const data = {
      name: node.name,
      level,
      parentId,
      description: node.description ?? null,
      icon: node.icon ?? null,
      sort: node.sort ?? 0,
      isActive: true,
    };

    let id;
    if (existing) {
      // 已存在：只更新描述/icon/sort 等元信息，不动 id/父子关系
      await prisma.serviceCategory.update({
        where: { id: existing.id },
        data,
      });
      id = existing.id;
      updated++;
    } else {
      const createdRec = await prisma.serviceCategory.create({ data });
      id = createdRec.id;
      created++;
    }

    if (node.children && node.children.length) {
      if (level >= 3) {
        throw new Error(`类目「${node.name}」下还有 children，但 level 已达 3，不允许四级`);
      }
      const childStats = await upsertLevel(node.children, id, level + 1);
      created += childStats.created;
      updated += childStats.updated;
    }
  }
  return { created, updated };
}

async function main() {
  const stats = await upsertLevel(TREE, null, 1);
  const total = await prisma.serviceCategory.count({ where: { deletedAt: null } });
  console.log(`类目种子完成：新增 ${stats.created} 条，更新 ${stats.updated} 条，当前有效类目共 ${total} 条`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
