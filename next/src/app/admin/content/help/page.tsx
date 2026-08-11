'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/admin/admin-icons';
import RichTextEditor from '@/components/admin/RichTextEditor';
import { useToast } from '@/components/Toast';
import { getApiErrorMsg } from '@/lib/api';
import { QK } from '@/lib/query-keys';
import {
  getAbout,
  aboutToHtml,
  type AboutRole,
} from '@/lib/about-content';
import {
  getAdminSiteContent,
  upsertSiteContent,
} from '@/lib/admin-api';

interface QA {
  q: string;
  a: string;
}

// 静态占位 FAQ——业务为「老马家电」（家电维修·清洗服务）。
// 后续可接后端 FAQ 模型，先以本地数据占位，便于运营/设计评审结构。
const FAQ: QA[] = [
  {
    q: '如何预约家电维修 / 清洗服务？',
    a: '在「用户端」首页选择对应服务（如空调清洗、洗衣机维修、冰箱加氟等），填写设备型号、故障描述与上门地址，选择期望上门时间后提交即可。提交后系统会就近派单，并短信通知您接单的师傅信息。',
  },
  {
    q: '你们的服务覆盖哪些家电品类？',
    a: '目前支持空调、洗衣机、冰箱、热水器、油烟机、燃气灶、电视等常见家用大电的维修、清洗与安装移机。部分小家电（如电饭煲、吹风机）暂不支持上门，具体以下单页可选服务为准。',
  },
  {
    q: '上门费和检测费怎么收取？',
    a: '常规上门检测费在师傅检测后统一结算；若现场达成维修，检测费通常抵扣到维修费中。具体金额以下单时展示的报价及师傅到店后的确认单为准，维修前会与您确认费用，未经确认不会产生扣款。',
  },
  {
    q: '维修后有质保吗？保修期多久？',
    a: '有。维修部位享 90 天质保，清洗/保养类服务享 30 天质保。质保期内同一故障免费返修。请在「我的 - 订单」中保留好对应订单，返修时向师傅出示订单号即可。',
  },
  {
    q: '师傅多久能上门？可以指定时间段吗？',
    a: '市区一般 2 小时内响应、当日上门；偏远区域次日安排。下单时可选择「上午 / 下午 / 晚间」等偏好时间段，师傅接单后会与您电话确认具体到达时间。',
  },
  {
    q: '在哪里查看我的订单和师傅联系方式？',
    a: '进入「用户端 - 我的 - 我的订单」即可查看全部订单状态、师傅姓名与联系电话、预计上门时间。订单详情页也支持一键拨号与在线沟通。',
  },
  {
    q: '支持哪些支付方式？可以开发票吗？',
    a: '支持微信、支付宝及余额支付，维修完成确认后结算。如需发票，可在订单完成后于订单详情点击「申请开票」，填写抬头与邮箱，电子发票将发送至您指定邮箱。',
  },
  {
    q: '临时不想修了，取消订单要收费吗？',
    a: '师傅未上门前取消：免费。师傅已上门检测但您决定不修：一般仅收取已告知的上门/检测费（如有），不收维修费。维修进行中取消：按实际已完成工作量协商结算。',
  },
  {
    q: '如果家电无法修复怎么办？',
    a: '若检测确认设备无维修价值或缺少配件，师傅会如实说明，您可选择不修（仅付检测费，如有），平台不强制消费。涉及以旧换新或报废建议，师傅会提供参考方案，由您自主决定。',
  },
  {
    q: '遇到服务问题如何联系客服 / 投诉？',
    a: '可在「用户端 - 我的 - 联系客服」发起会话，或拨打页面底部客服热线。对师傅服务不满意，可在订单完成后评价并选择「投诉」，平台会在 1 个工作日内跟进处理。',
  },
];

function FaqItem({
  qa,
  open,
  onToggle,
}: {
  qa: QA;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="faq-item"
      style={{
        border: '1px solid #eef0f2',
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="faq-question"
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 16px',
          background: open ? '#f3f8fa' : '#fff',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--color-text)',
          transition: 'background 0.2s ease',
        }}
      >
        <span>{qa.q}</span>
        <span
          className={`faq-caret${open ? ' open' : ''}`}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-muted)',
            transition: 'transform 0.25s ease, color 0.2s ease',
          }}
        >
          <Icon name="chevron-right" size={18} />
        </span>
      </button>
      <div className={`faq-answer${open ? ' open' : ''}`}>
        <div className="faq-answer-inner">
          <div
            style={{
              padding: '14px 16px 16px',
              fontSize: 14,
              lineHeight: 1.8,
              color: 'var(--color-muted)',
            }}
          >
            {qa.a}
          </div>
        </div>
      </div>
    </div>
  );
}

const ABOUT_ROLE_LABEL: Record<AboutRole, string> = {
  customer: '用户端',
  master: '师傅端',
  admin: '运营端',
};

const ABOUT_KEYS: Record<AboutRole, string> = {
  customer: 'about_customer',
  master: 'about_master',
  admin: 'about_admin',
};

// 从富文本 HTML 提取纯文本摘要：剥离标签、折叠空白、截断（用于列表预览）。
// 浏览器端用 DOMParser 更准确；非浏览器环境降级为简单去标签。
function htmlToSummary(html: string, max = 90): string {
  let text = '';
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    text = (div.textContent || '').replace(/\s+/g, ' ').trim();
  } else {
    text = (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

const ABOUT_ROLES: AboutRole[] = ['customer', 'master', 'admin'];

// 单个「关于我们」条目：列表 + 摘要展示；点击整行或「编辑」在弹窗中修改。
function AboutItem({ role }: { role: AboutRole }) {
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QK.adminSiteContent(ABOUT_KEYS[role]),
    queryFn: () => getAdminSiteContent(ABOUT_KEYS[role]),
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    const def = getAbout(role);
    setTitle(data?.title || def.title);
    setHtml(data?.contentHtml || aboutToHtml(def));
    setOpen(true);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await upsertSiteContent(ABOUT_KEYS[role], { title, contentHtml: html });
      qc.invalidateQueries({ queryKey: QK.adminSiteContent(ABOUT_KEYS[role]) });
      toast.success('已保存，端上「关于我们」将同步更新');
      setOpen(false);
    } catch (e) {
      toast.error(getApiErrorMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const titleText = data?.title || getAbout(role).title;
  const summary = htmlToSummary(data?.contentHtml || '');

  return (
    <>
      <div
        className="about-list-item"
        role="button"
        tabIndex={0}
        onClick={openEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openEdit();
          }
        }}
      >
        <div className="about-list-main">
          <div className="about-list-title">
            <span className="about-list-badge">{ABOUT_ROLE_LABEL[role]}</span>
            <span className="about-list-name">{titleText}</span>
          </div>
          <div className="about-list-summary">
            {isLoading ? '加载中…' : summary ? summary : '（暂无内容，点击添加）'}
          </div>
        </div>
        <button
          type="button"
          className="btn-link about-list-edit"
          onClick={(e) => {
            e.stopPropagation();
            openEdit();
          }}
        >
          编辑
        </button>
      </div>

      {open && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-panel modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>编辑「{ABOUT_ROLE_LABEL[role]}」关于我们</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => setOpen(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label className="field-label">页面标题</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="页面标题，如「关于老马家电」"
                />
              </div>
              <div className="field">
                <label className="field-label">正文内容（支持富文本、内联图片、文件链接）</label>
                <RichTextEditor
                  key={role}
                  value={html}
                  onChange={setHtml}
                  placeholder="编辑该端「关于我们」的内容，可加标题、列表、图片、表格等…"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 三端「关于我们」维护入口：列表式，点击任意条目弹窗编辑，页面更简洁。
function AboutList() {
  return (
    <div className="about-list">
      {ABOUT_ROLES.map((r) => (
        <AboutItem key={r} role={r} />
      ))}
    </div>
  );
}

export default function HelpPage() {
  const [openSet, setOpenSet] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div>
      <div className="page-head">
        <h2>帮助中心</h2>
      </div>

      <div className="card" style={{ padding: '24px 18px 18px' }}>
        <p className="field-hint" style={{ marginTop: 0, marginBottom: 20 }}>
          以下为运营侧常见问题（静态占位，供结构与文案评审）。后续可接入后台 FAQ 模型，支持分类、排序与富文本答案的维护与前端展示。
        </p>

        {FAQ.map((qa, i) => (
          <FaqItem key={i} qa={qa} open={openSet.has(i)} onToggle={() => toggle(i)} />
        ))}
      </div>

      {/* 关于我们：运营端可维护，按端存入后端，端上展示页动态拉取 */}
      <div className="card" style={{ padding: '24px 18px 18px', marginTop: 18 }}>
        <p className="field-hint" style={{ marginTop: 0, marginBottom: 16 }}>
          各端「关于我们」展示文案。点击下方任一端条目，在弹窗中编辑并保存后，端上「我的 - 协议与隐私 - 关于我们」将动态读取最新内容；保存前若无数据则展示内置默认文案。
        </p>
        <AboutList />
      </div>
    </div>
  );
}
