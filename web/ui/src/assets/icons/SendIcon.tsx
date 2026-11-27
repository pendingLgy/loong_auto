import send from "./send.svg?raw";

import {Icon} from "./Icon";

export function SendIcon(props: {class?: string}) {
  return <Icon svg={send} class={props.class} />;
}
