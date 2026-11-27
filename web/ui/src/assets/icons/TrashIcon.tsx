import trash from "./trash.svg?raw";

import {Icon} from "./Icon";

export function TrashIcon(props: {class?: string}) {
  return <Icon svg={trash} class={props.class} />;
}
