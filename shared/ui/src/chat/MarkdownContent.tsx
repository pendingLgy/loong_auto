import { createEffect, createResource, type Component } from "solid-js";

import { createMarkdownProcessor } from "@astrojs/markdown-remark";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import { copyText } from "./clipboard";

type Processor = Awaited<ReturnType<typeof createMarkdownProcessor>>;

let processorPromise: Promise<Processor> | null = null;
const htmlCache = new Map<string, string>();

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}

function codeLanguage(pre: HastNode): string {
  const code = pre.children?.find((child) => child.type === "element" && child.tagName === "code");
  const className = code?.properties?.className;
  const classes = Array.isArray(className) ? className : typeof className === "string" ? [className] : [];
  const language = classes.find((item) => typeof item === "string" && item.startsWith("language-"));
  return typeof language === "string" ? language.slice("language-".length) : "text";
}

function wrapCodeBlock(pre: HastNode): HastNode {
  return {
    type: "element",
    tagName: "div",
    properties: { className: ["code-block"] },
    children: [
      {
        type: "element",
        tagName: "div",
        properties: { className: ["code-header"] },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["code-lang"] },
            children: [{ type: "text", value: codeLanguage(pre) }],
          },
          {
            type: "element",
            tagName: "button",
            properties: {
              type: "button",
              "data-copy-code": "",
              className: ["code-copy"],
            },
            children: [],
          },
        ],
      },
      pre,
    ],
  };
}

function transformTree(node: HastNode): void {
  if (!node.children) return;
  node.children = node.children.map((child) => {
    if (child.type === "element" && child.tagName === "pre") {
      return wrapCodeBlock(child);
    }
    transformTree(child);
    return child;
  });
}

/** 为代码块添加「语言 + 复制」头部。 */
function rehypeCodeHeader() {
  return (tree: HastNode) => {
    transformTree(tree);
  };
}

function getProcessor(): Promise<Processor> {
  processorPromise ??= createMarkdownProcessor({
    syntaxHighlight: false,
    rehypePlugins: [rehypeCodeHeader],
  });
  return processorPromise;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}


const COPY_ICON = '<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const CHECK_ICON = '<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>';

const markdownClass = "grid min-w-0 gap-1.5 whitespace-normal break-words text-sm leading-relaxed "
  + "[&_a]:text-sky-600 [&_a]:underline "
  + "[&_blockquote]:m-0 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 "
  + "[&_code]:rounded [&_code]:bg-slate-900/5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] "
  + "[&_h1]:m-0 [&_h1]:text-base [&_h1]:font-semibold "
  + "[&_h2]:m-0 [&_h2]:text-sm [&_h2]:font-semibold "
  + "[&_h3]:m-0 [&_h3]:text-sm [&_h3]:font-semibold "
  + "[&_hr]:border-slate-200 "
  + "[&_li]:ml-4 [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:m-0 "
  + "[&_pre]:overflow-x-auto [&_pre]:p-2 [&_pre]:text-slate-100 "
  + "[&_pre_code]:bg-transparent [&_pre_code]:p-0 "
  + "[&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:px-1.5 [&_td]:py-1 "
  + "[&_th]:border [&_th]:border-slate-200 [&_th]:px-1.5 [&_th]:py-1 "
  + "[&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-4 "
  + "[&_.code-block]:overflow-hidden [&_.code-block]:rounded-lg [&_.code-block]:bg-slate-900 "
  + "[&_.code-header]:flex [&_.code-header]:items-center [&_.code-header]:justify-between [&_.code-header]:gap-2 [&_.code-header]:bg-slate-800 "
  + "[&_.code-header]:border-b [&_.code-header]:border-white/10 [&_.code-header]:px-3 [&_.code-header]:py-1.5 "
  + "[&_.code-lang]:text-[11px] [&_.code-lang]:font-medium [&_.code-lang]:uppercase [&_.code-lang]:tracking-wider [&_.code-lang]:text-slate-400 "
  + "[&_.code-copy]:grid [&_.code-copy]:h-6 [&_.code-copy]:w-6 [&_.code-copy]:place-items-center [&_.code-copy]:rounded [&_.code-copy]:text-slate-300 [&_.code-copy]:transition "
  + "[&_.code-copy:hover]:bg-white/10 [&_.code-copy:hover]:text-white "
  + "[&_.code-block_pre]:m-0 [&_.code-block_pre]:rounded-none [&_.code-block_pre]:bg-transparent "
  + "dark:[&_blockquote]:border-white/20 dark:[&_code]:bg-white/10 dark:[&_hr]:border-white/10 "
  + "dark:[&_td]:border-white/10 dark:[&_th]:border-white/10";

export interface MarkdownContentProps {
  /** Markdown 源文本。 */
  content: string;
  /** 界面语言；默认中文。 */
  locale?: Locale;
  class?: string;
  /** HTML 渲染完成后的回调（传入根元素），用于通知虚拟列表重新测量高度。 */
  onRendered?: (element: HTMLElement) => void;
}

/** 把 Markdown 内容渲染成 HTML（使用 @astrojs/markdown-remark）。 */
export const MarkdownContent: Component<MarkdownContentProps> = (props) => {
  let root: HTMLDivElement | undefined;

  const locale = () => props.locale ?? DEFAULT_LOCALE;

  const [html] = createResource(
    () => props.content,
    async (content) => {
      const cached = htmlCache.get(content);
      if (cached !== undefined) return cached;

      try {
        const processor = await getProcessor();
        const result = await processor.render(content);
        htmlCache.set(content, result.code);
        return result.code;
      } catch {
        return escapeHtml(content);
      }
    },
  );

  const handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>("[data-copy-code]");
    if (!button) return;

    const code = button.closest(".code-block")?.querySelector("code");
    if (!code) return;

    void copyText(code.textContent ?? "")
      .then(() => {
        button.innerHTML = CHECK_ICON;
        button.setAttribute("aria-label", translate(locale(), "chat.copied", "已复制"));
        button.setAttribute("title", translate(locale(), "chat.copied", "已复制"));
      })
      .catch(() => {
        button.setAttribute("aria-label", translate(locale(), "chat.copyFailed", "复制失败"));
        button.setAttribute("title", translate(locale(), "chat.copyFailed", "复制失败"));
      })
      .finally(() => {
        window.setTimeout(() => {
          if (!button.isConnected) return;
          button.innerHTML = COPY_ICON;
          button.setAttribute("aria-label", translate(locale(), "chat.copyCode", "复制"));
          button.setAttribute("title", translate(locale(), "chat.copyCode", "复制"));
        }, 1200);
      });
  };

  createEffect(() => {
    const content = html();
    const node = root;
    const copyLabel = translate(locale(), "chat.copyCode", "复制");
    if (content === undefined || !node) return;

    node.querySelectorAll<HTMLButtonElement>("[data-copy-code]").forEach((button) => {
      button.innerHTML = COPY_ICON;
      button.setAttribute("aria-label", copyLabel);
      button.setAttribute("title", copyLabel);
    });

    props.onRendered?.(node);
  });

  return (
    <div
      ref={root}
      class={`${markdownClass} ${props.class ?? ""}`}
      onClick={handleClick}
      innerHTML={html() ?? ""}
    />
  );
};
