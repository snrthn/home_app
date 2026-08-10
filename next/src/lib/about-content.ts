// 关于我们 · 三端展示文案（静态占位，作为端上展示页与管理端预览的单一数据源）。
// 后续可接入后台内容模型（如 SiteContent），由运营在「帮助中心」维护并下发到三端，
// 届时仅替换 getAbout 的数据来源，展示页无需改动。

export type AboutRole = 'customer' | 'master' | 'admin';

export interface AboutSection {
  h: string;
  p: string;
}

export interface AboutContact {
  hotline?: string;
  email?: string;
  address?: string;
  hours?: string;
}

export interface AboutContent {
  title: string;
  intro: string[]; // 段落数组
  sections: AboutSection[];
  contact?: AboutContact;
}

const CUSTOMER: AboutContent = {
  title: '关于老马家电',
  intro: [
    '老马家电是一家专注「家电维修 · 清洗 · 保养」的本地生活服务平台，致力于让每一次上门服务都省心、透明、有保障。',
    '我们聚合了经过实名认证与技能培训的维修师傅，覆盖空调、洗衣机、冰箱、热水器、油烟机、燃气灶、电视等常见家用大电，提供从上门检测到维修、清洗、安装移机的一站式服务。',
  ],
  sections: [
    {
      h: '我们的服务',
      p: '空调清洗 / 加氟、洗衣机维修、冰箱加氟与不制冷维修、热水器维修、油烟机清洗、燃气灶维修、电视检修，以及家电安装与移机。所有服务均明码标价，维修前与您确认费用。',
    },
    {
      h: '服务标准',
      p: '师傅统一着装、自带鞋套与垫布；检测后出具报价单，未经确认不产生扣款；维修部位享 90 天质保，清洗保养类享 30 天质保。',
    },
    {
      h: '价格与保障',
      p: '价格透明，下单即见预估报价；不满意可申请重新派单或退款；平台对每一笔服务进行评价与回访，保障您的权益。',
    },
    {
      h: '联系我们',
      p: '服务过程中遇到任何问题，可在「我的 - 联系客服」发起会话，或拨打客服热线，每日 9:00–21:00 均有专人响应。',
    },
  ],
  contact: {
    hotline: '400-000-0000',
    email: 'support@laoma.example',
    address: '（示例）某某市某某区某某路 1 号',
    hours: '每日 9:00 – 21:00',
  },
};

const MASTER: AboutContent = {
  title: '关于老马家电（师傅端）',
  intro: [
    '老马家电师傅端是面向认证维修师傅的接单与服务平台，帮助师傅高效接单、规范服务、稳定增收。',
    '平台通过智能派单与抢单池，将就近订单推送给合适的师傅，并提供完整的订单管理、收入结算与评价体系。',
  ],
  sections: [
    {
      h: '加入我们',
      p: '提交实名与技能认证后，可在「认证审核」中查看进度；审核通过后可接单。师傅资料越完整，派单匹配度越高。',
    },
    {
      h: '接单与上门',
      p: '在「抢单池」或「智能派单」中接收订单，接单后请与用户电话确认上门时间，携带常用配件并遵守服务规范。',
    },
    {
      h: '收入与提现',
      p: '服务完成并确认后结算至账户余额，可在「收入提现」中申请提现；平台按周 / 月结算，明细可查。',
    },
    {
      h: '服务规范',
      p: '统一着装、自带鞋套垫布；先检测后报价，维修前与用户确认费用；维修部位享 90 天质保，保障复修体验。',
    },
  ],
  contact: {
    hotline: '400-000-0001',
    email: 'master@laoma.example',
    hours: '师傅支持 9:00 – 22:00',
  },
};

const ADMIN: AboutContent = {
  title: '关于老马家电（运营端）',
  intro: [
    '老马家电运营端是平台运营与管理的后台，负责服务类目、师傅审核、订单调度、评价客服与内容发布等核心运营动作。',
  ],
  sections: [
    {
      h: '平台定位',
      p: '以「透明、有保障的家电上门服务」为核心，连接用户与认证师傅，提升本地生活服务的效率与体验。',
    },
    {
      h: '运营职责',
      p: '维护服务类目与区域、审核师傅认证、监控派单与订单、处理评价与投诉工单、发布平台公告与协议政策。',
    },
    {
      h: '内容管理',
      p: '在「内容管理」中维护协议条款、平台公告与帮助中心（含关于我们、常见问题），保障三端展示内容的一致与合规。',
    },
  ],
};

const MAP: Record<AboutRole, AboutContent> = {
  customer: CUSTOMER,
  master: MASTER,
  admin: ADMIN,
};

export function getAbout(role: AboutRole): AboutContent {
  return MAP[role] ?? CUSTOMER;
}

// 将结构化 AboutContent 序列化为富文本 HTML，用作管理端首次编辑的默认内容。
// 静态占位数据本身是可信文案，这里做基础 HTML 转义以防注入。
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function aboutToHtml(a: AboutContent): string {
  const intro = a.intro.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
  const sections = a.sections
    .map((s) => `<h2>${escapeHtml(s.h)}</h2><p>${escapeHtml(s.p)}</p>`)
    .join('');
  let contact = '';
  if (a.contact) {
    const rows: string[] = [];
    const c = a.contact;
    if (c.hotline) rows.push(`<li>客服热线：${escapeHtml(c.hotline)}</li>`);
    if (c.email) rows.push(`<li>邮箱：${escapeHtml(c.email)}</li>`);
    if (c.address) rows.push(`<li>地址：${escapeHtml(c.address)}</li>`);
    if (c.hours) rows.push(`<li>服务时间：${escapeHtml(c.hours)}</li>`);
    if (rows.length) contact = `<h2>联系我们</h2><ul>${rows.join('')}</ul>`;
  }
  return intro + sections + contact;
}
