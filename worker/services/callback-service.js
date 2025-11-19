const axios = require("axios");
const redisService = require("./redis-service");

class CallbackService {
  constructor({ httpClient = axios, redisClient = redisService } = {}) {
    this.httpClient = httpClient;
    this.redisService = redisClient;
  }

  async sendCallback(jobId, callbackUrl, payload, finalStatus) {
    try {
      const response = await this.httpClient.post(callbackUrl, payload);
      await this.redisService.updateJobStatus(jobId, finalStatus, {
        callbackStatus: "sent",
        callbackStatusCode: response.status,
        callbackError: null,
      });
      console.log(`Sent callback to ${callbackUrl}`);
      return { success: true, status: response.status };
    } catch (error) {
      await this.redisService.updateJobStatus(jobId, finalStatus, {
        callbackStatus: "failed",
        callbackError: error.message,
        callbackStatusCode: error.response ? error.response.status : null,
      });
      console.error(`Failed to send callback to ${callbackUrl}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

const defaultCallbackService = new CallbackService();

module.exports = defaultCallbackService;
module.exports.CallbackService = CallbackService;
module.exports.createCallbackService = (options) =>
  new CallbackService(options);
