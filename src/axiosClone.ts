import type { RetryOptions, RequestConfig, Response, AxiosRequestConfig, AxiosInstance } from './types';

export class AxiosClone implements AxiosInstance {
  private retryOptions: RetryOptions;
  private interceptors = {
    request: [] as Array<(config: RequestConfig) => RequestConfig>,
    response: [] as Array<(response: Response<any>) => Response<any>>,
  };

  constructor(retryOptions: RetryOptions = { retries: 3, delay: 1000 }) {
    this.retryOptions = retryOptions;
  }

  useRequestInterceptor(interceptor: (config: RequestConfig) => RequestConfig): void {
    this.interceptors.request.push(interceptor);
  }

  useResponseInterceptor(interceptor: (response: Response<any>) => Response<any>): void {
    this.interceptors.response.push(interceptor);
  }

  private async requestWithRetry<T>(config: RequestConfig, retries: number, delay: number): Promise<Response<T>> {
    try {
      return await this.requestInternal<T>(config);
    } catch (error) {
      if (retries > 0) {
        console.warn(`Request failed, retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.requestWithRetry(config, retries - 1, delay);
      } else {
        throw error;
      }
    }
  }

  private appendParamsToUrl(url: string, params?: Record<string, any>): string {
    if (!params) return url;

    const urlObj = new URL(url);
    Object.keys(params).forEach(key => {
      urlObj.searchParams.append(key, params[key]);
    });

    return urlObj.toString();
  }

  private async requestInternal<T>(config: RequestConfig): Promise<Response<T>> {
    const { method, url, data, headers, params } = config;

    // Append query parameters if provided
    const fullUrl = this.appendParamsToUrl(url!, params);

    const response = await fetch(fullUrl, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    const responseData = await response.json().catch(() => ({}));

    return {
      status: response.status,
      headers: response.headers,
      config,
      data: responseData,
    };
  }

  async request<T>(config: AxiosRequestConfig): Promise<Response<T>> {
    // Apply request interceptors
    let processedConfig: RequestConfig = { ...config, method: config.method || 'GET' };
    for (const interceptor of this.interceptors.request) {
      processedConfig = interceptor(processedConfig);
    }

    // Retry logic
    const { retries, delay } = this.retryOptions;
    let response: Response<T>;
    try {
      response = await this.requestWithRetry<T>(processedConfig, retries, delay);
    } catch (error) {
      throw error;
    }

    // Apply response interceptors
    for (const interceptor of this.interceptors.response) {
      response = interceptor(response);
    }

    return response;
  }

  get<T>(url: string, config: Omit<RequestConfig, 'method' | 'url'> = {}): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  post<T>(url: string, data: any, config: Omit<RequestConfig, 'method' | 'url' | 'data'> = {}): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  put<T>(url: string, data: any, config: Omit<RequestConfig, 'method' | 'url' | 'data'> = {}): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  delete<T>(url: string, config: Omit<RequestConfig, 'method' | 'url'> = {}): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  head<T>(url: string, config: Omit<RequestConfig, 'method' | 'url'> = {}): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'HEAD', url });
  }

  patch<T>(url: string, data: any, config: Omit<RequestConfig, 'method' | 'url' | 'data'> = {}): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  options<T>(url: string, config: Omit<RequestConfig, 'method' | 'url'> = {}): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'OPTIONS', url });
  }
}
