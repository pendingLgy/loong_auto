function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 当天显示 HH:mm，非当天显示 YYYY-MM-dd HH:mm。 */
export function formatMessageTime(value: Date | string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  return sameDay
    ? time
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`;
}

/** 生成 <time datetime> 所需值，非法日期返回 undefined。 */
export function dateTimeValue(value: Date | string | number): string | undefined {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
