/** 使用临时 textarea 与 execCommand 复制，避免 Clipboard API 的浏览器限制。 */
export async function copyText(text: string): Promise<boolean> {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.className = "sr-only";
  textarea.setAttribute("aria-hidden", "true");

  const active = document.activeElement;
  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (active instanceof HTMLElement) active.focus();
  }
}
