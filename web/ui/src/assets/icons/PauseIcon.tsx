import pause from "./pause.svg?raw";

import {Icon} from "./Icon";

export function PauseIcon(props: {class?: string}) {
  return <Icon svg={pause} class={props.class} />;
}
