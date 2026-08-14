import { Extension } from '@tiptap/react';
import '@tiptap/extension-text-style';

// 字号扩展：复用 textStyle mark 的 fontSize 属性，不引入额外依赖。
// 与项目已有的 Color / Highlight 同一套机制（都挂在 textStyle 上）。
//
// 说明：本工程 pnpm 严格模式下 @tiptap/core 不可直接 import（仅作间接依赖），
// 因此这里不通过 `declare module '@tiptap/core'` 做命令类型增强，
// 而是直接注册命令（运行时生效），调用处用受控 `as any` 绕过命令名类型检查。

export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return { types: ['textStyle'] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: Record<string, any>) =>
              attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string | null) =>
        ({ chain }: any) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }: any) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});
