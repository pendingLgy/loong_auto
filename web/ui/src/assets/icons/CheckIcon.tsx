import check from "./check.svg?raw";

import {Icon} from "./Icon";

export function CheckIcon(props: {class?: string}) {
  return <Icon svg={check} class={props.class} />;
}
