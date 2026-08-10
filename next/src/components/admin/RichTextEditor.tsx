'use client';

import { useRef } from 'react';
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
import { uploadAvatar, resolveAsset, getApiErrorMsg } from '@/lib/api';
import { useToast } from '@/components/Toast';

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
  { key: 'justify', label: '⬛', title: '两端对齐' },
];

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
      Image.configure({ inline: true, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  });

  const uploadAndInsertImage = async (file: File) => {
    try {
      const url = await uploadAvatar(file);
      editor?.chain().focus().setImage({ src: resolveAsset(url) }).run();
    } catch (e) {
      toast.error(getApiErrorMsg(e));
    }
  };

  const uploadAndInsertFile = async (file: File) => {
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

  const setLink = () => {
    if (!editor) return;
    const prev = (editor.getAttributes('link').href as string) || '';
    const url = window.prompt('链接地址（http/https）', prev || 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
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
          <ToolbarBtn title="链接" active={editor.isActive('link')} onClick={setLink}>
            链接
          </ToolbarBtn>
          <ToolbarBtn title="插入图片（内联）" onClick={() => imgInputRef.current?.click()}>
            图片
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
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadAndInsertFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
