export interface RetryOptions {
  retries: number;
  delay: number;
}

export interface RequestConfig {
  method: string;
  url?: string;
  headers?: Record<string, string>;
  data?: any;
  params?: Record<string, any>; // Add params here
}

export interface AxiosRequestConfig extends Omit<RequestConfig, 'method' | 'url'> {
  url?: string;
  method?: string;
  baseURL?: string;
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  withCredentials?: boolean;
}

export interface Response<T = any> {
  status: number;
  statusText?: string;
  headers: Headers;
  config: AxiosRequestConfig;
  request?: any;
  data: T;
}

export interface AxiosInstance {
  request<T>(config: AxiosRequestConfig): Promise<Response<T>>;
  get<T>(url: string, config?: AxiosRequestConfig): Promise<Response<T>>;
  post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<Response<T>>;
  put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<Response<T>>;
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<Response<T>>;
  head<T>(url: string, config?: AxiosRequestConfig): Promise<Response<T>>;
  patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<Response<T>>;
  options<T>(url: string, config?: AxiosRequestConfig): Promise<Response<T>>;
}
