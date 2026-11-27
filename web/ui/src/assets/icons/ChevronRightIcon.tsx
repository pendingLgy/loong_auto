import chevronRight from "./chevron-right.svg?raw";

import {Icon} from "./Icon";

export function ChevronRightIcon(props: {class?: string}) {
  return <Icon svg={chevronRight} class={props.class} />;
}
