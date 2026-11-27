import {For, Show, createMemo, createSignal, onCleanup} from "solid-js";
import {codeToHtml, type Lang} from "@pierre/highlights";
import githubDark from "@pierre/highlights/themes/github-dark";
import type {JSX} from "@solidjs/web";

import {CheckIcon, CopyIcon} from "../assets/icons";
import {useUiI18n} from "../i18n";
import {copyText} from "./copy";

type Block =
  | {type: "heading"; level: number; text: string}
  | {type: "code"; language: string; text: string}
  | {type: "list"; ordered: boolean; items: string[]}
  | {type: "quote"; text: string}
  | {type: "rule"}
  | {type: "paragraph"; text: string};

export interface ChatMarkdownProps {
  content: string;
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({type: "code", language: fence[1], text: code.join("\n")});
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({type: "heading", level: heading[1].length, text: heading[2]});
      index += 1;
      continue;
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push({type: "rule"});
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({type: "quote", text: quote.join("\n")});
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.*)$/);
    if (unordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*[-*+]\s+(.*)$/);
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      blocks.push({type: "list", ordered: false, items});
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*\d+\.\s+(.*)$/);
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      blocks.push({type: "list", ordered: true, items});
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      const next = lines[index];
      if (/^(#{1,6})\s+|^```|^\s*[-*+]\s+|^\s*\d+\.\s+|^>\s?/.test(next)) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push({type: "paragraph", text: paragraph.join("\n")});
  }

  return blocks;
}

function safeHref(value: string): string | undefined {
  return /^(https?:\/\/|mailto:|\/|#)/.test(value) ? value : undefined;
}

function renderInline(text: string): JSX.Element[] {
  const nodes: JSX.Element[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith("`")) {
      nodes.push(
        <code class="rounded bg-slate-200/70 px-1 py-0.5 text-[12px] text-slate-700 dark:bg-slate-700 dark:text-slate-200">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong class="font-semibold">{token.slice(2, -2)}</strong>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = link ? safeHref(link[2]) : undefined;
      if (link && href) {
        nodes.push(
          <a href={href} target="_blank" rel="noreferrer" class="text-indigo-600 underline underline-offset-2 dark:text-indigo-300">
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function CodeBlock(props: {language: string; text: string}) {
  const {t} = useUiI18n();
  const [copied, setCopied] = createSignal(false);
  const highlighted = createMemo(() => {
    if (!props.language) return "";
    try {
      const html = new TextDecoder().decode(codeToHtml(props.text, {
        lang: props.language as Lang,
        theme: githubDark,
      }));
      const start = html.indexOf("<code>");
      const end = html.lastIndexOf("</code>");
      return start === -1 || end === -1 ? "" : html.slice(start + 6, end);
    } catch {
      return "";
    }
  });
  let timer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    if (timer) clearTimeout(timer);
  });

  const copy = async () => {
    if (!await copyText(props.text)) return;
    setCopied(true);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div class="overflow-hidden rounded-md border border-slate-700 bg-slate-800">
      <div class="flex h-8 items-center justify-between border-b border-slate-600 bg-slate-700 px-2.5 text-[11px] text-slate-300">
        <span class="min-w-0 truncate">{props.language || "text"}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied() ? t("chat.copied", "已复制") : t("chat.copyCode", "复制代码")}
          title={copied() ? t("chat.copied", "已复制") : t("chat.copyCode", "复制代码")}
          class="grid h-6 w-6 shrink-0 place-items-center rounded text-slate-400 outline-none transition hover:bg-slate-600 hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-400/40"
        >
          {copied()
            ? <CheckIcon class="h-3.5 w-3.5 text-emerald-400" />
            : <CopyIcon class="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre class="m-0 overflow-x-auto p-3 text-[12px] leading-5 text-slate-100">
        <Show when={highlighted()} fallback={<code>{props.text}</code>}>
          <code innerHTML={highlighted()} />
        </Show>
      </pre>
    </div>
  );
}

/** 轻量 Markdown 渲染，不注入 HTML。 */
export function ChatMarkdown(props: ChatMarkdownProps) {
  const blocks = createMemo(() => parseBlocks(props.content));

  return (
    <div class="grid gap-2 text-[13px] leading-6 text-slate-700 dark:text-slate-200">
      <For each={blocks()}>
        {(block) => {
          switch (block.type) {
            case "heading": {
              const classByLevel = [
                "text-base font-semibold",
                "text-sm font-semibold",
                "text-[13px] font-semibold",
                "text-[13px] font-medium",
                "text-[13px] font-medium",
                "text-[13px] font-medium",
              ];
              return (
                <p class={`m-0 ${classByLevel[block.level - 1] ?? "text-[13px] font-medium"}`}>
                  {renderInline(block.text)}
                </p>
              );
            }
            case "code":
              return <CodeBlock language={block.language} text={block.text} />;
            case "list":
              return (
                <ul class={`m-0 grid gap-1 pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}>
                  <For each={block.items}>
                    {(item) => <li>{renderInline(item)}</li>}
                  </For>
                </ul>
              );
            case "quote":
              return (
                <blockquote class="m-0 border-l-2 border-slate-300 pl-3 text-slate-500 dark:border-slate-600 dark:text-slate-400">
                  {renderInline(block.text)}
                </blockquote>
              );
            case "rule":
              return <hr class="m-0 border-slate-200 dark:border-slate-700" />;
            default:
              return (
                <p class="m-0 whitespace-pre-wrap break-words">
                  {renderInline(block.text)}
                </p>
              );
          }
        }}
      </For>
    </div>
  );
}
