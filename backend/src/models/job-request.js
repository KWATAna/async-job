const Joi = require("joi");
const { v4: uuidv4 } = require("uuid");

class JobRequest {
  constructor({
    targetUrl,
    method = "GET",
    headers = {},
    payload = null,
    callbackUrl,
    maxRetries = 3,
    retryDelay = 1000,
  }) {
    this.id = uuidv4();
    this.targetUrl = targetUrl;
    this.method = method;
    this.headers = headers;
    this.payload = payload;
    this.callbackUrl = callbackUrl;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    this.createdAt = new Date();
  }

  static validationSchema() {
    return Joi.object({
      targetUrl: Joi.string().uri().required(),
      method: Joi.string().valid("GET", "POST").default("GET"),
      headers: Joi.object().default({}),
      payload: Joi.alternatives().try(Joi.object()).allow(null).default(null),
      callbackUrl: Joi.string().uri().required(),
      maxRetries: Joi.number().integer().min(0).max(10).default(3),
      retryDelay: Joi.number().integer().min(100).max(30000).default(1000),
    });
  }
}

module.exports = JobRequest;
