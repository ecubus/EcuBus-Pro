var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name3 in all)
    __defProp(target, name3, { get: all[name3], enumerable: true });
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/ms/index.js"(exports2, module2) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module2.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name3) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name3 + (isPlural ? "s" : "");
    }
  }
});

// node_modules/debug/src/common.js
var require_common = __commonJS({
  "node_modules/debug/src/common.js"(exports2, module2) {
    function setup(env) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug6(...args) {
          if (!debug6.enabled) {
            return;
          }
          const self = debug6;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self.diff = ms;
          self.prev = prevTime;
          self.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug.formatArgs.call(self, args);
          const logFn = self.log || createDebug.log;
          logFn.apply(self, args);
        }
        debug6.namespace = namespace;
        debug6.useColors = createDebug.useColors();
        debug6.color = createDebug.selectColor(namespace);
        debug6.extend = extend;
        debug6.destroy = createDebug.destroy;
        Object.defineProperty(debug6, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug.namespaces) {
              namespacesCache = createDebug.namespaces;
              enabledCache = createDebug.enabled(namespace);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug.init === "function") {
          createDebug.init(debug6);
        }
        return debug6;
      }
      function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        let i;
        const split = (typeof namespaces === "string" ? namespaces : "").split(/[\s,]+/);
        const len = split.length;
        for (i = 0; i < len; i++) {
          if (!split[i]) {
            continue;
          }
          namespaces = split[i].replace(/\*/g, ".*?");
          if (namespaces[0] === "-") {
            createDebug.skips.push(new RegExp("^" + namespaces.slice(1) + "$"));
          } else {
            createDebug.names.push(new RegExp("^" + namespaces + "$"));
          }
        }
      }
      function disable() {
        const namespaces = [
          ...createDebug.names.map(toNamespace),
          ...createDebug.skips.map(toNamespace).map((namespace) => "-" + namespace)
        ].join(",");
        createDebug.enable("");
        return namespaces;
      }
      function enabled(name3) {
        if (name3[name3.length - 1] === "*") {
          return true;
        }
        let i;
        let len;
        for (i = 0, len = createDebug.skips.length; i < len; i++) {
          if (createDebug.skips[i].test(name3)) {
            return false;
          }
        }
        for (i = 0, len = createDebug.names.length; i < len; i++) {
          if (createDebug.names[i].test(name3)) {
            return true;
          }
        }
        return false;
      }
      function toNamespace(regexp) {
        return regexp.toString().substring(2, regexp.toString().length - 2).replace(/\.\*\?$/, "*");
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    module2.exports = setup;
  }
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "node_modules/debug/src/browser.js"(exports2, module2) {
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.storage = localstorage();
    exports2.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports2.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module2.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports2.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports2.storage.setItem("debug", namespaces);
        } else {
          exports2.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r;
      try {
        r = exports2.storage.getItem("debug");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module2.exports = require_common()(exports2);
    var { formatters } = module2.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// node_modules/has-flag/index.js
var require_has_flag = __commonJS({
  "node_modules/has-flag/index.js"(exports2, module2) {
    "use strict";
    module2.exports = (flag, argv = process.argv) => {
      const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
      const position = argv.indexOf(prefix + flag);
      const terminatorPosition = argv.indexOf("--");
      return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
    };
  }
});

// node_modules/supports-color/index.js
var require_supports_color = __commonJS({
  "node_modules/supports-color/index.js"(exports2, module2) {
    "use strict";
    var os = require("os");
    var tty = require("tty");
    var hasFlag = require_has_flag();
    var { env } = process;
    var forceColor;
    if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
      forceColor = 0;
    } else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
      forceColor = 1;
    }
    if ("FORCE_COLOR" in env) {
      if (env.FORCE_COLOR === "true") {
        forceColor = 1;
      } else if (env.FORCE_COLOR === "false") {
        forceColor = 0;
      } else {
        forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
      }
    }
    function translateLevel(level) {
      if (level === 0) {
        return false;
      }
      return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3
      };
    }
    function supportsColor(haveStream, streamIsTTY) {
      if (forceColor === 0) {
        return 0;
      }
      if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
        return 3;
      }
      if (hasFlag("color=256")) {
        return 2;
      }
      if (haveStream && !streamIsTTY && forceColor === void 0) {
        return 0;
      }
      const min = forceColor || 0;
      if (env.TERM === "dumb") {
        return min;
      }
      if (process.platform === "win32") {
        const osRelease = os.release().split(".");
        if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
          return Number(osRelease[2]) >= 14931 ? 3 : 2;
        }
        return 1;
      }
      if ("CI" in env) {
        if (["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((sign) => sign in env) || env.CI_NAME === "codeship") {
          return 1;
        }
        return min;
      }
      if ("TEAMCITY_VERSION" in env) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
      }
      if (env.COLORTERM === "truecolor") {
        return 3;
      }
      if ("TERM_PROGRAM" in env) {
        const version = parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
        switch (env.TERM_PROGRAM) {
          case "iTerm.app":
            return version >= 3 ? 3 : 2;
          case "Apple_Terminal":
            return 2;
        }
      }
      if (/-256(color)?$/i.test(env.TERM)) {
        return 2;
      }
      if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
        return 1;
      }
      if ("COLORTERM" in env) {
        return 1;
      }
      return min;
    }
    function getSupportLevel(stream) {
      const level = supportsColor(stream, stream && stream.isTTY);
      return translateLevel(level);
    }
    module2.exports = {
      supportsColor: getSupportLevel,
      stdout: translateLevel(supportsColor(true, tty.isatty(1))),
      stderr: translateLevel(supportsColor(true, tty.isatty(2)))
    };
  }
});

// node_modules/debug/src/node.js
var require_node = __commonJS({
  "node_modules/debug/src/node.js"(exports2, module2) {
    var tty = require("tty");
    var util = require("util");
    exports2.init = init;
    exports2.log = log;
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports2.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = require_supports_color();
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports2.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error) {
    }
    exports2.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports2.inspectOpts ? Boolean(exports2.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      const { namespace: name3, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name3} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module2.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name3 + " " + args[0];
      }
    }
    function getDate() {
      if (exports2.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log(...args) {
      return process.stderr.write(util.formatWithOptions(exports2.inspectOpts, ...args) + "\n");
    }
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function init(debug6) {
      debug6.inspectOpts = {};
      const keys = Object.keys(exports2.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug6.inspectOpts[keys[i]] = exports2.inspectOpts[keys[i]];
      }
    }
    module2.exports = require_common()(exports2);
    var { formatters } = module2.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  }
});

// node_modules/debug/src/index.js
var require_src = __commonJS({
  "node_modules/debug/src/index.js"(exports2, module2) {
    if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
      module2.exports = require_browser();
    } else {
      module2.exports = require_node();
    }
  }
});

// node_modules/@serialport/parser-delimiter/dist/index.js
var require_dist = __commonJS({
  "node_modules/@serialport/parser-delimiter/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DelimiterParser = void 0;
    var stream_1 = require("stream");
    var DelimiterParser = class extends stream_1.Transform {
      includeDelimiter;
      delimiter;
      buffer;
      constructor({ delimiter, includeDelimiter = false, ...options }) {
        super(options);
        if (delimiter === void 0) {
          throw new TypeError('"delimiter" is not a bufferable object');
        }
        if (delimiter.length === 0) {
          throw new TypeError('"delimiter" has a 0 or undefined length');
        }
        this.includeDelimiter = includeDelimiter;
        this.delimiter = Buffer.from(delimiter);
        this.buffer = Buffer.alloc(0);
      }
      _transform(chunk, encoding, cb) {
        let data = Buffer.concat([this.buffer, chunk]);
        let position;
        while ((position = data.indexOf(this.delimiter)) !== -1) {
          this.push(data.slice(0, position + (this.includeDelimiter ? this.delimiter.length : 0)));
          data = data.slice(position + this.delimiter.length);
        }
        this.buffer = data;
        cb();
      }
      _flush(cb) {
        this.push(this.buffer);
        this.buffer = Buffer.alloc(0);
        cb();
      }
    };
    exports2.DelimiterParser = DelimiterParser;
  }
});

// node_modules/@serialport/parser-readline/dist/index.js
var require_dist2 = __commonJS({
  "node_modules/@serialport/parser-readline/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ReadlineParser = void 0;
    var parser_delimiter_1 = require_dist();
    var ReadlineParser2 = class extends parser_delimiter_1.DelimiterParser {
      constructor(options) {
        const opts = {
          delimiter: Buffer.from("\n", "utf8"),
          encoding: "utf8",
          ...options
        };
        if (typeof opts.delimiter === "string") {
          opts.delimiter = Buffer.from(opts.delimiter, opts.encoding);
        }
        super(opts);
      }
    };
    exports2.ReadlineParser = ReadlineParser2;
  }
});

// lib/index.ts
var lib_exports = {};
__export(lib_exports, {
  BindingsError: () => BindingsError,
  DarwinBinding: () => DarwinBinding,
  DarwinPortBinding: () => DarwinPortBinding,
  LinuxBinding: () => LinuxBinding,
  LinuxPortBinding: () => LinuxPortBinding,
  WindowsBinding: () => WindowsBinding,
  WindowsPortBinding: () => WindowsPortBinding,
  autoDetect: () => autoDetect
});
module.exports = __toCommonJS(lib_exports);
var import_debug7 = __toESM(require_src());

// lib/darwin.ts
var import_debug4 = __toESM(require_src());

// lib/load-bindings.ts
var import_util = require("util");
var import_process = require("process");
var name = import_process.platform === "win32" ? "./serialPortWin.node" : "./serialPortLinux.node";
var binding = require(name);
var asyncClose = binding.close ? (0, import_util.promisify)(binding.close) : async () => {
  throw new Error('"binding.close" Method not implemented');
};
var asyncDrain = binding.drain ? (0, import_util.promisify)(binding.drain) : async () => {
  throw new Error('"binding.drain" Method not implemented');
};
var asyncFlush = binding.flush ? (0, import_util.promisify)(binding.flush) : async () => {
  throw new Error('"binding.flush" Method not implemented');
};
var asyncGet = binding.get ? (0, import_util.promisify)(binding.get) : async () => {
  throw new Error('"binding.get" Method not implemented');
};
var asyncGetBaudRate = binding.getBaudRate ? (0, import_util.promisify)(binding.getBaudRate) : async () => {
  throw new Error('"binding.getBaudRate" Method not implemented');
};
var asyncList = binding.list ? (0, import_util.promisify)(binding.list) : async () => {
  throw new Error('"binding.list" Method not implemented');
};
var asyncOpen = binding.open ? (0, import_util.promisify)(binding.open) : async () => {
  throw new Error('"binding.open" Method not implemented');
};
var asyncSet = binding.set ? (0, import_util.promisify)(binding.set) : async () => {
  throw new Error('"binding.set" Method not implemented');
};
var asyncUpdate = binding.update ? (0, import_util.promisify)(binding.update) : async () => {
  throw new Error('"binding.update" Method not implemented');
};
var asyncRead = binding.read ? (0, import_util.promisify)(binding.read) : async () => {
  throw new Error('"binding.read" Method not implemented');
};
var asyncWrite = binding.write ? (0, import_util.promisify)(binding.write) : async () => {
  throw new Error('"binding.write" Method not implemented');
};

// lib/poller.ts
var import_debug = __toESM(require_src());
var import_events = require("events");

// lib/errors.ts
var BindingsError = class extends Error {
  constructor(message, { canceled = false } = {}) {
    super(message);
    this.canceled = canceled;
  }
};

// lib/poller.ts
var import_process2 = require("process");
var name2 = import_process2.platform === "win32" ? "./serialPortWin.node" : "./serialPortLinux.node";
var PollerBindings = require(name2).Poller;
var logger = (0, import_debug.default)("serialport/bindings-cpp/poller");
var EVENTS = {
  UV_READABLE: 1,
  UV_WRITABLE: 2,
  UV_DISCONNECT: 4
};
function handleEvent(error, eventFlag) {
  if (error) {
    logger("error", error);
    this.emit("readable", error);
    this.emit("writable", error);
    this.emit("disconnect", error);
    return;
  }
  if (eventFlag & EVENTS.UV_READABLE) {
    logger('received "readable"');
    this.emit("readable", null);
  }
  if (eventFlag & EVENTS.UV_WRITABLE) {
    logger('received "writable"');
    this.emit("writable", null);
  }
  if (eventFlag & EVENTS.UV_DISCONNECT) {
    logger('received "disconnect"');
    this.emit("disconnect", null);
  }
}
var Poller = class extends import_events.EventEmitter {
  constructor(fd, FDPoller = PollerBindings) {
    logger("Creating poller");
    super();
    this.poller = new FDPoller(fd, handleEvent.bind(this));
  }
  /**
   * Wait for the next event to occur
   * @param {string} event ('readable'|'writable'|'disconnect')
   * @returns {Poller} returns itself
   */
  once(event, callback) {
    switch (event) {
      case "readable":
        this.poll(EVENTS.UV_READABLE);
        break;
      case "writable":
        this.poll(EVENTS.UV_WRITABLE);
        break;
      case "disconnect":
        this.poll(EVENTS.UV_DISCONNECT);
        break;
    }
    return super.once(event, callback);
  }
  /**
   * Ask the bindings to listen for an event, it is recommend to use `.once()` for easy use
   * @param {EVENTS} eventFlag polls for an event or group of events based upon a flag.
   */
  poll(eventFlag = 0) {
    if (eventFlag & EVENTS.UV_READABLE) {
      logger('Polling for "readable"');
    }
    if (eventFlag & EVENTS.UV_WRITABLE) {
      logger('Polling for "writable"');
    }
    if (eventFlag & EVENTS.UV_DISCONNECT) {
      logger('Polling for "disconnect"');
    }
    this.poller.poll(eventFlag);
  }
  /**
   * Stop listening for events and cancel all outstanding listening with an error
   */
  stop() {
    logger("Stopping poller");
    this.poller.stop();
    this.emitCanceled();
  }
  destroy() {
    logger("Destroying poller");
    this.poller.destroy();
    this.emitCanceled();
  }
  emitCanceled() {
    const err = new BindingsError("Canceled", { canceled: true });
    this.emit("readable", err);
    this.emit("writable", err);
    this.emit("disconnect", err);
  }
};

// lib/unix-read.ts
var import_util2 = require("util");
var import_fs = require("fs");
var import_debug2 = __toESM(require_src());
var logger2 = (0, import_debug2.default)("serialport/bindings-cpp/unixRead");
var readAsync = (0, import_util2.promisify)(import_fs.read);
var readable = (binding2) => {
  return new Promise((resolve, reject) => {
    if (!binding2.poller) {
      throw new Error("No poller on bindings");
    }
    binding2.poller.once("readable", (err) => err ? reject(err) : resolve());
  });
};
var unixRead = async ({
  binding: binding2,
  buffer,
  offset,
  length,
  fsReadAsync = readAsync
}) => {
  logger2("Starting read");
  if (!binding2.isOpen || !binding2.fd) {
    throw new BindingsError("Port is not open", { canceled: true });
  }
  try {
    const { bytesRead } = await fsReadAsync(binding2.fd, buffer, offset, length, null);
    if (bytesRead === 0) {
      return unixRead({ binding: binding2, buffer, offset, length, fsReadAsync });
    }
    logger2("Finished read", bytesRead, "bytes");
    return { bytesRead, buffer };
  } catch (err) {
    logger2("read error", err);
    if (err.code === "EAGAIN" || err.code === "EWOULDBLOCK" || err.code === "EINTR") {
      if (!binding2.isOpen) {
        throw new BindingsError("Port is not open", { canceled: true });
      }
      logger2("waiting for readable because of code:", err.code);
      await readable(binding2);
      return unixRead({ binding: binding2, buffer, offset, length, fsReadAsync });
    }
    const disconnectError = err.code === "EBADF" || // Bad file number means we got closed
    err.code === "ENXIO" || // No such device or address probably usb disconnect
    err.code === "UNKNOWN" || err.errno === -1;
    if (disconnectError) {
      err.disconnect = true;
      logger2("disconnecting", err);
    }
    throw err;
  }
};

// lib/unix-write.ts
var import_fs2 = require("fs");
var import_debug3 = __toESM(require_src());
var import_util3 = require("util");
var logger3 = (0, import_debug3.default)("serialport/bindings-cpp/unixWrite");
var writeAsync = (0, import_util3.promisify)(import_fs2.write);
var writable = (binding2) => {
  return new Promise((resolve, reject) => {
    binding2.poller.once("writable", (err) => err ? reject(err) : resolve());
  });
};
var unixWrite = async ({ binding: binding2, buffer, offset = 0, fsWriteAsync = writeAsync }) => {
  const bytesToWrite = buffer.length - offset;
  logger3("Starting write", buffer.length, "bytes offset", offset, "bytesToWrite", bytesToWrite);
  if (!binding2.isOpen || !binding2.fd) {
    throw new Error("Port is not open");
  }
  try {
    const { bytesWritten } = await fsWriteAsync(binding2.fd, buffer, offset, bytesToWrite);
    logger3("write returned: wrote", bytesWritten, "bytes");
    if (bytesWritten + offset < buffer.length) {
      if (!binding2.isOpen) {
        throw new Error("Port is not open");
      }
      return unixWrite({ binding: binding2, buffer, offset: bytesWritten + offset, fsWriteAsync });
    }
    logger3("Finished writing", bytesWritten + offset, "bytes");
  } catch (err) {
    logger3("write errored", err);
    if (err.code === "EAGAIN" || err.code === "EWOULDBLOCK" || err.code === "EINTR") {
      if (!binding2.isOpen) {
        throw new Error("Port is not open");
      }
      logger3("waiting for writable because of code:", err.code);
      await writable(binding2);
      return unixWrite({ binding: binding2, buffer, offset, fsWriteAsync });
    }
    const disconnectError = err.code === "EBADF" || // Bad file number means we got closed
    err.code === "ENXIO" || // No such device or address probably usb disconnect
    err.code === "UNKNOWN" || err.errno === -1;
    if (disconnectError) {
      err.disconnect = true;
      logger3("disconnecting", err);
    }
    logger3("error", err);
    throw err;
  }
};

// lib/darwin.ts
var debug2 = (0, import_debug4.default)("serialport/bindings-cpp");
var DarwinBinding = {
  list() {
    debug2("list");
    return asyncList();
  },
  async open(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError('"options" is not an object');
    }
    if (!options.path) {
      throw new TypeError('"path" is not a valid port');
    }
    if (!options.baudRate) {
      throw new TypeError('"baudRate" is not a valid baudRate');
    }
    debug2("open");
    const openOptions = {
      vmin: 1,
      vtime: 0,
      dataBits: 8,
      lock: true,
      stopBits: 1,
      parity: "none",
      rtscts: false,
      xon: false,
      xoff: false,
      xany: false,
      hupcl: true,
      ...options
    };
    const fd = await asyncOpen(openOptions.path, openOptions);
    return new DarwinPortBinding(fd, openOptions);
  }
};
var DarwinPortBinding = class {
  constructor(fd, options) {
    this.fd = fd;
    this.openOptions = options;
    this.poller = new Poller(fd);
    this.writeOperation = null;
  }
  get isOpen() {
    return this.fd !== null;
  }
  async close() {
    debug2("close");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    const fd = this.fd;
    this.poller.stop();
    this.poller.destroy();
    this.fd = null;
    await asyncClose(fd);
  }
  async read(buffer, offset, length) {
    if (!Buffer.isBuffer(buffer)) {
      throw new TypeError('"buffer" is not a Buffer');
    }
    if (typeof offset !== "number" || isNaN(offset)) {
      throw new TypeError(`"offset" is not an integer got "${isNaN(offset) ? "NaN" : typeof offset}"`);
    }
    if (typeof length !== "number" || isNaN(length)) {
      throw new TypeError(`"length" is not an integer got "${isNaN(length) ? "NaN" : typeof length}"`);
    }
    debug2("read");
    if (buffer.length < offset + length) {
      throw new Error("buffer is too small");
    }
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    return unixRead({ binding: this, buffer, offset, length });
  }
  async write(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      throw new TypeError('"buffer" is not a Buffer');
    }
    debug2("write", buffer.length, "bytes");
    if (!this.isOpen) {
      debug2("write", "error port is not open");
      throw new Error("Port is not open");
    }
    this.writeOperation = (async () => {
      if (buffer.length === 0) {
        return;
      }
      await unixWrite({ binding: this, buffer });
      this.writeOperation = null;
    })();
    return this.writeOperation;
  }
  async update(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw TypeError('"options" is not an object');
    }
    if (typeof options.baudRate !== "number") {
      throw new TypeError('"options.baudRate" is not a number');
    }
    debug2("update");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    await asyncUpdate(this.fd, options);
  }
  async set(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError('"options" is not an object');
    }
    debug2("set", options);
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    await asyncSet(this.fd, options);
  }
  async get() {
    debug2("get");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    return asyncGet(this.fd);
  }
  async getBaudRate() {
    debug2("getBaudRate");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    throw new Error("getBaudRate is not implemented on darwin");
  }
  async flush() {
    debug2("flush");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    await asyncFlush(this.fd);
  }
  async drain() {
    debug2("drain");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    await this.writeOperation;
    await asyncDrain(this.fd);
  }
};

// lib/linux.ts
var import_debug5 = __toESM(require_src());

// lib/linux-list.ts
var import_child_process = require("child_process");
var import_parser_readline = __toESM(require_dist2());
function checkPathOfDevice(path) {
  return /(tty(S|WCH|ACM|USB|AMA|MFD|O|XRUSB)|rfcomm)/.test(path) && path;
}
function propName(name3) {
  return {
    DEVNAME: "path",
    ID_VENDOR_ENC: "manufacturer",
    ID_SERIAL_SHORT: "serialNumber",
    ID_VENDOR_ID: "vendorId",
    ID_MODEL_ID: "productId",
    DEVLINKS: "pnpId",
    /**
    * Workaround for systemd defect
    * see https://github.com/serialport/bindings-cpp/issues/115
    */
    ID_USB_VENDOR_ENC: "manufacturer",
    ID_USB_SERIAL_SHORT: "serialNumber",
    ID_USB_VENDOR_ID: "vendorId",
    ID_USB_MODEL_ID: "productId"
    // End of workaround
  }[name3.toUpperCase()];
}
function decodeHexEscape(str) {
  return str.replace(/\\x([a-fA-F0-9]{2})/g, (a, b) => {
    return String.fromCharCode(parseInt(b, 16));
  });
}
function propVal(name3, val) {
  if (name3 === "pnpId") {
    const match = val.match(/\/by-id\/([^\s]+)/);
    return match?.[1] || void 0;
  }
  if (name3 === "manufacturer") {
    return decodeHexEscape(val);
  }
  if (/^0x/.test(val)) {
    return val.substr(2);
  }
  return val;
}
function linuxList(spawnCmd = import_child_process.spawn) {
  const ports = [];
  const udevadm = spawnCmd("udevadm", ["info", "-e"]);
  const lines = udevadm.stdout.pipe(new import_parser_readline.ReadlineParser());
  let skipPort = false;
  let port = {
    path: "",
    manufacturer: void 0,
    serialNumber: void 0,
    pnpId: void 0,
    locationId: void 0,
    vendorId: void 0,
    productId: void 0
  };
  lines.on("data", (line) => {
    const lineType = line.slice(0, 1);
    const data = line.slice(3);
    if (lineType === "P") {
      port = {
        path: "",
        manufacturer: void 0,
        serialNumber: void 0,
        pnpId: void 0,
        locationId: void 0,
        vendorId: void 0,
        productId: void 0
      };
      skipPort = false;
      return;
    }
    if (skipPort) {
      return;
    }
    if (lineType === "N") {
      if (checkPathOfDevice(data)) {
        ports.push(port);
      } else {
        skipPort = true;
      }
      return;
    }
    if (lineType === "E") {
      const keyValue = data.match(/^(.+)=(.*)/);
      if (!keyValue) {
        return;
      }
      const key = propName(keyValue[1]);
      if (!key) {
        return;
      }
      port[key] = propVal(key, keyValue[2]);
    }
  });
  return new Promise((resolve, reject) => {
    udevadm.on("close", (code) => {
      if (code) {
        reject(new Error(`Error listing ports udevadm exited with error code: ${code}`));
      }
    });
    udevadm.on("error", reject);
    lines.on("error", reject);
    lines.on("finish", () => resolve(ports));
  });
}

// lib/linux.ts
var debug3 = (0, import_debug5.default)("serialport/bindings-cpp");
var LinuxBinding = {
  list() {
    debug3("list");
    return linuxList();
  },
  async open(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError('"options" is not an object');
    }
    if (!options.path) {
      throw new TypeError('"path" is not a valid port');
    }
    if (!options.baudRate) {
      throw new TypeError('"baudRate" is not a valid baudRate');
    }
    debug3("open");
    const openOptions = {
      vmin: 1,
      vtime: 0,
      dataBits: 8,
      lock: true,
      stopBits: 1,
      parity: "none",
      rtscts: false,
      xon: false,
      xoff: false,
      xany: false,
      hupcl: true,
      ...options
    };
    const fd = await asyncOpen(openOptions.path, openOptions);
    this.fd = fd;
    return new LinuxPortBinding(fd, openOptions);
  }
};
var LinuxPortBinding = class {
  constructor(fd, openOptions) {
    this.fd = fd;
    this.openOptions = openOptions;
    this.poller = new Poller(fd);
    this.writeOperation = null;
  }
  get isOpen() {
    return this.fd !== null;
  }
  async close() {
    debug3("close");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    const fd = this.fd;
    this.poller.stop();
    this.poller.destroy();
    this.fd = null;
    await asyncClose(fd);
  }
  async read(buffer, offset, length) {
    if (!Buffer.isBuffer(buffer)) {
      throw new TypeError('"buffer" is not a Buffer');
    }
    if (typeof offset !== "number" || isNaN(offset)) {
      throw new TypeError(`"offset" is not an integer got "${isNaN(offset) ? "NaN" : typeof offset}"`);
    }
    if (typeof length !== "number" || isNaN(length)) {
      throw new TypeError(`"length" is not an integer got "${isNaN(length) ? "NaN" : typeof length}"`);
    }
    debug3("read");
    if (buffer.length < offset + length) {
      throw new Error("buffer is too small");
    }
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    return unixRead({ binding: this, buffer, offset, length });
  }
  async write(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      throw new TypeError('"buffer" is not a Buffer');
    }
    debug3("write", buffer.length, "bytes");
    if (!this.isOpen) {
      debug3("write", "error port is not open");
      throw new Error("Port is not open");
    }
    this.writeOperation = (async () => {
      if (buffer.length === 0) {
        return;
      }
      await unixWrite({ binding: this, buffer });
      this.writeOperation = null;
    })();
    return this.writeOperation;
  }
  async update(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw TypeError('"options" is not an object');
    }
    if (typeof options.baudRate !== "number") {
      throw new TypeError('"options.baudRate" is not a number');
    }
    debug3("update");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    await asyncUpdate(this.fd, options);
  }
  async set(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError('"options" is not an object');
    }
    debug3("set");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    await asyncSet(this.fd, options);
  }
  async get() {
    debug3("get");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    return asyncGet(this.fd);
  }
  async getBaudRate() {
    debug3("getBaudRate");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    return asyncGetBaudRate(this.fd);
  }
  async flush() {
    debug3("flush");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    await asyncFlush(this.fd);
  }
  async drain() {
    debug3("drain");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    await this.writeOperation;
    await asyncDrain(this.fd);
  }
};

// lib/win32.ts
var import_debug6 = __toESM(require_src());

// lib/win32-sn-parser.ts
var PARSERS = [/USB\\(?:.+)\\(.+)/, /FTDIBUS\\(?:.+)\+(.+?)A?\\.+/];
var serialNumParser = (pnpId) => {
  if (!pnpId) {
    return null;
  }
  for (const parser of PARSERS) {
    const sn = pnpId.match(parser);
    if (sn) {
      return sn[1];
    }
  }
  return null;
};

// lib/win32.ts
var debug4 = (0, import_debug6.default)("serialport/bindings-cpp");
var WindowsBinding = {
  async list() {
    const ports = await asyncList();
    return ports.map((port) => {
      if (port.pnpId && !port.serialNumber) {
        const serialNumber = serialNumParser(port.pnpId);
        if (serialNumber) {
          return {
            ...port,
            serialNumber
          };
        }
      }
      return port;
    });
  },
  async open(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError('"options" is not an object');
    }
    if (!options.path) {
      throw new TypeError('"path" is not a valid port');
    }
    if (!options.baudRate) {
      throw new TypeError('"baudRate" is not a valid baudRate');
    }
    debug4("open");
    const openOptions = {
      dataBits: 8,
      lock: true,
      stopBits: 1,
      parity: "none",
      rtscts: false,
      rtsMode: "handshake",
      xon: false,
      xoff: false,
      xany: false,
      hupcl: true,
      ...options
    };
    const fd = await asyncOpen(openOptions.path, openOptions);
    return new WindowsPortBinding(fd, openOptions);
  }
};
var WindowsPortBinding = class {
  constructor(fd, options) {
    this.fd = fd;
    this.openOptions = options;
    this.writeOperation = null;
  }
  get isOpen() {
    return this.fd !== null;
  }
  async close() {
    debug4("close");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    const fd = this.fd;
    this.fd = null;
    await asyncClose(fd);
  }
  async read(buffer, offset, length) {
    if (!Buffer.isBuffer(buffer)) {
      throw new TypeError('"buffer" is not a Buffer');
    }
    if (typeof offset !== "number" || isNaN(offset)) {
      throw new TypeError(`"offset" is not an integer got "${isNaN(offset) ? "NaN" : typeof offset}"`);
    }
    if (typeof length !== "number" || isNaN(length)) {
      throw new TypeError(`"length" is not an integer got "${isNaN(length) ? "NaN" : typeof length}"`);
    }
    debug4("read");
    if (buffer.length < offset + length) {
      throw new Error("buffer is too small");
    }
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    try {
      const bytesRead = await asyncRead(this.fd, buffer, offset, length);
      return { bytesRead, buffer };
    } catch (err) {
      if (!this.isOpen) {
        throw new BindingsError(err.message, { canceled: true });
      }
      throw err;
    }
  }
  async write(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      throw new TypeError('"buffer" is not a Buffer');
    }
    debug4("write", buffer.length, "bytes");
    if (!this.isOpen) {
      debug4("write", "error port is not open");
      throw new Error("Port is not open");
    }
    this.writeOperation = (async () => {
      if (buffer.length === 0) {
        return;
      }
      await asyncWrite(this.fd, buffer);
      this.writeOperation = null;
    })();
    return this.writeOperation;
  }
  async update(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw TypeError('"options" is not an object');
    }
    if (typeof options.baudRate !== "number") {
      throw new TypeError('"options.baudRate" is not a number');
    }
    debug4("update");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    await asyncUpdate(this.fd, options);
  }
  async set(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError('"options" is not an object');
    }
    debug4("set", options);
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    await asyncSet(this.fd, options);
  }
  async get() {
    debug4("get");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    return asyncGet(this.fd);
  }
  async getBaudRate() {
    debug4("getBaudRate");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    return asyncGetBaudRate(this.fd);
  }
  async flush() {
    debug4("flush");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    await asyncFlush(this.fd);
  }
  async drain() {
    debug4("drain");
    if (!this.isOpen) {
      throw new Error("Port is not open");
    }
    await this.writeOperation;
    await asyncDrain(this.fd);
  }
};

// lib/index.ts
var debug5 = (0, import_debug7.default)("serialport/bindings-cpp");
function autoDetect() {
  switch (process.platform) {
    case "win32":
      debug5("loading WindowsBinding");
      return WindowsBinding;
    case "darwin":
      debug5("loading DarwinBinding");
      return DarwinBinding;
    default:
      debug5("loading LinuxBinding");
      return LinuxBinding;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BindingsError,
  DarwinBinding,
  DarwinPortBinding,
  LinuxBinding,
  LinuxPortBinding,
  WindowsBinding,
  WindowsPortBinding,
  autoDetect
});

