const redisService = require("./redis-service");
const httpRequestService = require("./http-request-service");
const RetryStrategy = require("../strategies/retry-strategy");
const { wait } = require("../utils/helpers");

class JobExecutor {
  async execute({
    jobId,
    targetUrl,
    method,
    headers,
    payload,
    maxRetries,
    retryDelay,
  }) {
    let attempts = 0;
    let statusCode = null;
    let success = false;
    let responseData;
    let errorMessage = null;

    while (attempts < maxRetries) {
      attempts += 1;
      const attemptAt = new Date().toISOString();

      try {
        const response = await httpRequestService.executeRequest(
          targetUrl,
          method,
          headers,
          payload
        );
        statusCode = response.status;
        responseData = response.data;

        if (RetryStrategy.shouldRetry(statusCode) && attempts < maxRetries) {
          await this.handleRetryableError({
            jobId,
            attempts,
            maxRetries,
            statusCode,
            retryDelay,
            timestamp: attemptAt,
          });
          continue;
        }

        success = httpRequestService.isSuccess(statusCode);
        if (!success) {
          errorMessage = `Request completed with non-success status ${statusCode}`;
        }

        await this.logAttemptResult({
          jobId,
          attempts,
          statusCode,
          success,
          errorMessage,
          responseData,
          timestamp: attemptAt,
        });
        break;
      } catch (error) {
        const shouldRetry =
          httpRequestService.shouldRetryBasedOnError(error) &&
          attempts < maxRetries;

        if (shouldRetry) {
          await this.handleRetryableError({
            jobId,
            attempts,
            maxRetries,
            statusCode: error.response?.status,
            retryDelay,
            timestamp: attemptAt,
            errorMessage: error.message,
          });
          continue;
        }

        statusCode = error.response ? error.response.status : null;
        errorMessage = error.message;
        await this.logAttemptResult({
          jobId,
          attempts,
          statusCode,
          success: false,
          errorMessage,
          responseData: null,
          timestamp: attemptAt,
        });
        break;
      }
    }

    return { attempts, success, statusCode, responseData, errorMessage };
  }

  async handleRetryableError({
    jobId,
    attempts,
    maxRetries,
    statusCode,
    retryDelay,
    timestamp,
    errorMessage = null,
  }) {
    const delay = RetryStrategy.getDelay(attempts, retryDelay);
    await redisService.logAttempt(jobId, {
      attempt: attempts,
      statusCode,
      success: false,
      error: errorMessage || `Retryable status ${statusCode} received`,
      timestamp,
    });

    console.warn(
      `Attempt ${attempts}/${maxRetries} failed with status ${statusCode}. Retrying in ${delay}ms`
    );

    await wait(delay);
  }

  async logAttemptResult({
    jobId,
    attempts,
    statusCode,
    success,
    errorMessage,
    responseData,
    timestamp,
  }) {
    await redisService.logAttempt(jobId, {
      attempt: attempts,
      statusCode,
      success,
      error: success ? undefined : errorMessage,
      response: success ? responseData : undefined,
      timestamp,
    });
  }
}

module.exports = new JobExecutor();
