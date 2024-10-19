Package["core-runtime"].queue("webapp",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var Log = Package.logging.Log;
var _ = Package.underscore._;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var Boilerplate = Package['boilerplate-generator'].Boilerplate;
var WebAppHashing = Package['webapp-hashing'].WebAppHashing;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var WebApp, WebAppInternals, main;

var require = meteorInstall({"node_modules":{"meteor":{"webapp":{"webapp_server.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// packages/webapp/webapp_server.js                                                                         //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
!module.wrapAsync(async function (module1, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module1.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    module1.export({
      WebApp: () => WebApp,
      WebAppInternals: () => WebAppInternals,
      getGroupInfo: () => getGroupInfo
    });
    let assert;
    module1.link("assert", {
      default(v) {
        assert = v;
      }
    }, 0);
    let readFileSync, chmodSync, chownSync;
    module1.link("fs", {
      readFileSync(v) {
        readFileSync = v;
      },
      chmodSync(v) {
        chmodSync = v;
      },
      chownSync(v) {
        chownSync = v;
      }
    }, 1);
    let createServer;
    module1.link("http", {
      createServer(v) {
        createServer = v;
      }
    }, 2);
    let userInfo;
    module1.link("os", {
      userInfo(v) {
        userInfo = v;
      }
    }, 3);
    let pathJoin, pathDirname;
    module1.link("path", {
      join(v) {
        pathJoin = v;
      },
      dirname(v) {
        pathDirname = v;
      }
    }, 4);
    let parseUrl;
    module1.link("url", {
      parse(v) {
        parseUrl = v;
      }
    }, 5);
    let createHash;
    module1.link("crypto", {
      createHash(v) {
        createHash = v;
      }
    }, 6);
    let express;
    module1.link("express", {
      default(v) {
        express = v;
      }
    }, 7);
    let compress;
    module1.link("compression", {
      default(v) {
        compress = v;
      }
    }, 8);
    let cookieParser;
    module1.link("cookie-parser", {
      default(v) {
        cookieParser = v;
      }
    }, 9);
    let qs;
    module1.link("qs", {
      default(v) {
        qs = v;
      }
    }, 10);
    let parseRequest;
    module1.link("parseurl", {
      default(v) {
        parseRequest = v;
      }
    }, 11);
    let lookupUserAgent;
    module1.link("useragent", {
      lookup(v) {
        lookupUserAgent = v;
      }
    }, 12);
    let isModern;
    module1.link("meteor/modern-browsers", {
      isModern(v) {
        isModern = v;
      }
    }, 13);
    let send;
    module1.link("send", {
      default(v) {
        send = v;
      }
    }, 14);
    let removeExistingSocketFile, registerSocketFileCleanup;
    module1.link("./socket_file.js", {
      removeExistingSocketFile(v) {
        removeExistingSocketFile = v;
      },
      registerSocketFileCleanup(v) {
        registerSocketFileCleanup = v;
      }
    }, 15);
    let cluster;
    module1.link("cluster", {
      default(v) {
        cluster = v;
      }
    }, 16);
    let execSync;
    module1.link("child_process", {
      execSync(v) {
        execSync = v;
      }
    }, 17);
    let onMessage;
    module1.link("meteor/inter-process-messaging", {
      onMessage(v) {
        onMessage = v;
      }
    }, 18);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    var SHORT_SOCKET_TIMEOUT = 5 * 1000;
    var LONG_SOCKET_TIMEOUT = 120 * 1000;
    const createExpressApp = () => {
      const app = express();
      // Security and performace headers
      // these headers come from these docs: https://expressjs.com/en/api.html#app.settings.table
      app.set('x-powered-by', false);
      app.set('etag', false);
      return app;
    };
    const WebApp = {};
    const WebAppInternals = {};
    const hasOwn = Object.prototype.hasOwnProperty;
    WebAppInternals.NpmModules = {
      express: {
        version: Npm.require('express/package.json').version,
        module: express
      }
    };

    // More of a convenience for the end user
    WebApp.express = express;

    // Though we might prefer to use web.browser (modern) as the default
    // architecture, safety requires a more compatible defaultArch.
    WebApp.defaultArch = 'web.browser.legacy';

    // XXX maps archs to manifests
    WebApp.clientPrograms = {};

    // XXX maps archs to program path on filesystem
    var archPath = {};
    var bundledJsCssUrlRewriteHook = function (url) {
      var bundledPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '';
      return bundledPrefix + url;
    };
    var sha1 = function (contents) {
      var hash = createHash('sha1');
      hash.update(contents);
      return hash.digest('hex');
    };
    function shouldCompress(req, res) {
      if (req.headers['x-no-compression']) {
        // don't compress responses with this request header
        return false;
      }

      // fallback to standard filter function
      return compress.filter(req, res);
    }

    // #BrowserIdentification
    //
    // We have multiple places that want to identify the browser: the
    // unsupported browser page, the appcache package, and, eventually
    // delivering browser polyfills only as needed.
    //
    // To avoid detecting the browser in multiple places ad-hoc, we create a
    // Meteor "browser" object. It uses but does not expose the npm
    // useragent module (we could choose a different mechanism to identify
    // the browser in the future if we wanted to).  The browser object
    // contains
    //
    // * `name`: the name of the browser in camel case
    // * `major`, `minor`, `patch`: integers describing the browser version
    //
    // Also here is an early version of a Meteor `request` object, intended
    // to be a high-level description of the request without exposing
    // details of Express's low-level `req`.  Currently it contains:
    //
    // * `browser`: browser identification object described above
    // * `url`: parsed url, including parsed query params
    //
    // As a temporary hack there is a `categorizeRequest` function on WebApp which
    // converts a Express `req` to a Meteor `request`. This can go away once smart
    // packages such as appcache are being passed a `request` object directly when
    // they serve content.
    //
    // This allows `request` to be used uniformly: it is passed to the html
    // attributes hook, and the appcache package can use it when deciding
    // whether to generate a 404 for the manifest.
    //
    // Real routing / server side rendering will probably refactor this
    // heavily.

    // e.g. "Mobile Safari" => "mobileSafari"
    var camelCase = function (name) {
      var parts = name.split(' ');
      parts[0] = parts[0].toLowerCase();
      for (var i = 1; i < parts.length; ++i) {
        parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].substr(1);
      }
      return parts.join('');
    };
    var identifyBrowser = function (userAgentString) {
      var userAgent = lookupUserAgent(userAgentString);
      return {
        name: camelCase(userAgent.family),
        major: +userAgent.major,
        minor: +userAgent.minor,
        patch: +userAgent.patch
      };
    };

    // XXX Refactor as part of implementing real routing.
    WebAppInternals.identifyBrowser = identifyBrowser;
    WebApp.categorizeRequest = function (req) {
      if (req.browser && req.arch && typeof req.modern === 'boolean') {
        // Already categorized.
        return req;
      }
      const browser = identifyBrowser(req.headers['user-agent']);
      const modern = isModern(browser);
      const path = typeof req.pathname === 'string' ? req.pathname : parseRequest(req).pathname;
      const categorized = {
        browser,
        modern,
        path,
        arch: WebApp.defaultArch,
        url: parseUrl(req.url, true),
        dynamicHead: req.dynamicHead,
        dynamicBody: req.dynamicBody,
        headers: req.headers,
        cookies: req.cookies
      };
      const pathParts = path.split('/');
      const archKey = pathParts[1];
      if (archKey.startsWith('__')) {
        const archCleaned = 'web.' + archKey.slice(2);
        if (hasOwn.call(WebApp.clientPrograms, archCleaned)) {
          pathParts.splice(1, 1); // Remove the archKey part.
          return Object.assign(categorized, {
            arch: archCleaned,
            path: pathParts.join('/')
          });
        }
      }

      // TODO Perhaps one day we could infer Cordova clients here, so that we
      // wouldn't have to use prefixed "/__cordova/..." URLs.
      const preferredArchOrder = isModern(browser) ? ['web.browser', 'web.browser.legacy'] : ['web.browser.legacy', 'web.browser'];
      for (const arch of preferredArchOrder) {
        // If our preferred arch is not available, it's better to use another
        // client arch that is available than to guarantee the site won't work
        // by returning an unknown arch. For example, if web.browser.legacy is
        // excluded using the --exclude-archs command-line option, legacy
        // clients are better off receiving web.browser (which might actually
        // work) than receiving an HTTP 404 response. If none of the archs in
        // preferredArchOrder are defined, only then should we send a 404.
        if (hasOwn.call(WebApp.clientPrograms, arch)) {
          return Object.assign(categorized, {
            arch
          });
        }
      }
      return categorized;
    };

    // HTML attribute hooks: functions to be called to determine any attributes to
    // be added to the '<html>' tag. Each function is passed a 'request' object (see
    // #BrowserIdentification) and should return null or object.
    var htmlAttributeHooks = [];
    var getHtmlAttributes = function (request) {
      var combinedAttributes = {};
      _.each(htmlAttributeHooks || [], function (hook) {
        var attributes = hook(request);
        if (attributes === null) return;
        if (typeof attributes !== 'object') throw Error('HTML attribute hook must return null or object');
        _.extend(combinedAttributes, attributes);
      });
      return combinedAttributes;
    };
    WebApp.addHtmlAttributeHook = function (hook) {
      htmlAttributeHooks.push(hook);
    };

    // Serve app HTML for this URL?
    var appUrl = function (url) {
      if (url === '/favicon.ico' || url === '/robots.txt') return false;

      // NOTE: app.manifest is not a web standard like favicon.ico and
      // robots.txt. It is a file name we have chosen to use for HTML5
      // appcache URLs. It is included here to prevent using an appcache
      // then removing it from poisoning an app permanently. Eventually,
      // once we have server side routing, this won't be needed as
      // unknown URLs with return a 404 automatically.
      if (url === '/app.manifest') return false;

      // Avoid serving app HTML for declared routes such as /sockjs/.
      if (RoutePolicy.classify(url)) return false;

      // we currently return app HTML on all URLs by default
      return true;
    };

    // We need to calculate the client hash after all packages have loaded
    // to give them a chance to populate __meteor_runtime_config__.
    //
    // Calculating the hash during startup means that packages can only
    // populate __meteor_runtime_config__ during load, not during startup.
    //
    // Calculating instead it at the beginning of main after all startup
    // hooks had run would allow packages to also populate
    // __meteor_runtime_config__ during startup, but that's too late for
    // autoupdate because it needs to have the client hash at startup to
    // insert the auto update version itself into
    // __meteor_runtime_config__ to get it to the client.
    //
    // An alternative would be to give autoupdate a "post-start,
    // pre-listen" hook to allow it to insert the auto update version at
    // the right moment.

    Meteor.startup(function () {
      function getter(key) {
        return function (arch) {
          arch = arch || WebApp.defaultArch;
          const program = WebApp.clientPrograms[arch];
          const value = program && program[key];
          // If this is the first time we have calculated this hash,
          // program[key] will be a thunk (lazy function with no parameters)
          // that we should call to do the actual computation.
          return typeof value === 'function' ? program[key] = value() : value;
        };
      }
      WebApp.calculateClientHash = WebApp.clientHash = getter('version');
      WebApp.calculateClientHashRefreshable = getter('versionRefreshable');
      WebApp.calculateClientHashNonRefreshable = getter('versionNonRefreshable');
      WebApp.calculateClientHashReplaceable = getter('versionReplaceable');
      WebApp.getRefreshableAssets = getter('refreshableAssets');
    });

    // When we have a request pending, we want the socket timeout to be long, to
    // give ourselves a while to serve it, and to allow sockjs long polls to
    // complete.  On the other hand, we want to close idle sockets relatively
    // quickly, so that we can shut down relatively promptly but cleanly, without
    // cutting off anyone's response.
    WebApp._timeoutAdjustmentRequestCallback = function (req, res) {
      // this is really just req.socket.setTimeout(LONG_SOCKET_TIMEOUT);
      req.setTimeout(LONG_SOCKET_TIMEOUT);
      // Insert our new finish listener to run BEFORE the existing one which removes
      // the response from the socket.
      var finishListeners = res.listeners('finish');
      // XXX Apparently in Node 0.12 this event was called 'prefinish'.
      // https://github.com/joyent/node/commit/7c9b6070
      // But it has switched back to 'finish' in Node v4:
      // https://github.com/nodejs/node/pull/1411
      res.removeAllListeners('finish');
      res.on('finish', function () {
        res.setTimeout(SHORT_SOCKET_TIMEOUT);
      });
      _.each(finishListeners, function (l) {
        res.on('finish', l);
      });
    };

    // Will be updated by main before we listen.
    // Map from client arch to boilerplate object.
    // Boilerplate object has:
    //   - func: XXX
    //   - baseData: XXX
    var boilerplateByArch = {};

    // Register a callback function that can selectively modify boilerplate
    // data given arguments (request, data, arch). The key should be a unique
    // identifier, to prevent accumulating duplicate callbacks from the same
    // call site over time. Callbacks will be called in the order they were
    // registered. A callback should return false if it did not make any
    // changes affecting the boilerplate. Passing null deletes the callback.
    // Any previous callback registered for this key will be returned.
    const boilerplateDataCallbacks = Object.create(null);
    WebAppInternals.registerBoilerplateDataCallback = function (key, callback) {
      const previousCallback = boilerplateDataCallbacks[key];
      if (typeof callback === 'function') {
        boilerplateDataCallbacks[key] = callback;
      } else {
        assert.strictEqual(callback, null);
        delete boilerplateDataCallbacks[key];
      }

      // Return the previous callback in case the new callback needs to call
      // it; for example, when the new callback is a wrapper for the old.
      return previousCallback || null;
    };

    // Given a request (as returned from `categorizeRequest`), return the
    // boilerplate HTML to serve for that request.
    //
    // If a previous Express middleware has rendered content for the head or body,
    // returns the boilerplate with that content patched in otherwise
    // memoizes on HTML attributes (used by, eg, appcache) and whether inline
    // scripts are currently allowed.
    // XXX so far this function is always called with arch === 'web.browser'
    function getBoilerplate(request, arch) {
      return getBoilerplateAsync(request, arch);
    }

    /**
     * @summary Takes a runtime configuration object and
     * returns an encoded runtime string.
     * @locus Server
     * @param {Object} rtimeConfig
     * @returns {String}
     */
    WebApp.encodeRuntimeConfig = function (rtimeConfig) {
      return JSON.stringify(encodeURIComponent(JSON.stringify(rtimeConfig)));
    };

    /**
     * @summary Takes an encoded runtime string and returns
     * a runtime configuration object.
     * @locus Server
     * @param {String} rtimeConfigString
     * @returns {Object}
     */
    WebApp.decodeRuntimeConfig = function (rtimeConfigStr) {
      return JSON.parse(decodeURIComponent(JSON.parse(rtimeConfigStr)));
    };
    const runtimeConfig = {
      // hooks will contain the callback functions
      // set by the caller to addRuntimeConfigHook
      hooks: new Hook(),
      // updateHooks will contain the callback functions
      // set by the caller to addUpdatedNotifyHook
      updateHooks: new Hook(),
      // isUpdatedByArch is an object containing fields for each arch
      // that this server supports.
      // - Each field will be true when the server updates the runtimeConfig for that arch.
      // - When the hook callback is called the update field in the callback object will be
      // set to isUpdatedByArch[arch].
      // = isUpdatedyByArch[arch] is reset to false after the callback.
      // This enables the caller to cache data efficiently so they do not need to
      // decode & update data on every callback when the runtimeConfig is not changing.
      isUpdatedByArch: {}
    };

    /**
     * @name addRuntimeConfigHookCallback(options)
     * @locus Server
     * @isprototype true
     * @summary Callback for `addRuntimeConfigHook`.
     *
     * If the handler returns a _falsy_ value the hook will not
     * modify the runtime configuration.
     *
     * If the handler returns a _String_ the hook will substitute
     * the string for the encoded configuration string.
     *
     * **Warning:** the hook does not check the return value at all it is
     * the responsibility of the caller to get the formatting correct using
     * the helper functions.
     *
     * `addRuntimeConfigHookCallback` takes only one `Object` argument
     * with the following fields:
     * @param {Object} options
     * @param {String} options.arch The architecture of the client
     * requesting a new runtime configuration. This can be one of
     * `web.browser`, `web.browser.legacy` or `web.cordova`.
     * @param {Object} options.request
     * A NodeJs [IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
     * https://nodejs.org/api/http.html#http_class_http_incomingmessage
     * `Object` that can be used to get information about the incoming request.
     * @param {String} options.encodedCurrentConfig The current configuration object
     * encoded as a string for inclusion in the root html.
     * @param {Boolean} options.updated `true` if the config for this architecture
     * has been updated since last called, otherwise `false`. This flag can be used
     * to cache the decoding/encoding for each architecture.
     */

    /**
     * @summary Hook that calls back when the meteor runtime configuration,
     * `__meteor_runtime_config__` is being sent to any client.
     *
     * **returns**: <small>_Object_</small> `{ stop: function, callback: function }`
     * - `stop` <small>_Function_</small> Call `stop()` to stop getting callbacks.
     * - `callback` <small>_Function_</small> The passed in `callback`.
     * @locus Server
     * @param {addRuntimeConfigHookCallback} callback
     * See `addRuntimeConfigHookCallback` description.
     * @returns {Object} {{ stop: function, callback: function }}
     * Call the returned `stop()` to stop getting callbacks.
     * The passed in `callback` is returned also.
     */
    WebApp.addRuntimeConfigHook = function (callback) {
      return runtimeConfig.hooks.register(callback);
    };
    async function getBoilerplateAsync(request, arch) {
      let boilerplate = boilerplateByArch[arch];
      await runtimeConfig.hooks.forEachAsync(async hook => {
        const meteorRuntimeConfig = await hook({
          arch,
          request,
          encodedCurrentConfig: boilerplate.baseData.meteorRuntimeConfig,
          updated: runtimeConfig.isUpdatedByArch[arch]
        });
        if (!meteorRuntimeConfig) return true;
        boilerplate.baseData = Object.assign({}, boilerplate.baseData, {
          meteorRuntimeConfig
        });
        return true;
      });
      runtimeConfig.isUpdatedByArch[arch] = false;
      const data = Object.assign({}, boilerplate.baseData, {
        htmlAttributes: getHtmlAttributes(request)
      }, _.pick(request, 'dynamicHead', 'dynamicBody'));
      let madeChanges = false;
      let promise = Promise.resolve();
      Object.keys(boilerplateDataCallbacks).forEach(key => {
        promise = promise.then(() => {
          const callback = boilerplateDataCallbacks[key];
          return callback(request, data, arch);
        }).then(result => {
          // Callbacks should return false if they did not make any changes.
          if (result !== false) {
            madeChanges = true;
          }
        });
      });
      return promise.then(() => ({
        stream: boilerplate.toHTMLStream(data),
        statusCode: data.statusCode,
        headers: data.headers
      }));
    }

    /**
     * @name addUpdatedNotifyHookCallback(options)
     * @summary callback handler for `addupdatedNotifyHook`
     * @isprototype true
     * @locus Server
     * @param {Object} options
     * @param {String} options.arch The architecture that is being updated.
     * This can be one of `web.browser`, `web.browser.legacy` or `web.cordova`.
     * @param {Object} options.manifest The new updated manifest object for
     * this `arch`.
     * @param {Object} options.runtimeConfig The new updated configuration
     * object for this `arch`.
     */

    /**
     * @summary Hook that runs when the meteor runtime configuration
     * is updated.  Typically the configuration only changes during development mode.
     * @locus Server
     * @param {addUpdatedNotifyHookCallback} handler
     * The `handler` is called on every change to an `arch` runtime configuration.
     * See `addUpdatedNotifyHookCallback`.
     * @returns {Object} {{ stop: function, callback: function }}
     */
    WebApp.addUpdatedNotifyHook = function (handler) {
      return runtimeConfig.updateHooks.register(handler);
    };
    WebAppInternals.generateBoilerplateInstance = function (arch, manifest, additionalOptions) {
      additionalOptions = additionalOptions || {};
      runtimeConfig.isUpdatedByArch[arch] = true;
      const rtimeConfig = _objectSpread(_objectSpread({}, __meteor_runtime_config__), additionalOptions.runtimeConfigOverrides || {});
      runtimeConfig.updateHooks.forEach(cb => {
        cb({
          arch,
          manifest,
          runtimeConfig: rtimeConfig
        });
        return true;
      });
      const meteorRuntimeConfig = JSON.stringify(encodeURIComponent(JSON.stringify(rtimeConfig)));
      return new Boilerplate(arch, manifest, Object.assign({
        pathMapper(itemPath) {
          return pathJoin(archPath[arch], itemPath);
        },
        baseDataExtension: {
          additionalStaticJs: _.map(additionalStaticJs || [], function (contents, pathname) {
            return {
              pathname: pathname,
              contents: contents
            };
          }),
          // Convert to a JSON string, then get rid of most weird characters, then
          // wrap in double quotes. (The outermost JSON.stringify really ought to
          // just be "wrap in double quotes" but we use it to be safe.) This might
          // end up inside a <script> tag so we need to be careful to not include
          // "</script>", but normal {{spacebars}} escaping escapes too much! See
          // https://github.com/meteor/meteor/issues/3730
          meteorRuntimeConfig,
          meteorRuntimeHash: sha1(meteorRuntimeConfig),
          rootUrlPathPrefix: __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '',
          bundledJsCssUrlRewriteHook: bundledJsCssUrlRewriteHook,
          sriMode: sriMode,
          inlineScriptsAllowed: WebAppInternals.inlineScriptsAllowed(),
          inline: additionalOptions.inline
        }
      }, additionalOptions));
    };

    // A mapping from url path to architecture (e.g. "web.browser") to static
    // file information with the following fields:
    // - type: the type of file to be served
    // - cacheable: optionally, whether the file should be cached or not
    // - sourceMapUrl: optionally, the url of the source map
    //
    // Info also contains one of the following:
    // - content: the stringified content that should be served at this path
    // - absolutePath: the absolute path on disk to the file

    // Serve static files from the manifest or added with
    // `addStaticJs`. Exported for tests.
    WebAppInternals.staticFilesMiddleware = async function (staticFilesByArch, req, res, next) {
      var _Meteor$settings$pack3, _Meteor$settings$pack4;
      var pathname = parseRequest(req).pathname;
      try {
        pathname = decodeURIComponent(pathname);
      } catch (e) {
        next();
        return;
      }
      var serveStaticJs = function (s) {
        var _Meteor$settings$pack, _Meteor$settings$pack2;
        if (req.method === 'GET' || req.method === 'HEAD' || (_Meteor$settings$pack = Meteor.settings.packages) !== null && _Meteor$settings$pack !== void 0 && (_Meteor$settings$pack2 = _Meteor$settings$pack.webapp) !== null && _Meteor$settings$pack2 !== void 0 && _Meteor$settings$pack2.alwaysReturnContent) {
          res.writeHead(200, {
            'Content-type': 'application/javascript; charset=UTF-8',
            'Content-Length': Buffer.byteLength(s)
          });
          res.write(s);
          res.end();
        } else {
          const status = req.method === 'OPTIONS' ? 200 : 405;
          res.writeHead(status, {
            Allow: 'OPTIONS, GET, HEAD',
            'Content-Length': '0'
          });
          res.end();
        }
      };
      if (_.has(additionalStaticJs, pathname) && !WebAppInternals.inlineScriptsAllowed()) {
        serveStaticJs(additionalStaticJs[pathname]);
        return;
      }
      const {
        arch,
        path
      } = WebApp.categorizeRequest(req);
      if (!hasOwn.call(WebApp.clientPrograms, arch)) {
        // We could come here in case we run with some architectures excluded
        next();
        return;
      }

      // If pauseClient(arch) has been called, program.paused will be a
      // Promise that will be resolved when the program is unpaused.
      const program = WebApp.clientPrograms[arch];
      await program.paused;
      if (path === '/meteor_runtime_config.js' && !WebAppInternals.inlineScriptsAllowed()) {
        serveStaticJs("__meteor_runtime_config__ = ".concat(program.meteorRuntimeConfig, ";"));
        return;
      }
      const info = getStaticFileInfo(staticFilesByArch, pathname, path, arch);
      if (!info) {
        next();
        return;
      }
      // "send" will handle HEAD & GET requests
      if (req.method !== 'HEAD' && req.method !== 'GET' && !((_Meteor$settings$pack3 = Meteor.settings.packages) !== null && _Meteor$settings$pack3 !== void 0 && (_Meteor$settings$pack4 = _Meteor$settings$pack3.webapp) !== null && _Meteor$settings$pack4 !== void 0 && _Meteor$settings$pack4.alwaysReturnContent)) {
        const status = req.method === 'OPTIONS' ? 200 : 405;
        res.writeHead(status, {
          Allow: 'OPTIONS, GET, HEAD',
          'Content-Length': '0'
        });
        res.end();
        return;
      }

      // We don't need to call pause because, unlike 'static', once we call into
      // 'send' and yield to the event loop, we never call another handler with
      // 'next'.

      // Cacheable files are files that should never change. Typically
      // named by their hash (eg meteor bundled js and css files).
      // We cache them ~forever (1yr).
      const maxAge = info.cacheable ? 1000 * 60 * 60 * 24 * 365 : 0;
      if (info.cacheable) {
        // Since we use req.headers["user-agent"] to determine whether the
        // client should receive modern or legacy resources, tell the client
        // to invalidate cached resources when/if its user agent string
        // changes in the future.
        res.setHeader('Vary', 'User-Agent');
      }

      // Set the X-SourceMap header, which current Chrome, FireFox, and Safari
      // understand.  (The SourceMap header is slightly more spec-correct but FF
      // doesn't understand it.)
      //
      // You may also need to enable source maps in Chrome: open dev tools, click
      // the gear in the bottom right corner, and select "enable source maps".
      if (info.sourceMapUrl) {
        res.setHeader('X-SourceMap', __meteor_runtime_config__.ROOT_URL_PATH_PREFIX + info.sourceMapUrl);
      }
      if (info.type === 'js' || info.type === 'dynamic js') {
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      } else if (info.type === 'css') {
        res.setHeader('Content-Type', 'text/css; charset=UTF-8');
      } else if (info.type === 'json') {
        res.setHeader('Content-Type', 'application/json; charset=UTF-8');
      }
      if (info.hash) {
        res.setHeader('ETag', '"' + info.hash + '"');
      }
      if (info.content) {
        res.setHeader('Content-Length', Buffer.byteLength(info.content));
        res.write(info.content);
        res.end();
      } else {
        send(req, info.absolutePath, {
          maxage: maxAge,
          dotfiles: 'allow',
          // if we specified a dotfile in the manifest, serve it
          lastModified: false // don't set last-modified based on the file date
        }).on('error', function (err) {
          Log.error('Error serving static file ' + err);
          res.writeHead(500);
          res.end();
        }).on('directory', function () {
          Log.error('Unexpected directory ' + info.absolutePath);
          res.writeHead(500);
          res.end();
        }).pipe(res);
      }
    };
    function getStaticFileInfo(staticFilesByArch, originalPath, path, arch) {
      if (!hasOwn.call(WebApp.clientPrograms, arch)) {
        return null;
      }

      // Get a list of all available static file architectures, with arch
      // first in the list if it exists.
      const staticArchList = Object.keys(staticFilesByArch);
      const archIndex = staticArchList.indexOf(arch);
      if (archIndex > 0) {
        staticArchList.unshift(staticArchList.splice(archIndex, 1)[0]);
      }
      let info = null;
      staticArchList.some(arch => {
        const staticFiles = staticFilesByArch[arch];
        function finalize(path) {
          info = staticFiles[path];
          // Sometimes we register a lazy function instead of actual data in
          // the staticFiles manifest.
          if (typeof info === 'function') {
            info = staticFiles[path] = info();
          }
          return info;
        }

        // If staticFiles contains originalPath with the arch inferred above,
        // use that information.
        if (hasOwn.call(staticFiles, originalPath)) {
          return finalize(originalPath);
        }

        // If categorizeRequest returned an alternate path, try that instead.
        if (path !== originalPath && hasOwn.call(staticFiles, path)) {
          return finalize(path);
        }
      });
      return info;
    }

    // Parse the passed in port value. Return the port as-is if it's a String
    // (e.g. a Windows Server style named pipe), otherwise return the port as an
    // integer.
    //
    // DEPRECATED: Direct use of this function is not recommended; it is no
    // longer used internally, and will be removed in a future release.
    WebAppInternals.parsePort = port => {
      let parsedPort = parseInt(port);
      if (Number.isNaN(parsedPort)) {
        parsedPort = port;
      }
      return parsedPort;
    };
    onMessage('webapp-pause-client', async _ref => {
      let {
        arch
      } = _ref;
      await WebAppInternals.pauseClient(arch);
    });
    onMessage('webapp-reload-client', async _ref2 => {
      let {
        arch
      } = _ref2;
      await WebAppInternals.generateClientProgram(arch);
    });
    async function runWebAppServer() {
      var shuttingDown = false;
      var syncQueue = new Meteor._AsynchronousQueue();
      var getItemPathname = function (itemUrl) {
        return decodeURIComponent(parseUrl(itemUrl).pathname);
      };
      WebAppInternals.reloadClientPrograms = async function () {
        await syncQueue.runTask(function () {
          const staticFilesByArch = Object.create(null);
          const {
            configJson
          } = __meteor_bootstrap__;
          const clientArchs = configJson.clientArchs || Object.keys(configJson.clientPaths);
          try {
            clientArchs.forEach(arch => {
              generateClientProgram(arch, staticFilesByArch);
            });
            WebAppInternals.staticFilesByArch = staticFilesByArch;
          } catch (e) {
            Log.error('Error reloading the client program: ' + e.stack);
            process.exit(1);
          }
        });
      };

      // Pause any incoming requests and make them wait for the program to be
      // unpaused the next time generateClientProgram(arch) is called.
      WebAppInternals.pauseClient = async function (arch) {
        await syncQueue.runTask(() => {
          const program = WebApp.clientPrograms[arch];
          const {
            unpause
          } = program;
          program.paused = new Promise(resolve => {
            if (typeof unpause === 'function') {
              // If there happens to be an existing program.unpause function,
              // compose it with the resolve function.
              program.unpause = function () {
                unpause();
                resolve();
              };
            } else {
              program.unpause = resolve;
            }
          });
        });
      };
      WebAppInternals.generateClientProgram = async function (arch) {
        await syncQueue.runTask(() => generateClientProgram(arch));
      };
      function generateClientProgram(arch) {
        let staticFilesByArch = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : WebAppInternals.staticFilesByArch;
        const clientDir = pathJoin(pathDirname(__meteor_bootstrap__.serverDir), arch);

        // read the control for the client we'll be serving up
        const programJsonPath = pathJoin(clientDir, 'program.json');
        let programJson;
        try {
          programJson = JSON.parse(readFileSync(programJsonPath));
        } catch (e) {
          if (e.code === 'ENOENT') return;
          throw e;
        }
        if (programJson.format !== 'web-program-pre1') {
          throw new Error('Unsupported format for client assets: ' + JSON.stringify(programJson.format));
        }
        if (!programJsonPath || !clientDir || !programJson) {
          throw new Error('Client config file not parsed.');
        }
        archPath[arch] = clientDir;
        const staticFiles = staticFilesByArch[arch] = Object.create(null);
        const {
          manifest
        } = programJson;
        manifest.forEach(item => {
          if (item.url && item.where === 'client') {
            staticFiles[getItemPathname(item.url)] = {
              absolutePath: pathJoin(clientDir, item.path),
              cacheable: item.cacheable,
              hash: item.hash,
              // Link from source to its map
              sourceMapUrl: item.sourceMapUrl,
              type: item.type
            };
            if (item.sourceMap) {
              // Serve the source map too, under the specified URL. We assume
              // all source maps are cacheable.
              staticFiles[getItemPathname(item.sourceMapUrl)] = {
                absolutePath: pathJoin(clientDir, item.sourceMap),
                cacheable: true
              };
            }
          }
        });
        const {
          PUBLIC_SETTINGS
        } = __meteor_runtime_config__;
        const configOverrides = {
          PUBLIC_SETTINGS
        };
        const oldProgram = WebApp.clientPrograms[arch];
        const newProgram = WebApp.clientPrograms[arch] = {
          format: 'web-program-pre1',
          manifest: manifest,
          // Use arrow functions so that these versions can be lazily
          // calculated later, and so that they will not be included in the
          // staticFiles[manifestUrl].content string below.
          //
          // Note: these version calculations must be kept in agreement with
          // CordovaBuilder#appendVersion in tools/cordova/builder.js, or hot
          // code push will reload Cordova apps unnecessarily.
          version: () => WebAppHashing.calculateClientHash(manifest, null, configOverrides),
          versionRefreshable: () => WebAppHashing.calculateClientHash(manifest, type => type === 'css', configOverrides),
          versionNonRefreshable: () => WebAppHashing.calculateClientHash(manifest, (type, replaceable) => type !== 'css' && !replaceable, configOverrides),
          versionReplaceable: () => WebAppHashing.calculateClientHash(manifest, (_type, replaceable) => replaceable, configOverrides),
          cordovaCompatibilityVersions: programJson.cordovaCompatibilityVersions,
          PUBLIC_SETTINGS,
          hmrVersion: programJson.hmrVersion
        };

        // Expose program details as a string reachable via the following URL.
        const manifestUrlPrefix = '/__' + arch.replace(/^web\./, '');
        const manifestUrl = manifestUrlPrefix + getItemPathname('/manifest.json');
        staticFiles[manifestUrl] = () => {
          if (Package.autoupdate) {
            const {
              AUTOUPDATE_VERSION = Package.autoupdate.Autoupdate.autoupdateVersion
            } = process.env;
            if (AUTOUPDATE_VERSION) {
              newProgram.version = AUTOUPDATE_VERSION;
            }
          }
          if (typeof newProgram.version === 'function') {
            newProgram.version = newProgram.version();
          }
          return {
            content: JSON.stringify(newProgram),
            cacheable: false,
            hash: newProgram.version,
            type: 'json'
          };
        };
        generateBoilerplateForArch(arch);

        // If there are any requests waiting on oldProgram.paused, let them
        // continue now (using the new program).
        if (oldProgram && oldProgram.paused) {
          oldProgram.unpause();
        }
      }
      const defaultOptionsForArch = {
        'web.cordova': {
          runtimeConfigOverrides: {
            // XXX We use absoluteUrl() here so that we serve https://
            // URLs to cordova clients if force-ssl is in use. If we were
            // to use __meteor_runtime_config__.ROOT_URL instead of
            // absoluteUrl(), then Cordova clients would immediately get a
            // HCP setting their DDP_DEFAULT_CONNECTION_URL to
            // http://example.meteor.com. This breaks the app, because
            // force-ssl doesn't serve CORS headers on 302
            // redirects. (Plus it's undesirable to have clients
            // connecting to http://example.meteor.com when force-ssl is
            // in use.)
            DDP_DEFAULT_CONNECTION_URL: process.env.MOBILE_DDP_URL || Meteor.absoluteUrl(),
            ROOT_URL: process.env.MOBILE_ROOT_URL || Meteor.absoluteUrl()
          }
        },
        'web.browser': {
          runtimeConfigOverrides: {
            isModern: true
          }
        },
        'web.browser.legacy': {
          runtimeConfigOverrides: {
            isModern: false
          }
        }
      };
      WebAppInternals.generateBoilerplate = async function () {
        // This boilerplate will be served to the mobile devices when used with
        // Meteor/Cordova for the Hot-Code Push and since the file will be served by
        // the device's server, it is important to set the DDP url to the actual
        // Meteor server accepting DDP connections and not the device's file server.
        await syncQueue.runTask(function () {
          Object.keys(WebApp.clientPrograms).forEach(generateBoilerplateForArch);
        });
      };
      function generateBoilerplateForArch(arch) {
        const program = WebApp.clientPrograms[arch];
        const additionalOptions = defaultOptionsForArch[arch] || {};
        const {
          baseData
        } = boilerplateByArch[arch] = WebAppInternals.generateBoilerplateInstance(arch, program.manifest, additionalOptions);
        // We need the runtime config with overrides for meteor_runtime_config.js:
        program.meteorRuntimeConfig = JSON.stringify(_objectSpread(_objectSpread({}, __meteor_runtime_config__), additionalOptions.runtimeConfigOverrides || null));
        program.refreshableAssets = baseData.css.map(file => ({
          url: bundledJsCssUrlRewriteHook(file.url)
        }));
      }
      await WebAppInternals.reloadClientPrograms();

      // webserver
      var app = createExpressApp();

      // Packages and apps can add handlers that run before any other Meteor
      // handlers via WebApp.rawExpressHandlers.
      var rawExpressHandlers = createExpressApp();
      app.use(rawExpressHandlers);

      // Auto-compress any json, javascript, or text.
      app.use(compress({
        filter: shouldCompress
      }));

      // parse cookies into an object
      app.use(cookieParser());

      // We're not a proxy; reject (without crashing) attempts to treat us like
      // one. (See #1212.)
      app.use(function (req, res, next) {
        if (RoutePolicy.isValidUrl(req.url)) {
          next();
          return;
        }
        res.writeHead(400);
        res.write('Not a proxy');
        res.end();
      });

      // Parse the query string into res.query. Used by oauth_server, but it's
      // generally pretty handy..
      //
      // Do this before the next middleware destroys req.url if a path prefix
      // is set to close #10111.
      app.use(function (request, response, next) {
        request.query = qs.parse(parseUrl(request.url).query);
        next();
      });
      function getPathParts(path) {
        const parts = path.split('/');
        while (parts[0] === '') parts.shift();
        return parts;
      }
      function isPrefixOf(prefix, array) {
        return prefix.length <= array.length && prefix.every((part, i) => part === array[i]);
      }

      // Strip off the path prefix, if it exists.
      app.use(function (request, response, next) {
        const pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX;
        const {
          pathname,
          search
        } = parseUrl(request.url);

        // check if the path in the url starts with the path prefix
        if (pathPrefix) {
          const prefixParts = getPathParts(pathPrefix);
          const pathParts = getPathParts(pathname);
          if (isPrefixOf(prefixParts, pathParts)) {
            request.url = '/' + pathParts.slice(prefixParts.length).join('/');
            if (search) {
              request.url += search;
            }
            return next();
          }
        }
        if (pathname === '/favicon.ico' || pathname === '/robots.txt') {
          return next();
        }
        if (pathPrefix) {
          response.writeHead(404);
          response.write('Unknown path');
          response.end();
          return;
        }
        next();
      });

      // Serve static files from the manifest.
      // This is inspired by the 'static' middleware.
      app.use(function (req, res, next) {
        // console.log(String(arguments.callee));
        WebAppInternals.staticFilesMiddleware(WebAppInternals.staticFilesByArch, req, res, next);
      });

      // Core Meteor packages like dynamic-import can add handlers before
      // other handlers added by package and application code.
      app.use(WebAppInternals.meteorInternalHandlers = createExpressApp());

      /**
       * @name expressHandlersCallback(req, res, next)
       * @locus Server
       * @isprototype true
       * @summary callback handler for `WebApp.expressHandlers`
       * @param {Object} req
       * a Node.js
       * [IncomingMessage](https://nodejs.org/api/http.html#class-httpincomingmessage)
       * object with some extra properties. This argument can be used
       *  to get information about the incoming request.
       * @param {Object} res
       * a Node.js
       * [ServerResponse](https://nodejs.org/api/http.html#class-httpserverresponse)
       * object. Use this to write data that should be sent in response to the
       * request, and call `res.end()` when you are done.
       * @param {Function} next
       * Calling this function will pass on the handling of
       * this request to the next relevant handler.
       *
       */

      /**
       * @method handlers
       * @memberof WebApp
       * @locus Server
       * @summary Register a handler for all HTTP requests.
       * @param {String} [path]
       * This handler will only be called on paths that match
       * this string. The match has to border on a `/` or a `.`.
       *
       * For example, `/hello` will match `/hello/world` and
       * `/hello.world`, but not `/hello_world`.
       * @param {expressHandlersCallback} handler
       * A handler function that will be called on HTTP requests.
       * See `expressHandlersCallback`
       *
       */
      // Packages and apps can add handlers to this via WebApp.expressHandlers.
      // They are inserted before our default handler.
      var packageAndAppHandlers = createExpressApp();
      app.use(packageAndAppHandlers);
      let suppressExpressErrors = false;
      // Express knows it is an error handler because it has 4 arguments instead of
      // 3. go figure.  (It is not smart enough to find such a thing if it's hidden
      // inside packageAndAppHandlers.)
      app.use(function (err, req, res, next) {
        if (!err || !suppressExpressErrors || !req.headers['x-suppress-error']) {
          next(err);
          return;
        }
        res.writeHead(err.status, {
          'Content-Type': 'text/plain'
        });
        res.end('An error message');
      });
      app.use(async function (req, res, next) {
        var _Meteor$settings$pack5, _Meteor$settings$pack6;
        if (!appUrl(req.url)) {
          return next();
        } else if (req.method !== 'HEAD' && req.method !== 'GET' && !((_Meteor$settings$pack5 = Meteor.settings.packages) !== null && _Meteor$settings$pack5 !== void 0 && (_Meteor$settings$pack6 = _Meteor$settings$pack5.webapp) !== null && _Meteor$settings$pack6 !== void 0 && _Meteor$settings$pack6.alwaysReturnContent)) {
          const status = req.method === 'OPTIONS' ? 200 : 405;
          res.writeHead(status, {
            Allow: 'OPTIONS, GET, HEAD',
            'Content-Length': '0'
          });
          res.end();
        } else {
          var headers = {
            'Content-Type': 'text/html; charset=utf-8'
          };
          if (shuttingDown) {
            headers['Connection'] = 'Close';
          }
          var request = WebApp.categorizeRequest(req);
          if (request.url.query && request.url.query['meteor_css_resource']) {
            // In this case, we're requesting a CSS resource in the meteor-specific
            // way, but we don't have it.  Serve a static css file that indicates that
            // we didn't have it, so we can detect that and refresh.  Make sure
            // that any proxies or CDNs don't cache this error!  (Normally proxies
            // or CDNs are smart enough not to cache error pages, but in order to
            // make this hack work, we need to return the CSS file as a 200, which
            // would otherwise be cached.)
            headers['Content-Type'] = 'text/css; charset=utf-8';
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(200, headers);
            res.write('.meteor-css-not-found-error { width: 0px;}');
            res.end();
            return;
          }
          if (request.url.query && request.url.query['meteor_js_resource']) {
            // Similarly, we're requesting a JS resource that we don't have.
            // Serve an uncached 404. (We can't use the same hack we use for CSS,
            // because actually acting on that hack requires us to have the JS
            // already!)
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(404, headers);
            res.end('404 Not Found');
            return;
          }
          if (request.url.query && request.url.query['meteor_dont_serve_index']) {
            // When downloading files during a Cordova hot code push, we need
            // to detect if a file is not available instead of inadvertently
            // downloading the default index page.
            // So similar to the situation above, we serve an uncached 404.
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(404, headers);
            res.end('404 Not Found');
            return;
          }
          const {
            arch
          } = request;
          assert.strictEqual(typeof arch, 'string', {
            arch
          });
          if (!hasOwn.call(WebApp.clientPrograms, arch)) {
            // We could come here in case we run with some architectures excluded
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(404, headers);
            if (Meteor.isDevelopment) {
              res.end("No client program found for the ".concat(arch, " architecture."));
            } else {
              // Safety net, but this branch should not be possible.
              res.end('404 Not Found');
            }
            return;
          }

          // If pauseClient(arch) has been called, program.paused will be a
          // Promise that will be resolved when the program is unpaused.
          await WebApp.clientPrograms[arch].paused;
          return getBoilerplateAsync(request, arch).then(_ref3 => {
            let {
              stream,
              statusCode,
              headers: newHeaders
            } = _ref3;
            if (!statusCode) {
              statusCode = res.statusCode ? res.statusCode : 200;
            }
            if (newHeaders) {
              Object.assign(headers, newHeaders);
            }
            res.writeHead(statusCode, headers);
            stream.pipe(res, {
              // End the response when the stream ends.
              end: true
            });
          }).catch(error => {
            Log.error('Error running template: ' + error.stack);
            res.writeHead(500, headers);
            res.end();
          });
        }
      });

      // Return 404 by default, if no other handlers serve this URL.
      app.use(function (req, res) {
        res.writeHead(404);
        res.end();
      });
      var httpServer = createServer(app);
      var onListeningCallbacks = [];

      // After 5 seconds w/o data on a socket, kill it.  On the other hand, if
      // there's an outstanding request, give it a higher timeout instead (to avoid
      // killing long-polling requests)
      httpServer.setTimeout(SHORT_SOCKET_TIMEOUT);

      // Do this here, and then also in livedata/stream_server.js, because
      // stream_server.js kills all the current request handlers when installing its
      // own.
      httpServer.on('request', WebApp._timeoutAdjustmentRequestCallback);

      // If the client gave us a bad request, tell it instead of just closing the
      // socket. This lets load balancers in front of us differentiate between "a
      // server is randomly closing sockets for no reason" and "client sent a bad
      // request".
      //
      // This will only work on Node 6; Node 4 destroys the socket before calling
      // this event. See https://github.com/nodejs/node/pull/4557/ for details.
      httpServer.on('clientError', (err, socket) => {
        // Pre-Node-6, do nothing.
        if (socket.destroyed) {
          return;
        }
        if (err.message === 'Parse Error') {
          socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        } else {
          // For other errors, use the default behavior as if we had no clientError
          // handler.
          socket.destroy(err);
        }
      });
      const suppressErrors = function () {
        suppressExpressErrors = true;
      };
      let warnedAboutConnectUsage = false;

      // start up app
      _.extend(WebApp, {
        connectHandlers: packageAndAppHandlers,
        handlers: packageAndAppHandlers,
        rawConnectHandlers: rawExpressHandlers,
        rawHandlers: rawExpressHandlers,
        httpServer: httpServer,
        expressApp: app,
        // For testing.
        suppressConnectErrors: () => {
          if (!warnedAboutConnectUsage) {
            Meteor._debug("WebApp.suppressConnectErrors has been renamed to Meteor._suppressExpressErrors and it should be used only in tests.");
            warnedAboutConnectUsage = true;
          }
          suppressErrors();
        },
        _suppressExpressErrors: suppressErrors,
        onListening: function (f) {
          if (onListeningCallbacks) onListeningCallbacks.push(f);else f();
        },
        // This can be overridden by users who want to modify how listening works
        // (eg, to run a proxy like Apollo Engine Proxy in front of the server).
        startListening: function (httpServer, listenOptions, cb) {
          httpServer.listen(listenOptions, cb);
        }
      });

      /**
      * @name main
      * @locus Server
      * @summary Starts the HTTP server.
      *  If `UNIX_SOCKET_PATH` is present Meteor's HTTP server will use that socket file for inter-process communication, instead of TCP.
      * If you choose to not include webapp package in your application this method still must be defined for your Meteor application to work.
      */
      // Let the rest of the packages (and Meteor.startup hooks) insert Express
      // middlewares and update __meteor_runtime_config__, then keep going to set up
      // actually serving HTML.
      exports.main = async argv => {
        await WebAppInternals.generateBoilerplate();
        const startHttpServer = listenOptions => {
          WebApp.startListening((argv === null || argv === void 0 ? void 0 : argv.httpServer) || httpServer, listenOptions, Meteor.bindEnvironment(() => {
            if (process.env.METEOR_PRINT_ON_LISTEN) {
              console.log('LISTENING');
            }
            const callbacks = onListeningCallbacks;
            onListeningCallbacks = null;
            callbacks === null || callbacks === void 0 ? void 0 : callbacks.forEach(callback => {
              callback();
            });
          }, e => {
            console.error('Error listening:', e);
            console.error(e && e.stack);
          }));
        };
        let localPort = process.env.PORT || 0;
        let unixSocketPath = process.env.UNIX_SOCKET_PATH;
        if (unixSocketPath) {
          if (cluster.isWorker) {
            const workerName = cluster.worker.process.env.name || cluster.worker.id;
            unixSocketPath += '.' + workerName + '.sock';
          }
          // Start the HTTP server using a socket file.
          removeExistingSocketFile(unixSocketPath);
          startHttpServer({
            path: unixSocketPath
          });
          const unixSocketPermissions = (process.env.UNIX_SOCKET_PERMISSIONS || '').trim();
          if (unixSocketPermissions) {
            if (/^[0-7]{3}$/.test(unixSocketPermissions)) {
              chmodSync(unixSocketPath, parseInt(unixSocketPermissions, 8));
            } else {
              throw new Error('Invalid UNIX_SOCKET_PERMISSIONS specified');
            }
          }
          const unixSocketGroup = (process.env.UNIX_SOCKET_GROUP || '').trim();
          if (unixSocketGroup) {
            const unixSocketGroupInfo = getGroupInfo(unixSocketGroup);
            if (unixSocketGroupInfo === null) {
              throw new Error('Invalid UNIX_SOCKET_GROUP name specified');
            }
            chownSync(unixSocketPath, userInfo().uid, unixSocketGroupInfo.gid);
          }
          registerSocketFileCleanup(unixSocketPath);
        } else {
          localPort = isNaN(Number(localPort)) ? localPort : Number(localPort);
          if (/\\\\?.+\\pipe\\?.+/.test(localPort)) {
            // Start the HTTP server using Windows Server style named pipe.
            startHttpServer({
              path: localPort
            });
          } else if (typeof localPort === 'number') {
            // Start the HTTP server using TCP.
            startHttpServer({
              port: localPort,
              host: process.env.BIND_IP || '0.0.0.0'
            });
          } else {
            throw new Error('Invalid PORT specified');
          }
        }
        return 'DAEMON';
      };
    }
    const isGetentAvailable = () => {
      try {
        execSync('which getent');
        return true;
      } catch (_unused) {
        return false;
      }
    };
    const getGroupInfoUsingGetent = groupName => {
      try {
        const stdout = execSync("getent group ".concat(groupName), {
          encoding: 'utf8'
        });
        if (!stdout) return null;
        const [name,, gid] = stdout.trim().split(':');
        if (name == null || gid == null) return null;
        return {
          name,
          gid: Number(gid)
        };
      } catch (error) {
        return null;
      }
    };
    const getGroupInfoFromFile = groupName => {
      try {
        const data = readFileSync('/etc/group', 'utf8');
        const groupLine = data.trim().split('\n').find(line => line.startsWith("".concat(groupName, ":")));
        if (!groupLine) return null;
        const [name,, gid] = groupLine.trim().split(':');
        if (name == null || gid == null) return null;
        return {
          name,
          gid: Number(gid)
        };
      } catch (error) {
        return null;
      }
    };
    const getGroupInfo = groupName => {
      let groupInfo = getGroupInfoFromFile(groupName);
      if (!groupInfo && isGetentAvailable()) {
        groupInfo = getGroupInfoUsingGetent(groupName);
      }
      return groupInfo;
    };
    var inlineScriptsAllowed = true;
    WebAppInternals.inlineScriptsAllowed = function () {
      return inlineScriptsAllowed;
    };
    WebAppInternals.setInlineScriptsAllowed = async function (value) {
      inlineScriptsAllowed = value;
      await WebAppInternals.generateBoilerplate();
    };
    var sriMode;
    WebAppInternals.enableSubresourceIntegrity = async function () {
      let use_credentials = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
      sriMode = use_credentials ? 'use-credentials' : 'anonymous';
      await WebAppInternals.generateBoilerplate();
    };
    WebAppInternals.setBundledJsCssUrlRewriteHook = async function (hookFn) {
      bundledJsCssUrlRewriteHook = hookFn;
      await WebAppInternals.generateBoilerplate();
    };
    WebAppInternals.setBundledJsCssPrefix = async function (prefix) {
      var self = this;
      await self.setBundledJsCssUrlRewriteHook(function (url) {
        return prefix + url;
      });
    };

    // Packages can call `WebAppInternals.addStaticJs` to specify static
    // JavaScript to be included in the app. This static JS will be inlined,
    // unless inline scripts have been disabled, in which case it will be
    // served under `/<sha1 of contents>`.
    var additionalStaticJs = {};
    WebAppInternals.addStaticJs = function (contents) {
      additionalStaticJs['/' + sha1(contents) + '.js'] = contents;
    };

    // Exported for tests
    WebAppInternals.getBoilerplate = getBoilerplate;
    WebAppInternals.additionalStaticJs = additionalStaticJs;
    await runWebAppServer();
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: true
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"socket_file.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// packages/webapp/socket_file.js                                                                           //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      removeExistingSocketFile: () => removeExistingSocketFile,
      registerSocketFileCleanup: () => registerSocketFileCleanup
    });
    let statSync, unlinkSync, existsSync;
    module.link("fs", {
      statSync(v) {
        statSync = v;
      },
      unlinkSync(v) {
        unlinkSync = v;
      },
      existsSync(v) {
        existsSync = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const removeExistingSocketFile = socketPath => {
      try {
        if (statSync(socketPath).isSocket()) {
          // Since a new socket file will be created, remove the existing
          // file.
          unlinkSync(socketPath);
        } else {
          throw new Error("An existing file was found at \"".concat(socketPath, "\" and it is not ") + 'a socket file. Please confirm PORT is pointing to valid and ' + 'un-used socket file path.');
        }
      } catch (error) {
        // If there is no existing socket file to cleanup, great, we'll
        // continue normally. If the caught exception represents any other
        // issue, re-throw.
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    };
    const registerSocketFileCleanup = function (socketPath) {
      let eventEmitter = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : process;
      ['exit', 'SIGINT', 'SIGHUP', 'SIGTERM'].forEach(signal => {
        eventEmitter.on(signal, Meteor.bindEnvironment(() => {
          if (existsSync(socketPath)) {
            unlinkSync(socketPath);
          }
        }));
      });
    };
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"express":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/express/package.json                                             //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.exports = {
  "name": "express",
  "version": "4.21.0"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/express/index.js                                                 //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"compression":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/compression/package.json                                         //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.exports = {
  "name": "compression",
  "version": "1.7.4"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/compression/index.js                                             //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"cookie-parser":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/cookie-parser/package.json                                       //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.exports = {
  "name": "cookie-parser",
  "version": "1.4.6"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/cookie-parser/index.js                                           //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"qs":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/qs/package.json                                                  //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.exports = {
  "name": "qs",
  "version": "6.13.0",
  "main": "lib/index.js"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/qs/lib/index.js                                                  //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"parseurl":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/parseurl/package.json                                            //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.exports = {
  "name": "parseurl",
  "version": "1.3.3"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/parseurl/index.js                                                //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"useragent":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/useragent/package.json                                           //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.exports = {
  "name": "useragent",
  "version": "2.3.0",
  "main": "./index.js"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/useragent/index.js                                               //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"send":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/send/package.json                                                //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.exports = {
  "name": "send",
  "version": "1.1.0"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/send/index.js                                                    //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      WebApp: WebApp,
      WebAppInternals: WebAppInternals,
      main: main
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/webapp/webapp_server.js"
  ],
  mainModulePath: "/node_modules/meteor/webapp/webapp_server.js"
}});

//# sourceURL=meteor://💻app/packages/webapp.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvd2ViYXBwL3dlYmFwcF9zZXJ2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3dlYmFwcC9zb2NrZXRfZmlsZS5qcyJdLCJuYW1lcyI6WyJfb2JqZWN0U3ByZWFkIiwibW9kdWxlMSIsImxpbmsiLCJkZWZhdWx0IiwidiIsImV4cG9ydCIsIldlYkFwcCIsIldlYkFwcEludGVybmFscyIsImdldEdyb3VwSW5mbyIsImFzc2VydCIsInJlYWRGaWxlU3luYyIsImNobW9kU3luYyIsImNob3duU3luYyIsImNyZWF0ZVNlcnZlciIsInVzZXJJbmZvIiwicGF0aEpvaW4iLCJwYXRoRGlybmFtZSIsImpvaW4iLCJkaXJuYW1lIiwicGFyc2VVcmwiLCJwYXJzZSIsImNyZWF0ZUhhc2giLCJleHByZXNzIiwiY29tcHJlc3MiLCJjb29raWVQYXJzZXIiLCJxcyIsInBhcnNlUmVxdWVzdCIsImxvb2t1cFVzZXJBZ2VudCIsImxvb2t1cCIsImlzTW9kZXJuIiwic2VuZCIsInJlbW92ZUV4aXN0aW5nU29ja2V0RmlsZSIsInJlZ2lzdGVyU29ja2V0RmlsZUNsZWFudXAiLCJjbHVzdGVyIiwiZXhlY1N5bmMiLCJvbk1lc3NhZ2UiLCJfX3JlaWZ5V2FpdEZvckRlcHNfXyIsIlNIT1JUX1NPQ0tFVF9USU1FT1VUIiwiTE9OR19TT0NLRVRfVElNRU9VVCIsImNyZWF0ZUV4cHJlc3NBcHAiLCJhcHAiLCJzZXQiLCJoYXNPd24iLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsIk5wbU1vZHVsZXMiLCJ2ZXJzaW9uIiwiTnBtIiwicmVxdWlyZSIsIm1vZHVsZSIsImRlZmF1bHRBcmNoIiwiY2xpZW50UHJvZ3JhbXMiLCJhcmNoUGF0aCIsImJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rIiwidXJsIiwiYnVuZGxlZFByZWZpeCIsIl9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18iLCJST09UX1VSTF9QQVRIX1BSRUZJWCIsInNoYTEiLCJjb250ZW50cyIsImhhc2giLCJ1cGRhdGUiLCJkaWdlc3QiLCJzaG91bGRDb21wcmVzcyIsInJlcSIsInJlcyIsImhlYWRlcnMiLCJmaWx0ZXIiLCJjYW1lbENhc2UiLCJuYW1lIiwicGFydHMiLCJzcGxpdCIsInRvTG93ZXJDYXNlIiwiaSIsImxlbmd0aCIsImNoYXJBdCIsInRvVXBwZXJDYXNlIiwic3Vic3RyIiwiaWRlbnRpZnlCcm93c2VyIiwidXNlckFnZW50U3RyaW5nIiwidXNlckFnZW50IiwiZmFtaWx5IiwibWFqb3IiLCJtaW5vciIsInBhdGNoIiwiY2F0ZWdvcml6ZVJlcXVlc3QiLCJicm93c2VyIiwiYXJjaCIsIm1vZGVybiIsInBhdGgiLCJwYXRobmFtZSIsImNhdGVnb3JpemVkIiwiZHluYW1pY0hlYWQiLCJkeW5hbWljQm9keSIsImNvb2tpZXMiLCJwYXRoUGFydHMiLCJhcmNoS2V5Iiwic3RhcnRzV2l0aCIsImFyY2hDbGVhbmVkIiwic2xpY2UiLCJjYWxsIiwic3BsaWNlIiwiYXNzaWduIiwicHJlZmVycmVkQXJjaE9yZGVyIiwiaHRtbEF0dHJpYnV0ZUhvb2tzIiwiZ2V0SHRtbEF0dHJpYnV0ZXMiLCJyZXF1ZXN0IiwiY29tYmluZWRBdHRyaWJ1dGVzIiwiXyIsImVhY2giLCJob29rIiwiYXR0cmlidXRlcyIsIkVycm9yIiwiZXh0ZW5kIiwiYWRkSHRtbEF0dHJpYnV0ZUhvb2siLCJwdXNoIiwiYXBwVXJsIiwiUm91dGVQb2xpY3kiLCJjbGFzc2lmeSIsIk1ldGVvciIsInN0YXJ0dXAiLCJnZXR0ZXIiLCJrZXkiLCJwcm9ncmFtIiwidmFsdWUiLCJjYWxjdWxhdGVDbGllbnRIYXNoIiwiY2xpZW50SGFzaCIsImNhbGN1bGF0ZUNsaWVudEhhc2hSZWZyZXNoYWJsZSIsImNhbGN1bGF0ZUNsaWVudEhhc2hOb25SZWZyZXNoYWJsZSIsImNhbGN1bGF0ZUNsaWVudEhhc2hSZXBsYWNlYWJsZSIsImdldFJlZnJlc2hhYmxlQXNzZXRzIiwiX3RpbWVvdXRBZGp1c3RtZW50UmVxdWVzdENhbGxiYWNrIiwic2V0VGltZW91dCIsImZpbmlzaExpc3RlbmVycyIsImxpc3RlbmVycyIsInJlbW92ZUFsbExpc3RlbmVycyIsIm9uIiwibCIsImJvaWxlcnBsYXRlQnlBcmNoIiwiYm9pbGVycGxhdGVEYXRhQ2FsbGJhY2tzIiwiY3JlYXRlIiwicmVnaXN0ZXJCb2lsZXJwbGF0ZURhdGFDYWxsYmFjayIsImNhbGxiYWNrIiwicHJldmlvdXNDYWxsYmFjayIsInN0cmljdEVxdWFsIiwiZ2V0Qm9pbGVycGxhdGUiLCJnZXRCb2lsZXJwbGF0ZUFzeW5jIiwiZW5jb2RlUnVudGltZUNvbmZpZyIsInJ0aW1lQ29uZmlnIiwiSlNPTiIsInN0cmluZ2lmeSIsImVuY29kZVVSSUNvbXBvbmVudCIsImRlY29kZVJ1bnRpbWVDb25maWciLCJydGltZUNvbmZpZ1N0ciIsImRlY29kZVVSSUNvbXBvbmVudCIsInJ1bnRpbWVDb25maWciLCJob29rcyIsIkhvb2siLCJ1cGRhdGVIb29rcyIsImlzVXBkYXRlZEJ5QXJjaCIsImFkZFJ1bnRpbWVDb25maWdIb29rIiwicmVnaXN0ZXIiLCJib2lsZXJwbGF0ZSIsImZvckVhY2hBc3luYyIsIm1ldGVvclJ1bnRpbWVDb25maWciLCJlbmNvZGVkQ3VycmVudENvbmZpZyIsImJhc2VEYXRhIiwidXBkYXRlZCIsImRhdGEiLCJodG1sQXR0cmlidXRlcyIsInBpY2siLCJtYWRlQ2hhbmdlcyIsInByb21pc2UiLCJQcm9taXNlIiwicmVzb2x2ZSIsImtleXMiLCJmb3JFYWNoIiwidGhlbiIsInJlc3VsdCIsInN0cmVhbSIsInRvSFRNTFN0cmVhbSIsInN0YXR1c0NvZGUiLCJhZGRVcGRhdGVkTm90aWZ5SG9vayIsImhhbmRsZXIiLCJnZW5lcmF0ZUJvaWxlcnBsYXRlSW5zdGFuY2UiLCJtYW5pZmVzdCIsImFkZGl0aW9uYWxPcHRpb25zIiwicnVudGltZUNvbmZpZ092ZXJyaWRlcyIsImNiIiwiQm9pbGVycGxhdGUiLCJwYXRoTWFwcGVyIiwiaXRlbVBhdGgiLCJiYXNlRGF0YUV4dGVuc2lvbiIsImFkZGl0aW9uYWxTdGF0aWNKcyIsIm1hcCIsIm1ldGVvclJ1bnRpbWVIYXNoIiwicm9vdFVybFBhdGhQcmVmaXgiLCJzcmlNb2RlIiwiaW5saW5lU2NyaXB0c0FsbG93ZWQiLCJpbmxpbmUiLCJzdGF0aWNGaWxlc01pZGRsZXdhcmUiLCJzdGF0aWNGaWxlc0J5QXJjaCIsIm5leHQiLCJfTWV0ZW9yJHNldHRpbmdzJHBhY2szIiwiX01ldGVvciRzZXR0aW5ncyRwYWNrNCIsImUiLCJzZXJ2ZVN0YXRpY0pzIiwicyIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjayIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjazIiLCJtZXRob2QiLCJzZXR0aW5ncyIsInBhY2thZ2VzIiwid2ViYXBwIiwiYWx3YXlzUmV0dXJuQ29udGVudCIsIndyaXRlSGVhZCIsIkJ1ZmZlciIsImJ5dGVMZW5ndGgiLCJ3cml0ZSIsImVuZCIsInN0YXR1cyIsIkFsbG93IiwiaGFzIiwicGF1c2VkIiwiY29uY2F0IiwiaW5mbyIsImdldFN0YXRpY0ZpbGVJbmZvIiwibWF4QWdlIiwiY2FjaGVhYmxlIiwic2V0SGVhZGVyIiwic291cmNlTWFwVXJsIiwidHlwZSIsImNvbnRlbnQiLCJhYnNvbHV0ZVBhdGgiLCJtYXhhZ2UiLCJkb3RmaWxlcyIsImxhc3RNb2RpZmllZCIsImVyciIsIkxvZyIsImVycm9yIiwicGlwZSIsIm9yaWdpbmFsUGF0aCIsInN0YXRpY0FyY2hMaXN0IiwiYXJjaEluZGV4IiwiaW5kZXhPZiIsInVuc2hpZnQiLCJzb21lIiwic3RhdGljRmlsZXMiLCJmaW5hbGl6ZSIsInBhcnNlUG9ydCIsInBvcnQiLCJwYXJzZWRQb3J0IiwicGFyc2VJbnQiLCJOdW1iZXIiLCJpc05hTiIsIl9yZWYiLCJwYXVzZUNsaWVudCIsIl9yZWYyIiwiZ2VuZXJhdGVDbGllbnRQcm9ncmFtIiwicnVuV2ViQXBwU2VydmVyIiwic2h1dHRpbmdEb3duIiwic3luY1F1ZXVlIiwiX0FzeW5jaHJvbm91c1F1ZXVlIiwiZ2V0SXRlbVBhdGhuYW1lIiwiaXRlbVVybCIsInJlbG9hZENsaWVudFByb2dyYW1zIiwicnVuVGFzayIsImNvbmZpZ0pzb24iLCJfX21ldGVvcl9ib290c3RyYXBfXyIsImNsaWVudEFyY2hzIiwiY2xpZW50UGF0aHMiLCJzdGFjayIsInByb2Nlc3MiLCJleGl0IiwidW5wYXVzZSIsImFyZ3VtZW50cyIsInVuZGVmaW5lZCIsImNsaWVudERpciIsInNlcnZlckRpciIsInByb2dyYW1Kc29uUGF0aCIsInByb2dyYW1Kc29uIiwiY29kZSIsImZvcm1hdCIsIml0ZW0iLCJ3aGVyZSIsInNvdXJjZU1hcCIsIlBVQkxJQ19TRVRUSU5HUyIsImNvbmZpZ092ZXJyaWRlcyIsIm9sZFByb2dyYW0iLCJuZXdQcm9ncmFtIiwiV2ViQXBwSGFzaGluZyIsInZlcnNpb25SZWZyZXNoYWJsZSIsInZlcnNpb25Ob25SZWZyZXNoYWJsZSIsInJlcGxhY2VhYmxlIiwidmVyc2lvblJlcGxhY2VhYmxlIiwiX3R5cGUiLCJjb3Jkb3ZhQ29tcGF0aWJpbGl0eVZlcnNpb25zIiwiaG1yVmVyc2lvbiIsIm1hbmlmZXN0VXJsUHJlZml4IiwicmVwbGFjZSIsIm1hbmlmZXN0VXJsIiwiUGFja2FnZSIsImF1dG91cGRhdGUiLCJBVVRPVVBEQVRFX1ZFUlNJT04iLCJBdXRvdXBkYXRlIiwiYXV0b3VwZGF0ZVZlcnNpb24iLCJlbnYiLCJnZW5lcmF0ZUJvaWxlcnBsYXRlRm9yQXJjaCIsImRlZmF1bHRPcHRpb25zRm9yQXJjaCIsIkREUF9ERUZBVUxUX0NPTk5FQ1RJT05fVVJMIiwiTU9CSUxFX0REUF9VUkwiLCJhYnNvbHV0ZVVybCIsIlJPT1RfVVJMIiwiTU9CSUxFX1JPT1RfVVJMIiwiZ2VuZXJhdGVCb2lsZXJwbGF0ZSIsInJlZnJlc2hhYmxlQXNzZXRzIiwiY3NzIiwiZmlsZSIsInJhd0V4cHJlc3NIYW5kbGVycyIsInVzZSIsImlzVmFsaWRVcmwiLCJyZXNwb25zZSIsInF1ZXJ5IiwiZ2V0UGF0aFBhcnRzIiwic2hpZnQiLCJpc1ByZWZpeE9mIiwicHJlZml4IiwiYXJyYXkiLCJldmVyeSIsInBhcnQiLCJwYXRoUHJlZml4Iiwic2VhcmNoIiwicHJlZml4UGFydHMiLCJtZXRlb3JJbnRlcm5hbEhhbmRsZXJzIiwicGFja2FnZUFuZEFwcEhhbmRsZXJzIiwic3VwcHJlc3NFeHByZXNzRXJyb3JzIiwiX01ldGVvciRzZXR0aW5ncyRwYWNrNSIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjazYiLCJpc0RldmVsb3BtZW50IiwiX3JlZjMiLCJuZXdIZWFkZXJzIiwiY2F0Y2giLCJodHRwU2VydmVyIiwib25MaXN0ZW5pbmdDYWxsYmFja3MiLCJzb2NrZXQiLCJkZXN0cm95ZWQiLCJtZXNzYWdlIiwiZGVzdHJveSIsInN1cHByZXNzRXJyb3JzIiwid2FybmVkQWJvdXRDb25uZWN0VXNhZ2UiLCJjb25uZWN0SGFuZGxlcnMiLCJoYW5kbGVycyIsInJhd0Nvbm5lY3RIYW5kbGVycyIsInJhd0hhbmRsZXJzIiwiZXhwcmVzc0FwcCIsInN1cHByZXNzQ29ubmVjdEVycm9ycyIsIl9kZWJ1ZyIsIl9zdXBwcmVzc0V4cHJlc3NFcnJvcnMiLCJvbkxpc3RlbmluZyIsImYiLCJzdGFydExpc3RlbmluZyIsImxpc3Rlbk9wdGlvbnMiLCJsaXN0ZW4iLCJleHBvcnRzIiwibWFpbiIsImFyZ3YiLCJzdGFydEh0dHBTZXJ2ZXIiLCJiaW5kRW52aXJvbm1lbnQiLCJNRVRFT1JfUFJJTlRfT05fTElTVEVOIiwiY29uc29sZSIsImxvZyIsImNhbGxiYWNrcyIsImxvY2FsUG9ydCIsIlBPUlQiLCJ1bml4U29ja2V0UGF0aCIsIlVOSVhfU09DS0VUX1BBVEgiLCJpc1dvcmtlciIsIndvcmtlck5hbWUiLCJ3b3JrZXIiLCJpZCIsInVuaXhTb2NrZXRQZXJtaXNzaW9ucyIsIlVOSVhfU09DS0VUX1BFUk1JU1NJT05TIiwidHJpbSIsInRlc3QiLCJ1bml4U29ja2V0R3JvdXAiLCJVTklYX1NPQ0tFVF9HUk9VUCIsInVuaXhTb2NrZXRHcm91cEluZm8iLCJ1aWQiLCJnaWQiLCJob3N0IiwiQklORF9JUCIsImlzR2V0ZW50QXZhaWxhYmxlIiwiX3VudXNlZCIsImdldEdyb3VwSW5mb1VzaW5nR2V0ZW50IiwiZ3JvdXBOYW1lIiwic3Rkb3V0IiwiZW5jb2RpbmciLCJnZXRHcm91cEluZm9Gcm9tRmlsZSIsImdyb3VwTGluZSIsImZpbmQiLCJsaW5lIiwiZ3JvdXBJbmZvIiwic2V0SW5saW5lU2NyaXB0c0FsbG93ZWQiLCJlbmFibGVTdWJyZXNvdXJjZUludGVncml0eSIsInVzZV9jcmVkZW50aWFscyIsInNldEJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rIiwiaG9va0ZuIiwic2V0QnVuZGxlZEpzQ3NzUHJlZml4Iiwic2VsZiIsImFkZFN0YXRpY0pzIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwiYXN5bmMiLCJzdGF0U3luYyIsInVubGlua1N5bmMiLCJleGlzdHNTeW5jIiwic29ja2V0UGF0aCIsImlzU29ja2V0IiwiZXZlbnRFbWl0dGVyIiwic2lnbmFsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBLElBQUlBLGFBQWE7SUFBQ0MsT0FBTyxDQUFDQyxJQUFJLENBQUMsc0NBQXNDLEVBQUM7TUFBQ0MsT0FBT0EsQ0FBQ0MsQ0FBQyxFQUFDO1FBQUNKLGFBQWEsR0FBQ0ksQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUF0R0gsT0FBTyxDQUFDSSxNQUFNLENBQUM7TUFBQ0MsTUFBTSxFQUFDQSxDQUFBLEtBQUlBLE1BQU07TUFBQ0MsZUFBZSxFQUFDQSxDQUFBLEtBQUlBLGVBQWU7TUFBQ0MsWUFBWSxFQUFDQSxDQUFBLEtBQUlBO0lBQVksQ0FBQyxDQUFDO0lBQUMsSUFBSUMsTUFBTTtJQUFDUixPQUFPLENBQUNDLElBQUksQ0FBQyxRQUFRLEVBQUM7TUFBQ0MsT0FBT0EsQ0FBQ0MsQ0FBQyxFQUFDO1FBQUNLLE1BQU0sR0FBQ0wsQ0FBQztNQUFBO0lBQUMsQ0FBQyxF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QUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUNoRyxPQUFPLENBQUNtUCxNQUFNLElBQUk7UUFDeERELFlBQVksQ0FBQzFSLEVBQUUsQ0FBQzJSLE1BQU0sRUFBRTVTLE1BQU0sQ0FBQ3dQLGVBQWUsQ0FBQyxNQUFNO1VBQ25ELElBQUlnRCxVQUFVLENBQUNDLFVBQVUsQ0FBQyxFQUFFO1lBQzFCRixVQUFVLENBQUNFLFVBQVUsQ0FBQztVQUN4QjtRQUNGLENBQUMsQ0FBQyxDQUFDO01BQ0wsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUFDTixzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRixJQUFBO0VBQUFJLEtBQUE7QUFBQSxHIiwiZmlsZSI6Ii9wYWNrYWdlcy93ZWJhcHAuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyByZWFkRmlsZVN5bmMsIGNobW9kU3luYywgY2hvd25TeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgY3JlYXRlU2VydmVyIH0gZnJvbSAnaHR0cCc7XG5pbXBvcnQgeyB1c2VySW5mbyB9IGZyb20gJ29zJztcbmltcG9ydCB7IGpvaW4gYXMgcGF0aEpvaW4sIGRpcm5hbWUgYXMgcGF0aERpcm5hbWUgfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IHBhcnNlIGFzIHBhcnNlVXJsIH0gZnJvbSAndXJsJztcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IGV4cHJlc3MgZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgY29tcHJlc3MgZnJvbSAnY29tcHJlc3Npb24nO1xuaW1wb3J0IGNvb2tpZVBhcnNlciBmcm9tICdjb29raWUtcGFyc2VyJztcbmltcG9ydCBxcyBmcm9tICdxcyc7XG5pbXBvcnQgcGFyc2VSZXF1ZXN0IGZyb20gJ3BhcnNldXJsJztcbmltcG9ydCB7IGxvb2t1cCBhcyBsb29rdXBVc2VyQWdlbnQgfSBmcm9tICd1c2VyYWdlbnQnO1xuaW1wb3J0IHsgaXNNb2Rlcm4gfSBmcm9tICdtZXRlb3IvbW9kZXJuLWJyb3dzZXJzJztcbmltcG9ydCBzZW5kIGZyb20gJ3NlbmQnO1xuaW1wb3J0IHtcbiAgcmVtb3ZlRXhpc3RpbmdTb2NrZXRGaWxlLFxuICByZWdpc3RlclNvY2tldEZpbGVDbGVhbnVwLFxufSBmcm9tICcuL3NvY2tldF9maWxlLmpzJztcbmltcG9ydCBjbHVzdGVyIGZyb20gJ2NsdXN0ZXInO1xuaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcblxudmFyIFNIT1JUX1NPQ0tFVF9USU1FT1VUID0gNSAqIDEwMDA7XG52YXIgTE9OR19TT0NLRVRfVElNRU9VVCA9IDEyMCAqIDEwMDA7XG5cbmNvbnN0IGNyZWF0ZUV4cHJlc3NBcHAgPSAoKSA9PiB7XG4gIGNvbnN0IGFwcCA9IGV4cHJlc3MoKTtcbiAgLy8gU2VjdXJpdHkgYW5kIHBlcmZvcm1hY2UgaGVhZGVyc1xuICAvLyB0aGVzZSBoZWFkZXJzIGNvbWUgZnJvbSB0aGVzZSBkb2NzOiBodHRwczovL2V4cHJlc3Nqcy5jb20vZW4vYXBpLmh0bWwjYXBwLnNldHRpbmdzLnRhYmxlXG4gIGFwcC5zZXQoJ3gtcG93ZXJlZC1ieScsIGZhbHNlKTtcbiAgYXBwLnNldCgnZXRhZycsIGZhbHNlKTtcbiAgcmV0dXJuIGFwcDtcbn1cbmV4cG9ydCBjb25zdCBXZWJBcHAgPSB7fTtcbmV4cG9ydCBjb25zdCBXZWJBcHBJbnRlcm5hbHMgPSB7fTtcblxuY29uc3QgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuXG5XZWJBcHBJbnRlcm5hbHMuTnBtTW9kdWxlcyA9IHtcbiAgZXhwcmVzcyA6IHtcbiAgICB2ZXJzaW9uOiBOcG0ucmVxdWlyZSgnZXhwcmVzcy9wYWNrYWdlLmpzb24nKS52ZXJzaW9uLFxuICAgIG1vZHVsZTogZXhwcmVzcyxcbiAgfVxufTtcblxuLy8gTW9yZSBvZiBhIGNvbnZlbmllbmNlIGZvciB0aGUgZW5kIHVzZXJcbldlYkFwcC5leHByZXNzID0gZXhwcmVzcztcblxuLy8gVGhvdWdoIHdlIG1pZ2h0IHByZWZlciB0byB1c2Ugd2ViLmJyb3dzZXIgKG1vZGVybikgYXMgdGhlIGRlZmF1bHRcbi8vIGFyY2hpdGVjdHVyZSwgc2FmZXR5IHJlcXVpcmVzIGEgbW9yZSBjb21wYXRpYmxlIGRlZmF1bHRBcmNoLlxuV2ViQXBwLmRlZmF1bHRBcmNoID0gJ3dlYi5icm93c2VyLmxlZ2FjeSc7XG5cbi8vIFhYWCBtYXBzIGFyY2hzIHRvIG1hbmlmZXN0c1xuV2ViQXBwLmNsaWVudFByb2dyYW1zID0ge307XG5cbi8vIFhYWCBtYXBzIGFyY2hzIHRvIHByb2dyYW0gcGF0aCBvbiBmaWxlc3lzdGVtXG52YXIgYXJjaFBhdGggPSB7fTtcblxudmFyIGJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rID0gZnVuY3Rpb24odXJsKSB7XG4gIHZhciBidW5kbGVkUHJlZml4ID0gX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ST09UX1VSTF9QQVRIX1BSRUZJWCB8fCAnJztcbiAgcmV0dXJuIGJ1bmRsZWRQcmVmaXggKyB1cmw7XG59O1xuXG52YXIgc2hhMSA9IGZ1bmN0aW9uKGNvbnRlbnRzKSB7XG4gIHZhciBoYXNoID0gY3JlYXRlSGFzaCgnc2hhMScpO1xuICBoYXNoLnVwZGF0ZShjb250ZW50cyk7XG4gIHJldHVybiBoYXNoLmRpZ2VzdCgnaGV4Jyk7XG59O1xuXG5mdW5jdGlvbiBzaG91bGRDb21wcmVzcyhyZXEsIHJlcykge1xuICBpZiAocmVxLmhlYWRlcnNbJ3gtbm8tY29tcHJlc3Npb24nXSkge1xuICAgIC8vIGRvbid0IGNvbXByZXNzIHJlc3BvbnNlcyB3aXRoIHRoaXMgcmVxdWVzdCBoZWFkZXJcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBmYWxsYmFjayB0byBzdGFuZGFyZCBmaWx0ZXIgZnVuY3Rpb25cbiAgcmV0dXJuIGNvbXByZXNzLmZpbHRlcihyZXEsIHJlcyk7XG59XG5cbi8vICNCcm93c2VySWRlbnRpZmljYXRpb25cbi8vXG4vLyBXZSBoYXZlIG11bHRpcGxlIHBsYWNlcyB0aGF0IHdhbnQgdG8gaWRlbnRpZnkgdGhlIGJyb3dzZXI6IHRoZVxuLy8gdW5zdXBwb3J0ZWQgYnJvd3NlciBwYWdlLCB0aGUgYXBwY2FjaGUgcGFja2FnZSwgYW5kLCBldmVudHVhbGx5XG4vLyBkZWxpdmVyaW5nIGJyb3dzZXIgcG9seWZpbGxzIG9ubHkgYXMgbmVlZGVkLlxuLy9cbi8vIFRvIGF2b2lkIGRldGVjdGluZyB0aGUgYnJvd3NlciBpbiBtdWx0aXBsZSBwbGFjZXMgYWQtaG9jLCB3ZSBjcmVhdGUgYVxuLy8gTWV0ZW9yIFwiYnJvd3NlclwiIG9iamVjdC4gSXQgdXNlcyBidXQgZG9lcyBub3QgZXhwb3NlIHRoZSBucG1cbi8vIHVzZXJhZ2VudCBtb2R1bGUgKHdlIGNvdWxkIGNob29zZSBhIGRpZmZlcmVudCBtZWNoYW5pc20gdG8gaWRlbnRpZnlcbi8vIHRoZSBicm93c2VyIGluIHRoZSBmdXR1cmUgaWYgd2Ugd2FudGVkIHRvKS4gIFRoZSBicm93c2VyIG9iamVjdFxuLy8gY29udGFpbnNcbi8vXG4vLyAqIGBuYW1lYDogdGhlIG5hbWUgb2YgdGhlIGJyb3dzZXIgaW4gY2FtZWwgY2FzZVxuLy8gKiBgbWFqb3JgLCBgbWlub3JgLCBgcGF0Y2hgOiBpbnRlZ2VycyBkZXNjcmliaW5nIHRoZSBicm93c2VyIHZlcnNpb25cbi8vXG4vLyBBbHNvIGhlcmUgaXMgYW4gZWFybHkgdmVyc2lvbiBvZiBhIE1ldGVvciBgcmVxdWVzdGAgb2JqZWN0LCBpbnRlbmRlZFxuLy8gdG8gYmUgYSBoaWdoLWxldmVsIGRlc2NyaXB0aW9uIG9mIHRoZSByZXF1ZXN0IHdpdGhvdXQgZXhwb3Npbmdcbi8vIGRldGFpbHMgb2YgRXhwcmVzcydzIGxvdy1sZXZlbCBgcmVxYC4gIEN1cnJlbnRseSBpdCBjb250YWluczpcbi8vXG4vLyAqIGBicm93c2VyYDogYnJvd3NlciBpZGVudGlmaWNhdGlvbiBvYmplY3QgZGVzY3JpYmVkIGFib3ZlXG4vLyAqIGB1cmxgOiBwYXJzZWQgdXJsLCBpbmNsdWRpbmcgcGFyc2VkIHF1ZXJ5IHBhcmFtc1xuLy9cbi8vIEFzIGEgdGVtcG9yYXJ5IGhhY2sgdGhlcmUgaXMgYSBgY2F0ZWdvcml6ZVJlcXVlc3RgIGZ1bmN0aW9uIG9uIFdlYkFwcCB3aGljaFxuLy8gY29udmVydHMgYSBFeHByZXNzIGByZXFgIHRvIGEgTWV0ZW9yIGByZXF1ZXN0YC4gVGhpcyBjYW4gZ28gYXdheSBvbmNlIHNtYXJ0XG4vLyBwYWNrYWdlcyBzdWNoIGFzIGFwcGNhY2hlIGFyZSBiZWluZyBwYXNzZWQgYSBgcmVxdWVzdGAgb2JqZWN0IGRpcmVjdGx5IHdoZW5cbi8vIHRoZXkgc2VydmUgY29udGVudC5cbi8vXG4vLyBUaGlzIGFsbG93cyBgcmVxdWVzdGAgdG8gYmUgdXNlZCB1bmlmb3JtbHk6IGl0IGlzIHBhc3NlZCB0byB0aGUgaHRtbFxuLy8gYXR0cmlidXRlcyBob29rLCBhbmQgdGhlIGFwcGNhY2hlIHBhY2thZ2UgY2FuIHVzZSBpdCB3aGVuIGRlY2lkaW5nXG4vLyB3aGV0aGVyIHRvIGdlbmVyYXRlIGEgNDA0IGZvciB0aGUgbWFuaWZlc3QuXG4vL1xuLy8gUmVhbCByb3V0aW5nIC8gc2VydmVyIHNpZGUgcmVuZGVyaW5nIHdpbGwgcHJvYmFibHkgcmVmYWN0b3IgdGhpc1xuLy8gaGVhdmlseS5cblxuLy8gZS5nLiBcIk1vYmlsZSBTYWZhcmlcIiA9PiBcIm1vYmlsZVNhZmFyaVwiXG52YXIgY2FtZWxDYXNlID0gZnVuY3Rpb24obmFtZSkge1xuICB2YXIgcGFydHMgPSBuYW1lLnNwbGl0KCcgJyk7XG4gIHBhcnRzWzBdID0gcGFydHNbMF0udG9Mb3dlckNhc2UoKTtcbiAgZm9yICh2YXIgaSA9IDE7IGkgPCBwYXJ0cy5sZW5ndGg7ICsraSkge1xuICAgIHBhcnRzW2ldID0gcGFydHNbaV0uY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBwYXJ0c1tpXS5zdWJzdHIoMSk7XG4gIH1cbiAgcmV0dXJuIHBhcnRzLmpvaW4oJycpO1xufTtcblxudmFyIGlkZW50aWZ5QnJvd3NlciA9IGZ1bmN0aW9uKHVzZXJBZ2VudFN0cmluZykge1xuICB2YXIgdXNlckFnZW50ID0gbG9va3VwVXNlckFnZW50KHVzZXJBZ2VudFN0cmluZyk7XG4gIHJldHVybiB7XG4gICAgbmFtZTogY2FtZWxDYXNlKHVzZXJBZ2VudC5mYW1pbHkpLFxuICAgIG1ham9yOiArdXNlckFnZW50Lm1ham9yLFxuICAgIG1pbm9yOiArdXNlckFnZW50Lm1pbm9yLFxuICAgIHBhdGNoOiArdXNlckFnZW50LnBhdGNoLFxuICB9O1xufTtcblxuLy8gWFhYIFJlZmFjdG9yIGFzIHBhcnQgb2YgaW1wbGVtZW50aW5nIHJlYWwgcm91dGluZy5cbldlYkFwcEludGVybmFscy5pZGVudGlmeUJyb3dzZXIgPSBpZGVudGlmeUJyb3dzZXI7XG5cbldlYkFwcC5jYXRlZ29yaXplUmVxdWVzdCA9IGZ1bmN0aW9uKHJlcSkge1xuICBpZiAocmVxLmJyb3dzZXIgJiYgcmVxLmFyY2ggJiYgdHlwZW9mIHJlcS5tb2Rlcm4gPT09ICdib29sZWFuJykge1xuICAgIC8vIEFscmVhZHkgY2F0ZWdvcml6ZWQuXG4gICAgcmV0dXJuIHJlcTtcbiAgfVxuXG4gIGNvbnN0IGJyb3dzZXIgPSBpZGVudGlmeUJyb3dzZXIocmVxLmhlYWRlcnNbJ3VzZXItYWdlbnQnXSk7XG4gIGNvbnN0IG1vZGVybiA9IGlzTW9kZXJuKGJyb3dzZXIpO1xuICBjb25zdCBwYXRoID1cbiAgICB0eXBlb2YgcmVxLnBhdGhuYW1lID09PSAnc3RyaW5nJ1xuICAgICAgPyByZXEucGF0aG5hbWVcbiAgICAgIDogcGFyc2VSZXF1ZXN0KHJlcSkucGF0aG5hbWU7XG5cbiAgY29uc3QgY2F0ZWdvcml6ZWQgPSB7XG4gICAgYnJvd3NlcixcbiAgICBtb2Rlcm4sXG4gICAgcGF0aCxcbiAgICBhcmNoOiBXZWJBcHAuZGVmYXVsdEFyY2gsXG4gICAgdXJsOiBwYXJzZVVybChyZXEudXJsLCB0cnVlKSxcbiAgICBkeW5hbWljSGVhZDogcmVxLmR5bmFtaWNIZWFkLFxuICAgIGR5bmFtaWNCb2R5OiByZXEuZHluYW1pY0JvZHksXG4gICAgaGVhZGVyczogcmVxLmhlYWRlcnMsXG4gICAgY29va2llczogcmVxLmNvb2tpZXMsXG4gIH07XG5cbiAgY29uc3QgcGF0aFBhcnRzID0gcGF0aC5zcGxpdCgnLycpO1xuICBjb25zdCBhcmNoS2V5ID0gcGF0aFBhcnRzWzFdO1xuXG4gIGlmIChhcmNoS2V5LnN0YXJ0c1dpdGgoJ19fJykpIHtcbiAgICBjb25zdCBhcmNoQ2xlYW5lZCA9ICd3ZWIuJyArIGFyY2hLZXkuc2xpY2UoMik7XG4gICAgaWYgKGhhc093bi5jYWxsKFdlYkFwcC5jbGllbnRQcm9ncmFtcywgYXJjaENsZWFuZWQpKSB7XG4gICAgICBwYXRoUGFydHMuc3BsaWNlKDEsIDEpOyAvLyBSZW1vdmUgdGhlIGFyY2hLZXkgcGFydC5cbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKGNhdGVnb3JpemVkLCB7XG4gICAgICAgIGFyY2g6IGFyY2hDbGVhbmVkLFxuICAgICAgICBwYXRoOiBwYXRoUGFydHMuam9pbignLycpLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gVE9ETyBQZXJoYXBzIG9uZSBkYXkgd2UgY291bGQgaW5mZXIgQ29yZG92YSBjbGllbnRzIGhlcmUsIHNvIHRoYXQgd2VcbiAgLy8gd291bGRuJ3QgaGF2ZSB0byB1c2UgcHJlZml4ZWQgXCIvX19jb3Jkb3ZhLy4uLlwiIFVSTHMuXG4gIGNvbnN0IHByZWZlcnJlZEFyY2hPcmRlciA9IGlzTW9kZXJuKGJyb3dzZXIpXG4gICAgPyBbJ3dlYi5icm93c2VyJywgJ3dlYi5icm93c2VyLmxlZ2FjeSddXG4gICAgOiBbJ3dlYi5icm93c2VyLmxlZ2FjeScsICd3ZWIuYnJvd3NlciddO1xuXG4gIGZvciAoY29uc3QgYXJjaCBvZiBwcmVmZXJyZWRBcmNoT3JkZXIpIHtcbiAgICAvLyBJZiBvdXIgcHJlZmVycmVkIGFyY2ggaXMgbm90IGF2YWlsYWJsZSwgaXQncyBiZXR0ZXIgdG8gdXNlIGFub3RoZXJcbiAgICAvLyBjbGllbnQgYXJjaCB0aGF0IGlzIGF2YWlsYWJsZSB0aGFuIHRvIGd1YXJhbnRlZSB0aGUgc2l0ZSB3b24ndCB3b3JrXG4gICAgLy8gYnkgcmV0dXJuaW5nIGFuIHVua25vd24gYXJjaC4gRm9yIGV4YW1wbGUsIGlmIHdlYi5icm93c2VyLmxlZ2FjeSBpc1xuICAgIC8vIGV4Y2x1ZGVkIHVzaW5nIHRoZSAtLWV4Y2x1ZGUtYXJjaHMgY29tbWFuZC1saW5lIG9wdGlvbiwgbGVnYWN5XG4gICAgLy8gY2xpZW50cyBhcmUgYmV0dGVyIG9mZiByZWNlaXZpbmcgd2ViLmJyb3dzZXIgKHdoaWNoIG1pZ2h0IGFjdHVhbGx5XG4gICAgLy8gd29yaykgdGhhbiByZWNlaXZpbmcgYW4gSFRUUCA0MDQgcmVzcG9uc2UuIElmIG5vbmUgb2YgdGhlIGFyY2hzIGluXG4gICAgLy8gcHJlZmVycmVkQXJjaE9yZGVyIGFyZSBkZWZpbmVkLCBvbmx5IHRoZW4gc2hvdWxkIHdlIHNlbmQgYSA0MDQuXG4gICAgaWYgKGhhc093bi5jYWxsKFdlYkFwcC5jbGllbnRQcm9ncmFtcywgYXJjaCkpIHtcbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKGNhdGVnb3JpemVkLCB7IGFyY2ggfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGNhdGVnb3JpemVkO1xufTtcblxuLy8gSFRNTCBhdHRyaWJ1dGUgaG9va3M6IGZ1bmN0aW9ucyB0byBiZSBjYWxsZWQgdG8gZGV0ZXJtaW5lIGFueSBhdHRyaWJ1dGVzIHRvXG4vLyBiZSBhZGRlZCB0byB0aGUgJzxodG1sPicgdGFnLiBFYWNoIGZ1bmN0aW9uIGlzIHBhc3NlZCBhICdyZXF1ZXN0JyBvYmplY3QgKHNlZVxuLy8gI0Jyb3dzZXJJZGVudGlmaWNhdGlvbikgYW5kIHNob3VsZCByZXR1cm4gbnVsbCBvciBvYmplY3QuXG52YXIgaHRtbEF0dHJpYnV0ZUhvb2tzID0gW107XG52YXIgZ2V0SHRtbEF0dHJpYnV0ZXMgPSBmdW5jdGlvbihyZXF1ZXN0KSB7XG4gIHZhciBjb21iaW5lZEF0dHJpYnV0ZXMgPSB7fTtcbiAgXy5lYWNoKGh0bWxBdHRyaWJ1dGVIb29rcyB8fCBbXSwgZnVuY3Rpb24oaG9vaykge1xuICAgIHZhciBhdHRyaWJ1dGVzID0gaG9vayhyZXF1ZXN0KTtcbiAgICBpZiAoYXR0cmlidXRlcyA9PT0gbnVsbCkgcmV0dXJuO1xuICAgIGlmICh0eXBlb2YgYXR0cmlidXRlcyAhPT0gJ29iamVjdCcpXG4gICAgICB0aHJvdyBFcnJvcignSFRNTCBhdHRyaWJ1dGUgaG9vayBtdXN0IHJldHVybiBudWxsIG9yIG9iamVjdCcpO1xuICAgIF8uZXh0ZW5kKGNvbWJpbmVkQXR0cmlidXRlcywgYXR0cmlidXRlcyk7XG4gIH0pO1xuICByZXR1cm4gY29tYmluZWRBdHRyaWJ1dGVzO1xufTtcbldlYkFwcC5hZGRIdG1sQXR0cmlidXRlSG9vayA9IGZ1bmN0aW9uKGhvb2spIHtcbiAgaHRtbEF0dHJpYnV0ZUhvb2tzLnB1c2goaG9vayk7XG59O1xuXG4vLyBTZXJ2ZSBhcHAgSFRNTCBmb3IgdGhpcyBVUkw/XG52YXIgYXBwVXJsID0gZnVuY3Rpb24odXJsKSB7XG4gIGlmICh1cmwgPT09ICcvZmF2aWNvbi5pY28nIHx8IHVybCA9PT0gJy9yb2JvdHMudHh0JykgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIE5PVEU6IGFwcC5tYW5pZmVzdCBpcyBub3QgYSB3ZWIgc3RhbmRhcmQgbGlrZSBmYXZpY29uLmljbyBhbmRcbiAgLy8gcm9ib3RzLnR4dC4gSXQgaXMgYSBmaWxlIG5hbWUgd2UgaGF2ZSBjaG9zZW4gdG8gdXNlIGZvciBIVE1MNVxuICAvLyBhcHBjYWNoZSBVUkxzLiBJdCBpcyBpbmNsdWRlZCBoZXJlIHRvIHByZXZlbnQgdXNpbmcgYW4gYXBwY2FjaGVcbiAgLy8gdGhlbiByZW1vdmluZyBpdCBmcm9tIHBvaXNvbmluZyBhbiBhcHAgcGVybWFuZW50bHkuIEV2ZW50dWFsbHksXG4gIC8vIG9uY2Ugd2UgaGF2ZSBzZXJ2ZXIgc2lkZSByb3V0aW5nLCB0aGlzIHdvbid0IGJlIG5lZWRlZCBhc1xuICAvLyB1bmtub3duIFVSTHMgd2l0aCByZXR1cm4gYSA0MDQgYXV0b21hdGljYWxseS5cbiAgaWYgKHVybCA9PT0gJy9hcHAubWFuaWZlc3QnKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gQXZvaWQgc2VydmluZyBhcHAgSFRNTCBmb3IgZGVjbGFyZWQgcm91dGVzIHN1Y2ggYXMgL3NvY2tqcy8uXG4gIGlmIChSb3V0ZVBvbGljeS5jbGFzc2lmeSh1cmwpKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gd2UgY3VycmVudGx5IHJldHVybiBhcHAgSFRNTCBvbiBhbGwgVVJMcyBieSBkZWZhdWx0XG4gIHJldHVybiB0cnVlO1xufTtcblxuLy8gV2UgbmVlZCB0byBjYWxjdWxhdGUgdGhlIGNsaWVudCBoYXNoIGFmdGVyIGFsbCBwYWNrYWdlcyBoYXZlIGxvYWRlZFxuLy8gdG8gZ2l2ZSB0aGVtIGEgY2hhbmNlIHRvIHBvcHVsYXRlIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uXG4vL1xuLy8gQ2FsY3VsYXRpbmcgdGhlIGhhc2ggZHVyaW5nIHN0YXJ0dXAgbWVhbnMgdGhhdCBwYWNrYWdlcyBjYW4gb25seVxuLy8gcG9wdWxhdGUgX19tZXRlb3JfcnVudGltZV9jb25maWdfXyBkdXJpbmcgbG9hZCwgbm90IGR1cmluZyBzdGFydHVwLlxuLy9cbi8vIENhbGN1bGF0aW5nIGluc3RlYWQgaXQgYXQgdGhlIGJlZ2lubmluZyBvZiBtYWluIGFmdGVyIGFsbCBzdGFydHVwXG4vLyBob29rcyBoYWQgcnVuIHdvdWxkIGFsbG93IHBhY2thZ2VzIHRvIGFsc28gcG9wdWxhdGVcbi8vIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18gZHVyaW5nIHN0YXJ0dXAsIGJ1dCB0aGF0J3MgdG9vIGxhdGUgZm9yXG4vLyBhdXRvdXBkYXRlIGJlY2F1c2UgaXQgbmVlZHMgdG8gaGF2ZSB0aGUgY2xpZW50IGhhc2ggYXQgc3RhcnR1cCB0b1xuLy8gaW5zZXJ0IHRoZSBhdXRvIHVwZGF0ZSB2ZXJzaW9uIGl0c2VsZiBpbnRvXG4vLyBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fIHRvIGdldCBpdCB0byB0aGUgY2xpZW50LlxuLy9cbi8vIEFuIGFsdGVybmF0aXZlIHdvdWxkIGJlIHRvIGdpdmUgYXV0b3VwZGF0ZSBhIFwicG9zdC1zdGFydCxcbi8vIHByZS1saXN0ZW5cIiBob29rIHRvIGFsbG93IGl0IHRvIGluc2VydCB0aGUgYXV0byB1cGRhdGUgdmVyc2lvbiBhdFxuLy8gdGhlIHJpZ2h0IG1vbWVudC5cblxuTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG4gIGZ1bmN0aW9uIGdldHRlcihrZXkpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oYXJjaCkge1xuICAgICAgYXJjaCA9IGFyY2ggfHwgV2ViQXBwLmRlZmF1bHRBcmNoO1xuICAgICAgY29uc3QgcHJvZ3JhbSA9IFdlYkFwcC5jbGllbnRQcm9ncmFtc1thcmNoXTtcbiAgICAgIGNvbnN0IHZhbHVlID0gcHJvZ3JhbSAmJiBwcm9ncmFtW2tleV07XG4gICAgICAvLyBJZiB0aGlzIGlzIHRoZSBmaXJzdCB0aW1lIHdlIGhhdmUgY2FsY3VsYXRlZCB0aGlzIGhhc2gsXG4gICAgICAvLyBwcm9ncmFtW2tleV0gd2lsbCBiZSBhIHRodW5rIChsYXp5IGZ1bmN0aW9uIHdpdGggbm8gcGFyYW1ldGVycylcbiAgICAgIC8vIHRoYXQgd2Ugc2hvdWxkIGNhbGwgdG8gZG8gdGhlIGFjdHVhbCBjb21wdXRhdGlvbi5cbiAgICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgPyAocHJvZ3JhbVtrZXldID0gdmFsdWUoKSkgOiB2YWx1ZTtcbiAgICB9O1xuICB9XG5cbiAgV2ViQXBwLmNhbGN1bGF0ZUNsaWVudEhhc2ggPSBXZWJBcHAuY2xpZW50SGFzaCA9IGdldHRlcigndmVyc2lvbicpO1xuICBXZWJBcHAuY2FsY3VsYXRlQ2xpZW50SGFzaFJlZnJlc2hhYmxlID0gZ2V0dGVyKCd2ZXJzaW9uUmVmcmVzaGFibGUnKTtcbiAgV2ViQXBwLmNhbGN1bGF0ZUNsaWVudEhhc2hOb25SZWZyZXNoYWJsZSA9IGdldHRlcigndmVyc2lvbk5vblJlZnJlc2hhYmxlJyk7XG4gIFdlYkFwcC5jYWxjdWxhdGVDbGllbnRIYXNoUmVwbGFjZWFibGUgPSBnZXR0ZXIoJ3ZlcnNpb25SZXBsYWNlYWJsZScpO1xuICBXZWJBcHAuZ2V0UmVmcmVzaGFibGVBc3NldHMgPSBnZXR0ZXIoJ3JlZnJlc2hhYmxlQXNzZXRzJyk7XG59KTtcblxuLy8gV2hlbiB3ZSBoYXZlIGEgcmVxdWVzdCBwZW5kaW5nLCB3ZSB3YW50IHRoZSBzb2NrZXQgdGltZW91dCB0byBiZSBsb25nLCB0b1xuLy8gZ2l2ZSBvdXJzZWx2ZXMgYSB3aGlsZSB0byBzZXJ2ZSBpdCwgYW5kIHRvIGFsbG93IHNvY2tqcyBsb25nIHBvbGxzIHRvXG4vLyBjb21wbGV0ZS4gIE9uIHRoZSBvdGhlciBoYW5kLCB3ZSB3YW50IHRvIGNsb3NlIGlkbGUgc29ja2V0cyByZWxhdGl2ZWx5XG4vLyBxdWlja2x5LCBzbyB0aGF0IHdlIGNhbiBzaHV0IGRvd24gcmVsYXRpdmVseSBwcm9tcHRseSBidXQgY2xlYW5seSwgd2l0aG91dFxuLy8gY3V0dGluZyBvZmYgYW55b25lJ3MgcmVzcG9uc2UuXG5XZWJBcHAuX3RpbWVvdXRBZGp1c3RtZW50UmVxdWVzdENhbGxiYWNrID0gZnVuY3Rpb24ocmVxLCByZXMpIHtcbiAgLy8gdGhpcyBpcyByZWFsbHkganVzdCByZXEuc29ja2V0LnNldFRpbWVvdXQoTE9OR19TT0NLRVRfVElNRU9VVCk7XG4gIHJlcS5zZXRUaW1lb3V0KExPTkdfU09DS0VUX1RJTUVPVVQpO1xuICAvLyBJbnNlcnQgb3VyIG5ldyBmaW5pc2ggbGlzdGVuZXIgdG8gcnVuIEJFRk9SRSB0aGUgZXhpc3Rpbmcgb25lIHdoaWNoIHJlbW92ZXNcbiAgLy8gdGhlIHJlc3BvbnNlIGZyb20gdGhlIHNvY2tldC5cbiAgdmFyIGZpbmlzaExpc3RlbmVycyA9IHJlcy5saXN0ZW5lcnMoJ2ZpbmlzaCcpO1xuICAvLyBYWFggQXBwYXJlbnRseSBpbiBOb2RlIDAuMTIgdGhpcyBldmVudCB3YXMgY2FsbGVkICdwcmVmaW5pc2gnLlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vam95ZW50L25vZGUvY29tbWl0LzdjOWI2MDcwXG4gIC8vIEJ1dCBpdCBoYXMgc3dpdGNoZWQgYmFjayB0byAnZmluaXNoJyBpbiBOb2RlIHY0OlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvcHVsbC8xNDExXG4gIHJlcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2ZpbmlzaCcpO1xuICByZXMub24oJ2ZpbmlzaCcsIGZ1bmN0aW9uKCkge1xuICAgIHJlcy5zZXRUaW1lb3V0KFNIT1JUX1NPQ0tFVF9USU1FT1VUKTtcbiAgfSk7XG4gIF8uZWFjaChmaW5pc2hMaXN0ZW5lcnMsIGZ1bmN0aW9uKGwpIHtcbiAgICByZXMub24oJ2ZpbmlzaCcsIGwpO1xuICB9KTtcbn07XG5cbi8vIFdpbGwgYmUgdXBkYXRlZCBieSBtYWluIGJlZm9yZSB3ZSBsaXN0ZW4uXG4vLyBNYXAgZnJvbSBjbGllbnQgYXJjaCB0byBib2lsZXJwbGF0ZSBvYmplY3QuXG4vLyBCb2lsZXJwbGF0ZSBvYmplY3QgaGFzOlxuLy8gICAtIGZ1bmM6IFhYWFxuLy8gICAtIGJhc2VEYXRhOiBYWFhcbnZhciBib2lsZXJwbGF0ZUJ5QXJjaCA9IHt9O1xuXG4vLyBSZWdpc3RlciBhIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgY2FuIHNlbGVjdGl2ZWx5IG1vZGlmeSBib2lsZXJwbGF0ZVxuLy8gZGF0YSBnaXZlbiBhcmd1bWVudHMgKHJlcXVlc3QsIGRhdGEsIGFyY2gpLiBUaGUga2V5IHNob3VsZCBiZSBhIHVuaXF1ZVxuLy8gaWRlbnRpZmllciwgdG8gcHJldmVudCBhY2N1bXVsYXRpbmcgZHVwbGljYXRlIGNhbGxiYWNrcyBmcm9tIHRoZSBzYW1lXG4vLyBjYWxsIHNpdGUgb3ZlciB0aW1lLiBDYWxsYmFja3Mgd2lsbCBiZSBjYWxsZWQgaW4gdGhlIG9yZGVyIHRoZXkgd2VyZVxuLy8gcmVnaXN0ZXJlZC4gQSBjYWxsYmFjayBzaG91bGQgcmV0dXJuIGZhbHNlIGlmIGl0IGRpZCBub3QgbWFrZSBhbnlcbi8vIGNoYW5nZXMgYWZmZWN0aW5nIHRoZSBib2lsZXJwbGF0ZS4gUGFzc2luZyBudWxsIGRlbGV0ZXMgdGhlIGNhbGxiYWNrLlxuLy8gQW55IHByZXZpb3VzIGNhbGxiYWNrIHJlZ2lzdGVyZWQgZm9yIHRoaXMga2V5IHdpbGwgYmUgcmV0dXJuZWQuXG5jb25zdCBib2lsZXJwbGF0ZURhdGFDYWxsYmFja3MgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuV2ViQXBwSW50ZXJuYWxzLnJlZ2lzdGVyQm9pbGVycGxhdGVEYXRhQ2FsbGJhY2sgPSBmdW5jdGlvbihrZXksIGNhbGxiYWNrKSB7XG4gIGNvbnN0IHByZXZpb3VzQ2FsbGJhY2sgPSBib2lsZXJwbGF0ZURhdGFDYWxsYmFja3Nba2V5XTtcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgYm9pbGVycGxhdGVEYXRhQ2FsbGJhY2tzW2tleV0gPSBjYWxsYmFjaztcbiAgfSBlbHNlIHtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbGJhY2ssIG51bGwpO1xuICAgIGRlbGV0ZSBib2lsZXJwbGF0ZURhdGFDYWxsYmFja3Nba2V5XTtcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgcHJldmlvdXMgY2FsbGJhY2sgaW4gY2FzZSB0aGUgbmV3IGNhbGxiYWNrIG5lZWRzIHRvIGNhbGxcbiAgLy8gaXQ7IGZvciBleGFtcGxlLCB3aGVuIHRoZSBuZXcgY2FsbGJhY2sgaXMgYSB3cmFwcGVyIGZvciB0aGUgb2xkLlxuICByZXR1cm4gcHJldmlvdXNDYWxsYmFjayB8fCBudWxsO1xufTtcblxuLy8gR2l2ZW4gYSByZXF1ZXN0IChhcyByZXR1cm5lZCBmcm9tIGBjYXRlZ29yaXplUmVxdWVzdGApLCByZXR1cm4gdGhlXG4vLyBib2lsZXJwbGF0ZSBIVE1MIHRvIHNlcnZlIGZvciB0aGF0IHJlcXVlc3QuXG4vL1xuLy8gSWYgYSBwcmV2aW91cyBFeHByZXNzIG1pZGRsZXdhcmUgaGFzIHJlbmRlcmVkIGNvbnRlbnQgZm9yIHRoZSBoZWFkIG9yIGJvZHksXG4vLyByZXR1cm5zIHRoZSBib2lsZXJwbGF0ZSB3aXRoIHRoYXQgY29udGVudCBwYXRjaGVkIGluIG90aGVyd2lzZVxuLy8gbWVtb2l6ZXMgb24gSFRNTCBhdHRyaWJ1dGVzICh1c2VkIGJ5LCBlZywgYXBwY2FjaGUpIGFuZCB3aGV0aGVyIGlubGluZVxuLy8gc2NyaXB0cyBhcmUgY3VycmVudGx5IGFsbG93ZWQuXG4vLyBYWFggc28gZmFyIHRoaXMgZnVuY3Rpb24gaXMgYWx3YXlzIGNhbGxlZCB3aXRoIGFyY2ggPT09ICd3ZWIuYnJvd3NlcidcbmZ1bmN0aW9uIGdldEJvaWxlcnBsYXRlKHJlcXVlc3QsIGFyY2gpIHtcbiAgcmV0dXJuIGdldEJvaWxlcnBsYXRlQXN5bmMocmVxdWVzdCwgYXJjaCk7XG59XG5cbi8qKlxuICogQHN1bW1hcnkgVGFrZXMgYSBydW50aW1lIGNvbmZpZ3VyYXRpb24gb2JqZWN0IGFuZFxuICogcmV0dXJucyBhbiBlbmNvZGVkIHJ1bnRpbWUgc3RyaW5nLlxuICogQGxvY3VzIFNlcnZlclxuICogQHBhcmFtIHtPYmplY3R9IHJ0aW1lQ29uZmlnXG4gKiBAcmV0dXJucyB7U3RyaW5nfVxuICovXG5XZWJBcHAuZW5jb2RlUnVudGltZUNvbmZpZyA9IGZ1bmN0aW9uKHJ0aW1lQ29uZmlnKSB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeShlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkocnRpbWVDb25maWcpKSk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFRha2VzIGFuIGVuY29kZWQgcnVudGltZSBzdHJpbmcgYW5kIHJldHVybnNcbiAqIGEgcnVudGltZSBjb25maWd1cmF0aW9uIG9iamVjdC5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7U3RyaW5nfSBydGltZUNvbmZpZ1N0cmluZ1xuICogQHJldHVybnMge09iamVjdH1cbiAqL1xuV2ViQXBwLmRlY29kZVJ1bnRpbWVDb25maWcgPSBmdW5jdGlvbihydGltZUNvbmZpZ1N0cikge1xuICByZXR1cm4gSlNPTi5wYXJzZShkZWNvZGVVUklDb21wb25lbnQoSlNPTi5wYXJzZShydGltZUNvbmZpZ1N0cikpKTtcbn07XG5cbmNvbnN0IHJ1bnRpbWVDb25maWcgPSB7XG4gIC8vIGhvb2tzIHdpbGwgY29udGFpbiB0aGUgY2FsbGJhY2sgZnVuY3Rpb25zXG4gIC8vIHNldCBieSB0aGUgY2FsbGVyIHRvIGFkZFJ1bnRpbWVDb25maWdIb29rXG4gIGhvb2tzOiBuZXcgSG9vaygpLFxuICAvLyB1cGRhdGVIb29rcyB3aWxsIGNvbnRhaW4gdGhlIGNhbGxiYWNrIGZ1bmN0aW9uc1xuICAvLyBzZXQgYnkgdGhlIGNhbGxlciB0byBhZGRVcGRhdGVkTm90aWZ5SG9va1xuICB1cGRhdGVIb29rczogbmV3IEhvb2soKSxcbiAgLy8gaXNVcGRhdGVkQnlBcmNoIGlzIGFuIG9iamVjdCBjb250YWluaW5nIGZpZWxkcyBmb3IgZWFjaCBhcmNoXG4gIC8vIHRoYXQgdGhpcyBzZXJ2ZXIgc3VwcG9ydHMuXG4gIC8vIC0gRWFjaCBmaWVsZCB3aWxsIGJlIHRydWUgd2hlbiB0aGUgc2VydmVyIHVwZGF0ZXMgdGhlIHJ1bnRpbWVDb25maWcgZm9yIHRoYXQgYXJjaC5cbiAgLy8gLSBXaGVuIHRoZSBob29rIGNhbGxiYWNrIGlzIGNhbGxlZCB0aGUgdXBkYXRlIGZpZWxkIGluIHRoZSBjYWxsYmFjayBvYmplY3Qgd2lsbCBiZVxuICAvLyBzZXQgdG8gaXNVcGRhdGVkQnlBcmNoW2FyY2hdLlxuICAvLyA9IGlzVXBkYXRlZHlCeUFyY2hbYXJjaF0gaXMgcmVzZXQgdG8gZmFsc2UgYWZ0ZXIgdGhlIGNhbGxiYWNrLlxuICAvLyBUaGlzIGVuYWJsZXMgdGhlIGNhbGxlciB0byBjYWNoZSBkYXRhIGVmZmljaWVudGx5IHNvIHRoZXkgZG8gbm90IG5lZWQgdG9cbiAgLy8gZGVjb2RlICYgdXBkYXRlIGRhdGEgb24gZXZlcnkgY2FsbGJhY2sgd2hlbiB0aGUgcnVudGltZUNvbmZpZyBpcyBub3QgY2hhbmdpbmcuXG4gIGlzVXBkYXRlZEJ5QXJjaDoge30sXG59O1xuXG4vKipcbiAqIEBuYW1lIGFkZFJ1bnRpbWVDb25maWdIb29rQ2FsbGJhY2sob3B0aW9ucylcbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBpc3Byb3RvdHlwZSB0cnVlXG4gKiBAc3VtbWFyeSBDYWxsYmFjayBmb3IgYGFkZFJ1bnRpbWVDb25maWdIb29rYC5cbiAqXG4gKiBJZiB0aGUgaGFuZGxlciByZXR1cm5zIGEgX2ZhbHN5XyB2YWx1ZSB0aGUgaG9vayB3aWxsIG5vdFxuICogbW9kaWZ5IHRoZSBydW50aW1lIGNvbmZpZ3VyYXRpb24uXG4gKlxuICogSWYgdGhlIGhhbmRsZXIgcmV0dXJucyBhIF9TdHJpbmdfIHRoZSBob29rIHdpbGwgc3Vic3RpdHV0ZVxuICogdGhlIHN0cmluZyBmb3IgdGhlIGVuY29kZWQgY29uZmlndXJhdGlvbiBzdHJpbmcuXG4gKlxuICogKipXYXJuaW5nOioqIHRoZSBob29rIGRvZXMgbm90IGNoZWNrIHRoZSByZXR1cm4gdmFsdWUgYXQgYWxsIGl0IGlzXG4gKiB0aGUgcmVzcG9uc2liaWxpdHkgb2YgdGhlIGNhbGxlciB0byBnZXQgdGhlIGZvcm1hdHRpbmcgY29ycmVjdCB1c2luZ1xuICogdGhlIGhlbHBlciBmdW5jdGlvbnMuXG4gKlxuICogYGFkZFJ1bnRpbWVDb25maWdIb29rQ2FsbGJhY2tgIHRha2VzIG9ubHkgb25lIGBPYmplY3RgIGFyZ3VtZW50XG4gKiB3aXRoIHRoZSBmb2xsb3dpbmcgZmllbGRzOlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLmFyY2ggVGhlIGFyY2hpdGVjdHVyZSBvZiB0aGUgY2xpZW50XG4gKiByZXF1ZXN0aW5nIGEgbmV3IHJ1bnRpbWUgY29uZmlndXJhdGlvbi4gVGhpcyBjYW4gYmUgb25lIG9mXG4gKiBgd2ViLmJyb3dzZXJgLCBgd2ViLmJyb3dzZXIubGVnYWN5YCBvciBgd2ViLmNvcmRvdmFgLlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMucmVxdWVzdFxuICogQSBOb2RlSnMgW0luY29taW5nTWVzc2FnZV0oaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9odHRwLmh0bWwjaHR0cF9jbGFzc19odHRwX2luY29taW5nbWVzc2FnZSlcbiAqIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvaHR0cC5odG1sI2h0dHBfY2xhc3NfaHR0cF9pbmNvbWluZ21lc3NhZ2VcbiAqIGBPYmplY3RgIHRoYXQgY2FuIGJlIHVzZWQgdG8gZ2V0IGluZm9ybWF0aW9uIGFib3V0IHRoZSBpbmNvbWluZyByZXF1ZXN0LlxuICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMuZW5jb2RlZEN1cnJlbnRDb25maWcgVGhlIGN1cnJlbnQgY29uZmlndXJhdGlvbiBvYmplY3RcbiAqIGVuY29kZWQgYXMgYSBzdHJpbmcgZm9yIGluY2x1c2lvbiBpbiB0aGUgcm9vdCBodG1sLlxuICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnVwZGF0ZWQgYHRydWVgIGlmIHRoZSBjb25maWcgZm9yIHRoaXMgYXJjaGl0ZWN0dXJlXG4gKiBoYXMgYmVlbiB1cGRhdGVkIHNpbmNlIGxhc3QgY2FsbGVkLCBvdGhlcndpc2UgYGZhbHNlYC4gVGhpcyBmbGFnIGNhbiBiZSB1c2VkXG4gKiB0byBjYWNoZSB0aGUgZGVjb2RpbmcvZW5jb2RpbmcgZm9yIGVhY2ggYXJjaGl0ZWN0dXJlLlxuICovXG5cbi8qKlxuICogQHN1bW1hcnkgSG9vayB0aGF0IGNhbGxzIGJhY2sgd2hlbiB0aGUgbWV0ZW9yIHJ1bnRpbWUgY29uZmlndXJhdGlvbixcbiAqIGBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fYCBpcyBiZWluZyBzZW50IHRvIGFueSBjbGllbnQuXG4gKlxuICogKipyZXR1cm5zKio6IDxzbWFsbD5fT2JqZWN0Xzwvc21hbGw+IGB7IHN0b3A6IGZ1bmN0aW9uLCBjYWxsYmFjazogZnVuY3Rpb24gfWBcbiAqIC0gYHN0b3BgIDxzbWFsbD5fRnVuY3Rpb25fPC9zbWFsbD4gQ2FsbCBgc3RvcCgpYCB0byBzdG9wIGdldHRpbmcgY2FsbGJhY2tzLlxuICogLSBgY2FsbGJhY2tgIDxzbWFsbD5fRnVuY3Rpb25fPC9zbWFsbD4gVGhlIHBhc3NlZCBpbiBgY2FsbGJhY2tgLlxuICogQGxvY3VzIFNlcnZlclxuICogQHBhcmFtIHthZGRSdW50aW1lQ29uZmlnSG9va0NhbGxiYWNrfSBjYWxsYmFja1xuICogU2VlIGBhZGRSdW50aW1lQ29uZmlnSG9va0NhbGxiYWNrYCBkZXNjcmlwdGlvbi5cbiAqIEByZXR1cm5zIHtPYmplY3R9IHt7IHN0b3A6IGZ1bmN0aW9uLCBjYWxsYmFjazogZnVuY3Rpb24gfX1cbiAqIENhbGwgdGhlIHJldHVybmVkIGBzdG9wKClgIHRvIHN0b3AgZ2V0dGluZyBjYWxsYmFja3MuXG4gKiBUaGUgcGFzc2VkIGluIGBjYWxsYmFja2AgaXMgcmV0dXJuZWQgYWxzby5cbiAqL1xuV2ViQXBwLmFkZFJ1bnRpbWVDb25maWdIb29rID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgcmV0dXJuIHJ1bnRpbWVDb25maWcuaG9va3MucmVnaXN0ZXIoY2FsbGJhY2spO1xufTtcblxuYXN5bmMgZnVuY3Rpb24gZ2V0Qm9pbGVycGxhdGVBc3luYyhyZXF1ZXN0LCBhcmNoKSB7XG4gIGxldCBib2lsZXJwbGF0ZSA9IGJvaWxlcnBsYXRlQnlBcmNoW2FyY2hdO1xuICBhd2FpdCBydW50aW1lQ29uZmlnLmhvb2tzLmZvckVhY2hBc3luYyhhc3luYyBob29rID0+IHtcbiAgICBjb25zdCBtZXRlb3JSdW50aW1lQ29uZmlnID0gYXdhaXQgaG9vayh7XG4gICAgICBhcmNoLFxuICAgICAgcmVxdWVzdCxcbiAgICAgIGVuY29kZWRDdXJyZW50Q29uZmlnOiBib2lsZXJwbGF0ZS5iYXNlRGF0YS5tZXRlb3JSdW50aW1lQ29uZmlnLFxuICAgICAgdXBkYXRlZDogcnVudGltZUNvbmZpZy5pc1VwZGF0ZWRCeUFyY2hbYXJjaF0sXG4gICAgfSk7XG4gICAgaWYgKCFtZXRlb3JSdW50aW1lQ29uZmlnKSByZXR1cm4gdHJ1ZTtcbiAgICBib2lsZXJwbGF0ZS5iYXNlRGF0YSA9IE9iamVjdC5hc3NpZ24oe30sIGJvaWxlcnBsYXRlLmJhc2VEYXRhLCB7XG4gICAgICBtZXRlb3JSdW50aW1lQ29uZmlnLFxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9KTtcbiAgcnVudGltZUNvbmZpZy5pc1VwZGF0ZWRCeUFyY2hbYXJjaF0gPSBmYWxzZTtcbiAgY29uc3QgZGF0YSA9IE9iamVjdC5hc3NpZ24oXG4gICAge30sXG4gICAgYm9pbGVycGxhdGUuYmFzZURhdGEsXG4gICAge1xuICAgICAgaHRtbEF0dHJpYnV0ZXM6IGdldEh0bWxBdHRyaWJ1dGVzKHJlcXVlc3QpLFxuICAgIH0sXG4gICAgXy5waWNrKHJlcXVlc3QsICdkeW5hbWljSGVhZCcsICdkeW5hbWljQm9keScpXG4gICk7XG5cbiAgbGV0IG1hZGVDaGFuZ2VzID0gZmFsc2U7XG4gIGxldCBwcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKCk7XG5cbiAgT2JqZWN0LmtleXMoYm9pbGVycGxhdGVEYXRhQ2FsbGJhY2tzKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgcHJvbWlzZSA9IHByb21pc2VcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBib2lsZXJwbGF0ZURhdGFDYWxsYmFja3Nba2V5XTtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKHJlcXVlc3QsIGRhdGEsIGFyY2gpO1xuICAgICAgfSlcbiAgICAgIC50aGVuKHJlc3VsdCA9PiB7XG4gICAgICAgIC8vIENhbGxiYWNrcyBzaG91bGQgcmV0dXJuIGZhbHNlIGlmIHRoZXkgZGlkIG5vdCBtYWtlIGFueSBjaGFuZ2VzLlxuICAgICAgICBpZiAocmVzdWx0ICE9PSBmYWxzZSkge1xuICAgICAgICAgIG1hZGVDaGFuZ2VzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH0pO1xuXG4gIHJldHVybiBwcm9taXNlLnRoZW4oKCkgPT4gKHtcbiAgICBzdHJlYW06IGJvaWxlcnBsYXRlLnRvSFRNTFN0cmVhbShkYXRhKSxcbiAgICBzdGF0dXNDb2RlOiBkYXRhLnN0YXR1c0NvZGUsXG4gICAgaGVhZGVyczogZGF0YS5oZWFkZXJzLFxuICB9KSk7XG59XG5cbi8qKlxuICogQG5hbWUgYWRkVXBkYXRlZE5vdGlmeUhvb2tDYWxsYmFjayhvcHRpb25zKVxuICogQHN1bW1hcnkgY2FsbGJhY2sgaGFuZGxlciBmb3IgYGFkZHVwZGF0ZWROb3RpZnlIb29rYFxuICogQGlzcHJvdG90eXBlIHRydWVcbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5hcmNoIFRoZSBhcmNoaXRlY3R1cmUgdGhhdCBpcyBiZWluZyB1cGRhdGVkLlxuICogVGhpcyBjYW4gYmUgb25lIG9mIGB3ZWIuYnJvd3NlcmAsIGB3ZWIuYnJvd3Nlci5sZWdhY3lgIG9yIGB3ZWIuY29yZG92YWAuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5tYW5pZmVzdCBUaGUgbmV3IHVwZGF0ZWQgbWFuaWZlc3Qgb2JqZWN0IGZvclxuICogdGhpcyBgYXJjaGAuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5ydW50aW1lQ29uZmlnIFRoZSBuZXcgdXBkYXRlZCBjb25maWd1cmF0aW9uXG4gKiBvYmplY3QgZm9yIHRoaXMgYGFyY2hgLlxuICovXG5cbi8qKlxuICogQHN1bW1hcnkgSG9vayB0aGF0IHJ1bnMgd2hlbiB0aGUgbWV0ZW9yIHJ1bnRpbWUgY29uZmlndXJhdGlvblxuICogaXMgdXBkYXRlZC4gIFR5cGljYWxseSB0aGUgY29uZmlndXJhdGlvbiBvbmx5IGNoYW5nZXMgZHVyaW5nIGRldmVsb3BtZW50IG1vZGUuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge2FkZFVwZGF0ZWROb3RpZnlIb29rQ2FsbGJhY2t9IGhhbmRsZXJcbiAqIFRoZSBgaGFuZGxlcmAgaXMgY2FsbGVkIG9uIGV2ZXJ5IGNoYW5nZSB0byBhbiBgYXJjaGAgcnVudGltZSBjb25maWd1cmF0aW9uLlxuICogU2VlIGBhZGRVcGRhdGVkTm90aWZ5SG9va0NhbGxiYWNrYC5cbiAqIEByZXR1cm5zIHtPYmplY3R9IHt7IHN0b3A6IGZ1bmN0aW9uLCBjYWxsYmFjazogZnVuY3Rpb24gfX1cbiAqL1xuV2ViQXBwLmFkZFVwZGF0ZWROb3RpZnlIb29rID0gZnVuY3Rpb24oaGFuZGxlcikge1xuICByZXR1cm4gcnVudGltZUNvbmZpZy51cGRhdGVIb29rcy5yZWdpc3RlcihoYW5kbGVyKTtcbn07XG5cbldlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlSW5zdGFuY2UgPSBmdW5jdGlvbihcbiAgYXJjaCxcbiAgbWFuaWZlc3QsXG4gIGFkZGl0aW9uYWxPcHRpb25zXG4pIHtcbiAgYWRkaXRpb25hbE9wdGlvbnMgPSBhZGRpdGlvbmFsT3B0aW9ucyB8fCB7fTtcblxuICBydW50aW1lQ29uZmlnLmlzVXBkYXRlZEJ5QXJjaFthcmNoXSA9IHRydWU7XG4gIGNvbnN0IHJ0aW1lQ29uZmlnID0ge1xuICAgIC4uLl9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18sXG4gICAgLi4uKGFkZGl0aW9uYWxPcHRpb25zLnJ1bnRpbWVDb25maWdPdmVycmlkZXMgfHwge30pLFxuICB9O1xuICBydW50aW1lQ29uZmlnLnVwZGF0ZUhvb2tzLmZvckVhY2goY2IgPT4ge1xuICAgIGNiKHsgYXJjaCwgbWFuaWZlc3QsIHJ1bnRpbWVDb25maWc6IHJ0aW1lQ29uZmlnIH0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9KTtcblxuICBjb25zdCBtZXRlb3JSdW50aW1lQ29uZmlnID0gSlNPTi5zdHJpbmdpZnkoXG4gICAgZW5jb2RlVVJJQ29tcG9uZW50KEpTT04uc3RyaW5naWZ5KHJ0aW1lQ29uZmlnKSlcbiAgKTtcblxuICByZXR1cm4gbmV3IEJvaWxlcnBsYXRlKFxuICAgIGFyY2gsXG4gICAgbWFuaWZlc3QsXG4gICAgT2JqZWN0LmFzc2lnbihcbiAgICAgIHtcbiAgICAgICAgcGF0aE1hcHBlcihpdGVtUGF0aCkge1xuICAgICAgICAgIHJldHVybiBwYXRoSm9pbihhcmNoUGF0aFthcmNoXSwgaXRlbVBhdGgpO1xuICAgICAgICB9LFxuICAgICAgICBiYXNlRGF0YUV4dGVuc2lvbjoge1xuICAgICAgICAgIGFkZGl0aW9uYWxTdGF0aWNKczogXy5tYXAoYWRkaXRpb25hbFN0YXRpY0pzIHx8IFtdLCBmdW5jdGlvbihcbiAgICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgICAgcGF0aG5hbWVcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHBhdGhuYW1lOiBwYXRobmFtZSxcbiAgICAgICAgICAgICAgY29udGVudHM6IGNvbnRlbnRzLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9KSxcbiAgICAgICAgICAvLyBDb252ZXJ0IHRvIGEgSlNPTiBzdHJpbmcsIHRoZW4gZ2V0IHJpZCBvZiBtb3N0IHdlaXJkIGNoYXJhY3RlcnMsIHRoZW5cbiAgICAgICAgICAvLyB3cmFwIGluIGRvdWJsZSBxdW90ZXMuIChUaGUgb3V0ZXJtb3N0IEpTT04uc3RyaW5naWZ5IHJlYWxseSBvdWdodCB0b1xuICAgICAgICAgIC8vIGp1c3QgYmUgXCJ3cmFwIGluIGRvdWJsZSBxdW90ZXNcIiBidXQgd2UgdXNlIGl0IHRvIGJlIHNhZmUuKSBUaGlzIG1pZ2h0XG4gICAgICAgICAgLy8gZW5kIHVwIGluc2lkZSBhIDxzY3JpcHQ+IHRhZyBzbyB3ZSBuZWVkIHRvIGJlIGNhcmVmdWwgdG8gbm90IGluY2x1ZGVcbiAgICAgICAgICAvLyBcIjwvc2NyaXB0PlwiLCBidXQgbm9ybWFsIHt7c3BhY2ViYXJzfX0gZXNjYXBpbmcgZXNjYXBlcyB0b28gbXVjaCEgU2VlXG4gICAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzM3MzBcbiAgICAgICAgICBtZXRlb3JSdW50aW1lQ29uZmlnLFxuICAgICAgICAgIG1ldGVvclJ1bnRpbWVIYXNoOiBzaGExKG1ldGVvclJ1bnRpbWVDb25maWcpLFxuICAgICAgICAgIHJvb3RVcmxQYXRoUHJlZml4OlxuICAgICAgICAgICAgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ST09UX1VSTF9QQVRIX1BSRUZJWCB8fCAnJyxcbiAgICAgICAgICBidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vazogYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2ssXG4gICAgICAgICAgc3JpTW9kZTogc3JpTW9kZSxcbiAgICAgICAgICBpbmxpbmVTY3JpcHRzQWxsb3dlZDogV2ViQXBwSW50ZXJuYWxzLmlubGluZVNjcmlwdHNBbGxvd2VkKCksXG4gICAgICAgICAgaW5saW5lOiBhZGRpdGlvbmFsT3B0aW9ucy5pbmxpbmUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgYWRkaXRpb25hbE9wdGlvbnNcbiAgICApXG4gICk7XG59O1xuXG4vLyBBIG1hcHBpbmcgZnJvbSB1cmwgcGF0aCB0byBhcmNoaXRlY3R1cmUgKGUuZy4gXCJ3ZWIuYnJvd3NlclwiKSB0byBzdGF0aWNcbi8vIGZpbGUgaW5mb3JtYXRpb24gd2l0aCB0aGUgZm9sbG93aW5nIGZpZWxkczpcbi8vIC0gdHlwZTogdGhlIHR5cGUgb2YgZmlsZSB0byBiZSBzZXJ2ZWRcbi8vIC0gY2FjaGVhYmxlOiBvcHRpb25hbGx5LCB3aGV0aGVyIHRoZSBmaWxlIHNob3VsZCBiZSBjYWNoZWQgb3Igbm90XG4vLyAtIHNvdXJjZU1hcFVybDogb3B0aW9uYWxseSwgdGhlIHVybCBvZiB0aGUgc291cmNlIG1hcFxuLy9cbi8vIEluZm8gYWxzbyBjb250YWlucyBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbi8vIC0gY29udGVudDogdGhlIHN0cmluZ2lmaWVkIGNvbnRlbnQgdGhhdCBzaG91bGQgYmUgc2VydmVkIGF0IHRoaXMgcGF0aFxuLy8gLSBhYnNvbHV0ZVBhdGg6IHRoZSBhYnNvbHV0ZSBwYXRoIG9uIGRpc2sgdG8gdGhlIGZpbGVcblxuLy8gU2VydmUgc3RhdGljIGZpbGVzIGZyb20gdGhlIG1hbmlmZXN0IG9yIGFkZGVkIHdpdGhcbi8vIGBhZGRTdGF0aWNKc2AuIEV4cG9ydGVkIGZvciB0ZXN0cy5cbldlYkFwcEludGVybmFscy5zdGF0aWNGaWxlc01pZGRsZXdhcmUgPSBhc3luYyBmdW5jdGlvbihcbiAgc3RhdGljRmlsZXNCeUFyY2gsXG4gIHJlcSxcbiAgcmVzLFxuICBuZXh0XG4pIHtcbiAgdmFyIHBhdGhuYW1lID0gcGFyc2VSZXF1ZXN0KHJlcSkucGF0aG5hbWU7XG4gIHRyeSB7XG4gICAgcGF0aG5hbWUgPSBkZWNvZGVVUklDb21wb25lbnQocGF0aG5hbWUpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgbmV4dCgpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBzZXJ2ZVN0YXRpY0pzID0gZnVuY3Rpb24ocykge1xuICAgIGlmIChcbiAgICAgIHJlcS5tZXRob2QgPT09ICdHRVQnIHx8XG4gICAgICByZXEubWV0aG9kID09PSAnSEVBRCcgfHxcbiAgICAgIE1ldGVvci5zZXR0aW5ncy5wYWNrYWdlcz8ud2ViYXBwPy5hbHdheXNSZXR1cm5Db250ZW50XG4gICAgKSB7XG4gICAgICByZXMud3JpdGVIZWFkKDIwMCwge1xuICAgICAgICAnQ29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQ7IGNoYXJzZXQ9VVRGLTgnLFxuICAgICAgICAnQ29udGVudC1MZW5ndGgnOiBCdWZmZXIuYnl0ZUxlbmd0aChzKSxcbiAgICAgIH0pO1xuICAgICAgcmVzLndyaXRlKHMpO1xuICAgICAgcmVzLmVuZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBzdGF0dXMgPSByZXEubWV0aG9kID09PSAnT1BUSU9OUycgPyAyMDAgOiA0MDU7XG4gICAgICByZXMud3JpdGVIZWFkKHN0YXR1cywge1xuICAgICAgICBBbGxvdzogJ09QVElPTlMsIEdFVCwgSEVBRCcsXG4gICAgICAgICdDb250ZW50LUxlbmd0aCc6ICcwJyxcbiAgICAgIH0pO1xuICAgICAgcmVzLmVuZCgpO1xuICAgIH1cbiAgfTtcblxuICBpZiAoXG4gICAgXy5oYXMoYWRkaXRpb25hbFN0YXRpY0pzLCBwYXRobmFtZSkgJiZcbiAgICAhV2ViQXBwSW50ZXJuYWxzLmlubGluZVNjcmlwdHNBbGxvd2VkKClcbiAgKSB7XG4gICAgc2VydmVTdGF0aWNKcyhhZGRpdGlvbmFsU3RhdGljSnNbcGF0aG5hbWVdKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB7IGFyY2gsIHBhdGggfSA9IFdlYkFwcC5jYXRlZ29yaXplUmVxdWVzdChyZXEpO1xuXG4gIGlmICghaGFzT3duLmNhbGwoV2ViQXBwLmNsaWVudFByb2dyYW1zLCBhcmNoKSkge1xuICAgIC8vIFdlIGNvdWxkIGNvbWUgaGVyZSBpbiBjYXNlIHdlIHJ1biB3aXRoIHNvbWUgYXJjaGl0ZWN0dXJlcyBleGNsdWRlZFxuICAgIG5leHQoKTtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBJZiBwYXVzZUNsaWVudChhcmNoKSBoYXMgYmVlbiBjYWxsZWQsIHByb2dyYW0ucGF1c2VkIHdpbGwgYmUgYVxuICAvLyBQcm9taXNlIHRoYXQgd2lsbCBiZSByZXNvbHZlZCB3aGVuIHRoZSBwcm9ncmFtIGlzIHVucGF1c2VkLlxuICBjb25zdCBwcm9ncmFtID0gV2ViQXBwLmNsaWVudFByb2dyYW1zW2FyY2hdO1xuICBhd2FpdCBwcm9ncmFtLnBhdXNlZDtcblxuICBpZiAoXG4gICAgcGF0aCA9PT0gJy9tZXRlb3JfcnVudGltZV9jb25maWcuanMnICYmXG4gICAgIVdlYkFwcEludGVybmFscy5pbmxpbmVTY3JpcHRzQWxsb3dlZCgpXG4gICkge1xuICAgIHNlcnZlU3RhdGljSnMoXG4gICAgICBgX19tZXRlb3JfcnVudGltZV9jb25maWdfXyA9ICR7cHJvZ3JhbS5tZXRlb3JSdW50aW1lQ29uZmlnfTtgXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBpbmZvID0gZ2V0U3RhdGljRmlsZUluZm8oc3RhdGljRmlsZXNCeUFyY2gsIHBhdGhuYW1lLCBwYXRoLCBhcmNoKTtcbiAgaWYgKCFpbmZvKSB7XG4gICAgbmV4dCgpO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyBcInNlbmRcIiB3aWxsIGhhbmRsZSBIRUFEICYgR0VUIHJlcXVlc3RzXG4gIGlmIChcbiAgICByZXEubWV0aG9kICE9PSAnSEVBRCcgJiZcbiAgICByZXEubWV0aG9kICE9PSAnR0VUJyAmJlxuICAgICFNZXRlb3Iuc2V0dGluZ3MucGFja2FnZXM/LndlYmFwcD8uYWx3YXlzUmV0dXJuQ29udGVudFxuICApIHtcbiAgICBjb25zdCBzdGF0dXMgPSByZXEubWV0aG9kID09PSAnT1BUSU9OUycgPyAyMDAgOiA0MDU7XG4gICAgcmVzLndyaXRlSGVhZChzdGF0dXMsIHtcbiAgICAgIEFsbG93OiAnT1BUSU9OUywgR0VULCBIRUFEJyxcbiAgICAgICdDb250ZW50LUxlbmd0aCc6ICcwJyxcbiAgICB9KTtcbiAgICByZXMuZW5kKCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gV2UgZG9uJ3QgbmVlZCB0byBjYWxsIHBhdXNlIGJlY2F1c2UsIHVubGlrZSAnc3RhdGljJywgb25jZSB3ZSBjYWxsIGludG9cbiAgLy8gJ3NlbmQnIGFuZCB5aWVsZCB0byB0aGUgZXZlbnQgbG9vcCwgd2UgbmV2ZXIgY2FsbCBhbm90aGVyIGhhbmRsZXIgd2l0aFxuICAvLyAnbmV4dCcuXG5cbiAgLy8gQ2FjaGVhYmxlIGZpbGVzIGFyZSBmaWxlcyB0aGF0IHNob3VsZCBuZXZlciBjaGFuZ2UuIFR5cGljYWxseVxuICAvLyBuYW1lZCBieSB0aGVpciBoYXNoIChlZyBtZXRlb3IgYnVuZGxlZCBqcyBhbmQgY3NzIGZpbGVzKS5cbiAgLy8gV2UgY2FjaGUgdGhlbSB+Zm9yZXZlciAoMXlyKS5cbiAgY29uc3QgbWF4QWdlID0gaW5mby5jYWNoZWFibGUgPyAxMDAwICogNjAgKiA2MCAqIDI0ICogMzY1IDogMDtcblxuICBpZiAoaW5mby5jYWNoZWFibGUpIHtcbiAgICAvLyBTaW5jZSB3ZSB1c2UgcmVxLmhlYWRlcnNbXCJ1c2VyLWFnZW50XCJdIHRvIGRldGVybWluZSB3aGV0aGVyIHRoZVxuICAgIC8vIGNsaWVudCBzaG91bGQgcmVjZWl2ZSBtb2Rlcm4gb3IgbGVnYWN5IHJlc291cmNlcywgdGVsbCB0aGUgY2xpZW50XG4gICAgLy8gdG8gaW52YWxpZGF0ZSBjYWNoZWQgcmVzb3VyY2VzIHdoZW4vaWYgaXRzIHVzZXIgYWdlbnQgc3RyaW5nXG4gICAgLy8gY2hhbmdlcyBpbiB0aGUgZnV0dXJlLlxuICAgIHJlcy5zZXRIZWFkZXIoJ1ZhcnknLCAnVXNlci1BZ2VudCcpO1xuICB9XG5cbiAgLy8gU2V0IHRoZSBYLVNvdXJjZU1hcCBoZWFkZXIsIHdoaWNoIGN1cnJlbnQgQ2hyb21lLCBGaXJlRm94LCBhbmQgU2FmYXJpXG4gIC8vIHVuZGVyc3RhbmQuICAoVGhlIFNvdXJjZU1hcCBoZWFkZXIgaXMgc2xpZ2h0bHkgbW9yZSBzcGVjLWNvcnJlY3QgYnV0IEZGXG4gIC8vIGRvZXNuJ3QgdW5kZXJzdGFuZCBpdC4pXG4gIC8vXG4gIC8vIFlvdSBtYXkgYWxzbyBuZWVkIHRvIGVuYWJsZSBzb3VyY2UgbWFwcyBpbiBDaHJvbWU6IG9wZW4gZGV2IHRvb2xzLCBjbGlja1xuICAvLyB0aGUgZ2VhciBpbiB0aGUgYm90dG9tIHJpZ2h0IGNvcm5lciwgYW5kIHNlbGVjdCBcImVuYWJsZSBzb3VyY2UgbWFwc1wiLlxuICBpZiAoaW5mby5zb3VyY2VNYXBVcmwpIHtcbiAgICByZXMuc2V0SGVhZGVyKFxuICAgICAgJ1gtU291cmNlTWFwJyxcbiAgICAgIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkxfUEFUSF9QUkVGSVggKyBpbmZvLnNvdXJjZU1hcFVybFxuICAgICk7XG4gIH1cblxuICBpZiAoaW5mby50eXBlID09PSAnanMnIHx8IGluZm8udHlwZSA9PT0gJ2R5bmFtaWMganMnKSB7XG4gICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQ7IGNoYXJzZXQ9VVRGLTgnKTtcbiAgfSBlbHNlIGlmIChpbmZvLnR5cGUgPT09ICdjc3MnKSB7XG4gICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ3RleHQvY3NzOyBjaGFyc2V0PVVURi04Jyk7XG4gIH0gZWxzZSBpZiAoaW5mby50eXBlID09PSAnanNvbicpIHtcbiAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD1VVEYtOCcpO1xuICB9XG5cbiAgaWYgKGluZm8uaGFzaCkge1xuICAgIHJlcy5zZXRIZWFkZXIoJ0VUYWcnLCAnXCInICsgaW5mby5oYXNoICsgJ1wiJyk7XG4gIH1cblxuICBpZiAoaW5mby5jb250ZW50KSB7XG4gICAgcmVzLnNldEhlYWRlcignQ29udGVudC1MZW5ndGgnLCBCdWZmZXIuYnl0ZUxlbmd0aChpbmZvLmNvbnRlbnQpKTtcbiAgICByZXMud3JpdGUoaW5mby5jb250ZW50KTtcbiAgICByZXMuZW5kKCk7XG4gIH0gZWxzZSB7XG4gICAgc2VuZChyZXEsIGluZm8uYWJzb2x1dGVQYXRoLCB7XG4gICAgICBtYXhhZ2U6IG1heEFnZSxcbiAgICAgIGRvdGZpbGVzOiAnYWxsb3cnLCAvLyBpZiB3ZSBzcGVjaWZpZWQgYSBkb3RmaWxlIGluIHRoZSBtYW5pZmVzdCwgc2VydmUgaXRcbiAgICAgIGxhc3RNb2RpZmllZDogZmFsc2UsIC8vIGRvbid0IHNldCBsYXN0LW1vZGlmaWVkIGJhc2VkIG9uIHRoZSBmaWxlIGRhdGVcbiAgICB9KVxuICAgICAgLm9uKCdlcnJvcicsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBMb2cuZXJyb3IoJ0Vycm9yIHNlcnZpbmcgc3RhdGljIGZpbGUgJyArIGVycik7XG4gICAgICAgIHJlcy53cml0ZUhlYWQoNTAwKTtcbiAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgfSlcbiAgICAgIC5vbignZGlyZWN0b3J5JywgZnVuY3Rpb24oKSB7XG4gICAgICAgIExvZy5lcnJvcignVW5leHBlY3RlZCBkaXJlY3RvcnkgJyArIGluZm8uYWJzb2x1dGVQYXRoKTtcbiAgICAgICAgcmVzLndyaXRlSGVhZCg1MDApO1xuICAgICAgICByZXMuZW5kKCk7XG4gICAgICB9KVxuICAgICAgLnBpcGUocmVzKTtcbiAgfVxufTtcblxuZnVuY3Rpb24gZ2V0U3RhdGljRmlsZUluZm8oc3RhdGljRmlsZXNCeUFyY2gsIG9yaWdpbmFsUGF0aCwgcGF0aCwgYXJjaCkge1xuICBpZiAoIWhhc093bi5jYWxsKFdlYkFwcC5jbGllbnRQcm9ncmFtcywgYXJjaCkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIEdldCBhIGxpc3Qgb2YgYWxsIGF2YWlsYWJsZSBzdGF0aWMgZmlsZSBhcmNoaXRlY3R1cmVzLCB3aXRoIGFyY2hcbiAgLy8gZmlyc3QgaW4gdGhlIGxpc3QgaWYgaXQgZXhpc3RzLlxuICBjb25zdCBzdGF0aWNBcmNoTGlzdCA9IE9iamVjdC5rZXlzKHN0YXRpY0ZpbGVzQnlBcmNoKTtcbiAgY29uc3QgYXJjaEluZGV4ID0gc3RhdGljQXJjaExpc3QuaW5kZXhPZihhcmNoKTtcbiAgaWYgKGFyY2hJbmRleCA+IDApIHtcbiAgICBzdGF0aWNBcmNoTGlzdC51bnNoaWZ0KHN0YXRpY0FyY2hMaXN0LnNwbGljZShhcmNoSW5kZXgsIDEpWzBdKTtcbiAgfVxuXG4gIGxldCBpbmZvID0gbnVsbDtcblxuICBzdGF0aWNBcmNoTGlzdC5zb21lKGFyY2ggPT4ge1xuICAgIGNvbnN0IHN0YXRpY0ZpbGVzID0gc3RhdGljRmlsZXNCeUFyY2hbYXJjaF07XG5cbiAgICBmdW5jdGlvbiBmaW5hbGl6ZShwYXRoKSB7XG4gICAgICBpbmZvID0gc3RhdGljRmlsZXNbcGF0aF07XG4gICAgICAvLyBTb21ldGltZXMgd2UgcmVnaXN0ZXIgYSBsYXp5IGZ1bmN0aW9uIGluc3RlYWQgb2YgYWN0dWFsIGRhdGEgaW5cbiAgICAgIC8vIHRoZSBzdGF0aWNGaWxlcyBtYW5pZmVzdC5cbiAgICAgIGlmICh0eXBlb2YgaW5mbyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBpbmZvID0gc3RhdGljRmlsZXNbcGF0aF0gPSBpbmZvKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5mbztcbiAgICB9XG5cbiAgICAvLyBJZiBzdGF0aWNGaWxlcyBjb250YWlucyBvcmlnaW5hbFBhdGggd2l0aCB0aGUgYXJjaCBpbmZlcnJlZCBhYm92ZSxcbiAgICAvLyB1c2UgdGhhdCBpbmZvcm1hdGlvbi5cbiAgICBpZiAoaGFzT3duLmNhbGwoc3RhdGljRmlsZXMsIG9yaWdpbmFsUGF0aCkpIHtcbiAgICAgIHJldHVybiBmaW5hbGl6ZShvcmlnaW5hbFBhdGgpO1xuICAgIH1cblxuICAgIC8vIElmIGNhdGVnb3JpemVSZXF1ZXN0IHJldHVybmVkIGFuIGFsdGVybmF0ZSBwYXRoLCB0cnkgdGhhdCBpbnN0ZWFkLlxuICAgIGlmIChwYXRoICE9PSBvcmlnaW5hbFBhdGggJiYgaGFzT3duLmNhbGwoc3RhdGljRmlsZXMsIHBhdGgpKSB7XG4gICAgICByZXR1cm4gZmluYWxpemUocGF0aCk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gaW5mbztcbn1cblxuLy8gUGFyc2UgdGhlIHBhc3NlZCBpbiBwb3J0IHZhbHVlLiBSZXR1cm4gdGhlIHBvcnQgYXMtaXMgaWYgaXQncyBhIFN0cmluZ1xuLy8gKGUuZy4gYSBXaW5kb3dzIFNlcnZlciBzdHlsZSBuYW1lZCBwaXBlKSwgb3RoZXJ3aXNlIHJldHVybiB0aGUgcG9ydCBhcyBhblxuLy8gaW50ZWdlci5cbi8vXG4vLyBERVBSRUNBVEVEOiBEaXJlY3QgdXNlIG9mIHRoaXMgZnVuY3Rpb24gaXMgbm90IHJlY29tbWVuZGVkOyBpdCBpcyBub1xuLy8gbG9uZ2VyIHVzZWQgaW50ZXJuYWxseSwgYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSByZWxlYXNlLlxuV2ViQXBwSW50ZXJuYWxzLnBhcnNlUG9ydCA9IHBvcnQgPT4ge1xuICBsZXQgcGFyc2VkUG9ydCA9IHBhcnNlSW50KHBvcnQpO1xuICBpZiAoTnVtYmVyLmlzTmFOKHBhcnNlZFBvcnQpKSB7XG4gICAgcGFyc2VkUG9ydCA9IHBvcnQ7XG4gIH1cbiAgcmV0dXJuIHBhcnNlZFBvcnQ7XG59O1xuXG5pbXBvcnQgeyBvbk1lc3NhZ2UgfSBmcm9tICdtZXRlb3IvaW50ZXItcHJvY2Vzcy1tZXNzYWdpbmcnO1xuXG5vbk1lc3NhZ2UoJ3dlYmFwcC1wYXVzZS1jbGllbnQnLCBhc3luYyAoeyBhcmNoIH0pID0+IHtcbiAgYXdhaXQgV2ViQXBwSW50ZXJuYWxzLnBhdXNlQ2xpZW50KGFyY2gpO1xufSk7XG5cbm9uTWVzc2FnZSgnd2ViYXBwLXJlbG9hZC1jbGllbnQnLCBhc3luYyAoeyBhcmNoIH0pID0+IHtcbiAgYXdhaXQgV2ViQXBwSW50ZXJuYWxzLmdlbmVyYXRlQ2xpZW50UHJvZ3JhbShhcmNoKTtcbn0pO1xuXG5hc3luYyBmdW5jdGlvbiBydW5XZWJBcHBTZXJ2ZXIoKSB7XG4gIHZhciBzaHV0dGluZ0Rvd24gPSBmYWxzZTtcbiAgdmFyIHN5bmNRdWV1ZSA9IG5ldyBNZXRlb3IuX0FzeW5jaHJvbm91c1F1ZXVlKCk7XG5cbiAgdmFyIGdldEl0ZW1QYXRobmFtZSA9IGZ1bmN0aW9uKGl0ZW1VcmwpIHtcbiAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHBhcnNlVXJsKGl0ZW1VcmwpLnBhdGhuYW1lKTtcbiAgfTtcblxuICBXZWJBcHBJbnRlcm5hbHMucmVsb2FkQ2xpZW50UHJvZ3JhbXMgPSBhc3luYyBmdW5jdGlvbigpIHtcbiAgICBhd2FpdCBzeW5jUXVldWUucnVuVGFzayhmdW5jdGlvbigpIHtcbiAgICAgIGNvbnN0IHN0YXRpY0ZpbGVzQnlBcmNoID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgICAgY29uc3QgeyBjb25maWdKc29uIH0gPSBfX21ldGVvcl9ib290c3RyYXBfXztcbiAgICAgIGNvbnN0IGNsaWVudEFyY2hzID1cbiAgICAgICAgY29uZmlnSnNvbi5jbGllbnRBcmNocyB8fCBPYmplY3Qua2V5cyhjb25maWdKc29uLmNsaWVudFBhdGhzKTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgY2xpZW50QXJjaHMuZm9yRWFjaChhcmNoID0+IHtcbiAgICAgICAgICBnZW5lcmF0ZUNsaWVudFByb2dyYW0oYXJjaCwgc3RhdGljRmlsZXNCeUFyY2gpO1xuICAgICAgICB9KTtcbiAgICAgICAgV2ViQXBwSW50ZXJuYWxzLnN0YXRpY0ZpbGVzQnlBcmNoID0gc3RhdGljRmlsZXNCeUFyY2g7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIExvZy5lcnJvcignRXJyb3IgcmVsb2FkaW5nIHRoZSBjbGllbnQgcHJvZ3JhbTogJyArIGUuc3RhY2spO1xuICAgICAgICBwcm9jZXNzLmV4aXQoMSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gUGF1c2UgYW55IGluY29taW5nIHJlcXVlc3RzIGFuZCBtYWtlIHRoZW0gd2FpdCBmb3IgdGhlIHByb2dyYW0gdG8gYmVcbiAgLy8gdW5wYXVzZWQgdGhlIG5leHQgdGltZSBnZW5lcmF0ZUNsaWVudFByb2dyYW0oYXJjaCkgaXMgY2FsbGVkLlxuICBXZWJBcHBJbnRlcm5hbHMucGF1c2VDbGllbnQgPSBhc3luYyBmdW5jdGlvbihhcmNoKSB7XG4gICAgYXdhaXQgc3luY1F1ZXVlLnJ1blRhc2soKCkgPT4ge1xuICAgICAgY29uc3QgcHJvZ3JhbSA9IFdlYkFwcC5jbGllbnRQcm9ncmFtc1thcmNoXTtcbiAgICAgIGNvbnN0IHsgdW5wYXVzZSB9ID0gcHJvZ3JhbTtcbiAgICAgIHByb2dyYW0ucGF1c2VkID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgdW5wYXVzZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIC8vIElmIHRoZXJlIGhhcHBlbnMgdG8gYmUgYW4gZXhpc3RpbmcgcHJvZ3JhbS51bnBhdXNlIGZ1bmN0aW9uLFxuICAgICAgICAgIC8vIGNvbXBvc2UgaXQgd2l0aCB0aGUgcmVzb2x2ZSBmdW5jdGlvbi5cbiAgICAgICAgICBwcm9ncmFtLnVucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHVucGF1c2UoKTtcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHByb2dyYW0udW5wYXVzZSA9IHJlc29sdmU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9O1xuXG4gIFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUNsaWVudFByb2dyYW0gPSBhc3luYyBmdW5jdGlvbihhcmNoKSB7XG4gICAgYXdhaXQgc3luY1F1ZXVlLnJ1blRhc2soKCkgPT4gZ2VuZXJhdGVDbGllbnRQcm9ncmFtKGFyY2gpKTtcbiAgfTtcblxuICBmdW5jdGlvbiBnZW5lcmF0ZUNsaWVudFByb2dyYW0oXG4gICAgYXJjaCxcbiAgICBzdGF0aWNGaWxlc0J5QXJjaCA9IFdlYkFwcEludGVybmFscy5zdGF0aWNGaWxlc0J5QXJjaFxuICApIHtcbiAgICBjb25zdCBjbGllbnREaXIgPSBwYXRoSm9pbihcbiAgICAgIHBhdGhEaXJuYW1lKF9fbWV0ZW9yX2Jvb3RzdHJhcF9fLnNlcnZlckRpciksXG4gICAgICBhcmNoXG4gICAgKTtcblxuICAgIC8vIHJlYWQgdGhlIGNvbnRyb2wgZm9yIHRoZSBjbGllbnQgd2UnbGwgYmUgc2VydmluZyB1cFxuICAgIGNvbnN0IHByb2dyYW1Kc29uUGF0aCA9IHBhdGhKb2luKGNsaWVudERpciwgJ3Byb2dyYW0uanNvbicpO1xuXG4gICAgbGV0IHByb2dyYW1Kc29uO1xuICAgIHRyeSB7XG4gICAgICBwcm9ncmFtSnNvbiA9IEpTT04ucGFyc2UocmVhZEZpbGVTeW5jKHByb2dyYW1Kc29uUGF0aCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlLmNvZGUgPT09ICdFTk9FTlQnKSByZXR1cm47XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIGlmIChwcm9ncmFtSnNvbi5mb3JtYXQgIT09ICd3ZWItcHJvZ3JhbS1wcmUxJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnVW5zdXBwb3J0ZWQgZm9ybWF0IGZvciBjbGllbnQgYXNzZXRzOiAnICtcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeShwcm9ncmFtSnNvbi5mb3JtYXQpXG4gICAgICApO1xuICAgIH1cblxuICAgIGlmICghcHJvZ3JhbUpzb25QYXRoIHx8ICFjbGllbnREaXIgfHwgIXByb2dyYW1Kc29uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NsaWVudCBjb25maWcgZmlsZSBub3QgcGFyc2VkLicpO1xuICAgIH1cblxuICAgIGFyY2hQYXRoW2FyY2hdID0gY2xpZW50RGlyO1xuICAgIGNvbnN0IHN0YXRpY0ZpbGVzID0gKHN0YXRpY0ZpbGVzQnlBcmNoW2FyY2hdID0gT2JqZWN0LmNyZWF0ZShudWxsKSk7XG5cbiAgICBjb25zdCB7IG1hbmlmZXN0IH0gPSBwcm9ncmFtSnNvbjtcbiAgICBtYW5pZmVzdC5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgaWYgKGl0ZW0udXJsICYmIGl0ZW0ud2hlcmUgPT09ICdjbGllbnQnKSB7XG4gICAgICAgIHN0YXRpY0ZpbGVzW2dldEl0ZW1QYXRobmFtZShpdGVtLnVybCldID0ge1xuICAgICAgICAgIGFic29sdXRlUGF0aDogcGF0aEpvaW4oY2xpZW50RGlyLCBpdGVtLnBhdGgpLFxuICAgICAgICAgIGNhY2hlYWJsZTogaXRlbS5jYWNoZWFibGUsXG4gICAgICAgICAgaGFzaDogaXRlbS5oYXNoLFxuICAgICAgICAgIC8vIExpbmsgZnJvbSBzb3VyY2UgdG8gaXRzIG1hcFxuICAgICAgICAgIHNvdXJjZU1hcFVybDogaXRlbS5zb3VyY2VNYXBVcmwsXG4gICAgICAgICAgdHlwZTogaXRlbS50eXBlLFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChpdGVtLnNvdXJjZU1hcCkge1xuICAgICAgICAgIC8vIFNlcnZlIHRoZSBzb3VyY2UgbWFwIHRvbywgdW5kZXIgdGhlIHNwZWNpZmllZCBVUkwuIFdlIGFzc3VtZVxuICAgICAgICAgIC8vIGFsbCBzb3VyY2UgbWFwcyBhcmUgY2FjaGVhYmxlLlxuICAgICAgICAgIHN0YXRpY0ZpbGVzW2dldEl0ZW1QYXRobmFtZShpdGVtLnNvdXJjZU1hcFVybCldID0ge1xuICAgICAgICAgICAgYWJzb2x1dGVQYXRoOiBwYXRoSm9pbihjbGllbnREaXIsIGl0ZW0uc291cmNlTWFwKSxcbiAgICAgICAgICAgIGNhY2hlYWJsZTogdHJ1ZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjb25zdCB7IFBVQkxJQ19TRVRUSU5HUyB9ID0gX19tZXRlb3JfcnVudGltZV9jb25maWdfXztcbiAgICBjb25zdCBjb25maWdPdmVycmlkZXMgPSB7XG4gICAgICBQVUJMSUNfU0VUVElOR1MsXG4gICAgfTtcblxuICAgIGNvbnN0IG9sZFByb2dyYW0gPSBXZWJBcHAuY2xpZW50UHJvZ3JhbXNbYXJjaF07XG4gICAgY29uc3QgbmV3UHJvZ3JhbSA9IChXZWJBcHAuY2xpZW50UHJvZ3JhbXNbYXJjaF0gPSB7XG4gICAgICBmb3JtYXQ6ICd3ZWItcHJvZ3JhbS1wcmUxJyxcbiAgICAgIG1hbmlmZXN0OiBtYW5pZmVzdCxcbiAgICAgIC8vIFVzZSBhcnJvdyBmdW5jdGlvbnMgc28gdGhhdCB0aGVzZSB2ZXJzaW9ucyBjYW4gYmUgbGF6aWx5XG4gICAgICAvLyBjYWxjdWxhdGVkIGxhdGVyLCBhbmQgc28gdGhhdCB0aGV5IHdpbGwgbm90IGJlIGluY2x1ZGVkIGluIHRoZVxuICAgICAgLy8gc3RhdGljRmlsZXNbbWFuaWZlc3RVcmxdLmNvbnRlbnQgc3RyaW5nIGJlbG93LlxuICAgICAgLy9cbiAgICAgIC8vIE5vdGU6IHRoZXNlIHZlcnNpb24gY2FsY3VsYXRpb25zIG11c3QgYmUga2VwdCBpbiBhZ3JlZW1lbnQgd2l0aFxuICAgICAgLy8gQ29yZG92YUJ1aWxkZXIjYXBwZW5kVmVyc2lvbiBpbiB0b29scy9jb3Jkb3ZhL2J1aWxkZXIuanMsIG9yIGhvdFxuICAgICAgLy8gY29kZSBwdXNoIHdpbGwgcmVsb2FkIENvcmRvdmEgYXBwcyB1bm5lY2Vzc2FyaWx5LlxuICAgICAgdmVyc2lvbjogKCkgPT5cbiAgICAgICAgV2ViQXBwSGFzaGluZy5jYWxjdWxhdGVDbGllbnRIYXNoKG1hbmlmZXN0LCBudWxsLCBjb25maWdPdmVycmlkZXMpLFxuICAgICAgdmVyc2lvblJlZnJlc2hhYmxlOiAoKSA9PlxuICAgICAgICBXZWJBcHBIYXNoaW5nLmNhbGN1bGF0ZUNsaWVudEhhc2goXG4gICAgICAgICAgbWFuaWZlc3QsXG4gICAgICAgICAgdHlwZSA9PiB0eXBlID09PSAnY3NzJyxcbiAgICAgICAgICBjb25maWdPdmVycmlkZXNcbiAgICAgICAgKSxcbiAgICAgIHZlcnNpb25Ob25SZWZyZXNoYWJsZTogKCkgPT5cbiAgICAgICAgV2ViQXBwSGFzaGluZy5jYWxjdWxhdGVDbGllbnRIYXNoKFxuICAgICAgICAgIG1hbmlmZXN0LFxuICAgICAgICAgICh0eXBlLCByZXBsYWNlYWJsZSkgPT4gdHlwZSAhPT0gJ2NzcycgJiYgIXJlcGxhY2VhYmxlLFxuICAgICAgICAgIGNvbmZpZ092ZXJyaWRlc1xuICAgICAgICApLFxuICAgICAgdmVyc2lvblJlcGxhY2VhYmxlOiAoKSA9PlxuICAgICAgICBXZWJBcHBIYXNoaW5nLmNhbGN1bGF0ZUNsaWVudEhhc2goXG4gICAgICAgICAgbWFuaWZlc3QsXG4gICAgICAgICAgKF90eXBlLCByZXBsYWNlYWJsZSkgPT4gcmVwbGFjZWFibGUsXG4gICAgICAgICAgY29uZmlnT3ZlcnJpZGVzXG4gICAgICAgICksXG4gICAgICBjb3Jkb3ZhQ29tcGF0aWJpbGl0eVZlcnNpb25zOiBwcm9ncmFtSnNvbi5jb3Jkb3ZhQ29tcGF0aWJpbGl0eVZlcnNpb25zLFxuICAgICAgUFVCTElDX1NFVFRJTkdTLFxuICAgICAgaG1yVmVyc2lvbjogcHJvZ3JhbUpzb24uaG1yVmVyc2lvbixcbiAgICB9KTtcblxuICAgIC8vIEV4cG9zZSBwcm9ncmFtIGRldGFpbHMgYXMgYSBzdHJpbmcgcmVhY2hhYmxlIHZpYSB0aGUgZm9sbG93aW5nIFVSTC5cbiAgICBjb25zdCBtYW5pZmVzdFVybFByZWZpeCA9ICcvX18nICsgYXJjaC5yZXBsYWNlKC9ed2ViXFwuLywgJycpO1xuICAgIGNvbnN0IG1hbmlmZXN0VXJsID0gbWFuaWZlc3RVcmxQcmVmaXggKyBnZXRJdGVtUGF0aG5hbWUoJy9tYW5pZmVzdC5qc29uJyk7XG5cbiAgICBzdGF0aWNGaWxlc1ttYW5pZmVzdFVybF0gPSAoKSA9PiB7XG4gICAgICBpZiAoUGFja2FnZS5hdXRvdXBkYXRlKSB7XG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICBBVVRPVVBEQVRFX1ZFUlNJT04gPSBQYWNrYWdlLmF1dG91cGRhdGUuQXV0b3VwZGF0ZS5hdXRvdXBkYXRlVmVyc2lvbixcbiAgICAgICAgfSA9IHByb2Nlc3MuZW52O1xuXG4gICAgICAgIGlmIChBVVRPVVBEQVRFX1ZFUlNJT04pIHtcbiAgICAgICAgICBuZXdQcm9ncmFtLnZlcnNpb24gPSBBVVRPVVBEQVRFX1ZFUlNJT047XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiBuZXdQcm9ncmFtLnZlcnNpb24gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgbmV3UHJvZ3JhbS52ZXJzaW9uID0gbmV3UHJvZ3JhbS52ZXJzaW9uKCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNvbnRlbnQ6IEpTT04uc3RyaW5naWZ5KG5ld1Byb2dyYW0pLFxuICAgICAgICBjYWNoZWFibGU6IGZhbHNlLFxuICAgICAgICBoYXNoOiBuZXdQcm9ncmFtLnZlcnNpb24sXG4gICAgICAgIHR5cGU6ICdqc29uJyxcbiAgICAgIH07XG4gICAgfTtcblxuICAgIGdlbmVyYXRlQm9pbGVycGxhdGVGb3JBcmNoKGFyY2gpO1xuXG4gICAgLy8gSWYgdGhlcmUgYXJlIGFueSByZXF1ZXN0cyB3YWl0aW5nIG9uIG9sZFByb2dyYW0ucGF1c2VkLCBsZXQgdGhlbVxuICAgIC8vIGNvbnRpbnVlIG5vdyAodXNpbmcgdGhlIG5ldyBwcm9ncmFtKS5cbiAgICBpZiAob2xkUHJvZ3JhbSAmJiBvbGRQcm9ncmFtLnBhdXNlZCkge1xuICAgICAgb2xkUHJvZ3JhbS51bnBhdXNlKCk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZGVmYXVsdE9wdGlvbnNGb3JBcmNoID0ge1xuICAgICd3ZWIuY29yZG92YSc6IHtcbiAgICAgIHJ1bnRpbWVDb25maWdPdmVycmlkZXM6IHtcbiAgICAgICAgLy8gWFhYIFdlIHVzZSBhYnNvbHV0ZVVybCgpIGhlcmUgc28gdGhhdCB3ZSBzZXJ2ZSBodHRwczovL1xuICAgICAgICAvLyBVUkxzIHRvIGNvcmRvdmEgY2xpZW50cyBpZiBmb3JjZS1zc2wgaXMgaW4gdXNlLiBJZiB3ZSB3ZXJlXG4gICAgICAgIC8vIHRvIHVzZSBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLlJPT1RfVVJMIGluc3RlYWQgb2ZcbiAgICAgICAgLy8gYWJzb2x1dGVVcmwoKSwgdGhlbiBDb3Jkb3ZhIGNsaWVudHMgd291bGQgaW1tZWRpYXRlbHkgZ2V0IGFcbiAgICAgICAgLy8gSENQIHNldHRpbmcgdGhlaXIgRERQX0RFRkFVTFRfQ09OTkVDVElPTl9VUkwgdG9cbiAgICAgICAgLy8gaHR0cDovL2V4YW1wbGUubWV0ZW9yLmNvbS4gVGhpcyBicmVha3MgdGhlIGFwcCwgYmVjYXVzZVxuICAgICAgICAvLyBmb3JjZS1zc2wgZG9lc24ndCBzZXJ2ZSBDT1JTIGhlYWRlcnMgb24gMzAyXG4gICAgICAgIC8vIHJlZGlyZWN0cy4gKFBsdXMgaXQncyB1bmRlc2lyYWJsZSB0byBoYXZlIGNsaWVudHNcbiAgICAgICAgLy8gY29ubmVjdGluZyB0byBodHRwOi8vZXhhbXBsZS5tZXRlb3IuY29tIHdoZW4gZm9yY2Utc3NsIGlzXG4gICAgICAgIC8vIGluIHVzZS4pXG4gICAgICAgIEREUF9ERUZBVUxUX0NPTk5FQ1RJT05fVVJMOlxuICAgICAgICAgIHByb2Nlc3MuZW52Lk1PQklMRV9ERFBfVVJMIHx8IE1ldGVvci5hYnNvbHV0ZVVybCgpLFxuICAgICAgICBST09UX1VSTDogcHJvY2Vzcy5lbnYuTU9CSUxFX1JPT1RfVVJMIHx8IE1ldGVvci5hYnNvbHV0ZVVybCgpLFxuICAgICAgfSxcbiAgICB9LFxuXG4gICAgJ3dlYi5icm93c2VyJzoge1xuICAgICAgcnVudGltZUNvbmZpZ092ZXJyaWRlczoge1xuICAgICAgICBpc01vZGVybjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcblxuICAgICd3ZWIuYnJvd3Nlci5sZWdhY3knOiB7XG4gICAgICBydW50aW1lQ29uZmlnT3ZlcnJpZGVzOiB7XG4gICAgICAgIGlzTW9kZXJuOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcblxuICBXZWJBcHBJbnRlcm5hbHMuZ2VuZXJhdGVCb2lsZXJwbGF0ZSA9IGFzeW5jIGZ1bmN0aW9uKCkge1xuICAgIC8vIFRoaXMgYm9pbGVycGxhdGUgd2lsbCBiZSBzZXJ2ZWQgdG8gdGhlIG1vYmlsZSBkZXZpY2VzIHdoZW4gdXNlZCB3aXRoXG4gICAgLy8gTWV0ZW9yL0NvcmRvdmEgZm9yIHRoZSBIb3QtQ29kZSBQdXNoIGFuZCBzaW5jZSB0aGUgZmlsZSB3aWxsIGJlIHNlcnZlZCBieVxuICAgIC8vIHRoZSBkZXZpY2UncyBzZXJ2ZXIsIGl0IGlzIGltcG9ydGFudCB0byBzZXQgdGhlIEREUCB1cmwgdG8gdGhlIGFjdHVhbFxuICAgIC8vIE1ldGVvciBzZXJ2ZXIgYWNjZXB0aW5nIEREUCBjb25uZWN0aW9ucyBhbmQgbm90IHRoZSBkZXZpY2UncyBmaWxlIHNlcnZlci5cbiAgICBhd2FpdCBzeW5jUXVldWUucnVuVGFzayhmdW5jdGlvbigpIHtcbiAgICAgIE9iamVjdC5rZXlzKFdlYkFwcC5jbGllbnRQcm9ncmFtcykuZm9yRWFjaChnZW5lcmF0ZUJvaWxlcnBsYXRlRm9yQXJjaCk7XG4gICAgfSk7XG4gIH07XG5cbiAgZnVuY3Rpb24gZ2VuZXJhdGVCb2lsZXJwbGF0ZUZvckFyY2goYXJjaCkge1xuICAgIGNvbnN0IHByb2dyYW0gPSBXZWJBcHAuY2xpZW50UHJvZ3JhbXNbYXJjaF07XG4gICAgY29uc3QgYWRkaXRpb25hbE9wdGlvbnMgPSBkZWZhdWx0T3B0aW9uc0ZvckFyY2hbYXJjaF0gfHwge307XG4gICAgY29uc3QgeyBiYXNlRGF0YSB9ID0gKGJvaWxlcnBsYXRlQnlBcmNoW1xuICAgICAgYXJjaFxuICAgIF0gPSBXZWJBcHBJbnRlcm5hbHMuZ2VuZXJhdGVCb2lsZXJwbGF0ZUluc3RhbmNlKFxuICAgICAgYXJjaCxcbiAgICAgIHByb2dyYW0ubWFuaWZlc3QsXG4gICAgICBhZGRpdGlvbmFsT3B0aW9uc1xuICAgICkpO1xuICAgIC8vIFdlIG5lZWQgdGhlIHJ1bnRpbWUgY29uZmlnIHdpdGggb3ZlcnJpZGVzIGZvciBtZXRlb3JfcnVudGltZV9jb25maWcuanM6XG4gICAgcHJvZ3JhbS5tZXRlb3JSdW50aW1lQ29uZmlnID0gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgLi4uX19tZXRlb3JfcnVudGltZV9jb25maWdfXyxcbiAgICAgIC4uLihhZGRpdGlvbmFsT3B0aW9ucy5ydW50aW1lQ29uZmlnT3ZlcnJpZGVzIHx8IG51bGwpLFxuICAgIH0pO1xuICAgIHByb2dyYW0ucmVmcmVzaGFibGVBc3NldHMgPSBiYXNlRGF0YS5jc3MubWFwKGZpbGUgPT4gKHtcbiAgICAgIHVybDogYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2soZmlsZS51cmwpLFxuICAgIH0pKTtcbiAgfVxuXG4gIGF3YWl0IFdlYkFwcEludGVybmFscy5yZWxvYWRDbGllbnRQcm9ncmFtcygpO1xuXG4gIC8vIHdlYnNlcnZlclxuICB2YXIgYXBwID0gY3JlYXRlRXhwcmVzc0FwcCgpXG5cbiAgLy8gUGFja2FnZXMgYW5kIGFwcHMgY2FuIGFkZCBoYW5kbGVycyB0aGF0IHJ1biBiZWZvcmUgYW55IG90aGVyIE1ldGVvclxuICAvLyBoYW5kbGVycyB2aWEgV2ViQXBwLnJhd0V4cHJlc3NIYW5kbGVycy5cbiAgdmFyIHJhd0V4cHJlc3NIYW5kbGVycyA9IGNyZWF0ZUV4cHJlc3NBcHAoKVxuICBhcHAudXNlKHJhd0V4cHJlc3NIYW5kbGVycyk7XG5cbiAgLy8gQXV0by1jb21wcmVzcyBhbnkganNvbiwgamF2YXNjcmlwdCwgb3IgdGV4dC5cbiAgYXBwLnVzZShjb21wcmVzcyh7IGZpbHRlcjogc2hvdWxkQ29tcHJlc3MgfSkpO1xuXG4gIC8vIHBhcnNlIGNvb2tpZXMgaW50byBhbiBvYmplY3RcbiAgYXBwLnVzZShjb29raWVQYXJzZXIoKSk7XG5cbiAgLy8gV2UncmUgbm90IGEgcHJveHk7IHJlamVjdCAod2l0aG91dCBjcmFzaGluZykgYXR0ZW1wdHMgdG8gdHJlYXQgdXMgbGlrZVxuICAvLyBvbmUuIChTZWUgIzEyMTIuKVxuICBhcHAudXNlKGZ1bmN0aW9uKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgaWYgKFJvdXRlUG9saWN5LmlzVmFsaWRVcmwocmVxLnVybCkpIHtcbiAgICAgIG5leHQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmVzLndyaXRlSGVhZCg0MDApO1xuICAgIHJlcy53cml0ZSgnTm90IGEgcHJveHknKTtcbiAgICByZXMuZW5kKCk7XG4gIH0pO1xuXG4gIC8vIFBhcnNlIHRoZSBxdWVyeSBzdHJpbmcgaW50byByZXMucXVlcnkuIFVzZWQgYnkgb2F1dGhfc2VydmVyLCBidXQgaXQnc1xuICAvLyBnZW5lcmFsbHkgcHJldHR5IGhhbmR5Li5cbiAgLy9cbiAgLy8gRG8gdGhpcyBiZWZvcmUgdGhlIG5leHQgbWlkZGxld2FyZSBkZXN0cm95cyByZXEudXJsIGlmIGEgcGF0aCBwcmVmaXhcbiAgLy8gaXMgc2V0IHRvIGNsb3NlICMxMDExMS5cbiAgYXBwLnVzZShmdW5jdGlvbihyZXF1ZXN0LCByZXNwb25zZSwgbmV4dCkge1xuICAgIHJlcXVlc3QucXVlcnkgPSBxcy5wYXJzZShwYXJzZVVybChyZXF1ZXN0LnVybCkucXVlcnkpO1xuICAgIG5leHQoKTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gZ2V0UGF0aFBhcnRzKHBhdGgpIHtcbiAgICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy8nKTtcbiAgICB3aGlsZSAocGFydHNbMF0gPT09ICcnKSBwYXJ0cy5zaGlmdCgpO1xuICAgIHJldHVybiBwYXJ0cztcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzUHJlZml4T2YocHJlZml4LCBhcnJheSkge1xuICAgIHJldHVybiAoXG4gICAgICBwcmVmaXgubGVuZ3RoIDw9IGFycmF5Lmxlbmd0aCAmJlxuICAgICAgcHJlZml4LmV2ZXJ5KChwYXJ0LCBpKSA9PiBwYXJ0ID09PSBhcnJheVtpXSlcbiAgICApO1xuICB9XG5cbiAgLy8gU3RyaXAgb2ZmIHRoZSBwYXRoIHByZWZpeCwgaWYgaXQgZXhpc3RzLlxuICBhcHAudXNlKGZ1bmN0aW9uKHJlcXVlc3QsIHJlc3BvbnNlLCBuZXh0KSB7XG4gICAgY29uc3QgcGF0aFByZWZpeCA9IF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkxfUEFUSF9QUkVGSVg7XG4gICAgY29uc3QgeyBwYXRobmFtZSwgc2VhcmNoIH0gPSBwYXJzZVVybChyZXF1ZXN0LnVybCk7XG5cbiAgICAvLyBjaGVjayBpZiB0aGUgcGF0aCBpbiB0aGUgdXJsIHN0YXJ0cyB3aXRoIHRoZSBwYXRoIHByZWZpeFxuICAgIGlmIChwYXRoUHJlZml4KSB7XG4gICAgICBjb25zdCBwcmVmaXhQYXJ0cyA9IGdldFBhdGhQYXJ0cyhwYXRoUHJlZml4KTtcbiAgICAgIGNvbnN0IHBhdGhQYXJ0cyA9IGdldFBhdGhQYXJ0cyhwYXRobmFtZSk7XG4gICAgICBpZiAoaXNQcmVmaXhPZihwcmVmaXhQYXJ0cywgcGF0aFBhcnRzKSkge1xuICAgICAgICByZXF1ZXN0LnVybCA9ICcvJyArIHBhdGhQYXJ0cy5zbGljZShwcmVmaXhQYXJ0cy5sZW5ndGgpLmpvaW4oJy8nKTtcbiAgICAgICAgaWYgKHNlYXJjaCkge1xuICAgICAgICAgIHJlcXVlc3QudXJsICs9IHNlYXJjaDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV4dCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwYXRobmFtZSA9PT0gJy9mYXZpY29uLmljbycgfHwgcGF0aG5hbWUgPT09ICcvcm9ib3RzLnR4dCcpIHtcbiAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgfVxuXG4gICAgaWYgKHBhdGhQcmVmaXgpIHtcbiAgICAgIHJlc3BvbnNlLndyaXRlSGVhZCg0MDQpO1xuICAgICAgcmVzcG9uc2Uud3JpdGUoJ1Vua25vd24gcGF0aCcpO1xuICAgICAgcmVzcG9uc2UuZW5kKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbmV4dCgpO1xuICB9KTtcblxuICAvLyBTZXJ2ZSBzdGF0aWMgZmlsZXMgZnJvbSB0aGUgbWFuaWZlc3QuXG4gIC8vIFRoaXMgaXMgaW5zcGlyZWQgYnkgdGhlICdzdGF0aWMnIG1pZGRsZXdhcmUuXG4gIGFwcC51c2UoZnVuY3Rpb24ocmVxLCByZXMsIG5leHQpIHtcbiAgICAvLyBjb25zb2xlLmxvZyhTdHJpbmcoYXJndW1lbnRzLmNhbGxlZSkpO1xuICAgIFdlYkFwcEludGVybmFscy5zdGF0aWNGaWxlc01pZGRsZXdhcmUoXG4gICAgICBXZWJBcHBJbnRlcm5hbHMuc3RhdGljRmlsZXNCeUFyY2gsXG4gICAgICByZXEsXG4gICAgICByZXMsXG4gICAgICBuZXh0XG4gICAgKTtcbiAgfSk7XG5cbiAgLy8gQ29yZSBNZXRlb3IgcGFja2FnZXMgbGlrZSBkeW5hbWljLWltcG9ydCBjYW4gYWRkIGhhbmRsZXJzIGJlZm9yZVxuICAvLyBvdGhlciBoYW5kbGVycyBhZGRlZCBieSBwYWNrYWdlIGFuZCBhcHBsaWNhdGlvbiBjb2RlLlxuICBhcHAudXNlKChXZWJBcHBJbnRlcm5hbHMubWV0ZW9ySW50ZXJuYWxIYW5kbGVycyA9IGNyZWF0ZUV4cHJlc3NBcHAoKSkpO1xuXG4gIC8qKlxuICAgKiBAbmFtZSBleHByZXNzSGFuZGxlcnNDYWxsYmFjayhyZXEsIHJlcywgbmV4dClcbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAaXNwcm90b3R5cGUgdHJ1ZVxuICAgKiBAc3VtbWFyeSBjYWxsYmFjayBoYW5kbGVyIGZvciBgV2ViQXBwLmV4cHJlc3NIYW5kbGVyc2BcbiAgICogQHBhcmFtIHtPYmplY3R9IHJlcVxuICAgKiBhIE5vZGUuanNcbiAgICogW0luY29taW5nTWVzc2FnZV0oaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9odHRwLmh0bWwjY2xhc3MtaHR0cGluY29taW5nbWVzc2FnZSlcbiAgICogb2JqZWN0IHdpdGggc29tZSBleHRyYSBwcm9wZXJ0aWVzLiBUaGlzIGFyZ3VtZW50IGNhbiBiZSB1c2VkXG4gICAqICB0byBnZXQgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGluY29taW5nIHJlcXVlc3QuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXNcbiAgICogYSBOb2RlLmpzXG4gICAqIFtTZXJ2ZXJSZXNwb25zZV0oaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9odHRwLmh0bWwjY2xhc3MtaHR0cHNlcnZlcnJlc3BvbnNlKVxuICAgKiBvYmplY3QuIFVzZSB0aGlzIHRvIHdyaXRlIGRhdGEgdGhhdCBzaG91bGQgYmUgc2VudCBpbiByZXNwb25zZSB0byB0aGVcbiAgICogcmVxdWVzdCwgYW5kIGNhbGwgYHJlcy5lbmQoKWAgd2hlbiB5b3UgYXJlIGRvbmUuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG5leHRcbiAgICogQ2FsbGluZyB0aGlzIGZ1bmN0aW9uIHdpbGwgcGFzcyBvbiB0aGUgaGFuZGxpbmcgb2ZcbiAgICogdGhpcyByZXF1ZXN0IHRvIHRoZSBuZXh0IHJlbGV2YW50IGhhbmRsZXIuXG4gICAqXG4gICAqL1xuXG4gIC8qKlxuICAgKiBAbWV0aG9kIGhhbmRsZXJzXG4gICAqIEBtZW1iZXJvZiBXZWJBcHBcbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAc3VtbWFyeSBSZWdpc3RlciBhIGhhbmRsZXIgZm9yIGFsbCBIVFRQIHJlcXVlc3RzLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gW3BhdGhdXG4gICAqIFRoaXMgaGFuZGxlciB3aWxsIG9ubHkgYmUgY2FsbGVkIG9uIHBhdGhzIHRoYXQgbWF0Y2hcbiAgICogdGhpcyBzdHJpbmcuIFRoZSBtYXRjaCBoYXMgdG8gYm9yZGVyIG9uIGEgYC9gIG9yIGEgYC5gLlxuICAgKlxuICAgKiBGb3IgZXhhbXBsZSwgYC9oZWxsb2Agd2lsbCBtYXRjaCBgL2hlbGxvL3dvcmxkYCBhbmRcbiAgICogYC9oZWxsby53b3JsZGAsIGJ1dCBub3QgYC9oZWxsb193b3JsZGAuXG4gICAqIEBwYXJhbSB7ZXhwcmVzc0hhbmRsZXJzQ2FsbGJhY2t9IGhhbmRsZXJcbiAgICogQSBoYW5kbGVyIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgb24gSFRUUCByZXF1ZXN0cy5cbiAgICogU2VlIGBleHByZXNzSGFuZGxlcnNDYWxsYmFja2BcbiAgICpcbiAgICovXG4gIC8vIFBhY2thZ2VzIGFuZCBhcHBzIGNhbiBhZGQgaGFuZGxlcnMgdG8gdGhpcyB2aWEgV2ViQXBwLmV4cHJlc3NIYW5kbGVycy5cbiAgLy8gVGhleSBhcmUgaW5zZXJ0ZWQgYmVmb3JlIG91ciBkZWZhdWx0IGhhbmRsZXIuXG4gIHZhciBwYWNrYWdlQW5kQXBwSGFuZGxlcnMgPSBjcmVhdGVFeHByZXNzQXBwKClcbiAgYXBwLnVzZShwYWNrYWdlQW5kQXBwSGFuZGxlcnMpO1xuXG4gIGxldCBzdXBwcmVzc0V4cHJlc3NFcnJvcnMgPSBmYWxzZTtcbiAgLy8gRXhwcmVzcyBrbm93cyBpdCBpcyBhbiBlcnJvciBoYW5kbGVyIGJlY2F1c2UgaXQgaGFzIDQgYXJndW1lbnRzIGluc3RlYWQgb2ZcbiAgLy8gMy4gZ28gZmlndXJlLiAgKEl0IGlzIG5vdCBzbWFydCBlbm91Z2ggdG8gZmluZCBzdWNoIGEgdGhpbmcgaWYgaXQncyBoaWRkZW5cbiAgLy8gaW5zaWRlIHBhY2thZ2VBbmRBcHBIYW5kbGVycy4pXG4gIGFwcC51c2UoZnVuY3Rpb24oZXJyLCByZXEsIHJlcywgbmV4dCkge1xuICAgIGlmICghZXJyIHx8ICFzdXBwcmVzc0V4cHJlc3NFcnJvcnMgfHwgIXJlcS5oZWFkZXJzWyd4LXN1cHByZXNzLWVycm9yJ10pIHtcbiAgICAgIG5leHQoZXJyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmVzLndyaXRlSGVhZChlcnIuc3RhdHVzLCB7ICdDb250ZW50LVR5cGUnOiAndGV4dC9wbGFpbicgfSk7XG4gICAgcmVzLmVuZCgnQW4gZXJyb3IgbWVzc2FnZScpO1xuICB9KTtcblxuICBhcHAudXNlKGFzeW5jIGZ1bmN0aW9uKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgaWYgKCFhcHBVcmwocmVxLnVybCkpIHtcbiAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIHJlcS5tZXRob2QgIT09ICdIRUFEJyAmJlxuICAgICAgcmVxLm1ldGhvZCAhPT0gJ0dFVCcgJiZcbiAgICAgICFNZXRlb3Iuc2V0dGluZ3MucGFja2FnZXM/LndlYmFwcD8uYWx3YXlzUmV0dXJuQ29udGVudFxuICAgICkge1xuICAgICAgY29uc3Qgc3RhdHVzID0gcmVxLm1ldGhvZCA9PT0gJ09QVElPTlMnID8gMjAwIDogNDA1O1xuICAgICAgcmVzLndyaXRlSGVhZChzdGF0dXMsIHtcbiAgICAgICAgQWxsb3c6ICdPUFRJT05TLCBHRVQsIEhFQUQnLFxuICAgICAgICAnQ29udGVudC1MZW5ndGgnOiAnMCcsXG4gICAgICB9KTtcbiAgICAgIHJlcy5lbmQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGhlYWRlcnMgPSB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAndGV4dC9odG1sOyBjaGFyc2V0PXV0Zi04JyxcbiAgICAgIH07XG5cbiAgICAgIGlmIChzaHV0dGluZ0Rvd24pIHtcbiAgICAgICAgaGVhZGVyc1snQ29ubmVjdGlvbiddID0gJ0Nsb3NlJztcbiAgICAgIH1cblxuICAgICAgdmFyIHJlcXVlc3QgPSBXZWJBcHAuY2F0ZWdvcml6ZVJlcXVlc3QocmVxKTtcblxuICAgICAgaWYgKHJlcXVlc3QudXJsLnF1ZXJ5ICYmIHJlcXVlc3QudXJsLnF1ZXJ5WydtZXRlb3JfY3NzX3Jlc291cmNlJ10pIHtcbiAgICAgICAgLy8gSW4gdGhpcyBjYXNlLCB3ZSdyZSByZXF1ZXN0aW5nIGEgQ1NTIHJlc291cmNlIGluIHRoZSBtZXRlb3Itc3BlY2lmaWNcbiAgICAgICAgLy8gd2F5LCBidXQgd2UgZG9uJ3QgaGF2ZSBpdC4gIFNlcnZlIGEgc3RhdGljIGNzcyBmaWxlIHRoYXQgaW5kaWNhdGVzIHRoYXRcbiAgICAgICAgLy8gd2UgZGlkbid0IGhhdmUgaXQsIHNvIHdlIGNhbiBkZXRlY3QgdGhhdCBhbmQgcmVmcmVzaC4gIE1ha2Ugc3VyZVxuICAgICAgICAvLyB0aGF0IGFueSBwcm94aWVzIG9yIENETnMgZG9uJ3QgY2FjaGUgdGhpcyBlcnJvciEgIChOb3JtYWxseSBwcm94aWVzXG4gICAgICAgIC8vIG9yIENETnMgYXJlIHNtYXJ0IGVub3VnaCBub3QgdG8gY2FjaGUgZXJyb3IgcGFnZXMsIGJ1dCBpbiBvcmRlciB0b1xuICAgICAgICAvLyBtYWtlIHRoaXMgaGFjayB3b3JrLCB3ZSBuZWVkIHRvIHJldHVybiB0aGUgQ1NTIGZpbGUgYXMgYSAyMDAsIHdoaWNoXG4gICAgICAgIC8vIHdvdWxkIG90aGVyd2lzZSBiZSBjYWNoZWQuKVxuICAgICAgICBoZWFkZXJzWydDb250ZW50LVR5cGUnXSA9ICd0ZXh0L2NzczsgY2hhcnNldD11dGYtOCc7XG4gICAgICAgIGhlYWRlcnNbJ0NhY2hlLUNvbnRyb2wnXSA9ICduby1jYWNoZSc7XG4gICAgICAgIHJlcy53cml0ZUhlYWQoMjAwLCBoZWFkZXJzKTtcbiAgICAgICAgcmVzLndyaXRlKCcubWV0ZW9yLWNzcy1ub3QtZm91bmQtZXJyb3IgeyB3aWR0aDogMHB4O30nKTtcbiAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXF1ZXN0LnVybC5xdWVyeSAmJiByZXF1ZXN0LnVybC5xdWVyeVsnbWV0ZW9yX2pzX3Jlc291cmNlJ10pIHtcbiAgICAgICAgLy8gU2ltaWxhcmx5LCB3ZSdyZSByZXF1ZXN0aW5nIGEgSlMgcmVzb3VyY2UgdGhhdCB3ZSBkb24ndCBoYXZlLlxuICAgICAgICAvLyBTZXJ2ZSBhbiB1bmNhY2hlZCA0MDQuIChXZSBjYW4ndCB1c2UgdGhlIHNhbWUgaGFjayB3ZSB1c2UgZm9yIENTUyxcbiAgICAgICAgLy8gYmVjYXVzZSBhY3R1YWxseSBhY3Rpbmcgb24gdGhhdCBoYWNrIHJlcXVpcmVzIHVzIHRvIGhhdmUgdGhlIEpTXG4gICAgICAgIC8vIGFscmVhZHkhKVxuICAgICAgICBoZWFkZXJzWydDYWNoZS1Db250cm9sJ10gPSAnbm8tY2FjaGUnO1xuICAgICAgICByZXMud3JpdGVIZWFkKDQwNCwgaGVhZGVycyk7XG4gICAgICAgIHJlcy5lbmQoJzQwNCBOb3QgRm91bmQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVxdWVzdC51cmwucXVlcnkgJiYgcmVxdWVzdC51cmwucXVlcnlbJ21ldGVvcl9kb250X3NlcnZlX2luZGV4J10pIHtcbiAgICAgICAgLy8gV2hlbiBkb3dubG9hZGluZyBmaWxlcyBkdXJpbmcgYSBDb3Jkb3ZhIGhvdCBjb2RlIHB1c2gsIHdlIG5lZWRcbiAgICAgICAgLy8gdG8gZGV0ZWN0IGlmIGEgZmlsZSBpcyBub3QgYXZhaWxhYmxlIGluc3RlYWQgb2YgaW5hZHZlcnRlbnRseVxuICAgICAgICAvLyBkb3dubG9hZGluZyB0aGUgZGVmYXVsdCBpbmRleCBwYWdlLlxuICAgICAgICAvLyBTbyBzaW1pbGFyIHRvIHRoZSBzaXR1YXRpb24gYWJvdmUsIHdlIHNlcnZlIGFuIHVuY2FjaGVkIDQwNC5cbiAgICAgICAgaGVhZGVyc1snQ2FjaGUtQ29udHJvbCddID0gJ25vLWNhY2hlJztcbiAgICAgICAgcmVzLndyaXRlSGVhZCg0MDQsIGhlYWRlcnMpO1xuICAgICAgICByZXMuZW5kKCc0MDQgTm90IEZvdW5kJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgeyBhcmNoIH0gPSByZXF1ZXN0O1xuICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBhcmNoLCAnc3RyaW5nJywgeyBhcmNoIH0pO1xuXG4gICAgICBpZiAoIWhhc093bi5jYWxsKFdlYkFwcC5jbGllbnRQcm9ncmFtcywgYXJjaCkpIHtcbiAgICAgICAgLy8gV2UgY291bGQgY29tZSBoZXJlIGluIGNhc2Ugd2UgcnVuIHdpdGggc29tZSBhcmNoaXRlY3R1cmVzIGV4Y2x1ZGVkXG4gICAgICAgIGhlYWRlcnNbJ0NhY2hlLUNvbnRyb2wnXSA9ICduby1jYWNoZSc7XG4gICAgICAgIHJlcy53cml0ZUhlYWQoNDA0LCBoZWFkZXJzKTtcbiAgICAgICAgaWYgKE1ldGVvci5pc0RldmVsb3BtZW50KSB7XG4gICAgICAgICAgcmVzLmVuZChgTm8gY2xpZW50IHByb2dyYW0gZm91bmQgZm9yIHRoZSAke2FyY2h9IGFyY2hpdGVjdHVyZS5gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBTYWZldHkgbmV0LCBidXQgdGhpcyBicmFuY2ggc2hvdWxkIG5vdCBiZSBwb3NzaWJsZS5cbiAgICAgICAgICByZXMuZW5kKCc0MDQgTm90IEZvdW5kJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiBwYXVzZUNsaWVudChhcmNoKSBoYXMgYmVlbiBjYWxsZWQsIHByb2dyYW0ucGF1c2VkIHdpbGwgYmUgYVxuICAgICAgLy8gUHJvbWlzZSB0aGF0IHdpbGwgYmUgcmVzb2x2ZWQgd2hlbiB0aGUgcHJvZ3JhbSBpcyB1bnBhdXNlZC5cbiAgICAgIGF3YWl0IFdlYkFwcC5jbGllbnRQcm9ncmFtc1thcmNoXS5wYXVzZWQ7XG5cbiAgICAgIHJldHVybiBnZXRCb2lsZXJwbGF0ZUFzeW5jKHJlcXVlc3QsIGFyY2gpXG4gICAgICAgIC50aGVuKCh7IHN0cmVhbSwgc3RhdHVzQ29kZSwgaGVhZGVyczogbmV3SGVhZGVycyB9KSA9PiB7XG4gICAgICAgICAgaWYgKCFzdGF0dXNDb2RlKSB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlID0gcmVzLnN0YXR1c0NvZGUgPyByZXMuc3RhdHVzQ29kZSA6IDIwMDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobmV3SGVhZGVycykge1xuICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihoZWFkZXJzLCBuZXdIZWFkZXJzKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXMud3JpdGVIZWFkKHN0YXR1c0NvZGUsIGhlYWRlcnMpO1xuXG4gICAgICAgICAgc3RyZWFtLnBpcGUocmVzLCB7XG4gICAgICAgICAgICAvLyBFbmQgdGhlIHJlc3BvbnNlIHdoZW4gdGhlIHN0cmVhbSBlbmRzLlxuICAgICAgICAgICAgZW5kOiB0cnVlLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgIExvZy5lcnJvcignRXJyb3IgcnVubmluZyB0ZW1wbGF0ZTogJyArIGVycm9yLnN0YWNrKTtcbiAgICAgICAgICByZXMud3JpdGVIZWFkKDUwMCwgaGVhZGVycyk7XG4gICAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIFJldHVybiA0MDQgYnkgZGVmYXVsdCwgaWYgbm8gb3RoZXIgaGFuZGxlcnMgc2VydmUgdGhpcyBVUkwuXG4gIGFwcC51c2UoZnVuY3Rpb24ocmVxLCByZXMpIHtcbiAgICByZXMud3JpdGVIZWFkKDQwNCk7XG4gICAgcmVzLmVuZCgpO1xuICB9KTtcblxuICB2YXIgaHR0cFNlcnZlciA9IGNyZWF0ZVNlcnZlcihhcHApO1xuICB2YXIgb25MaXN0ZW5pbmdDYWxsYmFja3MgPSBbXTtcblxuICAvLyBBZnRlciA1IHNlY29uZHMgdy9vIGRhdGEgb24gYSBzb2NrZXQsIGtpbGwgaXQuICBPbiB0aGUgb3RoZXIgaGFuZCwgaWZcbiAgLy8gdGhlcmUncyBhbiBvdXRzdGFuZGluZyByZXF1ZXN0LCBnaXZlIGl0IGEgaGlnaGVyIHRpbWVvdXQgaW5zdGVhZCAodG8gYXZvaWRcbiAgLy8ga2lsbGluZyBsb25nLXBvbGxpbmcgcmVxdWVzdHMpXG4gIGh0dHBTZXJ2ZXIuc2V0VGltZW91dChTSE9SVF9TT0NLRVRfVElNRU9VVCk7XG5cbiAgLy8gRG8gdGhpcyBoZXJlLCBhbmQgdGhlbiBhbHNvIGluIGxpdmVkYXRhL3N0cmVhbV9zZXJ2ZXIuanMsIGJlY2F1c2VcbiAgLy8gc3RyZWFtX3NlcnZlci5qcyBraWxscyBhbGwgdGhlIGN1cnJlbnQgcmVxdWVzdCBoYW5kbGVycyB3aGVuIGluc3RhbGxpbmcgaXRzXG4gIC8vIG93bi5cbiAgaHR0cFNlcnZlci5vbigncmVxdWVzdCcsIFdlYkFwcC5fdGltZW91dEFkanVzdG1lbnRSZXF1ZXN0Q2FsbGJhY2spO1xuXG4gIC8vIElmIHRoZSBjbGllbnQgZ2F2ZSB1cyBhIGJhZCByZXF1ZXN0LCB0ZWxsIGl0IGluc3RlYWQgb2YganVzdCBjbG9zaW5nIHRoZVxuICAvLyBzb2NrZXQuIFRoaXMgbGV0cyBsb2FkIGJhbGFuY2VycyBpbiBmcm9udCBvZiB1cyBkaWZmZXJlbnRpYXRlIGJldHdlZW4gXCJhXG4gIC8vIHNlcnZlciBpcyByYW5kb21seSBjbG9zaW5nIHNvY2tldHMgZm9yIG5vIHJlYXNvblwiIGFuZCBcImNsaWVudCBzZW50IGEgYmFkXG4gIC8vIHJlcXVlc3RcIi5cbiAgLy9cbiAgLy8gVGhpcyB3aWxsIG9ubHkgd29yayBvbiBOb2RlIDY7IE5vZGUgNCBkZXN0cm95cyB0aGUgc29ja2V0IGJlZm9yZSBjYWxsaW5nXG4gIC8vIHRoaXMgZXZlbnQuIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvcHVsbC80NTU3LyBmb3IgZGV0YWlscy5cbiAgaHR0cFNlcnZlci5vbignY2xpZW50RXJyb3InLCAoZXJyLCBzb2NrZXQpID0+IHtcbiAgICAvLyBQcmUtTm9kZS02LCBkbyBub3RoaW5nLlxuICAgIGlmIChzb2NrZXQuZGVzdHJveWVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGVyci5tZXNzYWdlID09PSAnUGFyc2UgRXJyb3InKSB7XG4gICAgICBzb2NrZXQuZW5kKCdIVFRQLzEuMSA0MDAgQmFkIFJlcXVlc3RcXHJcXG5cXHJcXG4nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRm9yIG90aGVyIGVycm9ycywgdXNlIHRoZSBkZWZhdWx0IGJlaGF2aW9yIGFzIGlmIHdlIGhhZCBubyBjbGllbnRFcnJvclxuICAgICAgLy8gaGFuZGxlci5cbiAgICAgIHNvY2tldC5kZXN0cm95KGVycik7XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBzdXBwcmVzc0Vycm9ycyA9IGZ1bmN0aW9uKCkge1xuICAgIHN1cHByZXNzRXhwcmVzc0Vycm9ycyA9IHRydWU7XG4gIH07XG5cbiAgbGV0IHdhcm5lZEFib3V0Q29ubmVjdFVzYWdlID0gZmFsc2U7XG5cbiAgLy8gc3RhcnQgdXAgYXBwXG4gIF8uZXh0ZW5kKFdlYkFwcCwge1xuICAgIGNvbm5lY3RIYW5kbGVyczogcGFja2FnZUFuZEFwcEhhbmRsZXJzLFxuICAgIGhhbmRsZXJzOiBwYWNrYWdlQW5kQXBwSGFuZGxlcnMsXG4gICAgcmF3Q29ubmVjdEhhbmRsZXJzOiByYXdFeHByZXNzSGFuZGxlcnMsXG4gICAgcmF3SGFuZGxlcnM6IHJhd0V4cHJlc3NIYW5kbGVycyxcbiAgICBodHRwU2VydmVyOiBodHRwU2VydmVyLFxuICAgIGV4cHJlc3NBcHA6IGFwcCxcbiAgICAvLyBGb3IgdGVzdGluZy5cbiAgICBzdXBwcmVzc0Nvbm5lY3RFcnJvcnM6ICgpID0+IHtcbiAgICAgIGlmICghIHdhcm5lZEFib3V0Q29ubmVjdFVzYWdlKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJXZWJBcHAuc3VwcHJlc3NDb25uZWN0RXJyb3JzIGhhcyBiZWVuIHJlbmFtZWQgdG8gTWV0ZW9yLl9zdXBwcmVzc0V4cHJlc3NFcnJvcnMgYW5kIGl0IHNob3VsZCBiZSB1c2VkIG9ubHkgaW4gdGVzdHMuXCIpO1xuICAgICAgICB3YXJuZWRBYm91dENvbm5lY3RVc2FnZSA9IHRydWU7XG4gICAgICB9XG4gICAgICBzdXBwcmVzc0Vycm9ycygpO1xuICAgIH0sXG4gICAgX3N1cHByZXNzRXhwcmVzc0Vycm9yczogc3VwcHJlc3NFcnJvcnMsXG4gICAgb25MaXN0ZW5pbmc6IGZ1bmN0aW9uKGYpIHtcbiAgICAgIGlmIChvbkxpc3RlbmluZ0NhbGxiYWNrcykgb25MaXN0ZW5pbmdDYWxsYmFja3MucHVzaChmKTtcbiAgICAgIGVsc2UgZigpO1xuICAgIH0sXG4gICAgLy8gVGhpcyBjYW4gYmUgb3ZlcnJpZGRlbiBieSB1c2VycyB3aG8gd2FudCB0byBtb2RpZnkgaG93IGxpc3RlbmluZyB3b3Jrc1xuICAgIC8vIChlZywgdG8gcnVuIGEgcHJveHkgbGlrZSBBcG9sbG8gRW5naW5lIFByb3h5IGluIGZyb250IG9mIHRoZSBzZXJ2ZXIpLlxuICAgIHN0YXJ0TGlzdGVuaW5nOiBmdW5jdGlvbihodHRwU2VydmVyLCBsaXN0ZW5PcHRpb25zLCBjYikge1xuICAgICAgaHR0cFNlcnZlci5saXN0ZW4obGlzdGVuT3B0aW9ucywgY2IpO1xuICAgIH0sXG4gIH0pO1xuXG4gICAgLyoqXG4gICAqIEBuYW1lIG1haW5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAc3VtbWFyeSBTdGFydHMgdGhlIEhUVFAgc2VydmVyLlxuICAgKiAgSWYgYFVOSVhfU09DS0VUX1BBVEhgIGlzIHByZXNlbnQgTWV0ZW9yJ3MgSFRUUCBzZXJ2ZXIgd2lsbCB1c2UgdGhhdCBzb2NrZXQgZmlsZSBmb3IgaW50ZXItcHJvY2VzcyBjb21tdW5pY2F0aW9uLCBpbnN0ZWFkIG9mIFRDUC5cbiAgICogSWYgeW91IGNob29zZSB0byBub3QgaW5jbHVkZSB3ZWJhcHAgcGFja2FnZSBpbiB5b3VyIGFwcGxpY2F0aW9uIHRoaXMgbWV0aG9kIHN0aWxsIG11c3QgYmUgZGVmaW5lZCBmb3IgeW91ciBNZXRlb3IgYXBwbGljYXRpb24gdG8gd29yay5cbiAgICovXG4gIC8vIExldCB0aGUgcmVzdCBvZiB0aGUgcGFja2FnZXMgKGFuZCBNZXRlb3Iuc3RhcnR1cCBob29rcykgaW5zZXJ0IEV4cHJlc3NcbiAgLy8gbWlkZGxld2FyZXMgYW5kIHVwZGF0ZSBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLCB0aGVuIGtlZXAgZ29pbmcgdG8gc2V0IHVwXG4gIC8vIGFjdHVhbGx5IHNlcnZpbmcgSFRNTC5cbiAgZXhwb3J0cy5tYWluID0gYXN5bmMgYXJndiA9PiB7XG4gICAgYXdhaXQgV2ViQXBwSW50ZXJuYWxzLmdlbmVyYXRlQm9pbGVycGxhdGUoKTtcblxuICAgIGNvbnN0IHN0YXJ0SHR0cFNlcnZlciA9IGxpc3Rlbk9wdGlvbnMgPT4ge1xuICAgICAgV2ViQXBwLnN0YXJ0TGlzdGVuaW5nKFxuICAgICAgICBhcmd2Py5odHRwU2VydmVyIHx8IGh0dHBTZXJ2ZXIsXG4gICAgICAgIGxpc3Rlbk9wdGlvbnMsXG4gICAgICAgIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoXG4gICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHByb2Nlc3MuZW52Lk1FVEVPUl9QUklOVF9PTl9MSVNURU4pIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0xJU1RFTklORycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgY2FsbGJhY2tzID0gb25MaXN0ZW5pbmdDYWxsYmFja3M7XG4gICAgICAgICAgICBvbkxpc3RlbmluZ0NhbGxiYWNrcyA9IG51bGw7XG4gICAgICAgICAgICBjYWxsYmFja3M/LmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBlID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGxpc3RlbmluZzonLCBlKTtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSAmJiBlLnN0YWNrKTtcbiAgICAgICAgICB9XG4gICAgICAgIClcbiAgICAgICk7XG4gICAgfTtcblxuICAgIGxldCBsb2NhbFBvcnQgPSBwcm9jZXNzLmVudi5QT1JUIHx8IDA7XG4gICAgbGV0IHVuaXhTb2NrZXRQYXRoID0gcHJvY2Vzcy5lbnYuVU5JWF9TT0NLRVRfUEFUSDtcblxuICAgIGlmICh1bml4U29ja2V0UGF0aCkge1xuICAgICAgaWYgKGNsdXN0ZXIuaXNXb3JrZXIpIHtcbiAgICAgICAgY29uc3Qgd29ya2VyTmFtZSA9IGNsdXN0ZXIud29ya2VyLnByb2Nlc3MuZW52Lm5hbWUgfHwgY2x1c3Rlci53b3JrZXIuaWQ7XG4gICAgICAgIHVuaXhTb2NrZXRQYXRoICs9ICcuJyArIHdvcmtlck5hbWUgKyAnLnNvY2snO1xuICAgICAgfVxuICAgICAgLy8gU3RhcnQgdGhlIEhUVFAgc2VydmVyIHVzaW5nIGEgc29ja2V0IGZpbGUuXG4gICAgICByZW1vdmVFeGlzdGluZ1NvY2tldEZpbGUodW5peFNvY2tldFBhdGgpO1xuICAgICAgc3RhcnRIdHRwU2VydmVyKHsgcGF0aDogdW5peFNvY2tldFBhdGggfSk7XG5cbiAgICAgIGNvbnN0IHVuaXhTb2NrZXRQZXJtaXNzaW9ucyA9IChcbiAgICAgICAgcHJvY2Vzcy5lbnYuVU5JWF9TT0NLRVRfUEVSTUlTU0lPTlMgfHwgJydcbiAgICAgICkudHJpbSgpO1xuICAgICAgaWYgKHVuaXhTb2NrZXRQZXJtaXNzaW9ucykge1xuICAgICAgICBpZiAoL15bMC03XXszfSQvLnRlc3QodW5peFNvY2tldFBlcm1pc3Npb25zKSkge1xuICAgICAgICAgIGNobW9kU3luYyh1bml4U29ja2V0UGF0aCwgcGFyc2VJbnQodW5peFNvY2tldFBlcm1pc3Npb25zLCA4KSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFVOSVhfU09DS0VUX1BFUk1JU1NJT05TIHNwZWNpZmllZCcpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHVuaXhTb2NrZXRHcm91cCA9IChwcm9jZXNzLmVudi5VTklYX1NPQ0tFVF9HUk9VUCB8fCAnJykudHJpbSgpO1xuICAgICAgaWYgKHVuaXhTb2NrZXRHcm91cCkge1xuICAgICAgICBjb25zdCB1bml4U29ja2V0R3JvdXBJbmZvID0gZ2V0R3JvdXBJbmZvKHVuaXhTb2NrZXRHcm91cCk7XG4gICAgICAgIGlmICh1bml4U29ja2V0R3JvdXBJbmZvID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFVOSVhfU09DS0VUX0dST1VQIG5hbWUgc3BlY2lmaWVkJyk7XG4gICAgICAgIH1cbiAgICAgICAgY2hvd25TeW5jKHVuaXhTb2NrZXRQYXRoLCB1c2VySW5mbygpLnVpZCwgdW5peFNvY2tldEdyb3VwSW5mby5naWQpO1xuICAgICAgfVxuXG4gICAgICByZWdpc3RlclNvY2tldEZpbGVDbGVhbnVwKHVuaXhTb2NrZXRQYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9jYWxQb3J0ID0gaXNOYU4oTnVtYmVyKGxvY2FsUG9ydCkpID8gbG9jYWxQb3J0IDogTnVtYmVyKGxvY2FsUG9ydCk7XG4gICAgICBpZiAoL1xcXFxcXFxcPy4rXFxcXHBpcGVcXFxcPy4rLy50ZXN0KGxvY2FsUG9ydCkpIHtcbiAgICAgICAgLy8gU3RhcnQgdGhlIEhUVFAgc2VydmVyIHVzaW5nIFdpbmRvd3MgU2VydmVyIHN0eWxlIG5hbWVkIHBpcGUuXG4gICAgICAgIHN0YXJ0SHR0cFNlcnZlcih7IHBhdGg6IGxvY2FsUG9ydCB9KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGxvY2FsUG9ydCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgLy8gU3RhcnQgdGhlIEhUVFAgc2VydmVyIHVzaW5nIFRDUC5cbiAgICAgICAgc3RhcnRIdHRwU2VydmVyKHtcbiAgICAgICAgICBwb3J0OiBsb2NhbFBvcnQsXG4gICAgICAgICAgaG9zdDogcHJvY2Vzcy5lbnYuQklORF9JUCB8fCAnMC4wLjAuMCcsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFBPUlQgc3BlY2lmaWVkJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuICdEQUVNT04nO1xuICB9O1xufVxuXG5jb25zdCBpc0dldGVudEF2YWlsYWJsZSA9ICgpID0+IHtcbiAgdHJ5IHtcbiAgICBleGVjU3luYygnd2hpY2ggZ2V0ZW50Jyk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufTtcblxuY29uc3QgZ2V0R3JvdXBJbmZvVXNpbmdHZXRlbnQgPSAoZ3JvdXBOYW1lKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qgc3Rkb3V0ID0gZXhlY1N5bmMoYGdldGVudCBncm91cCAke2dyb3VwTmFtZX1gLCB7IGVuY29kaW5nOiAndXRmOCcgfSk7XG4gICAgaWYgKCFzdGRvdXQpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IFtuYW1lLCAsIGdpZF0gPSBzdGRvdXQudHJpbSgpLnNwbGl0KCc6Jyk7XG4gICAgaWYgKG5hbWUgPT0gbnVsbCB8fCBnaWQgPT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIHsgbmFtZSwgZ2lkOiBOdW1iZXIoZ2lkKSB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59O1xuXG5jb25zdCBnZXRHcm91cEluZm9Gcm9tRmlsZSA9IChncm91cE5hbWUpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBkYXRhID0gcmVhZEZpbGVTeW5jKCcvZXRjL2dyb3VwJywgJ3V0ZjgnKTtcbiAgICBjb25zdCBncm91cExpbmUgPSBkYXRhLnRyaW0oKS5zcGxpdCgnXFxuJykuZmluZChsaW5lID0+IGxpbmUuc3RhcnRzV2l0aChgJHtncm91cE5hbWV9OmApKTtcbiAgICBpZiAoIWdyb3VwTGluZSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgW25hbWUsICwgZ2lkXSA9IGdyb3VwTGluZS50cmltKCkuc3BsaXQoJzonKTtcbiAgICBpZiAobmFtZSA9PSBudWxsIHx8IGdpZCA9PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4geyBuYW1lLCBnaWQ6IE51bWJlcihnaWQpIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBnZXRHcm91cEluZm8gPSAoZ3JvdXBOYW1lKSA9PiB7XG4gIGxldCBncm91cEluZm8gPSBnZXRHcm91cEluZm9Gcm9tRmlsZShncm91cE5hbWUpO1xuICBpZiAoIWdyb3VwSW5mbyAmJiBpc0dldGVudEF2YWlsYWJsZSgpKSB7XG4gICAgZ3JvdXBJbmZvID0gZ2V0R3JvdXBJbmZvVXNpbmdHZXRlbnQoZ3JvdXBOYW1lKTtcbiAgfVxuICByZXR1cm4gZ3JvdXBJbmZvO1xufTtcblxudmFyIGlubGluZVNjcmlwdHNBbGxvd2VkID0gdHJ1ZTtcblxuV2ViQXBwSW50ZXJuYWxzLmlubGluZVNjcmlwdHNBbGxvd2VkID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBpbmxpbmVTY3JpcHRzQWxsb3dlZDtcbn07XG5cbldlYkFwcEludGVybmFscy5zZXRJbmxpbmVTY3JpcHRzQWxsb3dlZCA9IGFzeW5jIGZ1bmN0aW9uKHZhbHVlKSB7XG4gIGlubGluZVNjcmlwdHNBbGxvd2VkID0gdmFsdWU7XG4gIGF3YWl0IFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlKCk7XG59O1xuXG52YXIgc3JpTW9kZTtcblxuV2ViQXBwSW50ZXJuYWxzLmVuYWJsZVN1YnJlc291cmNlSW50ZWdyaXR5ID0gYXN5bmMgZnVuY3Rpb24odXNlX2NyZWRlbnRpYWxzID0gZmFsc2UpIHtcbiAgc3JpTW9kZSA9IHVzZV9jcmVkZW50aWFscyA/ICd1c2UtY3JlZGVudGlhbHMnIDogJ2Fub255bW91cyc7XG4gIGF3YWl0IFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlKCk7XG59O1xuXG5XZWJBcHBJbnRlcm5hbHMuc2V0QnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2sgPSBhc3luYyBmdW5jdGlvbihob29rRm4pIHtcbiAgYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2sgPSBob29rRm47XG4gIGF3YWl0IFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlKCk7XG59O1xuXG5XZWJBcHBJbnRlcm5hbHMuc2V0QnVuZGxlZEpzQ3NzUHJlZml4ID0gYXN5bmMgZnVuY3Rpb24ocHJlZml4KSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgYXdhaXQgc2VsZi5zZXRCdW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayhmdW5jdGlvbih1cmwpIHtcbiAgICByZXR1cm4gcHJlZml4ICsgdXJsO1xuICB9KTtcbn07XG5cbi8vIFBhY2thZ2VzIGNhbiBjYWxsIGBXZWJBcHBJbnRlcm5hbHMuYWRkU3RhdGljSnNgIHRvIHNwZWNpZnkgc3RhdGljXG4vLyBKYXZhU2NyaXB0IHRvIGJlIGluY2x1ZGVkIGluIHRoZSBhcHAuIFRoaXMgc3RhdGljIEpTIHdpbGwgYmUgaW5saW5lZCxcbi8vIHVubGVzcyBpbmxpbmUgc2NyaXB0cyBoYXZlIGJlZW4gZGlzYWJsZWQsIGluIHdoaWNoIGNhc2UgaXQgd2lsbCBiZVxuLy8gc2VydmVkIHVuZGVyIGAvPHNoYTEgb2YgY29udGVudHM+YC5cbnZhciBhZGRpdGlvbmFsU3RhdGljSnMgPSB7fTtcbldlYkFwcEludGVybmFscy5hZGRTdGF0aWNKcyA9IGZ1bmN0aW9uKGNvbnRlbnRzKSB7XG4gIGFkZGl0aW9uYWxTdGF0aWNKc1snLycgKyBzaGExKGNvbnRlbnRzKSArICcuanMnXSA9IGNvbnRlbnRzO1xufTtcblxuLy8gRXhwb3J0ZWQgZm9yIHRlc3RzXG5XZWJBcHBJbnRlcm5hbHMuZ2V0Qm9pbGVycGxhdGUgPSBnZXRCb2lsZXJwbGF0ZTtcbldlYkFwcEludGVybmFscy5hZGRpdGlvbmFsU3RhdGljSnMgPSBhZGRpdGlvbmFsU3RhdGljSnM7XG5cbmF3YWl0IHJ1bldlYkFwcFNlcnZlcigpO1xuIiwiaW1wb3J0IHsgc3RhdFN5bmMsIHVubGlua1N5bmMsIGV4aXN0c1N5bmMgfSBmcm9tICdmcyc7XG5cbi8vIFNpbmNlIGEgbmV3IHNvY2tldCBmaWxlIHdpbGwgYmUgY3JlYXRlZCB3aGVuIHRoZSBIVFRQIHNlcnZlclxuLy8gc3RhcnRzIHVwLCBpZiBmb3VuZCByZW1vdmUgdGhlIGV4aXN0aW5nIGZpbGUuXG4vL1xuLy8gV0FSTklORzpcbi8vIFRoaXMgd2lsbCByZW1vdmUgdGhlIGNvbmZpZ3VyZWQgc29ja2V0IGZpbGUgd2l0aG91dCB3YXJuaW5nLiBJZlxuLy8gdGhlIGNvbmZpZ3VyZWQgc29ja2V0IGZpbGUgaXMgYWxyZWFkeSBpbiB1c2UgYnkgYW5vdGhlciBhcHBsaWNhdGlvbixcbi8vIGl0IHdpbGwgc3RpbGwgYmUgcmVtb3ZlZC4gTm9kZSBkb2VzIG5vdCBwcm92aWRlIGEgcmVsaWFibGUgd2F5IHRvXG4vLyBkaWZmZXJlbnRpYXRlIGJldHdlZW4gYSBzb2NrZXQgZmlsZSB0aGF0IGlzIGFscmVhZHkgaW4gdXNlIGJ5XG4vLyBhbm90aGVyIGFwcGxpY2F0aW9uIG9yIGEgc3RhbGUgc29ja2V0IGZpbGUgdGhhdCBoYXMgYmVlblxuLy8gbGVmdCBvdmVyIGFmdGVyIGEgU0lHS0lMTC4gU2luY2Ugd2UgaGF2ZSBubyByZWxpYWJsZSB3YXkgdG9cbi8vIGRpZmZlcmVudGlhdGUgYmV0d2VlbiB0aGVzZSB0d28gc2NlbmFyaW9zLCB0aGUgYmVzdCBjb3Vyc2Ugb2Zcbi8vIGFjdGlvbiBkdXJpbmcgc3RhcnR1cCBpcyB0byByZW1vdmUgYW55IGV4aXN0aW5nIHNvY2tldCBmaWxlLiBUaGlzXG4vLyBpcyBub3QgdGhlIHNhZmVzdCBjb3Vyc2Ugb2YgYWN0aW9uIGFzIHJlbW92aW5nIHRoZSBleGlzdGluZyBzb2NrZXRcbi8vIGZpbGUgY291bGQgaW1wYWN0IGFuIGFwcGxpY2F0aW9uIHVzaW5nIGl0LCBidXQgdGhpcyBhcHByb2FjaCBoZWxwc1xuLy8gZW5zdXJlIHRoZSBIVFRQIHNlcnZlciBjYW4gc3RhcnR1cCB3aXRob3V0IG1hbnVhbFxuLy8gaW50ZXJ2ZW50aW9uIChlLmcuIGFza2luZyBmb3IgdGhlIHZlcmlmaWNhdGlvbiBhbmQgY2xlYW51cCBvZiBzb2NrZXRcbi8vIGZpbGVzIGJlZm9yZSBhbGxvd2luZyB0aGUgSFRUUCBzZXJ2ZXIgdG8gYmUgc3RhcnRlZCkuXG4vL1xuLy8gVGhlIGFib3ZlIGJlaW5nIHNhaWQsIGFzIGxvbmcgYXMgdGhlIHNvY2tldCBmaWxlIHBhdGggaXNcbi8vIGNvbmZpZ3VyZWQgY2FyZWZ1bGx5IHdoZW4gdGhlIGFwcGxpY2F0aW9uIGlzIGRlcGxveWVkIChhbmQgZXh0cmFcbi8vIGNhcmUgaXMgdGFrZW4gdG8gbWFrZSBzdXJlIHRoZSBjb25maWd1cmVkIHBhdGggaXMgdW5pcXVlIGFuZCBkb2Vzbid0XG4vLyBjb25mbGljdCB3aXRoIGFub3RoZXIgc29ja2V0IGZpbGUgcGF0aCksIHRoZW4gdGhlcmUgc2hvdWxkIG5vdCBiZVxuLy8gYW55IGlzc3VlcyB3aXRoIHRoaXMgYXBwcm9hY2guXG5leHBvcnQgY29uc3QgcmVtb3ZlRXhpc3RpbmdTb2NrZXRGaWxlID0gKHNvY2tldFBhdGgpID0+IHtcbiAgdHJ5IHtcbiAgICBpZiAoc3RhdFN5bmMoc29ja2V0UGF0aCkuaXNTb2NrZXQoKSkge1xuICAgICAgLy8gU2luY2UgYSBuZXcgc29ja2V0IGZpbGUgd2lsbCBiZSBjcmVhdGVkLCByZW1vdmUgdGhlIGV4aXN0aW5nXG4gICAgICAvLyBmaWxlLlxuICAgICAgdW5saW5rU3luYyhzb2NrZXRQYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQW4gZXhpc3RpbmcgZmlsZSB3YXMgZm91bmQgYXQgXCIke3NvY2tldFBhdGh9XCIgYW5kIGl0IGlzIG5vdCBgICtcbiAgICAgICAgJ2Egc29ja2V0IGZpbGUuIFBsZWFzZSBjb25maXJtIFBPUlQgaXMgcG9pbnRpbmcgdG8gdmFsaWQgYW5kICcgK1xuICAgICAgICAndW4tdXNlZCBzb2NrZXQgZmlsZSBwYXRoLidcbiAgICAgICk7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIElmIHRoZXJlIGlzIG5vIGV4aXN0aW5nIHNvY2tldCBmaWxlIHRvIGNsZWFudXAsIGdyZWF0LCB3ZSdsbFxuICAgIC8vIGNvbnRpbnVlIG5vcm1hbGx5LiBJZiB0aGUgY2F1Z2h0IGV4Y2VwdGlvbiByZXByZXNlbnRzIGFueSBvdGhlclxuICAgIC8vIGlzc3VlLCByZS10aHJvdy5cbiAgICBpZiAoZXJyb3IuY29kZSAhPT0gJ0VOT0VOVCcpIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxufTtcblxuLy8gUmVtb3ZlIHRoZSBzb2NrZXQgZmlsZSB3aGVuIGRvbmUgdG8gYXZvaWQgbGVhdmluZyBiZWhpbmQgYSBzdGFsZSBvbmUuXG4vLyBOb3RlIC0gYSBzdGFsZSBzb2NrZXQgZmlsZSBpcyBzdGlsbCBsZWZ0IGJlaGluZCBpZiB0aGUgcnVubmluZyBub2RlXG4vLyBwcm9jZXNzIGlzIGtpbGxlZCB2aWEgc2lnbmFsIDkgLSBTSUdLSUxMLlxuZXhwb3J0IGNvbnN0IHJlZ2lzdGVyU29ja2V0RmlsZUNsZWFudXAgPVxuICAoc29ja2V0UGF0aCwgZXZlbnRFbWl0dGVyID0gcHJvY2VzcykgPT4ge1xuICAgIFsnZXhpdCcsICdTSUdJTlQnLCAnU0lHSFVQJywgJ1NJR1RFUk0nXS5mb3JFYWNoKHNpZ25hbCA9PiB7XG4gICAgICBldmVudEVtaXR0ZXIub24oc2lnbmFsLCBNZXRlb3IuYmluZEVudmlyb25tZW50KCgpID0+IHtcbiAgICAgICAgaWYgKGV4aXN0c1N5bmMoc29ja2V0UGF0aCkpIHtcbiAgICAgICAgICB1bmxpbmtTeW5jKHNvY2tldFBhdGgpO1xuICAgICAgICB9XG4gICAgICB9KSk7XG4gICAgfSk7XG4gIH07XG4iXX0=
