/**
 * 内容种子（prisma/seed-content.js）。
 *
 * 作用：为平台预置运营侧内容，包括：
 *   1. 三端「关于我们」富文本（SiteContent）
 *   2. 三端注册协议 + 隐私政策（AgreementTemplate + AgreementVersion，已发布）
 *   3. 三端「平台一期上线」庆祝公告（Notice，已发布、全范围）
 *
 * 运行：node prisma/seed-content.js  或  pnpm seed:content
 *
 * 幂等策略：
 *   - 关于我们：按 key upsert，只在内容为空时写入，保留运营后台手动修改
 *   - 协议模板：按 code upsert；版本只在无任何已发布版本时创建 v1 并发布
 *   - 公告：按 scope + title 去重；已存在同标题公告则跳过（不覆盖运营修改）
 *
 * 前置：需先跑 seed-categories.js（无直接依赖，但业务上下文一致）。
 */
const { PrismaClient } = require('../node_modules/.prisma/client');

// 导出供 InstallService 调用；独立运行时自动创建 prisma 实例
async function seedContent(prisma) {

/* ========================================================================== */
/*                           1. 关于我们（三端）                               */
/* ========================================================================== */

function buildAboutHtml({ intro, sections, contact }) {
  const introHtml = intro.map((p) => `<p>${p}</p>`).join('');
  const sectionsHtml = sections
    .map(
      (s) => `<h3>${s.h}</h3><p>${s.p}</p>`,
    )
    .join('');
  let contactHtml = '';
  if (contact) {
    const rows = [];
    if (contact.hotline) rows.push(`<li>客服热线：${contact.hotline}</li>`);
    if (contact.email) rows.push(`<li>邮箱：${contact.email}</li>`);
    if (contact.address) rows.push(`<li>地址：${contact.address}</li>`);
    if (contact.hours) rows.push(`<li>服务时间：${contact.hours}</li>`);
    if (rows.length) contactHtml = `<h3>联系我们</h3><ul>${rows.join('')}</ul>`;
  }
  return introHtml + sectionsHtml + contactHtml;
}

const ABOUT_DATA = {
  about_customer: {
    title: '关于老马家电',
    content: buildAboutHtml({
      intro: [
        '老马家电是一家专注「家电维修 · 清洗 · 保养 · 安装」的本地生活服务平台，致力于让每一次上门服务都省心、透明、有保障。',
        '我们聚合了经过实名认证与技能考核的专业师傅，覆盖空调、洗衣机、冰箱、热水器、油烟机、燃气灶、电视等常见家用大电，提供从上门检测到维修、清洗、安装移机的一站式服务。',
        '平台明码标价、先报价后维修、质保兜底，让您不用再为家电故障发愁。',
      ],
      sections: [
        {
          h: '我们的服务',
          p: '空调清洗 / 加氟、洗衣机维修、冰箱加氟与不制冷维修、热水器维修、油烟机深度清洗、燃气灶维修、电视检修，以及各类家电安装与移机。所有服务均明码标价，维修前与您确认费用，不修不收取维修费。',
        },
        {
          h: '服务标准',
          p: '师傅统一着装、自带鞋套与垫布，保护您的家居环境；上门检测后出具报价单，未经您确认不产生扣款；维修部位享 90 天质保，清洗保养类享 30 天质保，质保期内同一故障免费返修。',
        },
        {
          h: '价格与保障',
          p: '价格透明，下单即见预估报价；不满意可申请重新派单或退款；平台对每一笔服务进行评价与回访，保障您的合法权益；检测费可抵扣同次维修费，让每一分钱都花得明白。',
        },
        {
          h: '服务承诺',
          p: '超时赔付：师傅迟到超过 30 分钟可申请优惠券补偿；乱收费双倍返还：如发现师傅未按平台报价收费，平台承诺双倍返还差额；全程保险：服务过程中因师傅操作导致的财产损失，由平台承保赔付。',
        },
      ],
      contact: {
        hotline: '400-888-0000',
        email: 'support@laoma.home',
        hours: '每日 8:00 – 22:00',
      },
    }),
  },

  about_master: {
    title: '关于老马家电（师傅端）',
    content: buildAboutHtml({
      intro: [
        '老马家电师傅端是面向认证维修师傅的接单与服务平台，帮助师傅高效接单、规范服务、稳定增收。',
        '平台通过智能派单与抢单池，将就近订单推送给合适的师傅，并提供完整的订单管理、收入结算、评价反馈与技能培训体系。',
        '加入老马，让你的手艺被更多人看见。',
      ],
      sections: [
        {
          h: '加入我们',
          p: '提交实名与技能认证后，可在「认证审核」中查看进度；审核通过后即可接单。师傅资料越完整（技能、服务区域、自我介绍、工作照），派单匹配度与用户信任度越高。',
        },
        {
          h: '接单与上门',
          p: '在「抢单池」中挑选心仪订单，或接受「智能派单」系统自动推送的就近订单；接单后请及时与用户电话确认上门时间，携带常用配件并遵守平台服务规范，统一着装、穿鞋套、铺垫布。',
        },
        {
          h: '收入与提现',
          p: '服务完成并经用户确认后，对应收入结算至账户余额；可在「收入提现」中申请提现，提现申请 T+1 到账；平台按月出具收入明细，每笔订单的收入构成清晰可查。',
        },
        {
          h: '服务规范',
          p: '先检测后报价，维修前必须与用户确认费用并征得同意；维修部位享 90 天质保，保障用户权益也是保障你的口碑；严禁私下交易、加价收费，一经发现将永久封禁账号。',
        },
        {
          h: '成长与激励',
          p: '平台设有星级评定体系，高星级师傅享有优先派单、更高分成比例、专属客服等权益；定期开展技能培训与认证，提升专业能力的同时解锁更多服务品类。',
        },
      ],
      contact: {
        hotline: '400-888-0001',
        email: 'master@laoma.home',
        hours: '师傅支持专线 9:00 – 22:00',
      },
    }),
  },

  about_admin: {
    title: '关于老马家电（运营端）',
    content: buildAboutHtml({
      intro: [
        '老马家电运营端是平台运营与管理的后台系统，负责服务类目维护、师傅认证审核、订单调度、评价客服、内容发布、财务结算等核心运营动作。',
        '本系统面向平台运营、客服、财务、技术等角色，通过权限体系实现不同岗位的功能隔离与数据安全。',
      ],
      sections: [
        {
          h: '平台定位',
          p: '以「透明、有保障的家电上门服务」为核心使命，连接用户与认证师傅，提升本地生活服务的效率与体验，打造值得信赖的家电服务品牌。',
        },
        {
          h: '运营职责',
          p: '维护服务类目与开通区域、审核师傅认证资质、监控派单与订单流转、处理用户评价与投诉工单、发布平台公告与协议政策、管理营销活动与优惠券等。',
        },
        {
          h: '内容管理',
          p: '在「内容管理」模块中维护协议条款、平台公告与帮助中心（含关于我们、常见问题），保障三端展示内容的一致性与合规性，所有修改均支持富文本编辑并即时生效。',
        },
        {
          h: '数据与决策',
          p: '通过「数据报表」模块查看平台核心指标（订单量、GMV、师傅活跃度、用户留存等），为运营决策提供数据支撑；系统日志记录关键操作，便于审计与问题追溯。',
        },
      ],
    }),
  },
};

async function seedAbout() {
  let created = 0;
  let skipped = 0;
  for (const [key, data] of Object.entries(ABOUT_DATA)) {
    const existing = await prisma.siteContent.findUnique({ where: { key } });
    if (existing && existing.contentHtml && existing.contentHtml.trim().length > 50) {
      // 已有较丰富的内容，保留运营手动修改
      skipped++;
      continue;
    }
    await prisma.siteContent.upsert({
      where: { key },
      update: { title: data.title, contentHtml: data.content },
      create: { key, title: data.title, contentHtml: data.content },
    });
    created++;
  }
  console.log(`关于我们：新增/更新 ${created} 条，跳过（已有内容） ${skipped} 条`);
}

/* ========================================================================== */
/*                         2. 注册协议 + 隐私政策（三端）                       */
/* ========================================================================== */

// 生成协议正文：通用框架 + 端特定内容
function buildRegistrationAgreement(scope) {
  const roleName = scope === 'customer' ? '用户' : scope === 'master' ? '师傅' : '运营人员';
  const platformDuties =
    scope === 'customer'
      ? '（1）按照协议约定提供家电维修、清洗、安装等上门服务；（2）保障服务质量，对维修部位提供 90 天质保、清洗类 30 天质保；（3）保护用户个人信息与财产安全；（4）受理用户投诉与建议并及时回复。'
      : scope === 'master'
        ? '（1）按照协议约定提供订单推送与结算服务；（2）保障师傅合法收入与提现安全；（3）提供技能培训与成长通道；（4）维护平台秩序，保障师傅公平竞争环境。'
        : '（1）提供平台运营管理工具与数据支持；（2）保障系统稳定运行与数据安全；（3）提供权限管理与操作审计能力。';

  const userDuties =
    scope === 'customer'
      ? '（1）提供真实的个人信息与服务地址；（2）按时支付服务费用；（3）配合师傅上门服务，提供必要的作业环境；（4）不得要求师傅从事违规或危险作业。'
      : scope === 'master'
        ? '（1）提供真实的身份信息、技能证书与服务资质；（2）遵守平台服务规范与定价标准，不得私下交易或乱收费；（3）保证服务质量，自觉接受用户评价与平台考核；（4）保护用户个人信息与财产安全。'
        : '（1）在授权范围内操作，不得越权访问或修改数据；（2）保护平台数据安全与商业秘密；（3）遵守公司规章制度与操作规范。';

  return `
<h2>老马家电${roleName}注册协议</h2>
<p>欢迎您注册并使用老马家电平台！</p>
<p>本协议是您与老马家电平台（以下简称"本平台"）之间就注册、使用本平台服务所订立的协议。请您在注册前仔细阅读本协议的全部内容，<strong>特别是涉及您重大权益的条款，可能以加粗形式提示您注意</strong>。</p>
<p>您点击"同意"按钮即表示您已阅读并同意本协议的全部内容，本协议即构成对双方具有法律约束力的文件。</p>

<h3>一、服务内容</h3>
<p>1.1 本平台为${scope === 'customer' ? '用户提供家电维修、清洗、保养、安装等上门服务的在线预约与交易撮合服务' : scope === 'master' ? '认证师傅提供订单接收、服务管理、收入结算等工具与支持' : '运营人员提供平台管理、内容发布、数据统计等后台功能'}。</p>
<p>1.2 本平台有权根据业务发展需要调整服务内容，并提前在平台上公告。</p>

<h3>二、账号注册与使用</h3>
<p>2.1 您应提供真实、准确、完整的注册信息，并在信息发生变化时及时更新。</p>
<p>2.2 您应妥善保管账号和密码，对您账号下发生的所有活动承担责任。</p>
<p>2.3 如发现账号被盗用或存在安全隐患，请立即通知本平台。</p>
<p>2.4 您不得将账号出借、出租、转让或售卖给他人使用。</p>

<h3>三、双方权利与义务</h3>
<p><strong>3.1 本平台权利义务：</strong></p>
<p>${platformDuties}</p>
<p><strong>3.2 ${roleName}权利义务：</strong></p>
<p>${userDuties}</p>

<h3>四、费用与结算</h3>
<p>4.1 ${
  scope === 'customer'
    ? '您应按照平台公示的价格标准支付服务费用，下单时展示的价格为预估价格，最终费用以师傅现场检测并经您确认后的报价为准。'
    : scope === 'master'
      ? '您的服务收入按平台约定的分成比例结算，平台有权根据市场情况调整分成比例并提前公告。提现需满足最低提现金额要求，到账时间以实际处理为准。'
      : '运营端为内部管理系统，不涉及费用结算。'
}</p>
<p>4.2 ${
  scope === 'customer'
    ? '支持微信支付、支付宝、余额等多种支付方式。'
    : scope === 'master'
      ? '您应依法承担个人所得税等相关税费，平台将根据法律法规要求进行代扣代缴。'
      : ''
}</p>

<h3>五、服务规范与质保</h3>
<p>5.1 ${
  scope === 'customer'
    ? '您有权对服务质量进行评价，如对服务不满意，可申请售后或投诉。维修部位质保 90 天，清洗/保养类质保 30 天，质保期内同一故障免费返修。'
    : scope === 'master'
      ? '您应严格遵守平台服务规范：先检测后报价、统一着装、穿鞋套铺垫布、维修后清理现场。维修部位质保 90 天，清洗/保养类质保 30 天，质保期内用户提出的同一故障问题，您应免费上门返修。'
      : '运营人员应按照平台规范处理用户与师傅的诉求，保障服务质量与平台口碑。'
}</p>

<h3>六、个人信息保护</h3>
<p>6.1 本平台重视您的个人信息保护，将按照《隐私政策》的约定收集、使用、存储和保护您的个人信息。</p>
<p>6.2 您在使用本平台服务的过程中，也应尊重和保护他人的个人信息。</p>

<h3>七、违约处理</h3>
<p>7.1 如您违反本协议约定，本平台有权视情节轻重采取警告、限制功能、暂停服务、永久封禁账号等措施。</p>
<p>7.2 因您的违约行为给本平台或第三方造成损失的，您应承担相应的赔偿责任。</p>

<h3>八、协议的变更</h3>
<p>8.1 本平台有权根据需要修改本协议内容，修改后的协议将在平台上公布。</p>
<p>8.2 如您继续使用本平台服务，即视为您接受修改后的协议。</p>

<h3>九、争议解决</h3>
<p>9.1 本协议的订立、执行和解释及争议的解决均适用中华人民共和国法律。</p>
<p>9.2 因本协议引起的争议，双方应友好协商解决；协商不成的，任何一方均可向本平台所在地有管辖权的人民法院提起诉讼。</p>

<h3>十、联系我们</h3>
<p>如您对本协议有任何疑问或建议，请通过以下方式联系我们：</p>
<ul>
  <li>客服热线：400-888-0000</li>
  <li>电子邮箱：${
    scope === 'customer' ? 'support@laoma.home' : scope === 'master' ? 'master@laoma.home' : 'admin@laoma.home'
  }</li>
  <li>服务时间：每日 8:00 – 22:00</li>
</ul>
<p style="color:#6b7280;font-size:12px;margin-top:20px;">最后更新日期：2026年8月24日 | 版本号：v1.0</p>
  `.trim();
}

function buildPrivacyPolicy(scope) {
  const roleName = scope === 'customer' ? '用户' : scope === 'master' ? '师傅' : '运营人员';
  const infoTypes =
    scope === 'customer'
      ? `
    <li>基本信息：姓名、手机号、性别、所在城市</li>
    <li>地址信息：服务地址（省/市/区/详细地址）</li>
    <li>设备信息：家电型号、故障描述（用于服务匹配）</li>
    <li>支付信息：支付记录、发票信息</li>
    <li>位置信息：粗略位置（用于就近派单，可关闭）</li>`
      : scope === 'master'
        ? `
    <li>身份信息：真实姓名、身份证号、实名认证信息</li>
    <li>联系方式：手机号、紧急联系人</li>
    <li>技能信息：服务品类、技能证书、工作经历</li>
    <li>服务信息：服务区域、接单设置、评价记录</li>
    <li>财务信息：银行账户/收款账户、收入明细、提现记录</li>
    <li>位置信息：服务期间的位置信息（用于派单与安全保障）</li>`
        : `
    <li>身份信息：姓名、工号、所属部门</li>
    <li>账号信息：登录账号、角色权限</li>
    <li>操作日志：系统操作记录（用于审计与安全追溯）</li>`;

  return `
<h2>老马家电${roleName}隐私政策</h2>
<p>老马家电（以下简称"我们"）深知个人信息对您的重要性，并会尽全力保护您的个人信息安全可靠。我们致力于维持您对我们的信任，恪守以下原则保护您的个人信息：权责一致原则、目的明确原则、选择同意原则、最少够用原则、确保安全原则、主体参与原则、公开透明原则等。</p>
<p>请您在使用本平台服务前，仔细阅读并充分理解本隐私政策，特别是以<strong>加粗形式</strong>提示的条款。一旦您开始使用本平台服务，即表示您同意我们按照本隐私政策收集、使用、存储和保护您的个人信息。</p>

<h3>一、我们如何收集和使用您的个人信息</h3>
<p>1.1 为向您提供优质的家电服务，我们会收集以下类型的个人信息：</p>
<ul>${infoTypes}</ul>
<p>1.2 我们收集您的个人信息主要用于以下目的：</p>
<ul>
  <li>账号注册与身份验证</li>
  <li>${scope === 'customer' ? '提供家电上门服务、订单撮合与派单' : scope === 'master' ? '订单推送、服务匹配、收入结算' : '后台管理、权限控制与操作审计'}</li>
  <li>保障账号安全与服务质量</li>
  <li>客服支持与争议处理</li>
  <li>遵守法律法规要求</li>
</ul>
<p>1.3 我们不会收集与提供服务无关的个人信息，也不会因您不同意收集非必要信息而拒绝提供核心服务。</p>

<h3>二、我们如何使用 Cookie 和同类技术</h3>
<p>2.1 为确保平台正常运转、提升您的使用体验，我们会在您的设备上存储 Cookie 等小型数据文件。</p>
<p>2.2 您可以通过浏览器设置管理或删除 Cookie，但这可能影响您使用部分功能。</p>

<h3>三、我们如何共享、转让、公开披露您的个人信息</h3>
<p>3.1 <strong>共享：</strong>我们不会向第三方共享您的个人信息，除非：</p>
<ul>
  <li>事先获得您的明确同意；</li>
  <li>${
    scope === 'customer'
      ? '为完成服务，将必要信息（姓名、电话、地址、设备信息）提供给接单的服务师傅；'
      : scope === 'master'
        ? '为完成服务撮合，将您的姓名、技能、评分等信息展示给有需求的用户；'
        : '运营人员之间按权限共享必要的工作信息；'
  }</li>
  <li>根据法律法规、司法机关或行政机关的强制性要求。</li>
</ul>
<p>3.2 <strong>转让：</strong>我们不会将您的个人信息转让给任何公司、组织和个人，除非发生合并、收购、资产转让等情形，且我们会要求新的持有方继续受本政策约束。</p>
<p>3.3 <strong>公开披露：</strong>我们不会公开披露您的个人信息，除非获得您的明确同意或法律法规要求。</p>

<h3>四、我们如何保护您的个人信息</h3>
<p>4.1 我们采用符合业界标准的安全防护措施保护您的个人信息，包括数据加密、访问控制、安全审计等技术手段。</p>
<p>4.2 我们建立了完善的数据安全与隐私保护制度，对个人信息进行严格的权限管理。</p>
<p>4.3 尽管采取了上述合理措施，但请您理解，由于技术的限制以及可能存在的各种恶意手段，互联网环境并非百分之百安全。</p>

<h3>五、您的权利</h3>
<p>5.1 您对自己的个人信息享有以下权利：</p>
<ul>
  <li>访问权：您可以查询、复制您的个人信息</li>
  <li>更正权：您可以更正或补充不准确的个人信息</li>
  <li>删除权：您可以要求删除您的个人信息（法律法规另有规定的除外）</li>
  <li>撤回同意权：您可以撤回对个人信息收集使用的同意</li>
  <li>注销账号：您可以申请注销您的平台账号</li>
</ul>
<p>5.2 您可以通过以下方式行使上述权利：</p>
<ul>
  <li>在 APP「我的 - 设置 - 账号与安全」中自助操作</li>
  <li>联系客服：400-888-0000</li>
</ul>

<h3>六、未成年人保护</h3>
<p>6.1 我们非常重视未成年人的个人信息保护。本平台主要面向成年人提供服务。</p>
<p>6.2 如您是未成年人，请在监护人的指导下阅读本政策并使用本平台服务。</p>

<h3>七、隐私政策的更新</h3>
<p>7.1 我们可能会适时修订本隐私政策，修订后的政策将在平台上公布。</p>
<p>7.2 对于重大变更，我们还会通过站内通知、推送等方式告知您。</p>

<h3>八、联系我们</h3>
<p>如您对本隐私政策有任何疑问、意见或建议，或希望行使您的个人信息权利，请通过以下方式联系我们：</p>
<ul>
  <li>个人信息保护负责人邮箱：privacy@laoma.home</li>
  <li>客服热线：400-888-0000</li>
  <li>通讯地址：（平台运营地址）</li>
</ul>
<p>我们将在收到您的反馈后 15 个工作日内回复。</p>

<p style="color:#6b7280;font-size:12px;margin-top:20px;">最后更新日期：2026年8月24日 | 版本号：v1.0</p>
  `.trim();
}

const AGREEMENT_CONFIGS = [
  { scope: 'customer', type: 'registration', code: 'customer-registration', title: '用户注册协议' },
  { scope: 'customer', type: 'privacy', code: 'customer-privacy', title: '用户隐私政策' },
  { scope: 'master', type: 'registration', code: 'master-registration', title: '师傅注册协议' },
  { scope: 'master', type: 'privacy', code: 'master-privacy', title: '师傅隐私政策' },
  { scope: 'admin', type: 'registration', code: 'admin-registration', title: '运营端使用协议' },
  { scope: 'admin', type: 'privacy', code: 'admin-privacy', title: '运营人员隐私政策' },
];

async function seedAgreements() {
  let templates = 0;
  let versions = 0;
  let skipped = 0;

  for (const cfg of AGREEMENT_CONFIGS) {
    // upsert 协议模板
    const template = await prisma.agreementTemplate.upsert({
      where: { code: cfg.code },
      update: { title: cfg.title },
      create: {
        scope: cfg.scope,
        type: cfg.type,
        code: cfg.code,
        title: cfg.title,
      },
    });
    templates++;

    // 检查是否已有已发布版本
    const published = await prisma.agreementVersion.findFirst({
      where: { templateId: template.id, status: 'published' },
    });
    if (published) {
      skipped++;
      continue;
    }

    // 生成内容
    const contentHtml =
      cfg.type === 'registration'
        ? buildRegistrationAgreement(cfg.scope)
        : buildPrivacyPolicy(cfg.scope);

    // 创建 v1 版本并发布
    await prisma.agreementVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        title: `${cfg.title} v1.0`,
        contentHtml,
        status: 'published',
        isCurrent: true,
      },
    });
    versions++;
  }

  console.log(`协议模板：${templates} 条；新建发布版本：${versions} 条；跳过（已有发布版）：${skipped} 条`);
}

/* ========================================================================== */
/*                      3. 平台一期上线公告（三端各一条）                       */
/* ========================================================================== */

function buildLaunchNoticeHtml(scope) {
  const roleName = scope === 'customer' ? '各位新老用户' : scope === 'master' ? '各位师傅伙伴' : '各位运营同事';
  const highlights =
    scope === 'customer'
      ? `
    <li><strong>服务品类丰富：</strong>覆盖空调、洗衣机、冰箱、热水器、油烟机、燃气灶等全品类家电，提供维修、清洗、安装、移机一站式服务</li>
    <li><strong>价格透明公道：</strong>明码标价、先报价后维修，检测费可抵扣维修费，不修不收费</li>
    <li><strong>师傅实名认证：</strong>所有师傅均经过实名认证与技能考核，服务有保障</li>
    <li><strong>质保放心无忧：</strong>维修 90 天质保、清洗 30 天质保，同一问题免费返修</li>
    <li><strong>首单优惠福利：</strong>新用户注册即享首单立减 20 元优惠券，限时领取</li>`
      : scope === 'master'
        ? `
    <li><strong>海量订单资源：</strong>平台持续投入运营推广，订单量稳步增长，收入有保障</li>
    <li><strong>智能派单系统：</strong>基于位置、技能、评分智能匹配，减少空驶，提升接单效率</li>
    <li><strong>灵活工作时间：</strong>自主设置接单时间与服务区域，工作生活两不误</li>
    <li><strong>收入透明结算：</strong>每笔订单收入清晰可查，T+1 极速提现，资金安全有保障</li>
    <li><strong>成长激励体系：</strong>星级师傅享有优先派单、更高分成、专属客服等权益</li>`
        : `
    <li><strong>用户端上线：</strong>客户可在线浏览服务、下单预约、评价反馈，全流程线上化</li>
    <li><strong>师傅端上线：</strong>师傅注册认证、接单抢单、服务管理、收入提现一站式完成</li>
    <li><strong>运营后台完善：</strong>用户管理、师傅审核、服务类目、订单调度、内容发布等核心功能就绪</li>
    <li><strong>数据看板可用：</strong>核心运营指标可视化展示，辅助决策</li>`;

  return `
<p>亲爱的${roleName}：</p>
<p>经过团队数月的精心打磨与测试，<strong>老马家电服务平台一期正式上线啦！</strong>🎉</p>
<p>在此，我们向所有关注、支持和参与平台建设的朋友们致以最诚挚的感谢！正是因为有你们的期待与信任，我们才有不断前行的动力。</p>

<h3>🎊 一期亮点功能</h3>
<ul>${highlights}</ul>

<h3>📅 上线时间</h3>
<p>2026 年 8 月 24 日起正式对外提供服务。</p>

<h3>💡 后续规划</h3>
<p>一期上线只是开始，我们的脚步不会停歇。后续版本将陆续推出：</p>
<ul>
  <li>更多家电品类与服务项目覆盖</li>
  <li>会员体系与积分商城</li>
  <li>师徒推荐与裂变激励</li>
  <li>更多城市与区域开通</li>
  <li>APP 独立客户端（当前为移动端网页版）</li>
</ul>

<h3>📞 意见反馈</h3>
<p>平台在成长过程中难免有不足之处，欢迎大家通过以下渠道提出宝贵意见：</p>
<ul>
  <li>${
    scope === 'customer'
      ? 'APP 内「我的 - 意见反馈」'
      : scope === 'master'
        ? '师傅端「我的 - 意见反馈」'
        : '运营端「系统设置 - 问题反馈」'
  }</li>
  <li>客服热线：400-888-0000</li>
</ul>

<p>让我们携手同行，共同打造更值得信赖的家电服务平台！</p>
<p style="text-align:right;color:#6b7280;margin-top:20px;">—— 老马家电运营团队</p>
<p style="text-align:right;color:#6b7280;">2026 年 8 月 24 日</p>
  `.trim();
}

const NOTICE_CONFIGS = [
  {
    scope: 'customer',
    title: '🎉 老马家电一期正式上线！首单立减 20 元',
    summary: '平台正式上线啦！全品类家电服务，维修90天质保、清洗30天质保，新用户首单立减20元，快来体验吧~',
  },
  {
    scope: 'master',
    title: '🎉 老马家电一期正式上线！海量订单等你来',
    summary: '平台正式上线运营！智能派单、灵活接单、透明结算、T+1提现，加入老马，让手艺更值钱！',
  },
  {
    scope: 'admin',
    title: '🎉 老马家电一期正式上线！运营后台全面启用',
    summary: '平台一期正式对外发布，运营后台各功能模块已全面就绪，请各位同事熟悉操作流程，保障上线初期服务质量。',
  },
];

async function seedNotices() {
  let created = 0;
  let skipped = 0;

  for (const cfg of NOTICE_CONFIGS) {
    // 按 scope + title 去重
    const existing = await prisma.notice.findFirst({
      where: { scope: cfg.scope, title: cfg.title },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const contentHtml = buildLaunchNoticeHtml(cfg.scope);

    await prisma.notice.create({
      data: {
        scope: cfg.scope,
        title: cfg.title,
        summary: cfg.summary,
        contentHtml,
        status: 'published',
        pinned: true, // 置顶
        publishedAt: new Date(),
        targetRegions: [], // 空数组 = 全范围
      },
    });
    created++;
  }

  console.log(`公告：新增发布 ${created} 条，跳过（已存在） ${skipped} 条`);
}

/* ========================================================================== */
/*                                  主入口                                     */
/* ========================================================================== */

  console.log('========== 内容种子开始 ==========');
  await seedAbout();
  await seedAgreements();
  await seedNotices();
  console.log('========== 内容种子完成 ==========');
}

module.exports = { seedContent };

if (require.main === module) {
  const prisma = new PrismaClient();
  seedContent(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
