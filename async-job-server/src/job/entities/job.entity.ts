export class Job {
  id: string;
  targetUrl: string;
  method: string;
  headers: Record<string, string>;
  payload: any;
  callbackUrl: string;
  maxRetries: number;
  retryDelay: number;
  createdAt: Date;
}
