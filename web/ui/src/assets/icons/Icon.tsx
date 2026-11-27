export interface IconProps {
  svg: string;
  class?: string;
}

/** 渲染静态 SVG 字符串，尺寸由外层 class 控制。 */
export function Icon(props: IconProps) {
  return (
    <span
      aria-hidden="true"
      class={`inline-flex [&>svg]:h-full [&>svg]:w-full ${props.class ?? ""}`}
      innerHTML={props.svg}
    />
  );
}
