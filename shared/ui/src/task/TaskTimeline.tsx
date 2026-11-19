import { For } from "solid-js";
import type { TaskEvent } from "../../../contracts/types";

/** 仅渲染文本，不将模型或工具输出作为 HTML 注入。 */
export function TaskTimeline(props: { events: readonly TaskEvent[] }) {
  return <ol aria-label="任务记录">
    <For each={props.events}>{event => <li>
      <time dateTime={event.timestamp}>{event.timestamp}</time>
      <strong>{event.type}</strong>
      <pre>{JSON.stringify(event.payload, null, 2)}</pre>
    </li>}</For>
  </ol>;
}
