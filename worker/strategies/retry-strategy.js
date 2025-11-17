class RetryStrategy {
  static shouldRetry(statusCode) {
    return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
  }

  static getDelay(attempt, baseDelay) {
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = exponentialDelay * 0.1 * Math.random();
    return Math.min(exponentialDelay + jitter, 30000);
  }

  static isRetryableError(error) {
    if (!error.response) {
      return true;
    }

    const status = error.response.status;
    return this.shouldRetry(status);
  }
}

module.exports = RetryStrategy;
