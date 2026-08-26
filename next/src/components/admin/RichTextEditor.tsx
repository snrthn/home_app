'use client';

import { useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { FontSize } from './font-size-extension';
import { uploadAvatar, resolveAsset, getApiErrorMsg } from '@/lib/api';
import { validateUploadFile } from '@laoma/shared';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';

interface Props {
  value?: string;
  onChange?: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
}

function ToolbarBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={
        'rte-btn' + (active ? ' rte-btn-active' : '') + (disabled ? ' rte-btn-disabled' : '')
      }
    >
      {children}
    </button>
  );
}

const ALIGN_OPTIONS: { key: 'left' | 'center' | 'right' | 'justify'; label: string; title: string }[] = [
  { key: 'left', label: '⬅', title: '左对齐' },
  { key: 'center', label: '⬌', title: '居中对齐' },
  { key: 'right', label: '➡', title: '右对齐' },
  { key: 'justify', label: '≡', title: '两端对齐' },
];

// 规范化链接/图片地址：补全协议，保证点击可达
function normalizeUrl(u: string): string {
  if (/^https?:\/\//i.test(u) || u.startsWith('//') || u.startsWith('/') || u.startsWith('#')) return u;
  return 'https://' + u;
}

export default function RichTextEditor({
  value = '',
  onChange,
  editable = true,
  placeholder = '在此输入协议内容，可加粗、标题、列表、插入图片或文件…',
}: Props) {
  const toast = useToast();
  const imgInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    // 关闭立即渲染，避免 Next SSR/hydration 告警（TipTap 2.5+ 推荐）
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      FontSize,
      Image.configure({ inline: true, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  });

  const uploadAndInsertImage = async (file: File) => {
    const v = validateUploadFile({ sizeBytes: file.size, mime: file.type, ext: file.name.split('.').pop() });
    if (!v.ok) { toast.warning(v.error); return; }
    try {
      const url = await uploadAvatar(file);
      editor?.chain().focus().setImage({ src: resolveAsset(url) }).run();
    } catch (e) {
      toast.error(getApiErrorMsg(e));
    }
  };

  const uploadAndInsertFile = async (file: File) => {
    const v = validateUploadFile({ sizeBytes: file.size, mime: file.type, ext: file.name.split('.').pop() });
    if (!v.ok) { toast.warning(v.error); return; }
    try {
      const url = await uploadAvatar(file);
      const href = resolveAsset(url);
      // 转义文件名，避免引号/尖括号破坏 HTML 结构
      const safeName = file.name
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      editor
        ?.chain()
        .focus()
        .insertContent(`<a href="${href}">${safeName}</a>`)
        .run();
    } catch (e) {
      toast.error(getApiErrorMsg(e));
    }
  };

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');

  const openLinkModal = () => {
    if (!editor) return;
    const prev = (editor.getAttributes('link').href as string) || '';
    setLinkValue(prev || 'https://');
    setLinkOpen(true);
  };
  const applyLink = () => {
    if (!editor) return;
    const url = linkValue.trim();
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const { from, to } = editor.state.selection;
      if (from === to) {
        // 未选中任何文本时，把链接地址本身作为可点击文本插入
        editor
          .chain()
          .focus()
          .insertContent(`<a href="${normalizeUrl(url)}">${url}</a>`)
          .run();
      } else {
        editor
          .chain()
          .focus()
          .extendMarkRange('link')
          .setLink({ href: normalizeUrl(url) })
          .run();
      }
    }
    setLinkOpen(false);
  };

  // ---- 图片（线上链接）----
  const [imgUrlOpen, setImgUrlOpen] = useState(false);
  const [imgUrlValue, setImgUrlValue] = useState('');
  const openImgUrlModal = () => {
    setImgUrlValue('');
    setImgUrlOpen(true);
  };
  const applyImgUrl = () => {
    if (!editor) return;
    const u = imgUrlValue.trim();
    if (u) editor.chain().focus().setImage({ src: normalizeUrl(u) }).run();
    setImgUrlOpen(false);
  };

  return (
    <div className="rte">
      {editable && editor && (
        <div className="rte-toolbar">
          <ToolbarBtn title="加粗" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
            <strong>B</strong>
          </ToolbarBtn>
          <ToolbarBtn title="斜体" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <em>I</em>
          </ToolbarBtn>
          <ToolbarBtn title="下划线" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <span style={{ textDecoration: 'underline' }}>U</span>
          </ToolbarBtn>
          <ToolbarBtn title="删除线" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <s>S</s>
          </ToolbarBtn>
          <span className="rte-sep" />
          <ToolbarBtn title="一级标题" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            H1
          </ToolbarBtn>
          <ToolbarBtn title="二级标题" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            H2
          </ToolbarBtn>
          <span className="rte-sep" />
          <ToolbarBtn title="无序列表" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            • 列表
          </ToolbarBtn>
          <ToolbarBtn title="有序列表" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            1. 列表
          </ToolbarBtn>
          <ToolbarBtn title="引用" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            ❝
          </ToolbarBtn>
          <ToolbarBtn title="水平分割线" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            ─
          </ToolbarBtn>
          <span className="rte-sep" />
          {ALIGN_OPTIONS.map((opt) => (
            <ToolbarBtn
              key={opt.key}
              title={opt.title}
              active={editor.isActive({ textAlign: opt.key })}
              onClick={() => editor.chain().focus().setTextAlign(opt.key).run()}
            >
              {opt.label}
            </ToolbarBtn>
          ))}
          <span className="rte-sep" />
          <label className="rte-color" title="文字颜色">
            <input
              type="color"
              onMouseDown={(e) => e.preventDefault()}
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            />
          </label>
          <ToolbarBtn title="清除文字颜色" onClick={() => editor.chain().focus().unsetColor().run()}>
            无
          </ToolbarBtn>
          <ToolbarBtn
            title="高亮（黄色）"
            active={editor.isActive('highlight')}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
          >
            🖍
          </ToolbarBtn>
          <span className="rte-sep" />
          <label className="rte-select" title="字号">
            <select
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (!v) (editor?.chain().focus() as any).unsetFontSize().run();
                else (editor?.chain().focus() as any).setFontSize(v).run();
              }}
            >
              <option value="">字号</option>
              <option value="12px">12</option>
              <option value="14px">14</option>
              <option value="16px">16</option>
              <option value="18px">18</option>
              <option value="20px">20</option>
              <option value="24px">24</option>
              <option value="28px">28</option>
              <option value="32px">32</option>
            </select>
          </label>
          <label className="rte-color" title="背景色（高亮）">
            <input
              type="color"
              onMouseDown={(e) => e.preventDefault()}
              onChange={(e) => {
                const c = e.target.value;
                if (c) editor?.chain().focus().setHighlight({ color: c }).run();
              }}
            />
          </label>
          <span className="rte-sep" />
          <ToolbarBtn
            title="插入表格（3×3）"
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          >
            表格
          </ToolbarBtn>
          <ToolbarBtn
            title="删除表格"
            disabled={!editor.isActive('table')}
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            删表
          </ToolbarBtn>
          <span className="rte-sep" />
          <ToolbarBtn title="链接" active={editor.isActive('link')} onClick={openLinkModal}>
            链接
          </ToolbarBtn>
          <ToolbarBtn title="插入图片（本地上传）" onClick={() => imgInputRef.current?.click()}>
            图片
          </ToolbarBtn>
          <ToolbarBtn title="插入图片（线上链接）" onClick={openImgUrlModal}>
            图片URL
          </ToolbarBtn>
          <ToolbarBtn title="上传文件并插入链接" onClick={() => fileInputRef.current?.click()}>
            文件
          </ToolbarBtn>
        </div>
      )}

      <EditorContent editor={editor} className="rte-content" />

      <input
        ref={imgInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadAndInsertImage(f);
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadAndInsertFile(f);
          e.target.value = '';
        }}
      />

      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="插入 / 编辑链接" width="md">
        <div className="field">
          <label className="field-label">链接地址（http/https）</label>
          <input
            className="input"
            value={linkValue}
            autoFocus
            placeholder="https://"
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyLink();
            }}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={() => setLinkOpen(false)}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={applyLink}>
            确定
          </button>
        </div>
      </Modal>

      <Modal open={imgUrlOpen} onClose={() => setImgUrlOpen(false)} title="插入图片（线上链接）" width="md">
        <div className="field">
          <label className="field-label">图片地址（http/https 可直接访问的图片 URL）</label>
          <input
            className="input"
            value={imgUrlValue}
            autoFocus
            placeholder="https://example.com/photo.jpg"
            onChange={(e) => setImgUrlValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyImgUrl();
            }}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={() => setImgUrlOpen(false)}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={applyImgUrl}>
            确定
          </button>
        </div>
      </Modal>
    </div>
  );
}
