/** 云端统一响应信封。 */
export interface ApiEnvelope<T> {
  code: number;
  msg?: string;
  data?: T;
}
