import {createSignal} from "solid-js";

import {ChatAssistantMessage, type ChatApprovalFile, type ChatTool} from "../../../src";

const markdown = `## 会议纪要

已根据录音整理出三个主题：

- **产品进度**：本周完成登录与工作区模块
- **风险**：接口联调时间偏紧
- **待办**：补充错误提示与移动端布局

\`\`\`ts
const status: string = "ready";
\`\`\`

\`\`\`python
def summarize(items: list[str]) -> dict[str, int]:
    return {"count": len(items)}
\`\`\`

\`\`\`json
{
  "status": "ready",
  "count": 3
}
\`\`\`

\`\`\`bash
bun run --filter '@loong/ui' typecheck
\`\`\`

\`\`\`java
public final class Message {
    public static String greet(String name) {
        return "Hello, " + name;
    }
}
\`\`\`

\`\`\`css
.card {
  border-radius: 8px;
  color: var(--color-text);
}
\`\`\`

详见 [项目计划](https://example.com/plan)。`;

const approvalFiles: ChatApprovalFile[] = Array.from({length: 10}, (_, index) => ({
  id: String(index + 1),
  name: `src/features/module-${index + 1}.tsx`,
}));

const processedFiles: ChatApprovalFile[] = Array.from({length: 8}, (_, index) => ({
  id: String(index + 20),
  name: `src/legacy/file-${index + 1}.ts`,
  status: index % 2 === 0 ? "approved" : "rejected",
}));

const tools: ChatTool[] = Array.from({length: 24}, (_, index) => ({
  id: String(index + 1),
  name: index === 0 ? "meeting.summarize" : `tool.run-${index + 1}`,
  content: index === 0
    ? Array.from({length: 40}, (_, step) =>
      `步骤 ${step + 1}：执行工具并记录输出，校验返回结果。`).join("\n")
    : [
      `任务 ${index + 1} 开始执行`,
      "读取上下文与工作区文件",
      "调用工具并收集结果",
      "校验输出格式",
      "写入执行日志",
      "状态：completed",
      "耗时：1.2s",
    ].join("\n"),
}));


/** ChatAssistantMessage 独立预览。 */
export function ChatAssistantMessagePreview() {
  const [copied, setCopied] = createSignal(false);
  const [approvals, setApprovals] = createSignal<ChatApprovalFile[]>(approvalFiles);

  return (
    <div class="grid gap-5">
      <div class="grid gap-1">
        <h2 class="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
          ChatAssistantMessage
        </h2>
        <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
          工具执行内容、Markdown 内容与复制操作；工具列表超过 70vh、详情超过 50vh、审核列表超过最大高度后滚动。
        </p>
      </div>

      <div class="grid gap-6 rounded-xl border border-slate-200 p-5 dark:border-slate-700">
        <ChatAssistantMessage
          currentTool="meeting.summarize"
          tools={tools}
          approvalFiles={approvals()}
          processedApprovalFiles={processedFiles}
          onApproveFile={(file) => setApprovals((current) =>
            current.filter((item) => item.id !== file.id))}
          onRejectFile={(file) => setApprovals((current) =>
            current.filter((item) => item.id !== file.id))}
          content={markdown}
          createdAt={new Date()}
          onCopy={() => setCopied(true)}
        />
        <ChatAssistantMessage
          content="已收到，我会继续处理。"
          createdAt={new Date(Date.now() - 24 * 60 * 60 * 1000)}
          onCopy={() => setCopied(true)}
        />
      </div>

      <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
        复制状态：{copied() ? "已复制" : "暂无"}
      </p>
    </div>
  );
}
