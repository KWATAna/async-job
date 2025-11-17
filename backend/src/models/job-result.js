class JobResult {
  constructor(jobId, status, attempts, response = null, error = null) {
    this.jobId = jobId;
    this.status = status;
    this.attempts = attempts;
    this.response = response;
    this.error = error;
    this.completedAt = new Date().toISOString();
  }

  toCallbackFormat() {
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

module.exports = JobResult;
