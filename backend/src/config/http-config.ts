const DEFAULT_HTTP_METHODS = ["GET", "POST"];

const normalizeMethods = (methods: any) =>
  methods
    .map((method: string) => method.trim().toUpperCase())
    .filter((method: string) => method.length);

const allowedHttpMethods = process.env.ALLOWED_HTTP_METHODS
  ? normalizeMethods(process.env.ALLOWED_HTTP_METHODS.split(","))
  : DEFAULT_HTTP_METHODS;

const defaultHttpMethod = allowedHttpMethods[0] || "GET";

export { allowedHttpMethods, defaultHttpMethod };
