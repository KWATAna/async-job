const DEFAULT_HTTP_METHODS = ["GET", "POST"];

const normalizeMethods = (methods) =>
  methods
    .map((method) => method.trim().toUpperCase())
    .filter((method) => method.length);

const allowedHttpMethods = process.env.ALLOWED_HTTP_METHODS
  ? normalizeMethods(process.env.ALLOWED_HTTP_METHODS.split(","))
  : DEFAULT_HTTP_METHODS;

const defaultHttpMethod = allowedHttpMethods[0] || "GET";

// Allowing methods via env config means new verbs can be introduced without touching code.
module.exports = {
  allowedHttpMethods,
  defaultHttpMethod,
};
