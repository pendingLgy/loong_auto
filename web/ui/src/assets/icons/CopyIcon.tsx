import copy from "./copy.svg?raw";

import {Icon} from "./Icon";

export function CopyIcon(props: {class?: string}) {
  return <Icon svg={copy} class={props.class} />;
}
