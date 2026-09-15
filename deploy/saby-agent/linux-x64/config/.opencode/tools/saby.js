// @bun
// .opencode/tools/saby.ts
import { tool } from "@opencode-ai/plugin";

// packages/copilot-saby/src/auth/session.ts
import { existsSync } from "fs";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
function sabyHomeDir() {
  const base = process.env.SABY_HOME;
  if (base !== undefined && base !== "")
    return base;
  return join(homedir(), ".saby");
}
function authSessionPath() {
  return join(sabyHomeDir(), "auth.json");
}
async function loadAuthSession() {
  const path = authSessionPath();
  if (!existsSync(path))
    return null;
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    if (typeof parsed.accessToken !== "string" || parsed.accessToken === "")
      return null;
    return parsed;
  } catch {
    return null;
  }
}
async function saveAuthSession(session) {
  await mkdir(sabyHomeDir(), { recursive: true });
  await writeFile(authSessionPath(), JSON.stringify(session, null, 2), { mode: 384 });
}
function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length < 2)
    throw new Error("malformed token");
  const raw = Buffer.from(parts[1], "base64url").toString("utf8");
  return JSON.parse(raw);
}

// packages/copilot-saby/embed/backend-client.ts
var sessionFromClaims = (backendBaseUrl, accessToken, refreshToken) => {
  const claims = decodeJwtPayload(accessToken);
  return {
    backendBaseUrl,
    accessToken,
    refreshToken,
    email: typeof claims.email === "string" ? claims.email : undefined,
    userId: typeof claims.sub === "string" ? claims.sub : undefined,
    tenantId: typeof claims.tenantId === "string" ? claims.tenantId : undefined,
    isOwner: Boolean(claims.isOwner),
    isSaby: Boolean(claims.isSaby),
    expiresAt: typeof claims.exp === "number" ? claims.exp * 1000 : undefined,
    updatedAt: Date.now()
  };
};
var backendClient = (config) => {
  let accessToken;
  let refreshToken;
  const applySession = (session) => {
    accessToken = session.accessToken;
    refreshToken = session.refreshToken;
  };
  const persist = async (session) => {
    if (config.saveSession !== undefined)
      await config.saveSession(session);
  };
  const readPersisted = async () => {
    if (config.readSession === undefined)
      return null;
    const session = await config.readSession();
    if (session === null)
      return null;
    if (session.expiresAt !== undefined && Date.now() > session.expiresAt)
      return null;
    return session;
  };
  const login = async () => {
    const persisted = await readPersisted();
    if (persisted !== null) {
      applySession(persisted);
      return;
    }
    const response = await fetch(`${config.baseUrl}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: config.email, password: config.password })
    });
    if (!response.ok)
      throw new Error(await response.text());
    const body = await response.json();
    const token = body.tokens?.access?.token;
    if (token === undefined)
      throw new Error("no access token in login response");
    const session = sessionFromClaims(config.baseUrl, token, body.tokens?.refresh?.token);
    applySession(session);
    await persist(session);
  };
  const refresh = async () => {
    if (refreshToken === undefined)
      throw new Error("no refresh token available");
    const response = await fetch(`${config.baseUrl}/v1/auth/refresh-tokens`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    if (!response.ok)
      throw new Error(await response.text());
    const body = await response.json();
    const token = body.access?.token;
    if (token === undefined)
      throw new Error("no access token in refresh response");
    const session = sessionFromClaims(config.baseUrl, token, body.refresh?.token ?? refreshToken);
    applySession(session);
    await persist(session);
  };
  const authedFetch = async (path, init) => {
    const execute = async (token) => fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...init.headers ?? {}
      }
    });
    if (accessToken === undefined)
      await login();
    let response = await execute(accessToken);
    if (response.status === 401 || response.status === 403) {
      await refresh();
      response = await execute(accessToken);
    }
    if (!response.ok)
      throw new Error(await response.text());
    return await response.json();
  };
  const callTool = (toolName, payload) => authedFetch(`/v1/copilot/tools/${encodeURIComponent(toolName)}/call`, {
    method: "POST",
    body: JSON.stringify({ payload })
  });
  const getActionEvent = (eventId) => authedFetch(`/v1/copilot/actions/${encodeURIComponent(eventId)}`, { method: "GET" });
  const searchEntities = (params = {}) => authedFetch("/v1/copilot/search", {
    method: "POST",
    body: JSON.stringify({
      query: String(params.query ?? ""),
      entityTypes: params.entityTypes ?? [],
      limit: Math.max(1, Math.min(5, Number(params.limit) || 5))
    })
  });
  return { callTool, getActionEvent, searchEntities };
};
// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Pipeable.js
var pipeArguments = (self, args) => {
  switch (args.length) {
    case 0:
      return self;
    case 1:
      return args[0](self);
    case 2:
      return args[1](args[0](self));
    case 3:
      return args[2](args[1](args[0](self)));
    case 4:
      return args[3](args[2](args[1](args[0](self))));
    case 5:
      return args[4](args[3](args[2](args[1](args[0](self)))));
    case 6:
      return args[5](args[4](args[3](args[2](args[1](args[0](self))))));
    case 7:
      return args[6](args[5](args[4](args[3](args[2](args[1](args[0](self)))))));
    case 8:
      return args[7](args[6](args[5](args[4](args[3](args[2](args[1](args[0](self))))))));
    case 9:
      return args[8](args[7](args[6](args[5](args[4](args[3](args[2](args[1](args[0](self)))))))));
    default: {
      let ret = self;
      for (let i = 0, len = args.length;i < len; i++) {
        ret = args[i](ret);
      }
      return ret;
    }
  }
};
var Prototype = {
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var Class = /* @__PURE__ */ function() {
  function PipeableBase() {}
  PipeableBase.prototype = Prototype;
  return PipeableBase;
}();

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Function.js
var dual = function(arity, body) {
  if (typeof arity === "function") {
    return function() {
      return arity(arguments) ? body.apply(this, arguments) : (self) => body(self, ...arguments);
    };
  }
  switch (arity) {
    case 0:
    case 1:
      throw new RangeError(`Invalid arity ${arity}`);
    case 2:
      return function(a, b) {
        if (arguments.length >= 2) {
          return body(a, b);
        }
        return function(self) {
          return body(self, a);
        };
      };
    case 3:
      return function(a, b, c) {
        if (arguments.length >= 3) {
          return body(a, b, c);
        }
        return function(self) {
          return body(self, a, b);
        };
      };
    default:
      return function() {
        if (arguments.length >= arity) {
          return body.apply(this, arguments);
        }
        const args = arguments;
        return function(self) {
          return body(self, ...args);
        };
      };
  }
};
var identity = (a) => a;
var constant = (value) => () => value;
var constTrue = /* @__PURE__ */ constant(true);
var constFalse = /* @__PURE__ */ constant(false);
var constUndefined = /* @__PURE__ */ constant(undefined);
var constVoid = constUndefined;
function flow(ab, bc, cd, de, ef, fg, gh, hi, ij) {
  switch (arguments.length) {
    case 1:
      return ab;
    case 2:
      return function() {
        return bc(ab.apply(this, arguments));
      };
    case 3:
      return function() {
        return cd(bc(ab.apply(this, arguments)));
      };
    case 4:
      return function() {
        return de(cd(bc(ab.apply(this, arguments))));
      };
    case 5:
      return function() {
        return ef(de(cd(bc(ab.apply(this, arguments)))));
      };
    case 6:
      return function() {
        return fg(ef(de(cd(bc(ab.apply(this, arguments))))));
      };
    case 7:
      return function() {
        return gh(fg(ef(de(cd(bc(ab.apply(this, arguments)))))));
      };
    case 8:
      return function() {
        return hi(gh(fg(ef(de(cd(bc(ab.apply(this, arguments))))))));
      };
    case 9:
      return function() {
        return ij(hi(gh(fg(ef(de(cd(bc(ab.apply(this, arguments)))))))));
      };
  }
  return;
}
function memoize(f) {
  const cache = new WeakMap;
  return (a) => {
    if (cache.has(a)) {
      return cache.get(a);
    }
    const result = f(a);
    cache.set(a, result);
    return result;
  };
}

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/equal.js
var getAllObjectKeys = (obj) => {
  const keys = new Set(Reflect.ownKeys(obj));
  if (obj.constructor === Object)
    return keys;
  if (obj instanceof Error) {
    keys.delete("stack");
  }
  const proto = Object.getPrototypeOf(obj);
  let current = proto;
  while (current !== null && current !== Object.prototype) {
    const ownKeys = Reflect.ownKeys(current);
    for (let i = 0;i < ownKeys.length; i++) {
      keys.add(ownKeys[i]);
    }
    current = Object.getPrototypeOf(current);
  }
  if (keys.has("constructor") && typeof obj.constructor === "function" && proto === obj.constructor.prototype) {
    keys.delete("constructor");
  }
  return keys;
};
var byReferenceInstances = /* @__PURE__ */ new WeakSet;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Predicate.js
function isString(input) {
  return typeof input === "string";
}
function isNumber(input) {
  return typeof input === "number";
}
function isBoolean(input) {
  return typeof input === "boolean";
}
function isSymbol(input) {
  return typeof input === "symbol";
}
function isPropertyKey(u) {
  return isString(u) || isNumber(u) || isSymbol(u);
}
function isFunction(input) {
  return typeof input === "function";
}
function isNotUndefined(input) {
  return input !== undefined;
}
function isNotNullish(input) {
  return input != null;
}
function isUnknown(_) {
  return true;
}
function isObject(input) {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
function isObjectKeyword(input) {
  return typeof input === "object" && input !== null || isFunction(input);
}
var hasProperty = /* @__PURE__ */ dual(2, (self, property) => isObjectKeyword(self) && (property in self));
var isTagged = /* @__PURE__ */ dual(2, (self, tag) => hasProperty(self, "_tag") && self["_tag"] === tag);
function isError(input) {
  return input instanceof Error;
}

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Hash.js
var symbol = "~effect/interfaces/Hash";
var hash = (self) => {
  switch (typeof self) {
    case "number":
      return number(self);
    case "bigint":
      return string(self.toString(10));
    case "boolean":
      return string(String(self));
    case "symbol":
      return string(String(self));
    case "string":
      return string(self);
    case "undefined":
      return string("undefined");
    case "function":
    case "object": {
      if (self === null) {
        return string("null");
      } else if (self instanceof Date) {
        return string(self.toISOString());
      } else if (self instanceof RegExp) {
        return string(self.toString());
      } else {
        if (byReferenceInstances.has(self)) {
          return random(self);
        }
        if (hashCache.has(self)) {
          return hashCache.get(self);
        }
        const h = withVisitedTracking(self, () => {
          if (isHash(self)) {
            return self[symbol]();
          } else if (typeof self === "function") {
            return random(self);
          } else if (Array.isArray(self) || ArrayBuffer.isView(self)) {
            return array(self);
          } else if (self instanceof Map) {
            return hashMap(self);
          } else if (self instanceof Set) {
            return hashSet(self);
          }
          return structure(self);
        });
        hashCache.set(self, h);
        return h;
      }
    }
    default:
      throw new Error(`BUG: unhandled typeof ${typeof self} - please report an issue at https://github.com/Effect-TS/effect/issues`);
  }
};
var random = (self) => {
  if (!randomHashCache.has(self)) {
    randomHashCache.set(self, number(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)));
  }
  return randomHashCache.get(self);
};
var combine = /* @__PURE__ */ dual(2, (self, b) => self * 53 ^ b);
var optimize = (n) => n & 3221225471 | n >>> 1 & 1073741824;
var isHash = (u) => hasProperty(u, symbol);
var number = (n) => {
  if (n !== n) {
    return string("NaN");
  }
  if (n === Infinity) {
    return string("Infinity");
  }
  if (n === -Infinity) {
    return string("-Infinity");
  }
  let h = n | 0;
  if (h !== n) {
    h ^= n * 4294967295;
  }
  while (n > 4294967295) {
    h ^= n /= 4294967295;
  }
  return optimize(h);
};
var string = (str) => {
  let h = 5381, i = str.length;
  while (i) {
    h = h * 33 ^ str.charCodeAt(--i);
  }
  return optimize(h);
};
var structureKeys = (o, keys) => {
  let h = 12289;
  for (const key of keys) {
    h ^= combine(hash(key), hash(o[key]));
  }
  return optimize(h);
};
var structure = (o) => structureKeys(o, getAllObjectKeys(o));
var iterableWith = (seed, f) => (iter) => {
  let h = seed;
  for (const element of iter) {
    h ^= f(element);
  }
  return optimize(h);
};
var array = /* @__PURE__ */ iterableWith(6151, hash);
var hashMap = /* @__PURE__ */ iterableWith(/* @__PURE__ */ string("Map"), ([k, v]) => combine(hash(k), hash(v)));
var hashSet = /* @__PURE__ */ iterableWith(/* @__PURE__ */ string("Set"), hash);
var randomHashCache = /* @__PURE__ */ new WeakMap;
var hashCache = /* @__PURE__ */ new WeakMap;
var visitedObjects = /* @__PURE__ */ new WeakSet;
function withVisitedTracking(obj, fn) {
  if (visitedObjects.has(obj)) {
    return string("[Circular]");
  }
  visitedObjects.add(obj);
  const result = fn();
  visitedObjects.delete(obj);
  return result;
}

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Equal.js
var symbol2 = "~effect/interfaces/Equal";
function equals() {
  if (arguments.length === 1) {
    return (self) => compareBoth(self, arguments[0]);
  }
  return compareBoth(arguments[0], arguments[1]);
}
function compareBoth(self, that) {
  if (self === that)
    return true;
  if (self == null || that == null)
    return false;
  const selfType = typeof self;
  if (selfType !== typeof that) {
    return false;
  }
  if (selfType === "number" && self !== self && that !== that) {
    return true;
  }
  if (selfType !== "object" && selfType !== "function") {
    return false;
  }
  if (byReferenceInstances.has(self) || byReferenceInstances.has(that)) {
    return false;
  }
  return withCache(self, that, compareObjects);
}
function withVisitedTracking2(self, that, fn) {
  const hasLeft = visitedLeft.has(self);
  const hasRight = visitedRight.has(that);
  if (hasLeft && hasRight) {
    return true;
  }
  if (hasLeft || hasRight) {
    return false;
  }
  visitedLeft.add(self);
  visitedRight.add(that);
  const result = fn();
  visitedLeft.delete(self);
  visitedRight.delete(that);
  return result;
}
var visitedLeft = /* @__PURE__ */ new WeakSet;
var visitedRight = /* @__PURE__ */ new WeakSet;
function compareObjects(self, that) {
  if (hash(self) !== hash(that)) {
    return false;
  } else if (self instanceof Date) {
    if (!(that instanceof Date))
      return false;
    return self.toISOString() === that.toISOString();
  } else if (self instanceof RegExp) {
    if (!(that instanceof RegExp))
      return false;
    return self.toString() === that.toString();
  }
  const selfIsEqual = isEqual(self);
  const thatIsEqual = isEqual(that);
  if (selfIsEqual !== thatIsEqual)
    return false;
  const bothEquals = selfIsEqual && thatIsEqual;
  if (typeof self === "function" && !bothEquals) {
    return false;
  }
  return withVisitedTracking2(self, that, () => {
    if (bothEquals) {
      return self[symbol2](that);
    } else if (Array.isArray(self)) {
      if (!Array.isArray(that) || self.length !== that.length) {
        return false;
      }
      return compareArrays(self, that);
    } else if (ArrayBuffer.isView(self)) {
      if (!ArrayBuffer.isView(that) || self.byteLength !== that.byteLength) {
        return false;
      }
      return compareTypedArrays(self, that);
    } else if (self instanceof Map) {
      if (!(that instanceof Map) || self.size !== that.size) {
        return false;
      }
      return compareMaps(self, that);
    } else if (self instanceof Set) {
      if (!(that instanceof Set) || self.size !== that.size) {
        return false;
      }
      return compareSets(self, that);
    }
    return compareRecords(self, that);
  });
}
function withCache(self, that, f) {
  let selfMap = equalityCache.get(self);
  if (!selfMap) {
    selfMap = new WeakMap;
    equalityCache.set(self, selfMap);
  } else if (selfMap.has(that)) {
    return selfMap.get(that);
  }
  const result = f(self, that);
  selfMap.set(that, result);
  let thatMap = equalityCache.get(that);
  if (!thatMap) {
    thatMap = new WeakMap;
    equalityCache.set(that, thatMap);
  }
  thatMap.set(self, result);
  return result;
}
var equalityCache = /* @__PURE__ */ new WeakMap;
function compareArrays(self, that) {
  for (let i = 0;i < self.length; i++) {
    if (!compareBoth(self[i], that[i])) {
      return false;
    }
  }
  return true;
}
function compareTypedArrays(self, that) {
  if (self.length !== that.length) {
    return false;
  }
  for (let i = 0;i < self.length; i++) {
    if (self[i] !== that[i]) {
      return false;
    }
  }
  return true;
}
function compareRecords(self, that) {
  const selfKeys = getAllObjectKeys(self);
  const thatKeys = getAllObjectKeys(that);
  if (selfKeys.size !== thatKeys.size) {
    return false;
  }
  for (const key of selfKeys) {
    if (!thatKeys.has(key) || !compareBoth(self[key], that[key])) {
      return false;
    }
  }
  return true;
}
function makeCompareMap(keyEquivalence, valueEquivalence) {
  return function compareMaps(self, that) {
    for (const [selfKey, selfValue] of self) {
      let found = false;
      for (const [thatKey, thatValue] of that) {
        if (keyEquivalence(selfKey, thatKey) && valueEquivalence(selfValue, thatValue)) {
          found = true;
          break;
        }
      }
      if (!found) {
        return false;
      }
    }
    return true;
  };
}
var compareMaps = /* @__PURE__ */ makeCompareMap(compareBoth, compareBoth);
function makeCompareSet(equivalence) {
  return function compareSets(self, that) {
    for (const selfValue of self) {
      let found = false;
      for (const thatValue of that) {
        if (equivalence(selfValue, thatValue)) {
          found = true;
          break;
        }
      }
      if (!found) {
        return false;
      }
    }
    return true;
  };
}
var compareSets = /* @__PURE__ */ makeCompareSet(compareBoth);
var isEqual = (u) => hasProperty(u, symbol2);
var asEquivalence = () => equals;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Redactable.js
var symbolRedactable = /* @__PURE__ */ Symbol.for("~effect/Redactable");
var isRedactable = (u) => hasProperty(u, symbolRedactable);
function redact(u) {
  if (isRedactable(u))
    return getRedacted(u);
  return u;
}
function getRedacted(redactable) {
  return redactable[symbolRedactable](globalThis[currentFiberTypeId]?.context ?? emptyContext);
}
var currentFiberTypeId = "~effect/Fiber/currentFiber";
var emptyContext = {
  "~effect/Context": {},
  mapUnsafe: /* @__PURE__ */ new Map,
  pipe() {
    return pipeArguments(this, arguments);
  }
};

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Formatter.js
function format(input, options) {
  const space = options?.space ?? 0;
  const seen = new WeakSet;
  const gap = !space ? "" : typeof space === "number" ? " ".repeat(space) : space;
  const ind = (d) => gap.repeat(d);
  const wrap = (v, body) => {
    const ctor = v?.constructor;
    return ctor && ctor !== Object.prototype.constructor && ctor.name ? `${ctor.name}(${body})` : body;
  };
  const ownKeys = (o) => {
    try {
      return Reflect.ownKeys(o);
    } catch {
      return ["[ownKeys threw]"];
    }
  };
  function recur(v, d = 0) {
    if (Array.isArray(v)) {
      if (seen.has(v))
        return CIRCULAR;
      seen.add(v);
      if (!gap || v.length <= 1)
        return `[${v.map((x) => recur(x, d)).join(",")}]`;
      const inner = v.map((x) => recur(x, d + 1)).join(`,
` + ind(d + 1));
      return `[
${ind(d + 1)}${inner}
${ind(d)}]`;
    }
    if (v instanceof Date)
      return formatDate(v);
    if (!options?.ignoreToString && hasProperty(v, "toString") && typeof v["toString"] === "function" && v["toString"] !== Object.prototype.toString && v["toString"] !== Array.prototype.toString) {
      const s = safeToString(v);
      if (v instanceof Error && v.cause) {
        return `${s} (cause: ${recur(v.cause, d)})`;
      }
      return s;
    }
    if (typeof v === "string")
      return JSON.stringify(v);
    if (typeof v === "number" || v == null || typeof v === "boolean" || typeof v === "symbol")
      return String(v);
    if (typeof v === "bigint")
      return String(v) + "n";
    if (typeof v === "object" || typeof v === "function") {
      if (seen.has(v))
        return CIRCULAR;
      seen.add(v);
      if (symbolRedactable in v)
        return format(getRedacted(v));
      if (Symbol.iterator in v) {
        return `${v.constructor.name}(${recur(Array.from(v), d)})`;
      }
      const keys = ownKeys(v);
      if (!gap || keys.length <= 1) {
        const body = `{${keys.map((k) => `${formatPropertyKey(k)}:${recur(v[k], d)}`).join(",")}}`;
        return wrap(v, body);
      }
      const body = `{
${keys.map((k) => `${ind(d + 1)}${formatPropertyKey(k)}: ${recur(v[k], d + 1)}`).join(`,
`)}
${ind(d)}}`;
      return wrap(v, body);
    }
    return String(v);
  }
  return recur(input, 0);
}
var CIRCULAR = "[Circular]";
function formatPropertyKey(name) {
  return typeof name === "string" ? JSON.stringify(name) : String(name);
}
function formatPath(path) {
  return path.map((key) => `[${formatPropertyKey(key)}]`).join("");
}
function formatDate(date) {
  try {
    return date.toISOString();
  } catch {
    return "Invalid Date";
  }
}
function safeToString(input) {
  try {
    const s = input.toString();
    return typeof s === "string" ? s : String(s);
  } catch {
    return "[toString threw]";
  }
}
function formatJson(input, options) {
  const ancestors = [];
  return JSON.stringify(input, function(_key, value) {
    const redacted = redact(value);
    if (typeof redacted !== "object" || redacted === null) {
      return redacted;
    }
    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
      ancestors.pop();
    }
    if (ancestors.includes(redacted)) {
      return;
    }
    ancestors.push(redacted);
    return redacted;
  }, options?.space);
}

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Inspectable.js
var NodeInspectSymbol = /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom");
var toJson = (input) => {
  try {
    if (hasProperty(input, "toJSON") && isFunction(input["toJSON"]) && input["toJSON"].length === 0) {
      return input.toJSON();
    } else if (Array.isArray(input)) {
      return input.map(toJson);
    }
  } catch {
    return "[toJSON threw]";
  }
  return redact(input);
};
var BaseProto = {
  toJSON() {
    return toJson(this);
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  toString() {
    return format(this.toJSON());
  }
};

class Class2 {
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
  toString() {
    return format(this.toJSON());
  }
}

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Utils.js
class SingleShotGen {
  called = false;
  self;
  constructor(self) {
    this.self = self;
  }
  next(a) {
    return this.called ? {
      value: a,
      done: true
    } : (this.called = true, {
      value: this.self,
      done: false
    });
  }
  [Symbol.iterator]() {
    return new SingleShotGen(this.self);
  }
}
var pickInternalCall = () => {
  const InternalTypeId = "~effect/Utils/internal";
  const standard = {
    [InternalTypeId]: (body) => {
      return body();
    }
  };
  const forced = {
    [InternalTypeId]: (body) => {
      try {
        return body();
      } finally {}
    }
  };
  const isNotOptimizedAway = standard[InternalTypeId](() => new Error().stack)?.includes(InternalTypeId) === true;
  return isNotOptimizedAway ? standard[InternalTypeId] : forced[InternalTypeId];
};
var internalCall = /* @__PURE__ */ pickInternalCall();

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/core.js
var EffectTypeId = `~effect/Effect`;
var ExitTypeId = `~effect/Exit`;
var effectVariance = {
  _A: identity,
  _E: identity,
  _R: identity
};
var identifier = `${EffectTypeId}/identifier`;
var args = `${EffectTypeId}/args`;
var evaluate = `${EffectTypeId}/evaluate`;
var contA = `${EffectTypeId}/successCont`;
var contE = `${EffectTypeId}/failureCont`;
var contAll = `${EffectTypeId}/ensureCont`;
var Yield = /* @__PURE__ */ Symbol.for("effect/Effect/Yield");
var PipeInspectableProto = {
  pipe() {
    return pipeArguments(this, arguments);
  },
  toJSON() {
    return {
      ...this
    };
  },
  toString() {
    return format(this.toJSON(), {
      ignoreToString: true,
      space: 2
    });
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
};
var StructuralProto = {
  [symbol]() {
    return structureKeys(this, Object.keys(this));
  },
  [symbol2](that) {
    const selfKeys = Object.keys(this);
    const thatKeys = Object.keys(that);
    if (selfKeys.length !== thatKeys.length)
      return false;
    for (let i = 0;i < selfKeys.length; i++) {
      if (selfKeys[i] !== thatKeys[i] && !equals(this[selfKeys[i]], that[selfKeys[i]])) {
        return false;
      }
    }
    return true;
  }
};
var EffectProto = {
  [EffectTypeId]: effectVariance,
  ...PipeInspectableProto,
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  },
  toJSON() {
    return {
      _id: "Effect",
      op: this[identifier],
      ...args in this ? {
        args: this[args]
      } : undefined
    };
  }
};
var isEffect = (u) => hasProperty(u, EffectTypeId);
var isExit = (u) => hasProperty(u, ExitTypeId);
var CauseTypeId = "~effect/Cause";
var CauseReasonTypeId = "~effect/Cause/Reason";
var isCause = (self) => hasProperty(self, CauseTypeId);
class CauseImpl {
  [CauseTypeId];
  reasons;
  constructor(failures) {
    this[CauseTypeId] = CauseTypeId;
    this.reasons = failures;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  toJSON() {
    return {
      _id: "Cause",
      failures: this.reasons.map((f) => f.toJSON())
    };
  }
  toString() {
    return `Cause(${format(this.reasons)})`;
  }
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
  [symbol2](that) {
    return isCause(that) && this.reasons.length === that.reasons.length && this.reasons.every((e, i) => equals(e, that.reasons[i]));
  }
  [symbol]() {
    return array(this.reasons);
  }
}
var annotationsMap = /* @__PURE__ */ new WeakMap;

class ReasonBase {
  [CauseReasonTypeId];
  annotations;
  _tag;
  constructor(_tag, annotations, originalError) {
    this[CauseReasonTypeId] = CauseReasonTypeId;
    this._tag = _tag;
    if (annotations !== constEmptyAnnotations && typeof originalError === "object" && originalError !== null && annotations.size > 0) {
      const prevAnnotations = annotationsMap.get(originalError);
      if (prevAnnotations) {
        annotations = new Map([...prevAnnotations, ...annotations]);
      }
      annotationsMap.set(originalError, annotations);
    }
    this.annotations = annotations;
  }
  annotate(annotations, options) {
    if (annotations.mapUnsafe.size === 0)
      return this;
    const newAnnotations = new Map(this.annotations);
    annotations.mapUnsafe.forEach((value, key) => {
      if (options?.overwrite !== true && newAnnotations.has(key))
        return;
      newAnnotations.set(key, value);
    });
    const self = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    self.annotations = newAnnotations;
    return self;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  toString() {
    return format(this);
  }
  [NodeInspectSymbol]() {
    return this.toString();
  }
}
var constEmptyAnnotations = /* @__PURE__ */ new Map;

class Fail extends ReasonBase {
  error;
  constructor(error, annotations = constEmptyAnnotations) {
    super("Fail", annotations, error);
    this.error = error;
  }
  toString() {
    return `Fail(${format(this.error)})`;
  }
  toJSON() {
    return {
      _tag: "Fail",
      error: this.error
    };
  }
  [symbol2](that) {
    return isFailReason(that) && equals(this.error, that.error) && equals(this.annotations, that.annotations);
  }
  [symbol]() {
    return combine(string(this._tag))(combine(hash(this.error))(hash(this.annotations)));
  }
}
var causeFromReasons = (reasons) => new CauseImpl(reasons);
var causeFail = (error) => new CauseImpl([new Fail(error)]);

class Die extends ReasonBase {
  defect;
  constructor(defect, annotations = constEmptyAnnotations) {
    super("Die", annotations, defect);
    this.defect = defect;
  }
  toString() {
    return `Die(${format(this.defect)})`;
  }
  toJSON() {
    return {
      _tag: "Die",
      defect: this.defect
    };
  }
  [symbol2](that) {
    return isDieReason(that) && equals(this.defect, that.defect) && equals(this.annotations, that.annotations);
  }
  [symbol]() {
    return combine(string(this._tag))(combine(hash(this.defect))(hash(this.annotations)));
  }
}
var causeDie = (defect) => new CauseImpl([new Die(defect)]);
var causeAnnotate = /* @__PURE__ */ dual((args) => isCause(args[0]), (self, annotations, options) => {
  if (annotations.mapUnsafe.size === 0)
    return self;
  return new CauseImpl(self.reasons.map((f) => f.annotate(annotations, options)));
});
var isFailReason = (self) => self._tag === "Fail";
var isDieReason = (self) => self._tag === "Die";
var isInterruptReason = (self) => self._tag === "Interrupt";
function defaultEvaluate(_fiber) {
  return exitDie(`Effect.evaluate: Not implemented`);
}
var makePrimitiveProto = (options) => ({
  ...EffectProto,
  [identifier]: options.op,
  [evaluate]: options[evaluate] ?? defaultEvaluate,
  [contA]: options[contA],
  [contE]: options[contE],
  [contAll]: options[contAll]
});
var makePrimitive = (options) => {
  const Proto = makePrimitiveProto(options);
  return function() {
    const self = Object.create(Proto);
    self[args] = options.single === false ? arguments : arguments[0];
    return self;
  };
};
var makeExit = (options) => {
  const Proto = {
    ...makePrimitiveProto(options),
    [ExitTypeId]: ExitTypeId,
    _tag: options.op,
    get [options.prop]() {
      return this[args];
    },
    toString() {
      return `${options.op}(${format(this[args])})`;
    },
    toJSON() {
      return {
        _id: "Exit",
        _tag: options.op,
        [options.prop]: this[args]
      };
    },
    [symbol2](that) {
      return isExit(that) && that._tag === this._tag && equals(this[args], that[args]);
    },
    [symbol]() {
      return combine(string(options.op), hash(this[args]));
    }
  };
  return function(value) {
    const self = Object.create(Proto);
    self[args] = value;
    return self;
  };
};
var exitSucceed = /* @__PURE__ */ makeExit({
  op: "Success",
  prop: "value",
  [evaluate](fiber) {
    const cont = fiber.getCont(contA);
    return cont ? cont[contA](this[args], fiber, this) : fiber.yieldWith(this);
  }
});
var StackTraceKey = {
  key: "effect/Cause/StackTrace"
};
var exitFailCause = /* @__PURE__ */ makeExit({
  op: "Failure",
  prop: "cause",
  [evaluate](fiber) {
    let cause = this[args];
    let annotated = false;
    if (fiber.currentStackFrame) {
      cause = causeAnnotate(cause, {
        mapUnsafe: new Map([[StackTraceKey.key, fiber.currentStackFrame]])
      });
      annotated = true;
    }
    let cont = fiber.getCont(contE);
    while (fiber.interruptible && fiber._interruptedCause && cont) {
      cont = fiber.getCont(contE);
    }
    return cont ? cont[contE](cause, fiber, annotated ? undefined : this) : fiber.yieldWith(annotated ? this : exitFailCause(cause));
  }
});
var exitFail = (e) => exitFailCause(causeFail(e));
var exitDie = (defect) => exitFailCause(causeDie(defect));
var withFiber = /* @__PURE__ */ makePrimitive({
  op: "WithFiber",
  [evaluate](fiber) {
    return this[args](fiber);
  }
});
var YieldableError = /* @__PURE__ */ function() {

  class YieldableError extends globalThis.Error {
  }
  const proto = /* @__PURE__ */ makePrimitiveProto({
    op: "YieldableError",
    [evaluate]() {
      return exitFail(this);
    }
  });
  delete proto.toString;
  Object.assign(YieldableError.prototype, proto);
  return YieldableError;
}();
var Error2 = /* @__PURE__ */ function() {
  const plainArgsSymbol = /* @__PURE__ */ Symbol.for("effect/Data/Error/plainArgs");
  return class Base extends YieldableError {
    constructor(args) {
      super(args?.message, args?.cause ? {
        cause: args.cause
      } : undefined);
      if (args) {
        Object.assign(this, args);
        Object.defineProperty(this, plainArgsSymbol, {
          value: args,
          enumerable: false
        });
      }
    }
    toJSON() {
      return {
        ...this[plainArgsSymbol],
        ...this
      };
    }
  };
}();
var TaggedError = (tag) => {

  class Base extends Error2 {
    _tag = tag;
  }
  Base.prototype.name = tag;
  return Base;
};
var DoneTypeId = "~effect/Cause/Done";
var isDone = (u) => hasProperty(u, DoneTypeId);
var DoneVoid = {
  [DoneTypeId]: DoneTypeId,
  _tag: "Done",
  value: undefined
};
var Done = (value) => {
  if (value === undefined)
    return DoneVoid;
  return {
    [DoneTypeId]: DoneTypeId,
    _tag: "Done",
    value
  };
};
var doneVoid = /* @__PURE__ */ exitFail(DoneVoid);
var done = (value) => {
  if (value === undefined)
    return doneVoid;
  return exitFail(Done(value));
};

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Effectable.js
var Prototype2 = (options) => makePrimitiveProto({
  op: options.label,
  [evaluate]: options.evaluate
});

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Equivalence.js
var make = (isEquivalent) => (self, that) => self === that || isEquivalent(self, that);
var isStrictEquivalent = (x, y) => x === y;
var strictEqual = () => isStrictEquivalent;
function Tuple(elements) {
  return make((self, that) => {
    if (self.length !== that.length) {
      return false;
    }
    for (let i = 0;i < self.length; i++) {
      if (!elements[i](self[i], that[i])) {
        return false;
      }
    }
    return true;
  });
}
function Array_(item) {
  return make((self, that) => {
    if (self.length !== that.length)
      return false;
    for (let i = 0;i < self.length; i++) {
      if (!item(self[i], that[i]))
        return false;
    }
    return true;
  });
}

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/option.js
var TypeId = "~effect/data/Option";
var CommonProto = {
  [TypeId]: {
    _A: (_) => _
  },
  ...PipeInspectableProto,
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  }
};
var SomeProto = /* @__PURE__ */ Object.defineProperty(/* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto), {
  _tag: "Some",
  _op: "Some",
  [symbol2](that) {
    return isOption(that) && isSome(that) && equals(this.value, that.value);
  },
  [symbol]() {
    return combine(hash(this._tag))(hash(this.value));
  },
  toString() {
    return `some(${format(this.value)})`;
  },
  toJSON() {
    return {
      _id: "Option",
      _tag: this._tag,
      value: toJson(this.value)
    };
  }
}), "valueOrUndefined", {
  get() {
    return this.value;
  }
});
var NoneHash = /* @__PURE__ */ hash("None");
var NoneProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto), {
  _tag: "None",
  _op: "None",
  valueOrUndefined: undefined,
  [symbol2](that) {
    return isOption(that) && isNone(that);
  },
  [symbol]() {
    return NoneHash;
  },
  toString() {
    return `none()`;
  },
  toJSON() {
    return {
      _id: "Option",
      _tag: this._tag
    };
  }
});
var isOption = (input) => hasProperty(input, TypeId);
var isNone = (fa) => fa._tag === "None";
var isSome = (fa) => fa._tag === "Some";
var none = /* @__PURE__ */ Object.create(NoneProto);
var some = (value) => {
  const a = Object.create(SomeProto);
  a.value = value;
  return a;
};

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/result.js
var TypeId2 = "~effect/data/Result";
var CommonProto2 = {
  [TypeId2]: {
    _A: (_) => _,
    _E: (_) => _
  },
  ...PipeInspectableProto,
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  }
};
var SuccessProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto2), {
  _tag: "Success",
  _op: "Success",
  [symbol2](that) {
    return isResult(that) && isSuccess(that) && equals(this.success, that.success);
  },
  [symbol]() {
    return combine(hash(this._tag))(hash(this.success));
  },
  toString() {
    return `success(${format(this.success)})`;
  },
  toJSON() {
    return {
      _id: "Result",
      _tag: this._tag,
      value: toJson(this.success)
    };
  }
});
var FailureProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto2), {
  _tag: "Failure",
  _op: "Failure",
  [symbol2](that) {
    return isResult(that) && isFailure(that) && equals(this.failure, that.failure);
  },
  [symbol]() {
    return combine(hash(this._tag))(hash(this.failure));
  },
  toString() {
    return `failure(${format(this.failure)})`;
  },
  toJSON() {
    return {
      _id: "Result",
      _tag: this._tag,
      failure: toJson(this.failure)
    };
  }
});
var isResult = (input) => hasProperty(input, TypeId2);
var isFailure = (result) => result._tag === "Failure";
var isSuccess = (result) => result._tag === "Success";
var fail = (failure) => {
  const a = Object.create(FailureProto);
  a.failure = failure;
  return a;
};
var succeed = (success) => {
  const a = Object.create(SuccessProto);
  a.success = success;
  return a;
};

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Order.js
function make2(compare) {
  return (self, that) => self === that ? 0 : compare(self, that);
}
var Number2 = /* @__PURE__ */ make2((self, that) => {
  if (globalThis.Number.isNaN(self) && globalThis.Number.isNaN(that))
    return 0;
  if (globalThis.Number.isNaN(self))
    return -1;
  if (globalThis.Number.isNaN(that))
    return 1;
  return self < that ? -1 : 1;
});
var mapInput = /* @__PURE__ */ dual(2, (self, f) => make2((b1, b2) => self(f(b1), f(b2))));
var Date2 = /* @__PURE__ */ mapInput(Number2, (date) => date.getTime());
var isGreaterThan = (O) => dual(2, (self, that) => O(self, that) === 1);
var isGreaterThanOrEqualTo = (O) => dual(2, (self, that) => O(self, that) !== -1);

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Option.js
var none2 = () => none;
var some2 = some;
var isNone2 = isNone;
var isSome2 = isSome;
var match = /* @__PURE__ */ dual(2, (self, {
  onNone,
  onSome
}) => isNone2(self) ? onNone() : onSome(self.value));
var getOrElse = /* @__PURE__ */ dual(2, (self, onNone) => isNone2(self) ? onNone() : self.value);
var fromNullishOr = (a) => a == null ? none2() : some2(a);
var getOrUndefined = /* @__PURE__ */ getOrElse(constUndefined);
var liftThrowable = (f) => (...a) => {
  try {
    return some2(f(...a));
  } catch {
    return none2();
  }
};
var map = /* @__PURE__ */ dual(2, (self, f) => isNone2(self) ? none2() : some2(f(self.value)));
var filter = /* @__PURE__ */ dual(2, (self, predicate) => isNone2(self) ? none2() : predicate(self.value) ? some2(self.value) : none2());

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Context.js
var ServiceTypeId = "~effect/Context/Service";
var Service = function() {
  const prevLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 2;
  const err = new Error;
  Error.stackTraceLimit = prevLimit;
  function KeyClass() {}
  const self = KeyClass;
  Object.setPrototypeOf(self, ServiceProto);
  Object.defineProperty(self, "stack", {
    get() {
      return err.stack;
    }
  });
  if (arguments.length > 0) {
    self.key = arguments[0];
    if (arguments[1]?.defaultValue) {
      self[ReferenceTypeId] = ReferenceTypeId;
      self.defaultValue = arguments[1].defaultValue;
    }
    return self;
  }
  return function(key, options) {
    self.key = key;
    if (options?.make) {
      self.make = options.make;
    }
    return self;
  };
};
var ServiceProto = {
  [ServiceTypeId]: ServiceTypeId,
  .../* @__PURE__ */ Prototype2({
    label: "Service",
    evaluate(fiber) {
      return exitSucceed(get(fiber.context, this));
    }
  }),
  toJSON() {
    return {
      _id: "Service",
      key: this.key,
      stack: this.stack
    };
  },
  of(self) {
    return self;
  },
  context(self) {
    return make3(this, self);
  },
  use(f) {
    return withFiber((fiber) => f(get(fiber.context, this)));
  },
  useSync(f) {
    return withFiber((fiber) => exitSucceed(f(get(fiber.context, this))));
  }
};
var ReferenceTypeId = "~effect/Context/Reference";
var TypeId3 = "~effect/Context";
var makeUnsafe = (mapUnsafe) => {
  const self = Object.create(Proto);
  self.mapUnsafe = mapUnsafe;
  self.mutable = false;
  return self;
};
var Proto = {
  ...PipeInspectableProto,
  [TypeId3]: {
    _Services: (_) => _
  },
  toJSON() {
    return {
      _id: "Context",
      services: Array.from(this.mapUnsafe).map(([key, value]) => ({
        key,
        value
      }))
    };
  },
  [symbol2](that) {
    if (!isContext(that) || this.mapUnsafe.size !== that.mapUnsafe.size)
      return false;
    for (const k of this.mapUnsafe.keys()) {
      if (!that.mapUnsafe.has(k) || !equals(this.mapUnsafe.get(k), that.mapUnsafe.get(k))) {
        return false;
      }
    }
    return true;
  },
  [symbol]() {
    return number(this.mapUnsafe.size);
  }
};
var isContext = (u) => hasProperty(u, TypeId3);
var isReference = (u) => hasProperty(u, ReferenceTypeId);
var empty = () => emptyContext2;
var emptyContext2 = /* @__PURE__ */ makeUnsafe(/* @__PURE__ */ new Map);
var make3 = (key, service) => makeUnsafe(new Map([[key.key, service]]));
var add = /* @__PURE__ */ dual(3, (self, key, service) => withMapUnsafe(self, (map) => {
  map.set(key.key, service);
}));
var getUnsafe = /* @__PURE__ */ dual(2, (self, service) => {
  if (!self.mapUnsafe.has(service.key)) {
    if (ReferenceTypeId in service)
      return getDefaultValue(service);
    throw serviceNotFoundError(service);
  }
  return self.mapUnsafe.get(service.key);
});
var get = getUnsafe;
var getReferenceUnsafe = (self, service) => {
  if (!self.mapUnsafe.has(service.key)) {
    return getDefaultValue(service);
  }
  return self.mapUnsafe.get(service.key);
};
var defaultValueCacheKey = "~effect/Context/defaultValue";
var getDefaultValue = (ref) => {
  if (defaultValueCacheKey in ref) {
    return ref[defaultValueCacheKey];
  }
  return ref[defaultValueCacheKey] = ref.defaultValue();
};
var serviceNotFoundError = (service) => {
  const error = new Error(`Service not found${service.key ? `: ${String(service.key)}` : ""}`);
  if (service.stack) {
    const lines = service.stack.split(`
`);
    if (lines.length > 2) {
      const afterAt = lines[2].match(/at (.*)/);
      if (afterAt) {
        error.message = error.message + ` (defined at ${afterAt[1]})`;
      }
    }
  }
  if (error.stack) {
    const lines = error.stack.split(`
`);
    lines.splice(1, 3);
    error.stack = lines.join(`
`);
  }
  return error;
};
var getOption = /* @__PURE__ */ dual(2, (self, service) => {
  if (self.mapUnsafe.has(service.key)) {
    return some2(self.mapUnsafe.get(service.key));
  }
  return isReference(service) ? some2(getDefaultValue(service)) : none2();
});
var merge = /* @__PURE__ */ dual(2, (self, that) => {
  if (self.mapUnsafe.size === 0)
    return that;
  if (that.mapUnsafe.size === 0)
    return self;
  return withMapUnsafe(self, (map) => {
    that.mapUnsafe.forEach((value, key) => map.set(key, value));
  });
});
var mergeAll = (...ctxs) => {
  const map = new Map;
  for (let i = 0;i < ctxs.length; i++) {
    ctxs[i].mapUnsafe.forEach((value, key) => {
      map.set(key, value);
    });
  }
  return makeUnsafe(map);
};
var withMapUnsafe = (self, f) => {
  if (self.mutable) {
    f(self.mapUnsafe);
    return self;
  }
  const map = new Map(self.mapUnsafe);
  f(map);
  return makeUnsafe(map);
};
var Reference = Service;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/array.js
var isArrayNonEmpty = (self) => self.length > 0;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Result.js
var succeed2 = succeed;
var fail2 = fail;
var isFailure2 = isFailure;
var match2 = /* @__PURE__ */ dual(2, (self, {
  onFailure,
  onSuccess
}) => isFailure2(self) ? onFailure(self.failure) : onSuccess(self.success));

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Tuple.js
var makeEquivalence = Tuple;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Record.js
var has = /* @__PURE__ */ dual(2, (self, key) => Object.hasOwn(self, key));
var map2 = /* @__PURE__ */ dual(2, (self, f) => {
  const out = {
    ...self
  };
  for (const key of keys(self)) {
    out[key] = f(self[key], key);
  }
  return out;
});
var keys = (self) => Object.keys(self);
var isSubrecordBy = (equivalence) => dual(2, (self, that) => {
  for (const key of keys(self)) {
    if (!has(that, key) || !equivalence(self[key], that[key])) {
      return false;
    }
  }
  return true;
});
var makeEquivalence2 = (equivalence) => {
  const is = isSubrecordBy(equivalence);
  return (self, that) => is(self, that) && is(that, self);
};

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Array.js
var Array2 = globalThis.Array;
var fromIterable = (collection) => Array2.isArray(collection) ? collection : Array2.from(collection);
var append = /* @__PURE__ */ dual(2, (self, last) => [...self, last]);
var appendAll = /* @__PURE__ */ dual(2, (self, that) => fromIterable(self).concat(fromIterable(that)));
var isArray = Array2.isArray;
var isArrayNonEmpty2 = isArrayNonEmpty;
var isReadonlyArrayNonEmpty = isArrayNonEmpty;
function isOutOfBounds(i, as) {
  return i < 0 || i >= as.length;
}
var getUnsafe2 = /* @__PURE__ */ dual(2, (self, index) => {
  const i = Math.floor(index);
  if (isOutOfBounds(i, self)) {
    throw new Error(`Index out of bounds: ${i}`);
  }
  return self[i];
});
var headNonEmpty = /* @__PURE__ */ getUnsafe2(0);
var tailNonEmpty = (self) => self.slice(1);
var unionWith = /* @__PURE__ */ dual(3, (self, that, isEquivalent) => {
  const a = fromIterable(self);
  const b = fromIterable(that);
  if (isReadonlyArrayNonEmpty(a)) {
    if (isReadonlyArrayNonEmpty(b)) {
      const dedupe = dedupeWith(isEquivalent);
      return dedupe(appendAll(a, b));
    }
    return a;
  }
  return b;
});
var union = /* @__PURE__ */ dual(2, (self, that) => unionWith(self, that, asEquivalence()));
var empty2 = () => [];
var of = (a) => [a];
var map3 = /* @__PURE__ */ dual(2, (self, f) => self.map(f));
var makeEquivalence3 = Array_;
var dedupeWith = /* @__PURE__ */ dual(2, (self, isEquivalent) => {
  const input = fromIterable(self);
  if (isReadonlyArrayNonEmpty(input)) {
    const out = [headNonEmpty(input)];
    const rest = tailNonEmpty(input);
    for (const r of rest) {
      if (out.every((a) => !isEquivalent(r, a))) {
        out.push(r);
      }
    }
    return out;
  }
  return [];
});

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Duration.js
var TypeId4 = "~effect/time/Duration";
var bigint0 = /* @__PURE__ */ BigInt(0);
var bigint1 = /* @__PURE__ */ BigInt(1);
var bigint1e3 = /* @__PURE__ */ BigInt(1000);
var roundTiesAwayFromZero = (input) => BigInt(input < 0 ? Math.ceil(input - 0.5) : Math.floor(input + 0.5));
var roundMillisToNanos = (millis) => roundTiesAwayFromZero(millis * 1e6);
var parseNanos = (input, scale) => input.includes(".") ? roundTiesAwayFromZero(Number(input) * Number(scale)) : BigInt(input) * scale;
var DURATION_REGEXP = /^(-?\d+(?:\.\d+)?)\s+(nanos?|micros?|millis?|seconds?|minutes?|hours?|days?|weeks?)$/;
var fromInputUnsafe = (input) => {
  switch (typeof input) {
    case "number":
      return millis(input);
    case "bigint":
      return nanos(input);
    case "string": {
      if (input === "Infinity") {
        return infinity;
      }
      if (input === "-Infinity") {
        return negativeInfinity;
      }
      const match = DURATION_REGEXP.exec(input);
      if (!match)
        break;
      const [_, valueStr, unit] = match;
      if (unit === "nano" || unit === "nanos") {
        return nanos(parseNanos(valueStr, bigint1));
      }
      if (unit === "micro" || unit === "micros") {
        return nanos(parseNanos(valueStr, bigint1e3));
      }
      const value = Number(valueStr);
      switch (unit) {
        case "milli":
        case "millis":
          return millis(value);
        case "second":
        case "seconds":
          return seconds(value);
        case "minute":
        case "minutes":
          return minutes(value);
        case "hour":
        case "hours":
          return hours(value);
        case "day":
        case "days":
          return days(value);
        case "week":
        case "weeks":
          return weeks(value);
      }
      break;
    }
    case "object": {
      if (input === null)
        break;
      if (TypeId4 in input)
        return input;
      if (Array.isArray(input)) {
        if (input.length !== 2 || !input.every(isNumber)) {
          return invalid(input);
        }
        if (Number.isNaN(input[0]) || Number.isNaN(input[1])) {
          return zero;
        }
        if (input[0] === -Infinity || input[1] === -Infinity) {
          return negativeInfinity;
        }
        if (input[0] === Infinity || input[1] === Infinity) {
          return infinity;
        }
        return make4(roundTiesAwayFromZero(input[0] * 1e9 + input[1]));
      }
      const obj = input;
      let millis = 0;
      if (obj.weeks)
        millis += obj.weeks * 604800000;
      if (obj.days)
        millis += obj.days * 86400000;
      if (obj.hours)
        millis += obj.hours * 3600000;
      if (obj.minutes)
        millis += obj.minutes * 60000;
      if (obj.seconds)
        millis += obj.seconds * 1000;
      if (obj.milliseconds)
        millis += obj.milliseconds;
      if (!obj.microseconds && !obj.nanoseconds)
        return make4(millis);
      return make4(roundTiesAwayFromZero(millis * 1e6 + (obj.microseconds ?? 0) * 1000 + (obj.nanoseconds ?? 0)));
    }
  }
  return invalid(input);
};
var invalid = (input) => {
  throw new Error(`Invalid Input: ${input}`);
};
var zeroDurationValue = {
  _tag: "Millis",
  millis: 0
};
var infinityDurationValue = {
  _tag: "Infinity"
};
var negativeInfinityDurationValue = {
  _tag: "NegativeInfinity"
};
var DurationProto = {
  [TypeId4]: TypeId4,
  [symbol]() {
    return structure(this.value);
  },
  [symbol2](that) {
    return isDuration(that) && equals2(this, that);
  },
  toString() {
    switch (this.value._tag) {
      case "Infinity":
        return "Infinity";
      case "NegativeInfinity":
        return "-Infinity";
      case "Nanos":
        return `${this.value.nanos} nanos`;
      case "Millis":
        return `${this.value.millis} millis`;
    }
  },
  toJSON() {
    switch (this.value._tag) {
      case "Millis":
        return {
          _id: "Duration",
          _tag: "Millis",
          millis: this.value.millis
        };
      case "Nanos":
        return {
          _id: "Duration",
          _tag: "Nanos",
          nanos: String(this.value.nanos)
        };
      case "Infinity":
        return {
          _id: "Duration",
          _tag: "Infinity"
        };
      case "NegativeInfinity":
        return {
          _id: "Duration",
          _tag: "NegativeInfinity"
        };
    }
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var make4 = (input) => {
  const duration = Object.create(DurationProto);
  if (typeof input === "number") {
    if (isNaN(input) || input === 0 || Object.is(input, -0)) {
      duration.value = zeroDurationValue;
    } else if (!Number.isFinite(input)) {
      duration.value = input > 0 ? infinityDurationValue : negativeInfinityDurationValue;
    } else if (!Number.isInteger(input)) {
      duration.value = {
        _tag: "Nanos",
        nanos: roundMillisToNanos(input)
      };
    } else {
      duration.value = {
        _tag: "Millis",
        millis: input
      };
    }
  } else if (input === bigint0) {
    duration.value = zeroDurationValue;
  } else {
    duration.value = {
      _tag: "Nanos",
      nanos: input
    };
  }
  return duration;
};
var isDuration = (u) => hasProperty(u, TypeId4);
var zero = /* @__PURE__ */ make4(0);
var infinity = /* @__PURE__ */ make4(Infinity);
var negativeInfinity = /* @__PURE__ */ make4(-Infinity);
var nanos = (nanos) => make4(nanos);
var millis = (millis) => make4(millis);
var seconds = (seconds) => make4(seconds * 1000);
var minutes = (minutes) => make4(minutes * 60000);
var hours = (hours) => make4(hours * 3600000);
var days = (days) => make4(days * 86400000);
var weeks = (weeks) => make4(weeks * 604800000);
var toMillis = (self) => match3(fromInputUnsafe(self), {
  onMillis: identity,
  onNanos: (nanos) => Number(nanos) / 1e6,
  onInfinity: () => Infinity,
  onNegativeInfinity: () => -Infinity
});
var toNanosUnsafe = (input) => {
  const self = fromInputUnsafe(input);
  switch (self.value._tag) {
    case "Infinity":
    case "NegativeInfinity":
      throw new Error("Cannot convert infinite duration to nanos");
    case "Nanos":
      return self.value.nanos;
    case "Millis":
      return roundMillisToNanos(self.value.millis);
  }
};
var match3 = /* @__PURE__ */ dual(2, (self, options) => {
  switch (self.value._tag) {
    case "Millis":
      return options.onMillis(self.value.millis);
    case "Nanos":
      return options.onNanos(self.value.nanos);
    case "Infinity":
      return options.onInfinity();
    case "NegativeInfinity":
      return (options.onNegativeInfinity ?? options.onInfinity)();
  }
});
var matchPair = /* @__PURE__ */ dual(3, (self, that, options) => {
  if (self.value._tag === "Infinity" || self.value._tag === "NegativeInfinity" || that.value._tag === "Infinity" || that.value._tag === "NegativeInfinity")
    return options.onInfinity(self, that);
  if (self.value._tag === "Millis") {
    return that.value._tag === "Millis" ? options.onMillis(self.value.millis, that.value.millis) : options.onNanos(toNanosUnsafe(self), that.value.nanos);
  } else {
    return options.onNanos(self.value.nanos, toNanosUnsafe(that));
  }
});
var Equivalence = (self, that) => matchPair(self, that, {
  onMillis: (self, that) => self === that,
  onNanos: (self, that) => self === that,
  onInfinity: (self, that) => self.value._tag === that.value._tag
});
var equals2 = /* @__PURE__ */ dual(2, (self, that) => Equivalence(self, that));

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Filter.js
var composePassthrough = /* @__PURE__ */ dual(2, (left, right) => (input) => {
  const leftOut = left(input);
  if (isFailure2(leftOut))
    return fail2(input);
  const rightOut = right(leftOut.success);
  if (isFailure2(rightOut))
    return fail2(input);
  return rightOut;
});

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Scheduler.js
var Scheduler = /* @__PURE__ */ Reference("effect/Scheduler", {
  defaultValue: () => new MixedScheduler
});
var setImmediate = "setImmediate" in globalThis ? (f) => {
  const timer = globalThis.setImmediate(f);
  return () => globalThis.clearImmediate(timer);
} : (f) => {
  const timer = setTimeout(f, 0);
  return () => clearTimeout(timer);
};

class PriorityBuckets {
  buckets = [];
  scheduleTask(task, priority) {
    const buckets = this.buckets;
    const len = buckets.length;
    let bucket;
    let index = 0;
    for (;index < len; index++) {
      if (buckets[index][0] > priority)
        break;
      bucket = buckets[index];
    }
    if (bucket && bucket[0] === priority) {
      bucket[1].push(task);
    } else if (index === len) {
      buckets.push([priority, [task]]);
    } else {
      buckets.splice(index, 0, [priority, [task]]);
    }
  }
  drain() {
    const buckets = this.buckets;
    this.buckets = [];
    return buckets;
  }
}

class MixedScheduler {
  executionMode;
  setImmediate;
  constructor(executionMode = "async", setImmediateFn = setImmediate) {
    this.executionMode = executionMode;
    this.setImmediate = setImmediateFn;
  }
  shouldYield(fiber) {
    return fiber.currentOpCount >= fiber.maxOpsBeforeYield;
  }
  makeDispatcher() {
    return new MixedSchedulerDispatcher(this.setImmediate);
  }
}

class MixedSchedulerDispatcher {
  tasks = /* @__PURE__ */ new PriorityBuckets;
  running = undefined;
  setImmediate;
  constructor(setImmediateFn = setImmediate) {
    this.setImmediate = setImmediateFn;
  }
  scheduleTask(task, priority) {
    this.tasks.scheduleTask(task, priority);
    if (this.running === undefined) {
      this.running = this.setImmediate(this.afterScheduled);
    }
  }
  afterScheduled = () => {
    this.running = undefined;
    this.runTasks();
  };
  runTasks() {
    const buckets = this.tasks.drain();
    for (let i = 0;i < buckets.length; i++) {
      const toRun = buckets[i][1];
      for (let j = 0;j < toRun.length; j++) {
        toRun[j]();
      }
    }
  }
  flush() {
    while (this.tasks.buckets.length > 0) {
      if (this.running !== undefined) {
        this.running();
        this.running = undefined;
      }
      this.runTasks();
    }
  }
}
var MaxOpsBeforeYield = /* @__PURE__ */ Reference("effect/Scheduler/MaxOpsBeforeYield", {
  defaultValue: () => 2048
});
var PreventSchedulerYield = /* @__PURE__ */ Reference("effect/Scheduler/PreventSchedulerYield", {
  defaultValue: () => false
});

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Tracer.js
var ParentSpanKey = "effect/Tracer/ParentSpan";

class ParentSpan extends (/* @__PURE__ */ Service()(ParentSpanKey)) {
}
var make5 = (options) => options;
var DisablePropagation = /* @__PURE__ */ Reference("effect/Tracer/DisablePropagation", {
  defaultValue: constFalse
});
var CurrentTraceLevel = /* @__PURE__ */ Reference("effect/Tracer/CurrentTraceLevel", {
  defaultValue: () => "Info"
});
var MinimumTraceLevel = /* @__PURE__ */ Reference("effect/Tracer/MinimumTraceLevel", {
  defaultValue: () => "All"
});
var TracerKey = "effect/Tracer";
var Tracer = /* @__PURE__ */ Reference(TracerKey, {
  defaultValue: () => make5({
    span: (options) => new NativeSpan(options)
  })
});

class NativeSpan {
  _tag = "Span";
  spanId;
  traceId = "native";
  sampled;
  name;
  parent;
  annotations;
  links;
  startTime;
  kind;
  status;
  attributes;
  events = [];
  constructor(options) {
    this.name = options.name;
    this.parent = options.parent;
    this.annotations = options.annotations;
    this.links = options.links;
    this.startTime = options.startTime;
    this.kind = options.kind;
    this.sampled = options.sampled;
    this.status = {
      _tag: "Started",
      startTime: options.startTime
    };
    this.attributes = new Map;
    this.traceId = getOrUndefined(options.parent)?.traceId ?? randomHexString(32);
    this.spanId = randomHexString(16);
  }
  end(endTime, exit) {
    this.status = {
      _tag: "Ended",
      endTime,
      exit,
      startTime: this.status.startTime
    };
  }
  attribute(key, value) {
    this.attributes.set(key, value);
  }
  event(name, startTime, attributes) {
    this.events.push([name, startTime, attributes ?? {}]);
  }
  addLinks(links) {
    this.links.push(...links);
  }
}
var randomHexString = /* @__PURE__ */ function() {
  const characters = "abcdef0123456789";
  const charactersLength = characters.length;
  return function(length) {
    let result = "";
    for (let i = 0;i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  };
}();

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/metric.js
var FiberRuntimeMetricsKey = "effect/observability/Metric/FiberRuntimeMetricsKey";

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/references.js
var CurrentConcurrency = /* @__PURE__ */ Reference("effect/References/CurrentConcurrency", {
  defaultValue: () => "unbounded"
});
var CurrentStackFrame = /* @__PURE__ */ Reference("effect/References/CurrentStackFrame", {
  defaultValue: constUndefined
});
var TracerEnabled = /* @__PURE__ */ Reference("effect/References/TracerEnabled", {
  defaultValue: constTrue
});
var TracerTimingEnabled = /* @__PURE__ */ Reference("effect/References/TracerTimingEnabled", {
  defaultValue: constTrue
});
var TracerSpanAnnotations = /* @__PURE__ */ Reference("effect/References/TracerSpanAnnotations", {
  defaultValue: () => ({})
});
var TracerSpanLinks = /* @__PURE__ */ Reference("effect/References/TracerSpanLinks", {
  defaultValue: () => []
});
var CurrentLogLevel = /* @__PURE__ */ Reference("effect/References/CurrentLogLevel", {
  defaultValue: () => "Info"
});
var MinimumLogLevel = /* @__PURE__ */ Reference("effect/References/MinimumLogLevel", {
  defaultValue: () => "Info"
});

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/tracer.js
var addSpanStackTrace = (options) => {
  if (options?.captureStackTrace === false) {
    return options;
  } else if (options?.captureStackTrace !== undefined && typeof options.captureStackTrace !== "boolean") {
    return options;
  }
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 3;
  const traceError = new Error;
  Error.stackTraceLimit = limit;
  return {
    ...options,
    captureStackTrace: spanCleaner(() => traceError.stack)
  };
};
var makeStackCleaner = (line) => (stack) => {
  let cache;
  return () => {
    if (cache !== undefined)
      return cache;
    const trace = stack();
    if (!trace)
      return;
    const lines = trace.split(`
`);
    if (lines[line] !== undefined) {
      cache = lines[line].trim();
      return cache;
    }
  };
};
var spanCleaner = /* @__PURE__ */ makeStackCleaner(3);

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/version.js
var version = "dev";

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/effect.js
class Interrupt extends ReasonBase {
  fiberId;
  constructor(fiberId, annotations = constEmptyAnnotations) {
    super("Interrupt", annotations, "Interrupted");
    this.fiberId = fiberId;
  }
  toString() {
    return `Interrupt(${this.fiberId})`;
  }
  toJSON() {
    return {
      _tag: "Interrupt",
      fiberId: this.fiberId
    };
  }
  [symbol2](that) {
    return isInterruptReason(that) && this.fiberId === that.fiberId && this.annotations === that.annotations;
  }
  [symbol]() {
    return combine(string(`${this._tag}:${this.fiberId}`))(random(this.annotations));
  }
}
var causeInterrupt = (fiberId) => new CauseImpl([new Interrupt(fiberId)]);
var findError = (self) => {
  for (let i = 0;i < self.reasons.length; i++) {
    const reason = self.reasons[i];
    if (reason._tag === "Fail") {
      return succeed2(reason.error);
    }
  }
  return fail2(self);
};
var hasInterrupts = (self) => self.reasons.some(isInterruptReason);
var causeFilterInterruptors = (self) => {
  let interruptors;
  for (let i = 0;i < self.reasons.length; i++) {
    const f = self.reasons[i];
    if (f._tag !== "Interrupt")
      continue;
    interruptors ??= new Set;
    if (f.fiberId !== undefined) {
      interruptors.add(f.fiberId);
    }
  }
  return interruptors ? succeed2(interruptors) : fail2(self);
};
var causeCombine = /* @__PURE__ */ dual(2, (self, that) => {
  if (self.reasons.length === 0) {
    return that;
  } else if (that.reasons.length === 0) {
    return self;
  }
  const newCause = new CauseImpl(union(self.reasons, that.reasons));
  return equals(self, newCause) ? self : newCause;
});
var causePartition = (self) => {
  const obj = {
    Fail: [],
    Die: [],
    Interrupt: []
  };
  for (let i = 0;i < self.reasons.length; i++) {
    obj[self.reasons[i]._tag].push(self.reasons[i]);
  }
  return obj;
};
var causeSquash = (self) => {
  const partitioned = causePartition(self);
  if (partitioned.Fail.length > 0) {
    return partitioned.Fail[0].error;
  } else if (partitioned.Die.length > 0) {
    return partitioned.Die[0].defect;
  } else if (partitioned.Interrupt.length > 0) {
    return new globalThis.Error("All fibers interrupted without error");
  }
  return new globalThis.Error("Empty cause");
};
var FiberTypeId = `~effect/Fiber/${version}`;
var fiberVariance = {
  _A: identity,
  _E: identity
};
var fiberIdStore = {
  id: 0
};
var getCurrentFiber = () => globalThis[currentFiberTypeId];

class FiberImpl {
  constructor(context, interruptible = true) {
    this[FiberTypeId] = fiberVariance;
    this.setContext(context);
    this.id = ++fiberIdStore.id;
    this.currentOpCount = 0;
    this.currentLoopCount = 0;
    this.interruptible = interruptible;
    this._stack = [];
    this._observers = [];
    this._exit = undefined;
    this._children = undefined;
    this._interruptedCause = undefined;
    this._yielded = undefined;
    this.runtimeMetrics?.recordFiberStart(this.context);
  }
  [FiberTypeId];
  id;
  interruptible;
  currentOpCount;
  currentLoopCount;
  _stack;
  _observers;
  _exit;
  _currentExit;
  _children;
  _interruptedCause;
  _yielded;
  context;
  currentScheduler;
  currentTracerContext;
  currentSpan;
  currentLogLevel;
  minimumLogLevel;
  currentStackFrame;
  runtimeMetrics;
  maxOpsBeforeYield;
  currentPreventYield;
  _dispatcher = undefined;
  get currentDispatcher() {
    return this._dispatcher ??= this.currentScheduler.makeDispatcher();
  }
  getRef(ref) {
    return getReferenceUnsafe(this.context, ref);
  }
  addObserver(cb) {
    if (this._exit) {
      cb(this._exit);
      return constVoid;
    }
    this._observers.push(cb);
    return () => {
      const index = this._observers.indexOf(cb);
      if (index >= 0) {
        this._observers.splice(index, 1);
      }
    };
  }
  interruptUnsafe(fiberId, annotations) {
    if (this._exit) {
      return;
    }
    let cause = causeInterrupt(fiberId);
    if (this.currentStackFrame) {
      cause = causeAnnotate(cause, make3(StackTraceKey, this.currentStackFrame));
    }
    if (annotations) {
      cause = causeAnnotate(cause, annotations);
    }
    this._interruptedCause = this._interruptedCause ? causeCombine(this._interruptedCause, cause) : cause;
    if (this.interruptible) {
      this.evaluate(failCause(this._interruptedCause));
    }
  }
  pollUnsafe() {
    return this._exit;
  }
  evaluate(effect) {
    if (this._exit) {
      return;
    } else if (this._yielded !== undefined) {
      const yielded = this._yielded;
      this._yielded = undefined;
      yielded();
    }
    const exit = this.runLoop(effect);
    if (exit === Yield) {
      return;
    }
    const interruptChildren = fiberMiddleware.interruptChildren && fiberMiddleware.interruptChildren(this);
    if (interruptChildren !== undefined) {
      return this.evaluate(flatMap(interruptChildren, () => exit));
    }
    this._exit = exit;
    this.runtimeMetrics?.recordFiberEnd(this.context, this._exit);
    for (let i = 0;i < this._observers.length; i++) {
      this._observers[i](exit);
    }
    this._observers.length = 0;
  }
  runLoop(effect) {
    const prevFiber = globalThis[currentFiberTypeId];
    globalThis[currentFiberTypeId] = this;
    let yielding = false;
    let current = effect;
    this.currentOpCount = 0;
    const currentLoop = ++this.currentLoopCount;
    try {
      while (true) {
        this.currentOpCount++;
        if (!yielding && !this.currentPreventYield && this.currentScheduler.shouldYield(this)) {
          yielding = true;
          const prev = current;
          current = flatMap(yieldNow, () => prev);
        }
        current = this.currentTracerContext ? this.currentTracerContext(current, this) : current[evaluate](this);
        if (currentLoop !== this.currentLoopCount) {
          return Yield;
        } else if (current === Yield) {
          const yielded = this._yielded;
          if (ExitTypeId in yielded) {
            this._yielded = undefined;
            return yielded;
          }
          return Yield;
        }
      }
    } catch (error) {
      if (!hasProperty(current, evaluate)) {
        return exitDie(`Fiber.runLoop: Not a valid effect: ${String(current)}`);
      }
      return this.runLoop(exitDie(error));
    } finally {
      globalThis[currentFiberTypeId] = prevFiber;
    }
  }
  getCont(symbol) {
    while (true) {
      const op = this._stack.pop();
      if (!op)
        return;
      const cont = op[contAll] && op[contAll](this);
      if (cont) {
        cont[symbol] = cont;
        return cont;
      }
      if (op[symbol])
        return op;
    }
  }
  yieldWith(value) {
    this._yielded = value;
    return Yield;
  }
  children() {
    return this._children ??= new Set;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  setContext(context) {
    this.context = context;
    const scheduler = this.getRef(Scheduler);
    if (scheduler !== this.currentScheduler) {
      this.currentScheduler = scheduler;
      this._dispatcher = undefined;
    }
    this.currentSpan = context.mapUnsafe.get(ParentSpanKey);
    this.currentLogLevel = this.getRef(CurrentLogLevel);
    this.minimumLogLevel = this.getRef(MinimumLogLevel);
    this.currentStackFrame = context.mapUnsafe.get(CurrentStackFrame.key);
    this.maxOpsBeforeYield = this.getRef(MaxOpsBeforeYield);
    this.currentPreventYield = this.getRef(PreventSchedulerYield);
    this.runtimeMetrics = context.mapUnsafe.get(FiberRuntimeMetricsKey);
    const currentTracer = context.mapUnsafe.get(TracerKey);
    this.currentTracerContext = currentTracer ? currentTracer["context"] : undefined;
  }
  get currentSpanLocal() {
    return this.currentSpan?._tag === "Span" ? this.currentSpan : undefined;
  }
}
var fiberMiddleware = {
  interruptChildren: undefined
};
var fiberStackAnnotations = (fiber) => {
  if (!fiber.currentStackFrame)
    return;
  const annotations = new Map;
  annotations.set(StackTraceKey.key, fiber.currentStackFrame);
  return makeUnsafe(annotations);
};
var fiberAwait = (self) => {
  const impl = self;
  if (impl._exit)
    return succeed3(impl._exit);
  return callback((resume) => {
    if (impl._exit)
      return resume(succeed3(impl._exit));
    return sync(self.addObserver((exit) => resume(succeed3(exit))));
  });
};
var fiberAwaitAll = (self) => callback((resume) => {
  const iter = self[Symbol.iterator]();
  const exits = [];
  let cancel = undefined;
  function loop() {
    let result = iter.next();
    while (!result.done) {
      if (result.value._exit) {
        exits.push(result.value._exit);
        result = iter.next();
        continue;
      }
      cancel = result.value.addObserver((exit) => {
        exits.push(exit);
        loop();
      });
      return;
    }
    resume(succeed3(exits));
  }
  loop();
  return sync(() => cancel?.());
});
var fiberInterrupt = (self) => withFiber((fiber) => fiberInterruptAs(self, fiber.id));
var fiberInterruptAs = /* @__PURE__ */ dual((args) => hasProperty(args[0], FiberTypeId), (self, fiberId, annotations) => withFiber((parent) => {
  let ann = fiberStackAnnotations(parent);
  ann = ann && annotations ? merge(ann, annotations) : ann ?? annotations;
  self.interruptUnsafe(fiberId, ann);
  return asVoid(fiberAwait(self));
}));
var fiberInterruptAll = (fibers) => withFiber((parent) => {
  const annotations = fiberStackAnnotations(parent);
  for (const fiber of fibers) {
    fiber.interruptUnsafe(parent.id, annotations);
  }
  return asVoid(fiberAwaitAll(fibers));
});
var succeed3 = exitSucceed;
var failCause = exitFailCause;
var fail3 = exitFail;
var sync = /* @__PURE__ */ makePrimitive({
  op: "Sync",
  [evaluate](fiber) {
    const value = this[args]();
    const cont = fiber.getCont(contA);
    return cont ? cont[contA](value, fiber) : fiber.yieldWith(exitSucceed(value));
  }
});
var suspend = /* @__PURE__ */ makePrimitive({
  op: "Suspend",
  [evaluate](_fiber) {
    return this[args]();
  }
});
var fromResult = /* @__PURE__ */ match2({
  onFailure: fail3,
  onSuccess: succeed3
});
var yieldNowWith = /* @__PURE__ */ makePrimitive({
  op: "Yield",
  [evaluate](fiber) {
    let resumed = false;
    fiber.currentDispatcher.scheduleTask(() => {
      if (resumed)
        return;
      fiber.evaluate(exitVoid);
    }, this[args] ?? 0);
    return fiber.yieldWith(() => {
      resumed = true;
    });
  }
});
var yieldNow = /* @__PURE__ */ yieldNowWith(0);
var succeedSome = (a) => succeed3(some2(a));
var succeedNone = /* @__PURE__ */ succeed3(/* @__PURE__ */ none2());
var die = (defect) => exitDie(defect);
var failSync = (error) => suspend(() => fail3(internalCall(error)));
var void_ = /* @__PURE__ */ succeed3(undefined);
var try_ = (options) => suspend(() => {
  try {
    return succeed3(internalCall(options.try));
  } catch (err) {
    return fail3(internalCall(() => options.catch(err)));
  }
});
var promise = (evaluate) => callbackOptions(function(resume, signal) {
  internalCall(() => evaluate(signal)).then((a) => resume(succeed3(a)), (e) => resume(die(e)));
}, evaluate.length !== 0);
var tryPromise = (options) => {
  const f = typeof options === "function" ? options : options.try;
  const catcher = typeof options === "function" ? (cause) => new UnknownError(cause, "An error occurred in Effect.tryPromise") : options.catch;
  return callbackOptions(function(resume, signal) {
    try {
      internalCall(() => f(signal)).then((a) => resume(succeed3(a)), (e) => resume(fail3(internalCall(() => catcher(e)))));
    } catch (err) {
      resume(fail3(internalCall(() => catcher(err))));
    }
  }, eval.length !== 0);
};
var callbackOptions = /* @__PURE__ */ makePrimitive({
  op: "Async",
  single: false,
  [evaluate](fiber) {
    const register = internalCall(() => this[args][0].bind(fiber.currentScheduler));
    let resumed = false;
    let yielded = false;
    const controller = this[args][1] ? new AbortController : undefined;
    const onCancel = register((effect) => {
      if (resumed)
        return;
      resumed = true;
      if (yielded) {
        fiber.evaluate(effect);
      } else {
        yielded = effect;
      }
    }, controller?.signal);
    if (yielded !== false)
      return yielded;
    yielded = true;
    fiber._yielded = () => {
      resumed = true;
    };
    if (controller === undefined && onCancel === undefined) {
      return Yield;
    }
    fiber._stack.push(asyncFinalizer(() => {
      resumed = true;
      controller?.abort();
      return onCancel ?? exitVoid;
    }));
    return Yield;
  }
});
var asyncFinalizer = /* @__PURE__ */ makePrimitive({
  op: "AsyncFinalizer",
  [contAll](fiber) {
    if (fiber.interruptible) {
      fiber.interruptible = false;
      fiber._stack.push(setInterruptibleTrue);
    }
  },
  [contE](cause, _fiber) {
    return hasInterrupts(cause) ? flatMap(this[args](), () => failCause(cause)) : failCause(cause);
  }
});
var callback = (register) => callbackOptions(register, register.length >= 2);
var gen = (...args) => suspend(() => fromIteratorUnsafe(args.length === 1 ? args[0]() : args[1].call(args[0].self)));
var fnUntraced = (body, ...pipeables) => {
  const fn = pipeables.length === 0 ? function() {
    return suspend(() => fromIteratorUnsafe(body.apply(this, arguments)));
  } : function() {
    let effect = suspend(() => fromIteratorUnsafe(body.apply(this, arguments)));
    for (let i = 0;i < pipeables.length; i++) {
      effect = pipeables[i](effect, ...arguments);
    }
    return effect;
  };
  return defineFunctionLength(body.length, fn);
};
var defineFunctionLength = (length, fn) => Object.defineProperty(fn, "length", {
  value: length,
  configurable: true
});
var fnStackCleaner = /* @__PURE__ */ makeStackCleaner(2);
var fn = function() {
  const nameFirst = typeof arguments[0] === "string";
  const name = nameFirst ? arguments[0] : "Effect.fn";
  const spanOptions = nameFirst ? arguments[1] : undefined;
  const prevLimit = globalThis.Error.stackTraceLimit;
  globalThis.Error.stackTraceLimit = 2;
  const defError = new globalThis.Error;
  globalThis.Error.stackTraceLimit = prevLimit;
  if (nameFirst) {
    return (body, ...pipeables) => makeFn(name, body, defError, pipeables, nameFirst, spanOptions);
  }
  return makeFn(name, arguments[0], defError, Array.prototype.slice.call(arguments, 1), nameFirst, spanOptions);
};
var makeFn = (name, bodyOrOptions, defError, pipeables, addSpan, spanOptions) => {
  const body = typeof bodyOrOptions === "function" ? bodyOrOptions : pipeables.pop().bind(bodyOrOptions.self);
  return defineFunctionLength(body.length, function(...args) {
    let result = suspend(() => {
      const iter = body.apply(this, arguments);
      return isEffect(iter) ? iter : fromIteratorUnsafe(iter);
    });
    for (let i = 0;i < pipeables.length; i++) {
      result = pipeables[i](result, ...args);
    }
    if (!isEffect(result)) {
      return result;
    }
    const prevLimit = globalThis.Error.stackTraceLimit;
    globalThis.Error.stackTraceLimit = 2;
    const callError = new globalThis.Error;
    globalThis.Error.stackTraceLimit = prevLimit;
    return updateService(addSpan ? useSpan(name, spanOptions, (span) => provideParentSpan(result, span)) : result, CurrentStackFrame, (prev) => ({
      name,
      stack: fnStackCleaner(() => callError.stack),
      parent: {
        name: `${name} (definition)`,
        stack: fnStackCleaner(() => defError.stack),
        parent: prev
      }
    }));
  });
};
var fnUntracedEager = (body, ...pipeables) => defineFunctionLength(body.length, pipeables.length === 0 ? function() {
  return fromIteratorEagerUnsafe(() => body.apply(this, arguments));
} : function() {
  let effect = fromIteratorEagerUnsafe(() => body.apply(this, arguments));
  for (const pipeable of pipeables) {
    effect = pipeable(effect);
  }
  return effect;
});
var fromIteratorEagerUnsafe = (evaluate) => {
  try {
    const iterator = evaluate();
    let value = undefined;
    while (true) {
      const state = iterator.next(value);
      if (state.done) {
        return succeed3(state.value);
      }
      const primitive = state.value;
      if (primitive && primitive._tag === "Success") {
        value = primitive.value;
        continue;
      } else if (primitive && primitive._tag === "Failure") {
        return state.value;
      } else {
        let isFirstExecution = true;
        return suspend(() => {
          if (isFirstExecution) {
            isFirstExecution = false;
            return flatMap(state.value, (value) => fromIteratorUnsafe(iterator, value));
          } else {
            return suspend(() => fromIteratorUnsafe(evaluate()));
          }
        });
      }
    }
  } catch (error) {
    return die(error);
  }
};
var fromIteratorUnsafe = /* @__PURE__ */ makePrimitive({
  op: "Iterator",
  single: false,
  [contA](value, fiber) {
    const iter = this[args][0];
    while (true) {
      const state = iter.next(value);
      if (state.done)
        return succeed3(state.value);
      if (!effectIsExit(state.value)) {
        fiber._stack.push(this);
        return state.value;
      } else if (state.value._tag === "Failure") {
        return state.value;
      }
      value = state.value.value;
    }
  },
  [evaluate](fiber) {
    return this[contA](this[args][1], fiber);
  }
});
var as = /* @__PURE__ */ dual(2, (self, value) => {
  const b = succeed3(value);
  return flatMap(self, (_) => b);
});
var andThen = /* @__PURE__ */ dual(2, (self, f) => flatMap(self, (a) => isEffect(f) ? f : internalCall(() => f(a))));
var asVoid = (self) => flatMap(self, (_) => exitVoid);
var flatMap = /* @__PURE__ */ dual(2, (self, f) => {
  const onSuccess = Object.create(OnSuccessProto);
  onSuccess[args] = self;
  onSuccess[contA] = f.length !== 1 ? (a) => f(a) : f;
  return onSuccess;
});
var OnSuccessProto = /* @__PURE__ */ makePrimitiveProto({
  op: "OnSuccess",
  [evaluate](fiber) {
    fiber._stack.push(this);
    return this[args];
  }
});
var effectIsExit = (effect) => (ExitTypeId in effect);
var flatMapEager = /* @__PURE__ */ dual(2, (self, f) => {
  if (effectIsExit(self)) {
    return self._tag === "Success" ? f(self.value) : self;
  }
  return flatMap(self, f);
});
var map4 = /* @__PURE__ */ dual(2, (self, f) => flatMap(self, (a) => succeed3(internalCall(() => f(a)))));
var mapEager = /* @__PURE__ */ dual(2, (self, f) => effectIsExit(self) ? exitMap(self, f) : map4(self, f));
var mapErrorEager = /* @__PURE__ */ dual(2, (self, f) => effectIsExit(self) ? exitMapError(self, f) : mapError2(self, f));
var catchEager = /* @__PURE__ */ dual(2, (self, f) => {
  if (effectIsExit(self)) {
    if (self._tag === "Success")
      return self;
    const error = findError(self.cause);
    if (isFailure2(error))
      return self;
    return f(error.success);
  }
  return catch_(self, f);
});
var exitInterrupt = (fiberId) => exitFailCause(causeInterrupt(fiberId));
var exitIsSuccess = (self) => self._tag === "Success";
var exitFilterCause = (self) => self._tag === "Failure" ? succeed2(self.cause) : fail2(self);
var exitVoid = /* @__PURE__ */ exitSucceed(undefined);
var exitMap = /* @__PURE__ */ dual(2, (self, f) => self._tag === "Success" ? exitSucceed(f(self.value)) : self);
var exitMapError = /* @__PURE__ */ dual(2, (self, f) => {
  if (self._tag === "Success")
    return self;
  const error = findError(self.cause);
  if (isFailure2(error))
    return self;
  return exitFail(f(error.success));
});
var exitZipRight = /* @__PURE__ */ dual(2, (self, that) => exitIsSuccess(self) ? that : self);
var exitAsVoidAll = (exits) => {
  const failures = [];
  for (const exit of exits) {
    if (exit._tag === "Failure") {
      failures.push(...exit.cause.reasons);
    }
  }
  return failures.length === 0 ? exitVoid : exitFailCause(causeFromReasons(failures));
};
var exitGetSuccess = (self) => exitIsSuccess(self) ? some2(self.value) : none2();
var serviceOption = (service) => withFiber((fiber) => succeed3(getOption(fiber.context, service)));
var updateContext = /* @__PURE__ */ dual(2, (self, f) => withFiber((fiber) => {
  const prevContext = fiber.context;
  const nextContext = f(prevContext);
  if (prevContext === nextContext)
    return self;
  fiber.setContext(nextContext);
  return onExitPrimitive(self, () => {
    fiber.setContext(prevContext);
    return;
  });
}));
var updateService = /* @__PURE__ */ dual(3, (self, service, f) => updateContext(self, (s) => {
  const prev = getUnsafe(s, service);
  const next = f(prev);
  if (prev === next)
    return s;
  return add(s, service, next);
}));
var context = () => getContext;
var getContext = /* @__PURE__ */ withFiber((fiber) => succeed3(fiber.context));
var contextWith = (f) => withFiber((fiber) => f(fiber.context));
var provideContext = /* @__PURE__ */ dual(2, (self, context) => {
  if (effectIsExit(self))
    return self;
  return updateContext(self, merge(context));
});
var provideService = function() {
  if (arguments.length === 1) {
    return dual(2, (self, impl) => provideServiceImpl(self, arguments[0], impl));
  }
  return dual(3, (self, service, impl) => provideServiceImpl(self, service, impl)).apply(this, arguments);
};
var provideServiceImpl = (self, service, implementation) => updateContext(self, (s) => {
  const prev = s.mapUnsafe.get(service.key);
  if (prev === implementation)
    return s;
  return add(s, service, implementation);
});
var forever = /* @__PURE__ */ dual((args) => isEffect(args[0]), (self, options) => whileLoop({
  while: constTrue,
  body: constant(options?.disableYield ? self : flatMap(self, (_) => yieldNow)),
  step: constVoid
}));
var catchCause = /* @__PURE__ */ dual(2, (self, f) => {
  const onFailure = Object.create(OnFailureProto);
  onFailure[args] = self;
  onFailure[contE] = f.length !== 1 ? (cause) => f(cause) : f;
  return onFailure;
});
var OnFailureProto = /* @__PURE__ */ makePrimitiveProto({
  op: "OnFailure",
  [evaluate](fiber) {
    fiber._stack.push(this);
    return this[args];
  }
});
var catchCauseFilter = /* @__PURE__ */ dual(3, (self, filter, f) => catchCause(self, (cause) => {
  const eb = filter(cause);
  return isFailure2(eb) ? failCause(eb.failure) : internalCall(() => f(eb.success, cause));
}));
var catch_ = /* @__PURE__ */ dual(2, (self, f) => catchCauseFilter(self, findError, (e) => f(e)));
var catchIf = /* @__PURE__ */ dual((args) => isEffect(args[0]), (self, predicate, f, orElse) => catchCause(self, (cause) => {
  const error = findError(cause);
  if (isFailure2(error))
    return failCause(error.failure);
  if (!predicate(error.success)) {
    return orElse ? internalCall(() => orElse(error.success)) : failCause(cause);
  }
  return internalCall(() => f(error.success));
}));
var catchTag = /* @__PURE__ */ dual((args) => isEffect(args[0]), (self, k, f, orElse) => {
  const pred = Array.isArray(k) ? (e) => hasProperty(e, "_tag") && k.includes(e._tag) : isTagged(k);
  return catchIf(self, pred, f, orElse);
});
var mapError2 = /* @__PURE__ */ dual(2, (self, f) => catch_(self, (error) => failSync(() => f(error))));
var matchCauseEffect = /* @__PURE__ */ dual(2, (self, options) => {
  const primitive = Object.create(OnSuccessAndFailureProto);
  primitive[args] = self;
  primitive[contA] = options.onSuccess.length !== 1 ? (a) => options.onSuccess(a) : options.onSuccess;
  primitive[contE] = options.onFailure.length !== 1 ? (cause) => options.onFailure(cause) : options.onFailure;
  return primitive;
});
var OnSuccessAndFailureProto = /* @__PURE__ */ makePrimitiveProto({
  op: "OnSuccessAndFailure",
  [evaluate](fiber) {
    fiber._stack.push(this);
    return this[args];
  }
});
var exit = (self) => effectIsExit(self) ? exitSucceed(self) : exitPrimitive(self);
var exitPrimitive = /* @__PURE__ */ makePrimitive({
  op: "Exit",
  [evaluate](fiber) {
    fiber._stack.push(this);
    return this[args];
  },
  [contA](value, _, exit) {
    return succeed3(exit ?? exitSucceed(value));
  },
  [contE](cause, _, exit) {
    return succeed3(exit ?? exitFailCause(cause));
  }
});
var ScopeTypeId = "~effect/Scope";
var ScopeCloseableTypeId = "~effect/Scope/Closeable";
var scopeTag = /* @__PURE__ */ Service("effect/Scope");
var scopeClose = (self, exit_) => suspend(() => scopeCloseUnsafe(self, exit_) ?? void_);
var scopeCloseUnsafe = (self, exit_) => {
  if (self.state._tag === "Closed")
    return;
  const closed = {
    _tag: "Closed",
    exit: exit_
  };
  if (self.state._tag === "Empty") {
    self.state = closed;
    return;
  }
  const {
    finalizers
  } = self.state;
  self.state = closed;
  if (finalizers.size === 0) {
    return;
  } else if (finalizers.size === 1) {
    return finalizers.values().next().value(exit_);
  }
  return scopeCloseFinalizers(self, finalizers, exit_);
};
var scopeCloseFinalizers = /* @__PURE__ */ fnUntraced(function* (self, finalizers, exit_) {
  let exits = [];
  const fibers = [];
  const arr = Array.from(finalizers.values());
  const parent = getCurrentFiber();
  for (let i = arr.length - 1;i >= 0; i--) {
    const finalizer = arr[i];
    if (self.strategy === "sequential") {
      exits.push(yield* exit(finalizer(exit_)));
    } else {
      fibers.push(forkUnsafe(parent, finalizer(exit_), true, true, "inherit"));
    }
  }
  if (fibers.length > 0) {
    exits = yield* fiberAwaitAll(fibers);
  }
  return yield* exitAsVoidAll(exits);
});
var scopeForkUnsafe = (scope, finalizerStrategy) => {
  const newScope = scopeMakeUnsafe(finalizerStrategy);
  if (scope.state._tag === "Closed") {
    newScope.state = scope.state;
    return newScope;
  }
  const key = {};
  scopeAddFinalizerUnsafe(scope, key, (exit) => scopeClose(newScope, exit));
  scopeAddFinalizerUnsafe(newScope, key, (_) => sync(() => scopeRemoveFinalizerUnsafe(scope, key)));
  return newScope;
};
var scopeAddFinalizerExit = (scope, finalizer) => {
  return suspend(() => {
    if (scope.state._tag === "Closed") {
      return finalizer(scope.state.exit);
    }
    scopeAddFinalizerUnsafe(scope, {}, finalizer);
    return void_;
  });
};
var scopeAddFinalizer = (scope, finalizer) => scopeAddFinalizerExit(scope, constant(finalizer));
var scopeAddFinalizerUnsafe = (scope, key, finalizer) => {
  if (scope.state._tag === "Empty") {
    scope.state = {
      _tag: "Open",
      finalizers: new Map([[key, finalizer]])
    };
  } else if (scope.state._tag === "Open") {
    scope.state.finalizers.set(key, finalizer);
  }
};
var scopeRemoveFinalizerUnsafe = (scope, key) => {
  if (scope.state._tag === "Open") {
    scope.state.finalizers.delete(key);
  }
};
var scopeMakeUnsafe = (finalizerStrategy = "sequential") => ({
  [ScopeCloseableTypeId]: ScopeCloseableTypeId,
  [ScopeTypeId]: ScopeTypeId,
  strategy: finalizerStrategy,
  state: constScopeEmpty
});
var constScopeEmpty = {
  _tag: "Empty"
};
var provideScope = /* @__PURE__ */ provideService(scopeTag);
var onExitPrimitive = /* @__PURE__ */ makePrimitive({
  op: "OnExit",
  single: false,
  [evaluate](fiber) {
    fiber._stack.push(this);
    return this[args][0];
  },
  [contAll](fiber) {
    if (fiber.interruptible && this[args][2] !== true) {
      fiber._stack.push(setInterruptibleTrue);
      fiber.interruptible = false;
    }
  },
  [contA](value, _, exit) {
    exit ??= exitSucceed(value);
    const eff = this[args][1](exit);
    return eff ? flatMap(eff, (_) => exit) : exit;
  },
  [contE](cause, _, exit) {
    exit ??= exitFailCause(cause);
    const eff = this[args][1](exit);
    return eff ? flatMap(eff, (_) => exit) : exit;
  }
});
var onExit = /* @__PURE__ */ dual(2, onExitPrimitive);
var onExitFilter = /* @__PURE__ */ dual(3, (self, filter, f) => onExit(self, (exit) => {
  const b = filter(exit);
  return isFailure2(b) ? void_ : f(b.success, exit);
}));
var onError = /* @__PURE__ */ dual(2, (self, f) => onExitFilter(self, exitFilterCause, f));
var onErrorFilter = /* @__PURE__ */ dual(3, (self, filter, f) => onExit(self, (exit) => {
  if (exit._tag !== "Failure") {
    return void_;
  }
  const result = filter(exit.cause);
  return isFailure2(result) ? void_ : f(result.success, exit.cause);
}));
var onInterrupt = /* @__PURE__ */ dual(2, (self, finalizer) => onErrorFilter(causeFilterInterruptors, finalizer)(self));
var cachedInvalidateWithTTL = /* @__PURE__ */ dual(2, (self, ttl) => sync(() => {
  const ttlMillis = toMillis(fromInputUnsafe(ttl));
  const isFinite = Number.isFinite(ttlMillis);
  const latch = makeLatchUnsafe(false);
  let expiresAt = 0;
  let running = false;
  let exit;
  const wait = flatMap(latch.await, () => exit);
  return [withFiber((fiber) => {
    const clock = fiber.getRef(ClockRef);
    const now = isFinite ? clock.currentTimeMillisUnsafe() : 0;
    if (running || now < expiresAt)
      return exit ?? wait;
    running = true;
    latch.closeUnsafe();
    exit = undefined;
    return onExit(self, (exit_) => sync(() => {
      running = false;
      expiresAt = clock.currentTimeMillisUnsafe() + ttlMillis;
      exit = exit_;
      latch.openUnsafe();
    }));
  }), sync(() => {
    expiresAt = 0;
    latch.closeUnsafe();
    exit = undefined;
  })];
}));
var cachedWithTTL = /* @__PURE__ */ dual(2, (self, timeToLive) => map4(cachedInvalidateWithTTL(self, timeToLive), (tuple) => tuple[0]));
var cached = (self) => cachedWithTTL(self, infinity);
var setInterruptible = /* @__PURE__ */ makePrimitive({
  op: "SetInterruptible",
  [contAll](fiber) {
    fiber.interruptible = this[args];
    if (fiber._interruptedCause && fiber.interruptible) {
      return () => failCause(fiber._interruptedCause);
    }
  }
});
var setInterruptibleTrue = /* @__PURE__ */ setInterruptible(true);
var setInterruptibleFalse = /* @__PURE__ */ setInterruptible(false);
var interruptible = (self) => withFiber((fiber) => {
  if (fiber.interruptible)
    return self;
  fiber.interruptible = true;
  fiber._stack.push(setInterruptibleFalse);
  if (fiber._interruptedCause)
    return failCause(fiber._interruptedCause);
  return self;
});
var uninterruptibleMask = (f) => withFiber((fiber) => {
  if (!fiber.interruptible)
    return f(identity);
  fiber.interruptible = false;
  fiber._stack.push(setInterruptibleTrue);
  return f(interruptible);
});
var whileLoop = /* @__PURE__ */ makePrimitive({
  op: "While",
  [contA](value, fiber) {
    this[args].step(value);
    if (this[args].while()) {
      fiber._stack.push(this);
      return this[args].body();
    }
    return exitVoid;
  },
  [evaluate](fiber) {
    if (this[args].while()) {
      fiber._stack.push(this);
      return this[args].body();
    }
    return exitVoid;
  }
});
var forEach = /* @__PURE__ */ dual((args) => typeof args[1] === "function", (iterable, f, options) => withFiber((parent) => {
  const concurrencyOption = options?.concurrency === "inherit" ? parent.getRef(CurrentConcurrency) : options?.concurrency ?? 1;
  const concurrency = concurrencyOption === "unbounded" ? Number.POSITIVE_INFINITY : Math.max(1, concurrencyOption);
  if (concurrency === 1) {
    return forEachSequential(iterable, f, options);
  }
  const items = fromIterable(iterable);
  let length = items.length;
  if (length === 0) {
    return options?.discard ? void_ : succeed3([]);
  }
  const out = options?.discard ? undefined : new Array(length);
  const eff = forEachConcurrent({
    f,
    out
  }, items, {
    concurrency
  });
  return eff ? as(eff, out) : succeed3(out);
}));
var forEachSequential = (iterable, f, options) => suspend(() => {
  const out = options?.discard ? undefined : [];
  const iterator = iterable[Symbol.iterator]();
  let state = iterator.next();
  let index = 0;
  return as(whileLoop({
    while: () => !state.done,
    body: () => f(state.value, index++),
    step: (b) => {
      if (out)
        out.push(b);
      state = iterator.next();
    }
  }), out);
});
var iterateEagerImpl = (options) => {
  const onItem = options.onItem;
  const step = options.step;
  return (state, items, opts) => {
    let index = opts?.start ?? 0;
    const end = opts?.end ?? items.length;
    const concurrency = opts?.concurrency ?? 1;
    let done = false;
    let parentFiber;
    let fibers;
    let resume;
    let interrupted = false;
    let terminal;
    let effect;
    const go = () => {
      let paused = false;
      for (;!terminal && index < end; index++) {
        const item = items[index];
        const eff = effect ?? onItem(state, item, index);
        if (effectIsExit(eff)) {
          terminal = step(state, item, eff, index);
          if (terminal)
            break;
        } else if (concurrency === 1) {
          return flatMap(exit(eff), (exit) => {
            terminal = step(state, item, exit, index);
            index++;
            return terminal ?? go() ?? void_;
          });
        } else if (!parentFiber) {
          return callback((cb) => {
            parentFiber = getCurrentFiber();
            effect = eff;
            resume = cb;
            const result = go();
            if (result)
              return cb(result);
            return suspend(() => {
              terminal = exitVoid;
              interrupted = true;
              return fibers ? fiberInterruptAll(fibers) : void_;
            });
          });
        } else {
          effect = undefined;
          const fiber = forkUnsafe(parentFiber, eff, true, true, "inherit");
          if (fiber._exit) {
            terminal = step(state, item, fiber._exit, index);
            if (terminal)
              break;
            continue;
          }
          if (fibers)
            fibers.add(fiber);
          else
            fibers = new Set([fiber]);
          const currentIndex = index;
          fiber.addObserver((exit) => {
            fibers.delete(fiber);
            if (terminal) {
              if (!interrupted && exit._tag === "Failure") {
                for (const reason of exit.cause.reasons) {
                  if (reason._tag === "Interrupt")
                    continue;
                  else if (terminal._tag === "Failure") {
                    terminal.cause.reasons.push(reason);
                  } else {
                    terminal = exitFailCause(causeFromReasons([reason]));
                  }
                }
              }
            } else {
              const result = step(state, item, exit, currentIndex);
              if (result) {
                terminal = result._tag === "Failure" ? exitFailCause(causeFromReasons(result.cause.reasons.slice())) : result;
                go();
              }
            }
            if (paused) {
              const eff = go();
              if (eff)
                resume(eff);
            } else if (done && fibers.size === 0) {
              resume(terminal ?? void_);
            }
          });
          if (fibers.size < concurrency)
            continue;
          paused = true;
          index++;
          return;
        }
      }
      done = true;
      if (terminal) {
        if (fibers && fibers.size > 0) {
          const annotations = fiberStackAnnotations(parentFiber);
          fibers.forEach((f) => f.interruptUnsafe(parentFiber.id, annotations));
          return;
        }
        if (resume || terminal._tag === "Failure") {
          return terminal;
        }
      } else if (resume) {
        if (!fibers) {
          return exitVoid;
        } else if (fibers.size === 0) {
          resume(void_);
        }
      }
    };
    return go();
  };
};
var iterateEager = () => iterateEagerImpl;
var forEachConcurrent = /* @__PURE__ */ iterateEagerImpl({
  onItem(state, item, index) {
    return state.f(item, index);
  },
  step(state, _, exit, index) {
    if (exit._tag === "Failure")
      return exit;
    else if (state.out) {
      state.out[index] = exit.value;
    }
  }
});
var forkUnsafe = (parent, effect, immediate = false, daemon = false, uninterruptible = false) => {
  const interruptible = uninterruptible === "inherit" ? parent.interruptible : !uninterruptible;
  const child = new FiberImpl(parent.context, interruptible);
  if (immediate) {
    child.evaluate(effect);
  } else {
    parent.currentDispatcher.scheduleTask(() => child.evaluate(effect), 0);
  }
  if (!daemon && !child._exit) {
    parent.children().add(child);
    child.addObserver(() => parent._children.delete(child));
  }
  return child;
};
var runForkWith = (context) => (effect, options) => {
  const fiber = new FiberImpl(options?.scheduler ? add(context, Scheduler, options.scheduler) : context, options?.uninterruptible !== true);
  fiber.evaluate(effect);
  if (fiber._exit)
    return fiber;
  if (options?.signal) {
    if (options.signal.aborted) {
      fiber.interruptUnsafe();
    } else {
      const abort = () => fiber.interruptUnsafe();
      options.signal.addEventListener("abort", abort, {
        once: true
      });
      fiber.addObserver(() => options.signal.removeEventListener("abort", abort));
    }
  }
  if (options?.onFiberStart) {
    options.onFiberStart(fiber);
  }
  return fiber;
};
var runFork = /* @__PURE__ */ runForkWith(/* @__PURE__ */ empty());
var runPromiseExitWith = (context) => {
  const runFork = runForkWith(context);
  return (effect, options) => {
    const fiber = runFork(effect, options);
    return new Promise((resolve) => {
      fiber.addObserver((exit) => resolve(exit));
    });
  };
};
var runPromiseWith = (context) => {
  const runPromiseExit = runPromiseExitWith(context);
  return (effect, options) => runPromiseExit(effect, options).then((exit) => {
    if (exit._tag === "Failure") {
      throw causeSquash(exit.cause);
    }
    return exit.value;
  });
};
var runPromise = /* @__PURE__ */ runPromiseWith(/* @__PURE__ */ empty());
var runSyncExitWith = (context) => {
  const runFork = runForkWith(context);
  return (effect) => {
    if (effectIsExit(effect))
      return effect;
    const scheduler = new MixedScheduler("sync");
    const fiber = runFork(effect, {
      scheduler
    });
    fiber.currentDispatcher?.flush();
    return fiber._exit ?? exitDie(new AsyncFiberError(fiber));
  };
};
var runSyncExit = /* @__PURE__ */ runSyncExitWith(/* @__PURE__ */ empty());
var runSyncWith = (context) => {
  const runSyncExit = runSyncExitWith(context);
  return (effect) => {
    const exit = runSyncExit(effect);
    if (exit._tag === "Failure")
      throw causeSquash(exit.cause);
    return exit.value;
  };
};
var runSync = /* @__PURE__ */ runSyncWith(/* @__PURE__ */ empty());
var succeedTrue = /* @__PURE__ */ succeed3(true);
var succeedFalse = /* @__PURE__ */ succeed3(false);

class Latch {
  waiters = [];
  scheduled = false;
  isOpen;
  constructor(isOpen) {
    this.isOpen = isOpen;
  }
  scheduleUnsafe(fiber) {
    if (this.scheduled || this.waiters.length === 0) {
      return succeedTrue;
    }
    this.scheduled = true;
    fiber.currentDispatcher.scheduleTask(this.flushWaiters, 0);
    return succeedTrue;
  }
  flushWaiters = () => {
    this.scheduled = false;
    const waiters = this.waiters;
    this.waiters = [];
    for (let i = 0;i < waiters.length; i++) {
      waiters[i](exitVoid);
    }
  };
  open = /* @__PURE__ */ withFiber((fiber) => {
    if (this.isOpen)
      return succeedFalse;
    this.isOpen = true;
    return this.scheduleUnsafe(fiber);
  });
  release = /* @__PURE__ */ withFiber((fiber) => this.isOpen ? succeedFalse : this.scheduleUnsafe(fiber));
  openUnsafe() {
    if (this.isOpen)
      return false;
    this.isOpen = true;
    this.flushWaiters();
    return true;
  }
  await = /* @__PURE__ */ callback((resume) => {
    if (this.isOpen) {
      return resume(void_);
    }
    this.waiters.push(resume);
    return sync(() => {
      const index = this.waiters.indexOf(resume);
      if (index !== -1) {
        this.waiters.splice(index, 1);
      }
    });
  });
  closeUnsafe() {
    if (!this.isOpen)
      return false;
    this.isOpen = false;
    return true;
  }
  close = /* @__PURE__ */ sync(() => this.closeUnsafe());
  whenOpen = (self) => flatMap(this.await, () => self);
}
var makeLatchUnsafe = (open) => new Latch(open ?? false);
var bigint02 = /* @__PURE__ */ BigInt(0);
var NoopSpanProto = {
  _tag: "Span",
  spanId: "noop",
  traceId: "noop",
  sampled: false,
  status: {
    _tag: "Ended",
    startTime: bigint02,
    endTime: bigint02,
    exit: exitVoid
  },
  attributes: /* @__PURE__ */ new Map,
  links: [],
  kind: "internal",
  attribute() {},
  event() {},
  end() {},
  addLinks() {}
};
var noopSpan = (options) => Object.assign(Object.create(NoopSpanProto), options);
var filterDisablePropagation = (span) => {
  if (!span)
    return none2();
  return get(span.annotations, DisablePropagation) ? span._tag === "Span" ? filterDisablePropagation(getOrUndefined(span.parent)) : none2() : some2(span);
};
var makeSpanUnsafe = (fiber, name, options) => {
  const disablePropagation = !fiber.getRef(TracerEnabled) || options?.annotations && get(options.annotations, DisablePropagation);
  const parent = options?.parent !== undefined ? some2(options.parent) : options?.root ? none2() : filterDisablePropagation(fiber.currentSpan);
  let span;
  if (disablePropagation) {
    span = noopSpan({
      name,
      parent,
      annotations: add(options?.annotations ?? empty(), DisablePropagation, true)
    });
  } else {
    const tracer = fiber.getRef(Tracer);
    const clock = fiber.getRef(ClockRef);
    const timingEnabled = fiber.getRef(TracerTimingEnabled);
    const annotationsFromEnv = fiber.getRef(TracerSpanAnnotations);
    const linksFromEnv = fiber.getRef(TracerSpanLinks);
    const level = options?.level ?? fiber.getRef(CurrentTraceLevel);
    const links = options?.links !== undefined ? [...linksFromEnv, ...options.links] : linksFromEnv.slice();
    span = tracer.span({
      name,
      parent,
      annotations: options?.annotations ?? empty(),
      links,
      startTime: timingEnabled ? clock.currentTimeNanosUnsafe() : BigInt(0),
      kind: options?.kind ?? "internal",
      root: options?.root ?? isNone2(parent),
      sampled: options?.sampled ?? (isSome2(parent) && parent.value.sampled === false ? false : !isLogLevelGreaterThan(fiber.getRef(MinimumTraceLevel), level))
    });
    for (const [key, value] of Object.entries(annotationsFromEnv)) {
      span.attribute(key, value);
    }
    if (options?.attributes !== undefined) {
      for (const [key, value] of Object.entries(options.attributes)) {
        span.attribute(key, value);
      }
    }
  }
  return span;
};
var provideSpanStackFrame = (name, stack) => {
  stack = typeof stack === "function" ? stack : constUndefined;
  return updateService(CurrentStackFrame, (parent) => ({
    name,
    stack,
    parent
  }));
};
var useSpan = (name, ...args) => {
  const options = args.length === 1 ? undefined : args[0];
  const evaluate = args[args.length - 1];
  return withFiber((fiber) => {
    const span = makeSpanUnsafe(fiber, name, options);
    const clock = fiber.getRef(ClockRef);
    return onExit(internalCall(() => evaluate(span)), (exit) => sync(() => {
      if (span.status._tag === "Ended")
        return;
      span.end(clock.currentTimeNanosUnsafe(), exit);
    }));
  });
};
var provideParentSpan = /* @__PURE__ */ provideService(ParentSpan);
var withParentSpan = function() {
  const dataFirst = isEffect(arguments[0]);
  const span = dataFirst ? arguments[1] : arguments[0];
  let options = dataFirst ? arguments[2] : arguments[1];
  let provideStackFrame = identity;
  if (span._tag === "Span") {
    options = addSpanStackTrace(options);
    provideStackFrame = provideSpanStackFrame(span.name, options?.captureStackTrace);
  }
  if (dataFirst) {
    return provideParentSpan(provideStackFrame(arguments[0]), span);
  }
  return (self) => provideParentSpan(provideStackFrame(self), span);
};
var ClockRef = /* @__PURE__ */ Reference("effect/Clock", {
  defaultValue: () => new ClockImpl
});
var MAX_TIMER_MILLIS = 2 ** 31 - 1;

class ClockImpl {
  currentTimeMillisUnsafe() {
    return Date.now();
  }
  currentTimeMillis = /* @__PURE__ */ sync(() => this.currentTimeMillisUnsafe());
  currentTimeNanosUnsafe() {
    return processOrPerformanceNow();
  }
  currentTimeNanos = /* @__PURE__ */ sync(() => this.currentTimeNanosUnsafe());
  sleep(duration) {
    const millis = toMillis(duration);
    if (millis <= 0)
      return yieldNow;
    return callback((resume) => {
      if (millis > MAX_TIMER_MILLIS)
        return;
      const handle = setTimeout(() => resume(void_), millis);
      return sync(() => clearTimeout(handle));
    });
  }
}
var performanceNowNanos = /* @__PURE__ */ function() {
  const bigint1e6 = /* @__PURE__ */ BigInt(1e6);
  if (typeof performance === "undefined" || typeof performance.now === "undefined") {
    return () => BigInt(Date.now()) * bigint1e6;
  } else if (typeof performance.timeOrigin === "number" && performance.timeOrigin === 0) {
    return () => BigInt(Math.round(performance.now() * 1e6));
  }
  const origin = /* @__PURE__ */ BigInt(/* @__PURE__ */ Date.now()) * bigint1e6 - /* @__PURE__ */ BigInt(/* @__PURE__ */ Math.round(/* @__PURE__ */ performance.now() * 1e6));
  return () => origin + BigInt(Math.round(performance.now() * 1e6));
}();
var processOrPerformanceNow = /* @__PURE__ */ function() {
  const processHrtime = typeof process === "object" && "hrtime" in process && typeof process.hrtime.bigint === "function" ? process.hrtime : undefined;
  if (!processHrtime) {
    return performanceNowNanos;
  }
  const origin = /* @__PURE__ */ performanceNowNanos() - /* @__PURE__ */ processHrtime.bigint();
  return () => origin + processHrtime.bigint();
}();
var clockWith = (f) => withFiber((fiber) => f(fiber.getRef(ClockRef)));
var sleep = (duration) => clockWith((clock) => clock.sleep(fromInputUnsafe(duration)));
var TimeoutErrorTypeId = "~effect/Cause/TimeoutError";
var isTimeoutError = (u) => hasProperty(u, TimeoutErrorTypeId);
var IllegalArgumentErrorTypeId = "~effect/Cause/IllegalArgumentError";
class IllegalArgumentError extends (/* @__PURE__ */ TaggedError("IllegalArgumentError")) {
  [IllegalArgumentErrorTypeId] = IllegalArgumentErrorTypeId;
  constructor(message) {
    super({
      message
    });
  }
}
var AsyncFiberErrorTypeId = "~effect/Cause/AsyncFiberError";
class AsyncFiberError extends (/* @__PURE__ */ TaggedError("AsyncFiberError")) {
  [AsyncFiberErrorTypeId] = AsyncFiberErrorTypeId;
  constructor(fiber) {
    super({
      message: "An asynchronous Effect was executed with Effect.runSync",
      fiber
    });
  }
}
var UnknownErrorTypeId = "~effect/Cause/UnknownError";
class UnknownError extends (/* @__PURE__ */ TaggedError("UnknownError")) {
  [UnknownErrorTypeId] = UnknownErrorTypeId;
  constructor(cause, message) {
    super({
      message,
      cause
    });
  }
}
var logLevelToOrder = (level) => {
  switch (level) {
    case "All":
      return Number.MIN_SAFE_INTEGER;
    case "Fatal":
      return 50000;
    case "Error":
      return 40000;
    case "Warn":
      return 30000;
    case "Info":
      return 20000;
    case "Debug":
      return 1e4;
    case "Trace":
      return 0;
    case "None":
      return Number.MAX_SAFE_INTEGER;
  }
};
var LogLevelOrder = /* @__PURE__ */ mapInput(Number2, logLevelToOrder);
var isLogLevelGreaterThan = /* @__PURE__ */ isGreaterThan(LogLevelOrder);
var LoggerTypeId = "~effect/Logger";
var LoggerProto = {
  [LoggerTypeId]: {
    _Message: identity,
    _Output: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var colors = {
  bold: "1",
  red: "31",
  green: "32",
  yellow: "33",
  blue: "34",
  cyan: "36",
  white: "37",
  gray: "90",
  black: "30",
  bgBrightRed: "101"
};
var logLevelColors = {
  None: [],
  All: [],
  Trace: [colors.gray],
  Debug: [colors.blue],
  Info: [colors.green],
  Warn: [colors.yellow],
  Error: [colors.red],
  Fatal: [colors.bgBrightRed, colors.black]
};

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Cause.js
var fail4 = causeFail;
var squash = causeSquash;
var findError2 = findError;
var hasInterrupts2 = hasInterrupts;
var isDone2 = isDone;
var done2 = done;
var isTimeoutError2 = isTimeoutError;
var IllegalArgumentError2 = IllegalArgumentError;
// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Data.js
var Class3 = class extends Class {
  constructor(props) {
    super();
    if (props) {
      Object.assign(this, props);
    }
  }
};
var TaggedError2 = TaggedError;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Exit.js
var succeed4 = exitSucceed;
var failCause2 = exitFailCause;
var fail5 = exitFail;
var void_2 = exitVoid;
var isSuccess3 = exitIsSuccess;
var getSuccess2 = exitGetSuccess;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Scope.js
var makeUnsafe2 = scopeMakeUnsafe;
var provide = provideScope;
var addFinalizerExit = scopeAddFinalizerExit;
var addFinalizer = scopeAddFinalizer;
var forkUnsafe2 = scopeForkUnsafe;
var close = scopeClose;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Layer.js
var TypeId5 = "~effect/Layer";
var LayerProto = {
  [TypeId5]: {
    _ROut: identity,
    _E: identity,
    _RIn: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var fromBuildUnsafe = (build) => {
  const self = Object.create(LayerProto);
  self.build = build;
  return self;
};
var fromBuild = (build) => fromBuildUnsafe((memoMap, scope) => {
  const layerScope = forkUnsafe2(scope);
  return onExit(build(memoMap, layerScope), (exit) => exit._tag === "Failure" ? close(layerScope, exit) : void_);
});
var fromBuildMemo = (build) => {
  const self = fromBuild((memoMap, scope) => memoMap.getOrElseMemoize(self, scope, build));
  return self;
};
var succeed5 = function() {
  if (arguments.length === 1) {
    return (resource) => succeedContext(make3(arguments[0], resource));
  }
  return succeedContext(make3(arguments[0], arguments[1]));
};
var succeedContext = (context) => fromBuildUnsafe(constant(succeed3(context)));
var effect = function() {
  if (arguments.length === 1) {
    return (effect) => effectImpl(arguments[0], effect);
  }
  return effectImpl(arguments[0], arguments[1]);
};
var effectImpl = (service, effect) => effectContext(map4(effect, (value) => make3(service, value)));
var effectContext = (effect) => fromBuildMemo((_, scope) => provide(effect, scope));
var mergeAllEffect = (layers, memoMap, scope) => {
  const parentScope = forkUnsafe2(scope, "parallel");
  return forEach(layers, (layer) => layer.build(memoMap, forkUnsafe2(parentScope, "sequential")), {
    concurrency: layers.length
  }).pipe(map4((context) => mergeAll(...context)));
};
var provideWith = (self, that, f) => fromBuild((memoMap, scope) => flatMap(Array.isArray(that) ? mergeAllEffect(that, memoMap, scope) : that.build(memoMap, scope), (context) => self.build(memoMap, scope).pipe(provideContext(context), map4((merged) => f(merged, context)))));
var provide2 = /* @__PURE__ */ dual(2, (self, that) => provideWith(self, that, identity));

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/dateTime.js
var TypeId6 = "~effect/time/DateTime";
var TimeZoneTypeId = "~effect/time/DateTime/TimeZone";
var Proto2 = {
  [TypeId6]: TypeId6,
  pipe() {
    return pipeArguments(this, arguments);
  },
  [NodeInspectSymbol]() {
    return this.toString();
  },
  toJSON() {
    return toDateUtc(this).toJSON();
  }
};
var ProtoUtc = {
  ...Proto2,
  _tag: "Utc",
  [symbol]() {
    return number(this.epochMilliseconds);
  },
  [symbol2](that) {
    return isDateTime(that) && that._tag === "Utc" && this.epochMilliseconds === that.epochMilliseconds;
  },
  toString() {
    return `DateTime.Utc(${toDateUtc(this).toJSON()})`;
  }
};
var ProtoZoned = {
  ...Proto2,
  _tag: "Zoned",
  [symbol]() {
    return combine(number(this.epochMilliseconds))(hash(this.zone));
  },
  [symbol2](that) {
    return isDateTime(that) && that._tag === "Zoned" && this.epochMilliseconds === that.epochMilliseconds && equals(this.zone, that.zone);
  },
  toString() {
    return `DateTime.Zoned(${formatIsoZoned(this)})`;
  }
};
var ProtoTimeZone = {
  [TimeZoneTypeId]: TimeZoneTypeId,
  [NodeInspectSymbol]() {
    return this.toString();
  }
};
var ProtoTimeZoneNamed = {
  ...ProtoTimeZone,
  _tag: "Named",
  [symbol]() {
    return string(`Named:${this.id}`);
  },
  [symbol2](that) {
    return isTimeZone(that) && that._tag === "Named" && this.id === that.id;
  },
  toString() {
    return `TimeZone.Named(${this.id})`;
  },
  toJSON() {
    return {
      _id: "TimeZone",
      _tag: "Named",
      id: this.id
    };
  }
};
var ProtoTimeZoneOffset = {
  ...ProtoTimeZone,
  _tag: "Offset",
  [symbol]() {
    return string(`Offset:${this.offset}`);
  },
  [symbol2](that) {
    return isTimeZone(that) && that._tag === "Offset" && this.offset === that.offset;
  },
  toString() {
    return `TimeZone.Offset(${offsetToString(this.offset)})`;
  },
  toJSON() {
    return {
      _id: "TimeZone",
      _tag: "Offset",
      offset: this.offset
    };
  }
};
var isDateTime = (u) => hasProperty(u, TypeId6);
var isTimeZone = (u) => hasProperty(u, TimeZoneTypeId);
var isUtc = (self) => self._tag === "Utc";
var Equivalence2 = /* @__PURE__ */ make((a, b) => a.epochMilliseconds === b.epochMilliseconds);
var Order = /* @__PURE__ */ make2((self, that) => self.epochMilliseconds < that.epochMilliseconds ? -1 : self.epochMilliseconds > that.epochMilliseconds ? 1 : 0);
var makeUtc = (epochMillis) => {
  const self = Object.create(ProtoUtc);
  self.epochMilliseconds = epochMillis;
  Object.defineProperty(self, "partsUtc", {
    value: undefined,
    enumerable: false,
    writable: true
  });
  return self;
};
var fromDateUnsafe = (date) => {
  const epochMillis = date.getTime();
  if (Number.isNaN(epochMillis)) {
    throw new IllegalArgumentError2("Invalid date");
  }
  return makeUtc(epochMillis);
};
var makeUnsafe3 = (input) => {
  if (isDateTime(input)) {
    return input;
  } else if (input instanceof Date) {
    return fromDateUnsafe(input);
  } else if (typeof input === "object") {
    if ("epochMilliseconds" in input) {
      return makeUtc(input.epochMilliseconds);
    }
    const date = new Date(0);
    setPartsDate(date, input);
    return fromDateUnsafe(date);
  } else if (typeof input === "string" && !hasZone(input)) {
    return fromDateUnsafe(new Date(input + "Z"));
  }
  return fromDateUnsafe(new Date(input));
};
var hasZone = (input) => /Z|GMT|[+-]\d{2}$|[+-]\d{2}:?\d{2}$|\]$/.test(input);
var minEpochMillis = -8640000000000000 + 12 * 60 * 60 * 1000;
var maxEpochMillis = 8640000000000000 - 14 * 60 * 60 * 1000;
var make6 = /* @__PURE__ */ liftThrowable(makeUnsafe3);
var toUtc = (self) => makeUtc(self.epochMilliseconds);
var toDateUtc = (self) => new Date(self.epochMilliseconds);
var toDate = (self) => {
  if (self._tag === "Utc") {
    return new Date(self.epochMilliseconds);
  } else if (self.zone._tag === "Offset") {
    return new Date(self.epochMilliseconds + self.zone.offset);
  } else if (self.adjustedEpochMilliseconds !== undefined) {
    return new Date(self.adjustedEpochMilliseconds);
  }
  const parts = self.zone.format.formatToParts(self.epochMilliseconds).filter((_) => _.type !== "literal");
  const date = new Date(0);
  date.setUTCFullYear(Number(parts[2].value), Number(parts[0].value) - 1, Number(parts[1].value));
  date.setUTCHours(Number(parts[3].value), Number(parts[4].value), Number(parts[5].value), Number(parts[6].value));
  self.adjustedEpochMilliseconds = date.getTime();
  return date;
};
var zonedOffset = (self) => {
  const date = toDate(self);
  return date.getTime() - toEpochMillis(self);
};
var offsetToString = (offset) => {
  const abs = Math.abs(offset);
  let hours = Math.floor(abs / (60 * 60 * 1000));
  let minutes = Math.round(abs % (60 * 60 * 1000) / (60 * 1000));
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }
  return `${offset < 0 ? "-" : "+"}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};
var zonedOffsetIso = (self) => offsetToString(zonedOffset(self));
var toEpochMillis = (self) => self.epochMilliseconds;
var setPartsDate = (date, parts) => {
  if (parts.year !== undefined) {
    date.setUTCFullYear(parts.year);
  }
  if (parts.month !== undefined) {
    date.setUTCMonth(parts.month - 1);
  }
  if (parts.day !== undefined) {
    date.setUTCDate(parts.day);
  }
  if (parts.weekDay !== undefined) {
    const diff = parts.weekDay - date.getUTCDay();
    date.setUTCDate(date.getUTCDate() + diff);
  }
  if (parts.hour !== undefined) {
    date.setUTCHours(parts.hour);
  }
  if (parts.minute !== undefined) {
    date.setUTCMinutes(parts.minute);
  }
  if (parts.second !== undefined) {
    date.setUTCSeconds(parts.second);
  }
  if (parts.millisecond !== undefined) {
    date.setUTCMilliseconds(parts.millisecond);
  }
};
var constDayMillis = 24 * 60 * 60 * 1000;
var formatIso = (self) => toDateUtc(self).toISOString();
var formatIsoOffset = (self) => {
  const date = toDate(self);
  return self._tag === "Utc" ? date.toISOString() : `${date.toISOString().slice(0, -1)}${zonedOffsetIso(self)}`;
};
var formatIsoZoned = (self) => self.zone._tag === "Offset" ? formatIsoOffset(self) : `${formatIsoOffset(self)}[${self.zone.id}]`;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/random.js
var Random = /* @__PURE__ */ Reference("effect/Random", {
  defaultValue: () => ({
    nextIntUnsafe() {
      return Math.floor(Math.random() * (Number.MAX_SAFE_INTEGER - Number.MIN_SAFE_INTEGER + 1)) + Number.MIN_SAFE_INTEGER;
    },
    nextDoubleUnsafe() {
      return Math.random();
    }
  })
});

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Pull.js
var catchDone = /* @__PURE__ */ dual(2, (effect, f) => catchCauseFilter(effect, filterDoneLeftover, (l) => f(l)));
var isDoneCause = (cause) => cause.reasons.some(isDoneFailure);
var isDoneFailure = (failure) => failure._tag === "Fail" && isDone2(failure.error);
var filterDone = /* @__PURE__ */ composePassthrough(findError2, (e) => isDone2(e) ? succeed2(e) : fail2(e));
var filterDoneLeftover = /* @__PURE__ */ composePassthrough(findError2, (e) => isDone2(e) ? succeed2(e.value) : fail2(e));
var doneExitFromCause = (cause) => {
  const halt = filterDone(cause);
  return !isFailure2(halt) ? succeed4(halt.success.value) : failCause2(halt.failure);
};

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Effect.js
var whileLoop2 = whileLoop;
var promise2 = promise;
var tryPromise2 = tryPromise;
var succeed6 = succeed3;
var succeedNone2 = succeedNone;
var succeedSome2 = succeedSome;
var suspend2 = suspend;
var sync2 = sync;
var void_3 = void_;
var callback2 = callback;
var gen2 = gen;
var fail6 = fail3;
var failCause3 = failCause;
var try_2 = try_;
var withFiber2 = withFiber;
var fromResult2 = fromResult;
var flatMap2 = flatMap;
var andThen2 = andThen;
var exit2 = exit;
var map5 = map4;
var asVoid2 = asVoid;
var catch_2 = catch_;
var catchTag2 = catchTag;
var catchCause2 = catchCause;
var mapError3 = mapError2;
var sleep2 = sleep;
var matchCauseEffect2 = matchCauseEffect;
var context2 = context;
var contextWith2 = contextWith;
var provideContext2 = provideContext;
var serviceOption2 = serviceOption;
var updateContext2 = updateContext;
var onError2 = onError;
var onExit2 = onExit;
var cached2 = cached;
var onInterrupt2 = onInterrupt;
var uninterruptibleMask2 = uninterruptibleMask;
var forever2 = forever;
var useSpan2 = useSpan;
var withParentSpan2 = withParentSpan;
var runFork2 = runFork;
var runPromise2 = runPromise;
var runSync2 = runSync;
var runSyncExit2 = runSyncExit;
var fnUntraced2 = fnUntraced;
var fn2 = fn;
var mapEager2 = mapEager;
var mapErrorEager2 = mapErrorEager;
var flatMapEager2 = flatMapEager;
var catchEager2 = catchEager;
var fnUntracedEager2 = fnUntracedEager;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/record.js
function set(self, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(self, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } else {
    self[key] = value;
  }
  return self;
}

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/schema/annotations.js
function resolve(ast) {
  return ast.checks ? ast.checks[ast.checks.length - 1].annotations : ast.annotations;
}
function resolveAt(key) {
  return (ast) => resolve(ast)?.[key];
}
var resolveIdentifier = /* @__PURE__ */ resolveAt("identifier");
var resolveBrands = /* @__PURE__ */ resolveAt("brands");
var getExpected = /* @__PURE__ */ memoize((ast) => {
  const identifier = resolveIdentifier(ast);
  if (typeof identifier === "string")
    return identifier;
  return ast.getExpected(getExpected);
});

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/RegExp.js
var RegExp2 = globalThis.RegExp;
var escape = (string) => string.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/DateTime.js
var isDateTime2 = isDateTime;
var isUtc2 = isUtc;
var Equivalence3 = Equivalence2;
var Order2 = Order;
var fromDateUnsafe2 = fromDateUnsafe;
var makeUnsafe4 = makeUnsafe3;
var make7 = make6;
var toUtc2 = toUtc;
var toDateUtc2 = toDateUtc;
var toEpochMillis2 = toEpochMillis;
var formatIso2 = formatIso;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Encoding.js
var EncodingErrorTypeId = "~effect/encoding/EncodingError";

class EncodingError extends (/* @__PURE__ */ TaggedError2("EncodingError")) {
  [EncodingErrorTypeId] = EncodingErrorTypeId;
}
var encodeBase64 = (input) => typeof input === "string" ? base64EncodeUint8Array(encoder.encode(input)) : base64EncodeUint8Array(input);
var decodeBase64 = (str) => {
  const stripped = stripCrlf(str);
  const length = stripped.length;
  if (length % 4 !== 0) {
    return fail2(new EncodingError({
      kind: "Decode",
      module: "Base64",
      input: stripped,
      message: `Length must be a multiple of 4, but is ${length}`
    }));
  }
  const index = stripped.indexOf("=");
  if (index !== -1 && (index < length - 2 || index === length - 2 && stripped[length - 1] !== "=")) {
    return fail2(new EncodingError({
      kind: "Decode",
      module: "Base64",
      input: stripped,
      message: `Found a '=' character, but it is not at the end`
    }));
  }
  try {
    const missingOctets = stripped.endsWith("==") ? 2 : stripped.endsWith("=") ? 1 : 0;
    const result = new Uint8Array(3 * (length / 4) - missingOctets);
    for (let i = 0, j = 0;i < length; i += 4, j += 3) {
      const buffer = getBase64Code(stripped.charCodeAt(i)) << 18 | getBase64Code(stripped.charCodeAt(i + 1)) << 12 | getBase64Code(stripped.charCodeAt(i + 2)) << 6 | getBase64Code(stripped.charCodeAt(i + 3));
      result[j] = buffer >> 16;
      result[j + 1] = buffer >> 8 & 255;
      result[j + 2] = buffer & 255;
    }
    return succeed2(result);
  } catch (e) {
    return fail2(new EncodingError({
      kind: "Decode",
      module: "Base64",
      input: stripped,
      message: e instanceof Error ? e.message : "Invalid input"
    }));
  }
};
var encoder = /* @__PURE__ */ new TextEncoder;
var stripCrlf = (str) => str.replace(/[\n\r]/g, "");
var base64EncodeUint8Array = (bytes) => {
  const length = bytes.length;
  let result = "";
  let i;
  for (i = 2;i < length; i += 3) {
    result += base64abc[bytes[i - 2] >> 2];
    result += base64abc[(bytes[i - 2] & 3) << 4 | bytes[i - 1] >> 4];
    result += base64abc[(bytes[i - 1] & 15) << 2 | bytes[i] >> 6];
    result += base64abc[bytes[i] & 63];
  }
  if (i === length + 1) {
    result += base64abc[bytes[i - 2] >> 2];
    result += base64abc[(bytes[i - 2] & 3) << 4];
    result += "==";
  }
  if (i === length) {
    result += base64abc[bytes[i - 2] >> 2];
    result += base64abc[(bytes[i - 2] & 3) << 4 | bytes[i - 1] >> 4];
    result += base64abc[(bytes[i - 1] & 15) << 2];
    result += "=";
  }
  return result;
};
function getBase64Code(charCode) {
  if (charCode >= base64codes.length) {
    throw new TypeError(`Invalid character ${String.fromCharCode(charCode)}`);
  }
  const code = base64codes[charCode];
  if (code === 255) {
    throw new TypeError(`Invalid character ${String.fromCharCode(charCode)}`);
  }
  return code;
}
var base64abc = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "/"];
var base64codes = [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 62, 255, 255, 255, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 255, 255, 255, 0, 255, 255, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 255, 255, 255, 255, 255, 255, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51];

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/redacted.js
var redactedRegistry = /* @__PURE__ */ new WeakMap;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Redacted.js
var TypeId7 = "~effect/data/Redacted";
var isRedacted = (u) => hasProperty(u, TypeId7);
var make8 = (value, options) => {
  const self = Object.create(Proto3);
  if (options?.label) {
    self.label = options.label;
  }
  redactedRegistry.set(self, value);
  return self;
};
var Proto3 = {
  [TypeId7]: {
    _A: (_) => _
  },
  label: undefined,
  ...PipeInspectableProto,
  toJSON() {
    return this.toString();
  },
  toString() {
    return `<redacted${isString(this.label) ? ":" + this.label : ""}>`;
  },
  [symbol]() {
    return hash(redactedRegistry.get(this));
  },
  [symbol2](that) {
    return isRedacted(that) && equals(redactedRegistry.get(this), redactedRegistry.get(that));
  }
};

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/SchemaIssue.js
var TypeId8 = "~effect/SchemaIssue/Issue";
function isIssue(u) {
  return hasProperty(u, TypeId8);
}

class Base {
  [TypeId8] = TypeId8;
  toString() {
    return defaultFormatter(this);
  }
}

class Filter extends Base {
  _tag = "Filter";
  actual;
  filter;
  issue;
  constructor(actual, filter, issue) {
    super();
    this.actual = actual;
    this.filter = filter;
    this.issue = issue;
  }
}

class Encoding extends Base {
  _tag = "Encoding";
  ast;
  actual;
  issue;
  constructor(ast, actual, issue) {
    super();
    this.ast = ast;
    this.actual = actual;
    this.issue = issue;
  }
}

class Pointer extends Base {
  _tag = "Pointer";
  path;
  issue;
  constructor(path, issue) {
    super();
    this.path = path;
    this.issue = issue;
  }
}

class MissingKey extends Base {
  _tag = "MissingKey";
  annotations;
  constructor(annotations) {
    super();
    this.annotations = annotations;
  }
}

class UnexpectedKey extends Base {
  _tag = "UnexpectedKey";
  ast;
  actual;
  constructor(ast, actual) {
    super();
    this.ast = ast;
    this.actual = actual;
  }
}

class Composite extends Base {
  _tag = "Composite";
  ast;
  actual;
  issues;
  constructor(ast, actual, issues) {
    super();
    this.ast = ast;
    this.actual = actual;
    this.issues = issues;
  }
}

class InvalidType extends Base {
  _tag = "InvalidType";
  ast;
  actual;
  constructor(ast, actual) {
    super();
    this.ast = ast;
    this.actual = actual;
  }
}

class InvalidValue extends Base {
  _tag = "InvalidValue";
  actual;
  annotations;
  constructor(actual, annotations) {
    super();
    this.actual = actual;
    this.annotations = annotations;
  }
}
class AnyOf extends Base {
  _tag = "AnyOf";
  ast;
  actual;
  issues;
  constructor(ast, actual, issues) {
    super();
    this.ast = ast;
    this.actual = actual;
    this.issues = issues;
  }
}

class OneOf extends Base {
  _tag = "OneOf";
  ast;
  actual;
  successes;
  constructor(ast, actual, successes) {
    super();
    this.ast = ast;
    this.actual = actual;
    this.successes = successes;
  }
}
function makeFilterIssue(input, entry) {
  if (isIssue(entry)) {
    return entry;
  }
  if (typeof entry === "string") {
    return new InvalidValue(some2(input), {
      message: entry
    });
  }
  const inner = typeof entry.issue === "string" ? new InvalidValue(some2(input), {
    message: entry.issue
  }) : entry.issue;
  return new Pointer(entry.path, inner);
}
function makeSingle(input, out) {
  if (out === undefined) {
    return;
  }
  if (typeof out === "boolean") {
    return out ? undefined : new InvalidValue(some2(input));
  }
  return makeFilterIssue(input, out);
}
function make9(input, ast, out) {
  if (Array.isArray(out)) {
    if (isReadonlyArrayNonEmpty(out)) {
      if (out.length === 1) {
        return makeFilterIssue(input, out[0]);
      }
      return new Composite(ast, some2(input), map3(out, (entry) => makeFilterIssue(input, entry)));
    }
    return;
  }
  return makeSingle(input, out);
}
var defaultLeafHook = (issue) => {
  const message = findMessage(issue);
  if (message !== undefined)
    return message;
  switch (issue._tag) {
    case "InvalidType":
      return getExpectedMessage(getExpected(issue.ast), formatOption(issue.actual));
    case "InvalidValue":
      return `Invalid data ${formatOption(issue.actual)}`;
    case "MissingKey":
      return "Missing key";
    case "UnexpectedKey":
      return `Unexpected key with value ${format(issue.actual)}`;
    case "Forbidden":
      return "Forbidden operation";
    case "OneOf":
      return `Expected exactly one member to match the input ${format(issue.actual)}`;
  }
};
var defaultCheckHook = (issue) => {
  return findMessage(issue.issue) ?? findMessage(issue);
};
function getExpectedMessage(expected, actual) {
  return `Expected ${expected}, got ${actual}`;
}
function toDefaultIssues(issue, path, leafHook, checkHook) {
  switch (issue._tag) {
    case "Filter": {
      const message = checkHook(issue);
      if (message !== undefined) {
        return [{
          path,
          message
        }];
      }
      switch (issue.issue._tag) {
        case "InvalidValue":
          return [{
            path,
            message: getExpectedMessage(formatCheck(issue.filter), format(issue.actual))
          }];
        default:
          return toDefaultIssues(issue.issue, path, leafHook, checkHook);
      }
    }
    case "Encoding":
      return toDefaultIssues(issue.issue, path, leafHook, checkHook);
    case "Pointer":
      return toDefaultIssues(issue.issue, [...path, ...issue.path], leafHook, checkHook);
    case "Composite":
      return issue.issues.flatMap((issue) => toDefaultIssues(issue, path, leafHook, checkHook));
    case "AnyOf": {
      const message = findMessage(issue);
      if (issue.issues.length === 0) {
        if (message !== undefined)
          return [{
            path,
            message
          }];
        const expected = getExpectedMessage(getExpected(issue.ast), format(issue.actual));
        return [{
          path,
          message: expected
        }];
      }
      return issue.issues.flatMap((issue) => toDefaultIssues(issue, path, leafHook, checkHook));
    }
    default:
      return [{
        path,
        message: leafHook(issue)
      }];
  }
}
function formatCheck(check) {
  const expected = check.annotations?.expected;
  if (typeof expected === "string")
    return expected;
  switch (check._tag) {
    case "Filter":
      return "<filter>";
    case "FilterGroup":
      return check.checks.map((check) => formatCheck(check)).join(" & ");
  }
}
function makeFormatterDefault() {
  return (issue) => toDefaultIssues(issue, [], defaultLeafHook, defaultCheckHook).map(formatDefaultIssue).join(`
`);
}
var defaultFormatter = /* @__PURE__ */ makeFormatterDefault();
function formatDefaultIssue(issue) {
  let out = issue.message;
  if (issue.path && issue.path.length > 0) {
    const path = formatPath(issue.path);
    out += `
  at ${path}`;
  }
  return out;
}
function findMessage(issue) {
  switch (issue._tag) {
    case "InvalidType":
    case "OneOf":
    case "Composite":
    case "AnyOf":
      return getMessageAnnotation(issue.ast.annotations);
    case "InvalidValue":
    case "Forbidden":
      return getMessageAnnotation(issue.annotations);
    case "MissingKey":
      return getMessageAnnotation(issue.annotations, "messageMissingKey");
    case "UnexpectedKey":
      return getMessageAnnotation(issue.ast.annotations, "messageUnexpectedKey");
    case "Filter":
      return getMessageAnnotation(issue.filter.annotations);
    case "Encoding":
      return findMessage(issue.issue);
  }
}
function getMessageAnnotation(annotations, type = "message") {
  const message = annotations?.[type];
  if (typeof message === "string")
    return message;
}
function formatOption(actual) {
  if (isNone2(actual))
    return "no value provided";
  return format(actual.value);
}

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/SchemaGetter.js
class Getter extends Class {
  run;
  constructor(run) {
    super();
    this.run = run;
  }
  map(f) {
    return new Getter((oe, options) => this.run(oe, options).pipe(mapEager2(map(f))));
  }
  compose(other) {
    if (isPassthrough(this)) {
      return other;
    }
    if (isPassthrough(other)) {
      return this;
    }
    return new Getter((oe, options) => this.run(oe, options).pipe(flatMapEager2((ot) => other.run(ot, options))));
  }
}
var passthrough_ = /* @__PURE__ */ new Getter(succeed6);
function isPassthrough(getter) {
  return getter.run === passthrough_.run;
}
function passthrough() {
  return passthrough_;
}
function onSome(f) {
  return new Getter((oe, options) => isNone2(oe) ? succeedNone2 : f(oe.value, options));
}
function transform(f) {
  return transformOptional(map(f));
}
function transformOrFail(f) {
  return onSome((e, options) => f(e, options).pipe(mapEager2(some2)));
}
function transformOptional(f) {
  return new Getter((oe) => succeed6(f(oe)));
}
function withDefault(defaultValue) {
  return new Getter((o) => {
    const filtered = filter(o, isNotUndefined);
    return isSome2(filtered) ? succeed6(filtered) : mapEager2(defaultValue, some2);
  });
}
function String2() {
  return transform(globalThis.String);
}
function Number3() {
  return transform(globalThis.Number);
}
function Date3() {
  return transform((u) => new globalThis.Date(u));
}
function parseJson(options) {
  return onSome((input) => try_2({
    try: () => some2(JSON.parse(input, options?.reviver)),
    catch: (e) => new InvalidValue(some2(input), {
      message: globalThis.String(e)
    })
  }));
}
function stringifyJson(options) {
  return onSome((input) => try_2({
    try: () => some2(JSON.stringify(input, options?.replacer, options?.space)),
    catch: (e) => new InvalidValue(some2(input), {
      message: globalThis.String(e)
    })
  }));
}
function encodeBase642() {
  return transform(encodeBase64);
}
function decodeBase642() {
  return transformOrFail((input) => mapErrorEager2(fromResult2(decodeBase64(input)), (e) => new InvalidValue(some2(input), {
    message: e.message
  })));
}

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/SchemaTransformation.js
var TypeId9 = "~effect/SchemaTransformation/Transformation";

class Transformation {
  [TypeId9] = TypeId9;
  _tag = "Transformation";
  decode;
  encode;
  constructor(decode, encode) {
    this.decode = decode;
    this.encode = encode;
  }
  flip() {
    return new Transformation(this.encode, this.decode);
  }
  compose(other) {
    return new Transformation(this.decode.compose(other.decode), other.encode.compose(this.encode));
  }
}
function isTransformation(u) {
  return hasProperty(u, TypeId9);
}
var make10 = (options) => {
  if (isTransformation(options)) {
    return options;
  }
  return new Transformation(options.decode, options.encode);
};
function transformOrFail2(options) {
  return new Transformation(transformOrFail(options.decode), transformOrFail(options.encode));
}
function transform2(options) {
  return new Transformation(transform(options.decode), transform(options.encode));
}
var passthrough_2 = /* @__PURE__ */ new Transformation(/* @__PURE__ */ passthrough(), /* @__PURE__ */ passthrough());
function passthrough2() {
  return passthrough_2;
}
var numberFromString = /* @__PURE__ */ new Transformation(/* @__PURE__ */ Number3(), /* @__PURE__ */ String2());
var dateFromString = /* @__PURE__ */ new Transformation(/* @__PURE__ */ Date3(), /* @__PURE__ */ transform(formatDate));
var isJsonError = (input) => isObject(input) && typeof input["message"] === "string";
var decodeJsonError = (input) => {
  const hasCause = Object.hasOwn(input, "cause");
  const err = hasCause ? new Error(input.message, {
    cause: decodeDefect(input.cause)
  }) : new Error(input.message);
  if (typeof input.name === "string" && input.name !== "Error")
    err.name = input.name;
  if (typeof input.stack === "string")
    err.stack = input.stack;
  return err;
};
var encodeUnknownAsJson = (input) => {
  try {
    const json = formatJson(input);
    return json === undefined ? format(input) : JSON.parse(json);
  } catch {
    return format(input);
  }
};
var encodeJsonError = (input, options, encodeDefect) => {
  const encoded = {
    name: input.name,
    message: typeof input.message === "string" ? input.message : ""
  };
  if (options?.includeStack && typeof input.stack === "string") {
    encoded.stack = input.stack;
  }
  if (!options?.excludeCause && input.cause !== undefined) {
    encoded.cause = encodeDefect(input.cause);
  }
  return encoded;
};
var makeEncodeDefect = (options) => {
  const seen = new WeakSet;
  const encode = (input) => {
    if (isError(input)) {
      if (seen.has(input)) {
        return "[Circular]";
      }
      seen.add(input);
      const encoded = encodeJsonError(input, options, encode);
      seen.delete(input);
      return encoded;
    }
    return encodeUnknownAsJson(input);
  };
  return encode;
};
var decodeDefect = (input) => isJsonError(input) ? decodeJsonError(input) : input;
var defectFromJson = (options) => transform2({
  decode: decodeDefect,
  encode: makeEncodeDefect(options)
});
var urlFromString = /* @__PURE__ */ transformOrFail2({
  decode: (s) => try_2({
    try: () => new URL(s),
    catch: () => new InvalidValue(some2(s), {
      message: `Invalid URL string: ${s}`
    })
  }),
  encode: (url) => succeed6(url.href)
});
var uint8ArrayFromBase64String = /* @__PURE__ */ new Transformation(/* @__PURE__ */ decodeBase642(), /* @__PURE__ */ encodeBase642());
var fromJsonString = /* @__PURE__ */ new Transformation(/* @__PURE__ */ parseJson(), /* @__PURE__ */ stringifyJson());
var dateTimeUtcFromString = /* @__PURE__ */ transformOrFail2({
  decode: (s) => {
    return match(make7(s), {
      onNone: () => fail6(new InvalidValue(some2(s), {
        message: `Invalid UTC DateTime string: ${s}`
      })),
      onSome: (result) => succeed6(toUtc2(result))
    });
  },
  encode: (utc) => succeed6(formatIso2(utc))
});

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/SchemaAST.js
function makeGuard(tag) {
  return (ast) => ast._tag === tag;
}
var isDeclaration = /* @__PURE__ */ makeGuard("Declaration");
var isNever2 = /* @__PURE__ */ makeGuard("Never");
var isLiteral = /* @__PURE__ */ makeGuard("Literal");
var isUniqueSymbol = /* @__PURE__ */ makeGuard("UniqueSymbol");
var isArrays = /* @__PURE__ */ makeGuard("Arrays");
var isObjects = /* @__PURE__ */ makeGuard("Objects");
var isUnion = /* @__PURE__ */ makeGuard("Union");
class Link {
  to;
  transformation;
  constructor(to, transformation) {
    this.to = to;
    this.transformation = transformation;
  }
}
var defaultParseOptions = {};

class Context {
  isOptional;
  isMutable;
  defaultValue;
  annotations;
  constructor(isOptional, isMutable, defaultValue = undefined, annotations = undefined) {
    this.isOptional = isOptional;
    this.isMutable = isMutable;
    this.defaultValue = defaultValue;
    this.annotations = annotations;
  }
}
var TypeId10 = "~effect/Schema";

class Base2 {
  [TypeId10] = TypeId10;
  annotations;
  checks;
  encoding;
  context;
  constructor(annotations = undefined, checks = undefined, encoding = undefined, context = undefined) {
    this.annotations = annotations;
    this.checks = checks;
    this.encoding = encoding;
    this.context = context;
  }
  toString() {
    return `<${this._tag}>`;
  }
}

class Declaration extends Base2 {
  _tag = "Declaration";
  typeParameters;
  run;
  encodingChecks;
  constructor(typeParameters, run, annotations, checks, encoding, context, encodingChecks) {
    super(annotations, checks, encoding, context);
    this.typeParameters = typeParameters;
    this.run = run;
    this.encodingChecks = encodingChecks;
  }
  getParser() {
    const run = this.run(this.typeParameters);
    return (oinput, options) => {
      if (isNone2(oinput))
        return succeedNone2;
      return mapEager2(run(oinput.value, this, options), some2);
    };
  }
  rebuild(recur, checks, encodingChecks) {
    const tps = mapOrSame(this.typeParameters, recur);
    return tps === this.typeParameters ? this : new Declaration(tps, this.run, this.annotations, checks, undefined, this.context, encodingChecks);
  }
  recur(recur) {
    return this.rebuild(recur, this.checks, this.encodingChecks);
  }
  flip(recur) {
    return this.rebuild(recur, this.encodingChecks, this.checks);
  }
  getExpected() {
    const expected = this.annotations?.expected;
    if (typeof expected === "string")
      return expected;
    return "<Declaration>";
  }
}

class Null extends Base2 {
  _tag = "Null";
  getParser() {
    return fromConst(this, null);
  }
  getExpected() {
    return "null";
  }
}
var null_ = /* @__PURE__ */ new Null;
class Undefined extends Base2 {
  _tag = "Undefined";
  getParser() {
    return fromConst(this, undefined);
  }
  toCodecJson() {
    return replaceEncoding(this, [undefinedToNull]);
  }
  getExpected() {
    return "undefined";
  }
}
var undefinedToNull = /* @__PURE__ */ new Link(null_, /* @__PURE__ */ new Transformation(/* @__PURE__ */ transform(() => {
  return;
}), /* @__PURE__ */ transform(() => null)));
var undefined_2 = /* @__PURE__ */ new Undefined;
class Unknown extends Base2 {
  _tag = "Unknown";
  getParser() {
    return fromRefinement(this, isUnknown);
  }
  getExpected() {
    return "unknown";
  }
}
var unknown = /* @__PURE__ */ new Unknown;
class Literal extends Base2 {
  _tag = "Literal";
  literal;
  constructor(literal, annotations, checks, encoding, context) {
    super(annotations, checks, encoding, context);
    if (typeof literal === "number" && !globalThis.Number.isFinite(literal)) {
      throw new Error(`A numeric literal must be finite, got ${format(literal)}`);
    }
    this.literal = literal;
  }
  getParser() {
    return fromConst(this, this.literal);
  }
  toCodecJson() {
    return typeof this.literal === "bigint" ? literalToString(this) : this;
  }
  toCodecStringTree() {
    return typeof this.literal === "string" ? this : literalToString(this);
  }
  getExpected() {
    return typeof this.literal === "string" ? JSON.stringify(this.literal) : globalThis.String(this.literal);
  }
}
function literalToString(ast) {
  const literalAsString = globalThis.String(ast.literal);
  return replaceEncoding(ast, [new Link(new Literal(literalAsString), new Transformation(transform(() => ast.literal), transform(() => literalAsString)))]);
}

class String3 extends Base2 {
  _tag = "String";
  getParser() {
    return fromRefinement(this, isString);
  }
  getExpected() {
    return "string";
  }
}
var string2 = /* @__PURE__ */ new String3;

class Number4 extends Base2 {
  _tag = "Number";
  getParser() {
    return fromRefinement(this, isNumber);
  }
  toCodecJson() {
    if (this.checks && (hasCheck(this.checks, "isFinite") || hasCheck(this.checks, "isInt"))) {
      return this;
    }
    return replaceEncoding(this, [numberToJson]);
  }
  toCodecStringTree() {
    if (this.checks && (hasCheck(this.checks, "isFinite") || hasCheck(this.checks, "isInt"))) {
      return replaceEncoding(this, [finiteToString]);
    }
    return replaceEncoding(this, [numberToString]);
  }
  getExpected() {
    return "number";
  }
}
function hasCheck(checks, tag) {
  return checks.some((c) => {
    switch (c._tag) {
      case "Filter":
        return c.annotations?.meta?._tag === tag;
      case "FilterGroup":
        return hasCheck(c.checks, tag);
    }
  });
}
var number2 = /* @__PURE__ */ new Number4;

class Boolean2 extends Base2 {
  _tag = "Boolean";
  getParser() {
    return fromRefinement(this, isBoolean);
  }
  getExpected() {
    return "boolean";
  }
}
var boolean = /* @__PURE__ */ new Boolean2;
class Arrays extends Base2 {
  _tag = "Arrays";
  isMutable;
  elements;
  rest;
  encodingChecks;
  constructor(isMutable, elements, rest, annotations, checks, encoding, context, encodingChecks) {
    super(annotations, checks, encoding, context);
    this.isMutable = isMutable;
    this.elements = elements;
    this.rest = rest;
    this.encodingChecks = encodingChecks;
    const i = elements.findIndex(isOptional);
    if (i !== -1 && (elements.slice(i + 1).some((e) => !isOptional(e)) || rest.length > 1)) {
      throw new Error("A required element cannot follow an optional element. ts(1257)");
    }
    if (rest.length > 1 && rest.slice(1).some(isOptional)) {
      throw new Error("An optional element cannot follow a rest element. ts(1266)");
    }
  }
  getParser(recur) {
    const ast = this;
    const elements = ast.elements.map((ast) => ({
      ast,
      parser: recur(ast)
    }));
    const rest = ast.rest.map((ast) => ({
      ast,
      parser: recur(ast)
    }));
    const elementLen = elements.length;
    const [head, ...tail] = rest;
    const tailLen = tail.length;
    function getParser(tailThreshold, index) {
      if (index < elementLen) {
        return elements[index];
      } else if (index >= tailThreshold) {
        return tail[index - tailThreshold];
      }
      return head;
    }
    return fnUntracedEager2(function* (oinput, options) {
      if (oinput._tag === "None") {
        return oinput;
      }
      const input = oinput.value;
      if (!Array.isArray(input)) {
        return yield* fail6(new InvalidType(ast, oinput));
      }
      const len = input.length;
      const state = {
        ast,
        getParser,
        oinput,
        len,
        tailThreshold: resolveTailThreshold(len, elementLen, tailLen),
        output: new globalThis.Array(len),
        issues: undefined,
        options
      };
      const concurrency = resolveConcurrency(options?.concurrency);
      const eff = parseArray(state, input, {
        concurrency: concurrency?.concurrency,
        end: ast.rest.length === 0 ? elementLen : Math.max(len, elementLen + tailLen)
      });
      if (eff)
        yield* eff;
      if (ast.rest.length === 0 && len > elementLen) {
        for (let i = elementLen;i <= len - 1; i++) {
          const issue = new Pointer([i], new UnexpectedKey(ast, input[i]));
          if (options.errors === "all") {
            if (state.issues)
              state.issues.push(issue);
            else
              state.issues = [issue];
          } else {
            return yield* fail6(new Composite(ast, oinput, [issue]));
          }
        }
      }
      if (state.issues) {
        return yield* fail6(new Composite(ast, oinput, state.issues));
      }
      return some2(state.output);
    });
  }
  rebuild(recur, checks, encodingChecks) {
    const elements = mapOrSame(this.elements, recur);
    const rest = mapOrSame(this.rest, recur);
    return elements === this.elements && rest === this.rest ? this : new Arrays(this.isMutable, elements, rest, this.annotations, checks, undefined, this.context, encodingChecks);
  }
  recur(recur) {
    return this.rebuild(recur, this.checks, this.encodingChecks);
  }
  flip(recur) {
    return this.rebuild(recur, this.encodingChecks, this.checks);
  }
  getExpected() {
    return "array";
  }
}
var parseArray = /* @__PURE__ */ iterateEager()({
  onItem(s, item, i) {
    const value = i < s.len ? some2(item) : none2();
    return s.getParser(s.tailThreshold, i).parser(value, s.options);
  },
  step(s, _, exit, i) {
    if (exit._tag === "Failure") {
      return wrapPropertyKeyIssue(s, s.ast, i, exit);
    } else if (exit.value._tag === "Some") {
      s.output[i] = exit.value.value;
    } else {
      const p = s.getParser(s.tailThreshold, i);
      if (isOptional(p.ast))
        return;
      const issue = new Pointer([i], new MissingKey(p.ast.context?.annotations));
      if (s.options.errors === "all") {
        if (s.issues)
          s.issues.push(issue);
        else
          s.issues = [issue];
      } else {
        return fail5(new Composite(s.ast, s.oinput, [issue]));
      }
    }
  }
});
function resolveTailThreshold(inputLen, elementLen, tailLen) {
  return Math.max(elementLen, inputLen - tailLen);
}
var resolveConcurrency = (value) => {
  value = value === "unbounded" ? Infinity : value ?? 1;
  return value > 1 ? {
    concurrency: value
  } : undefined;
};
var wrapPropertyKeyIssue = (s, ast, key, exit) => {
  const issueResult = findError2(exit.cause);
  if (isFailure2(issueResult)) {
    return exit;
  }
  const issue = new Pointer([key], issueResult.success);
  if (s.options.errors === "all") {
    if (s.issues)
      s.issues.push(issue);
    else
      s.issues = [issue];
  } else {
    return fail5(new Composite(ast, s.oinput, [issue]));
  }
};
var FINITE_PATTERN = "[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?";
var isNumberStringRegExp = /* @__PURE__ */ new globalThis.RegExp(`(?:${FINITE_PATTERN}|Infinity|-Infinity|NaN)`);
function getIndexSignatureKeys(input, parameter) {
  const encoded = toEncoded(parameter);
  switch (encoded._tag) {
    case "String":
      return Object.keys(input);
    case "TemplateLiteral": {
      const regExp = getTemplateLiteralRegExp(encoded);
      return Object.keys(input).filter((k) => regExp.test(k));
    }
    case "Symbol":
      return Object.getOwnPropertySymbols(input);
    case "Number":
      return Object.keys(input).filter((k) => isNumberStringRegExp.test(k));
    case "Union":
      return [...new Set(encoded.types.flatMap((t) => getIndexSignatureKeys(input, t)))];
    default:
      return [];
  }
}

class PropertySignature {
  name;
  type;
  constructor(name, type) {
    this.name = name;
    this.type = type;
  }
}

class KeyValueCombiner {
  decode;
  encode;
  constructor(decode, encode) {
    this.decode = decode;
    this.encode = encode;
  }
  flip() {
    return new KeyValueCombiner(this.encode, this.decode);
  }
}

class IndexSignature {
  parameter;
  type;
  merge;
  constructor(parameter, type, merge) {
    this.parameter = parameter;
    this.type = type;
    this.merge = merge;
    if (isOptional(type) && !containsUndefined(type)) {
      throw new Error("Cannot use `Schema.optionalKey` with index signatures, use `Schema.optional` instead.");
    }
  }
}

class Objects extends Base2 {
  _tag = "Objects";
  propertySignatures;
  indexSignatures;
  encodingChecks;
  constructor(propertySignatures, indexSignatures, annotations, checks, encoding, context, encodingChecks) {
    super(annotations, checks, encoding, context);
    this.propertySignatures = propertySignatures;
    this.indexSignatures = indexSignatures;
    this.encodingChecks = encodingChecks;
    const duplicates = propertySignatures.map((ps) => ps.name).filter((name, i, arr) => arr.indexOf(name) !== i);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate identifiers: ${JSON.stringify(duplicates)}. ts(2300)`);
    }
  }
  getParser(recur) {
    const ast = this;
    const expectedKeys = [];
    const expectedKeysSet = new Set;
    const properties = [];
    for (const ps of ast.propertySignatures) {
      expectedKeys.push(ps.name);
      expectedKeysSet.add(ps.name);
      properties.push({
        ps,
        parser: recur(ps.type),
        name: ps.name,
        type: ps.type
      });
    }
    const indexCount = ast.indexSignatures.length;
    if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
      return fromRefinement(ast, isNotNullish);
    }
    const parseIndexes = indexCount > 0 ? iterateEager()({
      onItem: fnUntracedEager2(function* (s, [key, is]) {
        const parserKey = recur(indexSignatureParameterFromString(is.parameter));
        const effKey = parserKey(some2(key), s.options);
        const exitKey = effectIsExit(effKey) ? effKey : yield* exit2(effKey);
        if (exitKey._tag === "Failure") {
          const eff = wrapPropertyKeyIssue(s, ast, key, exitKey);
          if (eff)
            yield* eff;
          return;
        }
        const value = some2(s.input[key]);
        const parserValue = recur(is.type);
        const effValue = parserValue(value, s.options);
        const exitValue = effectIsExit(effValue) ? effValue : yield* exit2(effValue);
        if (exitValue._tag === "Failure") {
          const eff = wrapPropertyKeyIssue(s, ast, key, exitValue);
          if (eff)
            yield* eff;
          return;
        } else if (exitKey.value._tag === "Some" && exitValue.value._tag === "Some") {
          const k2 = exitKey.value.value;
          if (expectedKeysSet.has(key) || expectedKeysSet.has(k2)) {
            return;
          }
          const v2 = exitValue.value.value;
          if (is.merge && is.merge.decode && Object.hasOwn(s.out, k2)) {
            const [k, v] = is.merge.decode.combine([k2, s.out[k2]], [k2, v2]);
            set(s.out, k, v);
          } else {
            set(s.out, k2, v2);
          }
        }
      }),
      step: (_s, _, exit) => exit._tag === "Failure" ? exit : undefined
    }) : undefined;
    return fnUntracedEager2(function* (oinput, options) {
      if (oinput._tag === "None") {
        return oinput;
      }
      const input = oinput.value;
      if (!(typeof input === "object" && input !== null && !Array.isArray(input))) {
        return yield* fail6(new InvalidType(ast, oinput));
      }
      const out = {};
      const state = {
        ast,
        oinput,
        input,
        out,
        issues: undefined,
        options
      };
      const errorsAllOption = options.errors === "all";
      const onExcessPropertyError = options.onExcessProperty === "error";
      const onExcessPropertyPreserve = options.onExcessProperty === "preserve";
      let inputKeys;
      if (ast.indexSignatures.length === 0 && (onExcessPropertyError || onExcessPropertyPreserve)) {
        inputKeys = Reflect.ownKeys(input);
        for (let i = 0;i < inputKeys.length; i++) {
          const key = inputKeys[i];
          if (!expectedKeysSet.has(key)) {
            if (onExcessPropertyError) {
              const issue = new Pointer([key], new UnexpectedKey(ast, input[key]));
              if (errorsAllOption) {
                if (state.issues) {
                  state.issues.push(issue);
                } else {
                  state.issues = [issue];
                }
                continue;
              } else {
                return yield* fail6(new Composite(ast, oinput, [issue]));
              }
            } else {
              set(out, key, input[key]);
            }
          }
        }
      }
      const concurrency = resolveConcurrency(options?.concurrency);
      const eff = parseProperties(state, properties, concurrency);
      if (eff)
        yield* eff;
      if (parseIndexes) {
        const keyPairs = empty2();
        for (let i = 0;i < indexCount; i++) {
          const is = ast.indexSignatures[i];
          const keys = getIndexSignatureKeys(input, is.parameter);
          for (let j = 0;j < keys.length; j++) {
            const key = keys[j];
            keyPairs.push([key, is]);
          }
        }
        const eff = parseIndexes(state, keyPairs, concurrency);
        if (eff)
          yield* eff;
      }
      if (state.issues) {
        return yield* fail6(new Composite(ast, oinput, state.issues));
      }
      if (options.propertyOrder === "original") {
        const keys = (inputKeys ?? Reflect.ownKeys(input)).concat(expectedKeys);
        const preserved = {};
        for (const key of keys) {
          if (Object.hasOwn(out, key)) {
            set(preserved, key, out[key]);
          }
        }
        return some2(preserved);
      }
      return some2(out);
    });
  }
  rebuild(recur, flipMerge, checks, encodingChecks) {
    const props = mapOrSame(this.propertySignatures, (ps) => {
      const t = recur(ps.type);
      return t === ps.type ? ps : new PropertySignature(ps.name, t);
    });
    const indexes = mapOrSame(this.indexSignatures, (is) => {
      const p = recur(is.parameter);
      const t = recur(is.type);
      const merge = flipMerge ? is.merge?.flip() : is.merge;
      return p === is.parameter && t === is.type && merge === is.merge ? is : new IndexSignature(p, t, merge);
    });
    return props === this.propertySignatures && indexes === this.indexSignatures ? this : new Objects(props, indexes, this.annotations, checks, undefined, this.context, encodingChecks);
  }
  flip(recur) {
    return this.rebuild(recur, true, this.encodingChecks, this.checks);
  }
  recur(recur) {
    return this.rebuild(recur, false, this.checks, this.encodingChecks);
  }
  getExpected() {
    if (this.propertySignatures.length === 0 && this.indexSignatures.length === 0)
      return "object | array";
    return "object";
  }
}
var parseProperties = /* @__PURE__ */ iterateEager()({
  onItem(s, p) {
    const value = Object.hasOwn(s.input, p.name) ? some2(s.input[p.name]) : none2();
    return p.parser(value, s.options);
  },
  step(s, p, exit) {
    if (exit._tag === "Failure") {
      return wrapPropertyKeyIssue(s, s.ast, p.name, exit);
    } else if (exit.value._tag === "Some") {
      set(s.out, p.name, exit.value.value);
    } else if (!isOptional(p.type)) {
      const issue = new Pointer([p.name], new MissingKey(p.type.context?.annotations));
      if (s.options.errors === "all") {
        if (s.issues)
          s.issues.push(issue);
        else
          s.issues = [issue];
        return;
      } else {
        return fail5(new Composite(s.ast, s.oinput, [issue]));
      }
    }
  }
});
function struct(fields, checks, annotations) {
  return new Objects(Reflect.ownKeys(fields).map((key) => {
    return new PropertySignature(key, fields[key].ast);
  }), [], annotations, checks);
}
function getAST(self) {
  return self.ast;
}
function tuple(elements, checks = undefined) {
  return new Arrays(false, elements.map((e) => e.ast), [], undefined, checks);
}
function union2(members, mode, checks) {
  return new Union(members.map(getAST), mode, undefined, checks);
}
function getCandidateTypes(ast) {
  switch (ast._tag) {
    case "Null":
      return ["null"];
    case "Undefined":
    case "Void":
      return ["undefined"];
    case "String":
    case "TemplateLiteral":
      return ["string"];
    case "Number":
      return ["number"];
    case "Boolean":
      return ["boolean"];
    case "Symbol":
    case "UniqueSymbol":
      return ["symbol"];
    case "BigInt":
      return ["bigint"];
    case "Arrays":
      return ["array"];
    case "ObjectKeyword":
      return ["object", "array", "function"];
    case "Objects":
      return ast.propertySignatures.length || ast.indexSignatures.length ? ["object"] : ["object", "array"];
    case "Enum":
      return Array.from(new Set(ast.enums.map(([, v]) => typeof v)));
    case "Literal":
      return [typeof ast.literal];
    case "Union":
      return Array.from(new Set(ast.types.flatMap(getCandidateTypes)));
    default:
      return ["null", "undefined", "string", "number", "boolean", "symbol", "bigint", "object", "array", "function"];
  }
}
function collectSentinels(ast) {
  switch (ast._tag) {
    default:
      return [];
    case "Declaration": {
      const s = ast.annotations?.["~sentinels"];
      return Array.isArray(s) ? s : [];
    }
    case "Objects":
      return ast.propertySignatures.flatMap((ps) => {
        const type = ps.type;
        if (!isOptional(type)) {
          if (isLiteral(type)) {
            return [{
              key: ps.name,
              literal: type.literal
            }];
          }
          if (isUniqueSymbol(type)) {
            return [{
              key: ps.name,
              literal: type.symbol
            }];
          }
        }
        return [];
      });
    case "Arrays":
      return ast.elements.flatMap((e, i) => {
        return isLiteral(e) && !isOptional(e) ? [{
          key: i,
          literal: e.literal
        }] : [];
      });
    case "Suspend":
      return collectSentinels(ast.thunk());
  }
}
var candidateIndexCache = /* @__PURE__ */ new WeakMap;
function getIndex(types) {
  let idx = candidateIndexCache.get(types);
  if (idx)
    return idx;
  idx = {};
  for (const a of types) {
    const encoded = toEncoded(a);
    if (isNever2(encoded))
      continue;
    const types = getCandidateTypes(encoded);
    const sentinels = collectSentinels(encoded);
    idx.byType ??= {};
    for (const t of types)
      (idx.byType[t] ??= []).push(a);
    if (sentinels.length > 0) {
      idx.bySentinel ??= new Map;
      for (const {
        key,
        literal
      } of sentinels) {
        let m = idx.bySentinel.get(key);
        if (!m)
          idx.bySentinel.set(key, m = new Map);
        let arr = m.get(literal);
        if (!arr)
          m.set(literal, arr = []);
        arr.push(a);
      }
    } else {
      idx.otherwise ??= {};
      for (const t of types)
        (idx.otherwise[t] ??= []).push(a);
    }
  }
  candidateIndexCache.set(types, idx);
  return idx;
}
function filterLiterals(input) {
  return (ast) => {
    const encoded = toEncoded(ast);
    return encoded._tag === "Literal" ? encoded.literal === input : encoded._tag === "UniqueSymbol" ? encoded.symbol === input : true;
  };
}
function getCandidates(input, types) {
  const idx = getIndex(types);
  const runtimeType = input === null ? "null" : Array.isArray(input) ? "array" : typeof input;
  if (idx.bySentinel) {
    const base = idx.otherwise?.[runtimeType] ?? [];
    if (runtimeType === "object" || runtimeType === "array") {
      for (const [k, m] of idx.bySentinel) {
        if (Object.hasOwn(input, k)) {
          const match = m.get(input[k]);
          if (match)
            return [...match, ...base].filter(filterLiterals(input));
        }
      }
    }
    return base;
  }
  return (idx.byType?.[runtimeType] ?? []).filter(filterLiterals(input));
}

class Union extends Base2 {
  _tag = "Union";
  types;
  mode;
  encodingChecks;
  constructor(types, mode, annotations, checks, encoding, context, encodingChecks) {
    super(annotations, checks, encoding, context);
    this.types = types;
    this.mode = mode;
    this.encodingChecks = encodingChecks;
  }
  getParser(recur) {
    const ast = this;
    return (oinput, options) => {
      if (oinput._tag === "None") {
        return succeed6(oinput);
      }
      const input = oinput.value;
      const candidates = getCandidates(input, ast.types);
      const state = {
        ast,
        recur,
        oinput,
        input,
        out: undefined,
        successes: [],
        issues: undefined,
        options
      };
      const concurrency = resolveConcurrency(options?.concurrency);
      const eff = parseUnion(state, candidates, concurrency);
      if (!eff) {
        return state.out ? succeed6(state.out) : fail6(new AnyOf(ast, input, state.issues ?? []));
      }
      return flatMap2(eff, (_) => {
        return state.out ? succeed6(state.out) : fail6(new AnyOf(ast, input, state.issues ?? []));
      });
    };
  }
  rebuild(recur, checks, encodingChecks) {
    const types = mapOrSame(this.types, recur);
    return types === this.types ? this : new Union(types, this.mode, this.annotations, checks, undefined, this.context, encodingChecks);
  }
  recur(recur) {
    return this.rebuild(recur, this.checks, this.encodingChecks);
  }
  flip(recur) {
    return this.rebuild(recur, this.encodingChecks, this.checks);
  }
  getExpected(getExpected) {
    const expected = this.annotations?.expected;
    if (typeof expected === "string")
      return expected;
    if (this.types.length === 0)
      return "never";
    const types = this.types.map((type) => {
      const encoded = toEncoded(type);
      switch (encoded._tag) {
        case "Arrays": {
          const literals = encoded.elements.filter(isLiteral);
          if (literals.length > 0) {
            return `${formatIsMutable(encoded.isMutable)}[ ${literals.map((e) => getExpected(e) + formatIsOptional(e.context?.isOptional)).join(", ")}, ... ]`;
          }
          break;
        }
        case "Objects": {
          const literals = encoded.propertySignatures.filter((ps) => isLiteral(ps.type));
          if (literals.length > 0) {
            return `{ ${literals.map((ps) => `${formatIsMutable(ps.type.context?.isMutable)}${formatPropertyKey(ps.name)}${formatIsOptional(ps.type.context?.isOptional)}: ${getExpected(ps.type)}`).join(", ")}, ... }`;
          }
          break;
        }
      }
      return getExpected(encoded);
    });
    return Array.from(new Set(types)).join(" | ");
  }
}
var parseUnion = /* @__PURE__ */ iterateEager()({
  onItem(s, ast) {
    const parser = s.recur(ast);
    return parser(s.oinput, s.options);
  },
  step(s, candidate, exit) {
    if (exit._tag === "Failure") {
      const issueResult = findError2(exit.cause);
      if (isFailure2(issueResult)) {
        return exit;
      }
      if (s.issues)
        s.issues.push(issueResult.success);
      else
        s.issues = [issueResult.success];
    } else {
      if (s.out && s.ast.mode === "oneOf") {
        s.successes.push(candidate);
        return fail5(new OneOf(s.ast, s.input, s.successes));
      }
      s.out = exit.value;
      s.successes.push(candidate);
      if (s.ast.mode === "anyOf") {
        return void_2;
      }
    }
  }
});
var nonFiniteLiterals = /* @__PURE__ */ new Union([/* @__PURE__ */ new Literal("Infinity"), /* @__PURE__ */ new Literal("-Infinity"), /* @__PURE__ */ new Literal("NaN")], "anyOf");
var numberToJson = /* @__PURE__ */ new Link(/* @__PURE__ */ new Union([number2, nonFiniteLiterals], "anyOf"), /* @__PURE__ */ new Transformation(/* @__PURE__ */ Number3(), /* @__PURE__ */ transform((n) => globalThis.Number.isFinite(n) ? n : globalThis.String(n))));
function formatIsMutable(isMutable) {
  return isMutable ? "" : "readonly ";
}
function formatIsOptional(isOptional) {
  return isOptional ? "?" : "";
}
function getEncodingChecks(ast) {
  switch (ast._tag) {
    case "Declaration":
    case "Arrays":
    case "Objects":
    case "Union":
      return ast.encodingChecks;
    default:
      return;
  }
}

class Filter2 extends Class {
  _tag = "Filter";
  run;
  annotations;
  aborted;
  constructor(run, annotations = undefined, aborted = false) {
    super();
    this.run = run;
    this.annotations = annotations;
    this.aborted = aborted;
  }
  annotate(annotations) {
    return new Filter2(this.run, {
      ...this.annotations,
      ...annotations
    }, this.aborted);
  }
  abort() {
    return new Filter2(this.run, this.annotations, true);
  }
  and(other, annotations) {
    return new FilterGroup([this, other], annotations);
  }
}

class FilterGroup extends Class {
  _tag = "FilterGroup";
  checks;
  annotations;
  constructor(checks, annotations = undefined) {
    super();
    this.checks = checks;
    this.annotations = annotations;
  }
  annotate(annotations) {
    return new FilterGroup(this.checks, {
      ...this.annotations,
      ...annotations
    });
  }
  and(other, annotations) {
    return new FilterGroup([this, other], annotations);
  }
}
function makeFilter(filter, annotations, aborted = false) {
  return new Filter2((input, ast, options) => make9(input, ast, filter(input, ast, options)), annotations, aborted);
}
function isPattern(regExp, annotations) {
  const source = regExp.source;
  return makeFilter((s) => regExp.test(s), {
    expected: `a string matching the RegExp ${source}`,
    meta: {
      _tag: "isPattern",
      regExp
    },
    arbitrary: {
      constraint: {
        patterns: [regExp.source]
      }
    },
    ...annotations
  });
}
function modifyOwnPropertyDescriptors(ast, f) {
  const d = Object.getOwnPropertyDescriptors(ast);
  f(d);
  return Object.create(Object.getPrototypeOf(ast), d);
}
function replaceEncoding(ast, encoding) {
  if (ast.encoding === encoding) {
    return ast;
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.encoding.value = encoding;
  });
}
function replaceContext(ast, context) {
  if (ast.context === context) {
    return ast;
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.context.value = context;
  });
}
function annotate(ast, annotations) {
  if (ast.checks) {
    const last = ast.checks[ast.checks.length - 1];
    return replaceChecks(ast, append(ast.checks.slice(0, -1), last.annotate(annotations)));
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.annotations.value = {
      ...d.annotations.value,
      ...annotations
    };
  });
}
function replaceChecks(ast, checks) {
  if (ast._tag === "Suspend" && checks !== undefined) {
    throw new Error("Cannot add checks to Suspend");
  }
  if (ast.checks === checks) {
    return ast;
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.checks.value = checks;
  });
}
function appendChecks(ast, checks) {
  return replaceChecks(ast, ast.checks ? [...ast.checks, ...checks] : checks);
}
function updateLastLink(encoding, f) {
  const links = encoding;
  const last = links[links.length - 1];
  const to = f(last.to);
  if (to !== last.to) {
    return append(encoding.slice(0, encoding.length - 1), new Link(to, last.transformation));
  }
  return encoding;
}
function applyToLastLink(f) {
  return (ast) => ast.encoding ? replaceEncoding(ast, updateLastLink(ast.encoding, f)) : ast;
}
function appendTransformation(from, transformation, to) {
  const link = new Link(from, transformation);
  return replaceEncoding(to, to.encoding ? [...to.encoding, link] : [link]);
}
function brand(ast, brand) {
  const existing = resolveBrands(ast);
  const brands = existing ? [...existing, brand] : [brand];
  return annotate(ast, {
    brands
  });
}
function mapOrSame(as, f) {
  let changed = false;
  const out = new Array(as.length);
  for (let i = 0;i < as.length; i++) {
    const a = as[i];
    const fa = f(a);
    if (fa !== a) {
      changed = true;
    }
    out[i] = fa;
  }
  return changed ? out : as;
}
function annotateKey(ast, annotations) {
  const context = ast.context ? new Context(ast.context.isOptional, ast.context.isMutable, ast.context.defaultValue, {
    ...ast.context.annotations,
    ...annotations
  }) : new Context(false, false, undefined, annotations);
  return replaceContext(ast, context);
}
var optionalKeyLastLink = /* @__PURE__ */ applyToLastLink(optionalKey);
function optionalKey(ast) {
  const context = ast.context ? ast.context.isOptional === false ? new Context(true, ast.context.isMutable, ast.context.defaultValue, ast.context.annotations) : ast.context : new Context(true, false);
  return optionalKeyLastLink(replaceContext(ast, context));
}
function withConstructorDefault(ast, defaultValue) {
  const transformation = new Transformation(withDefault(defaultValue), passthrough());
  const encoding = [new Link(unknown, transformation)];
  const context = ast.context ? new Context(ast.context.isOptional, ast.context.isMutable, encoding, ast.context.annotations) : new Context(false, false, encoding);
  return replaceContext(ast, context);
}
function decodeTo(from, to, transformation) {
  return appendTransformation(from, transformation, to);
}
function parseParameter(ast) {
  switch (ast._tag) {
    case "Literal":
      return {
        literals: isPropertyKey(ast.literal) ? [ast.literal] : [],
        parameters: []
      };
    case "UniqueSymbol":
      return {
        literals: [ast.symbol],
        parameters: []
      };
    case "String":
    case "Number":
    case "Symbol":
    case "TemplateLiteral":
      return {
        literals: [],
        parameters: [ast]
      };
    case "Union": {
      const out = {
        literals: [],
        parameters: []
      };
      for (let i = 0;i < ast.types.length; i++) {
        const parsed = parseParameter(ast.types[i]);
        out.literals = out.literals.concat(parsed.literals);
        out.parameters = out.parameters.concat(parsed.parameters);
      }
      return out;
    }
  }
  return {
    literals: [],
    parameters: []
  };
}
function record(key, value, keyValueCombiner) {
  const {
    literals,
    parameters: indexSignatures
  } = parseParameter(key);
  return new Objects(literals.map((literal) => new PropertySignature(literal, value)), indexSignatures.map((parameter) => new IndexSignature(parameter, value, keyValueCombiner)));
}
function isOptional(ast) {
  return ast.context?.isOptional ?? false;
}
var toType = /* @__PURE__ */ memoize((ast) => {
  if (ast.encoding) {
    return toType(replaceEncoding(ast, undefined));
  }
  const out = ast;
  const type = out.recur?.(toType) ?? out;
  if (getEncodingChecks(type)) {
    return modifyOwnPropertyDescriptors(type, (d) => {
      d.encodingChecks.value = undefined;
    });
  }
  return type;
});
var toEncoded = /* @__PURE__ */ memoize((ast) => {
  return toType(flip2(ast));
});
function flipEncoding(ast, encoding) {
  const links = encoding;
  const len = links.length;
  const last = links[len - 1];
  const ls = [new Link(flip2(replaceEncoding(ast, undefined)), links[0].transformation.flip())];
  for (let i = 1;i < len; i++) {
    ls.unshift(new Link(flip2(links[i - 1].to), links[i].transformation.flip()));
  }
  const to = flip2(last.to);
  if (to.encoding) {
    return replaceEncoding(to, [...to.encoding, ...ls]);
  } else {
    return replaceEncoding(to, ls);
  }
}
var flip2 = /* @__PURE__ */ memoize((ast) => {
  if (ast.encoding) {
    return flipEncoding(ast, ast.encoding);
  }
  const out = ast;
  return out.flip?.(flip2) ?? out.recur?.(flip2) ?? out;
});
function containsUndefined(ast) {
  switch (ast._tag) {
    case "Undefined":
      return true;
    case "Union":
      return ast.types.some(containsUndefined);
    default:
      return false;
  }
}
function getTemplateLiteralSource(ast, top) {
  return ast.encodedParts.map((part) => handleTemplateLiteralASTPartParens(part, getTemplateLiteralASTPartPattern(part), top)).join("");
}
var getTemplateLiteralRegExp = /* @__PURE__ */ memoize((ast) => {
  return new globalThis.RegExp(`^${getTemplateLiteralSource(ast, true)}$`);
});
function getTemplateLiteralASTPartPattern(part) {
  switch (part._tag) {
    case "Literal":
      return escape(globalThis.String(part.literal));
    case "String":
      return STRING_PATTERN;
    case "Number":
      return FINITE_PATTERN;
    case "BigInt":
      return BIGINT_PATTERN;
    case "TemplateLiteral":
      return getTemplateLiteralSource(part, false);
    case "Union":
      return part.types.map(getTemplateLiteralASTPartPattern).join("|");
  }
}
function handleTemplateLiteralASTPartParens(part, s, top) {
  if (isUnion(part)) {
    if (!top) {
      return `(?:${s})`;
    }
  } else if (!top) {
    return s;
  }
  return `(${s})`;
}
function fromConst(ast, value) {
  const succeed = succeedSome2(value);
  return (oinput) => {
    if (oinput._tag === "None") {
      return succeedNone2;
    }
    return oinput.value === value ? succeed : fail6(new InvalidType(ast, oinput));
  };
}
function fromRefinement(ast, refinement) {
  return (oinput) => {
    if (oinput._tag === "None") {
      return succeedNone2;
    }
    return refinement(oinput.value) ? succeed6(oinput) : fail6(new InvalidType(ast, oinput));
  };
}
function toCodec(f) {
  function out(ast) {
    return ast.encoding ? replaceEncoding(ast, updateLastLink(ast.encoding, out)) : f(ast);
  }
  return memoize(out);
}
var indexSignatureParameterFromString = /* @__PURE__ */ toCodec((ast) => {
  switch (ast._tag) {
    default:
      return ast;
    case "Number":
      return ast.toCodecStringTree();
    case "Union":
      return ast.recur(indexSignatureParameterFromString);
  }
});
var STRING_PATTERN = "[\\s\\S]*?";
var isStringFiniteRegExp = /* @__PURE__ */ new globalThis.RegExp(`^${FINITE_PATTERN}$`);
function isStringFinite(annotations) {
  return isPattern(isStringFiniteRegExp, {
    expected: "a string representing a finite number",
    meta: {
      _tag: "isStringFinite",
      regExp: isStringFiniteRegExp
    },
    ...annotations
  });
}
var finiteString = /* @__PURE__ */ appendChecks(string2, [/* @__PURE__ */ isStringFinite()]);
var finiteToString = /* @__PURE__ */ new Link(finiteString, numberFromString);
var numberToString = /* @__PURE__ */ new Link(/* @__PURE__ */ new Union([finiteString, nonFiniteLiterals], "anyOf"), numberFromString);
var BIGINT_PATTERN = "-?\\d+";
var isStringBigIntRegExp = /* @__PURE__ */ new globalThis.RegExp(`^${BIGINT_PATTERN}$`);
var REGEXP_PATTERN = "Symbol\\((.*)\\)";
var isStringSymbolRegExp = /* @__PURE__ */ new globalThis.RegExp(`^${REGEXP_PATTERN}$`);
function collectIssues(checks, value, issues, ast, options) {
  for (let i = 0;i < checks.length; i++) {
    const check = checks[i];
    if (check._tag === "FilterGroup") {
      collectIssues(check.checks, value, issues, ast, options);
    } else {
      const issue = check.run(value, ast, options);
      if (issue) {
        issues.push(new Filter(value, check, issue));
        if (check.aborted || options?.errors !== "all") {
          return;
        }
      }
    }
  }
}
var ClassTypeId = "~effect/Schema/Class";
var STRUCTURAL_ANNOTATION_KEY = "~structural";
function isJson(u) {
  const onPath = new Set;
  const validated = new Set;
  return recur(u);
  function recur(u) {
    if (u === null || typeof u === "string" || typeof u === "boolean") {
      return true;
    }
    if (typeof u === "number") {
      return globalThis.Number.isFinite(u);
    }
    if (typeof u !== "object" || u === undefined) {
      return false;
    }
    if (onPath.has(u)) {
      return false;
    }
    if (validated.has(u)) {
      return true;
    }
    onPath.add(u);
    const ok = Array.isArray(u) ? u.every(recur) : Object.keys(u).every((key) => recur(u[key]));
    onPath.delete(u);
    if (ok) {
      validated.add(u);
    }
    return ok;
  }
}
var Json = /* @__PURE__ */ new Declaration([], () => (input, ast) => isJson(input) ? succeed6(input) : fail6(new InvalidType(ast, some2(input))), {
  typeConstructor: {
    _tag: "effect/Json"
  },
  generation: {
    runtime: `Schema.Json`,
    Type: `Schema.Json`
  },
  expected: "JSON value",
  toCodecJson: () => new Link(unknown, passthrough2()),
  toArbitrary: () => (fc) => fc.jsonValue()
});

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Fiber.js
var TypeId11 = `~effect/Fiber/${version}`;
var interrupt2 = fiberInterrupt;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Latch.js
var makeUnsafe5 = makeLatchUnsafe;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/MutableList.js
var Empty = /* @__PURE__ */ Symbol.for("effect/MutableList/Empty");
var make11 = () => ({
  head: undefined,
  tail: undefined,
  length: 0
});
var emptyBucket = () => ({
  array: [],
  mutable: true,
  offset: 0,
  next: undefined
});
var append2 = (self, message) => {
  if (!self.tail) {
    self.head = self.tail = emptyBucket();
  } else if (!self.tail.mutable) {
    self.tail.next = emptyBucket();
    self.tail = self.tail.next;
  }
  self.tail.array.push(message);
  self.length++;
};
var clear = (self) => {
  self.head = self.tail = undefined;
  self.length = 0;
};
var takeN = (self, n) => {
  if (n <= 0 || !self.head)
    return [];
  n = Math.min(n, self.length);
  if (n === self.length && self.head?.offset === 0 && !self.head.next) {
    const array = self.head.array;
    clear(self);
    return array;
  }
  const array = new Array(n);
  let index = 0;
  let chunk = self.head;
  while (chunk) {
    while (chunk.offset < chunk.array.length) {
      array[index++] = chunk.array[chunk.offset];
      if (chunk.mutable)
        chunk.array[chunk.offset] = undefined;
      chunk.offset++;
      if (index === n) {
        self.head = chunk;
        self.length -= n;
        if (self.length === 0)
          clear(self);
        return array;
      }
    }
    chunk = chunk.next;
  }
  clear(self);
  return array;
};
var take = (self) => {
  if (!self.head)
    return Empty;
  const message = self.head.array[self.head.offset];
  if (self.head.mutable)
    self.head.array[self.head.offset] = undefined;
  self.head.offset++;
  self.length--;
  if (self.head.offset === self.head.array.length) {
    if (self.head.next) {
      self.head = self.head.next;
    } else {
      clear(self);
    }
  }
  return message;
};

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Queue.js
var TypeId12 = "~effect/Queue";
var EnqueueTypeId = "~effect/Queue/Enqueue";
var DequeueTypeId = "~effect/Queue/Dequeue";
var variance = {
  _A: identity,
  _E: identity
};
var QueueProto = {
  [TypeId12]: variance,
  [EnqueueTypeId]: variance,
  [DequeueTypeId]: variance,
  ...PipeInspectableProto,
  toJSON() {
    return {
      _id: "effect/Queue",
      state: this.state._tag,
      size: sizeUnsafe(this)
    };
  }
};
var make12 = (options) => withFiber((fiber) => {
  const self = Object.create(QueueProto);
  self.dispatcher = fiber.currentDispatcher;
  self.capacity = options?.capacity ?? Number.POSITIVE_INFINITY;
  self.strategy = options?.strategy ?? "suspend";
  self.messages = make11();
  self.scheduleRunning = false;
  self.state = {
    _tag: "Open",
    takers: new Set,
    offers: new Set,
    awaiters: new Set
  };
  return succeed3(self);
});
var bounded = (capacity) => make12({
  capacity
});
var offerUnsafe = (self, message) => {
  if (self.state._tag !== "Open") {
    return false;
  } else if (self.messages.length >= self.capacity) {
    if (self.strategy === "sliding") {
      take(self.messages);
      append2(self.messages, message);
      return true;
    } else if (self.capacity <= 0 && self.state.takers.size > 0) {
      append2(self.messages, message);
      releaseTakers(self);
      return true;
    }
    return false;
  }
  append2(self.messages, message);
  scheduleReleaseTaker(self);
  return true;
};
var failCauseUnsafe = (self, cause) => {
  if (self.state._tag !== "Open") {
    return false;
  }
  const exit = exitFailCause(cause);
  const fail = exitZipRight(exit, exitFailDone);
  if (self.state.offers.size === 0 && self.messages.length === 0) {
    finalize(self, fail);
    return true;
  }
  self.state = {
    ...self.state,
    _tag: "Closing",
    exit: fail
  };
  return true;
};
var endUnsafe = (self) => failCauseUnsafe(self, causeFail(Done()));
var shutdown = (self) => sync(() => {
  if (self.state._tag === "Done") {
    return true;
  }
  clear(self.messages);
  const offers = self.state.offers;
  finalize(self, self.state._tag === "Open" ? exitInterrupt2 : self.state.exit);
  if (offers.size > 0) {
    for (const entry of offers) {
      if (entry._tag === "Single") {
        entry.resume(exitFalse);
      } else {
        entry.resume(exitSucceed(entry.remaining.slice(entry.offset)));
      }
    }
    offers.clear();
  }
  return true;
});
var takeAll2 = (self) => takeBetween(self, 1, Number.POSITIVE_INFINITY);
var takeBetween = (self, min, max) => suspend(() => takeBetweenUnsafe(self, min, max) ?? andThen(awaitTake(self), takeBetween(self, 1, max)));
var sizeUnsafe = (self) => self.state._tag === "Done" ? 0 : self.messages.length;
var exitFalse = /* @__PURE__ */ exitSucceed(false);
var exitTrue = /* @__PURE__ */ exitSucceed(true);
var exitFailDone = /* @__PURE__ */ exitFail(/* @__PURE__ */ Done());
var exitInterrupt2 = /* @__PURE__ */ exitInterrupt();
var releaseTakers = (self) => {
  self.scheduleRunning = false;
  if (self.state._tag === "Done" || self.state.takers.size === 0) {
    return;
  }
  for (const taker of self.state.takers) {
    self.state.takers.delete(taker);
    taker(exitVoid);
    if (self.messages.length === 0) {
      break;
    }
  }
};
var scheduleReleaseTaker = (self) => {
  if (self.scheduleRunning || self.state._tag === "Done" || self.state.takers.size === 0) {
    return;
  }
  self.scheduleRunning = true;
  self.dispatcher.scheduleTask(() => releaseTakers(self), 0);
};
var takeBetweenUnsafe = (self, min, max) => {
  if (self.state._tag === "Done") {
    return self.state.exit;
  } else if (max <= 0 || min <= 0) {
    return exitSucceed([]);
  } else if (self.capacity <= 0 && self.state.offers.size > 0) {
    self.capacity = 1;
    releaseCapacity(self);
    self.capacity = 0;
    const messages = [take(self.messages)];
    releaseCapacity(self);
    return exitSucceed(messages);
  }
  min = Math.min(min, self.capacity || 1);
  if (min <= self.messages.length) {
    const messages = takeN(self.messages, max);
    releaseCapacity(self);
    return exitSucceed(messages);
  }
};
var releaseCapacity = (self) => {
  if (self.state._tag === "Done") {
    return isDoneCause(self.state.exit.cause);
  } else if (self.state.offers.size === 0) {
    if (self.state._tag === "Closing" && self.messages.length === 0) {
      finalize(self, self.state.exit);
      return isDoneCause(self.state.exit.cause);
    }
    return false;
  }
  let n = self.capacity - self.messages.length;
  for (const entry of self.state.offers) {
    if (n === 0)
      break;
    else if (entry._tag === "Single") {
      append2(self.messages, entry.message);
      n--;
      entry.resume(exitTrue);
      self.state.offers.delete(entry);
    } else {
      for (;entry.offset < entry.remaining.length; entry.offset++) {
        if (n === 0)
          return false;
        append2(self.messages, entry.remaining[entry.offset]);
        n--;
      }
      entry.resume(exitSucceed([]));
      self.state.offers.delete(entry);
    }
  }
  return false;
};
var awaitTake = (self) => callback((resume) => {
  if (self.state._tag === "Done") {
    return resume(self.state.exit);
  }
  self.state.takers.add(resume);
  return sync(() => {
    if (self.state._tag !== "Done") {
      self.state.takers.delete(resume);
    }
  });
});
var finalize = (self, exit) => {
  if (self.state._tag === "Done") {
    return;
  }
  const openState = self.state;
  self.state = {
    _tag: "Done",
    exit
  };
  for (const taker of openState.takers) {
    taker(exit);
  }
  openState.takers.clear();
  for (const awaiter of openState.awaiters) {
    awaiter(exit);
  }
  openState.awaiters.clear();
};

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Channel.js
var TypeId13 = "~effect/Channel";
var ChannelProto = {
  [TypeId13]: {
    _Env: identity,
    _InErr: identity,
    _InElem: identity,
    _OutErr: identity,
    _OutElem: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var fromTransform = (transform) => {
  const self = Object.create(ChannelProto);
  self.transform = (upstream, scope) => catchCause2(transform(upstream, scope), (cause) => succeed6(failCause3(cause)));
  return self;
};
var fromPull = (effect) => fromTransform((_, __) => effect);
var fromTransformBracket = (f) => fromTransform(fnUntraced2(function* (upstream, scope) {
  const closableScope = forkUnsafe2(scope);
  const onCause = (cause) => close(closableScope, doneExitFromCause(cause));
  const pull = yield* onError2(f(upstream, scope, closableScope), onCause);
  return onError2(pull, onCause);
}));
var toTransform = (channel) => channel.transform;
var suspend3 = (evaluate) => fromTransform((upstream, scope) => suspend2(() => toTransform(evaluate())(upstream, scope)));
var fail7 = (error) => fromPull(succeed6(fail6(error)));
var fromQueueArray = (queue) => fromPull(succeed6(takeAll2(queue)));
var unwrap = (channel) => fromTransform((upstream, scope) => {
  let pull;
  return succeed6(suspend2(() => {
    if (pull)
      return pull;
    return channel.pipe(provide(scope), flatMap2((channel) => toTransform(channel)(upstream, scope)), flatMap2((pull_) => pull = pull_));
  }));
});
var onExit3 = /* @__PURE__ */ dual(2, (self, finalizer) => fromTransformBracket((upstream, scope, forkedScope) => addFinalizerExit(forkedScope, finalizer).pipe(andThen2(toTransform(self)(upstream, scope)))));
var ensuring3 = /* @__PURE__ */ dual(2, (self, finalizer) => onExit3(self, (_) => finalizer));
var runWith = (self, f, onHalt) => suspend2(() => {
  const scope = makeUnsafe2();
  const makePull = toTransform(self)(done2(), scope);
  return catchDone(flatMap2(makePull, f), onHalt ? onHalt : succeed6).pipe(onExit2((exit) => close(scope, exit)));
});
var runForEach = /* @__PURE__ */ dual(2, (self, f) => runWith(self, (pull) => forever2(flatMap2(pull, f), {
  disableYield: true
})));
var runFold = /* @__PURE__ */ dual(3, (self, initial, f) => suspend2(() => {
  let state = initial();
  return runWith(self, (pull) => whileLoop2({
    while: constTrue,
    body: () => pull,
    step: (value) => {
      state = f(state, value);
    }
  }), () => succeed6(state));
}));

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/stream.js
var TypeId14 = "~effect/Stream";
var streamVariance = {
  _R: identity,
  _E: identity,
  _A: identity
};
var StreamProto = {
  [TypeId14]: streamVariance,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var fromChannel = (channel) => {
  const self = Object.create(StreamProto);
  self.channel = channel;
  return self;
};

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Stream.js
var TypeId15 = "~effect/Stream";
var isStream = (u) => hasProperty(u, TypeId15);
var fromChannel2 = fromChannel;
var toChannel = (stream) => stream.channel;
var suspend4 = (stream) => fromChannel2(suspend3(() => stream().channel));
var fail8 = (error) => fromChannel2(fail7(error));
var fromQueue = (queue) => fromChannel2(fromQueueArray(queue));
var fromReadableStream = (options) => fromChannel2(fromTransform(fnUntraced2(function* (_, scope) {
  const reader = options.evaluate().getReader();
  yield* addFinalizer(scope, options.releaseLockOnEnd ? sync2(() => reader.releaseLock()) : promise2(() => reader.cancel().catch(constVoid)));
  return flatMap2(tryPromise2({
    try: () => reader.read(),
    catch: (reason) => options.onError(reason)
  }), ({
    done,
    value
  }) => done ? done2() : succeed6(of(value)));
})));
var unwrap2 = (effect) => fromChannel2(unwrap(map5(effect, toChannel)));
var ensuring4 = /* @__PURE__ */ dual(2, (self, finalizer) => fromChannel2(ensuring3(self.channel, finalizer)));
var runFold2 = /* @__PURE__ */ dual(3, (self, initial, f) => runFold(self.channel, initial, (acc, arr) => {
  for (let i = 0;i < arr.length; i++) {
    acc = f(acc, arr[i]);
  }
  return acc;
}));
var runForEachArray = /* @__PURE__ */ dual(2, (self, f) => runForEach(self.channel, f));
var toReadableStreamWith = /* @__PURE__ */ dual((args) => isStream(args[0]), (self, context, options) => {
  let currentResolve = undefined;
  let fiber = undefined;
  const latch = makeUnsafe5(false);
  return new ReadableStream({
    start(controller) {
      fiber = runFork2(provideContext2(runForEachArray(self, (chunk) => latch.whenOpen(sync2(() => {
        latch.closeUnsafe();
        for (let i = 0;i < chunk.length; i++) {
          controller.enqueue(chunk[i]);
        }
        currentResolve();
        currentResolve = undefined;
      }))), context));
      fiber.addObserver((exit) => {
        if (exit._tag === "Failure") {
          controller.error(squash(exit.cause));
        } else {
          controller.close();
        }
      });
    },
    pull() {
      return new Promise((resolve) => {
        currentResolve = resolve;
        latch.openUnsafe();
      });
    },
    cancel() {
      if (!fiber)
        return;
      return runPromise2(asVoid2(interrupt2(fiber)));
    }
  }, options?.strategy);
});
var toReadableStreamEffect = /* @__PURE__ */ dual((args) => isStream(args[0]), (self, options) => map5(context2(), (context) => toReadableStreamWith(self, context, options)));

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Struct.js
var lambda = (f) => f;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/SchemaParser.js
var recurDefaults = /* @__PURE__ */ memoize((ast) => {
  switch (ast._tag) {
    case "Declaration": {
      const getLink = ast.annotations?.[ClassTypeId];
      if (isFunction(getLink)) {
        const link = getLink(ast.typeParameters);
        const to = recurDefaults(link.to);
        return replaceEncoding(ast, to === link.to ? [link] : [new Link(to, link.transformation)]);
      }
      return ast;
    }
    case "Objects":
    case "Arrays":
      return ast.recur((ast) => {
        const defaultValue = ast.context?.defaultValue;
        if (defaultValue) {
          return replaceEncoding(recurDefaults(ast), defaultValue);
        }
        return recurDefaults(ast);
      });
    case "Suspend":
      return ast.recur(recurDefaults);
    default:
      return ast;
  }
});
function makeEffect(schema) {
  const ast = recurDefaults(toType(schema.ast));
  const parser = run(ast);
  return (input, options) => {
    return parser(input, options?.disableChecks ? options?.parseOptions ? {
      ...options.parseOptions,
      disableChecks: true
    } : {
      disableChecks: true
    } : options?.parseOptions);
  };
}
function makeOption(schema) {
  const parser = makeEffect(schema);
  return (input, options) => {
    return getSuccess2(runSyncExit2(parser(input, options)));
  };
}
function make13(schema) {
  const parser = makeEffect(schema);
  return (input, options) => {
    return runSync2(mapErrorEager2(parser(input, options), (issue) => new Error(issue.toString(), {
      cause: issue
    })));
  };
}
function is(schema) {
  return _is(schema.ast);
}
function _is(ast) {
  const parser = asExit(run(toType(ast)));
  return (input) => {
    return isSuccess3(parser(input, defaultParseOptions));
  };
}
function decodeUnknownEffect(schema, options) {
  const parser = run(schema.ast);
  return options === undefined ? parser : (input, overrideOptions) => parser(input, mergeParseOptions(options, overrideOptions));
}
function encodeUnknownEffect(schema, options) {
  const parser = run(flip2(schema.ast));
  return options === undefined ? parser : (input, overrideOptions) => parser(input, mergeParseOptions(options, overrideOptions));
}
var mergeParseOptions = (options, overrideOptions) => overrideOptions === undefined ? options : {
  ...options,
  ...overrideOptions
};
function run(ast) {
  const parser = recur(ast);
  return (input, options) => flatMapEager2(parser(some2(input), options ?? defaultParseOptions), (oa) => {
    if (oa._tag === "None") {
      return fail6(new InvalidValue(oa));
    }
    return succeed6(oa.value);
  });
}
function asExit(parser) {
  return (input, options) => runSyncExit2(parser(input, options));
}
var recur = /* @__PURE__ */ memoize((ast) => {
  let parser;
  const encodingChecks = getEncodingChecks(ast);
  const resolvedChecks = ast.checks ?? encodingChecks;
  const astOptions = (resolvedChecks ? resolvedChecks[resolvedChecks.length - 1].annotations : ast.annotations)?.["parseOptions"];
  if (!ast.context && !ast.encoding && !ast.checks && !encodingChecks) {
    return (ou, options) => {
      parser ??= ast.getParser(recur);
      if (astOptions) {
        options = {
          ...options,
          ...astOptions
        };
      }
      return parser(ou, options);
    };
  }
  const isStructural = isArrays(ast) || isObjects(ast) || isDeclaration(ast) && ast.typeParameters.length > 0;
  return (ou, options) => {
    if (astOptions) {
      options = {
        ...options,
        ...astOptions
      };
    }
    const encoding = ast.encoding;
    let srou;
    if (encoding) {
      const links = encoding;
      const len = links.length;
      for (let i = len - 1;i >= 0; i--) {
        const link = links[i];
        const to = link.to;
        const parser = recur(to);
        srou = srou ? flatMapEager2(srou, (ou) => parser(ou, options)) : parser(ou, options);
        if (link.transformation._tag === "Transformation") {
          const getter = link.transformation.decode;
          srou = flatMapEager2(srou, (ou) => getter.run(ou, options));
        } else {
          srou = link.transformation.decode(srou, options);
        }
      }
      srou = mapErrorEager2(srou, (issue) => new Encoding(ast, ou, issue));
    }
    parser ??= ast.getParser(recur);
    let sroa = srou ? flatMapEager2(srou, (ou) => parser(ou, options)) : parser(ou, options);
    if (encodingChecks && !options?.disableChecks) {
      sroa = flatMapEager2(sroa, (oa) => {
        if (isSome2(ou) && isSome2(oa)) {
          const issues = [];
          collectIssues(encodingChecks, ou.value, issues, ast, options);
          if (isArrayNonEmpty2(issues)) {
            return fail6(new Composite(ast, ou, issues));
          }
        }
        return succeed6(oa);
      });
    }
    if (ast.checks && !options?.disableChecks) {
      const checks = ast.checks;
      if (options?.errors === "all" && isStructural && isSome2(ou)) {
        sroa = catchEager2(sroa, (issue) => {
          const issues = [];
          collectIssues(checks.filter((check) => check.annotations?.[STRUCTURAL_ANNOTATION_KEY]), ou.value, issues, ast, options);
          const out = isArrayNonEmpty2(issues) ? issue._tag === "Composite" && issue.ast === ast ? new Composite(ast, issue.actual, [...issue.issues, ...issues]) : new Composite(ast, ou, [issue, ...issues]) : issue;
          return fail6(out);
        });
      }
      sroa = flatMapEager2(sroa, (oa) => {
        if (isSome2(oa)) {
          const value = oa.value;
          const issues = [];
          collectIssues(checks, value, issues, ast, options);
          if (isArrayNonEmpty2(issues)) {
            return fail6(new Composite(ast, oa, issues));
          }
        }
        return succeed6(oa);
      });
    }
    return sroa;
  };
});

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/internal/schema/schema.js
var TypeId16 = "~effect/Schema/Schema";
var SchemaProto = {
  [TypeId16]: TypeId16,
  pipe() {
    return pipeArguments(this, arguments);
  },
  annotate(annotations) {
    return this.rebuild(annotate(this.ast, annotations));
  },
  annotateKey(annotations) {
    return this.rebuild(annotateKey(this.ast, annotations));
  },
  check(...checks) {
    return this.rebuild(appendChecks(this.ast, checks));
  }
};
function make14(ast, options) {
  const self = Object.create(SchemaProto);
  if (options) {
    Object.assign(self, options);
  }
  self.ast = ast;
  self.rebuild = (ast) => make14(ast, options);
  self.makeEffect = flow(makeEffect(self), mapErrorEager2((issue) => new SchemaError(issue)));
  self.make = make13(self);
  self.makeOption = makeOption(self);
  return self;
}
var SchemaErrorTypeId = "~effect/Schema/SchemaError";

class SchemaError {
  [SchemaErrorTypeId] = SchemaErrorTypeId;
  _tag = "SchemaError";
  name = "SchemaError";
  issue;
  constructor(issue) {
    this.issue = issue;
  }
  get message() {
    return this.issue.toString();
  }
  toString() {
    return `SchemaError(${this.message})`;
  }
}

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Schema.js
var TypeId17 = TypeId16;
function declareConstructor() {
  return (typeParameters, run, annotations) => {
    return make15(new Declaration(typeParameters.map(getAST), (typeParameters) => run(typeParameters.map((ast) => make15(ast))), annotations));
  };
}
function declare(is, annotations) {
  return declareConstructor()([], () => (input, ast) => is(input) ? succeed6(input) : fail6(new InvalidType(ast, some2(input))), annotations);
}
var is2 = is;
function decodeUnknownEffect2(schema, options) {
  const parser = decodeUnknownEffect(schema, options);
  return (input, options) => {
    return mapErrorEager2(parser(input, options), (issue) => new SchemaError(issue));
  };
}
function decodeUnknownSync(schema, options) {
  const parser = decodeUnknownEffect2(schema, options);
  return (input, options) => {
    return runSync2(parser(input, options));
  };
}
function encodeUnknownEffect2(schema, options) {
  const parser = encodeUnknownEffect(schema, options);
  return (input, options) => {
    return mapErrorEager2(parser(input, options), (issue) => new SchemaError(issue));
  };
}
function encodeUnknownSync(schema, options) {
  const parser = encodeUnknownEffect2(schema, options);
  return (input, options) => {
    return runSync2(parser(input, options));
  };
}
var encodeSync2 = encodeUnknownSync;
var make15 = make14;
function isSchema(u) {
  return hasProperty(u, TypeId17) && u[TypeId17] === TypeId17;
}
var optionalKey2 = /* @__PURE__ */ lambda((schema) => make15(optionalKey(schema.ast), {
  schema
}));
var optional = /* @__PURE__ */ lambda((self) => optionalKey2(UndefinedOr(self)));
var toType2 = /* @__PURE__ */ lambda((schema) => make15(toType(schema.ast), {
  schema
}));
function Literal2(literal) {
  const out = make15(new Literal(literal), {
    literal,
    transform(to) {
      return out.pipe(decodeTo2(Literal2(to), {
        decode: transform(() => to),
        encode: transform(() => literal)
      }));
    }
  });
  return out;
}
var Unknown2 = /* @__PURE__ */ make15(unknown);
var Undefined2 = /* @__PURE__ */ make15(undefined_2);
var String4 = /* @__PURE__ */ make15(string2);
var Number5 = /* @__PURE__ */ make15(number2);
var Boolean3 = /* @__PURE__ */ make15(boolean);
function makeStruct(ast, fields) {
  return make15(ast, {
    fields,
    mapFields(f, options) {
      const fields = f(this.fields);
      return makeStruct(struct(fields, options?.unsafePreserveChecks ? this.ast.checks : undefined), fields);
    }
  });
}
function Struct(fields) {
  return makeStruct(struct(fields, undefined), fields);
}
function Record(key, value, options) {
  const keyValueCombiner = options?.keyValueCombiner?.decode || options?.keyValueCombiner?.encode ? new KeyValueCombiner(options.keyValueCombiner.decode, options.keyValueCombiner.encode) : undefined;
  return make15(record(key.ast, value.ast, keyValueCombiner), {
    key,
    value
  });
}
function makeTuple(ast, elements) {
  return make15(ast, {
    elements,
    mapElements(f, options) {
      const elements = f(this.elements);
      return makeTuple(tuple(elements, options?.unsafePreserveChecks ? this.ast.checks : undefined), elements);
    }
  });
}
function Tuple2(elements) {
  return makeTuple(tuple(elements), elements);
}
var ArraySchema = /* @__PURE__ */ lambda((schema) => make15(new Arrays(false, [], [schema.ast]), {
  value: schema
}));
function makeUnion(ast, members) {
  return make15(ast, {
    members,
    mapMembers(f, options) {
      const members = f(this.members);
      return makeUnion(union2(members, this.ast.mode, options?.unsafePreserveChecks ? this.ast.checks : undefined), members);
    }
  });
}
function Union2(members, options) {
  return makeUnion(union2(members, options?.mode ?? "anyOf", undefined), members);
}
function Literals(literals) {
  const members = literals.map(Literal2);
  return make15(union2(members, "anyOf", undefined), {
    literals,
    members,
    mapMembers(f) {
      return Union2(f(this.members));
    },
    pick(literals) {
      return Literals(literals);
    },
    transform(to) {
      return Union2(members.map((member, index) => member.transform(to[index])));
    }
  });
}
var UndefinedOr = /* @__PURE__ */ lambda((self) => Union2([self, Undefined2]));
function brand2(identifier) {
  return (schema) => make15(brand(schema.ast, identifier), {
    schema,
    identifier
  });
}
function decodeTo2(to, transformation) {
  return (from) => {
    return make15(decodeTo(from.ast, to.ast, transformation ? make10(transformation) : passthrough2()), {
      from,
      to
    });
  };
}
function withConstructorDefault2(defaultValue) {
  return (schema) => make15(withConstructorDefault(schema.ast, mapErrorEager2(defaultValue, (e) => e.issue)), {
    schema
  });
}
function tag(literal) {
  return Literal2(literal).pipe(withConstructorDefault2(succeed6(literal)));
}
function TaggedStruct(value, fields) {
  return Struct({
    _tag: tag(value),
    ...fields
  });
}
function toTaggedUnion(tag) {
  return (self) => {
    const cases = {};
    const guards = {};
    const isAnyOf = (keys) => (value) => keys.includes(value[tag]);
    walk(self);
    return Object.assign(self, {
      cases,
      isAnyOf,
      guards,
      match
    });
    function walk(schema) {
      const ast = schema.ast;
      if (isUnion(ast) && "members" in schema && globalThis.Array.isArray(schema.members) && schema.members.every(isSchema)) {
        return schema.members.forEach(walk);
      }
      const sentinels = collectSentinels(ast);
      if (sentinels.length > 0) {
        const literal = sentinels.find((s) => s.key === tag)?.literal;
        if (isPropertyKey(literal)) {
          cases[literal] = schema;
          guards[literal] = is2(toType2(schema));
          return;
        }
      }
      throw new globalThis.Error("No literal or unique symbol found");
    }
    function match() {
      if (arguments.length === 1) {
        const cases = arguments[0];
        return function(value) {
          return cases[value[tag]](value);
        };
      }
      const value = arguments[0];
      const cases = arguments[1];
      return cases[value[tag]](value);
    }
  };
}
function instanceOf(constructor, annotations) {
  return declare((u) => u instanceof constructor, annotations);
}
function link() {
  return (encodeTo, transformation) => {
    return new Link(encodeTo.ast, make10(transformation));
  };
}
var makeFilter2 = makeFilter;
var isPattern2 = isPattern;
function isBase64(annotations) {
  const regExp = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
  return isPattern2(regExp, {
    expected: "a base64 encoded string",
    meta: {
      _tag: "isBase64",
      regExp
    },
    ...annotations
  });
}
function isFinite(annotations) {
  return makeFilter2((n) => globalThis.Number.isFinite(n), {
    expected: "a finite number",
    meta: {
      _tag: "isFinite"
    },
    arbitrary: {
      constraint: {
        noInfinity: true,
        noNaN: true
      }
    },
    ...annotations
  });
}
function makeIsGreaterThan(options) {
  const gt = isGreaterThan(options.order);
  const formatter = options.formatter ?? format;
  return (exclusiveMinimum, annotations) => {
    return makeFilter2((input) => gt(input, exclusiveMinimum), {
      expected: `a value greater than ${formatter(exclusiveMinimum)}`,
      arbitrary: {
        constraint: {
          ordered: {
            order: options.order,
            minimum: exclusiveMinimum,
            exclusiveMinimum: true
          }
        }
      },
      ...options.annotate?.(exclusiveMinimum),
      ...annotations
    });
  };
}
function makeIsGreaterThanOrEqualTo(options) {
  const gte = isGreaterThanOrEqualTo(options.order);
  const formatter = options.formatter ?? format;
  return (minimum, annotations) => {
    return makeFilter2((input) => gte(input, minimum), {
      expected: `a value greater than or equal to ${formatter(minimum)}`,
      arbitrary: {
        constraint: {
          ordered: {
            order: options.order,
            minimum
          }
        }
      },
      ...options.annotate?.(minimum),
      ...annotations
    });
  };
}
var isGreaterThan3 = /* @__PURE__ */ makeIsGreaterThan({
  order: Number2,
  annotate: (exclusiveMinimum) => ({
    meta: {
      _tag: "isGreaterThan",
      exclusiveMinimum
    }
  })
});
var isGreaterThanOrEqualTo3 = /* @__PURE__ */ makeIsGreaterThanOrEqualTo({
  order: Number2,
  annotate: (minimum) => ({
    meta: {
      _tag: "isGreaterThanOrEqualTo",
      minimum
    }
  })
});
function isInt(annotations) {
  return makeFilter2((n) => globalThis.Number.isSafeInteger(n), {
    expected: "an integer",
    meta: {
      _tag: "isInt"
    },
    arbitrary: {
      constraint: {
        integer: true
      }
    },
    ...annotations
  });
}
var getErrorOptionsKey = (options) => (options?.includeStack === true ? 1 : 0) | (options?.excludeCause === true ? 2 : 0);
var getErrorOptions = (key) => {
  switch (key) {
    case 0:
      return;
    case 1:
      return {
        includeStack: true
      };
    case 2:
      return {
        excludeCause: true
      };
    case 3:
      return {
        includeStack: true,
        excludeCause: true
      };
  }
};
var defectSchemaCache = [];
function Defect(options) {
  const key = getErrorOptionsKey(options);
  const cached = defectSchemaCache[key];
  if (cached !== undefined) {
    return cached;
  }
  const schema = Json2.pipe(decodeTo2(Unknown2, defectFromJson(getErrorOptions(key))));
  defectSchemaCache[key] = schema;
  return schema;
}
var RegExp3 = /* @__PURE__ */ instanceOf(globalThis.RegExp, {
  typeConstructor: {
    _tag: "RegExp"
  },
  generation: {
    runtime: `Schema.RegExp`,
    Type: `globalThis.RegExp`
  },
  expected: "RegExp",
  toCodecJson: () => link()(Struct({
    source: String4,
    flags: String4
  }), transformOrFail2({
    decode: (e) => try_2({
      try: () => new globalThis.RegExp(e.source, e.flags),
      catch: (e) => new InvalidValue(some2(e), {
        message: globalThis.String(e)
      })
    }),
    encode: (regExp) => succeed6({
      source: regExp.source,
      flags: regExp.flags
    })
  })),
  toArbitrary: () => (fc) => fc.tuple(fc.constantFrom(".", ".*", "\\d+", "\\w+", "[a-z]+", "[A-Z]+", "[0-9]+", "^[a-zA-Z0-9]+$", "^\\d{4}-\\d{2}-\\d{2}$"), fc.uniqueArray(fc.constantFrom("g", "i", "m", "s", "u", "y"), {
    minLength: 0,
    maxLength: 6
  }).map((flags) => flags.join(""))).map(([source, flags]) => new globalThis.RegExp(source, flags)),
  toEquivalence: () => (a, b) => a.source === b.source && a.flags === b.flags
});
var URLString = /* @__PURE__ */ String4.annotate({
  expected: "a string that will be decoded as a URL"
});
var URL2 = /* @__PURE__ */ instanceOf(globalThis.URL, {
  typeConstructor: {
    _tag: "URL"
  },
  generation: {
    runtime: `Schema.URL`,
    Type: `globalThis.URL`
  },
  expected: "URL",
  toCodecJson: () => link()(URLString, urlFromString),
  toArbitrary: () => (fc) => fc.webUrl().map((s) => new globalThis.URL(s)),
  toEquivalence: () => (a, b) => a.toString() === b.toString()
});
function dateArbitraryConstraints(constraint, ordered, base, toDate) {
  const out = {
    ...base
  };
  delete out.valid;
  if (base?.valid || constraint?.valid) {
    out.noInvalidDate = true;
  }
  if (ordered?.minimum !== undefined) {
    const minimum = toDate === undefined ? ordered.minimum : toDate(ordered.minimum);
    const nextMin = ordered.exclusiveMinimum ? new globalThis.Date(minimum.getTime() + 1) : minimum;
    if (out.min === undefined || nextMin.getTime() > out.min.getTime()) {
      out.min = nextMin;
    }
  }
  if (ordered?.maximum !== undefined) {
    const maximum = toDate === undefined ? ordered.maximum : toDate(ordered.maximum);
    const nextMax = ordered.exclusiveMaximum ? new globalThis.Date(maximum.getTime() - 1) : maximum;
    if (out.max === undefined || nextMax.getTime() < out.max.getTime()) {
      out.max = nextMax;
    }
  }
  return out;
}
var DateString = /* @__PURE__ */ String4.annotate({
  expected: "a string in ISO 8601 format that will be decoded as a Date"
});
var Date4 = /* @__PURE__ */ instanceOf(globalThis.Date, {
  typeConstructor: {
    _tag: "Date"
  },
  generation: {
    runtime: `Schema.Date`,
    Type: `globalThis.Date`
  },
  expected: "Date",
  toCodecJson: () => link()(DateString, dateFromString),
  toArbitrary: () => (fc, ctx) => fc.date(dateArbitraryConstraints(ctx?.constraint, ctx?.constraint?.ordered?.order === Date2 ? ctx.constraint.ordered : undefined))
});
function fromJsonString2(schema) {
  return String4.annotate({
    expected: "a string that will be decoded as JSON",
    contentMediaType: "application/json",
    contentSchema: toEncoded(schema.ast)
  }).pipe(decodeTo2(schema, fromJsonString));
}
var File = /* @__PURE__ */ instanceOf(globalThis.File, {
  typeConstructor: {
    _tag: "File"
  },
  generation: {
    runtime: `Schema.File`,
    Type: `globalThis.File`
  },
  expected: "File",
  toCodecJson: () => link()(Struct({
    data: String4.check(isBase64()),
    type: String4,
    name: String4,
    lastModified: Number5
  }), transformOrFail2({
    decode: (e) => match2(decodeBase64(e.data), {
      onFailure: (error) => fail6(new InvalidValue(some2(e.data), {
        message: error.message
      })),
      onSuccess: (bytes) => {
        const buffer = new globalThis.Uint8Array(bytes);
        return succeed6(new globalThis.File([buffer], e.name, {
          type: e.type,
          lastModified: e.lastModified
        }));
      }
    }),
    encode: (file) => tryPromise2({
      try: async () => {
        const bytes = new globalThis.Uint8Array(await file.arrayBuffer());
        return {
          data: encodeBase64(bytes),
          type: file.type,
          name: file.name,
          lastModified: file.lastModified
        };
      },
      catch: (e) => new InvalidValue(some2(file), {
        message: globalThis.String(e)
      })
    })
  }))
});
var FormData2 = /* @__PURE__ */ instanceOf(globalThis.FormData, {
  typeConstructor: {
    _tag: "FormData"
  },
  generation: {
    runtime: `Schema.FormData`,
    Type: `globalThis.FormData`
  },
  expected: "FormData",
  toCodecJson: () => link()(ArraySchema(Tuple2([String4, Union2([Struct({
    _tag: tag("String"),
    value: String4
  }), Struct({
    _tag: tag("File"),
    value: File
  })])])), transformOrFail2({
    decode: (e) => {
      const out = new globalThis.FormData;
      for (const [key, entry] of e) {
        out.append(key, entry.value);
      }
      return succeed6(out);
    },
    encode: (formData) => {
      return succeed6(globalThis.Array.from(formData.entries()).map(([key, value]) => {
        if (typeof value === "string") {
          return [key, {
            _tag: "String",
            value
          }];
        } else {
          return [key, {
            _tag: "File",
            value
          }];
        }
      }));
    }
  }))
});
var URLSearchParams2 = /* @__PURE__ */ instanceOf(globalThis.URLSearchParams, {
  typeConstructor: {
    _tag: "URLSearchParams"
  },
  generation: {
    runtime: `Schema.URLSearchParams`,
    Type: `globalThis.URLSearchParams`
  },
  expected: "URLSearchParams",
  toCodecJson: () => link()(String4.annotate({
    expected: "a query string that will be decoded as URLSearchParams"
  }), transform2({
    decode: (e) => new globalThis.URLSearchParams(e),
    encode: (params) => params.toString()
  }))
});
var Finite = /* @__PURE__ */ Number5.check(/* @__PURE__ */ isFinite());
var Int = /* @__PURE__ */ Number5.check(/* @__PURE__ */ isInt());
var Base64String = /* @__PURE__ */ String4.annotate({
  expected: "a base64 encoded string that will be decoded as Uint8Array",
  format: "byte",
  contentEncoding: "base64"
});
var Uint8Array2 = /* @__PURE__ */ instanceOf(globalThis.Uint8Array, {
  typeConstructor: {
    _tag: "Uint8Array"
  },
  generation: {
    runtime: `Schema.Uint8Array`,
    Type: `globalThis.Uint8Array`
  },
  expected: "Uint8Array",
  toCodecJson: () => link()(Base64String, uint8ArrayFromBase64String),
  toArbitrary: () => (fc) => fc.uint8Array()
});
var DateTimeUtc = /* @__PURE__ */ declare((u) => isDateTime2(u) && isUtc2(u), {
  typeConstructor: {
    _tag: "effect/DateTime.Utc"
  },
  generation: {
    runtime: `Schema.DateTimeUtc`,
    Type: `DateTime.Utc`,
    importDeclaration: `import * as DateTime from "effect/DateTime"`
  },
  expected: "DateTime.Utc",
  toCodecJson: () => link()(String4, dateTimeUtcFromString),
  toArbitrary: () => (fc, ctx) => fc.date(dateArbitraryConstraints(ctx?.constraint, ctx?.constraint?.ordered?.order === Order2 ? ctx.constraint.ordered : undefined, {
    valid: true
  }, toDateUtc2)).map((date) => fromDateUnsafe2(date)),
  toFormatter: () => (utc) => utc.toString(),
  toEquivalence: () => Equivalence3
});
var immerable = /* @__PURE__ */ globalThis.Symbol.for("immer-draftable");
function makeClass(Inherited, identifier, struct2, annotations, proto) {
  const getClassSchema = getClassSchemaFactory(struct2, identifier, annotations);
  const ClassTypeId = getClassTypeId(identifier);
  const out = class extends Inherited {
    constructor(...[input, options]) {
      input = input ?? {};
      const validated = struct2.make(input, options);
      super({
        ...input,
        ...validated
      }, {
        ...options,
        disableChecks: true
      });
    }
    static [TypeId17] = TypeId17;
    get [ClassTypeId]() {
      return ClassTypeId;
    }
    static [immerable] = true;
    static identifier = identifier;
    static fields = struct2.fields;
    static get ast() {
      return getClassSchema(this).ast;
    }
    static pipe() {
      return pipeArguments(this, arguments);
    }
    static rebuild(ast) {
      return getClassSchema(this).rebuild(ast);
    }
    static make(input, options) {
      return new this(input, options);
    }
    static makeOption(input, options) {
      return makeOption(getClassSchema(this))(input ?? {}, options);
    }
    static makeEffect(input, options) {
      return getClassSchema(this).makeEffect(input ?? {}, options);
    }
    static annotate(annotations) {
      return this.rebuild(annotate(this.ast, annotations));
    }
    static annotateKey(annotations) {
      return this.rebuild(annotateKey(this.ast, annotations));
    }
    static check(...checks) {
      return this.rebuild(appendChecks(this.ast, checks));
    }
    static extend(identifier2) {
      return (newFields, annotations) => {
        const fields = {
          ...struct2.fields,
          ...newFields
        };
        return makeClass(this, identifier2, makeStruct(struct(fields, struct2.ast.checks, {
          identifier: identifier2
        }), fields), annotations, proto);
      };
    }
    static mapFields(f, options) {
      return struct2.mapFields(f, options);
    }
  };
  if (proto !== undefined) {
    Object.assign(out.prototype, proto(identifier));
  }
  return out;
}
function getClassTransformation(self) {
  return new Transformation(transform((input) => new self(input)), passthrough());
}
function getClassTypeId(identifier) {
  return `~effect/Schema/Class/${identifier}`;
}
function getClassSchemaFactory(from, identifier, annotations) {
  let memo;
  return (self) => {
    if (memo === undefined) {
      const transformation = getClassTransformation(self);
      const to = make15(new Declaration([from.ast], () => (input, ast) => {
        return input instanceof self || hasProperty(input, getClassTypeId(identifier)) ? succeed6(input) : fail6(new InvalidType(ast, some2(input)));
      }, {
        identifier,
        [ClassTypeId]: ([from]) => new Link(from, transformation),
        toCodec: ([from]) => new Link(from.ast, transformation),
        toArbitrary: ([from]) => () => ({
          arbitrary: from.arbitrary.map((args) => new self(args)),
          terminal: from.terminal?.map((args) => new self(args))
        }),
        toFormatter: ([from]) => (t) => `${self.identifier}(${from(t)})`,
        "~sentinels": collectSentinels(from.ast),
        ...annotations
      }));
      memo = from.pipe(decodeTo2(to, transformation));
    }
    return memo;
  };
}
function isStruct(schema) {
  return isSchema(schema);
}
var Class4 = (identifier) => (schema, annotations) => {
  const struct = isStruct(schema) ? schema : Struct(schema);
  return makeClass(Class3, identifier, struct, annotations, (identifier) => ({
    toString() {
      return `${identifier}(${format({
        ...this
      })})`;
    }
  }));
};
var ErrorClass = (identifier) => (schema, annotations) => {
  const struct = isStruct(schema) ? schema : Struct(schema);
  const self = makeClass(Error2, identifier, struct, annotations, (identifier) => ({
    name: identifier
  }));
  return self;
};
var TaggedErrorClass = (identifier) => {
  return (tagValue, schema, annotations) => {
    const struct = isStruct(schema) ? schema.mapFields((fields) => ({
      _tag: tag(tagValue),
      ...fields
    }), {
      unsafePreserveChecks: true
    }) : TaggedStruct(tagValue, schema);
    return ErrorClass(identifier ?? tagValue)(struct, annotations);
  };
};
var Json2 = /* @__PURE__ */ make15(Json);
// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/Random.js
var Random2 = Random;
var randomWith = (f) => withFiber2((fiber) => succeed6(f(fiber.getRef(Random2))));
var nextBetween = (min, max) => randomWith((r) => r.nextDoubleUnsafe() * (max - min) + min);
// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/unstable/http/Headers.js
var TypeId18 = /* @__PURE__ */ Symbol.for("~effect/http/Headers");
var Proto4 = /* @__PURE__ */ Object.defineProperties(/* @__PURE__ */ Object.create(null), {
  [TypeId18]: {
    value: TypeId18
  },
  [symbolRedactable]: {
    value(context) {
      return redact3(this, get(context, CurrentRedactedNames));
    }
  },
  toJSON: {
    value() {
      return redact(this);
    }
  },
  [symbol2]: {
    value(that) {
      return Equivalence5(this, that);
    }
  },
  [symbol]: {
    value() {
      return structure(this);
    }
  },
  toString: {
    value: BaseProto.toString
  },
  [NodeInspectSymbol]: {
    value: BaseProto[NodeInspectSymbol]
  }
});
var make16 = (input) => Object.assign(Object.create(Proto4), input);
var Equivalence5 = /* @__PURE__ */ makeEquivalence2(/* @__PURE__ */ strictEqual());
var empty4 = /* @__PURE__ */ Object.create(Proto4);
var fromInput = (input) => {
  if (input === undefined) {
    return empty4;
  } else if (Symbol.iterator in input) {
    const out = Object.create(Proto4);
    for (const [k, v] of input) {
      out[k.toLowerCase()] = v;
    }
    return out;
  }
  const out = Object.create(Proto4);
  for (const [k, v] of Object.entries(input)) {
    if (Array.isArray(v)) {
      out[k.toLowerCase()] = v.join(", ");
    } else if (v !== undefined) {
      out[k.toLowerCase()] = v;
    }
  }
  return out;
};
var fromRecordUnsafe = (input) => Object.setPrototypeOf(input, Proto4);
var set2 = /* @__PURE__ */ dual(3, (self, key, value) => {
  const out = make16(self);
  out[key.toLowerCase()] = value;
  return out;
});
var setAll = /* @__PURE__ */ dual(2, (self, headers) => make16({
  ...self,
  ...fromInput(headers)
}));
var merge3 = /* @__PURE__ */ dual(2, (self, headers) => {
  const out = make16(self);
  Object.assign(out, headers);
  return out;
});
var remove = /* @__PURE__ */ dual(2, (self, key) => {
  const out = make16(self);
  delete out[key.toLowerCase()];
  return out;
});
var redact3 = /* @__PURE__ */ dual(2, (self, key) => {
  const out = {
    ...self
  };
  const modify = (key) => {
    if (typeof key === "string") {
      const k = key.toLowerCase();
      if (k in self) {
        out[k] = make8(self[k]);
      }
    } else {
      for (const name in self) {
        if (key.test(name)) {
          out[name] = make8(self[name]);
        }
      }
    }
  };
  if (Array.isArray(key)) {
    for (let i = 0;i < key.length; i++) {
      modify(key[i]);
    }
  } else {
    modify(key);
  }
  return out;
});
var CurrentRedactedNames = /* @__PURE__ */ Reference("effect/Headers/CurrentRedactedNames", {
  defaultValue: () => ["authorization", "cookie", "set-cookie", "x-api-key"]
});

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/unstable/http/Cookies.js
var TypeId19 = "~effect/http/Cookies";
var CookieTypeId = "~effect/http/Cookies/Cookie";
var Proto5 = {
  [TypeId19]: TypeId19,
  ...BaseProto,
  toJSON() {
    return {
      _id: "effect/Cookies",
      cookies: map2(this.cookies, (cookie) => cookie.toJSON())
    };
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var fromReadonlyRecord = (cookies) => {
  const self = Object.create(Proto5);
  self.cookies = cookies;
  return self;
};
var fromIterable2 = (cookies) => {
  const record = {};
  for (const cookie of cookies) {
    record[cookie.name] = cookie;
  }
  return fromReadonlyRecord(record);
};
var fromSetCookie = (headers) => {
  const arrayHeaders = typeof headers === "string" ? [headers] : headers;
  const cookies = [];
  for (const header of arrayHeaders) {
    const cookie = parseSetCookie(header.trim());
    if (cookie) {
      cookies.push(cookie);
    }
  }
  return fromIterable2(cookies);
};
function parseSetCookie(header) {
  const parts = header.split(";").map((_) => _.trim()).filter((_) => _ !== "");
  if (parts.length === 0) {
    return;
  }
  const firstEqual = parts[0].indexOf("=");
  if (firstEqual === -1) {
    return;
  }
  const name = parts[0].slice(0, firstEqual);
  if (!fieldContentRegExp.test(name)) {
    return;
  }
  const valueEncoded = parts[0].slice(firstEqual + 1);
  const value = tryDecodeURIComponent(valueEncoded);
  if (parts.length === 1) {
    return Object.assign(Object.create(CookieProto), {
      name,
      value,
      valueEncoded
    });
  }
  const options = {};
  for (let i = 1;i < parts.length; i++) {
    const part = parts[i];
    const equalIndex = part.indexOf("=");
    const key = equalIndex === -1 ? part : part.slice(0, equalIndex).trim();
    const value = equalIndex === -1 ? undefined : part.slice(equalIndex + 1).trim();
    switch (key.toLowerCase()) {
      case "domain": {
        if (value === undefined) {
          break;
        }
        const domain = value.trim().replace(/^\./, "");
        if (domain) {
          options.domain = domain;
        }
        break;
      }
      case "expires": {
        if (value === undefined) {
          break;
        }
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          options.expires = date;
        }
        break;
      }
      case "max-age": {
        if (value === undefined) {
          break;
        }
        const maxAge = parseInt(value, 10);
        if (!isNaN(maxAge)) {
          options.maxAge = seconds(maxAge);
        }
        break;
      }
      case "path": {
        if (value === undefined) {
          break;
        }
        if (value[0] === "/") {
          options.path = value;
        }
        break;
      }
      case "priority": {
        if (value === undefined) {
          break;
        }
        switch (value.toLowerCase()) {
          case "low":
            options.priority = "low";
            break;
          case "medium":
            options.priority = "medium";
            break;
          case "high":
            options.priority = "high";
            break;
        }
        break;
      }
      case "httponly": {
        options.httpOnly = true;
        break;
      }
      case "secure": {
        options.secure = true;
        break;
      }
      case "partitioned": {
        options.partitioned = true;
        break;
      }
      case "samesite": {
        if (value === undefined) {
          break;
        }
        switch (value.toLowerCase()) {
          case "lax":
            options.sameSite = "lax";
            break;
          case "strict":
            options.sameSite = "strict";
            break;
          case "none":
            options.sameSite = "none";
            break;
        }
        break;
      }
    }
  }
  return Object.assign(Object.create(CookieProto), {
    name,
    value,
    valueEncoded,
    options: Object.keys(options).length > 0 ? options : undefined
  });
}
var fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
var CookieProto = {
  [CookieTypeId]: CookieTypeId,
  ...BaseProto,
  toJSON() {
    return {
      _id: "effect/Cookies/Cookie",
      name: this.name,
      value: this.value,
      options: this.options
    };
  }
};
var tryDecodeURIComponent = (str) => {
  try {
    return decodeURIComponent(str);
  } catch (_) {
    return str;
  }
};

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/unstable/http/HttpClientError.js
var TypeId20 = "~effect/http/HttpClientError";
var isHttpClientError = (u) => hasProperty(u, TypeId20);

class HttpClientError extends (/* @__PURE__ */ TaggedError2("HttpClientError")) {
  constructor(props) {
    if ("cause" in props.reason) {
      super({
        ...props,
        cause: props.reason.cause
      });
    } else {
      super(props);
    }
  }
  [TypeId20] = TypeId20;
  get request() {
    return this.reason.request;
  }
  get response() {
    return "response" in this.reason ? this.reason.response : undefined;
  }
  get message() {
    return this.reason.message;
  }
}
var formatReason = (tag) => tag.endsWith("Error") ? tag.slice(0, -5) : tag;
var formatMessage = (reason, description, info) => description ? `${reason}: ${description} (${info})` : `${reason} error (${info})`;

class TransportError extends (/* @__PURE__ */ TaggedError2("TransportError")) {
  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`;
  }
  get message() {
    return formatMessage(formatReason(this._tag), this.description, this.methodAndUrl);
  }
}
class InvalidUrlError extends (/* @__PURE__ */ TaggedError2("InvalidUrlError")) {
  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`;
  }
  get message() {
    return formatMessage(formatReason(this._tag), this.description, this.methodAndUrl);
  }
}
class DecodeError extends (/* @__PURE__ */ TaggedError2("DecodeError")) {
  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`;
  }
  get message() {
    const info = `${this.response.status} ${this.methodAndUrl}`;
    return formatMessage(formatReason(this._tag), this.description, info);
  }
}

class EmptyBodyError extends (/* @__PURE__ */ TaggedError2("EmptyBodyError")) {
  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`;
  }
  get message() {
    const info = `${this.response.status} ${this.methodAndUrl}`;
    return formatMessage(formatReason(this._tag), this.description, info);
  }
}

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/unstable/http/UrlParams.js
var TypeId21 = "~effect/http/UrlParams";
var Proto6 = {
  ...PipeInspectableProto,
  [TypeId21]: TypeId21,
  [Symbol.iterator]() {
    return this.params[Symbol.iterator]();
  },
  toJSON() {
    return {
      _id: "UrlParams",
      params: Object.fromEntries(this.params)
    };
  },
  [symbol2](that) {
    return Equivalence6(this, that);
  },
  [symbol]() {
    return array(this.params.flat());
  }
};
var make17 = (params) => {
  const self = Object.create(Proto6);
  self.params = params;
  return self;
};
var fromInput2 = (input) => {
  const parsed = fromInputNested(input);
  const out = [];
  for (let i = 0;i < parsed.length; i++) {
    if (Array.isArray(parsed[i][0])) {
      const [keys, value] = parsed[i];
      out.push([`${keys[0]}[${keys.slice(1).join("][")}]`, value]);
    } else {
      out.push(parsed[i]);
    }
  }
  return make17(out);
};
var fromInputNested = (input) => {
  const entries = typeof input[Symbol.iterator] === "function" ? fromIterable(input) : Object.entries(input);
  const out = [];
  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      for (let i = 0;i < value.length; i++) {
        if (value[i] !== undefined) {
          out.push([key, String(value[i])]);
        }
      }
    } else if (typeof value === "object") {
      const nested = fromInputNested(value);
      for (const [k, v] of nested) {
        out.push([[key, ...typeof k === "string" ? [k] : k], v]);
      }
    } else if (value !== undefined) {
      out.push([key, String(value)]);
    }
  }
  return out;
};
var Equivalence6 = /* @__PURE__ */ make((a, b) => arrayEquivalence(a.params, b.params));
var arrayEquivalence = /* @__PURE__ */ makeEquivalence3(/* @__PURE__ */ makeEquivalence([/* @__PURE__ */ strictEqual(), /* @__PURE__ */ strictEqual()]));
var empty5 = /* @__PURE__ */ make17([]);
var setAll2 = /* @__PURE__ */ dual(2, (self, input) => {
  const out = fromInput2(input);
  const params = out.params;
  const keys = new Set;
  for (let i = 0;i < params.length; i++) {
    keys.add(params[i][0]);
  }
  for (let i = 0;i < self.params.length; i++) {
    if (keys.has(self.params[i][0]))
      continue;
    params.push(self.params[i]);
  }
  return out;
});
class UrlParamsError extends (/* @__PURE__ */ TaggedError2("UrlParamsError")) {
}
var makeUrl = (url, params, hash) => {
  try {
    const urlInstance = new URL(url, baseUrl());
    for (let i = 0;i < params.params.length; i++) {
      const [key, value] = params.params[i];
      if (value !== undefined) {
        urlInstance.searchParams.append(key, value);
      }
    }
    if (hash !== undefined) {
      urlInstance.hash = hash;
    }
    return succeed2(urlInstance);
  } catch (e) {
    return fail2(new UrlParamsError({
      cause: e
    }));
  }
};
var baseUrl = () => {
  if ("location" in globalThis && globalThis.location !== undefined && globalThis.location.origin !== undefined && globalThis.location.pathname !== undefined) {
    return location.origin + location.pathname;
  }
  return;
};

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/unstable/http/HttpBody.js
var TypeId22 = "~effect/http/HttpBody";
class Proto7 {
  [TypeId22];
  constructor() {
    this[TypeId22] = TypeId22;
  }
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
  toString() {
    return format(this, {
      ignoreToString: true
    });
  }
}

class Empty2 extends Proto7 {
  _tag = "Empty";
  toJSON() {
    return {
      _id: "effect/HttpBody",
      _tag: "Empty"
    };
  }
}
var empty6 = /* @__PURE__ */ new Empty2;

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/unstable/http/HttpMethod.js
var allShort = [["GET", "get"], ["POST", "post"], ["PUT", "put"], ["DELETE", "del"], ["PATCH", "patch"], ["HEAD", "head"], ["OPTIONS", "options"], ["TRACE", "trace"]];

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/unstable/http/HttpClientRequest.js
var TypeId23 = "~effect/http/HttpClientRequest";
var Proto8 = {
  [TypeId23]: TypeId23,
  ...BaseProto,
  toJSON() {
    return {
      _id: "HttpClientRequest",
      method: this.method,
      url: this.url,
      urlParams: this.urlParams,
      hash: this.hash,
      headers: redact(this.headers),
      body: this.body.toJSON()
    };
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
function makeWith(method, url, urlParams, hash, headers, body) {
  const self = Object.create(Proto8);
  self.method = method;
  self.url = url;
  self.urlParams = urlParams;
  self.hash = hash;
  self.headers = headers;
  self.body = body;
  return self;
}
var empty7 = /* @__PURE__ */ makeWith("GET", "", empty5, /* @__PURE__ */ none2(), empty4, empty6);
var make18 = (method) => (url, options) => modify(empty7, {
  method,
  url,
  ...options ?? undefined
});
var modify = /* @__PURE__ */ dual(2, (self, options) => {
  let result = self;
  if (options.method) {
    result = setMethod(result, options.method);
  }
  if (options.url) {
    result = setUrl(result, options.url);
  }
  if (options.headers) {
    result = setHeaders(result, options.headers);
  }
  if (options.urlParams) {
    result = setUrlParams(result, options.urlParams);
  }
  if (options.hash) {
    result = setHash(result, options.hash);
  }
  if (options.body) {
    result = setBody(result, options.body);
  }
  if (options.accept) {
    result = accept(result, options.accept);
  }
  if (options.acceptJson) {
    result = acceptJson(result);
  }
  return result;
});
var setMethod = /* @__PURE__ */ dual(2, (self, method) => makeWith(method, self.url, self.urlParams, self.hash, self.headers, self.body));
var setHeader = /* @__PURE__ */ dual(3, (self, key, value) => makeWith(self.method, self.url, self.urlParams, self.hash, set2(self.headers, key, value), self.body));
var setHeaders = /* @__PURE__ */ dual(2, (self, input) => makeWith(self.method, self.url, self.urlParams, self.hash, setAll(self.headers, input), self.body));
var accept = /* @__PURE__ */ dual(2, (self, mediaType) => setHeader(self, "Accept", mediaType));
var acceptJson = /* @__PURE__ */ accept("application/json");
var setUrl = /* @__PURE__ */ dual(2, (self, url) => {
  if (typeof url === "string") {
    return makeWith(self.method, url, self.urlParams, self.hash, self.headers, self.body);
  }
  const clone = new URL(url.toString());
  const urlParams = fromInput2(clone.searchParams);
  const hash = fromNullishOr(clone.hash === "" ? undefined : clone.hash.slice(1));
  clone.search = "";
  clone.hash = "";
  return makeWith(self.method, clone.toString(), urlParams, hash, self.headers, self.body);
});
var setUrlParams = /* @__PURE__ */ dual(2, (self, input) => makeWith(self.method, self.url, setAll2(self.urlParams, input), self.hash, self.headers, self.body));
var setHash = /* @__PURE__ */ dual(2, (self, hash) => makeWith(self.method, self.url, self.urlParams, some2(hash), self.headers, self.body));
var setBody = /* @__PURE__ */ dual(2, (self, body) => {
  let headers = self.headers;
  if (body._tag === "Empty" || body._tag === "FormData") {
    headers = remove(remove(headers, "Content-Type"), "Content-length");
  } else {
    if (body.contentType) {
      headers = set2(headers, "content-type", body.contentType);
    }
    if (body.contentLength !== undefined) {
      headers = set2(headers, "content-length", body.contentLength.toString());
    }
  }
  return makeWith(self.method, self.url, self.urlParams, self.hash, headers, body);
});

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/unstable/http/HttpIncomingMessage.js
var TypeId24 = "~effect/http/HttpIncomingMessage";
var inspect = (self, that) => {
  const contentType = self.headers["content-type"] ?? "";
  let body;
  if (contentType.includes("application/json")) {
    try {
      body = runSync2(self.json);
    } catch (_) {}
  } else if (contentType.includes("text/") || contentType.includes("urlencoded")) {
    try {
      body = runSync2(self.text);
    } catch (_) {}
  }
  const obj = {
    ...that,
    headers: redact(self.headers),
    remoteAddress: self.remoteAddress
  };
  if (body !== undefined) {
    obj.body = body;
  }
  return obj;
};

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/unstable/http/HttpClientResponse.js
var TypeId25 = "~effect/http/HttpClientResponse";
var fromWeb = (request, source) => new WebHttpClientResponse(request, source);
class WebHttpClientResponse extends Class2 {
  [TypeId24];
  [TypeId25];
  request;
  source;
  constructor(request, source) {
    super();
    this.request = request;
    this.source = source;
    this[TypeId24] = TypeId24;
    this[TypeId25] = TypeId25;
  }
  toJSON() {
    return inspect(this, {
      _id: "HttpClientResponse",
      request: this.request.toJSON(),
      status: this.status
    });
  }
  get status() {
    return this.source.status;
  }
  get headers() {
    return fromInput(this.source.headers);
  }
  cachedCookies;
  get cookies() {
    if (this.cachedCookies) {
      return this.cachedCookies;
    }
    return this.cachedCookies = fromSetCookie(this.source.headers.getSetCookie());
  }
  get remoteAddress() {
    return none2();
  }
  get stream() {
    return this.source.body ? fromReadableStream({
      evaluate: () => this.source.body,
      onError: (cause) => new HttpClientError({
        reason: new DecodeError({
          request: this.request,
          response: this,
          cause
        })
      })
    }) : fail8(new HttpClientError({
      reason: new EmptyBodyError({
        request: this.request,
        response: this,
        description: "can not create stream from empty body"
      })
    }));
  }
  get json() {
    return flatMap2(this.text, (text) => try_2({
      try: () => text === "" ? null : JSON.parse(text),
      catch: (cause) => new HttpClientError({
        reason: new DecodeError({
          request: this.request,
          response: this,
          cause
        })
      })
    }));
  }
  textBody;
  get text() {
    if (this.textBody) {
      return this.textBody;
    }
    this.textBody = tryPromise2({
      try: () => this.source.text(),
      catch: (cause) => new HttpClientError({
        reason: new DecodeError({
          request: this.request,
          response: this,
          cause
        })
      })
    }).pipe(cached2, runSync2);
    this.arrayBufferBody = map5(this.textBody, (_) => new TextEncoder().encode(_).buffer);
    return this.textBody;
  }
  get urlParamsBody() {
    return flatMap2(this.text, (_) => try_2({
      try: () => fromInput2(new URLSearchParams(_)),
      catch: (cause) => new HttpClientError({
        reason: new DecodeError({
          request: this.request,
          response: this,
          cause
        })
      })
    }));
  }
  formDataBody;
  get formData() {
    return this.formDataBody ??= tryPromise2({
      try: () => this.source.formData(),
      catch: (cause) => new HttpClientError({
        reason: new DecodeError({
          request: this.request,
          response: this,
          cause
        })
      })
    }).pipe(cached2, runSync2);
  }
  arrayBufferBody;
  get arrayBuffer() {
    if (this.arrayBufferBody) {
      return this.arrayBufferBody;
    }
    this.arrayBufferBody = tryPromise2({
      try: () => this.source.arrayBuffer(),
      catch: (cause) => new HttpClientError({
        reason: new DecodeError({
          request: this.request,
          response: this,
          cause
        })
      })
    }).pipe(cached2, runSync2);
    this.textBody = map5(this.arrayBufferBody, (_) => new TextDecoder().decode(_));
    return this.arrayBufferBody;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/unstable/http/HttpTraceContext.js
var toHeaders = (span) => fromRecordUnsafe({
  b3: `${span.traceId}-${span.spanId}-${span.sampled ? "1" : "0"}${match(span.parent, {
    onNone: () => "",
    onSome: (parent) => `-${parent.spanId}`
  })}`,
  traceparent: `00-${span.traceId}-${span.spanId}-${span.sampled ? "01" : "00"}`
});

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/unstable/http/HttpClient.js
var TypeId26 = "~effect/http/HttpClient";
var HttpClient = /* @__PURE__ */ Service("effect/HttpClient");
var transformResponse = /* @__PURE__ */ dual(2, (self, f) => makeWith2((request) => f(self.postprocess(request)), self.preprocess));
var makeWith2 = (postprocess, preprocess) => {
  const self = Object.create(Proto9);
  self.preprocess = preprocess;
  self.postprocess = postprocess;
  self.execute = function(request) {
    return postprocess(preprocess(request));
  };
  return self;
};
var Proto9 = {
  [TypeId26]: TypeId26,
  pipe() {
    return pipeArguments(this, arguments);
  },
  ...BaseProto,
  toJSON() {
    return {
      _id: "effect/HttpClient"
    };
  },
  .../* @__PURE__ */ Object.fromEntries(/* @__PURE__ */ allShort.map(([fullMethod, method]) => [method, function(url, options) {
    return this.execute(make18(fullMethod)(url, options));
  }]))
};
var make19 = (f) => makeWith2((effect) => flatMap2(effect, (request) => withFiber2((fiber) => {
  const scopedController = scopedRequests.get(request);
  const controller = scopedController ?? new AbortController;
  const urlResult = makeUrl(request.url, request.urlParams, getOrUndefined(request.hash));
  if (isFailure2(urlResult)) {
    return fail6(new HttpClientError({
      reason: new InvalidUrlError({
        request,
        cause: urlResult.failure
      })
    }));
  }
  const url = urlResult.success;
  const tracerDisabled = fiber.getRef(DisablePropagation) || fiber.getRef(TracerDisabledWhen)(request);
  if (tracerDisabled) {
    const effect = f(request, url, controller.signal, fiber);
    if (scopedController)
      return effect;
    return uninterruptibleMask2((restore) => matchCauseEffect2(restore(effect), {
      onSuccess(response) {
        responseRegistry.register(response, controller);
        return succeed6(new InterruptibleResponse(response, controller));
      },
      onFailure(cause) {
        if (hasInterrupts2(cause)) {
          controller.abort();
        }
        return failCause3(cause);
      }
    }));
  }
  return useSpan2(fiber.getRef(SpanNameGenerator)(request), {
    kind: "client"
  }, (span) => {
    span.attribute("http.request.method", request.method);
    span.attribute("server.address", url.origin);
    if (url.port !== "") {
      span.attribute("server.port", +url.port);
    }
    span.attribute("url.full", url.toString());
    span.attribute("url.path", url.pathname);
    span.attribute("url.scheme", url.protocol.slice(0, -1));
    const query = url.search.slice(1);
    if (query !== "") {
      span.attribute("url.query", query);
    }
    const redactedHeaderNames = fiber.getRef(CurrentRedactedNames);
    const redactedHeaders = redact3(request.headers, redactedHeaderNames);
    for (const name in redactedHeaders) {
      span.attribute(`http.request.header.${name}`, String(redactedHeaders[name]));
    }
    request = fiber.getRef(TracerPropagationEnabled) ? setHeaders(request, toHeaders(span)) : request;
    return uninterruptibleMask2((restore) => restore(f(request, url, controller.signal, fiber)).pipe(withParentSpan2(span, {
      captureStackTrace: false
    }), matchCauseEffect2({
      onSuccess: (response) => {
        span.attribute("http.response.status_code", response.status);
        const redactedHeaders = redact3(response.headers, redactedHeaderNames);
        for (const name in redactedHeaders) {
          span.attribute(`http.response.header.${name}`, String(redactedHeaders[name]));
        }
        if (scopedController)
          return succeed6(response);
        responseRegistry.register(response, controller);
        return succeed6(new InterruptibleResponse(response, controller));
      },
      onFailure(cause) {
        if (!scopedController && hasInterrupts2(cause)) {
          controller.abort();
        }
        return failCause3(cause);
      }
    })));
  });
})), succeed6);
var TracerDisabledWhen = /* @__PURE__ */ Reference("effect/http/HttpClient/TracerDisabledWhen", {
  defaultValue: () => constFalse
});
var TracerPropagationEnabled = /* @__PURE__ */ Reference("effect/HttpClient/TracerPropagationEnabled", {
  defaultValue: constTrue
});
var SpanNameGenerator = /* @__PURE__ */ Reference("effect/http/HttpClient/SpanNameGenerator", {
  defaultValue: () => (request) => `http.client ${request.method}`
});
var layerMergedContext = (effect2) => effect(HttpClient)(contextWith2((context) => map5(effect2, (client) => transformResponse(client, updateContext2((input) => merge(context, input))))));
var responseRegistry = /* @__PURE__ */ (() => {
  if ("FinalizationRegistry" in globalThis && globalThis.FinalizationRegistry) {
    const registry = /* @__PURE__ */ new FinalizationRegistry((controller) => {
      controller.abort();
    });
    return {
      register(response, controller) {
        registry.register(response, controller, response);
      },
      unregister(response) {
        registry.unregister(response);
      }
    };
  }
  const timers = /* @__PURE__ */ new Map;
  return {
    register(response, controller) {
      timers.set(response, setTimeout(() => controller.abort(), 5000));
    },
    unregister(response) {
      const timer = timers.get(response);
      if (timer === undefined)
        return;
      clearTimeout(timer);
      timers.delete(response);
    }
  };
})();
var scopedRequests = /* @__PURE__ */ new WeakMap;

class InterruptibleResponse {
  original;
  controller;
  constructor(original, controller) {
    this.original = original;
    this.controller = controller;
  }
  [TypeId25] = TypeId25;
  [TypeId24] = TypeId24;
  applyInterrupt(effect) {
    return suspend2(() => {
      responseRegistry.unregister(this.original);
      return onInterrupt2(effect, () => sync2(() => {
        this.controller.abort();
      }));
    });
  }
  get request() {
    return this.original.request;
  }
  get status() {
    return this.original.status;
  }
  get headers() {
    return this.original.headers;
  }
  get cookies() {
    return this.original.cookies;
  }
  get remoteAddress() {
    return this.original.remoteAddress;
  }
  get formData() {
    return this.applyInterrupt(this.original.formData);
  }
  get text() {
    return this.applyInterrupt(this.original.text);
  }
  get json() {
    return this.applyInterrupt(this.original.json);
  }
  get urlParamsBody() {
    return this.applyInterrupt(this.original.urlParamsBody);
  }
  get arrayBuffer() {
    return this.applyInterrupt(this.original.arrayBuffer);
  }
  get stream() {
    return suspend4(() => {
      responseRegistry.unregister(this.original);
      return ensuring4(this.original.stream, sync2(() => {
        this.controller.abort();
      }));
    });
  }
  toJSON() {
    return this.original.toJSON();
  }
  [NodeInspectSymbol]() {
    return this.original[NodeInspectSymbol]();
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}

// node_modules/.bun/effect@4.0.0-beta.83/node_modules/effect/dist/unstable/http/FetchHttpClient.js
var Fetch = /* @__PURE__ */ Reference("effect/http/FetchHttpClient/Fetch", {
  defaultValue: () => globalThis.fetch
});

class RequestInit extends (/* @__PURE__ */ Service()("effect/http/FetchHttpClient/RequestInit")) {
}
var fetch2 = /* @__PURE__ */ make19((request, url, signal, fiber) => {
  const fetch2 = fiber.getRef(Fetch);
  const options = fiber.context.mapUnsafe.get(RequestInit.key) ?? {};
  let headers = options.headers ? merge3(fromInput(options.headers), request.headers) : request.headers;
  if (headers["content-length"]) {
    headers = remove(headers, "content-length");
  }
  const send = (body) => map5(tryPromise2({
    try: () => fetch2(url, {
      ...options,
      method: request.method,
      headers,
      body,
      duplex: request.body._tag === "Stream" ? "half" : undefined,
      signal
    }),
    catch: (cause) => new HttpClientError({
      reason: new TransportError({
        request,
        cause
      })
    })
  }), (response) => fromWeb(request, response));
  switch (request.body._tag) {
    case "Raw":
    case "Uint8Array":
      return send(request.body.body);
    case "FormData":
      return send(request.body.formData);
    case "Stream":
      return flatMap2(toReadableStreamEffect(request.body.stream), send);
  }
  return send(undefined);
});
var layer = /* @__PURE__ */ layerMergedContext(/* @__PURE__ */ succeed6(fetch2));
// packages/schema/src/schema.ts
var PositiveInt = Int.check(isGreaterThan3(0));
var NonNegativeInt = Int.check(isGreaterThanOrEqualTo3(0));
var RelativePath = String4.pipe(brand2("RelativePath"));
var AbsolutePath = String4.pipe(brand2("AbsolutePath"));
var optional2 = (schema) => optionalKey2(schema).pipe(decodeTo2(optional(toType2(schema)), {
  decode: passthrough({ strict: false }),
  encode: transformOptional(filter((value) => value !== undefined))
}));
var DateTimeUtcFromMillis = Finite.pipe(decodeTo2(DateTimeUtc, {
  decode: transform((value) => makeUnsafe4(value)),
  encode: transform((value) => toEpochMillis2(value))
}));

// packages/schema/src/llm.ts
var ProviderMetadata = Record(String4, Record(String4, Unknown2)).annotate({
  identifier: "LLM.ProviderMetadata"
});
var ToolTextContent = Struct({
  type: Literal2("text"),
  text: String4
}).annotate({ identifier: "Tool.TextContent" });
var ToolFileContent = Struct({
  type: Literal2("file"),
  uri: String4,
  mime: String4,
  name: optional2(String4)
}).annotate({ identifier: "Tool.FileContent" });
var ToolContent = Union2([ToolTextContent, ToolFileContent]).pipe(toTaggedUnion("type")).annotate({ identifier: "LLM.ToolContent" });

// packages/llm/src/schema/ids.ts
var ProtocolID = String4;
var RouteID = String4;
var ModelID = String4.pipe(brand2("LLM.ModelID"));
var ProviderID = String4.pipe(brand2("LLM.ProviderID"));
var ResponseID = String4;
var ContentBlockID = String4;
var ToolCallID = String4;
var ReasoningEfforts = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
var ReasoningEffort = Literals(ReasoningEfforts);
var TextVerbosity = Literals(["low", "medium", "high"]);
var MessageRole = Literals(["system", "user", "assistant", "tool"]);
var FinishReason = Literals(["stop", "length", "tool-calls", "content-filter", "error", "unknown"]);
var JsonSchema2 = Record(String4, Unknown2);
// packages/llm/src/utils/record.ts
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

// packages/llm/src/schema/options.ts
var mergeJsonRecords = (...items) => {
  const defined = items.filter((item) => item !== undefined);
  if (defined.length === 0)
    return;
  if (defined.length === 1 && Object.values(defined[0]).every((value) => value !== undefined))
    return defined[0];
  const result = {};
  for (const item of defined) {
    for (const [key, value] of Object.entries(item)) {
      if (value === undefined)
        continue;
      result[key] = isRecord(result[key]) && isRecord(value) ? mergeJsonRecords(result[key], value) : value;
    }
  }
  return Object.keys(result).length === 0 ? undefined : result;
};
var mergeStringRecords = (...items) => {
  const defined = items.filter((item) => item !== undefined);
  if (defined.length === 0)
    return;
  if (defined.length === 1)
    return defined[0];
  const result = Object.fromEntries(defined.flatMap((item) => Object.entries(item).filter((entry) => entry[1] !== undefined)));
  return Object.keys(result).length === 0 ? undefined : result;
};
var ProviderOptions = Record(String4, Record(String4, Unknown2));
var mergeProviderOptions = (...items) => {
  const result = {};
  for (const item of items) {
    if (!item)
      continue;
    for (const [provider, options] of Object.entries(item)) {
      const merged = mergeJsonRecords(result[provider], options);
      if (merged)
        result[provider] = merged;
    }
  }
  return Object.keys(result).length === 0 ? undefined : result;
};

class HttpOptions extends Class4("LLM.HttpOptions")({
  body: optional(JsonSchema2),
  headers: optional(Record(String4, String4)),
  query: optional(Record(String4, String4))
}) {
}
((HttpOptions2) => {
  HttpOptions2.make = (input) => input instanceof HttpOptions ? input : new HttpOptions(input);
})(HttpOptions ||= {});
var mergeHttpOptions = (...items) => {
  const body = mergeJsonRecords(...items.map((item) => item?.body));
  const headers = mergeStringRecords(...items.map((item) => item?.headers));
  const query = mergeStringRecords(...items.map((item) => item?.query));
  if (!body && !headers && !query)
    return;
  return new HttpOptions({ body, headers, query });
};

class GenerationOptions extends Class4("LLM.GenerationOptions")({
  maxTokens: optional(Number5),
  temperature: optional(Number5),
  topP: optional(Number5),
  topK: optional(Number5),
  frequencyPenalty: optional(Number5),
  presencePenalty: optional(Number5),
  seed: optional(Number5),
  stop: optional(ArraySchema(String4))
}) {
}
((GenerationOptions2) => {
  GenerationOptions2.make = (input = {}) => input instanceof GenerationOptions ? input : new GenerationOptions(input);
})(GenerationOptions ||= {});
var latestGeneration = (items, key) => items.findLast((item) => item?.[key] !== undefined)?.[key];
var mergeGenerationOptions = (...items) => {
  const result = new GenerationOptions({
    maxTokens: latestGeneration(items, "maxTokens"),
    temperature: latestGeneration(items, "temperature"),
    topP: latestGeneration(items, "topP"),
    topK: latestGeneration(items, "topK"),
    frequencyPenalty: latestGeneration(items, "frequencyPenalty"),
    presencePenalty: latestGeneration(items, "presencePenalty"),
    seed: latestGeneration(items, "seed"),
    stop: latestGeneration(items, "stop")
  });
  return Object.values(result).some((value) => value !== undefined) ? result : undefined;
};

class ModelLimits extends Class4("LLM.ModelLimits")({
  context: optional(Number5),
  output: optional(Number5)
}) {
}
((ModelLimits2) => {
  ModelLimits2.make = (input) => input instanceof ModelLimits ? input : new ModelLimits(input ?? {});
})(ModelLimits ||= {});

class ModelDefaults extends Class4("LLM.ModelDefaults")({
  limits: optional(ModelLimits),
  generation: optional(GenerationOptions),
  providerOptions: optional(ProviderOptions),
  http: optional(HttpOptions)
}) {
}
((ModelDefaults2) => {
  ModelDefaults2.make = (input) => {
    if (input instanceof ModelDefaults)
      return input;
    return new ModelDefaults({
      limits: input.limits === undefined ? undefined : ModelLimits.make(input.limits),
      generation: input.generation === undefined ? undefined : GenerationOptions.make(input.generation),
      providerOptions: input.providerOptions,
      http: input.http === undefined ? undefined : HttpOptions.make(input.http)
    });
  };
})(ModelDefaults ||= {});
var ModelToolSchemaCompatibility = Literals(["gemini", "moonshot"]);

class ModelCompatibility extends Class4("LLM.ModelCompatibility")({
  toolSchema: optional(ModelToolSchemaCompatibility)
}) {
}
((ModelCompatibility2) => {
  ModelCompatibility2.make = (input) => input instanceof ModelCompatibility ? input : new ModelCompatibility(input);
})(ModelCompatibility ||= {});

class Model {
  id;
  provider;
  route;
  defaults;
  compatibility;
  constructor(input) {
    this.id = input.id;
    this.provider = input.provider;
    this.route = input.route;
    this.defaults = input.defaults;
    this.compatibility = input.compatibility;
  }
  static make(input) {
    return new Model({
      id: ModelID.make(input.id),
      provider: ProviderID.make(input.provider),
      route: input.route,
      defaults: input.defaults === undefined ? undefined : ModelDefaults.make(input.defaults),
      compatibility: input.compatibility === undefined ? undefined : ModelCompatibility.make(input.compatibility)
    });
  }
  static input(model) {
    return {
      id: model.id,
      provider: model.provider,
      route: model.route,
      defaults: model.defaults,
      compatibility: model.compatibility
    };
  }
  static update(model, patch) {
    if (Object.keys(patch).length === 0)
      return model;
    return Model.make({
      ...Model.input(model),
      ...patch
    });
  }
}
var ModelSchema = declare((value) => value instanceof Model, { expected: "LLM.Model" });

class CacheHint extends Class4("LLM.CacheHint")({
  type: Literals(["ephemeral", "persistent"]),
  ttlSeconds: optional(Number5)
}) {
}
var CachePolicyObject = Struct({
  tools: optional(Boolean3),
  system: optional(Boolean3),
  messages: optional(Union2([
    Literal2("latest-user-message"),
    Literal2("latest-assistant"),
    Struct({ tail: Number5 })
  ])),
  ttlSeconds: optional(Number5)
});
var CachePolicy = Union2([Literal2("auto"), Literal2("none"), CachePolicyObject]);
// packages/llm/src/schema/messages.ts
var systemPartSchema = Struct({
  type: Literal2("text"),
  text: String4,
  cache: optional(CacheHint),
  metadata: optional(Record(String4, Unknown2))
}).annotate({ identifier: "LLM.SystemPart" });
var makeSystemPart = (text) => ({ type: "text", text });
var SystemPart = Object.assign(systemPartSchema, {
  make: makeSystemPart,
  content: (input) => {
    if (input === undefined)
      return [];
    return typeof input === "string" ? [makeSystemPart(input)] : Array.isArray(input) ? [...input] : [input];
  }
});
var TextPart = Struct({
  type: Literal2("text"),
  text: String4,
  cache: optional(CacheHint),
  metadata: optional(Record(String4, Unknown2)),
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Content.Text" });
var MediaPart = Struct({
  type: Literal2("media"),
  mediaType: String4,
  data: Union2([String4, Uint8Array2]),
  filename: optional(String4),
  metadata: optional(Record(String4, Unknown2))
}).annotate({ identifier: "LLM.Content.Media" });
var isToolResultValue = (value) => isRecord(value) && (value.type === "text" || value.type === "json" || value.type === "error" || value.type === "content") && ("value" in value);
var ToolResultValue = Object.assign(Union2([
  Struct({
    type: Literal2("json"),
    value: Unknown2
  }),
  Struct({
    type: Literal2("text"),
    value: Unknown2
  }),
  Struct({
    type: Literal2("error"),
    value: Unknown2
  }),
  Struct({
    type: Literal2("content"),
    value: ArraySchema(ToolContent)
  })
]).annotate({ identifier: "LLM.ToolResult" }), {
  is: isToolResultValue,
  make: (value, type = "json") => {
    if (isToolResultValue(value))
      return value;
    if (type === "content")
      return { type, value: Array.isArray(value) ? value : [] };
    return { type, value };
  }
});
var ToolOutput = Object.assign(Struct({
  structured: Unknown2,
  content: ArraySchema(ToolContent)
}).annotate({ identifier: "LLM.ToolOutput" }), {
  make: (structured, content = []) => ({ structured, content }),
  fromResultValue: (result) => {
    switch (result.type) {
      case "json":
        return { structured: result.value, content: [] };
      case "text":
        return { structured: {}, content: [{ type: "text", text: toolResultText(result.value) }] };
      case "content":
        return { structured: {}, content: result.value };
      case "error":
        return;
    }
  },
  toResultValue: (output) => {
    if (output.content.length === 0)
      return { type: "json", value: output.structured };
    if (output.content.length === 1 && output.content[0]?.type === "text")
      return { type: "text", value: output.content[0].text };
    return { type: "content", value: output.content };
  }
});
var toolResultText = (value) => {
  if (typeof value === "string")
    return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};
var ToolCallPart = Object.assign(Struct({
  type: Literal2("tool-call"),
  id: String4,
  name: String4,
  input: Unknown2,
  providerExecuted: optional(Boolean3),
  metadata: optional(Record(String4, Unknown2)),
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Content.ToolCall" }), {
  make: (input) => ({ type: "tool-call", ...input })
});
var ToolResultPart = Object.assign(Struct({
  type: Literal2("tool-result"),
  id: String4,
  name: String4,
  result: ToolResultValue,
  providerExecuted: optional(Boolean3),
  cache: optional(CacheHint),
  metadata: optional(Record(String4, Unknown2)),
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Content.ToolResult" }), {
  make: (input) => ({
    type: "tool-result",
    id: input.id,
    name: input.name,
    result: ToolResultValue.make(input.result, input.resultType),
    providerExecuted: input.providerExecuted,
    cache: input.cache,
    metadata: input.metadata,
    providerMetadata: input.providerMetadata
  })
});
var ReasoningPart = Struct({
  type: Literal2("reasoning"),
  text: String4,
  encrypted: optional(String4),
  metadata: optional(Record(String4, Unknown2)),
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Content.Reasoning" });
var ContentPart = Union2([TextPart, MediaPart, ToolCallPart, ToolResultPart, ReasoningPart]).pipe(toTaggedUnion("type"));

class Message extends Class4("LLM.Message")({
  id: optional(String4),
  role: MessageRole,
  content: ArraySchema(ContentPart),
  metadata: optional(Record(String4, Unknown2)),
  native: optional(Record(String4, Unknown2))
}) {
}
((Message2) => {
  Message2.text = (value) => ({ type: "text", text: value });
  Message2.content = (input) => typeof input === "string" ? [Message2.text(input)] : Array.isArray(input) ? [...input] : [input];
  Message2.make = (input) => {
    if (input instanceof Message)
      return input;
    return new Message({ ...input, content: Message2.content(input.content) });
  };
  Message2.user = (content) => Message2.make({ role: "user", content });
  Message2.assistant = (content) => Message2.make({ role: "assistant", content });
  Message2.system = (content) => Message2.make({ role: "system", content });
  Message2.tool = (result) => Message2.make({ role: "tool", content: ["type" in result ? result : ToolResultPart.make(result)] });
})(Message ||= {});

class ToolDefinition extends Class4("LLM.ToolDefinition")({
  name: String4,
  description: String4,
  inputSchema: JsonSchema2,
  outputSchema: optional(JsonSchema2),
  cache: optional(CacheHint),
  metadata: optional(Record(String4, Unknown2)),
  native: optional(Record(String4, Unknown2))
}) {
}
((ToolDefinition2) => {
  ToolDefinition2.make = (input) => input instanceof ToolDefinition ? input : new ToolDefinition(input);
})(ToolDefinition ||= {});

class ToolChoice extends Class4("LLM.ToolChoice")({
  type: Literals(["auto", "none", "required", "tool"]),
  name: optional(String4)
}) {
}
((ToolChoice2) => {
  const isMode = (value) => value === "auto" || value === "none" || value === "required";
  ToolChoice2.named = (value) => new ToolChoice({ type: "tool", name: value });
  ToolChoice2.make = (input) => {
    if (input instanceof ToolChoice)
      return input;
    if (input instanceof ToolDefinition)
      return ToolChoice2.named(input.name);
    if (typeof input === "string")
      return isMode(input) ? new ToolChoice({ type: input }) : ToolChoice2.named(input);
    return new ToolChoice(input);
  };
})(ToolChoice ||= {});
var ResponseFormat = Union2([
  Struct({ type: Literal2("text") }),
  Struct({ type: Literal2("json"), schema: JsonSchema2 }),
  Struct({ type: Literal2("tool"), tool: ToolDefinition })
]).pipe(toTaggedUnion("type"));

class LLMRequest extends Class4("LLM.Request")({
  id: optional(String4),
  model: ModelSchema,
  system: ArraySchema(SystemPart),
  messages: ArraySchema(Message),
  tools: ArraySchema(ToolDefinition),
  toolChoice: optional(ToolChoice),
  generation: optional(GenerationOptions),
  providerOptions: optional(ProviderOptions),
  http: optional(HttpOptions),
  responseFormat: optional(ResponseFormat),
  cache: optional(CachePolicy),
  metadata: optional(Record(String4, Unknown2))
}) {
}
((LLMRequest2) => {
  LLMRequest2.input = (request) => ({
    id: request.id,
    model: request.model,
    system: request.system,
    messages: request.messages,
    tools: request.tools,
    toolChoice: request.toolChoice,
    generation: request.generation,
    providerOptions: request.providerOptions,
    http: request.http,
    responseFormat: request.responseFormat,
    cache: request.cache,
    metadata: request.metadata
  });
  LLMRequest2.update = (request, patch) => {
    if (Object.keys(patch).length === 0)
      return request;
    return new LLMRequest({
      ...LLMRequest2.input(request),
      ...patch,
      model: patch.model ?? request.model
    });
  };
})(LLMRequest ||= {});
// packages/llm/src/schema/errors.ts
var ProviderFailureClassification = Literal2("context-overflow");

class HttpRequestDetails extends Class4("LLM.HttpRequestDetails")({
  method: String4,
  url: String4,
  headers: Record(String4, String4)
}) {
}

class HttpResponseDetails extends Class4("LLM.HttpResponseDetails")({
  status: Number5,
  headers: Record(String4, String4)
}) {
}

class HttpRateLimitDetails extends Class4("LLM.HttpRateLimitDetails")({
  retryAfterMs: optional(Number5),
  limit: optional(Record(String4, String4)),
  remaining: optional(Record(String4, String4)),
  reset: optional(Record(String4, String4))
}) {
}

class HttpContext extends Class4("LLM.HttpContext")({
  request: HttpRequestDetails,
  response: optional(HttpResponseDetails),
  body: optional(String4),
  bodyTruncated: optional(Boolean3),
  requestId: optional(String4),
  rateLimit: optional(HttpRateLimitDetails)
}) {
}

class InvalidRequestReason extends Class4("LLM.Error.InvalidRequest")({
  _tag: tag("InvalidRequest"),
  message: String4,
  parameter: optional(String4),
  classification: optional(ProviderFailureClassification),
  providerMetadata: optional(ProviderMetadata),
  http: optional(HttpContext)
}) {
  get retryable() {
    return false;
  }
}

class NoRouteReason extends Class4("LLM.Error.NoRoute")({
  _tag: tag("NoRoute"),
  route: RouteID,
  provider: ProviderID,
  model: ModelID
}) {
  get retryable() {
    return false;
  }
  get message() {
    return `No LLM route for ${this.provider}/${this.model} using ${this.route}`;
  }
}

class AuthenticationReason extends Class4("LLM.Error.Authentication")({
  _tag: tag("Authentication"),
  message: String4,
  kind: Literals(["missing", "invalid", "expired", "insufficient-permissions", "unknown"]),
  providerMetadata: optional(ProviderMetadata),
  http: optional(HttpContext)
}) {
  get retryable() {
    return false;
  }
}

class RateLimitReason extends Class4("LLM.Error.RateLimit")({
  _tag: tag("RateLimit"),
  message: String4,
  retryAfterMs: optional(Number5),
  rateLimit: optional(HttpRateLimitDetails),
  providerMetadata: optional(ProviderMetadata),
  http: optional(HttpContext)
}) {
  get retryable() {
    return true;
  }
}

class QuotaExceededReason extends Class4("LLM.Error.QuotaExceeded")({
  _tag: tag("QuotaExceeded"),
  message: String4,
  providerMetadata: optional(ProviderMetadata),
  http: optional(HttpContext)
}) {
  get retryable() {
    return false;
  }
}

class ContentPolicyReason extends Class4("LLM.Error.ContentPolicy")({
  _tag: tag("ContentPolicy"),
  message: String4,
  providerMetadata: optional(ProviderMetadata),
  http: optional(HttpContext)
}) {
  get retryable() {
    return false;
  }
}

class ProviderInternalReason extends Class4("LLM.Error.ProviderInternal")({
  _tag: tag("ProviderInternal"),
  message: String4,
  status: Number5,
  retryAfterMs: optional(Number5),
  providerMetadata: optional(ProviderMetadata),
  http: optional(HttpContext)
}) {
  get retryable() {
    return true;
  }
}

class TransportReason extends Class4("LLM.Error.Transport")({
  _tag: tag("Transport"),
  message: String4,
  kind: optional(String4),
  url: optional(String4),
  http: optional(HttpContext)
}) {
  get retryable() {
    return false;
  }
}

class InvalidProviderOutputReason extends Class4("LLM.Error.InvalidProviderOutput")({
  _tag: tag("InvalidProviderOutput"),
  message: String4,
  route: optional(String4),
  raw: optional(String4),
  providerMetadata: optional(ProviderMetadata)
}) {
  get retryable() {
    return false;
  }
}

class UnknownProviderReason extends Class4("LLM.Error.UnknownProvider")({
  _tag: tag("UnknownProvider"),
  message: String4,
  status: optional(Number5),
  providerMetadata: optional(ProviderMetadata),
  http: optional(HttpContext)
}) {
  get retryable() {
    return false;
  }
}
var LLMErrorReason = Union2([
  InvalidRequestReason,
  NoRouteReason,
  AuthenticationReason,
  RateLimitReason,
  QuotaExceededReason,
  ContentPolicyReason,
  ProviderInternalReason,
  TransportReason,
  InvalidProviderOutputReason,
  UnknownProviderReason
]).pipe(toTaggedUnion("_tag"));

class LLMError extends TaggedErrorClass()("LLM.Error", {
  module: String4,
  method: String4,
  reason: LLMErrorReason
}) {
  cause = this.reason;
  get retryable() {
    return this.reason.retryable;
  }
  get retryAfterMs() {
    return "retryAfterMs" in this.reason ? this.reason.retryAfterMs : undefined;
  }
  get message() {
    return `${this.module}.${this.method}: ${this.reason.message}`;
  }
}

class ToolFailure extends TaggedErrorClass()("LLM.ToolFailure", {
  message: String4,
  error: optional(Defect()),
  metadata: optional(Record(String4, Unknown2))
}) {
}

// packages/llm/src/schema/events.ts
class Usage extends Class4("LLM.Usage")({
  inputTokens: optional(Number5),
  outputTokens: optional(Number5),
  nonCachedInputTokens: optional(Number5),
  cacheReadInputTokens: optional(Number5),
  cacheWriteInputTokens: optional(Number5),
  reasoningTokens: optional(Number5),
  totalTokens: optional(Number5),
  providerMetadata: optional(ProviderMetadata)
}) {
  get visibleOutputTokens() {
    return Math.max(0, (this.outputTokens ?? 0) - (this.reasoningTokens ?? 0));
  }
  static from(input) {
    return input instanceof Usage ? input : new Usage(input);
  }
}
var StepStart = Struct({
  type: tag("step-start"),
  index: Number5
}).annotate({ identifier: "LLM.Event.StepStart" });
var TextStart = Struct({
  type: tag("text-start"),
  id: ContentBlockID,
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Event.TextStart" });
var TextDelta = Struct({
  type: tag("text-delta"),
  id: ContentBlockID,
  text: String4,
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Event.TextDelta" });
var TextEnd = Struct({
  type: tag("text-end"),
  id: ContentBlockID,
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Event.TextEnd" });
var ReasoningStart = Struct({
  type: tag("reasoning-start"),
  id: ContentBlockID,
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Event.ReasoningStart" });
var ReasoningDelta = Struct({
  type: tag("reasoning-delta"),
  id: ContentBlockID,
  text: String4,
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Event.ReasoningDelta" });
var ReasoningEnd = Struct({
  type: tag("reasoning-end"),
  id: ContentBlockID,
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Event.ReasoningEnd" });
var ToolInputStart = Struct({
  type: tag("tool-input-start"),
  id: ToolCallID,
  name: String4,
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Event.ToolInputStart" });
var ToolInputDelta = Struct({
  type: tag("tool-input-delta"),
  id: ToolCallID,
  name: String4,
  text: String4
}).annotate({ identifier: "LLM.Event.ToolInputDelta" });
var ToolInputEnd = Struct({
  type: tag("tool-input-end"),
  id: ToolCallID,
  name: String4,
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Event.ToolInputEnd" });
var ToolCall = Struct({
  type: tag("tool-call"),
  id: ToolCallID,
  name: String4,
  input: Unknown2,
  providerExecuted: optional(Boolean3),
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Event.ToolCall" });
var ToolResult = Struct({
  type: tag("tool-result"),
  id: ToolCallID,
  name: String4,
  result: ToolResultValue,
  output: optional(ToolOutput),
  providerExecuted: optional(Boolean3),
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Event.ToolResult" });
var ToolError = Struct({
  type: tag("tool-error"),
  id: ToolCallID,
  name: String4,
  message: String4,
  error: optional(Defect()),
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Event.ToolError" });
var StepFinish = Struct({
  type: tag("step-finish"),
  index: Number5,
  reason: FinishReason,
  usage: optional(Usage),
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Event.StepFinish" });
var Finish = Struct({
  type: tag("finish"),
  reason: FinishReason,
  usage: optional(Usage),
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Event.Finish" });
var ProviderErrorEvent = Struct({
  type: tag("provider-error"),
  message: String4,
  classification: optional(ProviderFailureClassification),
  retryable: optional(Boolean3),
  providerMetadata: optional(ProviderMetadata)
}).annotate({ identifier: "LLM.Event.ProviderError" });
var llmEventTagged = Union2([
  StepStart,
  TextStart,
  TextDelta,
  TextEnd,
  ReasoningStart,
  ReasoningDelta,
  ReasoningEnd,
  ToolInputStart,
  ToolInputDelta,
  ToolInputEnd,
  ToolCall,
  ToolResult,
  ToolError,
  StepFinish,
  Finish,
  ProviderErrorEvent
]).pipe(toTaggedUnion("type"));
var contentBlockID = (value) => ContentBlockID.make(value);
var toolCallID = (value) => ToolCallID.make(value);
var LLMEvent = Object.assign(llmEventTagged, {
  stepStart: StepStart.make,
  textStart: (input) => TextStart.make({ ...input, id: contentBlockID(input.id) }),
  textDelta: (input) => TextDelta.make({ ...input, id: contentBlockID(input.id) }),
  textEnd: (input) => TextEnd.make({ ...input, id: contentBlockID(input.id) }),
  reasoningStart: (input) => ReasoningStart.make({ ...input, id: contentBlockID(input.id) }),
  reasoningDelta: (input) => ReasoningDelta.make({ ...input, id: contentBlockID(input.id) }),
  reasoningEnd: (input) => ReasoningEnd.make({ ...input, id: contentBlockID(input.id) }),
  toolInputStart: (input) => ToolInputStart.make({ ...input, id: toolCallID(input.id) }),
  toolInputDelta: (input) => ToolInputDelta.make({ ...input, id: toolCallID(input.id) }),
  toolInputEnd: (input) => ToolInputEnd.make({ ...input, id: toolCallID(input.id) }),
  toolCall: (input) => ToolCall.make({ ...input, id: toolCallID(input.id) }),
  toolResult: (input) => ToolResult.make({
    ...input,
    id: toolCallID(input.id),
    output: input.output === undefined ? undefined : ToolOutput.make(input.output.structured, input.output.content)
  }),
  toolError: (input) => ToolError.make({ ...input, id: toolCallID(input.id) }),
  stepFinish: (input) => StepFinish.make({
    ...input,
    usage: input.usage === undefined ? undefined : Usage.from(input.usage)
  }),
  finish: (input) => Finish.make({
    ...input,
    usage: input.usage === undefined ? undefined : Usage.from(input.usage)
  }),
  providerError: ProviderErrorEvent.make,
  is: {
    stepStart: llmEventTagged.guards["step-start"],
    textStart: llmEventTagged.guards["text-start"],
    textDelta: llmEventTagged.guards["text-delta"],
    textEnd: llmEventTagged.guards["text-end"],
    reasoningStart: llmEventTagged.guards["reasoning-start"],
    reasoningDelta: llmEventTagged.guards["reasoning-delta"],
    reasoningEnd: llmEventTagged.guards["reasoning-end"],
    toolInputStart: llmEventTagged.guards["tool-input-start"],
    toolInputDelta: llmEventTagged.guards["tool-input-delta"],
    toolInputEnd: llmEventTagged.guards["tool-input-end"],
    toolCall: llmEventTagged.guards["tool-call"],
    toolResult: llmEventTagged.guards["tool-result"],
    toolError: llmEventTagged.guards["tool-error"],
    stepFinish: llmEventTagged.guards["step-finish"],
    finish: llmEventTagged.guards.finish,
    providerError: llmEventTagged.guards["provider-error"]
  }
});

class PreparedRequest extends Class4("LLM.PreparedRequest")({
  id: String4,
  route: RouteID,
  protocol: ProtocolID,
  model: ModelSchema,
  body: Unknown2,
  metadata: optional(Record(String4, Unknown2))
}) {
}
var responseText = (events) => events.filter(LLMEvent.is.textDelta).map((event) => event.text).join("");
var responseReasoning = (events) => events.filter(LLMEvent.is.reasoningDelta).map((event) => event.text).join("");
var responseUsage = (events) => events.reduce((usage, event) => ("usage" in event) && event.usage !== undefined ? event.usage : usage, undefined);
var emptyResponseState = () => ({
  events: [],
  message: Message.assistant([]),
  textParts: {},
  reasoningParts: {},
  toolInputs: {}
});
var appendEvent = (state, event) => {
  const events = [...state.events, event];
  if (LLMEvent.is.finish(event)) {
    return {
      ...state,
      events,
      usage: event.usage ?? state.usage,
      finishReason: event.reason
    };
  }
  if (LLMEvent.is.providerError(event)) {
    return {
      ...state,
      events,
      finishReason: state.finishReason ?? "error"
    };
  }
  return {
    ...state,
    events,
    usage: "usage" in event && event.usage !== undefined ? event.usage : state.usage
  };
};
var textContent = (text, providerMetadata) => providerMetadata === undefined ? { type: "text", text } : { type: "text", text, providerMetadata };
var reasoningContent = (text, providerMetadata) => providerMetadata === undefined ? { type: "reasoning", text } : { type: "reasoning", text, providerMetadata };
var contentWith = (state, content) => ({
  ...state,
  message: Message.assistant(content)
});
var appendContent = (state, part) => contentWith(state, [...state.message.content, part]);
var replaceContent = (state, index, part) => contentWith(state, state.message.content.map((item, itemIndex) => itemIndex === index ? part : item));
var ensureText = (state, id, providerMetadata) => {
  if (state.textParts[id])
    return state;
  return {
    ...appendContent(state, textContent("", providerMetadata)),
    textParts: {
      ...state.textParts,
      [id]: { contentIndex: state.message.content.length, text: "", providerMetadata }
    }
  };
};
var reduceTextDelta = (state, event) => {
  const started = ensureText(state, event.id, event.providerMetadata);
  const current = started.textParts[event.id];
  if (!current)
    return started;
  const text = current.text + event.text;
  const providerMetadata = event.providerMetadata ?? current.providerMetadata;
  return {
    ...replaceContent(started, current.contentIndex, textContent(text, providerMetadata)),
    textParts: { ...started.textParts, [event.id]: { ...current, text, providerMetadata } }
  };
};
var reduceTextEnd = (state, event) => {
  const current = state.textParts[event.id];
  if (!current)
    return state;
  const providerMetadata = event.providerMetadata ?? current.providerMetadata;
  return {
    ...replaceContent(state, current.contentIndex, textContent(current.text, providerMetadata)),
    textParts: { ...state.textParts, [event.id]: { ...current, providerMetadata } }
  };
};
var ensureReasoning = (state, id, providerMetadata) => {
  if (state.reasoningParts[id])
    return state;
  return {
    ...appendContent(state, reasoningContent("", providerMetadata)),
    reasoningParts: {
      ...state.reasoningParts,
      [id]: { contentIndex: state.message.content.length, text: "", providerMetadata }
    }
  };
};
var reduceReasoningDelta = (state, event) => {
  const started = ensureReasoning(state, event.id, event.providerMetadata);
  const current = started.reasoningParts[event.id];
  if (!current)
    return started;
  const text = current.text + event.text;
  const providerMetadata = event.providerMetadata ?? current.providerMetadata;
  return {
    ...replaceContent(started, current.contentIndex, reasoningContent(text, providerMetadata)),
    reasoningParts: { ...started.reasoningParts, [event.id]: { ...current, text, providerMetadata } }
  };
};
var reduceReasoningEnd = (state, event) => {
  const current = state.reasoningParts[event.id];
  if (!current)
    return state;
  const providerMetadata = event.providerMetadata ?? current.providerMetadata;
  return {
    ...replaceContent(state, current.contentIndex, reasoningContent(current.text, providerMetadata)),
    reasoningParts: { ...state.reasoningParts, [event.id]: { ...current, providerMetadata } }
  };
};
var reduceToolInputStart = (state, event) => ({
  ...state,
  toolInputs: {
    ...state.toolInputs,
    [event.id]: { name: event.name, text: "", providerMetadata: event.providerMetadata }
  }
});
var reduceToolInputDelta = (state, event) => {
  const current = state.toolInputs[event.id] ?? { name: event.name, text: "" };
  return {
    ...state,
    toolInputs: { ...state.toolInputs, [event.id]: { ...current, text: current.text + event.text } }
  };
};
var reduceToolInputEnd = (state, event) => {
  const current = state.toolInputs[event.id] ?? { name: event.name, text: "" };
  return {
    ...state,
    toolInputs: {
      ...state.toolInputs,
      [event.id]: {
        ...current,
        name: event.name,
        providerMetadata: event.providerMetadata ?? current.providerMetadata
      }
    }
  };
};
var toolCallContent = (event) => ToolCallPart.make({
  id: event.id,
  name: event.name,
  input: event.input,
  ...event.providerExecuted === undefined ? {} : { providerExecuted: event.providerExecuted },
  ...event.providerMetadata === undefined ? {} : { providerMetadata: event.providerMetadata }
});
var toolResultContent = (event) => ToolResultPart.make({
  id: event.id,
  name: event.name,
  result: event.result,
  ...event.providerExecuted === undefined ? {} : { providerExecuted: event.providerExecuted },
  ...event.providerMetadata === undefined ? {} : { providerMetadata: event.providerMetadata }
});
var reduceToolCall = (state, event) => {
  const { [event.id]: _finished, ...toolInputs } = state.toolInputs;
  return { ...appendContent(state, toolCallContent(event)), toolInputs };
};
var reduceResponseState = (state, event) => {
  const next = appendEvent(state, event);
  switch (event.type) {
    case "text-start":
      return ensureText(next, event.id, event.providerMetadata);
    case "text-delta":
      return reduceTextDelta(next, event);
    case "text-end":
      return reduceTextEnd(next, event);
    case "reasoning-start":
      return ensureReasoning(next, event.id, event.providerMetadata);
    case "reasoning-delta":
      return reduceReasoningDelta(next, event);
    case "reasoning-end":
      return reduceReasoningEnd(next, event);
    case "tool-input-start":
      return reduceToolInputStart(next, event);
    case "tool-input-delta":
      return reduceToolInputDelta(next, event);
    case "tool-input-end":
      return reduceToolInputEnd(next, event);
    case "tool-call":
      return reduceToolCall(next, event);
    case "tool-result":
      return appendContent(next, toolResultContent(event));
    default:
      return next;
  }
};

class LLMResponse extends Class4("LLM.Response")({
  message: Message,
  events: ArraySchema(LLMEvent),
  usage: optional(Usage),
  finishReason: FinishReason
}) {
  get text() {
    return responseText(this.events);
  }
  get reasoning() {
    return responseReasoning(this.events);
  }
  get toolCalls() {
    return this.events.filter(LLMEvent.is.toolCall);
  }
}
((LLMResponse2) => {
  LLMResponse2.empty = emptyResponseState;
  LLMResponse2.reduce = reduceResponseState;
  LLMResponse2.complete = (state) => state.finishReason === undefined ? undefined : new LLMResponse({
    message: state.message,
    events: [...state.events],
    usage: state.usage,
    finishReason: state.finishReason
  });
  LLMResponse2.fromEvents = (events) => LLMResponse2.complete(events.reduce(LLMResponse2.reduce, LLMResponse2.empty()));
  LLMResponse2.text = (response) => responseText(response.events);
  LLMResponse2.usage = (response) => response.usage ?? responseUsage(response.events);
  LLMResponse2.toolCalls = (response) => response.events.filter(LLMEvent.is.toolCall);
  LLMResponse2.reasoning = (response) => responseReasoning(response.events);
})(LLMResponse ||= {});
// packages/llm/src/route/auth.ts
var auth = (apply) => {
  const self = {
    apply,
    andThen: (that) => auth((input) => apply(input).pipe(flatMap2((headers) => that.apply({ ...input, headers })))),
    orElse: (that) => auth((input) => apply(input).pipe(catch_2(() => that.apply(input)))),
    pipe: (f) => f(self)
  };
  return self;
};
var none3 = auth((input) => succeed6(input.headers));

// packages/llm/src/protocols/shared.ts
import { Buffer as Buffer2 } from "buffer";
var Json3 = fromJsonString2(Unknown2);
var decodeJson = decodeUnknownSync(Json3);
var encodeJson = encodeSync2(Json3);
var isJson2 = is2(Json2);
var JsonObject = Record(String4, Unknown2);
var eventError = (route, message, raw) => new LLMError({
  module: "ProviderShared",
  method: "stream",
  reason: new InvalidProviderOutputReason({ route, message, raw })
});
var joinText = (parts) => parts.map((part) => part.text).join(`
`);
var escapeSystemUpdateText = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
var wrapSystemUpdate = (parts) => `<system-update>
${escapeSystemUpdateText(joinText(parts))}
</system-update>`;
var systemUpdateText = fn2("ProviderShared.systemUpdateText")(function* (route, message) {
  const content = [];
  for (const part of message.content) {
    if (!supportsContent(part, ["text"]))
      return yield* unsupportedContent(route, "system", ["text"]);
    content.push(part);
  }
  return content;
});
var wrappedSystemUpdate = fn2("ProviderShared.wrappedSystemUpdate")(function* (route, message) {
  const content = yield* systemUpdateText(route, message);
  return { type: "text", text: wrapSystemUpdate(content), cache: content.at(-1)?.cache };
});
var IMAGE_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
var VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];
var AUDIO_MIMES = ["audio/wav", "audio/mp3", "audio/aiff", "audio/aac", "audio/ogg", "audio/flac"];
var MEDIA_MIMES = [...IMAGE_MIMES, ...VIDEO_MIMES, ...AUDIO_MIMES];
var MAX_MEDIA_ENCODED_BYTES = 28 * 1024 * 1024;
var MAX_MEDIA_DECODED_BYTES = 20 * 1024 * 1024;
var base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
var validateMedia = fn2("ProviderShared.validateMedia")(function* (route, part, supportedMimes) {
  const mime = part.mediaType.toLowerCase();
  if (!supportedMimes.has(mime))
    return yield* invalidRequest(`${route} does not support media type ${part.mediaType}`);
  let base64;
  if (typeof part.data !== "string") {
    if (part.data.byteLength > MAX_MEDIA_DECODED_BYTES)
      return yield* invalidRequest(`${route} media exceeds the ${MAX_MEDIA_DECODED_BYTES} byte decoded limit`);
    base64 = Buffer2.from(part.data).toString("base64");
  } else if (part.data.startsWith("data:")) {
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/s.exec(part.data);
    if (!match)
      return yield* invalidRequest(`${route} media data URL must contain valid base64`);
    if (match[1].toLowerCase() !== mime)
      return yield* invalidRequest(`${route} media type ${part.mediaType} does not match data URL type ${match[1]}`);
    base64 = match[2];
  } else {
    base64 = part.data;
  }
  if (Buffer2.byteLength(base64, "utf8") > MAX_MEDIA_ENCODED_BYTES)
    return yield* invalidRequest(`${route} media exceeds the ${MAX_MEDIA_ENCODED_BYTES} byte encoded limit`);
  if (!base64 || base64.length % 4 !== 0 || !base64Pattern.test(base64))
    return yield* invalidRequest(`${route} media must contain valid base64`);
  const bytes = Buffer2.from(base64, "base64");
  if (bytes.byteLength > MAX_MEDIA_DECODED_BYTES)
    return yield* invalidRequest(`${route} media exceeds the ${MAX_MEDIA_DECODED_BYTES} byte decoded limit`);
  if (bytes.toString("base64") !== base64)
    return yield* invalidRequest(`${route} media must contain canonical base64`);
  return { mime, base64, dataUrl: `data:${mime};base64,${base64}`, bytes };
});
var invalidRequest = (message) => new LLMError({
  module: "ProviderShared",
  method: "request",
  reason: new InvalidRequestReason({ message })
});
var formatContentTypes = (types) => {
  if (types.length <= 1)
    return types[0] ?? "";
  if (types.length === 2)
    return `${types[0]} and ${types[1]}`;
  return `${types.slice(0, -1).join(", ")}, and ${types.at(-1)}`;
};
var supportsContent = (part, types) => types.includes(part.type);
var unsupportedContent = (route, role, types) => invalidRequest(`${route} ${role} messages only support ${formatContentTypes(types)} content for now`);
var validateWith = (decode) => (payload) => decode(payload).pipe(mapError3((error) => invalidRequest(error.message)));
// packages/llm/src/provider-error.ts
var patterns = [
  /prompt is too long/i,
  /request_too_large/i,
  /input is too long for requested model/i,
  /exceeds the context window/i,
  /exceeds (?:the )?(?:model'?s )?maximum context length(?: of [\d,]+ tokens?|\s*\([\d,]+\))/i,
  /input token count.*exceeds the maximum/i,
  /tokens in request more than max tokens allowed/i,
  /maximum prompt length is \d+/i,
  /reduce the length of the messages/i,
  /maximum context length is \d+ tokens/i,
  /exceeds (?:the )?maximum allowed input length of [\d,]+ tokens?/i,
  /input \(\d+ tokens\) is longer than the model'?s context length \(\d+ tokens\)/i,
  /exceeds the limit of \d+/i,
  /exceeds the available context size/i,
  /greater than the context length/i,
  /context window exceeds limit/i,
  /exceeded model token limit/i,
  /context[_ ]length[_ ]exceeded/i,
  /request entity too large/i,
  /context length is only \d+ tokens/i,
  /input length.*exceeds.*context length/i,
  /prompt too long; exceeded (?:max )?context length/i,
  /too large for model with \d+ maximum context length/i,
  /prompt has [\d,]+ tokens?, but the configured context size is [\d,]+ tokens?/i,
  /model_context_window_exceeded/i,
  /too many tokens/i,
  /token limit exceeded/i
];
var exclusions = [/^(throttling error|service unavailable):/i, /rate limit/i, /too many requests/i];
var isContextOverflow = (message) => !exclusions.some((pattern) => pattern.test(message)) && (patterns.some((pattern) => pattern.test(message)) || /^4(00|13)\s*(status code)?\s*\(no body\)/i.test(message));

// packages/llm/src/route/executor.ts
class Service2 extends Service()("@opencode/LLM/RequestExecutor") {
}
var BODY_LIMIT = 16384;
var MAX_RETRIES = 2;
var BASE_DELAY_MS = 500;
var MAX_DELAY_MS = 1e4;
var REDACTED = "<redacted>";
var SENSITIVE_NAME_SOURCE = "authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|token|secret|credential|signature|x-amz-signature";
var SENSITIVE_NAME = new RegExp(SENSITIVE_NAME_SOURCE, "i");
var SHORT_QUERY_NAME = /^(key|sig)$/i;
var SENSITIVE_BODY_FIELD = new RegExp(`(?:${SENSITIVE_NAME_SOURCE}|key)`, "i");
var REDACT_JSON_FIELD = new RegExp(`("(?:${SENSITIVE_BODY_FIELD.source})"\\s*:\\s*)"[^"]*"`, "gi");
var REDACT_QUERY_FIELD = new RegExp(`((?:${SENSITIVE_BODY_FIELD.source})=)[^&\\s"]+`, "gi");
var isSensitiveHeaderName = (name) => SENSITIVE_NAME.test(name);
var isSensitiveQueryName = (name) => isSensitiveHeaderName(name) || SHORT_QUERY_NAME.test(name);
var redactHeaders = (headers, redactedNames) => Object.fromEntries(Object.entries(redact3(headers, [...redactedNames, SENSITIVE_NAME])).map(([name, value]) => [
  name,
  String(value)
]));
var redactUrl = (value) => {
  if (!URL.canParse(value))
    return REDACTED;
  const url = new URL(value);
  url.searchParams.forEach((_, key) => {
    if (isSensitiveQueryName(key))
      url.searchParams.set(key, REDACTED);
  });
  return url.toString();
};
var normalizedHeaders = (headers) => Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
var requestId = (headers) => {
  return headers["x-request-id"] ?? headers["request-id"] ?? headers["x-amzn-requestid"] ?? headers["x-amz-request-id"] ?? headers["x-goog-request-id"] ?? headers["cf-ray"];
};
var retryableStatus = (status) => status === 429 || status === 503 || status === 504 || status === 529;
var retryAfterMs = (headers) => {
  const millis = Number(headers["retry-after-ms"]);
  if (Number.isFinite(millis))
    return Math.max(0, millis);
  const value = headers["retry-after"];
  if (!value)
    return;
  const seconds = Number(value);
  if (Number.isFinite(seconds))
    return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  if (!Number.isNaN(date))
    return Math.max(0, date - Date.now());
  return;
};
var addRateLimitValue = (target, key, value) => {
  if (key.length > 0)
    target[key] = value;
};
var rateLimitDetails = (headers, retryAfter) => {
  const limit = {};
  const remaining = {};
  const reset = {};
  Object.entries(headers).forEach(([name, value]) => {
    const openaiLimit = /^x-ratelimit-limit-(.+)$/.exec(name)?.[1];
    if (openaiLimit)
      return addRateLimitValue(limit, openaiLimit, value);
    const openaiRemaining = /^x-ratelimit-remaining-(.+)$/.exec(name)?.[1];
    if (openaiRemaining)
      return addRateLimitValue(remaining, openaiRemaining, value);
    const openaiReset = /^x-ratelimit-reset-(.+)$/.exec(name)?.[1];
    if (openaiReset)
      return addRateLimitValue(reset, openaiReset, value);
    const anthropic = /^anthropic-ratelimit-(.+)-(limit|remaining|reset)$/.exec(name);
    if (!anthropic)
      return;
    if (anthropic[2] === "limit")
      return addRateLimitValue(limit, anthropic[1], value);
    if (anthropic[2] === "remaining")
      return addRateLimitValue(remaining, anthropic[1], value);
    return addRateLimitValue(reset, anthropic[1], value);
  });
  if (retryAfter === undefined && Object.keys(limit).length === 0 && Object.keys(remaining).length === 0 && Object.keys(reset).length === 0)
    return;
  return new HttpRateLimitDetails({
    retryAfterMs: retryAfter,
    limit: Object.keys(limit).length === 0 ? undefined : limit,
    remaining: Object.keys(remaining).length === 0 ? undefined : remaining,
    reset: Object.keys(reset).length === 0 ? undefined : reset
  });
};
var requestDetails = (request, redactedNames) => new HttpRequestDetails({
  method: request.method,
  url: redactUrl(request.url),
  headers: redactHeaders(request.headers, redactedNames)
});
var responseDetails = (response, redactedNames) => new HttpResponseDetails({
  status: response.status,
  headers: redactHeaders(response.headers, redactedNames)
});
var secretValues = (request) => {
  const values = new Set;
  const add = (value) => {
    if (value.length < 4)
      return;
    values.add(value);
    values.add(encodeURIComponent(value));
  };
  Object.entries(request.headers).forEach(([name, value]) => {
    if (!isSensitiveHeaderName(name))
      return;
    add(value);
    const bearer = /^Bearer\s+(.+)$/i.exec(value)?.[1];
    if (bearer)
      add(bearer);
  });
  if (!URL.canParse(request.url))
    return values;
  new URL(request.url).searchParams.forEach((value, key) => {
    if (isSensitiveQueryName(key))
      add(value);
  });
  return values;
};
var redactBody = (body, request) => Array.from(secretValues(request)).reduce((text, secret) => text.split(secret).join(REDACTED), body.replace(REDACT_JSON_FIELD, `$1"${REDACTED}"`).replace(REDACT_QUERY_FIELD, `$1${REDACTED}`));
var responseBody = (body, request) => {
  if (body === undefined)
    return {};
  const redacted = redactBody(body, request);
  if (redacted.length <= BODY_LIMIT)
    return { body: redacted };
  return { body: redacted.slice(0, BODY_LIMIT), bodyTruncated: true };
};
var providerMessage = (status, body) => {
  if (body.body && body.body.length <= 500)
    return `Provider request failed with HTTP ${status}: ${body.body}`;
  return `Provider request failed with HTTP ${status}`;
};
var responseHttp = (input) => new HttpContext({
  request: requestDetails(input.request, input.redactedNames),
  response: responseDetails(input.response, input.redactedNames),
  ...input.body,
  requestId: input.requestId,
  rateLimit: input.rateLimit
});
var statusReason = (input) => {
  const body = input.http.body ?? "";
  if (/content[-_\s]?policy|content_filter|safety/i.test(body)) {
    return new ContentPolicyReason({ message: input.message, http: input.http });
  }
  if (input.status === 401) {
    return new AuthenticationReason({ message: input.message, kind: "invalid", http: input.http });
  }
  if (input.status === 403) {
    return new AuthenticationReason({ message: input.message, kind: "insufficient-permissions", http: input.http });
  }
  if (input.status === 429) {
    if (/insufficient[-_\s]?quota|quota[-_\s]?exceeded/i.test(body)) {
      return new QuotaExceededReason({ message: input.message, http: input.http });
    }
    return new RateLimitReason({
      message: input.message,
      retryAfterMs: input.retryAfterMs,
      rateLimit: input.rateLimit,
      http: input.http
    });
  }
  if (input.status === 400 || input.status === 404 || input.status === 409 || input.status === 413 || input.status === 422) {
    return new InvalidRequestReason({
      message: input.message,
      classification: isContextOverflow(body) ? "context-overflow" : undefined,
      http: input.http
    });
  }
  if (input.status >= 500 || retryableStatus(input.status)) {
    return new ProviderInternalReason({
      message: input.message,
      status: input.status,
      retryAfterMs: input.retryAfterMs,
      http: input.http
    });
  }
  return new UnknownProviderReason({ message: input.message, status: input.status, http: input.http });
};
var statusError = (request, redactedNames) => (response) => gen2(function* () {
  if (response.status < 400)
    return response;
  const body = yield* response.text.pipe(catch_2(() => void_3));
  const headers = normalizedHeaders(response.headers);
  const retryAfter = retryAfterMs(headers);
  const rateLimit = rateLimitDetails(headers, retryAfter);
  const details = responseBody(body, request);
  return yield* new LLMError({
    module: "RequestExecutor",
    method: "execute",
    reason: statusReason({
      status: response.status,
      message: providerMessage(response.status, details),
      retryAfterMs: retryAfter,
      rateLimit,
      http: responseHttp({
        request,
        response,
        redactedNames,
        body: details,
        requestId: requestId(headers),
        rateLimit
      })
    })
  });
});
var toHttpError = (redactedNames) => (error) => {
  const transportError = (input) => new LLMError({
    module: "RequestExecutor",
    method: "execute",
    reason: new TransportReason({
      message: input.message,
      kind: input.kind,
      url: input.request ? redactUrl(input.request.url) : undefined,
      http: input.request ? new HttpContext({ request: requestDetails(input.request, redactedNames) }) : undefined
    })
  });
  if (isTimeoutError2(error)) {
    return transportError({ message: error.message, kind: "Timeout" });
  }
  if (!isHttpClientError(error)) {
    return transportError({ message: "HTTP transport failed" });
  }
  const request = "request" in error ? error.request : undefined;
  if (error.reason._tag === "TransportError") {
    return transportError({
      message: error.reason.description ?? "HTTP transport failed",
      kind: error.reason._tag,
      request
    });
  }
  return transportError({
    message: `HTTP transport failed: ${error.reason._tag}`,
    kind: error.reason._tag,
    request
  });
};
var retryDelay = (error, attempt) => {
  if (error.retryAfterMs !== undefined)
    return succeed6(Math.min(error.retryAfterMs, MAX_DELAY_MS));
  return nextBetween(Math.min(BASE_DELAY_MS * 2 ** attempt * 0.8, MAX_DELAY_MS), Math.min(BASE_DELAY_MS * 2 ** attempt * 1.2, MAX_DELAY_MS)).pipe(map5((delay) => Math.round(delay)));
};
var retryStatusFailures = (effect2, retries = MAX_RETRIES, attempt = 0) => catchTag2(effect2, "LLM.Error", (error) => {
  if (!error.retryable || retries <= 0)
    return fail6(error);
  return retryDelay(error, attempt).pipe(flatMap2((delay) => sleep2(delay)), flatMap2(() => retryStatusFailures(effect2, retries - 1, attempt + 1)));
});
var layer2 = effect(Service2, gen2(function* () {
  const http = yield* HttpClient;
  const executeOnce = (request) => gen2(function* () {
    const redactedNames = yield* CurrentRedactedNames;
    return yield* http.execute(request).pipe(mapError3(toHttpError(redactedNames)), flatMap2(statusError(request, redactedNames)));
  });
  return Service2.of({
    execute: (request) => retryStatusFailures(executeOnce(request))
  });
}));
var fetchLayer = layer2.pipe(provide2(layer));
// packages/llm/src/route/transport/http.ts
var PROTOCOL_BODY_OVERLAY_DENYLIST = new Set([
  "content",
  "contents",
  "frequencyPenalty",
  "frequency_penalty",
  "generationConfig",
  "inferenceConfig",
  "input",
  "maxTokens",
  "max_tokens",
  "messages",
  "model",
  "presencePenalty",
  "presence_penalty",
  "responseFormat",
  "response_format",
  "seed",
  "stop",
  "stopSequences",
  "stop_sequences",
  "stream",
  "streamOptions",
  "stream_options",
  "system",
  "systemInstruction",
  "system_instruction",
  "temperature",
  "thinking",
  "toolChoice",
  "toolConfig",
  "tool_choice",
  "tool_config",
  "tools",
  "topK",
  "topP",
  "top_k",
  "top_p"
]);
// packages/llm/src/route/transport/websocket.ts
class Service3 extends Service()("@opencode/LLM/WebSocketExecutor") {
}
var transportError = (method, message, input = {}) => new LLMError({
  module: "WebSocketExecutor",
  method,
  reason: new TransportReason({ message, url: input.url, kind: input.kind })
});
var eventMessage = (event) => {
  if ("message" in event && typeof event.message === "string")
    return event.message;
  return event.type;
};
var binaryMessage = (data) => {
  if (data instanceof Uint8Array)
    return data;
  if (data instanceof ArrayBuffer)
    return new Uint8Array(data);
  if (ArrayBuffer.isView(data))
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return;
};
var waitOpen = (ws, input) => {
  if (ws.readyState === globalThis.WebSocket.OPEN)
    return void_3;
  if (ws.readyState === globalThis.WebSocket.CLOSING || ws.readyState === globalThis.WebSocket.CLOSED) {
    return fail6(transportError("open", `WebSocket closed before opening (state ${ws.readyState})`, {
      url: input.url,
      kind: "open"
    }));
  }
  return callback2((resume, signal) => {
    const cleanup = () => {
      ws.removeEventListener("open", onOpen);
      ws.removeEventListener("error", onError);
      ws.removeEventListener("close", onClose);
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      if (ws.readyState !== globalThis.WebSocket.CLOSED && ws.readyState !== globalThis.WebSocket.CLOSING)
        ws.close(1000);
    };
    const onOpen = () => {
      cleanup();
      resume(void_3);
    };
    const onError = (event) => {
      cleanup();
      resume(fail6(transportError("open", `Failed to open WebSocket: ${eventMessage(event)}`, { url: input.url, kind: "open" })));
    };
    const onClose = (event) => {
      cleanup();
      resume(fail6(transportError("open", `WebSocket closed before opening with code ${event.code}`, {
        url: input.url,
        kind: "open"
      })));
    };
    ws.addEventListener("open", onOpen, { once: true });
    ws.addEventListener("error", onError, { once: true });
    ws.addEventListener("close", onClose, { once: true });
    signal.addEventListener("abort", onAbort, { once: true });
  });
};
var open = (input) => try_2({
  try: () => new globalThis.WebSocket(input.url, { headers: input.headers }),
  catch: (error) => transportError("open", error instanceof Error ? error.message : "Failed to construct WebSocket", {
    url: input.url,
    kind: "open"
  })
}).pipe(flatMap2((ws) => fromWebSocket(ws, input)));
var layer3 = succeed5(Service3, Service3.of({ open }));
var fromWebSocket = (ws, input) => gen2(function* () {
  yield* waitOpen(ws, input);
  const messages = yield* bounded(128);
  const onMessage = (event) => {
    if (typeof event.data === "string")
      return offerUnsafe(messages, event.data);
    const binary = binaryMessage(event.data);
    if (binary)
      return offerUnsafe(messages, binary);
    failCauseUnsafe(messages, fail4(transportError("message", "Unsupported WebSocket message payload", { url: input.url, kind: "message" })));
  };
  const onError = (event) => {
    failCauseUnsafe(messages, fail4(transportError("message", `WebSocket error: ${eventMessage(event)}`, { url: input.url, kind: "message" })));
  };
  const onClose = (event) => {
    if (event.code === 1000 || event.code === 1005)
      return endUnsafe(messages);
    failCauseUnsafe(messages, fail4(transportError("message", `WebSocket closed with code ${event.code}`, { url: input.url, kind: "close" })));
  };
  const cleanup = sync2(() => {
    ws.removeEventListener("message", onMessage);
    ws.removeEventListener("error", onError);
    ws.removeEventListener("close", onClose);
  }).pipe(andThen2(shutdown(messages)));
  ws.addEventListener("message", onMessage);
  ws.addEventListener("error", onError);
  ws.addEventListener("close", onClose);
  return {
    sendText: (message) => try_2({
      try: () => ws.send(message),
      catch: (error) => transportError("sendText", error instanceof Error ? error.message : "Failed to send WebSocket message", {
        url: input.url,
        kind: "write"
      })
    }),
    messages: fromQueue(messages),
    close: cleanup.pipe(andThen2(sync2(() => {
      if (ws.readyState === globalThis.WebSocket.CLOSED || ws.readyState === globalThis.WebSocket.CLOSING)
        return;
      ws.close(1000);
    })))
  };
});
var messageText = (message, decoder) => typeof message === "string" ? message : decoder.decode(message);
var WebSocketExecutor = {
  Service: Service3,
  layer: layer3,
  open,
  fromWebSocket,
  messageText
};
// packages/llm/src/cache-policy.ts
var AUTO = {
  tools: true,
  system: true,
  messages: "latest-user-message"
};
var NONE = {};
var resolve2 = (policy) => {
  if (policy === undefined || policy === "auto")
    return AUTO;
  if (policy === "none")
    return NONE;
  return policy;
};
var RESPECTS_INLINE_HINTS = new Set(["anthropic-messages", "bedrock-converse"]);
var makeHint = (ttlSeconds) => ttlSeconds !== undefined ? new CacheHint({ type: "ephemeral", ttlSeconds }) : new CacheHint({ type: "ephemeral" });
var markLastTool = (tools, hint) => {
  if (tools.length === 0)
    return tools;
  const last = tools.length - 1;
  if (tools[last].cache)
    return tools;
  return tools.map((tool, i) => i === last ? new ToolDefinition({ ...tool, cache: hint }) : tool);
};
var markLastSystem = (system, hint) => {
  if (system.length === 0)
    return system;
  const last = system.length - 1;
  if (system[last].cache)
    return system;
  return system.map((part, i) => i === last ? { ...part, cache: hint } : part);
};
var lastIndexOfRole = (messages, role) => messages.findLastIndex((m) => m.role === role);
var markMessageAt = (messages, index, hint) => {
  if (index < 0 || index >= messages.length)
    return messages;
  const target = messages[index];
  if (target.content.length === 0)
    return messages;
  const lastTextIndex = target.content.findLastIndex((part) => part.type === "text");
  const markAt = lastTextIndex >= 0 ? lastTextIndex : target.content.length - 1;
  const existing = target.content[markAt];
  if ("cache" in existing && existing.cache)
    return messages;
  const nextContent = target.content.map((part, i) => i === markAt ? { ...part, cache: hint } : part);
  const next = new Message({ ...target, content: nextContent });
  const result = messages.slice();
  result[index] = next;
  return result;
};
var markMessages = (messages, strategy, hint) => {
  if (messages.length === 0)
    return messages;
  if (strategy === "latest-user-message")
    return markMessageAt(messages, lastIndexOfRole(messages, "user"), hint);
  if (strategy === "latest-assistant")
    return markMessageAt(messages, lastIndexOfRole(messages, "assistant"), hint);
  const start = Math.max(0, messages.length - strategy.tail);
  let next = messages;
  for (let i = start;i < messages.length; i++)
    next = markMessageAt(next, i, hint);
  return next;
};
var applyCachePolicy = (request) => {
  if (!RESPECTS_INLINE_HINTS.has(request.model.route.id))
    return request;
  const policy = resolve2(request.cache);
  if (!policy.tools && !policy.system && !policy.messages)
    return request;
  const hint = makeHint(policy.ttlSeconds);
  const tools = policy.tools ? markLastTool(request.tools, hint) : request.tools;
  const system = policy.system ? markLastSystem(request.system, hint) : request.system;
  const messages = policy.messages ? markMessages(request.messages, policy.messages, hint) : request.messages;
  if (tools === request.tools && system === request.system && messages === request.messages)
    return request;
  return LLMRequest.update(request, { tools, system, messages });
};

// packages/llm/src/route/client.ts
class Service4 extends Service()("@opencode/LLMClient") {
}
var resolveRequestOptions = (request) => {
  const routeDefaults = request.model.route.defaults;
  const modelDefaults = request.model.defaults;
  const generation = mergeGenerationOptions(routeDefaults.generation, modelDefaults?.generation, request.generation);
  return LLMRequest.update(request, {
    generation: generation ?? new GenerationOptions({}),
    providerOptions: mergeProviderOptions(routeDefaults.providerOptions, modelDefaults?.providerOptions, request.providerOptions),
    http: mergeHttpOptions(routeDefaults.http, modelDefaults?.http, request.http)
  });
};
var compile = fn2("LLM.compile")(function* (request) {
  const resolved = applyCachePolicy(resolveRequestOptions(request));
  const route = resolved.model.route;
  const body = yield* route.body.from(resolved).pipe(flatMap2(validateWith(decodeUnknownEffect2(route.body.schema))));
  const prepared = yield* route.prepareTransport(body, resolved);
  return {
    request: resolved,
    route,
    body,
    prepared
  };
});
var prepareWith = fn2("LLMClient.prepare")(function* (request) {
  const compiled = yield* compile(request);
  return new PreparedRequest({
    id: compiled.request.id ?? "request",
    route: compiled.route.id,
    protocol: compiled.route.protocol,
    model: compiled.request.model,
    body: compiled.body,
    metadata: { transport: compiled.route.transport.id }
  });
});
var streamRequestWith = (runtime) => (request) => unwrap2(gen2(function* () {
  const compiled = yield* compile(request);
  return compiled.route.streamPrepared(compiled.prepared, compiled.request, runtime);
}));
var generateWith = (stream) => fn2("LLM.generate")(function* (request) {
  const state = yield* stream(request).pipe(runFold2(LLMResponse.empty, LLMResponse.reduce));
  const response = LLMResponse.complete(state);
  if (response)
    return response;
  return yield* eventError(`${request.model.provider}/${request.model.route.id}`, "Provider stream ended without a terminal finish event");
});
var prepare = (request) => prepareWith(request);
function stream2(request) {
  return unwrap2(gen2(function* () {
    return (yield* Service4).stream(request);
  }));
}
function generate(request) {
  return gen2(function* () {
    return yield* (yield* Service4).generate(request);
  });
}
var layer4 = effect(Service4, gen2(function* () {
  const stream = streamRequestWith({
    http: yield* Service2,
    webSocket: getOrUndefined(yield* serviceOption2(WebSocketExecutor.Service))
  });
  return Service4.of({ prepare: prepareWith, stream, generate: generateWith(stream) });
}));
var LLMClient = {
  Service: Service4,
  layer: layer4,
  prepare,
  stream: stream2,
  generate
};
// packages/llm/src/tool.ts
var toDefinitions = (tools) => Object.entries(tools).map(([name, item]) => new ToolDefinition({
  name,
  description: item._definition.description,
  inputSchema: item._definition.inputSchema,
  outputSchema: item._definition.outputSchema
}));
// packages/llm/src/llm.ts
var generate2 = LLMClient.generate;
var stream3 = LLMClient.stream;
var request = (input) => {
  const {
    system: requestSystem,
    prompt,
    messages,
    tools,
    toolChoice: requestToolChoice,
    generation: requestGeneration,
    providerOptions: requestProviderOptions,
    http: requestHttp,
    ...rest
  } = input;
  return new LLMRequest({
    ...rest,
    system: SystemPart.content(requestSystem),
    messages: [...messages?.map(Message.make) ?? [], ...prompt === undefined ? [] : [Message.user(prompt)]],
    tools: tools?.map(ToolDefinition.make) ?? [],
    toolChoice: requestToolChoice ? ToolChoice.make(requestToolChoice) : undefined,
    generation: requestGeneration === undefined ? undefined : GenerationOptions.make(requestGeneration),
    providerOptions: requestProviderOptions,
    http: requestHttp === undefined ? undefined : HttpOptions.make(requestHttp)
  });
};
var GENERATE_OBJECT_TOOL_NAME = "generate_object";
class GenerateObjectResponse {
  object;
  response;
  constructor(object, response) {
    this.object = object;
    this.response = response;
  }
  get events() {
    return this.response.events;
  }
  get usage() {
    return this.response.usage;
  }
}
var runGenerateObject = fn2("LLM.generateObject")(function* (options, tool) {
  const baseRequest = request(options);
  const generateRequest = LLMRequest.update(baseRequest, {
    tools: toDefinitions({ [GENERATE_OBJECT_TOOL_NAME]: tool }),
    toolChoice: ToolChoice.named(GENERATE_OBJECT_TOOL_NAME)
  });
  const response = yield* LLMClient.generate(generateRequest);
  const call = response.toolCalls.find((event) => LLMEvent.is.toolCall(event) && event.name === GENERATE_OBJECT_TOOL_NAME);
  if (!call || !LLMEvent.is.toolCall(call))
    return yield* new LLMError({
      module: "LLM",
      method: "generateObject",
      reason: new InvalidProviderOutputReason({
        message: `generateObject: model did not call the forced \`${GENERATE_OBJECT_TOOL_NAME}\` tool`
      })
    });
  const object = yield* tool._decode(call.input).pipe(mapError3((error) => new LLMError({
    module: "LLM",
    method: "generateObject",
    reason: new InvalidProviderOutputReason({
      message: `generateObject: tool input failed schema decode: ${error.message}`
    })
  })));
  return new GenerateObjectResponse(object, response);
});
// packages/core/src/tool/tool.ts
class RegistrationError extends TaggedErrorClass()("Tool.RegistrationError", {
  name: String4,
  message: String4
}) {
}
var runtimes = new WeakMap;

// packages/copilot-saby/embed/execution.ts
var TERMINAL_ACTION_STATUS = new Set(["completed", "failed", "cancelled", "reversed"]);
var settleEvent = async (client, result, options = {}) => {
  const timeoutMs = options.timeoutMs ?? 15000;
  const pollMs = options.pollMs ?? 1000;
  const event = result?.event;
  const eventId = event?.id;
  if (eventId === undefined)
    return result;
  const deadline = Date.now() + timeoutMs;
  let latest = event;
  while (Date.now() < deadline) {
    const fresh = await client.getActionEvent(eventId);
    if (fresh !== undefined)
      latest = fresh;
    if (TERMINAL_ACTION_STATUS.has(String(latest?.status ?? "").toLowerCase()))
      return latest;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return { ...event, status: String(event?.status ?? "queued"), timedOut: true };
};
var feedbackOf = (event) => {
  const feedback = event?.result_json?.feedback;
  return feedback && typeof feedback === "object" ? feedback : undefined;
};
var summarizeActionEvent = (capability, result) => {
  const event = result?.event ?? result;
  const id = event?.id ?? "?";
  const status = String(event?.status ?? "queued").toLowerCase();
  const entityId = typeof event?.result_json?.entityId === "string" ? event.result_json.entityId : undefined;
  if (status === "completed") {
    return `${capability}: completed (event ${id}${entityId === undefined ? "" : `, entityId ${entityId}`})`;
  }
  if (TERMINAL_ACTION_STATUS.has(status)) {
    const feedback = feedbackOf(event);
    const fieldErrors = Array.isArray(feedback?.fieldErrors) ? feedback.fieldErrors : [];
    const fieldText = fieldErrors.map((fe) => {
      const f = fe;
      const hint = typeof f.hint === "string" ? ` (${f.hint})` : "";
      return ` ${String(f.field)}: ${String(f.message)}${hint}`;
    }).join(";");
    const retry = feedback?.retryable === true ? " retryable" : "";
    const reason = typeof feedback?.message === "string" ? feedback.message : event?.error_message ?? "unknown error";
    return `${capability}: FAILED (event ${id})${retry}: ${reason}${fieldText === "" ? "" : `. Fix:${fieldText}`}`;
  }
  return `${capability}: still processing (event ${id}, status ${status})`;
};
var TOOLS = {
  "users.create": "action_create_user",
  "users.update": "action_update_user",
  "users.deactivate": "action_deactivate_user",
  "users.delete": "action_delete_user",
  "users.reset_password": "action_reset_password",
  "users.assign": "action_assign_role",
  "roles.create": "action_create_role",
  "roles.delete": "action_delete_role",
  "roles.permissions": "action_grant_permission",
  "nodes.create": "action_create_node",
  "nodes.delete": "action_delete_node",
  "nodes.move": "action_move_node",
  "submissions.submit": "action_submit_data",
  "submissions.approve": "action_approve_submission",
  "submissions.reject": "action_reject_submission",
  "submissions.reopen": "action_reopen_submission",
  "submissions.delete": "action_delete_submission",
  "projects.create": "action_create_project",
  "projects.archive": "action_archive_project",
  "projects.restore": "action_restore_project",
  "forms.create": "action_create_project_form",
  "payments.create": "action_create_payment",
  "tasks.create": "action_create_task",
  "tasks.complete": "action_complete_task",
  "tasks.reopen": "action_reopen_task",
  "tasks.cancel": "action_cancel_task"
};
function toolFor(capability, parameters) {
  if (capability === "roles.permissions") {
    return parameters.operation === "revoke" ? "action_revoke_permission" : "action_grant_permission";
  }
  const toolName = TOOLS[capability];
  if (toolName === undefined)
    throw new Error(`capability ${capability} has no backend tool mapping`);
  return toolName;
}
var fallbackPasswordFor = (email) => {
  const stem = String(email).replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
  return `Saby${stem}@2026`;
};
function mapPayload(capability, parameters) {
  if (capability === "users.create" || capability === "users.update") {
    const fullName = String(parameters.fullName ?? "");
    const space = fullName.indexOf(" ");
    const userBody = {
      email: parameters.email === undefined ? undefined : String(parameters.email),
      firstname: space === -1 ? fullName : fullName.slice(0, space),
      lastname: space === -1 ? "" : fullName.slice(space + 1),
      phone: parameters.phone === undefined ? undefined : String(parameters.phone)
    };
    if (capability === "users.create") {
      userBody.password = parameters.password === undefined ? fallbackPasswordFor(parameters.email === undefined ? "" : String(parameters.email)) : String(parameters.password);
    } else if (parameters.password !== undefined) {
      userBody.password = String(parameters.password);
    }
    Object.keys(userBody).forEach((key) => {
      if (userBody[key] === undefined)
        delete userBody[key];
    });
    return {
      entityId: parameters.id,
      userBody,
      userRoleId: parameters.roleId,
      nodeIds: parameters.nodeId === undefined ? undefined : [parameters.nodeId]
    };
  }
  if (capability === "users.assign") {
    return { userId: parameters.userId, roleId: parameters.roleId, nodeIds: parameters.nodeId === undefined ? undefined : [parameters.nodeId] };
  }
  if (capability === "roles.create") {
    return { roleName: parameters.roleName, description: parameters.description, permissionIds: parameters.permissionIds };
  }
  if (capability === "roles.permissions") {
    return {
      roleId: parameters.roleId,
      permissionId: parameters.permissionId,
      permissionIds: parameters.permissionIds,
      permissionNames: parameters.permissionNames
    };
  }
  if (capability === "nodes.create") {
    return { nodeName: parameters.nodeName, nodeType: parameters.nodeType, parentNodeId: parameters.parentNodeId };
  }
  if (capability === "nodes.move") {
    return { nodeId: parameters.nodeId, nodeName: parameters.nodeName, targetParentId: parameters.targetParentId };
  }
  if (capability === "projects.create") {
    return { projectName: parameters.projectName, projectFormId: parameters.projectFormId, description: parameters.description };
  }
  if (capability === "forms.create") {
    return { projectFormId: parameters.projectFormId, title: parameters.title, body: parameters.body, schemaJson: parameters.schemaJson };
  }
  if (capability === "payments.create") {
    return { amount: parameters.amount, currency: parameters.currency, payerEmail: parameters.payerEmail, description: parameters.description };
  }
  if (capability === "tasks.create") {
    return { title: parameters.title, assignees: parameters.assignees, dueDate: parameters.dueDate, calendarId: parameters.calendarId };
  }
  return { entityId: parameters.id ?? parameters.userId ?? parameters.nodeId ?? parameters.projectId ?? parameters.roleId, ...parameters };
}

// .opencode/tools/saby.ts
var BASE_URL = normalizeBackend(process.env.SABY_BACKEND_URL ?? "http://localhost:4000");
function normalizeBackend(raw) {
  return raw.trim().replace(/\/+$/, "").replace(/\/v1$/i, "");
}
var client = backendClient({
  baseUrl: BASE_URL,
  email: process.env.SABY_LOGIN_EMAIL ?? "",
  password: process.env.SABY_LOGIN_PASSWORD ?? "",
  readSession: () => loadAuthSession(),
  saveSession: (session) => saveAuthSession(session)
});
function executeFor(capability, asks) {
  return async (args, context) => {
    const parameters = args;
    if (asks) {
      await context.ask({
        permission: `saby.${capability}`,
        patterns: ["*"],
        always: [],
        metadata: { capability }
      });
    }
    const result = await client.callTool(toolFor(capability, parameters), {
      ...mapPayload(capability, parameters),
      idempotencyKey: crypto.randomUUID()
    });
    const settled = await settleEvent(client, result);
    return summarizeActionEvent(capability, settled);
  };
}
function formatSearchResults(result) {
  const list = result?.results ?? [];
  if (list.length === 0)
    return "No matches found in this tenant.";
  return list.map((item) => `- ${item.id ?? "?"}  ${item.label ?? ""}`).join(`
`);
}
var s = tool.schema;
var users_create = tool({
  description: "Create a user account in the Saby tenant. Governed: requires user:create, tenant-scoped, audited. Mediates all writes through the Saby business layer.",
  args: {
    fullName: s.string().describe("User display name"),
    email: s.string().describe("User email address"),
    phone: s.string().optional().describe("User phone number"),
    roleId: s.string().optional().describe("Initial role assignment"),
    nodeId: s.string().optional().describe("Initial workspace node")
  },
  execute: executeFor("users.create", false)
});
var users_search = tool({
  description: "Search user accounts in the Saby tenant by name, email, or phone. Read-only, tenant-scoped, returns up to 5 results with their ids \u2014 use the ids for users_assign / users_update. Empty query lists active users.",
  args: {
    query: s.string().describe("Search text (email, name, or phone); empty lists active users")
  },
  execute: async (args) => {
    const result = await client.searchEntities({
      query: String(args.query ?? ""),
      entityTypes: ["user"],
      limit: 5
    });
    return formatSearchResults(result);
  }
});
var roles_search = tool({
  description: 'Search roles in the Saby tenant by name (e.g. "Employee"). Read-only, tenant-scoped, returns up to 5 results with their ids \u2014 use the ids for users_assign. Empty query lists tenant roles.',
  args: {
    query: s.string().describe("Role name keyword; empty lists tenant roles")
  },
  execute: async (args) => {
    const result = await client.searchEntities({
      query: String(args.query ?? ""),
      entityTypes: ["role"],
      limit: 5
    });
    return formatSearchResults(result);
  }
});
var users_update = tool({
  description: "Update a user account's fields in the Saby tenant. Governed: requires user:update, tenant-scoped, audited.",
  args: {
    id: s.string().describe("User id to update"),
    fullName: s.string().optional().describe("New display name"),
    email: s.string().optional().describe("New email address"),
    phone: s.string().optional().describe("New phone number"),
    roleId: s.string().optional().describe("New role assignment"),
    nodeId: s.string().optional().describe("New workspace node")
  },
  execute: executeFor("users.update", false)
});
var users_deactivate = tool({
  description: "Deactivate a user account so they can no longer sign in. Governed: requires user:update, tenant-scoped, audited. Prompts for approval.",
  args: {
    id: s.string().describe("User id to deactivate")
  },
  execute: executeFor("users.deactivate", true)
});
var users_delete = tool({
  description: "Delete a user account. Governed: requires user:delete, tenant-scoped, audited. Prompts for approval.",
  args: {
    id: s.string().describe("User id to delete")
  },
  execute: executeFor("users.delete", true)
});
var users_reset_password = tool({
  description: "Reset a user account's password. Governed: requires auth:resetPassword, tenant-scoped, audited. Prompts for approval.",
  args: {
    id: s.string().describe("User id whose password will be reset"),
    newPassword: s.string().optional().describe("New password to set")
  },
  execute: executeFor("users.reset_password", true)
});
var users_assign = tool({
  description: "Assign roles or workspace nodes to a user. Governed: requires user:assign, tenant-scoped, audited.",
  args: {
    userId: s.string().describe("User id to assign to"),
    roleId: s.string().optional().describe("Role to assign"),
    nodeId: s.string().optional().describe("Workspace node to assign")
  },
  execute: executeFor("users.assign", false)
});
var roles_create = tool({
  description: "Create a role in the tenant. Governed: requires role:create, tenant-scoped, audited.",
  args: {
    roleName: s.string().describe("Role name"),
    description: s.string().optional().describe("Role description"),
    permissionIds: s.array(s.string()).optional().describe("Permission ids to grant the role")
  },
  execute: executeFor("roles.create", false)
});
var roles_delete = tool({
  description: "Delete a role from the tenant. Governed: requires role:delete, tenant-scoped, audited. Prompts for approval.",
  args: {
    roleId: s.string().describe("Role id to delete")
  },
  execute: executeFor("roles.delete", true)
});
var roles_permissions = tool({
  description: "Grant or revoke permissions on a role. Governance requires role:permission for the operation, tenant-scoped and audited. Prompts for approval.",
  args: {
    operation: s.string().describe("grant or revoke"),
    roleId: s.string().describe("Role id"),
    permissionId: s.string().optional().describe("Single permission id to grant/revoke"),
    permissionNames: s.array(s.string()).optional().describe("Permission names to grant/revoke")
  },
  execute: executeFor("roles.permissions", true)
});
var nodes_create = tool({
  description: "Create a workspace node (department, level, or team unit). Governed: requires node:create, tenant-scoped, audited.",
  args: {
    nodeName: s.string().describe("Node name"),
    nodeType: s.string().optional().describe("Node type"),
    parentNodeId: s.string().optional().describe("Parent node id")
  },
  execute: executeFor("nodes.create", false)
});
var nodes_delete = tool({
  description: "Delete a workspace node. Governed: requires node:delete, tenant-scoped, audited. Prompts for approval.",
  args: {
    nodeId: s.string().describe("Node id to delete")
  },
  execute: executeFor("nodes.delete", true)
});
var nodes_move = tool({
  description: "Move a workspace node under a new parent. Governed: requires node:update, tenant-scoped, audited. Prompts for approval.",
  args: {
    nodeId: s.string().describe("Node id to move"),
    nodeName: s.string().optional().describe("New node name"),
    targetParentId: s.string().describe("Target parent node id")
  },
  execute: executeFor("nodes.move", true)
});
var submissions_submit = tool({
  description: "Submit data for a project form. Governed: requires submission:create plus create:form-submission, tenant-scoped, audited.",
  args: {
    projectId: s.string().optional().describe("Project id"),
    formId: s.string().optional().describe("Project form id"),
    data: s.record(s.string(), s.any()).optional().describe("Field values keyed by field")
  },
  execute: executeFor("submissions.submit", false)
});
var submissions_approve = tool({
  description: "Approve a project form submission. Governed: requires submission:approve plus update:form-submission, tenant-scoped, audited. Prompts for approval.",
  args: {
    id: s.string().describe("Submission id to approve")
  },
  execute: executeFor("submissions.approve", true)
});
var submissions_reject = tool({
  description: "Reject a project form submission. Governed: requires submission:reject plus update:form-submission, tenant-scoped, audited. Prompts for approval.",
  args: {
    id: s.string().describe("Submission id to reject"),
    reason: s.string().optional().describe("Rejection reason")
  },
  execute: executeFor("submissions.reject", true)
});
var submissions_reopen = tool({
  description: "Reopen a previously approved or rejected submission. Governed: requires submission:update, tenant-scoped, audited.",
  args: {
    id: s.string().describe("Submission id to reopen")
  },
  execute: executeFor("submissions.reopen", false)
});
var submissions_delete = tool({
  description: "Delete a project form submission. Governed: requires submission:delete plus delete:form-submission, tenant-scoped, audited. Prompts for approval.",
  args: {
    id: s.string().describe("Submission id to delete")
  },
  execute: executeFor("submissions.delete", true)
});
var projects_create = tool({
  description: "Create a project from a project form. Governed: requires create:project-form, tenant-scoped, audited.",
  args: {
    projectName: s.string().describe("Project name"),
    projectFormId: s.string().optional().describe("Project form id"),
    description: s.string().optional().describe("Project description")
  },
  execute: executeFor("projects.create", false)
});
var projects_archive = tool({
  description: "Archive a project. Governed: requires project:archive plus update:project-form, tenant-scoped, audited. Prompts for approval.",
  args: {
    projectId: s.string().describe("Project id to archive")
  },
  execute: executeFor("projects.archive", true)
});
var projects_restore = tool({
  description: "Restore an archived project. Governed: requires create:project-form, tenant-scoped, audited.",
  args: {
    projectId: s.string().describe("Project id to restore")
  },
  execute: executeFor("projects.restore", false)
});
var forms_create = tool({
  description: "Create a project form with a schema. Governed: requires create:project-form, tenant-scoped, audited.",
  args: {
    title: s.string().describe("Form title"),
    projectFormId: s.string().optional().describe("Explicit project form id"),
    body: s.string().optional().describe("Form body"),
    schemaJson: s.any().optional().describe("Form field schema")
  },
  execute: executeFor("forms.create", false)
});
var payments_create = tool({
  description: "Create a payment record. Governed: requires payment:create, tenant-scoped, audited.",
  args: {
    amount: s.number().optional().describe("Payment amount"),
    currency: s.string().optional().describe("Currency code"),
    payerEmail: s.string().optional().describe("Payer email"),
    description: s.string().optional().describe("Payment description")
  },
  execute: executeFor("payments.create", false)
});
var tasks_create = tool({
  description: "Create a task or calendar event. Governed: requires calendar:manage, tenant-scoped, audited.",
  args: {
    title: s.string().describe("Task title"),
    assignees: s.array(s.string()).optional().describe("Assignee user ids"),
    dueDate: s.string().optional().describe("Due date ISO string"),
    calendarId: s.string().optional().describe("Calendar id")
  },
  execute: executeFor("tasks.create", false)
});
var tasks_complete = tool({
  description: "Complete a task. Governed: requires calendar:manage, tenant-scoped, audited.",
  args: {
    id: s.string().describe("Task id to complete")
  },
  execute: executeFor("tasks.complete", false)
});
var tasks_reopen = tool({
  description: "Reopen a completed or cancelled task. Governed: requires calendar:manage, tenant-scoped, audited.",
  args: {
    id: s.string().describe("Task id to reopen")
  },
  execute: executeFor("tasks.reopen", false)
});
var tasks_cancel = tool({
  description: "Cancel a task. Governed: requires calendar:manage, tenant-scoped, audited.",
  args: {
    id: s.string().describe("Task id to cancel")
  },
  execute: executeFor("tasks.cancel", false)
});
export {
  forms_create,
  nodes_create,
  nodes_delete,
  nodes_move,
  payments_create,
  projects_archive,
  projects_create,
  projects_restore,
  roles_create,
  roles_delete,
  roles_permissions,
  roles_search,
  submissions_approve,
  submissions_delete,
  submissions_reject,
  submissions_reopen,
  submissions_submit,
  tasks_cancel,
  tasks_complete,
  tasks_create,
  tasks_reopen,
  users_assign,
  users_create,
  users_deactivate,
  users_delete,
  users_reset_password,
  users_search,
  users_update
};
