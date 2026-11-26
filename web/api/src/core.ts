export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface Endpoint<TReq = void, TRes = void> {
  readonly method: HttpMethod;
  readonly path: string;
  /** 仅用于 TypeScript 类型绑定，运行时无开销 */
  readonly _req?: TReq;
  readonly _res?: TRes;
}

export const defineEndpoint = <TReq = void, TRes = void>(
  method: HttpMethod,
  path: string,
): Endpoint<TReq, TRes> => ({ method, path });
