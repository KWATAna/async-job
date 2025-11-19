const redisService = require("./redis-service");
const callbackService = require("./callback-service");
const { buildCallbackPayload } = require("../utils/helpers");

class JobFinalizer {
  async finalize(jobId, result, callbackUrl) {
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

module.exports = new JobFinalizer();
