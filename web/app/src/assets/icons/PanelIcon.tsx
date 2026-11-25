export interface PanelIconProps {
  expanded?: boolean;
  class?: string;
}

/** 侧栏折叠 / 展开图标。 */
export function PanelIcon(props: PanelIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      {props.expanded
        ? <path d="M16 9l-3 3 3 3" />
        : <path d="M13 9l3 3-3 3" />}
    </svg>
  );
}
