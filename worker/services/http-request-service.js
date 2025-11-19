const axios = require("axios");
const RetryStrategy = require("../strategies/retry-strategy");

class HttpRequestService {
  constructor({ httpClient = axios, baseConfig = {} } = {}) {
    this.httpClient = httpClient;
    this.baseConfig = {
      validateStatus: () => true,
      ...baseConfig,
    };
    this.decorators = [];
  }

  registerDecorator(decorator) {
    if (typeof decorator === "function") {
      this.decorators.push(decorator);
    }
  }

  buildRequestConfig({ url, method, headers, payload }) {
    let config = {
      url,
      method,
      headers,
      data: payload,
      ...this.baseConfig,
    };

    this.decorators.forEach((decorate) => {
      // Decorators allow auth, tracing, or transport tweaks without editing this class.
      config = decorate(config) || config;
    });

    return config;
  }

  async executeRequest(url, method, headers, payload) {
    const requestConfig = this.buildRequestConfig({
      url,
      method,
      headers,
      payload,
    });
    return this.httpClient(requestConfig);
  }

  shouldRetryBasedOnError(error) {
    const statusCode = error.response ? error.response.status : null;
    return statusCode ? RetryStrategy.shouldRetry(statusCode) : false;
  }

  isSuccess(statusCode) {
    return statusCode >= 200 && statusCode < 300;
  }
}

const defaultHttpRequestService = new HttpRequestService();

module.exports = defaultHttpRequestService;
module.exports.HttpRequestService = HttpRequestService;
module.exports.createHttpRequestService = (options) =>
  new HttpRequestService(options);
