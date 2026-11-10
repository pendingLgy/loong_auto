import type { Task } from "../contracts/types";

const labels: Record<Task["status"], string> = {
  queued: "排队中", running: "推理中", waiting_tool: "等待本地执行",
  completed: "已完成", failed: "失败", cancelled: "已停止推进",
};

export function TaskStatus(props: { status: Task["status"] }) {
  return <span role="status" data-status={props.status}>{labels[props.status]}</span>;
}
