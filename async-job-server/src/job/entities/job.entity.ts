export class Job {
  id: string;
  targetUrl: string;
  method: string;
  headers: string;
  attempts: number;
  status: 'queued' | 'failed' | 'completed';
  payload: any;
  callbackUrl: string;
  maxRetries: number;
  retryDelay: number;
  createdAt: string;
  lastResponse?: string | null;
}
