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
    } catch (error: any) {
      if (retries > 0 && (error.name === 'FetchError' || error.response?.status >= 500)) {
        const backoffDelay = delay * Math.pow(2, this.retryOptions.retries - retries);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        return this.requestWithRetry(config, retries - 1, backoffDelay);
      } else {
        throw new Error(`Request failed after ${this.retryOptions.retries} retries: ${error.message}`);
      }
    }
  }

  private appendParamsToUrl(url: string, params?: Record<string, any>): string {
    if (!params) return url;

    const urlObj = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(val => urlObj.searchParams.append(key, val));
      } else if (typeof value === 'object' && value !== null) {
        Object.entries(value).forEach(([subKey, subVal]) => {
          urlObj.searchParams.append(`${key}[${subKey}]`, subVal as string);
        });
      } else {
        urlObj.searchParams.append(key, value);
      }
    });

    return urlObj.toString();
  }

  private async requestInternal<T>(config: RequestConfig): Promise<Response<T>> {
    const { method, url, data, headers, params, timeout } = config;

    const fullUrl = this.appendParamsToUrl(url!, params);

    const controller = new AbortController();
    const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : undefined;

    const fetchOptions: RequestInit = {
      method,
      headers,
      body: data && typeof data !== 'string' ? JSON.stringify(data) : data,
      signal: controller.signal,
    };

    try {
      const response = await fetch(fullUrl, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('Content-Type');
      let responseData: any;
      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else if (contentType?.includes('text/')) {
        responseData = await response.text();
      } else {
        responseData = await response.blob();
      }

      return {
        status: response.status,
        headers: response.headers,
        config,
        data: responseData,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw new Error(`Network error: ${error.message}`);
    }
  }

  async request<T>(config: AxiosRequestConfig): Promise<Response<T>> {
    let processedConfig: RequestConfig = { ...config, method: config.method || 'GET' };
    for (const interceptor of this.interceptors.request) {
      processedConfig = interceptor(processedConfig);
    }

    const { retries, delay } = this.retryOptions;
    let response: Response<T>;
    try {
      response = await this.requestWithRetry<T>(processedConfig, retries, delay);
    } catch (error) {
      throw error;
    }

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
