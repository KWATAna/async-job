const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildCallbackPayload = (message, result) => ({
  jobId: message.id,
  targetUrl: message.targetUrl,
  method: message.method,
  attempts: result.attempts,
  maxRetries: message.maxRetries,
  success: result.success,
  statusCode: result.statusCode,
  response: result.success ? result.responseData : undefined,
  error: result.success ? undefined : result.errorMessage,
  completedAt: new Date().toISOString(),
});

module.exports = {
  wait,
  buildCallbackPayload,
};
