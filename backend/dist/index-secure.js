var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// (disabled):crypto
var require_crypto = __commonJS({
  "(disabled):crypto"() {
  }
});

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = /* @__PURE__ */ __name((children) => {
  for (const _ in children) {
    return true;
  }
  return false;
}, "hasChildren");
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const defaults = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: []
  };
  const opts = {
    ...defaults,
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        if (opts.credentials) {
          return (origin) => origin || null;
        }
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*" || opts.credentials) {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*" || opts.credentials) {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// node_modules/hono/dist/utils/color.js
function getColorEnabled() {
  const { process, Deno } = globalThis;
  const isNoColor = typeof Deno?.noColor === "boolean" ? Deno.noColor : process !== void 0 ? (
    // eslint-disable-next-line no-unsafe-optional-chaining
    "NO_COLOR" in process?.env
  ) : false;
  return !isNoColor;
}
__name(getColorEnabled, "getColorEnabled");
async function getColorEnabledAsync() {
  const { navigator } = globalThis;
  const cfWorkers = "cloudflare:workers";
  const isNoColor = navigator !== void 0 && navigator.userAgent === "Cloudflare-Workers" ? await (async () => {
    try {
      return "NO_COLOR" in ((await import(cfWorkers)).env ?? {});
    } catch {
      return false;
    }
  })() : !getColorEnabled();
  return !isNoColor;
}
__name(getColorEnabledAsync, "getColorEnabledAsync");

// node_modules/hono/dist/middleware/logger/index.js
var humanize = /* @__PURE__ */ __name((times) => {
  const [delimiter, separator] = [",", "."];
  const orderTimes = times.map((v) => v.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1" + delimiter));
  return orderTimes.join(separator);
}, "humanize");
var time = /* @__PURE__ */ __name((start) => {
  const delta = Date.now() - start;
  return humanize([delta < 1e3 ? delta + "ms" : Math.round(delta / 1e3) + "s"]);
}, "time");
var colorStatus = /* @__PURE__ */ __name(async (status) => {
  const colorEnabled = await getColorEnabledAsync();
  if (colorEnabled) {
    switch (status / 100 | 0) {
      case 5:
        return `\x1B[31m${status}\x1B[0m`;
      case 4:
        return `\x1B[33m${status}\x1B[0m`;
      case 3:
        return `\x1B[36m${status}\x1B[0m`;
      case 2:
        return `\x1B[32m${status}\x1B[0m`;
    }
  }
  return `${status}`;
}, "colorStatus");
async function log(fn, prefix, method, path, status = 0, elapsed) {
  const out = prefix === "<--" ? `${prefix} ${method} ${path}` : `${prefix} ${method} ${path} ${await colorStatus(status)} ${elapsed}`;
  fn(out);
}
__name(log, "log");
var logger = /* @__PURE__ */ __name((fn = console.log) => {
  return /* @__PURE__ */ __name(async function logger2(c, next) {
    const { method, url } = c.req;
    const path = url.slice(url.indexOf("/", 8));
    await log(fn, "<--", method, path);
    const start = Date.now();
    await next();
    await log(fn, "-->", method, path, c.res.status, time(start));
  }, "logger2");
}, "logger");

// node_modules/bcryptjs/index.js
var import_crypto = __toESM(require_crypto(), 1);
var randomFallback = null;
function randomBytes(len) {
  try {
    return crypto.getRandomValues(new Uint8Array(len));
  } catch {
  }
  try {
    return import_crypto.default.randomBytes(len);
  } catch {
  }
  if (!randomFallback) {
    throw Error(
      "Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative"
    );
  }
  return randomFallback(len);
}
__name(randomBytes, "randomBytes");
function genSaltSync(rounds, seed_length) {
  rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof rounds !== "number")
    throw Error(
      "Illegal arguments: " + typeof rounds + ", " + typeof seed_length
    );
  if (rounds < 4) rounds = 4;
  else if (rounds > 31) rounds = 31;
  var salt = [];
  salt.push("$2b$");
  if (rounds < 10) salt.push("0");
  salt.push(rounds.toString());
  salt.push("$");
  salt.push(base64_encode(randomBytes(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
  return salt.join("");
}
__name(genSaltSync, "genSaltSync");
function genSalt(rounds, seed_length, callback) {
  if (typeof seed_length === "function")
    callback = seed_length, seed_length = void 0;
  if (typeof rounds === "function") callback = rounds, rounds = void 0;
  if (typeof rounds === "undefined") rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
  else if (typeof rounds !== "number")
    throw Error("illegal arguments: " + typeof rounds);
  function _async(callback2) {
    nextTick(function() {
      try {
        callback2(null, genSaltSync(rounds));
      } catch (err) {
        callback2(err);
      }
    });
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(genSalt, "genSalt");
function hash(password, salt, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password === "string" && typeof salt === "number")
      genSalt(salt, function(err, salt2) {
        _hash(password, salt2, callback2, progressCallback);
      });
    else if (typeof password === "string" && typeof salt === "string")
      _hash(password, salt, callback2, progressCallback);
    else
      nextTick(
        callback2.bind(
          this,
          Error("Illegal arguments: " + typeof password + ", " + typeof salt)
        )
      );
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(hash, "hash");
function safeStringCompare(known, unknown) {
  var diff = known.length ^ unknown.length;
  for (var i = 0; i < known.length; ++i) {
    diff |= known.charCodeAt(i) ^ unknown.charCodeAt(i);
  }
  return diff === 0;
}
__name(safeStringCompare, "safeStringCompare");
function compare(password, hashValue, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password !== "string" || typeof hashValue !== "string") {
      nextTick(
        callback2.bind(
          this,
          Error(
            "Illegal arguments: " + typeof password + ", " + typeof hashValue
          )
        )
      );
      return;
    }
    if (hashValue.length !== 60) {
      nextTick(callback2.bind(this, null, false));
      return;
    }
    hash(
      password,
      hashValue.substring(0, 29),
      function(err, comp) {
        if (err) callback2(err);
        else callback2(null, safeStringCompare(comp, hashValue));
      },
      progressCallback
    );
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(compare, "compare");
var nextTick = typeof setImmediate === "function" ? setImmediate : typeof scheduler === "object" && typeof scheduler.postTask === "function" ? scheduler.postTask.bind(scheduler) : setTimeout;
function utf8Length(string) {
  var len = 0, c = 0;
  for (var i = 0; i < string.length; ++i) {
    c = string.charCodeAt(i);
    if (c < 128) len += 1;
    else if (c < 2048) len += 2;
    else if ((c & 64512) === 55296 && (string.charCodeAt(i + 1) & 64512) === 56320) {
      ++i;
      len += 4;
    } else len += 3;
  }
  return len;
}
__name(utf8Length, "utf8Length");
function utf8Array(string) {
  var offset = 0, c1, c2;
  var buffer = new Array(utf8Length(string));
  for (var i = 0, k = string.length; i < k; ++i) {
    c1 = string.charCodeAt(i);
    if (c1 < 128) {
      buffer[offset++] = c1;
    } else if (c1 < 2048) {
      buffer[offset++] = c1 >> 6 | 192;
      buffer[offset++] = c1 & 63 | 128;
    } else if ((c1 & 64512) === 55296 && ((c2 = string.charCodeAt(i + 1)) & 64512) === 56320) {
      c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023);
      ++i;
      buffer[offset++] = c1 >> 18 | 240;
      buffer[offset++] = c1 >> 12 & 63 | 128;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    } else {
      buffer[offset++] = c1 >> 12 | 224;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    }
  }
  return buffer;
}
__name(utf8Array, "utf8Array");
var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
var BASE64_INDEX = [
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  0,
  1,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  -1,
  -1,
  -1,
  -1,
  -1
];
function base64_encode(b, len) {
  var off = 0, rs = [], c1, c2;
  if (len <= 0 || len > b.length) throw Error("Illegal len: " + len);
  while (off < len) {
    c1 = b[off++] & 255;
    rs.push(BASE64_CODE[c1 >> 2 & 63]);
    c1 = (c1 & 3) << 4;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 4 & 15;
    rs.push(BASE64_CODE[c1 & 63]);
    c1 = (c2 & 15) << 2;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 6 & 3;
    rs.push(BASE64_CODE[c1 & 63]);
    rs.push(BASE64_CODE[c2 & 63]);
  }
  return rs.join("");
}
__name(base64_encode, "base64_encode");
function base64_decode(s, len) {
  var off = 0, slen = s.length, olen = 0, rs = [], c1, c2, c3, c4, o, code;
  if (len <= 0) throw Error("Illegal len: " + len);
  while (off < slen - 1 && olen < len) {
    code = s.charCodeAt(off++);
    c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    code = s.charCodeAt(off++);
    c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c1 == -1 || c2 == -1) break;
    o = c1 << 2 >>> 0;
    o |= (c2 & 48) >> 4;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c3 == -1) break;
    o = (c2 & 15) << 4 >>> 0;
    o |= (c3 & 60) >> 2;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    o = (c3 & 3) << 6 >>> 0;
    o |= c4;
    rs.push(String.fromCharCode(o));
    ++olen;
  }
  var res = [];
  for (off = 0; off < olen; off++) res.push(rs[off].charCodeAt(0));
  return res;
}
__name(base64_decode, "base64_decode");
var BCRYPT_SALT_LEN = 16;
var GENSALT_DEFAULT_LOG2_ROUNDS = 10;
var BLOWFISH_NUM_ROUNDS = 16;
var MAX_EXECUTION_TIME = 100;
var P_ORIG = [
  608135816,
  2242054355,
  320440878,
  57701188,
  2752067618,
  698298832,
  137296536,
  3964562569,
  1160258022,
  953160567,
  3193202383,
  887688300,
  3232508343,
  3380367581,
  1065670069,
  3041331479,
  2450970073,
  2306472731
];
var S_ORIG = [
  3509652390,
  2564797868,
  805139163,
  3491422135,
  3101798381,
  1780907670,
  3128725573,
  4046225305,
  614570311,
  3012652279,
  134345442,
  2240740374,
  1667834072,
  1901547113,
  2757295779,
  4103290238,
  227898511,
  1921955416,
  1904987480,
  2182433518,
  2069144605,
  3260701109,
  2620446009,
  720527379,
  3318853667,
  677414384,
  3393288472,
  3101374703,
  2390351024,
  1614419982,
  1822297739,
  2954791486,
  3608508353,
  3174124327,
  2024746970,
  1432378464,
  3864339955,
  2857741204,
  1464375394,
  1676153920,
  1439316330,
  715854006,
  3033291828,
  289532110,
  2706671279,
  2087905683,
  3018724369,
  1668267050,
  732546397,
  1947742710,
  3462151702,
  2609353502,
  2950085171,
  1814351708,
  2050118529,
  680887927,
  999245976,
  1800124847,
  3300911131,
  1713906067,
  1641548236,
  4213287313,
  1216130144,
  1575780402,
  4018429277,
  3917837745,
  3693486850,
  3949271944,
  596196993,
  3549867205,
  258830323,
  2213823033,
  772490370,
  2760122372,
  1774776394,
  2652871518,
  566650946,
  4142492826,
  1728879713,
  2882767088,
  1783734482,
  3629395816,
  2517608232,
  2874225571,
  1861159788,
  326777828,
  3124490320,
  2130389656,
  2716951837,
  967770486,
  1724537150,
  2185432712,
  2364442137,
  1164943284,
  2105845187,
  998989502,
  3765401048,
  2244026483,
  1075463327,
  1455516326,
  1322494562,
  910128902,
  469688178,
  1117454909,
  936433444,
  3490320968,
  3675253459,
  1240580251,
  122909385,
  2157517691,
  634681816,
  4142456567,
  3825094682,
  3061402683,
  2540495037,
  79693498,
  3249098678,
  1084186820,
  1583128258,
  426386531,
  1761308591,
  1047286709,
  322548459,
  995290223,
  1845252383,
  2603652396,
  3431023940,
  2942221577,
  3202600964,
  3727903485,
  1712269319,
  422464435,
  3234572375,
  1170764815,
  3523960633,
  3117677531,
  1434042557,
  442511882,
  3600875718,
  1076654713,
  1738483198,
  4213154764,
  2393238008,
  3677496056,
  1014306527,
  4251020053,
  793779912,
  2902807211,
  842905082,
  4246964064,
  1395751752,
  1040244610,
  2656851899,
  3396308128,
  445077038,
  3742853595,
  3577915638,
  679411651,
  2892444358,
  2354009459,
  1767581616,
  3150600392,
  3791627101,
  3102740896,
  284835224,
  4246832056,
  1258075500,
  768725851,
  2589189241,
  3069724005,
  3532540348,
  1274779536,
  3789419226,
  2764799539,
  1660621633,
  3471099624,
  4011903706,
  913787905,
  3497959166,
  737222580,
  2514213453,
  2928710040,
  3937242737,
  1804850592,
  3499020752,
  2949064160,
  2386320175,
  2390070455,
  2415321851,
  4061277028,
  2290661394,
  2416832540,
  1336762016,
  1754252060,
  3520065937,
  3014181293,
  791618072,
  3188594551,
  3933548030,
  2332172193,
  3852520463,
  3043980520,
  413987798,
  3465142937,
  3030929376,
  4245938359,
  2093235073,
  3534596313,
  375366246,
  2157278981,
  2479649556,
  555357303,
  3870105701,
  2008414854,
  3344188149,
  4221384143,
  3956125452,
  2067696032,
  3594591187,
  2921233993,
  2428461,
  544322398,
  577241275,
  1471733935,
  610547355,
  4027169054,
  1432588573,
  1507829418,
  2025931657,
  3646575487,
  545086370,
  48609733,
  2200306550,
  1653985193,
  298326376,
  1316178497,
  3007786442,
  2064951626,
  458293330,
  2589141269,
  3591329599,
  3164325604,
  727753846,
  2179363840,
  146436021,
  1461446943,
  4069977195,
  705550613,
  3059967265,
  3887724982,
  4281599278,
  3313849956,
  1404054877,
  2845806497,
  146425753,
  1854211946,
  1266315497,
  3048417604,
  3681880366,
  3289982499,
  290971e4,
  1235738493,
  2632868024,
  2414719590,
  3970600049,
  1771706367,
  1449415276,
  3266420449,
  422970021,
  1963543593,
  2690192192,
  3826793022,
  1062508698,
  1531092325,
  1804592342,
  2583117782,
  2714934279,
  4024971509,
  1294809318,
  4028980673,
  1289560198,
  2221992742,
  1669523910,
  35572830,
  157838143,
  1052438473,
  1016535060,
  1802137761,
  1753167236,
  1386275462,
  3080475397,
  2857371447,
  1040679964,
  2145300060,
  2390574316,
  1461121720,
  2956646967,
  4031777805,
  4028374788,
  33600511,
  2920084762,
  1018524850,
  629373528,
  3691585981,
  3515945977,
  2091462646,
  2486323059,
  586499841,
  988145025,
  935516892,
  3367335476,
  2599673255,
  2839830854,
  265290510,
  3972581182,
  2759138881,
  3795373465,
  1005194799,
  847297441,
  406762289,
  1314163512,
  1332590856,
  1866599683,
  4127851711,
  750260880,
  613907577,
  1450815602,
  3165620655,
  3734664991,
  3650291728,
  3012275730,
  3704569646,
  1427272223,
  778793252,
  1343938022,
  2676280711,
  2052605720,
  1946737175,
  3164576444,
  3914038668,
  3967478842,
  3682934266,
  1661551462,
  3294938066,
  4011595847,
  840292616,
  3712170807,
  616741398,
  312560963,
  711312465,
  1351876610,
  322626781,
  1910503582,
  271666773,
  2175563734,
  1594956187,
  70604529,
  3617834859,
  1007753275,
  1495573769,
  4069517037,
  2549218298,
  2663038764,
  504708206,
  2263041392,
  3941167025,
  2249088522,
  1514023603,
  1998579484,
  1312622330,
  694541497,
  2582060303,
  2151582166,
  1382467621,
  776784248,
  2618340202,
  3323268794,
  2497899128,
  2784771155,
  503983604,
  4076293799,
  907881277,
  423175695,
  432175456,
  1378068232,
  4145222326,
  3954048622,
  3938656102,
  3820766613,
  2793130115,
  2977904593,
  26017576,
  3274890735,
  3194772133,
  1700274565,
  1756076034,
  4006520079,
  3677328699,
  720338349,
  1533947780,
  354530856,
  688349552,
  3973924725,
  1637815568,
  332179504,
  3949051286,
  53804574,
  2852348879,
  3044236432,
  1282449977,
  3583942155,
  3416972820,
  4006381244,
  1617046695,
  2628476075,
  3002303598,
  1686838959,
  431878346,
  2686675385,
  1700445008,
  1080580658,
  1009431731,
  832498133,
  3223435511,
  2605976345,
  2271191193,
  2516031870,
  1648197032,
  4164389018,
  2548247927,
  300782431,
  375919233,
  238389289,
  3353747414,
  2531188641,
  2019080857,
  1475708069,
  455242339,
  2609103871,
  448939670,
  3451063019,
  1395535956,
  2413381860,
  1841049896,
  1491858159,
  885456874,
  4264095073,
  4001119347,
  1565136089,
  3898914787,
  1108368660,
  540939232,
  1173283510,
  2745871338,
  3681308437,
  4207628240,
  3343053890,
  4016749493,
  1699691293,
  1103962373,
  3625875870,
  2256883143,
  3830138730,
  1031889488,
  3479347698,
  1535977030,
  4236805024,
  3251091107,
  2132092099,
  1774941330,
  1199868427,
  1452454533,
  157007616,
  2904115357,
  342012276,
  595725824,
  1480756522,
  206960106,
  497939518,
  591360097,
  863170706,
  2375253569,
  3596610801,
  1814182875,
  2094937945,
  3421402208,
  1082520231,
  3463918190,
  2785509508,
  435703966,
  3908032597,
  1641649973,
  2842273706,
  3305899714,
  1510255612,
  2148256476,
  2655287854,
  3276092548,
  4258621189,
  236887753,
  3681803219,
  274041037,
  1734335097,
  3815195456,
  3317970021,
  1899903192,
  1026095262,
  4050517792,
  356393447,
  2410691914,
  3873677099,
  3682840055,
  3913112168,
  2491498743,
  4132185628,
  2489919796,
  1091903735,
  1979897079,
  3170134830,
  3567386728,
  3557303409,
  857797738,
  1136121015,
  1342202287,
  507115054,
  2535736646,
  337727348,
  3213592640,
  1301675037,
  2528481711,
  1895095763,
  1721773893,
  3216771564,
  62756741,
  2142006736,
  835421444,
  2531993523,
  1442658625,
  3659876326,
  2882144922,
  676362277,
  1392781812,
  170690266,
  3921047035,
  1759253602,
  3611846912,
  1745797284,
  664899054,
  1329594018,
  3901205900,
  3045908486,
  2062866102,
  2865634940,
  3543621612,
  3464012697,
  1080764994,
  553557557,
  3656615353,
  3996768171,
  991055499,
  499776247,
  1265440854,
  648242737,
  3940784050,
  980351604,
  3713745714,
  1749149687,
  3396870395,
  4211799374,
  3640570775,
  1161844396,
  3125318951,
  1431517754,
  545492359,
  4268468663,
  3499529547,
  1437099964,
  2702547544,
  3433638243,
  2581715763,
  2787789398,
  1060185593,
  1593081372,
  2418618748,
  4260947970,
  69676912,
  2159744348,
  86519011,
  2512459080,
  3838209314,
  1220612927,
  3339683548,
  133810670,
  1090789135,
  1078426020,
  1569222167,
  845107691,
  3583754449,
  4072456591,
  1091646820,
  628848692,
  1613405280,
  3757631651,
  526609435,
  236106946,
  48312990,
  2942717905,
  3402727701,
  1797494240,
  859738849,
  992217954,
  4005476642,
  2243076622,
  3870952857,
  3732016268,
  765654824,
  3490871365,
  2511836413,
  1685915746,
  3888969200,
  1414112111,
  2273134842,
  3281911079,
  4080962846,
  172450625,
  2569994100,
  980381355,
  4109958455,
  2819808352,
  2716589560,
  2568741196,
  3681446669,
  3329971472,
  1835478071,
  660984891,
  3704678404,
  4045999559,
  3422617507,
  3040415634,
  1762651403,
  1719377915,
  3470491036,
  2693910283,
  3642056355,
  3138596744,
  1364962596,
  2073328063,
  1983633131,
  926494387,
  3423689081,
  2150032023,
  4096667949,
  1749200295,
  3328846651,
  309677260,
  2016342300,
  1779581495,
  3079819751,
  111262694,
  1274766160,
  443224088,
  298511866,
  1025883608,
  3806446537,
  1145181785,
  168956806,
  3641502830,
  3584813610,
  1689216846,
  3666258015,
  3200248200,
  1692713982,
  2646376535,
  4042768518,
  1618508792,
  1610833997,
  3523052358,
  4130873264,
  2001055236,
  3610705100,
  2202168115,
  4028541809,
  2961195399,
  1006657119,
  2006996926,
  3186142756,
  1430667929,
  3210227297,
  1314452623,
  4074634658,
  4101304120,
  2273951170,
  1399257539,
  3367210612,
  3027628629,
  1190975929,
  2062231137,
  2333990788,
  2221543033,
  2438960610,
  1181637006,
  548689776,
  2362791313,
  3372408396,
  3104550113,
  3145860560,
  296247880,
  1970579870,
  3078560182,
  3769228297,
  1714227617,
  3291629107,
  3898220290,
  166772364,
  1251581989,
  493813264,
  448347421,
  195405023,
  2709975567,
  677966185,
  3703036547,
  1463355134,
  2715995803,
  1338867538,
  1343315457,
  2802222074,
  2684532164,
  233230375,
  2599980071,
  2000651841,
  3277868038,
  1638401717,
  4028070440,
  3237316320,
  6314154,
  819756386,
  300326615,
  590932579,
  1405279636,
  3267499572,
  3150704214,
  2428286686,
  3959192993,
  3461946742,
  1862657033,
  1266418056,
  963775037,
  2089974820,
  2263052895,
  1917689273,
  448879540,
  3550394620,
  3981727096,
  150775221,
  3627908307,
  1303187396,
  508620638,
  2975983352,
  2726630617,
  1817252668,
  1876281319,
  1457606340,
  908771278,
  3720792119,
  3617206836,
  2455994898,
  1729034894,
  1080033504,
  976866871,
  3556439503,
  2881648439,
  1522871579,
  1555064734,
  1336096578,
  3548522304,
  2579274686,
  3574697629,
  3205460757,
  3593280638,
  3338716283,
  3079412587,
  564236357,
  2993598910,
  1781952180,
  1464380207,
  3163844217,
  3332601554,
  1699332808,
  1393555694,
  1183702653,
  3581086237,
  1288719814,
  691649499,
  2847557200,
  2895455976,
  3193889540,
  2717570544,
  1781354906,
  1676643554,
  2592534050,
  3230253752,
  1126444790,
  2770207658,
  2633158820,
  2210423226,
  2615765581,
  2414155088,
  3127139286,
  673620729,
  2805611233,
  1269405062,
  4015350505,
  3341807571,
  4149409754,
  1057255273,
  2012875353,
  2162469141,
  2276492801,
  2601117357,
  993977747,
  3918593370,
  2654263191,
  753973209,
  36408145,
  2530585658,
  25011837,
  3520020182,
  2088578344,
  530523599,
  2918365339,
  1524020338,
  1518925132,
  3760827505,
  3759777254,
  1202760957,
  3985898139,
  3906192525,
  674977740,
  4174734889,
  2031300136,
  2019492241,
  3983892565,
  4153806404,
  3822280332,
  352677332,
  2297720250,
  60907813,
  90501309,
  3286998549,
  1016092578,
  2535922412,
  2839152426,
  457141659,
  509813237,
  4120667899,
  652014361,
  1966332200,
  2975202805,
  55981186,
  2327461051,
  676427537,
  3255491064,
  2882294119,
  3433927263,
  1307055953,
  942726286,
  933058658,
  2468411793,
  3933900994,
  4215176142,
  1361170020,
  2001714738,
  2830558078,
  3274259782,
  1222529897,
  1679025792,
  2729314320,
  3714953764,
  1770335741,
  151462246,
  3013232138,
  1682292957,
  1483529935,
  471910574,
  1539241949,
  458788160,
  3436315007,
  1807016891,
  3718408830,
  978976581,
  1043663428,
  3165965781,
  1927990952,
  4200891579,
  2372276910,
  3208408903,
  3533431907,
  1412390302,
  2931980059,
  4132332400,
  1947078029,
  3881505623,
  4168226417,
  2941484381,
  1077988104,
  1320477388,
  886195818,
  18198404,
  3786409e3,
  2509781533,
  112762804,
  3463356488,
  1866414978,
  891333506,
  18488651,
  661792760,
  1628790961,
  3885187036,
  3141171499,
  876946877,
  2693282273,
  1372485963,
  791857591,
  2686433993,
  3759982718,
  3167212022,
  3472953795,
  2716379847,
  445679433,
  3561995674,
  3504004811,
  3574258232,
  54117162,
  3331405415,
  2381918588,
  3769707343,
  4154350007,
  1140177722,
  4074052095,
  668550556,
  3214352940,
  367459370,
  261225585,
  2610173221,
  4209349473,
  3468074219,
  3265815641,
  314222801,
  3066103646,
  3808782860,
  282218597,
  3406013506,
  3773591054,
  379116347,
  1285071038,
  846784868,
  2669647154,
  3771962079,
  3550491691,
  2305946142,
  453669953,
  1268987020,
  3317592352,
  3279303384,
  3744833421,
  2610507566,
  3859509063,
  266596637,
  3847019092,
  517658769,
  3462560207,
  3443424879,
  370717030,
  4247526661,
  2224018117,
  4143653529,
  4112773975,
  2788324899,
  2477274417,
  1456262402,
  2901442914,
  1517677493,
  1846949527,
  2295493580,
  3734397586,
  2176403920,
  1280348187,
  1908823572,
  3871786941,
  846861322,
  1172426758,
  3287448474,
  3383383037,
  1655181056,
  3139813346,
  901632758,
  1897031941,
  2986607138,
  3066810236,
  3447102507,
  1393639104,
  373351379,
  950779232,
  625454576,
  3124240540,
  4148612726,
  2007998917,
  544563296,
  2244738638,
  2330496472,
  2058025392,
  1291430526,
  424198748,
  50039436,
  29584100,
  3605783033,
  2429876329,
  2791104160,
  1057563949,
  3255363231,
  3075367218,
  3463963227,
  1469046755,
  985887462
];
var C_ORIG = [
  1332899944,
  1700884034,
  1701343084,
  1684370003,
  1668446532,
  1869963892
];
function _encipher(lr, off, P, S) {
  var n, l = lr[off], r = lr[off + 1];
  l ^= P[0];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[1];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[2];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[3];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[4];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[5];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[6];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[7];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[8];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[9];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[10];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[11];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[12];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[13];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[14];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[15];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[16];
  lr[off] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
  lr[off + 1] = l;
  return lr;
}
__name(_encipher, "_encipher");
function _streamtoword(data, offp) {
  for (var i = 0, word = 0; i < 4; ++i)
    word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
  return { key: word, offp };
}
__name(_streamtoword, "_streamtoword");
function _key(key, P, S) {
  var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offset), offset = sw.offp, P[i] = P[i] ^ sw.key;
  for (i = 0; i < plen; i += 2)
    lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
__name(_key, "_key");
function _ekskey(data, key, P, S) {
  var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offp), offp = sw.offp, P[i] = P[i] ^ sw.key;
  offp = 0;
  for (i = 0; i < plen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
__name(_ekskey, "_ekskey");
function _crypt(b, salt, rounds, callback, progressCallback) {
  var cdata = C_ORIG.slice(), clen = cdata.length, err;
  if (rounds < 4 || rounds > 31) {
    err = Error("Illegal number of rounds (4-31): " + rounds);
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.length !== BCRYPT_SALT_LEN) {
    err = Error(
      "Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN
    );
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  rounds = 1 << rounds >>> 0;
  var P, S, i = 0, j;
  if (typeof Int32Array === "function") {
    P = new Int32Array(P_ORIG);
    S = new Int32Array(S_ORIG);
  } else {
    P = P_ORIG.slice();
    S = S_ORIG.slice();
  }
  _ekskey(salt, b, P, S);
  function next() {
    if (progressCallback) progressCallback(i / rounds);
    if (i < rounds) {
      var start = Date.now();
      for (; i < rounds; ) {
        i = i + 1;
        _key(b, P, S);
        _key(salt, P, S);
        if (Date.now() - start > MAX_EXECUTION_TIME) break;
      }
    } else {
      for (i = 0; i < 64; i++)
        for (j = 0; j < clen >> 1; j++) _encipher(cdata, j << 1, P, S);
      var ret = [];
      for (i = 0; i < clen; i++)
        ret.push((cdata[i] >> 24 & 255) >>> 0), ret.push((cdata[i] >> 16 & 255) >>> 0), ret.push((cdata[i] >> 8 & 255) >>> 0), ret.push((cdata[i] & 255) >>> 0);
      if (callback) {
        callback(null, ret);
        return;
      } else return ret;
    }
    if (callback) nextTick(next);
  }
  __name(next, "next");
  if (typeof callback !== "undefined") {
    next();
  } else {
    var res;
    while (true) if (typeof (res = next()) !== "undefined") return res || [];
  }
}
__name(_crypt, "_crypt");
function _hash(password, salt, callback, progressCallback) {
  var err;
  if (typeof password !== "string" || typeof salt !== "string") {
    err = Error("Invalid string / salt: Not a string");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var minor, offset;
  if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
    err = Error("Invalid salt version: " + salt.substring(0, 2));
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.charAt(2) === "$") minor = String.fromCharCode(0), offset = 3;
  else {
    minor = salt.charAt(2);
    if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
      err = Error("Invalid salt revision: " + salt.substring(2, 4));
      if (callback) {
        nextTick(callback.bind(this, err));
        return;
      } else throw err;
    }
    offset = 4;
  }
  if (salt.charAt(offset + 2) > "$") {
    err = Error("Missing salt rounds");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10, r2 = parseInt(salt.substring(offset + 1, offset + 2), 10), rounds = r1 + r2, real_salt = salt.substring(offset + 3, offset + 25);
  password += minor >= "a" ? "\0" : "";
  var passwordb = utf8Array(password), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
  function finish(bytes) {
    var res = [];
    res.push("$2");
    if (minor >= "a") res.push(minor);
    res.push("$");
    if (rounds < 10) res.push("0");
    res.push(rounds.toString());
    res.push("$");
    res.push(base64_encode(saltb, saltb.length));
    res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
    return res.join("");
  }
  __name(finish, "finish");
  if (typeof callback == "undefined")
    return finish(_crypt(passwordb, saltb, rounds));
  else {
    _crypt(
      passwordb,
      saltb,
      rounds,
      function(err2, bytes) {
        if (err2) callback(err2, null);
        else callback(null, finish(bytes));
      },
      progressCallback
    );
  }
}
__name(_hash, "_hash");

// src/auth.ts
var JWT_SECRET = "frame-videos-secret-key-change-in-production-12345";
function base64UrlEncode(data) {
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlDecode(data) {
  const padded = data + "=".repeat((4 - data.length % 4) % 4);
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}
__name(base64UrlDecode, "base64UrlDecode");
async function signToken(payload) {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const message = `${headerEncoded}.${payloadEncoded}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureEncoded = base64UrlEncode(
    String.fromCharCode(...signatureArray)
  );
  return `${message}.${signatureEncoded}`;
}
__name(signToken, "signToken");
async function verifyTokenSignature(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  const message = `${headerEncoded}.${payloadEncoded}`;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signatureBytes = new Uint8Array(
      base64UrlDecode(signatureEncoded).split("").map((c) => c.charCodeAt(0))
    );
    return await crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(message));
  } catch (error) {
    return false;
  }
}
__name(verifyTokenSignature, "verifyTokenSignature");
async function generateToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role || "user",
    tenantId: user.tenantId,
    isSuperAdmin: user.role === "super_admin",
    iat: Math.floor(Date.now() / 1e3),
    exp: Math.floor(Date.now() / 1e3) + 7 * 24 * 60 * 60
    // 7 days
  };
  return signToken(payload);
}
__name(generateToken, "generateToken");
async function verifyToken(token) {
  try {
    const isValid = await verifyTokenSignature(token);
    if (!isValid) return null;
    const parts = token.split(".");
    const payloadEncoded = parts[1];
    const payloadJson = base64UrlDecode(payloadEncoded);
    const payload = JSON.parse(payloadJson);
    if (payload.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}
__name(verifyToken, "verifyToken");
function extractToken(authHeader) {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}
__name(extractToken, "extractToken");
async function hashPassword(password) {
  const saltRounds = 10;
  return hash(password, saltRounds);
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, hash2) {
  return compare(password, hash2);
}
__name(verifyPassword, "verifyPassword");
function validatePasswordStrength(password) {
  const errors = [];
  let strength = "weak";
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const criteriaCount = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;
  if (criteriaCount >= 5 && password.length >= 12) {
    strength = "strong";
  } else if (criteriaCount >= 4) {
    strength = "medium";
  }
  return {
    valid: errors.length === 0,
    errors,
    strength
  };
}
__name(validatePasswordStrength, "validatePasswordStrength");

// src/error-handler.ts
var FrameVideosError = class extends Error {
  constructor(code, statusCode, message, details, category) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.category = category;
    this.name = "FrameVideosError";
  }
  static {
    __name(this, "FrameVideosError");
  }
};
var ValidationError = class extends FrameVideosError {
  static {
    __name(this, "ValidationError");
  }
  constructor(message, details) {
    super("INVALID_INPUT" /* INVALID_INPUT */, 400, message, details, "VALIDATION" /* VALIDATION */);
    this.name = "ValidationError";
  }
};
var AuthenticationError = class extends FrameVideosError {
  static {
    __name(this, "AuthenticationError");
  }
  constructor(message, details) {
    super("UNAUTHORIZED" /* UNAUTHORIZED */, 401, message, details, "AUTHENTICATION" /* AUTHENTICATION */);
    this.name = "AuthenticationError";
  }
};
var AuthorizationError = class extends FrameVideosError {
  static {
    __name(this, "AuthorizationError");
  }
  constructor(message, details) {
    super("FORBIDDEN" /* FORBIDDEN */, 403, message, details, "AUTHORIZATION" /* AUTHORIZATION */);
    this.name = "AuthorizationError";
  }
};
var NotFoundError = class extends FrameVideosError {
  static {
    __name(this, "NotFoundError");
  }
  constructor(resource, id) {
    const message = id ? `${resource} ${id} not found` : `${resource} not found`;
    super("NOT_FOUND" /* NOT_FOUND */, 404, message, void 0, "NOT_FOUND" /* NOT_FOUND */);
    this.name = "NotFoundError";
  }
};
var ConflictError = class extends FrameVideosError {
  static {
    __name(this, "ConflictError");
  }
  constructor(message, details) {
    super("RESOURCE_EXISTS" /* RESOURCE_EXISTS */, 409, message, details, "CONFLICT" /* CONFLICT */);
    this.name = "ConflictError";
  }
};
var StorageError = class extends FrameVideosError {
  static {
    __name(this, "StorageError");
  }
  constructor(message, details) {
    super("STORAGE_ERROR" /* STORAGE_ERROR */, 500, message, details, "INTERNAL" /* INTERNAL */);
    this.name = "StorageError";
  }
};
function validateRequired(data, fields) {
  const missing = fields.filter((f) => !data[f]);
  if (missing.length > 0) {
    throw new ValidationError("Missing required fields", { missing });
  }
}
__name(validateRequired, "validateRequired");
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError("Invalid email format");
  }
}
__name(validateEmail, "validateEmail");
function validatePasswordStrength2(password) {
  const checks = {
    hasMinLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };
  const passedChecks = Object.values(checks).filter(Boolean).length;
  let strength = "weak";
  if (passedChecks >= 4) strength = "strong";
  else if (passedChecks >= 3) strength = "good";
  else if (passedChecks >= 2) strength = "fair";
  const valid = checks.hasMinLength && checks.hasUppercase && checks.hasLowercase && checks.hasNumber;
  if (!valid) {
    throw new ValidationError("Password does not meet strength requirements", { checks });
  }
  return { valid: true, strength, checks };
}
__name(validatePasswordStrength2, "validatePasswordStrength");
function validateUUID(id, fieldName = "id") {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new ValidationError(`Invalid ${fieldName} format`);
  }
}
__name(validateUUID, "validateUUID");
function logError(error, context) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const logEntry = {
    timestamp,
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    category: error.category,
    context,
    details: error.details
  };
  console.error("[FrameVideosError]", JSON.stringify(logEntry, null, 2));
}
__name(logError, "logError");
function createErrorResponse(code, message, statusCode, details) {
  return {
    code,
    message,
    statusCode,
    details,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
__name(createErrorResponse, "createErrorResponse");
var DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  delayMs: 100,
  backoffMultiplier: 2,
  shouldRetry: /* @__PURE__ */ __name((error) => {
    if (error instanceof FrameVideosError) {
      return [
        "DATABASE_ERROR" /* DATABASE_ERROR */,
        "STORAGE_ERROR" /* STORAGE_ERROR */,
        "EXTERNAL_API_ERROR" /* EXTERNAL_API_ERROR */
      ].includes(error.code);
    }
    return false;
  }, "shouldRetry")
};
async function withRetry(fn, config = {}) {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError;
  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === finalConfig.maxRetries || !finalConfig.shouldRetry(error)) {
        throw error;
      }
      const delayMs = finalConfig.delayMs * Math.pow(finalConfig.backoffMultiplier, attempt);
      console.log(
        `[Retry] Attempt ${attempt + 1}/${finalConfig.maxRetries + 1}, waiting ${delayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
__name(withRetry, "withRetry");
function asyncHandler(handler) {
  return async (c) => {
    try {
      return await handler(c);
    } catch (error) {
      const req = c.req;
      const context = {
        endpoint: req.path,
        method: req.method,
        ip: req.header("x-forwarded-for") || req.header("x-real-ip"),
        userAgent: req.header("user-agent")
      };
      if (error instanceof FrameVideosError) {
        logError(error, context);
        return c.json(createErrorResponse(error.code, error.message, error.statusCode, error.details), error.statusCode);
      }
      if (error.message?.includes("JWT")) {
        const jwtError = new AuthenticationError("Invalid or expired token");
        logError(jwtError, context);
        return c.json(
          createErrorResponse(jwtError.code, jwtError.message, jwtError.statusCode),
          jwtError.statusCode
        );
      }
      console.error("[Unhandled Error]", error);
      const unknownError = new FrameVideosError(
        "INTERNAL_ERROR" /* INTERNAL_ERROR */,
        500,
        "An unexpected error occurred",
        { originalError: error.message }
      );
      logError(unknownError, context);
      return c.json(
        createErrorResponse(unknownError.code, unknownError.message, unknownError.statusCode),
        unknownError.statusCode
      );
    }
  };
}
__name(asyncHandler, "asyncHandler");

// src/rate-limiter.ts
var DEFAULT_RATE_LIMIT_CONFIG = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  blockDurationMs: 30 * 60 * 1e3
  // 30 minutes
};
var D1RateLimiter = class {
  static {
    __name(this, "D1RateLimiter");
  }
  config;
  constructor(config = DEFAULT_RATE_LIMIT_CONFIG) {
    this.config = config;
  }
  /**
   * Extract client IP from request
   */
  static getClientIP(request, headers) {
    const forwarded = headers?.["x-forwarded-for"] || request.headers?.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    const realIp = headers?.["x-real-ip"] || request.headers?.get("x-real-ip");
    if (realIp) {
      return realIp.trim();
    }
    const cfIp = headers?.["cf-connecting-ip"] || request.headers?.get("cf-connecting-ip");
    if (cfIp) {
      return cfIp.trim();
    }
    return "0.0.0.0";
  }
  /**
   * Check if an IP is rate limited and record attempt if not
   */
  async checkRateLimit(db, ipAddress) {
    const now = /* @__PURE__ */ new Date();
    const windowStart = new Date(now.getTime() - this.config.windowMs).toISOString();
    const blocked = await db.prepare(`
        SELECT blocked_until FROM login_attempts 
        WHERE ip_address = ? AND blocked_until IS NOT NULL AND blocked_until > ?
        ORDER BY attempted_at DESC LIMIT 1
      `).bind(ipAddress, now.toISOString()).first();
    if (blocked?.blocked_until) {
      const retryAfterMs = new Date(blocked.blocked_until).getTime() - now.getTime();
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterMs: Math.max(0, retryAfterMs),
        totalAttempts: this.config.maxAttempts
      };
    }
    const countResult = await db.prepare(`
        SELECT COUNT(*) as count FROM login_attempts 
        WHERE ip_address = ? AND attempted_at > ? AND success = 0
      `).bind(ipAddress, windowStart).first();
    const failedAttempts = countResult?.count || 0;
    if (failedAttempts >= this.config.maxAttempts) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterMs: this.config.blockDurationMs,
        totalAttempts: failedAttempts
      };
    }
    return {
      allowed: true,
      remainingAttempts: this.config.maxAttempts - failedAttempts,
      retryAfterMs: 0,
      totalAttempts: failedAttempts
    };
  }
  /**
   * Record a login attempt (success or failure)
   */
  async recordAttempt(db, ipAddress, email, success, userAgent) {
    const now = /* @__PURE__ */ new Date();
    const id = crypto.randomUUID();
    const windowStart = new Date(now.getTime() - this.config.windowMs).toISOString();
    let blockedUntil = null;
    if (!success) {
      const countResult = await db.prepare(`
          SELECT COUNT(*) as count FROM login_attempts 
          WHERE ip_address = ? AND attempted_at > ? AND success = 0
        `).bind(ipAddress, windowStart).first();
      const failedAttempts = (countResult?.count || 0) + 1;
      if (failedAttempts >= this.config.maxAttempts) {
        blockedUntil = new Date(now.getTime() + this.config.blockDurationMs).toISOString();
      }
    }
    await db.prepare(`
        INSERT INTO login_attempts (id, ip_address, email, attempted_at, success, user_agent, blocked_until)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(id, ipAddress, email, now.toISOString(), success ? 1 : 0, userAgent || null, blockedUntil).run();
  }
  /**
   * Reset rate limit for IP (e.g., after successful login)
   */
  async resetForIP(db, ipAddress) {
    await db.prepare(`
        UPDATE login_attempts SET blocked_until = NULL 
        WHERE ip_address = ? AND blocked_until IS NOT NULL
      `).bind(ipAddress).run();
  }
  /**
   * Clean up old entries (older than 24 hours)
   */
  async cleanup(db) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
    await db.prepare("DELETE FROM login_attempts WHERE attempted_at < ? AND (blocked_until IS NULL OR blocked_until < ?)").bind(cutoff, (/* @__PURE__ */ new Date()).toISOString()).run();
  }
};
var rateLimiter = new D1RateLimiter(DEFAULT_RATE_LIMIT_CONFIG);

// src/account-lockout.ts
var DEFAULT_LOCKOUT_CONFIG = {
  maxFailedAttempts: 10,
  lockoutDurationMs: 60 * 60 * 1e3,
  // 1 hour
  resetWindowMs: 30 * 60 * 1e3
  // 30 minutes
};
var D1AccountLockout = class {
  static {
    __name(this, "D1AccountLockout");
  }
  config;
  constructor(config = DEFAULT_LOCKOUT_CONFIG) {
    this.config = config;
  }
  /**
   * Check if an account is locked
   */
  async isLocked(db, userId) {
    const now = /* @__PURE__ */ new Date();
    const lockout = await db.prepare(`
        SELECT * FROM account_lockouts 
        WHERE user_id = ? 
        ORDER BY updated_at DESC LIMIT 1
      `).bind(userId).first();
    if (!lockout) {
      return {
        locked: false,
        failedAttempts: 0,
        remainingAttempts: this.config.maxFailedAttempts,
        lockedUntil: null,
        timeUntilUnlockMs: 0
      };
    }
    if (lockout.locked_until && new Date(lockout.locked_until) > now) {
      const timeUntilUnlockMs = new Date(lockout.locked_until).getTime() - now.getTime();
      return {
        locked: true,
        failedAttempts: lockout.failed_attempts,
        remainingAttempts: 0,
        lockedUntil: lockout.locked_until,
        timeUntilUnlockMs: Math.max(0, timeUntilUnlockMs)
      };
    }
    const lastFailed = new Date(lockout.last_failed_at);
    if (now.getTime() - lastFailed.getTime() > this.config.resetWindowMs) {
      await this.reset(db, userId);
      return {
        locked: false,
        failedAttempts: 0,
        remainingAttempts: this.config.maxFailedAttempts,
        lockedUntil: null,
        timeUntilUnlockMs: 0
      };
    }
    if (lockout.locked_until && new Date(lockout.locked_until) <= now) {
      await this.reset(db, userId);
      return {
        locked: false,
        failedAttempts: 0,
        remainingAttempts: this.config.maxFailedAttempts,
        lockedUntil: null,
        timeUntilUnlockMs: 0
      };
    }
    return {
      locked: false,
      failedAttempts: lockout.failed_attempts,
      remainingAttempts: Math.max(0, this.config.maxFailedAttempts - lockout.failed_attempts),
      lockedUntil: null,
      timeUntilUnlockMs: 0
    };
  }
  /**
   * Record a failed login attempt for an account
   */
  async recordFailedAttempt(db, userId, email) {
    const now = /* @__PURE__ */ new Date();
    const nowStr = now.toISOString();
    const existing = await db.prepare(`
        SELECT * FROM account_lockouts 
        WHERE user_id = ? 
        ORDER BY updated_at DESC LIMIT 1
      `).bind(userId).first();
    if (!existing) {
      const id = crypto.randomUUID();
      await db.prepare(`
          INSERT INTO account_lockouts (id, user_id, email, failed_attempts, first_failed_at, last_failed_at, locked_until, created_at, updated_at)
          VALUES (?, ?, ?, 1, ?, ?, NULL, ?, ?)
        `).bind(id, userId, email, nowStr, nowStr, nowStr, nowStr).run();
      return {
        locked: false,
        failedAttempts: 1,
        remainingAttempts: this.config.maxFailedAttempts - 1,
        lockedUntil: null,
        timeUntilUnlockMs: 0
      };
    }
    const lastFailed = new Date(existing.last_failed_at);
    if (now.getTime() - lastFailed.getTime() > this.config.resetWindowMs) {
      await db.prepare(`
          UPDATE account_lockouts 
          SET failed_attempts = 1, first_failed_at = ?, last_failed_at = ?, locked_until = NULL, updated_at = ?
          WHERE id = ?
        `).bind(nowStr, nowStr, nowStr, existing.id).run();
      return {
        locked: false,
        failedAttempts: 1,
        remainingAttempts: this.config.maxFailedAttempts - 1,
        lockedUntil: null,
        timeUntilUnlockMs: 0
      };
    }
    const newAttempts = existing.failed_attempts + 1;
    let lockedUntil = null;
    if (newAttempts >= this.config.maxFailedAttempts) {
      lockedUntil = new Date(now.getTime() + this.config.lockoutDurationMs).toISOString();
    }
    await db.prepare(`
        UPDATE account_lockouts 
        SET failed_attempts = ?, last_failed_at = ?, locked_until = ?, updated_at = ?
        WHERE id = ?
      `).bind(newAttempts, nowStr, lockedUntil, nowStr, existing.id).run();
    if (lockedUntil) {
      return {
        locked: true,
        failedAttempts: newAttempts,
        remainingAttempts: 0,
        lockedUntil,
        timeUntilUnlockMs: this.config.lockoutDurationMs
      };
    }
    return {
      locked: false,
      failedAttempts: newAttempts,
      remainingAttempts: Math.max(0, this.config.maxFailedAttempts - newAttempts),
      lockedUntil: null,
      timeUntilUnlockMs: 0
    };
  }
  /**
   * Reset lockout for account (e.g., after successful login)
   */
  async reset(db, userId) {
    await db.prepare("DELETE FROM account_lockouts WHERE user_id = ?").bind(userId).run();
  }
  /**
   * Clean up expired lockouts
   */
  async cleanup(db) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
    await db.prepare(`
        DELETE FROM account_lockouts 
        WHERE (locked_until IS NOT NULL AND locked_until < ?) 
        OR (locked_until IS NULL AND last_failed_at < ?)
      `).bind(now, cutoff).run();
  }
};
var accountLockout = new D1AccountLockout(DEFAULT_LOCKOUT_CONFIG);

// src/security-audit.ts
async function logSecurityEvent(db, event) {
  try {
    const id = crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await db.prepare(`
        INSERT INTO security_audit_log (id, event_type, ip_address, email, user_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
      id,
      event.eventType,
      event.ipAddress || null,
      event.email || null,
      event.userId || null,
      event.details ? JSON.stringify(event.details) : null,
      now
    ).run();
    console.log(`[SECURITY_AUDIT] ${event.eventType}`, {
      timestamp: now,
      ip: event.ipAddress,
      email: event.email,
      userId: event.userId,
      details: event.details
    });
  } catch (error) {
    console.error("[SECURITY_AUDIT_ERROR] Failed to log event:", error);
  }
}
__name(logSecurityEvent, "logSecurityEvent");

// src/audit.ts
var AuditEventType = /* @__PURE__ */ ((AuditEventType2) => {
  AuditEventType2["LOGIN_SUCCESS"] = "LOGIN_SUCCESS";
  AuditEventType2["LOGIN_FAILED"] = "LOGIN_FAILED";
  AuditEventType2["LOGOUT"] = "LOGOUT";
  AuditEventType2["REGISTER_SUCCESS"] = "REGISTER_SUCCESS";
  AuditEventType2["REGISTER_FAILED"] = "REGISTER_FAILED";
  AuditEventType2["VIDEO_UPLOAD"] = "VIDEO_UPLOAD";
  AuditEventType2["VIDEO_UPDATE"] = "VIDEO_UPDATE";
  AuditEventType2["VIDEO_DELETE"] = "VIDEO_DELETE";
  AuditEventType2["VIDEO_VIEW"] = "VIDEO_VIEW";
  AuditEventType2["TENANT_CREATE"] = "TENANT_CREATE";
  AuditEventType2["TENANT_UPDATE"] = "TENANT_UPDATE";
  AuditEventType2["TENANT_DELETE"] = "TENANT_DELETE";
  AuditEventType2["USER_ROLE_CHANGE"] = "USER_ROLE_CHANGE";
  AuditEventType2["USER_DELETE"] = "USER_DELETE";
  AuditEventType2["USER_BAN"] = "USER_BAN";
  AuditEventType2["USER_UNBAN"] = "USER_UNBAN";
  AuditEventType2["ACCOUNT_LOCKED"] = "ACCOUNT_LOCKED";
  AuditEventType2["ACCOUNT_UNLOCKED"] = "ACCOUNT_UNLOCKED";
  AuditEventType2["IP_BLOCKED"] = "IP_BLOCKED";
  AuditEventType2["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
  AuditEventType2["ADMIN_ACTION"] = "ADMIN_ACTION";
  AuditEventType2["CONFIG_CHANGE"] = "CONFIG_CHANGE";
  return AuditEventType2;
})(AuditEventType || {});
async function logAuditEvent(db, event) {
  try {
    const id = crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await db.prepare(`
        INSERT INTO security_audit_log (id, event_type, ip_address, email, user_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
      id,
      event.eventType,
      event.ipAddress || null,
      null,
      // email não está no novo schema, mas mantém compatibilidade
      event.userId || null,
      JSON.stringify({
        tenantId: event.tenantId,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        userAgent: event.userAgent,
        ...event.details
      }),
      now
    ).run();
    console.log(`[AUDIT] ${event.eventType}`, {
      timestamp: now,
      userId: event.userId,
      tenantId: event.tenantId,
      resource: event.resourceType ? `${event.resourceType}:${event.resourceId}` : void 0,
      ip: event.ipAddress,
      details: event.details
    });
  } catch (error) {
    console.error("[AUDIT_ERROR] Failed to log event:", error);
  }
}
__name(logAuditEvent, "logAuditEvent");
async function queryAuditLogs(db, filters) {
  let query = "SELECT * FROM security_audit_log WHERE 1=1";
  const params = [];
  if (filters.eventType) {
    query += " AND event_type = ?";
    params.push(filters.eventType);
  }
  if (filters.userId) {
    query += " AND user_id = ?";
    params.push(filters.userId);
  }
  if (filters.tenantId) {
    query += " AND details LIKE ?";
    params.push(`%"tenantId":"${filters.tenantId}"%`);
  }
  if (filters.startDate) {
    query += " AND created_at >= ?";
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    query += " AND created_at <= ?";
    params.push(filters.endDate);
  }
  query += " ORDER BY created_at DESC";
  if (filters.limit) {
    query += " LIMIT ?";
    params.push(filters.limit);
  }
  if (filters.offset) {
    query += " OFFSET ?";
    params.push(filters.offset);
  }
  const result = await db.prepare(query).bind(...params).all();
  return result.results.map((row) => ({
    ...row,
    details: row.details ? JSON.parse(row.details) : null
  }));
}
__name(queryAuditLogs, "queryAuditLogs");
async function getAuditStats(db, filters) {
  let query = "SELECT event_type, COUNT(*) as count FROM security_audit_log WHERE 1=1";
  const params = [];
  if (filters.startDate) {
    query += " AND created_at >= ?";
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    query += " AND created_at <= ?";
    params.push(filters.endDate);
  }
  query += " GROUP BY event_type";
  const result = await db.prepare(query).bind(...params).all();
  const stats = {};
  for (const row of result.results) {
    stats[row.event_type] = row.count;
  }
  return stats;
}
__name(getAuditStats, "getAuditStats");

// src/middleware/rate-limit.ts
var KVRateLimiter = class {
  static {
    __name(this, "KVRateLimiter");
  }
  config;
  kv;
  constructor(kv, config) {
    this.kv = kv;
    this.config = config;
  }
  /**
   * Check and consume rate limit
   */
  async consume(key) {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const kvKey = `${this.config.keyPrefix}${key}`;
    const stored = await this.kv.get(kvKey, "json");
    let count = 0;
    let resetAt = now + this.config.windowMs;
    if (stored) {
      if (stored.resetAt > now) {
        count = stored.count;
        resetAt = stored.resetAt;
      }
    }
    if (count >= this.config.limit) {
      const retryAfter = Math.ceil((resetAt - now) / 1e3);
      return {
        allowed: false,
        limit: this.config.limit,
        remaining: 0,
        reset: Math.floor(resetAt / 1e3),
        retryAfter
      };
    }
    count++;
    const ttl = Math.ceil((resetAt - now) / 1e3);
    await this.kv.put(
      kvKey,
      JSON.stringify({ count, resetAt }),
      { expirationTtl: ttl }
    );
    return {
      allowed: true,
      limit: this.config.limit,
      remaining: this.config.limit - count,
      reset: Math.floor(resetAt / 1e3)
    };
  }
  /**
   * Reset rate limit for a key
   */
  async reset(key) {
    const kvKey = `${this.config.keyPrefix}${key}`;
    await this.kv.delete(kvKey);
  }
};
function getClientIP(c) {
  const cfIp = c.req.header("cf-connecting-ip");
  if (cfIp) return cfIp;
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp;
  return "0.0.0.0";
}
__name(getClientIP, "getClientIP");
function getUserId(c) {
  try {
    const tenantContext = c.get("tenantContext");
    if (tenantContext?.userId) {
      return tenantContext.userId;
    }
    const user = c.get("user");
    return user?.id || user?.sub || null;
  } catch {
    return null;
  }
}
__name(getUserId, "getUserId");
function rateLimitMiddleware(config) {
  return async (c, next) => {
    const kv = c.env.CACHE;
    if (!kv) {
      console.warn("[RATE_LIMIT] KV namespace not available, skipping rate limit");
      await next();
      return;
    }
    const limiter = new KVRateLimiter(kv, config);
    let key;
    if (config.keyPrefix.includes("user")) {
      const userId = getUserId(c);
      if (!userId) {
        key = getClientIP(c);
      } else {
        key = userId;
      }
    } else {
      key = getClientIP(c);
    }
    const result = await limiter.consume(key);
    c.header("X-RateLimit-Limit", String(result.limit));
    c.header("X-RateLimit-Remaining", String(result.remaining));
    c.header("X-RateLimit-Reset", String(result.reset));
    if (!result.allowed) {
      c.header("Retry-After", String(result.retryAfter || 60));
      console.warn("[RATE_LIMIT_EXCEEDED]", {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        key,
        limit: result.limit,
        path: c.req.path,
        method: c.req.method
      });
      return c.json({
        error: {
          message: config.message || "Too many requests. Please try again later.",
          code: 429,
          category: "RATE_LIMIT",
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset,
          retryAfter: result.retryAfter,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      }, 429);
    }
    await next();
  };
}
__name(rateLimitMiddleware, "rateLimitMiddleware");
var publicRateLimit = rateLimitMiddleware({
  limit: 100,
  windowMs: 60 * 1e3,
  // 1 minute
  keyPrefix: "rl:public:ip:",
  message: "Too many requests from this IP. Please try again later."
});
var authenticatedRateLimit = rateLimitMiddleware({
  limit: 1e3,
  windowMs: 60 * 1e3,
  // 1 minute
  keyPrefix: "rl:auth:user:",
  message: "Too many requests. Please try again later."
});
var uploadRateLimit = rateLimitMiddleware({
  limit: 10,
  windowMs: 60 * 1e3,
  // 1 minute
  keyPrefix: "rl:upload:user:",
  message: "Too many upload requests. Please try again later."
});
var loginRateLimit = rateLimitMiddleware({
  limit: 10,
  windowMs: 60 * 1e3,
  // 1 minute
  keyPrefix: "rl:login:ip:",
  message: "Too many login attempts. Please try again later."
});
var registerRateLimit = rateLimitMiddleware({
  limit: 5,
  windowMs: 60 * 1e3,
  // 1 minute
  keyPrefix: "rl:register:ip:",
  message: "Too many registration attempts. Please try again later."
});

// src/routes/auth-secure.ts
var auth = new Hono2();
function getRawDB(c) {
  return c.env.DB;
}
__name(getRawDB, "getRawDB");
function getClientIP2(c) {
  return c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "0.0.0.0";
}
__name(getClientIP2, "getClientIP");
auth.post("/register", registerRateLimit, asyncHandler(async (c) => {
  const body = await c.req.json();
  const { email, password, name, acceptTerms, acceptPrivacy } = body;
  let { tenantId } = body;
  const db = c.get("db");
  const rawDB = getRawDB(c);
  const clientIP = getClientIP2(c);
  const userAgent = c.req.header("user-agent") || "";
  validateRequired(body, ["email", "password", "acceptTerms", "acceptPrivacy"]);
  if (!acceptTerms || !acceptPrivacy) {
    throw new ValidationError("You must accept the Terms of Service and Privacy Policy to register");
  }
  validateEmail(email);
  const passwordResult = validatePasswordStrength(password);
  if (!passwordResult.valid) {
    await logSecurityEvent(rawDB, {
      eventType: "PASSWORD_WEAK" /* PASSWORD_WEAK */,
      ipAddress: clientIP,
      email,
      details: { errors: passwordResult.errors, strength: passwordResult.strength }
    });
    throw new ValidationError("Password does not meet strength requirements", {
      errors: passwordResult.errors,
      strength: passwordResult.strength
    });
  }
  validatePasswordStrength2(password);
  const existingUserCheck = await withRetry(() => db.getUserByEmail(email));
  if (existingUserCheck) {
    await logSecurityEvent(rawDB, {
      eventType: "REGISTER_FAILED" /* REGISTER_FAILED */,
      ipAddress: clientIP,
      email,
      details: { reason: "duplicate_email" }
    });
    throw new ConflictError("User already exists", { email });
  }
  let tenant;
  if (tenantId) {
    tenant = await withRetry(() => db.getTenantById(tenantId));
    if (!tenant) {
      throw new ValidationError("Invalid tenant ID", { tenantId });
    }
  } else {
    const emailPrefix = email.split("@")[0];
    const uniqueDomain = `${emailPrefix}-${crypto.randomUUID().slice(0, 8)}.framevideos.com`;
    const tenantName = name || emailPrefix;
    tenant = {
      id: crypto.randomUUID(),
      name: tenantName,
      domain: uniqueDomain,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await withRetry(() => db.createTenant(tenant));
    tenantId = tenant.id;
  }
  const origin = c.req.header("origin") || "";
  const referer = c.req.header("referer") || "";
  const isFrameVideosDomain = origin.includes("framevideos.com") || referer.includes("framevideos.com");
  const userRole = isFrameVideosDomain ? "admin" : "user";
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const user = {
    id: crypto.randomUUID(),
    email,
    password: await hashPassword(password),
    role: userRole,
    tenantId,
    createdAt: now,
    privacyPolicyAcceptedAt: now,
    termsAcceptedAt: now
  };
  await withRetry(() => db.createUser(user));
  const token = await generateToken(user);
  await logSecurityEvent(rawDB, {
    eventType: "REGISTER_SUCCESS" /* REGISTER_SUCCESS */,
    ipAddress: clientIP,
    email: user.email,
    userId: user.id,
    details: { tenantId: user.tenantId }
  });
  await logAuditEvent(rawDB, {
    eventType: "REGISTER_SUCCESS" /* REGISTER_SUCCESS */,
    userId: user.id,
    tenantId: user.tenantId,
    ipAddress: clientIP,
    userAgent,
    details: { email: user.email }
  });
  console.log("[USER_REGISTERED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    userId: user.id,
    email: user.email,
    tenantId: user.tenantId,
    ip: clientIP
  });
  return c.json({
    message: "User created successfully",
    user: {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId
    },
    token
  }, 201);
}));
auth.post("/login", loginRateLimit, asyncHandler(async (c) => {
  const body = await c.req.json();
  const { email, password } = body;
  const db = c.get("db");
  const rawDB = getRawDB(c);
  const clientIP = getClientIP2(c);
  const userAgent = c.req.header("user-agent") || "";
  validateRequired(body, ["email", "password"]);
  const rateResult = await rateLimiter.checkRateLimit(rawDB, clientIP);
  if (!rateResult.allowed) {
    const retryAfterSeconds = Math.ceil(rateResult.retryAfterMs / 1e3);
    await logSecurityEvent(rawDB, {
      eventType: "LOGIN_RATE_LIMITED" /* LOGIN_RATE_LIMITED */,
      ipAddress: clientIP,
      email,
      details: {
        totalAttempts: rateResult.totalAttempts,
        retryAfterSeconds
      }
    });
    console.warn("[RATE_LIMITED]", {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ip: clientIP,
      email,
      retryAfterSeconds
    });
    c.header("Retry-After", String(retryAfterSeconds));
    return c.json({
      error: {
        message: "Too many login attempts. Please try again later.",
        code: 429,
        category: "RATE_LIMIT",
        retryAfterSeconds,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    }, 429);
  }
  const user = await withRetry(() => db.getUserByEmail(email));
  if (!user) {
    await rateLimiter.recordAttempt(rawDB, clientIP, email, false, userAgent);
    await logSecurityEvent(rawDB, {
      eventType: "LOGIN_FAILED" /* LOGIN_FAILED */,
      ipAddress: clientIP,
      email,
      details: { reason: "user_not_found" }
    });
    throw new AuthenticationError("Invalid credentials");
  }
  const lockoutResult = await accountLockout.isLocked(rawDB, user.id);
  if (lockoutResult.locked) {
    const unlockTimeMs = lockoutResult.timeUntilUnlockMs;
    const unlockTimeMinutes = Math.ceil(unlockTimeMs / 6e4);
    await logSecurityEvent(rawDB, {
      eventType: "ACCOUNT_LOCKED" /* ACCOUNT_LOCKED */,
      ipAddress: clientIP,
      email,
      userId: user.id,
      details: {
        failedAttempts: lockoutResult.failedAttempts,
        lockedUntil: lockoutResult.lockedUntil,
        unlockTimeMinutes
      }
    });
    console.warn("[ACCOUNT_LOCKED]", {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      userId: user.id,
      email,
      lockedUntil: lockoutResult.lockedUntil
    });
    return c.json({
      error: {
        message: "Account is temporarily locked due to too many failed login attempts.",
        code: 423,
        category: "ACCOUNT_LOCKED",
        lockedUntil: lockoutResult.lockedUntil,
        unlockTimeMinutes,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    }, 423);
  }
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    await rateLimiter.recordAttempt(rawDB, clientIP, email, false, userAgent);
    const lockResult = await accountLockout.recordFailedAttempt(rawDB, user.id, email);
    await logSecurityEvent(rawDB, {
      eventType: "LOGIN_FAILED" /* LOGIN_FAILED */,
      ipAddress: clientIP,
      email,
      userId: user.id,
      details: {
        reason: "invalid_password",
        failedAttempts: lockResult.failedAttempts,
        remainingAttempts: lockResult.remainingAttempts,
        accountLocked: lockResult.locked
      }
    });
    await logAuditEvent(rawDB, {
      eventType: "LOGIN_FAILED" /* LOGIN_FAILED */,
      userId: user.id,
      tenantId: user.tenantId,
      ipAddress: clientIP,
      userAgent,
      details: {
        email,
        reason: "invalid_password",
        failedAttempts: lockResult.failedAttempts
      }
    });
    console.warn("[LOGIN_FAILED]", {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      email,
      ip: clientIP,
      failedAttempts: lockResult.failedAttempts,
      accountLocked: lockResult.locked
    });
    if (lockResult.locked) {
      return c.json({
        error: {
          message: "Account is temporarily locked due to too many failed login attempts.",
          code: 423,
          category: "ACCOUNT_LOCKED",
          lockedUntil: lockResult.lockedUntil,
          unlockTimeMinutes: Math.ceil(lockResult.timeUntilUnlockMs / 6e4),
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      }, 423);
    }
    throw new AuthenticationError("Invalid credentials");
  }
  await rateLimiter.recordAttempt(rawDB, clientIP, email, true, userAgent);
  await rateLimiter.resetForIP(rawDB, clientIP);
  await accountLockout.reset(rawDB, user.id);
  const token = await generateToken(user);
  await logSecurityEvent(rawDB, {
    eventType: "LOGIN_SUCCESS" /* LOGIN_SUCCESS */,
    ipAddress: clientIP,
    email: user.email,
    userId: user.id,
    details: { tenantId: user.tenantId }
  });
  await logAuditEvent(rawDB, {
    eventType: "LOGIN_SUCCESS" /* LOGIN_SUCCESS */,
    userId: user.id,
    tenantId: user.tenantId,
    ipAddress: clientIP,
    userAgent,
    details: { email: user.email }
  });
  console.log("[USER_LOGIN]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    userId: user.id,
    email: user.email,
    tenantId: user.tenantId,
    ip: clientIP
  });
  return c.json({
    message: "Login successful",
    user: {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId
    },
    token
  });
}));
auth.post("/password-strength", asyncHandler(async (c) => {
  const body = await c.req.json();
  const { password } = body;
  validateRequired(body, ["password"]);
  const checks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>_+\-=\[\]{};':\\|]/.test(password)
  };
  const passedChecks = Object.values(checks).filter(Boolean).length;
  let strength = "weak";
  if (passedChecks === 5 && password.length >= 12) {
    strength = "strong";
  } else if (passedChecks >= 4) {
    strength = "medium";
  }
  const errors = [];
  if (!checks.minLength) errors.push("Password must be at least 8 characters");
  if (!checks.hasUppercase) errors.push("Password must contain an uppercase letter");
  if (!checks.hasLowercase) errors.push("Password must contain a lowercase letter");
  if (!checks.hasNumber) errors.push("Password must contain a number");
  if (!checks.hasSpecial) errors.push("Password must contain a special character");
  return c.json({
    valid: errors.length === 0,
    strength,
    checks,
    errors
  });
}));
auth.get("/me", asyncHandler(async (c) => {
  const token = extractToken(c.req.header("Authorization"));
  const db = c.get("db");
  if (!token) {
    throw new AuthenticationError("Authentication required");
  }
  const payload = await verifyToken(token);
  if (!payload) {
    throw new AuthenticationError("Invalid or expired token");
  }
  const user = await withRetry(() => db.getUserById(payload.sub));
  if (!user) {
    throw new NotFoundError("User", payload.sub);
  }
  const tenant = await withRetry(() => db.getTenantById(user.tenantId));
  if (!tenant) {
    throw new NotFoundError("Tenant", user.tenantId);
  }
  return c.json({
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain
    }
  });
}));
auth.get("/security-status", asyncHandler(async (c) => {
  const token = extractToken(c.req.header("Authorization"));
  if (!token) {
    throw new AuthenticationError("Authentication required");
  }
  const payload = await verifyToken(token);
  if (!payload) {
    throw new AuthenticationError("Invalid or expired token");
  }
  const rawDB = getRawDB(c);
  const recentEvents = await rawDB.prepare(`
      SELECT event_type, COUNT(*) as count 
      FROM security_audit_log 
      WHERE created_at > datetime('now', '-24 hours')
      GROUP BY event_type
      ORDER BY count DESC
    `).all();
  const blockedIPs = await rawDB.prepare(`
      SELECT DISTINCT ip_address, blocked_until 
      FROM login_attempts 
      WHERE blocked_until IS NOT NULL AND blocked_until > datetime('now')
    `).all();
  const lockedAccounts = await rawDB.prepare(`
      SELECT email, locked_until, failed_attempts 
      FROM account_lockouts 
      WHERE locked_until IS NOT NULL AND locked_until > datetime('now')
    `).all();
  return c.json({
    recentEvents: recentEvents.results || [],
    blockedIPs: blockedIPs.results || [],
    lockedAccounts: lockedAccounts.results || [],
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
}));
var auth_secure_default = auth;

// src/middleware/tenant-isolation.ts
async function tenantIsolation(c, next) {
  const token = extractToken(c.req.header("Authorization"));
  if (!token) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
  const tenantContext = {
    userId: payload.sub,
    email: payload.email,
    tenantId: payload.tenantId
  };
  c.set("tenantContext", tenantContext);
  logTenantAccess(c, tenantContext);
  await next();
}
__name(tenantIsolation, "tenantIsolation");
function logTenantAccess(c, context) {
  const logEntry = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    tenantId: context.tenantId,
    userId: context.userId,
    method: c.req.method,
    path: c.req.path,
    ip: c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown",
    userAgent: c.req.header("User-Agent") || "unknown"
  };
  console.log("[TENANT_ACCESS]", JSON.stringify(logEntry));
}
__name(logTenantAccess, "logTenantAccess");
function getTenantContext(c) {
  const context = c.get("tenantContext");
  if (!context) {
    throw new Error("Tenant context not found. Did you apply tenantIsolation middleware?");
  }
  return context;
}
__name(getTenantContext, "getTenantContext");
function validateTenantOwnership(c, resourceTenantId) {
  const context = getTenantContext(c);
  if (context.tenantId !== resourceTenantId) {
    console.warn("[TENANT_VIOLATION]", {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      userId: context.userId,
      userTenantId: context.tenantId,
      resourceTenantId,
      path: c.req.path
    });
    throw new Error("Access denied: resource belongs to different tenant");
  }
}
__name(validateTenantOwnership, "validateTenantOwnership");

// src/analytics.ts
var AnalyticsDatabase = class {
  static {
    __name(this, "AnalyticsDatabase");
  }
  analytics = /* @__PURE__ */ new Map();
  interactions = /* @__PURE__ */ new Map();
  trendingCache = /* @__PURE__ */ new Map();
  // Cache per tenant
  // ============================================
  // VIDEO ANALYTICS
  // ============================================
  async getOrCreateAnalytics(videoId, tenantId) {
    const existing = this.analytics.get(videoId);
    if (existing) {
      return existing;
    }
    const analytics2 = {
      videoId,
      tenantId,
      views: 0,
      likes: 0,
      dislikes: 0,
      comments: 0,
      shares: 0,
      watchTime: 0,
      avgWatchTime: 0,
      completionRate: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.analytics.set(videoId, analytics2);
    return analytics2;
  }
  async getAnalytics(videoId, tenantId) {
    const analytics2 = this.analytics.get(videoId);
    if (!analytics2) {
      return null;
    }
    if (analytics2.tenantId !== tenantId) {
      console.warn("[SECURITY] Cross-tenant analytics access attempt", {
        videoId,
        analyticsTenantId: analytics2.tenantId,
        requestTenantId: tenantId
      });
      return null;
    }
    return analytics2;
  }
  async incrementViews(videoId, tenantId) {
    const analytics2 = await this.getOrCreateAnalytics(videoId, tenantId);
    analytics2.views += 1;
    analytics2.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.analytics.set(videoId, analytics2);
    this.trendingCache.delete(tenantId);
  }
  async incrementLikes(videoId, tenantId) {
    const analytics2 = await this.getOrCreateAnalytics(videoId, tenantId);
    analytics2.likes += 1;
    analytics2.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.analytics.set(videoId, analytics2);
    this.trendingCache.delete(tenantId);
  }
  async decrementLikes(videoId, tenantId) {
    const analytics2 = await this.getOrCreateAnalytics(videoId, tenantId);
    analytics2.likes = Math.max(0, analytics2.likes - 1);
    analytics2.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.analytics.set(videoId, analytics2);
    this.trendingCache.delete(tenantId);
  }
  async updateWatchTime(videoId, tenantId, watchTime, completed) {
    const analytics2 = await this.getOrCreateAnalytics(videoId, tenantId);
    analytics2.watchTime += watchTime;
    if (analytics2.views > 0) {
      analytics2.avgWatchTime = analytics2.watchTime / analytics2.views;
    }
    if (completed) {
      const currentCompletions = Math.floor(analytics2.completionRate / 100 * analytics2.views);
      analytics2.completionRate = (currentCompletions + 1) / analytics2.views * 100;
    }
    analytics2.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.analytics.set(videoId, analytics2);
  }
  // ============================================
  // USER INTERACTIONS
  // ============================================
  getInteractionKey(userId, videoId) {
    return `${userId}:${videoId}`;
  }
  async getInteraction(userId, videoId, tenantId) {
    const key = this.getInteractionKey(userId, videoId);
    const interaction = this.interactions.get(key);
    if (!interaction) {
      return null;
    }
    if (interaction.tenantId !== tenantId) {
      return null;
    }
    return interaction;
  }
  async createOrUpdateInteraction(userId, videoId, tenantId, updates) {
    const key = this.getInteractionKey(userId, videoId);
    const existing = this.interactions.get(key);
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.interactions.set(key, updated);
      return updated;
    }
    const interaction = {
      id: crypto.randomUUID(),
      userId,
      videoId,
      tenantId,
      liked: false,
      disliked: false,
      watched: false,
      watchTime: 0,
      completed: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      ...updates
    };
    this.interactions.set(key, interaction);
    return interaction;
  }
  async toggleLike(userId, videoId, tenantId) {
    const interaction = await this.getInteraction(userId, videoId, tenantId);
    const currentlyLiked = interaction?.liked || false;
    await this.createOrUpdateInteraction(userId, videoId, tenantId, {
      liked: !currentlyLiked,
      disliked: false
      // Unlike if previously disliked
    });
    if (!currentlyLiked) {
      await this.incrementLikes(videoId, tenantId);
    } else {
      await this.decrementLikes(videoId, tenantId);
    }
    return { liked: !currentlyLiked };
  }
  // ============================================
  // TRENDING ALGORITHM
  // ============================================
  /**
   * Calculate trending score for a video
   * Formula: (views * 1.0) + (likes * 5.0) + recencyBoost
   * 
   * Recency boost:
   * - Last 24h: +100
   * - Last 7 days: +50
   * - Last 30 days: +20
   * - Older: 0
   */
  calculateTrendingScore(analytics2, videoCreatedAt) {
    const viewWeight = 1;
    const likeWeight = 5;
    const viewScore = analytics2.views * viewWeight;
    const likeScore = analytics2.likes * likeWeight;
    const now = Date.now();
    const createdAt = new Date(videoCreatedAt).getTime();
    const ageInHours = (now - createdAt) / (1e3 * 60 * 60);
    let recencyBoost = 0;
    if (ageInHours <= 24) {
      recencyBoost = 100;
    } else if (ageInHours <= 24 * 7) {
      recencyBoost = 50;
    } else if (ageInHours <= 24 * 30) {
      recencyBoost = 20;
    }
    return viewScore + likeScore + recencyBoost;
  }
  async getTrending(tenantId, videos2, limit = 10) {
    const cached = this.trendingCache.get(tenantId);
    if (cached && cached.length > 0) {
      const cacheAge = Date.now() - new Date(cached[0].calculatedAt).getTime();
      if (cacheAge < 5 * 60 * 1e3) {
        return cached.slice(0, limit);
      }
    }
    const scores = [];
    for (const video of videos2) {
      const analytics2 = await this.getOrCreateAnalytics(video.id, tenantId);
      const score = this.calculateTrendingScore(analytics2, video.createdAt);
      scores.push({
        videoId: video.id,
        score,
        views: analytics2.views,
        likes: analytics2.likes,
        recencyBoost: score - (analytics2.views + analytics2.likes * 5),
        calculatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    scores.sort((a, b) => b.score - a.score);
    this.trendingCache.set(tenantId, scores);
    return scores.slice(0, limit);
  }
  // ============================================
  // DASHBOARD STATS
  // ============================================
  async getDashboardStats(tenantId, videos2) {
    let totalViews = 0;
    let totalLikes = 0;
    for (const video of videos2) {
      const analytics2 = await this.getOrCreateAnalytics(video.id, tenantId);
      totalViews += analytics2.views;
      totalLikes += analytics2.likes;
    }
    const totalVideos = videos2.length;
    return {
      totalViews,
      totalLikes,
      totalVideos,
      avgViewsPerVideo: totalVideos > 0 ? totalViews / totalVideos : 0,
      avgLikesPerVideo: totalVideos > 0 ? totalLikes / totalVideos : 0
    };
  }
};
var analyticsDb = new AnalyticsDatabase();

// src/middleware/audit-context.ts
async function auditContextMiddleware(c, next) {
  const ipAddress = c.req.header("cf-connecting-ip") || // Cloudflare
  c.req.header("x-real-ip") || // Nginx
  c.req.header("x-forwarded-for")?.split(",")[0].trim() || // Standard proxy
  "unknown";
  const userAgent = c.req.header("user-agent") || "unknown";
  c.set("auditContext", {
    ipAddress,
    userAgent
  });
  await next();
}
__name(auditContextMiddleware, "auditContextMiddleware");
function getAuditContext(c) {
  return c.get("auditContext") || {};
}
__name(getAuditContext, "getAuditContext");

// src/routes/videos-secure.ts
var videos = new Hono2();
videos.use("*", tenantIsolation);
videos.get("/", asyncHandler(async (c) => {
  const db = c.get("db");
  const { tenantId } = getTenantContext(c);
  const tenantVideos = await withRetry(() => db.getVideosByTenant(tenantId));
  return c.json({
    videos: tenantVideos,
    total: tenantVideos.length
  });
}));
videos.get("/:id", asyncHandler(async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const { tenantId } = getTenantContext(c);
  validateUUID(id, "videoId");
  const video = await withRetry(() => db.getVideoById(id, tenantId));
  if (!video) {
    throw new NotFoundError("Video", { videoId: id, tenantId });
  }
  await withRetry(() => db.incrementVideoViews(id, tenantId));
  await withRetry(() => analyticsDb.incrementViews(id, tenantId));
  return c.json(video);
}));
videos.post("/", asyncHandler(async (c) => {
  const db = c.get("db");
  const { tenantId, userId } = getTenantContext(c);
  const body = await c.req.json();
  const { title, description, url, thumbnailUrl, duration } = body;
  validateRequired(body, ["title", "url"]);
  const video = {
    id: crypto.randomUUID(),
    tenantId,
    // Use authenticated tenant ID
    title,
    description: description || "",
    url,
    thumbnailUrl: thumbnailUrl || "",
    duration: duration || 0,
    views: 0,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await withRetry(() => db.createVideo(video, tenantId));
  console.log("[VIDEO_CREATED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    videoId: video.id,
    tenantId,
    userId
  });
  return c.json({
    message: "Video created successfully",
    video
  }, 201);
}));
videos.put("/:id", asyncHandler(async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const { tenantId, userId } = getTenantContext(c);
  validateUUID(id, "videoId");
  const video = await withRetry(() => db.getVideoById(id, tenantId));
  if (!video) {
    throw new NotFoundError("Video", { videoId: id, tenantId });
  }
  validateTenantOwnership(c, video.tenantId);
  const updates = await c.req.json();
  const updated = await withRetry(() => db.updateVideo(id, updates, tenantId));
  console.log("[VIDEO_UPDATED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    videoId: id,
    tenantId,
    userId,
    updates: Object.keys(updates)
  });
  return c.json({
    message: "Video updated successfully",
    video: updated
  });
}));
videos.delete("/:id", asyncHandler(async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const { tenantId, userId } = getTenantContext(c);
  const { ipAddress, userAgent } = getAuditContext(c);
  const rawDB = c.env.DB;
  validateUUID(id, "videoId");
  const video = await withRetry(() => db.getVideoById(id, tenantId));
  if (!video) {
    throw new NotFoundError("Video", { videoId: id, tenantId });
  }
  validateTenantOwnership(c, video.tenantId);
  await withRetry(() => db.deleteVideo(id, tenantId));
  console.log("[VIDEO_DELETED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    videoId: id,
    tenantId,
    userId
  });
  await logAuditEvent(rawDB, {
    eventType: "VIDEO_DELETE" /* VIDEO_DELETE */,
    userId,
    tenantId,
    resourceType: "video",
    resourceId: id,
    ipAddress,
    userAgent,
    details: {
      title: video.title,
      url: video.url
    }
  });
  return c.json({
    message: "Video deleted successfully"
  });
}));
videos.post("/:id/categories", asyncHandler(async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const { tenantId } = getTenantContext(c);
  validateUUID(id, "videoId");
  const video = await withRetry(() => db.getVideoById(id, tenantId));
  if (!video) {
    throw new NotFoundError("Video", { videoId: id });
  }
  const body = await c.req.json();
  const { categoryIds } = body;
  if (!categoryIds || !Array.isArray(categoryIds)) {
    throw new ValidationError("categoryIds must be an array");
  }
  await withRetry(() => db.setVideoCategories(id, categoryIds));
  const categories2 = await withRetry(() => db.getVideoCategories(id));
  return c.json({
    message: "Video categories updated",
    categories: categories2
  });
}));
videos.delete("/:id/categories/:catId", asyncHandler(async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const catId = c.req.param("catId");
  const { tenantId } = getTenantContext(c);
  validateUUID(id, "videoId");
  validateUUID(catId, "categoryId");
  const video = await withRetry(() => db.getVideoById(id, tenantId));
  if (!video) {
    throw new NotFoundError("Video", { videoId: id });
  }
  await withRetry(() => db.removeVideoCategory(id, catId));
  return c.json({ message: "Category removed from video" });
}));
videos.get("/:id/categories", asyncHandler(async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const { tenantId } = getTenantContext(c);
  validateUUID(id, "videoId");
  const video = await withRetry(() => db.getVideoById(id, tenantId));
  if (!video) {
    throw new NotFoundError("Video", { videoId: id });
  }
  const categories2 = await withRetry(() => db.getVideoCategories(id));
  return c.json({ categories: categories2 });
}));
videos.post("/:id/tags", asyncHandler(async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const { tenantId } = getTenantContext(c);
  validateUUID(id, "videoId");
  const video = await withRetry(() => db.getVideoById(id, tenantId));
  if (!video) {
    throw new NotFoundError("Video", { videoId: id });
  }
  const body = await c.req.json();
  const { tagIds } = body;
  if (!tagIds || !Array.isArray(tagIds)) {
    throw new ValidationError("tagIds must be an array");
  }
  await withRetry(() => db.setVideoTags(id, tagIds));
  const videoTags = await withRetry(() => db.getVideoTags(id));
  return c.json({
    message: "Video tags updated",
    tags: videoTags
  });
}));
videos.delete("/:id/tags/:tagId", asyncHandler(async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const tagId = c.req.param("tagId");
  const { tenantId } = getTenantContext(c);
  validateUUID(id, "videoId");
  validateUUID(tagId, "tagId");
  const video = await withRetry(() => db.getVideoById(id, tenantId));
  if (!video) {
    throw new NotFoundError("Video", { videoId: id });
  }
  await withRetry(() => db.removeVideoTag(id, tagId));
  return c.json({ message: "Tag removed from video" });
}));
videos.get("/:id/tags", asyncHandler(async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const { tenantId } = getTenantContext(c);
  validateUUID(id, "videoId");
  const video = await withRetry(() => db.getVideoById(id, tenantId));
  if (!video) {
    throw new NotFoundError("Video", { videoId: id });
  }
  const videoTags = await withRetry(() => db.getVideoTags(id));
  return c.json({ tags: videoTags });
}));
var videos_secure_default = videos;

// src/routes/videos-upload.ts
var upload = new Hono2();
upload.use("*", tenantIsolation);
upload.use("*", uploadRateLimit);
upload.post("/", asyncHandler(async (c) => {
  const db = c.get("db");
  const { tenantId, userId } = getTenantContext(c);
  const { ipAddress, userAgent } = getAuditContext(c);
  const rawDB = c.env.DB;
  const formData = await c.req.formData();
  const videoFile = formData.get("video");
  const title = formData.get("title");
  const description = formData.get("description") || "";
  const category = formData.get("category") || "";
  const tags2 = formData.get("tags") || "";
  if (!videoFile) {
    throw new ValidationError("Video file is required");
  }
  if (!title || !title.trim()) {
    throw new ValidationError("Title is required");
  }
  const validTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
  if (!validTypes.includes(videoFile.type)) {
    throw new ValidationError("Invalid video format. Accepted: mp4, mov, avi, mkv");
  }
  const maxSize = 500 * 1024 * 1024;
  if (videoFile.size > maxSize) {
    throw new ValidationError("Video file too large. Maximum: 500MB");
  }
  const videoId = crypto.randomUUID();
  const key = `videos/${tenantId}/${videoId}/video.mp4`;
  try {
    const arrayBuffer = await videoFile.arrayBuffer();
    await c.env.STORAGE.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: videoFile.type
      },
      customMetadata: {
        tenantId,
        userId,
        originalName: videoFile.name,
        uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    const videoUrl = `https://pub-frame-videos.r2.dev/${key}`;
    const video = {
      id: videoId,
      userId,
      tenantId,
      title: title.trim(),
      description: description.trim(),
      status: "active",
      url: videoUrl,
      thumbnailUrl: "",
      duration: 0,
      views: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await withRetry(() => db.createVideo(video));
    if (tags2 && tags2.trim()) {
      const tagList = tags2.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
      for (const tagName of tagList) {
        const tagId = crypto.randomUUID();
        try {
          await db.createTag({ id: tagId, name: tagName, tenantId }, tenantId);
        } catch (err) {
        }
        try {
          await db.addVideoTag(videoId, tagId, tenantId);
        } catch (err) {
          console.warn("Failed to add tag:", err);
        }
      }
    }
    console.log("[VIDEO_UPLOADED]", {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      videoId,
      tenantId,
      userId,
      size: videoFile.size,
      title
    });
    await logAuditEvent(rawDB, {
      eventType: "VIDEO_UPLOAD" /* VIDEO_UPLOAD */,
      userId,
      tenantId,
      resourceType: "video",
      resourceId: videoId,
      ipAddress,
      userAgent,
      details: {
        title,
        size: videoFile.size,
        type: videoFile.type
      }
    });
    return c.json({
      message: "Video uploaded successfully",
      video,
      storage: {
        key,
        size: videoFile.size,
        url: videoUrl
      }
    }, 201);
  } catch (error) {
    console.error("[UPLOAD_ERROR]", {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      videoId,
      tenantId,
      userId,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    throw new StorageError("Failed to upload video to storage", {
      videoId,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}));
upload.post("/:id/thumbnail", asyncHandler(async (c) => {
  const db = c.get("db");
  const videoId = c.req.param("id");
  const { tenantId, userId } = getTenantContext(c);
  validateUUID(videoId, "videoId");
  const video = await withRetry(() => db.getVideoById(videoId, tenantId));
  if (!video) {
    throw new ValidationError("Video not found or access denied");
  }
  const formData = await c.req.formData();
  const thumbnailFile = formData.get("thumbnail");
  if (!thumbnailFile) {
    throw new ValidationError("Thumbnail file is required");
  }
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validTypes.includes(thumbnailFile.type)) {
    throw new ValidationError("Invalid thumbnail format. Accepted: jpg, png, webp");
  }
  const key = `videos/${tenantId}/${videoId}/thumbnail.jpg`;
  try {
    const arrayBuffer = await thumbnailFile.arrayBuffer();
    await c.env.STORAGE.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: thumbnailFile.type
      },
      customMetadata: {
        tenantId,
        userId,
        uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    const thumbnailUrl = `https://pub-frame-videos.r2.dev/${key}`;
    await withRetry(() => db.updateVideo(videoId, { thumbnailUrl }, tenantId));
    console.log("[THUMBNAIL_UPLOADED]", {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      videoId,
      tenantId,
      userId
    });
    return c.json({
      message: "Thumbnail uploaded successfully",
      thumbnailUrl
    });
  } catch (error) {
    console.error("[THUMBNAIL_UPLOAD_ERROR]", {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      videoId,
      tenantId,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    throw new StorageError("Failed to upload thumbnail", {
      videoId,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}));
upload.post("/:id/auto-thumbnail", asyncHandler(async (c) => {
  const db = c.get("db");
  const videoId = c.req.param("id");
  const { tenantId, userId } = getTenantContext(c);
  validateUUID(videoId, "videoId");
  const video = await withRetry(() => db.getVideoById(videoId, tenantId));
  if (!video) {
    throw new ValidationError("Video not found or access denied");
  }
  return c.json({
    message: "Auto-thumbnail generation not yet implemented",
    note: "This feature requires video processing capabilities",
    videoId
  });
}));
var videos_upload_default = upload;

// src/middleware/auth.ts
async function authenticate(c, next) {
  const token = extractToken(c.req.header("Authorization"));
  if (!token) {
    throw new AuthenticationError("Authentication required");
  }
  const payload = await verifyToken(token);
  if (!payload) {
    throw new AuthenticationError("Invalid or expired token");
  }
  c.set("user", payload);
  await next();
}
__name(authenticate, "authenticate");
async function requireSuperAdmin(c, next) {
  const user = c.get("user");
  if (!user) {
    throw new AuthenticationError("Authentication required");
  }
  if (user.role !== "super_admin") {
    throw new AuthorizationError(
      "Super admin access required",
      {
        requiredRole: "super_admin",
        userRole: user.role
      }
    );
  }
  await next();
}
__name(requireSuperAdmin, "requireSuperAdmin");

// src/routes/tenants.ts
var tenants = new Hono2();
tenants.use("*", authenticate, requireSuperAdmin);
tenants.post("/", asyncHandler(async (c) => {
  const body = await c.req.json();
  const { name, domain } = body;
  const db = c.get("db");
  const { ipAddress, userAgent } = getAuditContext(c);
  const user = c.get("user");
  const rawDB = c.env.DB;
  validateRequired(body, ["name", "domain"]);
  const existingTenant = await withRetry(() => db.getTenantByDomain(domain));
  if (existingTenant) {
    throw new ConflictError("Domain already exists", { domain });
  }
  const tenant = {
    id: crypto.randomUUID(),
    name,
    domain,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await withRetry(() => db.createTenant(tenant));
  console.log("[TENANT_CREATED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    tenantId: tenant.id,
    name: tenant.name,
    domain: tenant.domain
  });
  await logAuditEvent(rawDB, {
    eventType: "TENANT_CREATE" /* TENANT_CREATE */,
    userId: user?.id,
    tenantId: tenant.id,
    resourceType: "tenant",
    resourceId: tenant.id,
    ipAddress,
    userAgent,
    details: {
      name: tenant.name,
      domain: tenant.domain
    }
  });
  return c.json({
    message: "Tenant created successfully",
    tenant
  }, 201);
}));
tenants.get("/domain/:domain", asyncHandler(async (c) => {
  const domain = c.req.param("domain");
  const db = c.get("db");
  const tenant = await withRetry(() => db.getTenantByDomain(domain));
  if (!tenant) {
    throw new NotFoundError("Tenant", { domain });
  }
  return c.json(tenant);
}));
tenants.get("/:id", asyncHandler(async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  validateUUID(id, "tenantId");
  const tenant = await withRetry(() => db.getTenantById(id));
  if (!tenant) {
    throw new NotFoundError("Tenant", { tenantId: id });
  }
  return c.json(tenant);
}));
var tenants_default = tenants;

// src/storage-mock.ts
var MockStorageService = class {
  static {
    __name(this, "MockStorageService");
  }
  baseUrl = "https://storage.framevideos.com";
  async uploadVideo(tenantId, videoId, file, contentType = "video/mp4") {
    const size = file instanceof ArrayBuffer ? file.byteLength : file.size;
    const key = `videos/${tenantId}/${videoId}/video.mp4`;
    return {
      key,
      url: `${this.baseUrl}/${key}`,
      size
    };
  }
  async uploadThumbnail(tenantId, videoId, file, contentType = "image/jpeg") {
    const key = `videos/${tenantId}/${videoId}/thumbnail.jpg`;
    return {
      key,
      url: `${this.baseUrl}/${key}`
    };
  }
  async getSignedUrl(key, expiresIn = 3600) {
    const token = Math.random().toString(36).substring(7);
    const expiresAt = Date.now() + expiresIn * 1e3;
    return `${this.baseUrl}/${key}?token=${token}&expires=${expiresAt}`;
  }
  async deleteVideo(tenantId, videoId) {
    return;
  }
};

// src/database-secure.ts
var SecureDatabase = class {
  static {
    __name(this, "SecureDatabase");
  }
  users = /* @__PURE__ */ new Map();
  tenants = /* @__PURE__ */ new Map();
  videos = /* @__PURE__ */ new Map();
  // ============================================
  // USER OPERATIONS
  // ============================================
  async createUser(user) {
    const tenant = await this.getTenantById(user.tenantId);
    if (!tenant) {
      throw new Error("Invalid tenantId: tenant does not exist");
    }
    this.users.set(user.id, user);
    return user;
  }
  async getUserById(id) {
    return this.users.get(id) || null;
  }
  async getUserByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }
  // ============================================
  // TENANT OPERATIONS
  // ============================================
  async createTenant(tenant) {
    this.tenants.set(tenant.id, tenant);
    return tenant;
  }
  async getTenantById(id) {
    return this.tenants.get(id) || null;
  }
  async getTenantByDomain(domain) {
    for (const tenant of this.tenants.values()) {
      if (tenant.domain === domain) return tenant;
    }
    return null;
  }
  // ============================================
  // VIDEO OPERATIONS (TENANT-ISOLATED)
  // ============================================
  /**
   * Create video - MUST include tenantId
   */
  async createVideo(video, tenantId) {
    if (video.tenantId !== tenantId) {
      throw new Error("Tenant ID mismatch: cannot create video for different tenant");
    }
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      throw new Error("Invalid tenantId: tenant does not exist");
    }
    this.videos.set(video.id, video);
    return video;
  }
  /**
   * Get video by ID - MUST validate tenantId
   */
  async getVideoById(id, tenantId) {
    const video = this.videos.get(id);
    if (!video) {
      return null;
    }
    if (video.tenantId !== tenantId) {
      console.warn("[SECURITY] Attempted cross-tenant video access", {
        videoId: id,
        videoTenantId: video.tenantId,
        requestTenantId: tenantId
      });
      return null;
    }
    return video;
  }
  /**
   * Get all videos for a specific tenant
   */
  async getVideosByTenant(tenantId) {
    const videos2 = [];
    for (const video of this.videos.values()) {
      if (video.tenantId === tenantId) {
        videos2.push(video);
      }
    }
    return videos2.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  /**
   * Search videos with filters - MUST validate tenantId
   */
  async searchVideos(tenantId, options) {
    const {
      query,
      categoryId,
      tagId,
      sortBy = "date",
      sortOrder = "desc",
      limit = 20,
      offset = 0
    } = options;
    let results = [];
    for (const video of this.videos.values()) {
      if (video.tenantId !== tenantId) {
        continue;
      }
      if (query) {
        const searchTerm = query.toLowerCase();
        const titleMatch = video.title.toLowerCase().includes(searchTerm);
        const descMatch = video.description.toLowerCase().includes(searchTerm);
        if (!titleMatch && !descMatch) {
          continue;
        }
      }
      if (categoryId) {
      }
      if (tagId) {
      }
      results.push(video);
    }
    results.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "views":
          comparison = a.views - b.views;
          break;
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "date":
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
    const total = results.length;
    const paginated = results.slice(offset, offset + limit);
    return {
      videos: paginated,
      total
    };
  }
  /**
   * Update video - MUST validate tenantId
   */
  async updateVideo(id, updates, tenantId) {
    const video = this.videos.get(id);
    if (!video) {
      return null;
    }
    if (video.tenantId !== tenantId) {
      throw new Error("Access denied: cannot update video from different tenant");
    }
    if (updates.tenantId && updates.tenantId !== tenantId) {
      throw new Error("Cannot change video tenantId");
    }
    const updated = { ...video, ...updates, tenantId: video.tenantId };
    this.videos.set(id, updated);
    return updated;
  }
  /**
   * Delete video - MUST validate tenantId
   */
  async deleteVideo(id, tenantId) {
    const video = this.videos.get(id);
    if (!video) {
      return false;
    }
    if (video.tenantId !== tenantId) {
      throw new Error("Access denied: cannot delete video from different tenant");
    }
    return this.videos.delete(id);
  }
  /**
   * Increment video views - MUST validate tenantId
   */
  async incrementVideoViews(id, tenantId) {
    const video = this.videos.get(id);
    if (!video) {
      return;
    }
    if (video.tenantId !== tenantId) {
      console.warn("[SECURITY] Attempted cross-tenant view increment", {
        videoId: id,
        videoTenantId: video.tenantId,
        requestTenantId: tenantId
      });
      return;
    }
    video.views += 1;
    this.videos.set(id, video);
  }
  // ============================================
  // ADMIN / DEBUG OPERATIONS (Use with caution)
  // ============================================
  /**
   * Get all videos (ADMIN ONLY - bypasses tenant isolation)
   * Should only be used for system administration
   */
  async getAllVideos() {
    console.warn("[ADMIN] getAllVideos called - bypassing tenant isolation");
    return Array.from(this.videos.values());
  }
  /**
   * Get database statistics per tenant
   */
  async getTenantStats(tenantId) {
    const videos2 = await this.getVideosByTenant(tenantId);
    return {
      videoCount: videos2.length,
      totalViews: videos2.reduce((sum, v) => sum + v.views, 0)
    };
  }
};
var secureDb = new SecureDatabase();

// src/routes/storage.ts
var storage = new Hono2();
async function authenticate2(c, next) {
  const token = extractToken(c.req.header("Authorization"));
  if (!token) {
    throw new AuthenticationError("Authentication required");
  }
  const payload = await verifyToken(token);
  if (!payload) {
    throw new AuthenticationError("Invalid or expired token");
  }
  c.set("user", payload);
  await next();
}
__name(authenticate2, "authenticate");
storage.post("/upload-url", authenticate2, asyncHandler(async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { videoId, contentType, expiresIn } = body;
  validateRequired(body, ["videoId"]);
  validateUUID(videoId, "videoId");
  const storageService = new MockStorageService();
  const result = await withRetry(
    () => storageService.generateUploadUrl(
      user.tenantId,
      videoId,
      contentType || "video/mp4",
      expiresIn || 3600
    ),
    { retryableErrors: ["STORAGE", "EXTERNAL_API"] }
  );
  return c.json({
    uploadUrl: result.uploadUrl,
    key: result.key,
    videoId,
    expiresIn: expiresIn || 3600
  });
}));
storage.post("/upload", authenticate2, asyncHandler(async (c) => {
  const user = c.get("user");
  const formData = await c.req.formData();
  const file = formData.get("file");
  const videoId = formData.get("videoId");
  const title = formData.get("title");
  const description = formData.get("description");
  if (!file || !videoId || !title) {
    throw new ValidationError("file, videoId, and title are required");
  }
  validateUUID(videoId, "videoId");
  const storageService = new MockStorageService();
  const buffer = await file.arrayBuffer();
  const uploadResult = await withRetry(
    () => storageService.uploadVideo(
      user.tenantId,
      videoId,
      buffer,
      {
        contentType: file.type,
        customMetadata: {
          originalName: file.name,
          uploadedBy: user.userId
        }
      }
    ),
    { retryableErrors: ["STORAGE"] }
  );
  const video = {
    id: videoId,
    tenantId: user.tenantId,
    title,
    description: description || "",
    url: uploadResult.url,
    thumbnailUrl: "",
    duration: 0,
    views: 0,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await withRetry(() => secureDb.createVideo(video));
  console.log("[VIDEO_UPLOADED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    videoId,
    tenantId: user.tenantId,
    userId: user.userId,
    size: uploadResult.size
  });
  return c.json({
    message: "Video uploaded successfully",
    video,
    storage: {
      key: uploadResult.key,
      size: uploadResult.size
    }
  }, 201);
}));
storage.post("/thumbnail/:videoId", authenticate2, asyncHandler(async (c) => {
  const user = c.get("user");
  const videoId = c.req.param("videoId");
  const formData = await c.req.formData();
  validateUUID(videoId, "videoId");
  const file = formData.get("file");
  if (!file) {
    throw new ValidationError("file is required");
  }
  const video = await withRetry(() => secureDb.getVideoById(videoId));
  if (!video) {
    throw new NotFoundError("Video", { videoId });
  }
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this video", { videoId, tenantId: user.tenantId });
  }
  const storageService = new MockStorageService();
  const buffer = await file.arrayBuffer();
  const uploadResult = await withRetry(
    () => storageService.uploadThumbnail(
      user.tenantId,
      videoId,
      buffer,
      { contentType: file.type }
    ),
    { retryableErrors: ["STORAGE"] }
  );
  await withRetry(() => secureDb.updateVideo(videoId, { thumbnailUrl: uploadResult.url }));
  console.log("[THUMBNAIL_UPLOADED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    videoId,
    tenantId: user.tenantId,
    userId: user.userId
  });
  return c.json({
    message: "Thumbnail uploaded successfully",
    thumbnail: uploadResult
  });
}));
storage.get("/signed-url/:videoId", authenticate2, asyncHandler(async (c) => {
  const user = c.get("user");
  const videoId = c.req.param("videoId");
  const expiresIn = parseInt(c.req.query("expiresIn") || "3600");
  validateUUID(videoId, "videoId");
  const video = await withRetry(() => secureDb.getVideoById(videoId));
  if (!video) {
    throw new NotFoundError("Video", { videoId });
  }
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this video", { videoId, tenantId: user.tenantId });
  }
  const storageService = new MockStorageService();
  const key = `videos/${user.tenantId}/${videoId}/video.mp4`;
  const signedUrl = await withRetry(
    () => storageService.getSignedUrl(key, { expiresIn }),
    { retryableErrors: ["STORAGE"] }
  );
  return c.json({
    signedUrl,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1e3).toISOString()
  });
}));
storage.get("/download/:videoId", authenticate2, asyncHandler(async (c) => {
  const user = c.get("user");
  const videoId = c.req.param("videoId");
  validateUUID(videoId, "videoId");
  const video = await withRetry(() => secureDb.getVideoById(videoId));
  if (!video) {
    throw new NotFoundError("Video", { videoId });
  }
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this video", { videoId, tenantId: user.tenantId });
  }
  const storageService = new MockStorageService();
  const videoObject = await withRetry(
    () => storageService.getVideo(user.tenantId, videoId),
    { retryableErrors: ["STORAGE"] }
  );
  if (!videoObject) {
    throw new StorageError("Video file not found in storage", { videoId });
  }
  return new Response(videoObject.body, {
    headers: {
      "Content-Type": videoObject.httpMetadata?.contentType || "video/mp4",
      "Content-Length": videoObject.size.toString(),
      "Content-Disposition": `attachment; filename="${video.title}.mp4"`,
      "Cache-Control": "private, max-age=3600"
    }
  });
}));
storage.get("/stream/:videoId", authenticate2, asyncHandler(async (c) => {
  const user = c.get("user");
  const videoId = c.req.param("videoId");
  validateUUID(videoId, "videoId");
  const video = await withRetry(() => secureDb.getVideoById(videoId));
  if (!video) {
    throw new NotFoundError("Video", { videoId });
  }
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this video", { videoId, tenantId: user.tenantId });
  }
  const storageService = new MockStorageService();
  const videoObject = await withRetry(
    () => storageService.getVideo(user.tenantId, videoId),
    { retryableErrors: ["STORAGE"] }
  );
  if (!videoObject) {
    throw new StorageError("Video file not found in storage", { videoId });
  }
  const range = c.req.header("Range");
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoObject.size - 1;
    const chunkSize = end - start + 1;
    const rangeObject = await c.env.STORAGE.get(
      `videos/${user.tenantId}/${videoId}/video.mp4`,
      {
        range: { offset: start, length: chunkSize }
      }
    );
    if (!rangeObject) {
      throw new StorageError("Failed to get video range", { videoId, range });
    }
    return new Response(rangeObject.body, {
      status: 206,
      headers: {
        "Content-Type": videoObject.httpMetadata?.contentType || "video/mp4",
        "Content-Length": chunkSize.toString(),
        "Content-Range": `bytes ${start}-${end}/${videoObject.size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600"
      }
    });
  }
  return new Response(videoObject.body, {
    headers: {
      "Content-Type": videoObject.httpMetadata?.contentType || "video/mp4",
      "Content-Length": videoObject.size.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600"
    }
  });
}));
storage.delete("/:videoId", authenticate2, asyncHandler(async (c) => {
  const user = c.get("user");
  const videoId = c.req.param("videoId");
  validateUUID(videoId, "videoId");
  const video = await withRetry(() => secureDb.getVideoById(videoId));
  if (!video) {
    throw new NotFoundError("Video", { videoId });
  }
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this video", { videoId, tenantId: user.tenantId });
  }
  const storageService = new MockStorageService();
  await withRetry(
    () => storageService.deleteVideo(user.tenantId, videoId),
    { retryableErrors: ["STORAGE"] }
  );
  await withRetry(() => secureDb.deleteVideo(videoId));
  console.log("[VIDEO_DELETED_FROM_STORAGE]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    videoId,
    tenantId: user.tenantId,
    userId: user.userId
  });
  return c.json({
    message: "Video deleted successfully"
  });
}));
var storage_default = storage;

// src/routes/categories.ts
var categories = new Hono2();
async function authenticate3(c, next) {
  const token = extractToken(c.req.header("Authorization"));
  if (!token) {
    throw new AuthenticationError("Authentication required");
  }
  const payload = await verifyToken(token);
  if (!payload) {
    throw new AuthenticationError("Invalid or expired token");
  }
  c.set("user", payload);
  await next();
}
__name(authenticate3, "authenticate");
function generateSlug(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
__name(generateSlug, "generateSlug");
categories.get("/", authenticate3, asyncHandler(async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const tenantCategories = await withRetry(() => db.getCategoriesByTenant(user.tenantId));
  return c.json({
    categories: tenantCategories,
    total: tenantCategories.length
  });
}));
categories.get("/:id", authenticate3, asyncHandler(async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  if (id.includes("-") && !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
    const user2 = c.get("user");
    const category2 = await withRetry(() => db.getCategoryBySlug(user2.tenantId, id));
    if (!category2) {
      throw new NotFoundError("Category", { slug: id });
    }
    return c.json(category2);
  }
  validateUUID(id, "categoryId");
  const category = await withRetry(() => db.getCategoryById(id));
  if (!category) {
    throw new NotFoundError("Category", { categoryId: id });
  }
  const user = c.get("user");
  if (category.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this category", { categoryId: id });
  }
  return c.json(category);
}));
categories.post("/", authenticate3, asyncHandler(async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const body = await c.req.json();
  const { name, description } = body;
  validateRequired(body, ["name"]);
  const slug = generateSlug(name);
  const existing = await withRetry(() => db.getCategoryBySlug(user.tenantId, slug));
  if (existing) {
    throw new ConflictError("Category with this name already exists", { name, slug });
  }
  const category = {
    id: crypto.randomUUID(),
    tenantId: user.tenantId,
    name,
    slug,
    description: description || "",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await withRetry(() => db.createCategory(category));
  console.log("[CATEGORY_CREATED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    categoryId: category.id,
    tenantId: user.tenantId,
    name
  });
  return c.json({
    message: "Category created successfully",
    category
  }, 201);
}));
categories.put("/:id", authenticate3, asyncHandler(async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const db = c.get("db");
  validateUUID(id, "categoryId");
  const category = await withRetry(() => db.getCategoryById(id));
  if (!category) {
    throw new NotFoundError("Category", { categoryId: id });
  }
  if (category.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this category", { categoryId: id });
  }
  const updates = await c.req.json();
  if (updates.name) {
    updates.slug = generateSlug(updates.name);
    const existing = await withRetry(() => db.getCategoryBySlug(user.tenantId, updates.slug));
    if (existing && existing.id !== id) {
      throw new ConflictError("Category with this name already exists", { name: updates.name });
    }
  }
  const updated = await withRetry(() => db.updateCategory(id, updates));
  console.log("[CATEGORY_UPDATED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    categoryId: id,
    tenantId: user.tenantId,
    updates: Object.keys(updates)
  });
  return c.json({
    message: "Category updated successfully",
    category: updated
  });
}));
categories.delete("/:id", authenticate3, asyncHandler(async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const db = c.get("db");
  validateUUID(id, "categoryId");
  const category = await withRetry(() => db.getCategoryById(id));
  if (!category) {
    throw new NotFoundError("Category", { categoryId: id });
  }
  if (category.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this category", { categoryId: id });
  }
  await withRetry(() => db.deleteCategory(id));
  console.log("[CATEGORY_DELETED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    categoryId: id,
    tenantId: user.tenantId
  });
  return c.json({
    message: "Category deleted successfully"
  });
}));
categories.get("/:id/videos", authenticate3, asyncHandler(async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const db = c.get("db");
  validateUUID(id, "categoryId");
  const category = await withRetry(() => db.getCategoryById(id));
  if (!category) {
    throw new NotFoundError("Category", { categoryId: id });
  }
  if (category.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this category", { categoryId: id });
  }
  const videos2 = await withRetry(() => db.getVideosByCategory(id));
  return c.json({
    category,
    videos: videos2,
    total: videos2.length
  });
}));
var categories_default = categories;

// src/routes/tags.ts
var tags = new Hono2();
async function authenticate4(c, next) {
  const token = extractToken(c.req.header("Authorization"));
  if (!token) {
    throw new AuthenticationError("Authentication required");
  }
  const payload = await verifyToken(token);
  if (!payload) {
    throw new AuthenticationError("Invalid or expired token");
  }
  c.set("user", payload);
  await next();
}
__name(authenticate4, "authenticate");
function generateSlug2(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
__name(generateSlug2, "generateSlug");
tags.get("/", authenticate4, asyncHandler(async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const tenantTags = await withRetry(() => db.getTagsByTenant(user.tenantId));
  return c.json({
    tags: tenantTags,
    total: tenantTags.length
  });
}));
tags.get("/cloud", authenticate4, asyncHandler(async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const limit = parseInt(c.req.query("limit") || "50");
  const tagCloud = await withRetry(() => db.getTagCloud(user.tenantId, limit));
  const maxCount = Math.max(...tagCloud.map((t) => t.videoCount || 0), 1);
  const weightedTags = tagCloud.map((tag) => ({
    ...tag,
    weight: Math.max(1, Math.ceil(tag.videoCount / maxCount * 5))
  }));
  return c.json({
    tags: weightedTags,
    total: weightedTags.length
  });
}));
tags.get("/autocomplete", authenticate4, asyncHandler(async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const query = c.req.query("q") || "";
  const limit = parseInt(c.req.query("limit") || "10");
  if (!query || query.length < 1) {
    return c.json({ tags: [] });
  }
  const results = await withRetry(() => db.searchTags(user.tenantId, query, limit));
  return c.json({
    tags: results,
    total: results.length
  });
}));
tags.get("/:id", authenticate4, asyncHandler(async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  if (id.includes("-") && !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
    const user2 = c.get("user");
    const tag2 = await withRetry(() => db.getTagBySlug(user2.tenantId, id));
    if (!tag2) {
      throw new NotFoundError("Tag", { slug: id });
    }
    return c.json(tag2);
  }
  validateUUID(id, "tagId");
  const tag = await withRetry(() => db.getTagById(id));
  if (!tag) {
    throw new NotFoundError("Tag", { tagId: id });
  }
  const user = c.get("user");
  if (tag.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this tag", { tagId: id });
  }
  return c.json(tag);
}));
tags.post("/", authenticate4, asyncHandler(async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const body = await c.req.json();
  const { name } = body;
  validateRequired(body, ["name"]);
  const slug = generateSlug2(name);
  const existing = await withRetry(() => db.getTagBySlug(user.tenantId, slug));
  if (existing) {
    throw new ConflictError("Tag with this name already exists", { name, slug });
  }
  const tag = {
    id: crypto.randomUUID(),
    tenantId: user.tenantId,
    name,
    slug,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await withRetry(() => db.createTag(tag));
  console.log("[TAG_CREATED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    tagId: tag.id,
    tenantId: user.tenantId,
    name
  });
  return c.json({
    message: "Tag created successfully",
    tag
  }, 201);
}));
tags.put("/:id", authenticate4, asyncHandler(async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const db = c.get("db");
  validateUUID(id, "tagId");
  const tag = await withRetry(() => db.getTagById(id));
  if (!tag) {
    throw new NotFoundError("Tag", { tagId: id });
  }
  if (tag.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this tag", { tagId: id });
  }
  const updates = await c.req.json();
  if (updates.name) {
    updates.slug = generateSlug2(updates.name);
    const existing = await withRetry(() => db.getTagBySlug(user.tenantId, updates.slug));
    if (existing && existing.id !== id) {
      throw new ConflictError("Tag with this name already exists", { name: updates.name });
    }
  }
  const updated = await withRetry(() => db.updateTag(id, updates));
  console.log("[TAG_UPDATED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    tagId: id,
    tenantId: user.tenantId,
    updates: Object.keys(updates)
  });
  return c.json({
    message: "Tag updated successfully",
    tag: updated
  });
}));
tags.delete("/:id", authenticate4, asyncHandler(async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const db = c.get("db");
  validateUUID(id, "tagId");
  const tag = await withRetry(() => db.getTagById(id));
  if (!tag) {
    throw new NotFoundError("Tag", { tagId: id });
  }
  if (tag.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this tag", { tagId: id });
  }
  await withRetry(() => db.deleteTag(id));
  console.log("[TAG_DELETED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    tagId: id,
    tenantId: user.tenantId
  });
  return c.json({
    message: "Tag deleted successfully"
  });
}));
tags.get("/:id/videos", authenticate4, asyncHandler(async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const db = c.get("db");
  validateUUID(id, "tagId");
  const tag = await withRetry(() => db.getTagById(id));
  if (!tag) {
    throw new NotFoundError("Tag", { tagId: id });
  }
  if (tag.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this tag", { tagId: id });
  }
  const videos2 = await withRetry(() => db.getVideosByTag(id));
  return c.json({
    tag,
    videos: videos2,
    total: videos2.length
  });
}));
var tags_default = tags;

// src/routes/analytics.ts
var analytics = new Hono2();
async function authenticate5(c, next) {
  const token = extractToken(c.req.header("Authorization"));
  if (!token) {
    throw new AuthenticationError("Authentication required");
  }
  const payload = await verifyToken(token);
  if (!payload) {
    throw new AuthenticationError("Invalid or expired token");
  }
  c.set("user", payload);
  await next();
}
__name(authenticate5, "authenticate");
analytics.get("/videos/:id", authenticate5, asyncHandler(async (c) => {
  const videoId = c.req.param("id");
  const user = c.get("user");
  const db = c.get("db");
  validateUUID(videoId, "videoId");
  const video = await withRetry(() => db.getVideoById(videoId));
  if (!video) {
    throw new NotFoundError("Video", { videoId });
  }
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this video", { videoId });
  }
  return c.json({
    videoId,
    title: video.title,
    views: video.views || 0,
    likes: video.likes || 0,
    comments: video.comments || 0,
    shares: video.shares || 0,
    engagementRate: ((video.likes || 0) + (video.comments || 0)) / Math.max(video.views || 1, 1),
    createdAt: video.createdAt,
    updatedAt: video.updatedAt
  });
}));
analytics.post("/videos/:id/view", asyncHandler(async (c) => {
  const db = c.get("db");
  const videoId = c.req.param("id");
  const body = await c.req.json();
  const { sessionId } = body;
  validateUUID(videoId, "videoId");
  const video = await withRetry(() => db.getVideoById(videoId));
  if (!video) {
    throw new NotFoundError("Video", { videoId });
  }
  const updatedVideo = await withRetry(
    () => db.updateVideo(videoId, {
      views: (video.views || 0) + 1
    })
  );
  console.log("[VIDEO_VIEW_TRACKED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    videoId,
    sessionId,
    totalViews: updatedVideo.views
  });
  return c.json({
    message: "View tracked successfully",
    videoId,
    views: updatedVideo.views
  });
}));
analytics.post("/videos/:id/like", authenticate5, asyncHandler(async (c) => {
  const videoId = c.req.param("id");
  const user = c.get("user");
  const db = c.get("db");
  const body = await c.req.json();
  const { liked } = body;
  validateUUID(videoId, "videoId");
  const video = await withRetry(() => db.getVideoById(videoId));
  if (!video) {
    throw new NotFoundError("Video", { videoId });
  }
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this video", { videoId });
  }
  const currentLikes = video.likes || 0;
  const newLikes = liked ? currentLikes + 1 : Math.max(currentLikes - 1, 0);
  const updatedVideo = await withRetry(
    () => db.updateVideo(videoId, {
      likes: newLikes
    })
  );
  console.log("[VIDEO_LIKE_TOGGLED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    videoId,
    userId: user.userId,
    liked,
    totalLikes: updatedVideo.likes
  });
  return c.json({
    message: "Like tracked successfully",
    videoId,
    likes: updatedVideo.likes,
    liked
  });
}));
analytics.post("/videos/:id/comment", authenticate5, asyncHandler(async (c) => {
  const videoId = c.req.param("id");
  const user = c.get("user");
  const db = c.get("db");
  const body = await c.req.json();
  const { comment } = body;
  validateUUID(videoId, "videoId");
  validateRequired(body, ["comment"]);
  const video = await withRetry(() => db.getVideoById(videoId));
  if (!video) {
    throw new NotFoundError("Video", { videoId });
  }
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this video", { videoId });
  }
  const updatedVideo = await withRetry(
    () => db.updateVideo(videoId, {
      comments: (video.comments || 0) + 1
    })
  );
  console.log("[VIDEO_COMMENT_ADDED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    videoId,
    userId: user.userId,
    totalComments: updatedVideo.comments
  });
  return c.json({
    message: "Comment tracked successfully",
    videoId,
    comments: updatedVideo.comments
  });
}));
analytics.post("/videos/:id/share", asyncHandler(async (c) => {
  const db = c.get("db");
  const videoId = c.req.param("id");
  const body = await c.req.json();
  const { platform } = body;
  validateUUID(videoId, "videoId");
  validateRequired(body, ["platform"]);
  const video = await withRetry(() => db.getVideoById(videoId));
  if (!video) {
    throw new NotFoundError("Video", { videoId });
  }
  const updatedVideo = await withRetry(
    () => db.updateVideo(videoId, {
      shares: (video.shares || 0) + 1
    })
  );
  console.log("[VIDEO_SHARE_TRACKED]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    videoId,
    platform,
    totalShares: updatedVideo.shares
  });
  return c.json({
    message: "Share tracked successfully",
    videoId,
    shares: updatedVideo.shares,
    platform
  });
}));
analytics.get("/dashboard", authenticate5, asyncHandler(async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const videos2 = await withRetry(
    () => db.getVideosByTenant(user.tenantId)
  );
  const totalViews = videos2.reduce((sum, v) => sum + (v.views || 0), 0);
  const totalLikes = videos2.reduce((sum, v) => sum + (v.likes || 0), 0);
  const totalComments = videos2.reduce((sum, v) => sum + (v.comments || 0), 0);
  const totalShares = videos2.reduce((sum, v) => sum + (v.shares || 0), 0);
  const engagementRate = (totalLikes + totalComments) / Math.max(totalViews, 1);
  const topVideosByViews = videos2.sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10).map((v) => ({
    id: v.id,
    title: v.title,
    views: v.views || 0,
    likes: v.likes || 0,
    comments: v.comments || 0,
    shares: v.shares || 0
  }));
  const topVideosByEngagement = videos2.map((v) => ({
    id: v.id,
    title: v.title,
    views: v.views || 0,
    likes: v.likes || 0,
    comments: v.comments || 0,
    shares: v.shares || 0,
    engagement: (v.likes || 0) + (v.comments || 0)
  })).sort((a, b) => b.engagement - a.engagement).slice(0, 10).map(({ engagement, ...rest }) => rest);
  return c.json({
    summary: {
      totalVideos: videos2.length,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      engagementRate: parseFloat(engagementRate.toFixed(4))
    },
    topVideosByViews,
    topVideosByEngagement
  });
}));
analytics.get("/trending", asyncHandler(async (c) => {
  const db = c.get("db");
  const limit = parseInt(c.req.query("limit") || "10");
  const period = c.req.query("period") || "7d";
  const videos2 = await withRetry(() => db.getAllVideos());
  const trending = videos2.sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, limit).map((v) => ({
    id: v.id,
    title: v.title,
    description: v.description,
    thumbnailUrl: v.thumbnailUrl,
    views: v.views || 0,
    likes: v.likes || 0,
    duration: v.duration,
    createdAt: v.createdAt
  }));
  return c.json({
    trending,
    period,
    total: trending.length
  });
}));
analytics.get("/videos/:id/metrics", authenticate5, asyncHandler(async (c) => {
  const videoId = c.req.param("id");
  const user = c.get("user");
  const db = c.get("db");
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");
  validateUUID(videoId, "videoId");
  const video = await withRetry(() => db.getVideoById(videoId));
  if (!video) {
    throw new NotFoundError("Video", { videoId });
  }
  if (video.tenantId !== user.tenantId) {
    throw new AuthorizationError("Access denied to this video", { videoId });
  }
  return c.json({
    videoId,
    title: video.title,
    period: {
      startDate: startDate || "all-time",
      endDate: endDate || "now"
    },
    metrics: {
      views: video.views || 0,
      likes: video.likes || 0,
      comments: video.comments || 0,
      shares: video.shares || 0,
      engagementRate: ((video.likes || 0) + (video.comments || 0)) / Math.max(video.views || 1, 1)
    }
  });
}));
var analytics_default = analytics;

// src/routes/audit.ts
var audit = new Hono2();
audit.get("/logs", requireSuperAdmin, async (c) => {
  try {
    const db = c.env.DB;
    const eventType = c.req.query("event_type");
    const userId = c.req.query("user_id");
    const tenantId = c.req.query("tenant_id");
    const startDate = c.req.query("start_date");
    const endDate = c.req.query("end_date");
    const limit = parseInt(c.req.query("limit") || "100");
    const offset = parseInt(c.req.query("offset") || "0");
    const logs = await queryAuditLogs(db, {
      eventType,
      userId,
      tenantId,
      startDate,
      endDate,
      limit,
      offset
    });
    return c.json({
      success: true,
      data: logs,
      pagination: {
        limit,
        offset,
        count: logs.length
      }
    });
  } catch (error) {
    console.error("[AUDIT_LOGS_ERROR]", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch audit logs",
        message: error.message
      },
      500
    );
  }
});
audit.get("/stats", requireSuperAdmin, async (c) => {
  try {
    const db = c.env.DB;
    const startDate = c.req.query("start_date");
    const endDate = c.req.query("end_date");
    const stats = await getAuditStats(db, {
      startDate,
      endDate
    });
    return c.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("[AUDIT_STATS_ERROR]", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch audit stats",
        message: error.message
      },
      500
    );
  }
});
audit.get("/event-types", requireSuperAdmin, async (c) => {
  return c.json({
    success: true,
    data: Object.values(AuditEventType)
  });
});
var audit_default = audit;

// src/routes/gdpr.ts
var gdpr = new Hono2();
async function authenticateUser(c) {
  const token = extractToken(c);
  if (!token) {
    throw new AuthenticationError("No token provided");
  }
  const decoded = await verifyToken(token);
  if (!decoded || !decoded.userId) {
    throw new AuthenticationError("Invalid token");
  }
  const db = c.get("db");
  const user = await db.getUserById(decoded.userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  if (user.deletedAt) {
    throw new AuthenticationError("User account has been deleted");
  }
  return user;
}
__name(authenticateUser, "authenticateUser");
gdpr.get("/users/me/data", asyncHandler(async (c) => {
  const user = await authenticateUser(c);
  const db = c.get("db");
  const rawDB = c.env.DB;
  const userData = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      createdAt: user.createdAt,
      privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt || null,
      termsAcceptedAt: user.termsAcceptedAt || null
    },
    videos: [],
    analytics: [],
    favorites: [],
    comments: []
  };
  try {
    const videos2 = await rawDB.prepare("SELECT id, title, description, status, duration, url, thumbnail_url, created_at, updated_at FROM videos WHERE user_id = ? AND tenant_id = ?").bind(user.id, user.tenantId).all();
    userData.videos = videos2.results || [];
  } catch (error) {
    console.error("Error fetching videos:", error);
  }
  try {
    const analytics2 = await rawDB.prepare("SELECT id, video_id, event_type, metadata, created_at FROM analytics WHERE user_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 1000").bind(user.id, user.tenantId).all();
    userData.analytics = analytics2.results || [];
  } catch (error) {
    console.error("Error fetching analytics:", error);
  }
  try {
    const favorites = await rawDB.prepare("SELECT video_id, created_at FROM favorites WHERE user_id = ?").bind(user.id).all();
    userData.favorites = favorites.results || [];
  } catch (error) {
  }
  try {
    const comments = await rawDB.prepare("SELECT id, video_id, content, created_at FROM comments WHERE user_id = ?").bind(user.id).all();
    userData.comments = comments.results || [];
  } catch (error) {
  }
  return c.json({
    success: true,
    data: userData,
    exportedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}));
gdpr.delete("/users/me/delete", asyncHandler(async (c) => {
  const user = await authenticateUser(c);
  const rawDB = c.env.DB;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await rawDB.prepare(`
      UPDATE users 
      SET 
        deleted_at = ?,
        email = ?,
        name = ?,
        password = ?
      WHERE id = ? AND tenant_id = ?
    `).bind(
    now,
    `deleted_${user.id}@anonymized.local`,
    "Deleted User",
    "DELETED",
    user.id,
    user.tenantId
  ).run();
  await rawDB.prepare(`
      UPDATE videos 
      SET 
        title = 'Deleted Video',
        description = 'This video has been deleted by the user'
      WHERE user_id = ? AND tenant_id = ?
    `).bind(user.id, user.tenantId).run();
  await rawDB.prepare("DELETE FROM analytics WHERE user_id = ? AND tenant_id = ?").bind(user.id, user.tenantId).run();
  try {
    await rawDB.prepare("DELETE FROM favorites WHERE user_id = ?").bind(user.id).run();
  } catch (error) {
  }
  try {
    await rawDB.prepare(`
        UPDATE comments 
        SET content = '[deleted]', user_id = NULL 
        WHERE user_id = ?
      `).bind(user.id).run();
  } catch (error) {
  }
  try {
    await rawDB.prepare("DELETE FROM login_attempts WHERE email = ?").bind(user.email).run();
  } catch (error) {
  }
  try {
    await rawDB.prepare("DELETE FROM account_lockouts WHERE user_id = ?").bind(user.id).run();
  } catch (error) {
  }
  return c.json({
    success: true,
    message: "Your account has been deleted and your personal data has been anonymized",
    deletedAt: now
  });
}));

// src/database-d1.ts
var D1Database = class {
  constructor(db) {
    this.db = db;
  }
  static {
    __name(this, "D1Database");
  }
  // ============================================================================
  // Tenants
  // ============================================================================
  async createTenant(tenant) {
    await this.db.prepare("INSERT INTO tenants (id, name, domain, created_at) VALUES (?, ?, ?, ?)").bind(tenant.id, tenant.name, tenant.domain, tenant.createdAt).run();
    return tenant;
  }
  async getTenantById(id) {
    const result = await this.db.prepare("SELECT * FROM tenants WHERE id = ?").bind(id).first();
    if (!result) return null;
    return {
      id: result.id,
      name: result.name,
      domain: result.domain,
      createdAt: result.created_at
    };
  }
  async getTenantByDomain(domain) {
    const result = await this.db.prepare("SELECT * FROM tenants WHERE domain = ?").bind(domain).first();
    if (!result) return null;
    return {
      id: result.id,
      name: result.name,
      domain: result.domain,
      createdAt: result.created_at
    };
  }
  // ============================================================================
  // Users
  // ============================================================================
  async createUser(user) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await this.db.prepare(`
        INSERT INTO users (
          id, email, password, tenant_id, name, role, created_at,
          privacy_policy_accepted_at, terms_accepted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
      user.id,
      user.email,
      user.password,
      user.tenantId,
      user.name || "",
      user.role || "user",
      user.createdAt,
      user.privacyPolicyAcceptedAt || now,
      user.termsAcceptedAt || now
    ).run();
    return user;
  }
  async getUserByEmail(email) {
    const result = await this.db.prepare("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL").bind(email).first();
    if (!result) return null;
    return {
      id: result.id,
      email: result.email,
      password: result.password,
      name: result.name,
      role: result.role || "user",
      tenantId: result.tenant_id,
      createdAt: result.created_at,
      deletedAt: result.deleted_at || null,
      privacyPolicyAcceptedAt: result.privacy_policy_accepted_at || null,
      termsAcceptedAt: result.terms_accepted_at || null
    };
  }
  async getUserById(id) {
    const result = await this.db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!result) return null;
    return {
      id: result.id,
      email: result.email,
      password: result.password,
      name: result.name,
      role: result.role || "user",
      tenantId: result.tenant_id,
      createdAt: result.created_at,
      deletedAt: result.deleted_at || null,
      privacyPolicyAcceptedAt: result.privacy_policy_accepted_at || null,
      termsAcceptedAt: result.terms_accepted_at || null
    };
  }
  async getUsersByTenant(tenantId) {
    const result = await this.db.prepare("SELECT * FROM users WHERE tenant_id = ?").bind(tenantId).all();
    return result.results;
  }
  // ============================================================================
  // Videos
  // ============================================================================
  async createVideo(video) {
    await this.db.prepare(`
        INSERT INTO videos (id, title, description, status, duration, url, thumbnail_url, user_id, tenant_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
      video.id,
      video.title,
      video.description || null,
      video.status || "pending",
      video.duration || null,
      video.url || null,
      video.thumbnailUrl || video.thumbnail_url || null,
      video.userId || video.user_id,
      video.tenantId || video.tenant_id,
      video.createdAt || video.created_at,
      video.updatedAt || video.updated_at || null
    ).run();
    return video;
  }
  async getVideoById(id, tenantId) {
    if (tenantId) {
      const result2 = await this.db.prepare("SELECT * FROM videos WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first();
      return result2 || null;
    }
    const result = await this.db.prepare("SELECT * FROM videos WHERE id = ?").bind(id).first();
    return result || null;
  }
  async getVideosByTenant(tenantId, limit = 50, offset = 0) {
    const result = await this.db.prepare("SELECT * FROM videos WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(tenantId, limit, offset).all();
    return result.results;
  }
  async getVideosByUser(userId, limit = 50, offset = 0) {
    const result = await this.db.prepare("SELECT * FROM videos WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(userId, limit, offset).all();
    return result.results;
  }
  async getAllVideos(limit = 100, offset = 0) {
    const result = await this.db.prepare("SELECT * FROM videos ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
    return result.results;
  }
  async updateVideo(id, updates) {
    const video = await this.getVideoById(id);
    if (!video) return null;
    const updatedVideo = { ...video, ...updates, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    await this.db.prepare(`
        UPDATE videos 
        SET title = ?, description = ?, status = ?, duration = ?, url = ?, thumbnail_url = ?, updated_at = ?
        WHERE id = ?
      `).bind(
      updatedVideo.title,
      updatedVideo.description || null,
      updatedVideo.status,
      updatedVideo.duration || null,
      updatedVideo.url || updatedVideo.thumbnail_url || null,
      updatedVideo.thumbnail_url || null,
      updatedVideo.updated_at,
      id
    ).run();
    return updatedVideo;
  }
  async deleteVideo(id) {
    const result = await this.db.prepare("DELETE FROM videos WHERE id = ?").bind(id).run();
    return result.success;
  }
  async incrementVideoViews(id, tenantId) {
    await this.db.prepare("INSERT INTO analytics (id, video_id, event_type, tenant_id, created_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), id, "view", tenantId || "", (/* @__PURE__ */ new Date()).toISOString()).run();
  }
  async searchVideos(tenantId, query, limit = 50) {
    const searchPattern = `%${query}%`;
    const result = await this.db.prepare(`
        SELECT * FROM videos 
        WHERE tenant_id = ? AND (title LIKE ? OR description LIKE ?)
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(tenantId, searchPattern, searchPattern, limit).all();
    return result.results;
  }
  // ============================================================================
  // Categories
  // ============================================================================
  async createCategory(category) {
    await this.db.prepare("INSERT INTO categories (id, name, slug, description, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(category.id, category.name, category.slug, category.description || null, category.tenantId, category.createdAt).run();
    return category;
  }
  async getCategoryById(id) {
    const result = await this.db.prepare("SELECT id, name, slug, description, tenant_id as tenantId, created_at as createdAt FROM categories WHERE id = ?").bind(id).first();
    return result;
  }
  async getCategoryBySlug(tenantId, slug) {
    const result = await this.db.prepare("SELECT id, name, slug, description, tenant_id as tenantId, created_at as createdAt FROM categories WHERE tenant_id = ? AND slug = ?").bind(tenantId, slug).first();
    return result;
  }
  async getCategoriesByTenant(tenantId) {
    const result = await this.db.prepare(`
        SELECT c.id, c.name, c.slug, c.description, c.tenant_id as tenantId, c.created_at as createdAt,
               COUNT(vc.video_id) as videoCount
        FROM categories c
        LEFT JOIN video_categories vc ON c.id = vc.category_id
        WHERE c.tenant_id = ?
        GROUP BY c.id
        ORDER BY c.name ASC
      `).bind(tenantId).all();
    return result.results;
  }
  async updateCategory(id, updates) {
    const category = await this.getCategoryById(id);
    if (!category) return null;
    const updated = {
      ...category,
      name: updates.name ?? category.name,
      slug: updates.slug ?? category.slug,
      description: updates.description ?? category.description
    };
    await this.db.prepare("UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?").bind(updated.name, updated.slug, updated.description || null, id).run();
    return updated;
  }
  async deleteCategory(id) {
    await this.db.prepare("DELETE FROM video_categories WHERE category_id = ?").bind(id).run();
    const result = await this.db.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
    return result.success;
  }
  async getVideosByCategory(categoryId) {
    const result = await this.db.prepare(`
        SELECT v.* FROM videos v
        INNER JOIN video_categories vc ON v.id = vc.video_id
        WHERE vc.category_id = ?
        ORDER BY v.created_at DESC
      `).bind(categoryId).all();
    return result.results;
  }
  // ============================================================================
  // Tags
  // ============================================================================
  async createTag(tag) {
    await this.db.prepare("INSERT INTO tags (id, name, slug, tenant_id, created_at) VALUES (?, ?, ?, ?, ?)").bind(tag.id, tag.name, tag.slug, tag.tenantId, tag.createdAt).run();
    return tag;
  }
  async getTagById(id) {
    const result = await this.db.prepare("SELECT id, name, slug, tenant_id as tenantId, created_at as createdAt FROM tags WHERE id = ?").bind(id).first();
    return result;
  }
  async getTagBySlug(tenantId, slug) {
    const result = await this.db.prepare("SELECT id, name, slug, tenant_id as tenantId, created_at as createdAt FROM tags WHERE tenant_id = ? AND slug = ?").bind(tenantId, slug).first();
    return result;
  }
  async getTagsByTenant(tenantId) {
    const result = await this.db.prepare(`
        SELECT t.id, t.name, t.slug, t.tenant_id as tenantId, t.created_at as createdAt,
               COUNT(vt.video_id) as videoCount
        FROM tags t
        LEFT JOIN video_tags vt ON t.id = vt.tag_id
        WHERE t.tenant_id = ?
        GROUP BY t.id
        ORDER BY t.name ASC
      `).bind(tenantId).all();
    return result.results;
  }
  async updateTag(id, updates) {
    const tag = await this.getTagById(id);
    if (!tag) return null;
    const updated = {
      ...tag,
      name: updates.name ?? tag.name,
      slug: updates.slug ?? tag.slug
    };
    await this.db.prepare("UPDATE tags SET name = ?, slug = ? WHERE id = ?").bind(updated.name, updated.slug, id).run();
    return updated;
  }
  async deleteTag(id) {
    await this.db.prepare("DELETE FROM video_tags WHERE tag_id = ?").bind(id).run();
    const result = await this.db.prepare("DELETE FROM tags WHERE id = ?").bind(id).run();
    return result.success;
  }
  async getVideosByTag(tagId) {
    const result = await this.db.prepare(`
        SELECT v.* FROM videos v
        INNER JOIN video_tags vt ON v.id = vt.video_id
        WHERE vt.tag_id = ?
        ORDER BY v.created_at DESC
      `).bind(tagId).all();
    return result.results;
  }
  async getTagCloud(tenantId, limit = 50) {
    const result = await this.db.prepare(`
        SELECT t.id, t.name, t.slug, t.tenant_id as tenantId, t.created_at as createdAt,
               COUNT(vt.video_id) as videoCount
        FROM tags t
        LEFT JOIN video_tags vt ON t.id = vt.tag_id
        WHERE t.tenant_id = ?
        GROUP BY t.id
        ORDER BY videoCount DESC, t.name ASC
        LIMIT ?
      `).bind(tenantId, limit).all();
    return result.results;
  }
  async searchTags(tenantId, query, limit = 10) {
    const searchPattern = `%${query}%`;
    const result = await this.db.prepare(`
        SELECT id, name, slug, tenant_id as tenantId, created_at as createdAt
        FROM tags
        WHERE tenant_id = ? AND name LIKE ?
        ORDER BY name ASC
        LIMIT ?
      `).bind(tenantId, searchPattern, limit).all();
    return result.results;
  }
  async searchCategories(tenantId, query, limit = 10) {
    const searchPattern = `%${query}%`;
    const result = await this.db.prepare(`
        SELECT id, name, slug, description, tenant_id as tenantId, created_at as createdAt
        FROM categories
        WHERE tenant_id = ? AND name LIKE ?
        ORDER BY name ASC
        LIMIT ?
      `).bind(tenantId, searchPattern, limit).all();
    return result.results;
  }
  // ============================================================================
  // Video-Category Relations
  // ============================================================================
  async addVideoCategory(videoId, categoryId) {
    await this.db.prepare("INSERT OR IGNORE INTO video_categories (video_id, category_id) VALUES (?, ?)").bind(videoId, categoryId).run();
  }
  async removeVideoCategory(videoId, categoryId) {
    await this.db.prepare("DELETE FROM video_categories WHERE video_id = ? AND category_id = ?").bind(videoId, categoryId).run();
  }
  async getVideoCategories(videoId) {
    const result = await this.db.prepare(`
        SELECT c.id, c.name, c.slug, c.description, c.tenant_id as tenantId, c.created_at as createdAt
        FROM categories c
        INNER JOIN video_categories vc ON c.id = vc.category_id
        WHERE vc.video_id = ?
      `).bind(videoId).all();
    return result.results;
  }
  async setVideoCategories(videoId, categoryIds) {
    await this.db.prepare("DELETE FROM video_categories WHERE video_id = ?").bind(videoId).run();
    for (const catId of categoryIds) {
      await this.addVideoCategory(videoId, catId);
    }
  }
  // ============================================================================
  // Video-Tag Relations
  // ============================================================================
  async addVideoTag(videoId, tagId) {
    await this.db.prepare("INSERT OR IGNORE INTO video_tags (video_id, tag_id) VALUES (?, ?)").bind(videoId, tagId).run();
  }
  async removeVideoTag(videoId, tagId) {
    await this.db.prepare("DELETE FROM video_tags WHERE video_id = ? AND tag_id = ?").bind(videoId, tagId).run();
  }
  async getVideoTags(videoId) {
    const result = await this.db.prepare(`
        SELECT t.id, t.name, t.slug, t.tenant_id as tenantId, t.created_at as createdAt
        FROM tags t
        INNER JOIN video_tags vt ON t.id = vt.tag_id
        WHERE vt.video_id = ?
      `).bind(videoId).all();
    return result.results;
  }
  async setVideoTags(videoId, tagIds) {
    await this.db.prepare("DELETE FROM video_tags WHERE video_id = ?").bind(videoId).run();
    for (const tagId of tagIds) {
      await this.addVideoTag(videoId, tagId);
    }
  }
  // ============================================================================
  // Analytics
  // ============================================================================
  async createAnalyticsEvent(event) {
    await this.db.prepare("INSERT INTO analytics (id, video_id, event_type, user_id, tenant_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
      event.id,
      event.videoId,
      event.eventType,
      event.userId || null,
      event.tenantId,
      event.metadata ? JSON.stringify(event.metadata) : null,
      event.createdAt
    ).run();
  }
  async getVideoAnalytics(videoId, eventType) {
    let query = "SELECT * FROM analytics WHERE video_id = ?";
    const params = [videoId];
    if (eventType) {
      query += " AND event_type = ?";
      params.push(eventType);
    }
    query += " ORDER BY created_at DESC";
    const result = await this.db.prepare(query).bind(...params).all();
    return result.results;
  }
  async getTrendingVideos(tenantId, limit = 10) {
    const result = await this.db.prepare(`
        SELECT v.*, COUNT(a.id) as view_count
        FROM videos v
        LEFT JOIN analytics a ON v.id = a.video_id AND a.event_type = 'view'
        WHERE v.tenant_id = ?
        GROUP BY v.id
        ORDER BY view_count DESC, v.created_at DESC
        LIMIT ?
      `).bind(tenantId, limit).all();
    return result.results;
  }
};

// src/middleware/security-headers.ts
var securityHeaders = /* @__PURE__ */ __name(() => {
  return async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("X-XSS-Protection", "1; mode=block");
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    );
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  };
}, "securityHeaders");

// src/index-secure.ts
var app = new Hono2();
app.use("*", async (c, next) => {
  c.set("db", new D1Database(c.env.DB));
  await next();
});
app.use("*", logger());
app.use("*", cors({
  origin: ["http://localhost:3000", "http://localhost:3001", "https://framevideos.com", "https://*.framevideos.com", "https://production.frame-videos-frontend.pages.dev", "https://*.frame-videos-frontend.pages.dev"],
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Range"],
  exposeHeaders: ["Content-Range", "Accept-Ranges", "Content-Length"]
}));
app.use("*", securityHeaders());
app.use("*", auditContextMiddleware);
app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);
  await next();
});
app.use("/api/v1/*", publicRateLimit);
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    environment: c.env.ENVIRONMENT || "development",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    security: {
      tenantIsolation: "enabled",
      rowLevelSecurity: "enabled",
      auditLogging: "enabled",
      errorHandling: "enabled"
    }
  });
});
app.get("/api/v1", (c) => {
  return c.json({
    name: "Frame Videos API",
    version: "1.0.0",
    security: {
      tenantIsolation: "enabled",
      authentication: "JWT",
      errorHandling: "centralized",
      documentation: "/docs/MULTI_TENANT.md"
    },
    endpoints: {
      health: "/health",
      auth: "/api/v1/auth",
      videos: "/api/v1/videos",
      videosUpload: "/api/v1/videos/upload",
      tenants: "/api/v1/tenants",
      storage: "/api/v1/storage",
      categories: "/api/v1/categories",
      tags: "/api/v1/tags",
      analytics: "/api/v1/analytics",
      audit: "/api/v1/audit (super_admin only)",
      gdpr: "/api/v1/users/me/data (GET), /api/v1/users/me/delete (DELETE)"
    }
  });
});
app.route("/api/v1/auth", auth_secure_default);
app.route("/api/v1/videos/upload", videos_upload_default);
app.route("/api/v1/videos", videos_secure_default);
app.route("/api/v1/tenants", tenants_default);
app.route("/api/v1/storage", storage_default);
app.route("/api/v1/categories", categories_default);
app.route("/api/v1/tags", tags_default);
app.route("/api/v1/analytics", analytics_default);
app.route("/api/v1/audit", audit_default);
app.route("/api/v1", gdpr);
app.notFound((c) => {
  const requestId = c.get("requestId") || "unknown";
  console.warn("[NOT_FOUND]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    path: c.req.path,
    method: c.req.method,
    requestId
  });
  return c.json({
    error: {
      message: "Endpoint not found",
      code: 404,
      category: "NOT_FOUND",
      requestId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      context: {
        path: c.req.path,
        method: c.req.method
      }
    }
  }, 404);
});
app.onError((err, c) => {
  const requestId = c.get("requestId") || "unknown";
  console.error("[ERROR]", {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    requestId,
    error: err.message,
    stack: err.stack
  });
  if (err instanceof FrameVideosError) {
    return c.json({
      error: {
        message: err.message,
        code: err.statusCode,
        category: err.category,
        requestId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        details: err.details
      }
    }, err.statusCode);
  }
  return c.json({
    error: {
      message: "Internal server error",
      code: 500,
      category: "INTERNAL",
      requestId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }
  }, 500);
});
var index_secure_default = app;
export {
  index_secure_default as default
};
//# sourceMappingURL=index-secure.js.map
