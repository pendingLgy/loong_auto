import plus from "./plus.svg?raw";

import {Icon} from "./Icon";

export function PlusIcon(props: {class?: string}) {
  return <Icon svg={plus} class={props.class} />;
}
