const redisService = require("../services/redis-service");
const jobExecutor = require("../services/job-executor");
const jobFinalizer = require("../services/job-finalizer");

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

    const result = await jobExecutor.execute({
      jobId,
      targetUrl,
      method,
      headers,
      payload,
      maxRetries,
      retryDelay,
    });

    await jobFinalizer.finalize(jobId, result, callbackUrl);

    return result;
  }
}

module.exports = new RequestProcessor();
