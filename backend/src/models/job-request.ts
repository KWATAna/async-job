import Joi from "joi";
import { v4 as uuidv4 } from "uuid";
import { allowedHttpMethods, defaultHttpMethod } from "../config/http-config";

export interface IJobRequest {
  id: string;
  targetUrl: string;
  method: string;
  headers: Record<string, string>;
  payload: any;
  callbackUrl: string;
  maxRetries: number;
  retryDelay: number;
  createdAt: Date;
}

export interface JobRequestData {
  targetUrl: string;
  method?: string;
  headers?: Record<string, string>;
  payload?: any;
  callbackUrl: string;
  maxRetries?: number;
  retryDelay?: number;
}

class JobRequest implements IJobRequest {
  id: string;
  targetUrl: string;
  method: string;
  headers: Record<string, string>;
  payload: any;
  callbackUrl: string;
  maxRetries: number;
  retryDelay: number;
  createdAt: Date;

  constructor({
    targetUrl,
    method = "GET",
    headers = {},
    payload = null,
    callbackUrl,
    maxRetries = 3,
    retryDelay = 1000,
  }: JobRequestData) {
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
      method: Joi.string()
        .valid(...allowedHttpMethods)
        .default(defaultHttpMethod),
      headers: Joi.object().default({}),
      payload: Joi.alternatives().try(Joi.object()).allow(null).default(null),
      callbackUrl: Joi.string().uri().required(),
      maxRetries: Joi.number().integer().min(0).max(10).default(3),
      retryDelay: Joi.number().integer().min(100).max(30000).default(1000),
    });
  }
}

export default JobRequest;
