/**
 * 服务项目种子（prisma/seed-items.js）。
 *
 * 作用：为三级类目预置示例服务项目（含价格、时长、封面图、富文本介绍），
 *       方便 MVP 阶段直接演示客户端下单流程，无需后台一条条手动创建。
 * 运行：node prisma/seed-items.js  或  pnpm seed:items
 *
 * 幂等策略：
 *   - 用「类目 id + 项目名称」定位已存在项目
 *   - 已存在：只更新 price/unit/estimatedDuration/coverImage/description/sort/isActive
 *             （不覆盖管理员后台可能改过的字段）
 *   - 不存在：创建
 *   - 只处理本脚本里列出的项目，不删除管理员自建的其他项目
 *
 * 前置：需先跑 seed-categories.js（类目存在才能挂项目）。
 */
const { PrismaClient } = require('../node_modules/.prisma/client');
const prisma = new PrismaClient();

// 富文本模板生成器：统一风格的服务介绍，含 服务流程 / 服务亮点 / 注意事项
function buildDescription({
  summary,
  steps,
  highlights,
  notices,
}) {
  const stepsHtml = steps
    .map(
      (s, i) => `
<p><strong>第 ${i + 1} 步 · ${s.title}</strong></p>
<p>${s.desc}</p>`,
    )
    .join('');

  const highlightsHtml = highlights
    .map((h) => `<li>${h}</li>`)
    .join('');

  const noticesHtml = notices
    .map((n) => `<li>${n}</li>`)
    .join('');

  return `
<p>${summary}</p>
<h3>服务流程</h3>
${stepsHtml}
<h3>服务亮点</h3>
<ul>${highlightsHtml}</ul>
<h3>注意事项</h3>
<ul>${noticesHtml}</ul>
<p style="color:#6b7280;font-size:13px;">* 以上为标准服务内容，实际服务以师傅现场确认为准；如需额外服务可现场与师傅沟通加价。</p>
`.trim();
}

// 服务项目封面图：使用本地静态图片，部署后可靠访问
const cover = (filename) => `/images/services/${filename}`;

/**
 * 数据结构：按一级→二级→三级 嵌套查找类目，
 * 找到后在该三级类目下创建服务项目。
 * 项目的 name 对应三级类目名（一一对应），也可自行加多个项目。
 */
const DATA = [
  // ==================== 家电清洗 ====================
  {
    l1: '家电清洗',
    l2: '空调清洗',
    items: [
      {
        l3: '挂机空调清洗',
        name: '挂机空调深度清洗',
        price: 99,
        unit: '台',
        estimatedDuration: 60,
        sort: 1,
        cover: cover('ac-cleaning.jpg'),
        desc: buildDescription({
          summary: '专业师傅上门，对壁挂式空调进行整机深度清洗，有效去除蒸发器灰尘、滤网细菌、风轮油污，出风更清新。',
          steps: [
            { title: '外观检查', desc: '检查空调外观、电源、遥控器，确认运行状态与故障情况。' },
            { title: '拆机防护', desc: '佩戴鞋套、铺设防护罩，保护墙面与家具不受水渍污染。' },
            { title: '深度清洁', desc: '拆洗滤网、蒸发器高温蒸汽冲洗、风轮清洁、接水盘疏通。' },
            { title: '装机试机', desc: '装回部件、通电试机、确认制冷/制热正常、清理现场。' },
          ],
          highlights: ['高温蒸汽除菌', '专业工具拆洗', '整机质保 7 天', '明码标价无隐形消费'],
          notices: ['适用于 1-1.5 匹壁挂式空调', '如遇柜机/中央空调请选择对应服务', '高层室外作业需额外确认安全条件'],
        }),
      },
      {
        l3: '柜机空调清洗',
        name: '柜机空调深度清洗',
        price: 169,
        unit: '台',
        estimatedDuration: 90,
        sort: 1,
        cover: cover('ac-cleaning.jpg'),
        desc: buildDescription({
          summary: '立柜式空调整机拆洗，适合 2-3 匹柜机，深度去污除菌，出风更干净。',
          steps: [
            { title: '状态检测', desc: '通电试机，检查制冷效果、风量、有无异响。' },
            { title: '拆机防护', desc: '铺设防水布，拆卸面板、滤网、风轮等部件。' },
            { title: '深度清洁', desc: '蒸发器清洗、风轮浸泡冲洗、接水盘深度去垢、外壳擦拭。' },
            { title: '装机验收', desc: '装回部件、通电试机、风速/制冷检测、清理现场。' },
          ],
          highlights: ['整机拆洗', '高温蒸汽除菌', '90 分钟标准服务', '服务后 7 天质保'],
          notices: ['适用于 2-3 匹立柜式空调', '圆柱柜机价格略有不同，以现场确认为准'],
        }),
      },
      {
        l3: '空调深度除菌洗',
        name: '空调深度除菌洗（含消毒剂）',
        price: 149,
        unit: '台',
        estimatedDuration: 75,
        sort: 2,
        cover: cover('ac-cleaning.jpg'),
        desc: buildDescription({
          summary: '在常规深度清洗基础上，增加专业消毒剂除菌步骤，适合换季开机前、母婴家庭、过敏体质人群。',
          steps: [
            { title: '拆洗准备', desc: '拆机、铺设防护、检查运行状态。' },
            { title: '深度清洗', desc: '蒸发器、风轮、滤网全拆洗，去除可见灰尘油污。' },
            { title: '消毒除菌', desc: '使用食品级消毒剂对蒸发器、接水盘均匀喷洒，作用 15 分钟。' },
            { title: '清水冲洗+试机', desc: '高压清水冲洗残留，装机试机，确认出风无异味。' },
          ],
          highlights: ['食品级消毒剂', '除菌率 99.9%', '母婴家庭适用', '无残留异味'],
          notices: ['消毒后通风 30 分钟再使用更佳', '消毒剂为食品级，对人体无害'],
        }),
      },
    ],
  },
  {
    l1: '家电清洗',
    l2: '油烟机清洗',
    items: [
      {
        l3: '油烟机全拆洗',
        name: '油烟机全拆深度清洗',
        price: 159,
        unit: '台',
        estimatedDuration: 90,
        sort: 1,
        cover: cover('range-hood.jpg'),
        desc: buildDescription({
          summary: '油烟机风轮、网罩、蜗壳全拆洗，深度去除重油污，恢复吸力，延长使用寿命。',
          steps: [
            { title: '拆机检查', desc: '断电、拆卸风轮、网罩、油杯，检查电机与照明。' },
            { title: '浸泡去油', desc: '风轮、网罩放入专用药剂中浸泡 20 分钟，软化重油污。' },
            { title: '高压冲洗', desc: '高压水枪冲洗风轮、蜗壳、止回阀，去除全部油污。' },
            { title: '装机试机', desc: '擦干装回，通电测试吸力、照明，清理灶台与地面。' },
          ],
          highlights: ['全拆洗工艺', '重油污克星', '吸力恢复如初', '服务后 7 天质保'],
          notices: ['适用于顶吸/侧吸家用油烟机', '集成灶清洗需另报价', '油污严重可能需要更长时间'],
        }),
      },
      {
        l3: '油烟机免拆洗',
        name: '油烟机免拆蒸汽清洗',
        price: 89,
        unit: '台',
        estimatedDuration: 45,
        sort: 2,
        cover: cover('range-hood.jpg'),
        desc: buildDescription({
          summary: '无需拆洗风轮，采用高温蒸汽对油烟机内部进行软化清洁，适合日常保养、轻度油污。',
          steps: [
            { title: '准备工作', desc: '断电、防护罩铺设，保护灶台与墙面。' },
            { title: '蒸汽软化', desc: '高温蒸汽枪对风轮、滤网喷射，软化油污。' },
            { title: '油污收集', desc: '使用专用集油罩收集融化的油污。' },
            { title: '擦拭+试机', desc: '外表面擦拭干净，通电测试，清理现场。' },
          ],
          highlights: ['不拆机不伤机', '45 分钟快速完成', '价格实惠', '适合日常保养'],
          notices: ['适合轻度油污，重油污建议选全拆洗', '不拆风轮，内部清洁度有限'],
        }),
      },
    ],
  },
  {
    l1: '家电清洗',
    l2: '洗衣机清洗',
    items: [
      {
        l3: '波轮洗衣机清洗',
        name: '波轮洗衣机全拆清洗',
        price: 129,
        unit: '台',
        estimatedDuration: 90,
        sort: 1,
        cover: cover('washer-cleaning.jpg'),
        desc: buildDescription({
          summary: '拆卸波轮盘、内筒，彻底清洁内外筒夹层污垢、洗剂残留与霉菌，告别"越洗越脏"。',
          steps: [
            { title: '拆机检查', desc: '拆卸波轮盘、取出内筒，检查密封圈与排水系统。' },
            { title: '浸泡去垢', desc: '专用洗剂浸泡内筒、波轮盘，软化水垢与洗剂残留。' },
            { title: '高压冲洗', desc: '高压水枪冲洗内外筒、门封圈、排水泵。' },
            { title: '装机试机', desc: '装回部件，标准程序试洗一次，确认无漏水无异响。' },
          ],
          highlights: ['全拆深度清洁', '去除桶壁水垢', '除菌除螨', '90 分钟标准服务'],
          notices: ['适用于波轮式洗衣机', '建议每 6-12 个月清洗一次'],
        }),
      },
      {
        l3: '滚筒洗衣机清洗',
        name: '滚筒洗衣机免拆除菌洗',
        price: 99,
        unit: '台',
        estimatedDuration: 60,
        sort: 1,
        cover: cover('washer-cleaning.jpg'),
        desc: buildDescription({
          summary: '滚筒式洗衣机免拆清洗，采用专用清洁剂+高温除菌程序，有效去除门封圈霉菌与筒内异味。',
          steps: [
            { title: '外观检查', desc: '检查门封圈、过滤器、排水泵，记录异常。' },
            { title: '清洁门封圈', desc: '手工清理门封圈霉斑与残留异物。' },
            { title: '筒洗程序', desc: '加入专用清洁剂，运行 90℃ 筒自洁程序。' },
            { title: '清理+试机', desc: '清理过滤器、排水泵，试机确认正常。' },
          ],
          highlights: ['免拆不伤机', '90℃ 高温除菌', '门封圈深度清洁', '适合定期保养'],
          notices: ['适用于滚筒式洗衣机', '重度污染建议联系品牌售后拆洗'],
        }),
      },
    ],
  },
  {
    l1: '家电清洗',
    l2: '冰箱清洗',
    items: [
      {
        l3: '冰箱深度清洗',
        name: '冰箱深度清洗除菌',
        price: 119,
        unit: '台',
        estimatedDuration: 60,
        sort: 1,
        cover: cover('fridge.jpg'),
        desc: buildDescription({
          summary: '冰箱内胆、搁架、门封条、接水盘全方位清洁，去除食物残渣、异味、细菌，守护家人饮食健康。',
          steps: [
            { title: '断电清空', desc: '断电、清空食物，分类整理搁架与抽屉。' },
            { title: '内胆清洁', desc: '食品级清洁剂擦拭内胆、搁架、抽屉、门封条。' },
            { title: '排水疏通', desc: '疏通排水孔，清洁接水盘，防止滋生细菌。' },
            { title: '消毒+复原', desc: '臭氧/紫外消毒，擦干装回搁架抽屉，通电确认运行。' },
          ],
          highlights: ['食品级清洁剂', '门封条深度清洁', '臭氧除菌', '60 分钟标准服务'],
          notices: ['请提前 2 小时断电化冰', '仅限冰箱内部清洁，外观除尘免费'],
        }),
      },
    ],
  },
  {
    l1: '家电清洗',
    l2: '热水器清洗',
    items: [
      {
        l3: '电热水器清洗',
        name: '电热水器除垢清洗',
        price: 139,
        unit: '台',
        estimatedDuration: 75,
        sort: 1,
        cover: cover('water-heater.jpg'),
        desc: buildDescription({
          summary: '电热水器内胆除垢、镁棒检查更换，提升加热效率，延长使用寿命，保障用水健康。',
          steps: [
            { title: '断电放水', desc: '断电、关闭进水阀，放水泄压。' },
            { title: '拆检加热棒', desc: '拆卸加热棒，检查镁棒消耗情况与水垢厚度。' },
            { title: '内胆除垢', desc: '专业除垢剂循环清洗内胆，溶解水垢。' },
            { title: '装机试机', desc: '装回加热棒、加水排气、通电试热，检查有无漏水。' },
          ],
          highlights: ['专业除垢剂', '加热效率提升 30%', '镁棒状态检测', '7 天质保'],
          notices: ['适用于储水式电热水器', '镁棒如需更换费用另计', '建议每 1-2 年清洗一次'],
        }),
      },
    ],
  },

  // ==================== 家电维修 ====================
  {
    l1: '家电维修',
    l2: '空调维修',
    items: [
      {
        l3: '空调不制冷/不制热',
        name: '空调不制冷/不制热上门检测',
        price: 50,
        unit: '次',
        estimatedDuration: 45,
        sort: 1,
        cover: cover('ac-repair.jpg'),
        desc: buildDescription({
          summary: '师傅上门检测空调不制冷/不制热原因，检测费可抵扣维修费，不修只收上门检测费。',
          steps: [
            { title: '故障排查', desc: '检查电源、遥控器、内机显示、外机运行状态。' },
            { title: '专业检测', desc: '压力表检测冷媒压力、电容/压缩机检测。' },
            { title: '报价确认', desc: '告知故障原因与维修报价，用户确认后再修。' },
            { title: '维修/收尾', desc: '同意则现场维修，试机确认；不同意仅收检测费。' },
          ],
          highlights: ['先检测后报价', '检测费可抵扣维修费', '原厂品质配件', '维修质保 90 天'],
          notices: ['50 元为上门检测费，维修费用另计', '检测费可抵扣同次维修费', '不修不收取维修费'],
        }),
      },
      {
        l3: '空调加氟',
        name: '空调加氟（冷媒补充）',
        price: 80,
        unit: '压',
        estimatedDuration: 30,
        sort: 2,
        cover: cover('ac-repair.jpg'),
        desc: buildDescription({
          summary: '空调冷媒补充（加氟），适用于制冷效果下降、细管结霜等缺氟症状，按压力计费。',
          steps: [
            { title: '压力检测', desc: '连接压力表，检测当前冷媒压力与泄漏情况。' },
            { title: '查漏点', desc: '检查接口、阀门有无泄漏点，必要时紧固。' },
            { title: '补充冷媒', desc: '按标准补充至额定压力，运行观察。' },
            { title: '效果确认', desc: '运行 10 分钟，检测进出风温差，确认制冷效果。' },
          ],
          highlights: ['精准控量', '先检测后加氟', '质保 30 天', '价格透明'],
          notices: ['80 元/压，一般需 3-5 压', '如泄漏需先修漏再加氟', 'R32/R410a 等不同冷媒价格一致'],
        }),
      },
    ],
  },
  {
    l1: '家电维修',
    l2: '洗衣机维修',
    items: [
      {
        l3: '洗衣机不排水',
        name: '洗衣机不排水上门维修',
        price: 50,
        unit: '次',
        estimatedDuration: 45,
        sort: 1,
        cover: cover('washer-cleaning.jpg'),
        desc: buildDescription({
          summary: '洗衣机不排水、排水慢故障上门检测维修，常见为排水泵堵塞、排水泵损坏或电脑板故障。',
          steps: [
            { title: '故障判断', desc: '运行排水程序，听声音判断排水泵是否工作。' },
            { title: '拆机检查', desc: '打开后盖/底部，检查排水泵、管路、过滤器。' },
            { title: '清理/更换', desc: '堵塞则清理；泵损坏则更换同型号排水泵。' },
            { title: '试机验收', desc: '标准程序试洗一次，确认排水正常、无漏水。' },
          ],
          highlights: ['先检测后报价', '检测费可抵扣维修费', '常见配件当场更换', '维修质保 90 天'],
          notices: ['50 元为检测费，维修费用另计', '检测费可抵扣同次维修费', '配件费用按实结算'],
        }),
      },
    ],
  },
  {
    l1: '家电维修',
    l2: '冰箱维修',
    items: [
      {
        l3: '冰箱不制冷',
        name: '冰箱不制冷上门检测',
        price: 50,
        unit: '次',
        estimatedDuration: 45,
        sort: 1,
        cover: cover('fridge.jpg'),
        desc: buildDescription({
          summary: '冰箱不制冷、制冷差、压缩机不启动等故障上门检测，检测费可抵扣维修费。',
          steps: [
            { title: '症状确认', desc: '了解故障现象、使用年限、近期有无异响。' },
            { title: '系统检测', desc: '检查压缩机运行、温控器、蒸发器结霜情况。' },
            { title: '报价确认', desc: '判断故障原因，给出维修报价，用户确认后维修。' },
            { title: '维修/收尾', desc: '同意则现场维修，试机确认；不同意仅收检测费。' },
          ],
          highlights: ['专业检测仪器', '先报价后维修', '维修质保 90 天', '原厂品质配件'],
          notices: ['50 元为上门检测费，维修费用另计', '检测费可抵扣同次维修费', '如需换件费用另计'],
        }),
      },
    ],
  },

  // ==================== 家电安装 ====================
  {
    l1: '家电安装',
    l2: '空调安装',
    items: [
      {
        l3: '空调新机安装',
        name: '空调新机安装（挂机）',
        price: 150,
        unit: '台',
        estimatedDuration: 90,
        sort: 1,
        cover: cover('ac-installation.jpg'),
        desc: buildDescription({
          summary: '全新挂机空调标准安装服务，含打孔（普通墙）、挂板、接水管、抽真空、试机。',
          steps: [
            { title: '定位确认', desc: '确认室内外机安装位置、打孔位置、电源插座情况。' },
            { title: '打孔安装', desc: '水钻打孔（普通砖墙）、安装挂板/支架。' },
            { title: '连接管线', desc: '连接铜管、排水管、电线，包扎整理。' },
            { title: '抽真空+试机', desc: '真空泵抽真空 15 分钟，打开阀门，通电试机。' },
          ],
          highlights: ['含普通砖墙打孔', '含 3 米内标准铜管', '专业抽真空', '质保 30 天'],
          notices: ['价格为 1-1.5 匹挂机，柜机另计', '混凝土墙打孔需加价', '超出铜管/支架费用另计'],
        }),
      },
      {
        l3: '空调移机',
        name: '空调移机（拆机+装机）',
        price: 200,
        unit: '台',
        estimatedDuration: 120,
        sort: 2,
        cover: cover('ac-installation.jpg'),
        desc: buildDescription({
          summary: '空调整套移机服务（拆机+装机），含冷媒回收、拆机、装机、抽真空、试机。',
          steps: [
            { title: '冷媒回收', desc: '开机运行，回收冷媒至室外机，关闭阀门。' },
            { title: '拆机打包', desc: '断开管线、电线，拆卸室内外机，妥善包装。' },
            { title: '安装固定', desc: '新位置打孔（如需）、挂板/支架固定。' },
            { title: '连接+抽真空+试机', desc: '连接管线、抽真空、开阀、通电试机。' },
          ],
          highlights: ['专业冷媒回收', '含 1 次普通砖墙打孔', '全程 2 小时左右', '质保 30 天'],
          notices: ['不含运输费用', '超出铜管需补差价', '高层作业需额外确认'],
        }),
      },
    ],
  },
  {
    l1: '家电安装',
    l2: '热水器安装',
    items: [
      {
        l3: '电热水器安装',
        name: '电热水器安装',
        price: 100,
        unit: '台',
        estimatedDuration: 75,
        sort: 1,
        cover: cover('water-heater.jpg'),
        desc: buildDescription({
          summary: '储水式电热水器标准安装，含挂架固定、水路连接、通电试机，安全可靠。',
          steps: [
            { title: '定位确认', desc: '确认安装位置、承重墙情况、水电接口位置。' },
            { title: '挂架安装', desc: '打孔安装膨胀螺栓，固定挂架，确保承重。' },
            { title: '水路连接', desc: '连接冷热水管、安全阀、泄压管。' },
            { title: '注水试机', desc: '注满水后排空、通电加热、检查有无漏水。' },
          ],
          highlights: ['承重挂架', '含标准配件', '75 分钟标准服务', '质保 30 天'],
          notices: ['价格为基础安装费，配件费用另计', '需承重墙或实心砖墙体', '高层作业需额外确认'],
        }),
      },
    ],
  },

  // ==================== 商用设备服务 ====================
  {
    l1: '商用设备服务',
    l2: '商用厨房设备',
    items: [
      {
        l3: '商用油烟机清洗',
        name: '商用油烟机管道清洗',
        price: 500,
        unit: '次（起）',
        estimatedDuration: 240,
        sort: 1,
        cover: cover('commercial-kitchen.jpg'),
        desc: buildDescription({
          summary: '饭店/食堂商用油烟机整套清洗，含烟罩、管道、净化器、风机，满足消防检查要求。',
          steps: [
            { title: '现场勘察', desc: '查看烟罩尺寸、管道走向、净化器位置，确认工作量。' },
            { title: '防护准备', desc: '保护灶台、地面，铺设防护布，准备工具药剂。' },
            { title: '深度清洗', desc: '烟罩手工去油、管道人工进入/开孔清洗、净化器拆洗、风轮清洗。' },
            { title: '复原验收', desc: '装回部件、清理现场、通电试机、出具清洗证明。' },
          ],
          highlights: ['满足消防检查要求', '专业清洗团队', '清洗后出具证明', '可签长期维保合同'],
          notices: ['500 元为起步价，按实际工作量报价', '需停业施工，请提前预约', '可签订季度/月度维保协议'],
        }),
      },
    ],
  },
];

// 辅助：在树里按名找节点
function findByName(nodes, name) {
  for (const n of nodes) {
    if (n.name === name) return n;
    if (n.children?.length) {
      const found = findByName(n.children, name);
      if (found) return found;
    }
  }
  return null;
}

async function main() {
  // 加载类目树（含 id）
  const cats = await prisma.serviceCategory.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, level: true, parentId: true },
  });

  // 组装成树
  const map = new Map();
  const roots = [];
  cats.forEach((c) => map.set(c.id, { ...c, children: [] }));
  cats.forEach((c) => {
    const node = map.get(c.id);
    if (c.parentId && map.has(c.parentId)) map.get(c.parentId).children.push(node);
    else roots.push(node);
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const group of DATA) {
    const l1Node = findByName(roots, group.l1);
    if (!l1Node) {
      console.warn(`[跳过] 一级类目「${group.l1}」未找到`);
      continue;
    }
    const l2Node = findByName(l1Node.children, group.l2);
    if (!l2Node) {
      console.warn(`[跳过] 二级类目「${group.l1} / ${group.l2}」未找到`);
      continue;
    }

    for (const item of group.items) {
      const l3Node = findByName(l2Node.children, item.l3);
      if (!l3Node) {
        console.warn(`[跳过] 三级类目「${group.l1} / ${group.l2} / ${item.l3}」未找到`);
        skipped++;
        continue;
      }

      const existing = await prisma.serviceItem.findFirst({
        where: {
          categoryId: l3Node.id,
          name: item.name,
          deletedAt: null,
        },
      });

      const data = {
        categoryId: l3Node.id,
        name: item.name,
        price: item.price,
        unit: item.unit,
        estimatedDuration: item.estimatedDuration,
        coverImage: item.cover,
        description: item.desc,
        sort: item.sort,
        isActive: true,
      };

      if (existing) {
        // 已存在：更新可变化字段，保留管理员可能手动改的（只动描述/价格/时长/封面/排序/状态）
        await prisma.serviceItem.update({
          where: { id: existing.id },
          data: {
            price: item.price,
            unit: item.unit,
            estimatedDuration: item.estimatedDuration,
            coverImage: item.cover,
            description: item.desc,
            sort: item.sort,
            // isActive 不强制覆盖：管理员可能手动停用
          },
        });
        updated++;
      } else {
        await prisma.serviceItem.create({ data });
        created++;
      }
    }
  }

  const total = await prisma.serviceItem.count({ where: { deletedAt: null } });
  console.log(`服务项目种子完成：新增 ${created} 条，更新 ${updated} 条，跳过 ${skipped} 条（类目未找到），当前有效项目共 ${total} 条`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
