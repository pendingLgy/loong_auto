export interface IconProps {
  class?: string;
}

/** 添加图标。 */
export function PlusIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      aria-hidden="true"
      class={props.class}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
