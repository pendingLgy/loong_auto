export interface IconProps {
  class?: string;
}

/** 热门供应商图标。 */
export function PopularIcon(props: IconProps) {
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
      <path d="M12 3c1.2 3.6.3 5.4-1.2 7C9.1 11.9 8 13.5 8 16a4 4 0 0 0 8 0c0-1.4-.5-2.5-1.2-3.5" />
      <path d="M12 21a5 5 0 0 1-5-5c0-3 2-5 4-7" />
    </svg>
  );
}
