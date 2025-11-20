export class CreateJobDto {
  targetUrl: string;
  method?: string;
  headers?: Record<string, string>;
  payload?: any;
  callbackUrl: string;
  maxRetries?: number;
  retryDelay?: number;
}
