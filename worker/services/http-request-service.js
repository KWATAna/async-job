const axios = require("axios");
const RetryStrategy = require("../strategies/retry-strategy");
const { wait } = require("../utils/helpers");

class HttpRequestService {
  constructor() {
    this.axiosConfig = {
      validateStatus: () => true,
    };
  }

  async executeRequest(url, method, headers, payload) {
    return await axios({
      url,
      method,
      headers,
      data: payload,
      ...this.axiosConfig,
    });
  }

  shouldRetryBasedOnError(error) {
    const statusCode = error.response ? error.response.status : null;
    return statusCode ? RetryStrategy.shouldRetry(statusCode) : false;
  }

  isSuccess(statusCode) {
    return statusCode >= 200 && statusCode < 300;
  }
}

module.exports = new HttpRequestService();
