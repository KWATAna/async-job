// src/models/job-result.ts
export interface CallbackFormat {
  jobId: string;
  status: string;
  attempts: number;
  response: any;
  error: string | null;
  completedAt: string;
}

class JobResult {
  jobId: string;
  status: string;
  attempts: number;
  response: any;
  error: string | null;
  completedAt: string;

  constructor(
    jobId: string,
    status: string,
    attempts: number,
    response: any = null,
    error: string | null = null
  ) {
    this.jobId = jobId;
    this.status = status;
    this.attempts = attempts;
    this.response = response;
    this.error = error;
    this.completedAt = new Date().toISOString();
  }

  toCallbackFormat(): CallbackFormat {
    return {
      jobId: this.jobId,
      status: this.status,
      attempts: this.attempts,
      response: this.response,
      error: this.error,
      completedAt: this.completedAt,
    };
  }
}

export default JobResult;