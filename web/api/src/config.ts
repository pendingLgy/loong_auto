/** HTTP 请求类型。 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** 单个接口配置：地址、请求类型与请求/响应类型写在一起。 */
export interface ApiEndpoint<
  TRequest = void,
  TResponse = void,
  TMethod extends HttpMethod = HttpMethod,
  TPath extends string = string,
> {
  method: TMethod;
  path: TPath;
  request: TRequest;
  response: TResponse;
}

/** Web API 客户端配置。 */
export interface ApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: "http://127.0.0.1:9528",
  timeoutMs: 5_000,
};



/** 替换路径参数并进行 URL 编码。 */
export function endpointPath(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : encodeURIComponent(String(value));
  });
}
