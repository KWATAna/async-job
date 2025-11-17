const redisService = require("../services/redis-service");
const httpRequestService = require("../services/http-request-service");
const callbackService = require("../services/callback-service");
const RetryStrategy = require("../strategies/retry-strategy");
const { wait, buildCallbackPayload } = require("../utils/helpers");

const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_MAX_RETRIES = 3;

class RequestProcessor {
  async process(message) {
    const {
      id: jobId,
      targetUrl,
      method = "GET",
      headers = {},
      payload,
      callbackUrl,
      maxRetries = DEFAULT_MAX_RETRIES,
      retryDelay = DEFAULT_RETRY_DELAY,
    } = message;

    await redisService.ensureJobExists(jobId, {
      status: "in_progress",
      attempts: 0,
    });

    const result = await this.executeWithRetries({
      jobId,
      targetUrl,
      method,
      headers,
      payload,
      maxRetries,
      retryDelay,
    });

    await this.finalizeJob(jobId, result, callbackUrl);

    return result;
  }

  async executeWithRetries(request) {
    const {
      jobId,
      targetUrl,
      method,
      headers,
      payload,
      maxRetries,
      retryDelay,
    } = request;
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
          await this.handleRetryableError(
            jobId,
            attempts,
            maxRetries,
            statusCode,
            retryDelay,
            attemptAt
          );
          continue;
        }

        success = httpRequestService.isSuccess(statusCode);
        if (!success) {
          errorMessage = `Request completed with non-success status ${statusCode}`;
        }

        await this.logAttemptResult(
          jobId,
          attempts,
          statusCode,
          success,
          errorMessage,
          responseData,
          attemptAt
        );
        break;
      } catch (error) {
        const shouldRetry =
          httpRequestService.shouldRetryBasedOnError(error) &&
          attempts < maxRetries;

        if (shouldRetry) {
          await this.handleRetryableError(
            jobId,
            attempts,
            maxRetries,
            error.response?.status,
            retryDelay,
            attemptAt,
            error.message
          );
          continue;
        }

        statusCode = error.response ? error.response.status : null;
        errorMessage = error.message;
        await this.logAttemptResult(
          jobId,
          attempts,
          statusCode,
          false,
          errorMessage,
          null,
          attemptAt
        );
        break;
      }
    }

    return { attempts, success, statusCode, responseData, errorMessage };
  }

  async handleRetryableError(
    jobId,
    attempts,
    maxRetries,
    statusCode,
    retryDelay,
    timestamp,
    errorMessage = null
  ) {
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

  async logAttemptResult(
    jobId,
    attempts,
    statusCode,
    success,
    errorMessage,
    responseData,
    timestamp
  ) {
    await redisService.logAttempt(jobId, {
      attempt: attempts,
      statusCode,
      success,
      error: success ? undefined : errorMessage,
      response: success ? responseData : undefined,
      timestamp,
    });
  }

  async finalizeJob(jobId, result, callbackUrl) {
    const { success, errorMessage, responseData } = result;
    const finalStatus = success ? "completed" : "failed";

    await redisService.updateJobStatus(jobId, finalStatus, {
      error: success ? undefined : errorMessage,
      lastResponse: success ? JSON.stringify(responseData) : undefined,
    });

    if (callbackUrl) {
      const callbackPayload = buildCallbackPayload({ id: jobId }, result);
      await callbackService.sendCallback(
        jobId,
        callbackUrl,
        callbackPayload,
        finalStatus
      );
    }
  }
}

module.exports = new RequestProcessor();
