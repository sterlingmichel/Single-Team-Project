Package["core-runtime"].queue("ddp-server",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var _ = Package.underscore._;
var Retry = Package.retry.Retry;
var MongoID = Package['mongo-id'].MongoID;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var ECMAScript = Package.ecmascript.ECMAScript;
var DDPCommon = Package['ddp-common'].DDPCommon;
var DDP = Package['ddp-client'].DDP;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var StreamServer, DDPServer, id, Server;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-server":{"stream_server.js":function module(require){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/stream_server.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// By default, we use the permessage-deflate extension with default
// configuration. If $SERVER_WEBSOCKET_COMPRESSION is set, then it must be valid
// JSON. If it represents a falsey value, then we do not use permessage-deflate
// at all; otherwise, the JSON value is used as an argument to deflate's
// configure method; see
// https://github.com/faye/permessage-deflate-node/blob/master/README.md
//
// (We do this in an _.once instead of at startup, because we don't want to
// crash the tool during isopacket load if your JSON doesn't parse. This is only
// a problem because the tool has to load the DDP server code just in order to
// be a DDP client; see https://github.com/meteor/meteor/issues/3452 .)
var websocketExtensions = _.once(function () {
  var extensions = [];
  var websocketCompressionConfig = process.env.SERVER_WEBSOCKET_COMPRESSION ? JSON.parse(process.env.SERVER_WEBSOCKET_COMPRESSION) : {};
  if (websocketCompressionConfig) {
    extensions.push(Npm.require('permessage-deflate').configure(websocketCompressionConfig));
  }
  return extensions;
});
var pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || "";
StreamServer = function () {
  var self = this;
  self.registration_callbacks = [];
  self.open_sockets = [];

  // Because we are installing directly onto WebApp.httpServer instead of using
  // WebApp.app, we have to process the path prefix ourselves.
  self.prefix = pathPrefix + '/sockjs';
  RoutePolicy.declare(self.prefix + '/', 'network');

  // set up sockjs
  var sockjs = Npm.require('sockjs');
  var serverOptions = {
    prefix: self.prefix,
    log: function () {},
    // this is the default, but we code it explicitly because we depend
    // on it in stream_client:HEARTBEAT_TIMEOUT
    heartbeat_delay: 45000,
    // The default disconnect_delay is 5 seconds, but if the server ends up CPU
    // bound for that much time, SockJS might not notice that the user has
    // reconnected because the timer (of disconnect_delay ms) can fire before
    // SockJS processes the new connection. Eventually we'll fix this by not
    // combining CPU-heavy processing with SockJS termination (eg a proxy which
    // converts to Unix sockets) but for now, raise the delay.
    disconnect_delay: 60 * 1000,
    // Allow disabling of CORS requests to address
    // https://github.com/meteor/meteor/issues/8317.
    disable_cors: !!process.env.DISABLE_SOCKJS_CORS,
    // Set the USE_JSESSIONID environment variable to enable setting the
    // JSESSIONID cookie. This is useful for setting up proxies with
    // session affinity.
    jsessionid: !!process.env.USE_JSESSIONID
  };

  // If you know your server environment (eg, proxies) will prevent websockets
  // from ever working, set $DISABLE_WEBSOCKETS and SockJS clients (ie,
  // browsers) will not waste time attempting to use them.
  // (Your server will still have a /websocket endpoint.)
  if (process.env.DISABLE_WEBSOCKETS) {
    serverOptions.websocket = false;
  } else {
    serverOptions.faye_server_options = {
      extensions: websocketExtensions()
    };
  }
  self.server = sockjs.createServer(serverOptions);

  // Install the sockjs handlers, but we want to keep around our own particular
  // request handler that adjusts idle timeouts while we have an outstanding
  // request.  This compensates for the fact that sockjs removes all listeners
  // for "request" to add its own.
  WebApp.httpServer.removeListener('request', WebApp._timeoutAdjustmentRequestCallback);
  self.server.installHandlers(WebApp.httpServer);
  WebApp.httpServer.addListener('request', WebApp._timeoutAdjustmentRequestCallback);

  // Support the /websocket endpoint
  self._redirectWebsocketEndpoint();
  self.server.on('connection', function (socket) {
    // sockjs sometimes passes us null instead of a socket object
    // so we need to guard against that. see:
    // https://github.com/sockjs/sockjs-node/issues/121
    // https://github.com/meteor/meteor/issues/10468
    if (!socket) return;

    // We want to make sure that if a client connects to us and does the initial
    // Websocket handshake but never gets to the DDP handshake, that we
    // eventually kill the socket.  Once the DDP handshake happens, DDP
    // heartbeating will work. And before the Websocket handshake, the timeouts
    // we set at the server level in webapp_server.js will work. But
    // faye-websocket calls setTimeout(0) on any socket it takes over, so there
    // is an "in between" state where this doesn't happen.  We work around this
    // by explicitly setting the socket timeout to a relatively large time here,
    // and setting it back to zero when we set up the heartbeat in
    // livedata_server.js.
    socket.setWebsocketTimeout = function (timeout) {
      if ((socket.protocol === 'websocket' || socket.protocol === 'websocket-raw') && socket._session.recv) {
        socket._session.recv.connection.setTimeout(timeout);
      }
    };
    socket.setWebsocketTimeout(45 * 1000);
    socket.send = function (data) {
      socket.write(data);
    };
    socket.on('close', function () {
      self.open_sockets = _.without(self.open_sockets, socket);
    });
    self.open_sockets.push(socket);

    // only to send a message after connection on tests, useful for
    // socket-stream-client/server-tests.js
    if (process.env.TEST_METADATA && process.env.TEST_METADATA !== "{}") {
      socket.send(JSON.stringify({
        testMessageOnConnect: true
      }));
    }

    // call all our callbacks when we get a new socket. they will do the
    // work of setting up handlers and such for specific messages.
    _.each(self.registration_callbacks, function (callback) {
      callback(socket);
    });
  });
};
Object.assign(StreamServer.prototype, {
  // call my callback when a new socket connects.
  // also call it for all current connections.
  register: function (callback) {
    var self = this;
    self.registration_callbacks.push(callback);
    _.each(self.all_sockets(), function (socket) {
      callback(socket);
    });
  },
  // get a list of all sockets
  all_sockets: function () {
    var self = this;
    return _.values(self.open_sockets);
  },
  // Redirect /websocket to /sockjs/websocket in order to not expose
  // sockjs to clients that want to use raw websockets
  _redirectWebsocketEndpoint: function () {
    var self = this;
    // Unfortunately we can't use a connect middleware here since
    // sockjs installs itself prior to all existing listeners
    // (meaning prior to any connect middlewares) so we need to take
    // an approach similar to overshadowListeners in
    // https://github.com/sockjs/sockjs-node/blob/cf820c55af6a9953e16558555a31decea554f70e/src/utils.coffee
    ['request', 'upgrade'].forEach(event => {
      var httpServer = WebApp.httpServer;
      var oldHttpServerListeners = httpServer.listeners(event).slice(0);
      httpServer.removeAllListeners(event);

      // request and upgrade have different arguments passed but
      // we only care about the first one which is always request
      var newListener = function (request /*, moreArguments */) {
        // Store arguments for use within the closure below
        var args = arguments;

        // TODO replace with url package
        var url = Npm.require('url');

        // Rewrite /websocket and /websocket/ urls to /sockjs/websocket while
        // preserving query string.
        var parsedUrl = url.parse(request.url);
        if (parsedUrl.pathname === pathPrefix + '/websocket' || parsedUrl.pathname === pathPrefix + '/websocket/') {
          parsedUrl.pathname = self.prefix + '/websocket';
          request.url = url.format(parsedUrl);
        }
        _.each(oldHttpServerListeners, function (oldListener) {
          oldListener.apply(httpServer, args);
        });
      };
      httpServer.addListener(event, newListener);
    });
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livedata_server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/livedata_server.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    DDPServer = {};

    // Publication strategies define how we handle data from published cursors at the collection level
    // This allows someone to:
    // - Choose a trade-off between client-server bandwidth and server memory usage
    // - Implement special (non-mongo) collections like volatile message queues
    const publicationStrategies = {
      // SERVER_MERGE is the default strategy.
      // When using this strategy, the server maintains a copy of all data a connection is subscribed to.
      // This allows us to only send deltas over multiple publications.
      SERVER_MERGE: {
        useDummyDocumentView: false,
        useCollectionView: true,
        doAccountingForCollection: true
      },
      // The NO_MERGE_NO_HISTORY strategy results in the server sending all publication data
      // directly to the client. It does not remember what it has previously sent
      // to it will not trigger removed messages when a subscription is stopped.
      // This should only be chosen for special use cases like send-and-forget queues.
      NO_MERGE_NO_HISTORY: {
        useDummyDocumentView: false,
        useCollectionView: false,
        doAccountingForCollection: false
      },
      // NO_MERGE is similar to NO_MERGE_NO_HISTORY but the server will remember the IDs it has
      // sent to the client so it can remove them when a subscription is stopped.
      // This strategy can be used when a collection is only used in a single publication.
      NO_MERGE: {
        useDummyDocumentView: false,
        useCollectionView: false,
        doAccountingForCollection: true
      },
      // NO_MERGE_MULTI is similar to `NO_MERGE`, but it does track whether a document is
      // used by multiple publications. This has some memory overhead, but it still does not do
      // diffing so it's faster and slimmer than SERVER_MERGE.
      NO_MERGE_MULTI: {
        useDummyDocumentView: true,
        useCollectionView: true,
        doAccountingForCollection: true
      }
    };
    DDPServer.publicationStrategies = publicationStrategies;

    // This file contains classes:
    // * Session - The server's connection to a single DDP client
    // * Subscription - A single subscription for a single client
    // * Server - An entire server that may talk to > 1 client. A DDP endpoint.
    //
    // Session and Subscription are file scope. For now, until we freeze
    // the interface, Server is package scope (in the future it should be
    // exported).
    var DummyDocumentView = function () {
      var self = this;
      self.existsIn = new Set(); // set of subscriptionHandle
      self.dataByKey = new Map(); // key-> [ {subscriptionHandle, value} by precedence]
    };
    Object.assign(DummyDocumentView.prototype, {
      getFields: function () {
        return {};
      },
      clearField: function (subscriptionHandle, key, changeCollector) {
        changeCollector[key] = undefined;
      },
      changeField: function (subscriptionHandle, key, value, changeCollector, isAdd) {
        changeCollector[key] = value;
      }
    });

    // Represents a single document in a SessionCollectionView
    var SessionDocumentView = function () {
      var self = this;
      self.existsIn = new Set(); // set of subscriptionHandle
      self.dataByKey = new Map(); // key-> [ {subscriptionHandle, value} by precedence]
    };
    DDPServer._SessionDocumentView = SessionDocumentView;
    DDPServer._getCurrentFence = function () {
      let currentInvocation = this._CurrentWriteFence.get();
      if (currentInvocation) {
        return currentInvocation;
      }
      currentInvocation = DDP._CurrentMethodInvocation.get();
      return currentInvocation ? currentInvocation.fence : undefined;
    };
    _.extend(SessionDocumentView.prototype, {
      getFields: function () {
        var self = this;
        var ret = {};
        self.dataByKey.forEach(function (precedenceList, key) {
          ret[key] = precedenceList[0].value;
        });
        return ret;
      },
      clearField: function (subscriptionHandle, key, changeCollector) {
        var self = this;
        // Publish API ignores _id if present in fields
        if (key === "_id") return;
        var precedenceList = self.dataByKey.get(key);

        // It's okay to clear fields that didn't exist. No need to throw
        // an error.
        if (!precedenceList) return;
        var removedValue = undefined;
        for (var i = 0; i < precedenceList.length; i++) {
          var precedence = precedenceList[i];
          if (precedence.subscriptionHandle === subscriptionHandle) {
            // The view's value can only change if this subscription is the one that
            // used to have precedence.
            if (i === 0) removedValue = precedence.value;
            precedenceList.splice(i, 1);
            break;
          }
        }
        if (precedenceList.length === 0) {
          self.dataByKey.delete(key);
          changeCollector[key] = undefined;
        } else if (removedValue !== undefined && !EJSON.equals(removedValue, precedenceList[0].value)) {
          changeCollector[key] = precedenceList[0].value;
        }
      },
      changeField: function (subscriptionHandle, key, value, changeCollector, isAdd) {
        var self = this;
        // Publish API ignores _id if present in fields
        if (key === "_id") return;

        // Don't share state with the data passed in by the user.
        value = EJSON.clone(value);
        if (!self.dataByKey.has(key)) {
          self.dataByKey.set(key, [{
            subscriptionHandle: subscriptionHandle,
            value: value
          }]);
          changeCollector[key] = value;
          return;
        }
        var precedenceList = self.dataByKey.get(key);
        var elt;
        if (!isAdd) {
          elt = precedenceList.find(function (precedence) {
            return precedence.subscriptionHandle === subscriptionHandle;
          });
        }
        if (elt) {
          if (elt === precedenceList[0] && !EJSON.equals(value, elt.value)) {
            // this subscription is changing the value of this field.
            changeCollector[key] = value;
          }
          elt.value = value;
        } else {
          // this subscription is newly caring about this field
          precedenceList.push({
            subscriptionHandle: subscriptionHandle,
            value: value
          });
        }
      }
    });

    /**
     * Represents a client's view of a single collection
     * @param {String} collectionName Name of the collection it represents
     * @param {Object.<String, Function>} sessionCallbacks The callbacks for added, changed, removed
     * @class SessionCollectionView
     */
    var SessionCollectionView = function (collectionName, sessionCallbacks) {
      var self = this;
      self.collectionName = collectionName;
      self.documents = new Map();
      self.callbacks = sessionCallbacks;
    };
    DDPServer._SessionCollectionView = SessionCollectionView;
    Object.assign(SessionCollectionView.prototype, {
      isEmpty: function () {
        var self = this;
        return self.documents.size === 0;
      },
      diff: function (previous) {
        var self = this;
        DiffSequence.diffMaps(previous.documents, self.documents, {
          both: _.bind(self.diffDocument, self),
          rightOnly: function (id, nowDV) {
            self.callbacks.added(self.collectionName, id, nowDV.getFields());
          },
          leftOnly: function (id, prevDV) {
            self.callbacks.removed(self.collectionName, id);
          }
        });
      },
      diffDocument: function (id, prevDV, nowDV) {
        var self = this;
        var fields = {};
        DiffSequence.diffObjects(prevDV.getFields(), nowDV.getFields(), {
          both: function (key, prev, now) {
            if (!EJSON.equals(prev, now)) fields[key] = now;
          },
          rightOnly: function (key, now) {
            fields[key] = now;
          },
          leftOnly: function (key, prev) {
            fields[key] = undefined;
          }
        });
        self.callbacks.changed(self.collectionName, id, fields);
      },
      added: function (subscriptionHandle, id, fields) {
        var self = this;
        var docView = self.documents.get(id);
        var added = false;
        if (!docView) {
          added = true;
          if (Meteor.server.getPublicationStrategy(this.collectionName).useDummyDocumentView) {
            docView = new DummyDocumentView();
          } else {
            docView = new SessionDocumentView();
          }
          self.documents.set(id, docView);
        }
        docView.existsIn.add(subscriptionHandle);
        var changeCollector = {};
        _.each(fields, function (value, key) {
          docView.changeField(subscriptionHandle, key, value, changeCollector, true);
        });
        if (added) self.callbacks.added(self.collectionName, id, changeCollector);else self.callbacks.changed(self.collectionName, id, changeCollector);
      },
      changed: function (subscriptionHandle, id, changed) {
        var self = this;
        var changedResult = {};
        var docView = self.documents.get(id);
        if (!docView) throw new Error("Could not find element with id " + id + " to change");
        _.each(changed, function (value, key) {
          if (value === undefined) docView.clearField(subscriptionHandle, key, changedResult);else docView.changeField(subscriptionHandle, key, value, changedResult);
        });
        self.callbacks.changed(self.collectionName, id, changedResult);
      },
      removed: function (subscriptionHandle, id) {
        var self = this;
        var docView = self.documents.get(id);
        if (!docView) {
          var err = new Error("Removed nonexistent document " + id);
          throw err;
        }
        docView.existsIn.delete(subscriptionHandle);
        if (docView.existsIn.size === 0) {
          // it is gone from everyone
          self.callbacks.removed(self.collectionName, id);
          self.documents.delete(id);
        } else {
          var changed = {};
          // remove this subscription from every precedence list
          // and record the changes
          docView.dataByKey.forEach(function (precedenceList, key) {
            docView.clearField(subscriptionHandle, key, changed);
          });
          self.callbacks.changed(self.collectionName, id, changed);
        }
      }
    });

    /******************************************************************************/
    /* Session                                                                    */
    /******************************************************************************/

    var Session = function (server, version, socket, options) {
      var self = this;
      self.id = Random.id();
      self.server = server;
      self.version = version;
      self.initialized = false;
      self.socket = socket;

      // Set to null when the session is destroyed. Multiple places below
      // use this to determine if the session is alive or not.
      self.inQueue = new Meteor._DoubleEndedQueue();
      self.blocked = false;
      self.workerRunning = false;
      self.cachedUnblock = null;

      // Sub objects for active subscriptions
      self._namedSubs = new Map();
      self._universalSubs = [];
      self.userId = null;
      self.collectionViews = new Map();

      // Set this to false to not send messages when collectionViews are
      // modified. This is done when rerunning subs in _setUserId and those messages
      // are calculated via a diff instead.
      self._isSending = true;

      // If this is true, don't start a newly-created universal publisher on this
      // session. The session will take care of starting it when appropriate.
      self._dontStartNewUniversalSubs = false;

      // When we are rerunning subscriptions, any ready messages
      // we want to buffer up for when we are done rerunning subscriptions
      self._pendingReady = [];

      // List of callbacks to call when this connection is closed.
      self._closeCallbacks = [];

      // XXX HACK: If a sockjs connection, save off the URL. This is
      // temporary and will go away in the near future.
      self._socketUrl = socket.url;

      // Allow tests to disable responding to pings.
      self._respondToPings = options.respondToPings;

      // This object is the public interface to the session. In the public
      // API, it is called the `connection` object.  Internally we call it
      // a `connectionHandle` to avoid ambiguity.
      self.connectionHandle = {
        id: self.id,
        close: function () {
          self.close();
        },
        onClose: function (fn) {
          var cb = Meteor.bindEnvironment(fn, "connection onClose callback");
          if (self.inQueue) {
            self._closeCallbacks.push(cb);
          } else {
            // if we're already closed, call the callback.
            Meteor.defer(cb);
          }
        },
        clientAddress: self._clientAddress(),
        httpHeaders: self.socket.headers
      };
      self.send({
        msg: 'connected',
        session: self.id
      });

      // On initial connect, spin up all the universal publishers.
      self.startUniversalSubs();
      if (version !== 'pre1' && options.heartbeatInterval !== 0) {
        // We no longer need the low level timeout because we have heartbeats.
        socket.setWebsocketTimeout(0);
        self.heartbeat = new DDPCommon.Heartbeat({
          heartbeatInterval: options.heartbeatInterval,
          heartbeatTimeout: options.heartbeatTimeout,
          onTimeout: function () {
            self.close();
          },
          sendPing: function () {
            self.send({
              msg: 'ping'
            });
          }
        });
        self.heartbeat.start();
      }
      Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "sessions", 1);
    };
    Object.assign(Session.prototype, {
      sendReady: function (subscriptionIds) {
        var self = this;
        if (self._isSending) {
          self.send({
            msg: "ready",
            subs: subscriptionIds
          });
        } else {
          _.each(subscriptionIds, function (subscriptionId) {
            self._pendingReady.push(subscriptionId);
          });
        }
      },
      _canSend(collectionName) {
        return this._isSending || !this.server.getPublicationStrategy(collectionName).useCollectionView;
      },
      sendAdded(collectionName, id, fields) {
        if (this._canSend(collectionName)) {
          this.send({
            msg: 'added',
            collection: collectionName,
            id,
            fields
          });
        }
      },
      sendChanged(collectionName, id, fields) {
        if (_.isEmpty(fields)) return;
        if (this._canSend(collectionName)) {
          this.send({
            msg: "changed",
            collection: collectionName,
            id,
            fields
          });
        }
      },
      sendRemoved(collectionName, id) {
        if (this._canSend(collectionName)) {
          this.send({
            msg: "removed",
            collection: collectionName,
            id
          });
        }
      },
      getSendCallbacks: function () {
        var self = this;
        return {
          added: _.bind(self.sendAdded, self),
          changed: _.bind(self.sendChanged, self),
          removed: _.bind(self.sendRemoved, self)
        };
      },
      getCollectionView: function (collectionName) {
        var self = this;
        var ret = self.collectionViews.get(collectionName);
        if (!ret) {
          ret = new SessionCollectionView(collectionName, self.getSendCallbacks());
          self.collectionViews.set(collectionName, ret);
        }
        return ret;
      },
      added(subscriptionHandle, collectionName, id, fields) {
        if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
          const view = this.getCollectionView(collectionName);
          view.added(subscriptionHandle, id, fields);
        } else {
          this.sendAdded(collectionName, id, fields);
        }
      },
      removed(subscriptionHandle, collectionName, id) {
        if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
          const view = this.getCollectionView(collectionName);
          view.removed(subscriptionHandle, id);
          if (view.isEmpty()) {
            this.collectionViews.delete(collectionName);
          }
        } else {
          this.sendRemoved(collectionName, id);
        }
      },
      changed(subscriptionHandle, collectionName, id, fields) {
        if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
          const view = this.getCollectionView(collectionName);
          view.changed(subscriptionHandle, id, fields);
        } else {
          this.sendChanged(collectionName, id, fields);
        }
      },
      startUniversalSubs: function () {
        var self = this;
        // Make a shallow copy of the set of universal handlers and start them. If
        // additional universal publishers start while we're running them (due to
        // yielding), they will run separately as part of Server.publish.
        var handlers = _.clone(self.server.universal_publish_handlers);
        _.each(handlers, function (handler) {
          self._startSubscription(handler);
        });
      },
      // Destroy this session and unregister it at the server.
      close: function () {
        var self = this;

        // Destroy this session, even if it's not registered at the
        // server. Stop all processing and tear everything down. If a socket
        // was attached, close it.

        // Already destroyed.
        if (!self.inQueue) return;

        // Drop the merge box data immediately.
        self.inQueue = null;
        self.collectionViews = new Map();
        if (self.heartbeat) {
          self.heartbeat.stop();
          self.heartbeat = null;
        }
        if (self.socket) {
          self.socket.close();
          self.socket._meteorSession = null;
        }
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "sessions", -1);
        Meteor.defer(function () {
          // Stop callbacks can yield, so we defer this on close.
          // sub._isDeactivated() detects that we set inQueue to null and
          // treats it as semi-deactivated (it will ignore incoming callbacks, etc).
          self._deactivateAllSubscriptions();

          // Defer calling the close callbacks, so that the caller closing
          // the session isn't waiting for all the callbacks to complete.
          _.each(self._closeCallbacks, function (callback) {
            callback();
          });
        });

        // Unregister the session.
        self.server._removeSession(self);
      },
      // Send a message (doing nothing if no socket is connected right now).
      // It should be a JSON object (it will be stringified).
      send: function (msg) {
        const self = this;
        if (self.socket) {
          if (Meteor._printSentDDP) Meteor._debug("Sent DDP", DDPCommon.stringifyDDP(msg));
          self.socket.send(DDPCommon.stringifyDDP(msg));
        }
      },
      // Send a connection error.
      sendError: function (reason, offendingMessage) {
        var self = this;
        var msg = {
          msg: 'error',
          reason: reason
        };
        if (offendingMessage) msg.offendingMessage = offendingMessage;
        self.send(msg);
      },
      // Process 'msg' as an incoming message. As a guard against
      // race conditions during reconnection, ignore the message if
      // 'socket' is not the currently connected socket.
      //
      // We run the messages from the client one at a time, in the order
      // given by the client. The message handler is passed an idempotent
      // function 'unblock' which it may call to allow other messages to
      // begin running in parallel in another fiber (for example, a method
      // that wants to yield). Otherwise, it is automatically unblocked
      // when it returns.
      //
      // Actually, we don't have to 'totally order' the messages in this
      // way, but it's the easiest thing that's correct. (unsub needs to
      // be ordered against sub, methods need to be ordered against each
      // other).
      processMessage: function (msg_in) {
        var self = this;
        if (!self.inQueue)
          // we have been destroyed.
          return;

        // Respond to ping and pong messages immediately without queuing.
        // If the negotiated DDP version is "pre1" which didn't support
        // pings, preserve the "pre1" behavior of responding with a "bad
        // request" for the unknown messages.
        //
        // Fibers are needed because heartbeats use Meteor.setTimeout, which
        // needs a Fiber. We could actually use regular setTimeout and avoid
        // these new fibers, but it is easier to just make everything use
        // Meteor.setTimeout and not think too hard.
        //
        // Any message counts as receiving a pong, as it demonstrates that
        // the client is still alive.
        if (self.heartbeat) {
          self.heartbeat.messageReceived();
        }
        ;
        if (self.version !== 'pre1' && msg_in.msg === 'ping') {
          if (self._respondToPings) self.send({
            msg: "pong",
            id: msg_in.id
          });
          return;
        }
        if (self.version !== 'pre1' && msg_in.msg === 'pong') {
          // Since everything is a pong, there is nothing to do
          return;
        }
        self.inQueue.push(msg_in);
        if (self.workerRunning) return;
        self.workerRunning = true;
        var processNext = function () {
          var msg = self.inQueue && self.inQueue.shift();
          if (!msg) {
            self.workerRunning = false;
            return;
          }
          function runHandlers() {
            var blocked = true;
            var unblock = function () {
              if (!blocked) return; // idempotent
              blocked = false;
              processNext();
            };
            self.server.onMessageHook.each(function (callback) {
              callback(msg, self);
              return true;
            });
            if (_.has(self.protocol_handlers, msg.msg)) {
              const result = self.protocol_handlers[msg.msg].call(self, msg, unblock);
              if (Meteor._isPromise(result)) {
                result.finally(() => unblock());
              } else {
                unblock();
              }
            } else {
              self.sendError('Bad request', msg);
              unblock(); // in case the handler didn't already do it
            }
          }
          runHandlers();
        };
        processNext();
      },
      protocol_handlers: {
        sub: async function (msg, unblock) {
          var self = this;

          // cacheUnblock temporarly, so we can capture it later
          // we will use unblock in current eventLoop, so this is safe
          self.cachedUnblock = unblock;

          // reject malformed messages
          if (typeof msg.id !== "string" || typeof msg.name !== "string" || 'params' in msg && !(msg.params instanceof Array)) {
            self.sendError("Malformed subscription", msg);
            return;
          }
          if (!self.server.publish_handlers[msg.name]) {
            self.send({
              msg: 'nosub',
              id: msg.id,
              error: new Meteor.Error(404, "Subscription '".concat(msg.name, "' not found"))
            });
            return;
          }
          if (self._namedSubs.has(msg.id))
            // subs are idempotent, or rather, they are ignored if a sub
            // with that id already exists. this is important during
            // reconnect.
            return;

          // XXX It'd be much better if we had generic hooks where any package can
          // hook into subscription handling, but in the mean while we special case
          // ddp-rate-limiter package. This is also done for weak requirements to
          // add the ddp-rate-limiter package in case we don't have Accounts. A
          // user trying to use the ddp-rate-limiter must explicitly require it.
          if (Package['ddp-rate-limiter']) {
            var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
            var rateLimiterInput = {
              userId: self.userId,
              clientAddress: self.connectionHandle.clientAddress,
              type: "subscription",
              name: msg.name,
              connectionId: self.id
            };
            DDPRateLimiter._increment(rateLimiterInput);
            var rateLimitResult = DDPRateLimiter._check(rateLimiterInput);
            if (!rateLimitResult.allowed) {
              self.send({
                msg: 'nosub',
                id: msg.id,
                error: new Meteor.Error('too-many-requests', DDPRateLimiter.getErrorMessage(rateLimitResult), {
                  timeToReset: rateLimitResult.timeToReset
                })
              });
              return;
            }
          }
          var handler = self.server.publish_handlers[msg.name];
          await self._startSubscription(handler, msg.id, msg.params, msg.name);

          // cleaning cached unblock
          self.cachedUnblock = null;
        },
        unsub: function (msg) {
          var self = this;
          self._stopSubscription(msg.id);
        },
        method: async function (msg, unblock) {
          var self = this;

          // Reject malformed messages.
          // For now, we silently ignore unknown attributes,
          // for forwards compatibility.
          if (typeof msg.id !== "string" || typeof msg.method !== "string" || 'params' in msg && !(msg.params instanceof Array) || 'randomSeed' in msg && typeof msg.randomSeed !== "string") {
            self.sendError("Malformed method invocation", msg);
            return;
          }
          var randomSeed = msg.randomSeed || null;

          // Set up to mark the method as satisfied once all observers
          // (and subscriptions) have reacted to any writes that were
          // done.
          var fence = new DDPServer._WriteFence();
          fence.onAllCommitted(function () {
            // Retire the fence so that future writes are allowed.
            // This means that callbacks like timers are free to use
            // the fence, and if they fire before it's armed (for
            // example, because the method waits for them) their
            // writes will be included in the fence.
            fence.retire();
            self.send({
              msg: 'updated',
              methods: [msg.id]
            });
          });

          // Find the handler
          var handler = self.server.method_handlers[msg.method];
          if (!handler) {
            self.send({
              msg: 'result',
              id: msg.id,
              error: new Meteor.Error(404, "Method '".concat(msg.method, "' not found"))
            });
            await fence.arm();
            return;
          }
          var invocation = new DDPCommon.MethodInvocation({
            name: msg.method,
            isSimulation: false,
            userId: self.userId,
            setUserId(userId) {
              return self._setUserId(userId);
            },
            unblock: unblock,
            connection: self.connectionHandle,
            randomSeed: randomSeed,
            fence
          });
          const promise = new Promise((resolve, reject) => {
            // XXX It'd be better if we could hook into method handlers better but
            // for now, we need to check if the ddp-rate-limiter exists since we
            // have a weak requirement for the ddp-rate-limiter package to be added
            // to our application.
            if (Package['ddp-rate-limiter']) {
              var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
              var rateLimiterInput = {
                userId: self.userId,
                clientAddress: self.connectionHandle.clientAddress,
                type: "method",
                name: msg.method,
                connectionId: self.id
              };
              DDPRateLimiter._increment(rateLimiterInput);
              var rateLimitResult = DDPRateLimiter._check(rateLimiterInput);
              if (!rateLimitResult.allowed) {
                reject(new Meteor.Error("too-many-requests", DDPRateLimiter.getErrorMessage(rateLimitResult), {
                  timeToReset: rateLimitResult.timeToReset
                }));
                return;
              }
            }
            const getCurrentMethodInvocationResult = () => DDP._CurrentMethodInvocation.withValue(invocation, () => maybeAuditArgumentChecks(handler, invocation, msg.params, "call to '" + msg.method + "'"), {
              name: 'getCurrentMethodInvocationResult',
              keyName: 'getCurrentMethodInvocationResult'
            });
            resolve(DDPServer._CurrentWriteFence.withValue(fence, getCurrentMethodInvocationResult, {
              name: 'DDPServer._CurrentWriteFence',
              keyName: '_CurrentWriteFence'
            }));
          });
          async function finish() {
            await fence.arm();
            unblock();
          }
          const payload = {
            msg: "result",
            id: msg.id
          };
          return promise.then(async result => {
            await finish();
            if (result !== undefined) {
              payload.result = result;
            }
            self.send(payload);
          }, async exception => {
            await finish();
            payload.error = wrapInternalException(exception, "while invoking method '".concat(msg.method, "'"));
            self.send(payload);
          });
        }
      },
      _eachSub: function (f) {
        var self = this;
        self._namedSubs.forEach(f);
        self._universalSubs.forEach(f);
      },
      _diffCollectionViews: function (beforeCVs) {
        var self = this;
        DiffSequence.diffMaps(beforeCVs, self.collectionViews, {
          both: function (collectionName, leftValue, rightValue) {
            rightValue.diff(leftValue);
          },
          rightOnly: function (collectionName, rightValue) {
            rightValue.documents.forEach(function (docView, id) {
              self.sendAdded(collectionName, id, docView.getFields());
            });
          },
          leftOnly: function (collectionName, leftValue) {
            leftValue.documents.forEach(function (doc, id) {
              self.sendRemoved(collectionName, id);
            });
          }
        });
      },
      // Sets the current user id in all appropriate contexts and reruns
      // all subscriptions
      async _setUserId(userId) {
        var self = this;
        if (userId !== null && typeof userId !== "string") throw new Error("setUserId must be called on string or null, not " + typeof userId);

        // Prevent newly-created universal subscriptions from being added to our
        // session. They will be found below when we call startUniversalSubs.
        //
        // (We don't have to worry about named subscriptions, because we only add
        // them when we process a 'sub' message. We are currently processing a
        // 'method' message, and the method did not unblock, because it is illegal
        // to call setUserId after unblock. Thus we cannot be concurrently adding a
        // new named subscription).
        self._dontStartNewUniversalSubs = true;

        // Prevent current subs from updating our collectionViews and call their
        // stop callbacks. This may yield.
        self._eachSub(function (sub) {
          sub._deactivate();
        });

        // All subs should now be deactivated. Stop sending messages to the client,
        // save the state of the published collections, reset to an empty view, and
        // update the userId.
        self._isSending = false;
        var beforeCVs = self.collectionViews;
        self.collectionViews = new Map();
        self.userId = userId;

        // _setUserId is normally called from a Meteor method with
        // DDP._CurrentMethodInvocation set. But DDP._CurrentMethodInvocation is not
        // expected to be set inside a publish function, so we temporary unset it.
        // Inside a publish function DDP._CurrentPublicationInvocation is set.
        await DDP._CurrentMethodInvocation.withValue(undefined, async function () {
          // Save the old named subs, and reset to having no subscriptions.
          var oldNamedSubs = self._namedSubs;
          self._namedSubs = new Map();
          self._universalSubs = [];
          await Promise.all([...oldNamedSubs].map(async _ref => {
            let [subscriptionId, sub] = _ref;
            const newSub = sub._recreate();
            self._namedSubs.set(subscriptionId, newSub);
            // nb: if the handler throws or calls this.error(), it will in fact
            // immediately send its 'nosub'. This is OK, though.
            await newSub._runHandler();
          }));

          // Allow newly-created universal subs to be started on our connection in
          // parallel with the ones we're spinning up here, and spin up universal
          // subs.
          self._dontStartNewUniversalSubs = false;
          self.startUniversalSubs();
        }, {
          name: '_setUserId'
        });

        // Start sending messages again, beginning with the diff from the previous
        // state of the world to the current state. No yields are allowed during
        // this diff, so that other changes cannot interleave.
        Meteor._noYieldsAllowed(function () {
          self._isSending = true;
          self._diffCollectionViews(beforeCVs);
          if (!_.isEmpty(self._pendingReady)) {
            self.sendReady(self._pendingReady);
            self._pendingReady = [];
          }
        });
      },
      _startSubscription: function (handler, subId, params, name) {
        var self = this;
        var sub = new Subscription(self, handler, subId, params, name);
        let unblockHander = self.cachedUnblock;
        // _startSubscription may call from a lot places
        // so cachedUnblock might be null in somecases
        // assign the cachedUnblock
        sub.unblock = unblockHander || (() => {});
        if (subId) self._namedSubs.set(subId, sub);else self._universalSubs.push(sub);
        return sub._runHandler();
      },
      // Tear down specified subscription
      _stopSubscription: function (subId, error) {
        var self = this;
        var subName = null;
        if (subId) {
          var maybeSub = self._namedSubs.get(subId);
          if (maybeSub) {
            subName = maybeSub._name;
            maybeSub._removeAllDocuments();
            maybeSub._deactivate();
            self._namedSubs.delete(subId);
          }
        }
        var response = {
          msg: 'nosub',
          id: subId
        };
        if (error) {
          response.error = wrapInternalException(error, subName ? "from sub " + subName + " id " + subId : "from sub id " + subId);
        }
        self.send(response);
      },
      // Tear down all subscriptions. Note that this does NOT send removed or nosub
      // messages, since we assume the client is gone.
      _deactivateAllSubscriptions: function () {
        var self = this;
        self._namedSubs.forEach(function (sub, id) {
          sub._deactivate();
        });
        self._namedSubs = new Map();
        self._universalSubs.forEach(function (sub) {
          sub._deactivate();
        });
        self._universalSubs = [];
      },
      // Determine the remote client's IP address, based on the
      // HTTP_FORWARDED_COUNT environment variable representing how many
      // proxies the server is behind.
      _clientAddress: function () {
        var self = this;

        // For the reported client address for a connection to be correct,
        // the developer must set the HTTP_FORWARDED_COUNT environment
        // variable to an integer representing the number of hops they
        // expect in the `x-forwarded-for` header. E.g., set to "1" if the
        // server is behind one proxy.
        //
        // This could be computed once at startup instead of every time.
        var httpForwardedCount = parseInt(process.env['HTTP_FORWARDED_COUNT']) || 0;
        if (httpForwardedCount === 0) return self.socket.remoteAddress;
        var forwardedFor = self.socket.headers["x-forwarded-for"];
        if (!_.isString(forwardedFor)) return null;
        forwardedFor = forwardedFor.trim().split(/\s*,\s*/);

        // Typically the first value in the `x-forwarded-for` header is
        // the original IP address of the client connecting to the first
        // proxy.  However, the end user can easily spoof the header, in
        // which case the first value(s) will be the fake IP address from
        // the user pretending to be a proxy reporting the original IP
        // address value.  By counting HTTP_FORWARDED_COUNT back from the
        // end of the list, we ensure that we get the IP address being
        // reported by *our* first proxy.

        if (httpForwardedCount < 0 || httpForwardedCount > forwardedFor.length) return null;
        return forwardedFor[forwardedFor.length - httpForwardedCount];
      }
    });

    /******************************************************************************/
    /* Subscription                                                               */
    /******************************************************************************/

    // Ctor for a sub handle: the input to each publish function

    // Instance name is this because it's usually referred to as this inside a
    // publish
    /**
     * @summary The server's side of a subscription
     * @class Subscription
     * @instanceName this
     * @showInstanceName true
     */
    var Subscription = function (session, handler, subscriptionId, params, name) {
      var self = this;
      self._session = session; // type is Session

      /**
       * @summary Access inside the publish function. The incoming [connection](#meteor_onconnection) for this subscription.
       * @locus Server
       * @name  connection
       * @memberOf Subscription
       * @instance
       */
      self.connection = session.connectionHandle; // public API object

      self._handler = handler;

      // My subscription ID (generated by client, undefined for universal subs).
      self._subscriptionId = subscriptionId;
      // Undefined for universal subs
      self._name = name;
      self._params = params || [];

      // Only named subscriptions have IDs, but we need some sort of string
      // internally to keep track of all subscriptions inside
      // SessionDocumentViews. We use this subscriptionHandle for that.
      if (self._subscriptionId) {
        self._subscriptionHandle = 'N' + self._subscriptionId;
      } else {
        self._subscriptionHandle = 'U' + Random.id();
      }

      // Has _deactivate been called?
      self._deactivated = false;

      // Stop callbacks to g/c this sub.  called w/ zero arguments.
      self._stopCallbacks = [];

      // The set of (collection, documentid) that this subscription has
      // an opinion about.
      self._documents = new Map();

      // Remember if we are ready.
      self._ready = false;

      // Part of the public API: the user of this sub.

      /**
       * @summary Access inside the publish function. The id of the logged-in user, or `null` if no user is logged in.
       * @locus Server
       * @memberOf Subscription
       * @name  userId
       * @instance
       */
      self.userId = session.userId;

      // For now, the id filter is going to default to
      // the to/from DDP methods on MongoID, to
      // specifically deal with mongo/minimongo ObjectIds.

      // Later, you will be able to make this be "raw"
      // if you want to publish a collection that you know
      // just has strings for keys and no funny business, to
      // a DDP consumer that isn't minimongo.

      self._idFilter = {
        idStringify: MongoID.idStringify,
        idParse: MongoID.idParse
      };
      Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "subscriptions", 1);
    };
    Object.assign(Subscription.prototype, {
      _runHandler: async function () {
        // XXX should we unblock() here? Either before running the publish
        // function, or before running _publishCursor.
        //
        // Right now, each publish function blocks all future publishes and
        // methods waiting on data from Mongo (or whatever else the function
        // blocks on). This probably slows page load in common cases.

        if (!this.unblock) {
          this.unblock = () => {};
        }
        const self = this;
        let resultOrThenable = null;
        try {
          resultOrThenable = DDP._CurrentPublicationInvocation.withValue(self, () => maybeAuditArgumentChecks(self._handler, self, EJSON.clone(self._params),
          // It's OK that this would look weird for universal subscriptions,
          // because they have no arguments so there can never be an
          // audit-argument-checks failure.
          "publisher '" + self._name + "'"), {
            name: self._name
          });
        } catch (e) {
          self.error(e);
          return;
        }

        // Did the handler call this.error or this.stop?
        if (self._isDeactivated()) return;

        // Both conventional and async publish handler functions are supported.
        // If an object is returned with a then() function, it is either a promise
        // or thenable and will be resolved asynchronously.
        const isThenable = resultOrThenable && typeof resultOrThenable.then === 'function';
        if (isThenable) {
          try {
            await self._publishHandlerResult(await resultOrThenable);
          } catch (e) {
            self.error(e);
          }
        } else {
          await self._publishHandlerResult(resultOrThenable);
        }
      },
      async _publishHandlerResult(res) {
        // SPECIAL CASE: Instead of writing their own callbacks that invoke
        // this.added/changed/ready/etc, the user can just return a collection
        // cursor or array of cursors from the publish function; we call their
        // _publishCursor method which starts observing the cursor and publishes the
        // results. Note that _publishCursor does NOT call ready().
        //
        // XXX This uses an undocumented interface which only the Mongo cursor
        // interface publishes. Should we make this interface public and encourage
        // users to implement it themselves? Arguably, it's unnecessary; users can
        // already write their own functions like
        //   var publishMyReactiveThingy = function (name, handler) {
        //     Meteor.publish(name, function () {
        //       var reactiveThingy = handler();
        //       reactiveThingy.publishMe();
        //     });
        //   };

        var self = this;
        var isCursor = function (c) {
          return c && c._publishCursor;
        };
        if (isCursor(res)) {
          try {
            await res._publishCursor(self);
          } catch (e) {
            self.error(e);
            return;
          }
          // _publishCursor only returns after the initial added callbacks have run.
          // mark subscription as ready.
          self.ready();
        } else if (_.isArray(res)) {
          // Check all the elements are cursors
          if (!_.all(res, isCursor)) {
            self.error(new Error("Publish function returned an array of non-Cursors"));
            return;
          }
          // Find duplicate collection names
          // XXX we should support overlapping cursors, but that would require the
          // merge box to allow overlap within a subscription
          var collectionNames = {};
          for (var i = 0; i < res.length; ++i) {
            var collectionName = res[i]._getCollectionName();
            if (_.has(collectionNames, collectionName)) {
              self.error(new Error("Publish function returned multiple cursors for collection " + collectionName));
              return;
            }
            collectionNames[collectionName] = true;
          }
          try {
            await Promise.all(res.map(cur => cur._publishCursor(self)));
          } catch (e) {
            self.error(e);
            return;
          }
          self.ready();
        } else if (res) {
          // Truthy values other than cursors or arrays are probably a
          // user mistake (possible returning a Mongo document via, say,
          // `coll.findOne()`).
          self.error(new Error("Publish function can only return a Cursor or " + "an array of Cursors"));
        }
      },
      // This calls all stop callbacks and prevents the handler from updating any
      // SessionCollectionViews further. It's used when the user unsubscribes or
      // disconnects, as well as during setUserId re-runs. It does *NOT* send
      // removed messages for the published objects; if that is necessary, call
      // _removeAllDocuments first.
      _deactivate: function () {
        var self = this;
        if (self._deactivated) return;
        self._deactivated = true;
        self._callStopCallbacks();
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "subscriptions", -1);
      },
      _callStopCallbacks: function () {
        var self = this;
        // Tell listeners, so they can clean up
        var callbacks = self._stopCallbacks;
        self._stopCallbacks = [];
        _.each(callbacks, function (callback) {
          callback();
        });
      },
      // Send remove messages for every document.
      _removeAllDocuments: function () {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._documents.forEach(function (collectionDocs, collectionName) {
            collectionDocs.forEach(function (strId) {
              self.removed(collectionName, self._idFilter.idParse(strId));
            });
          });
        });
      },
      // Returns a new Subscription for the same session with the same
      // initial creation parameters. This isn't a clone: it doesn't have
      // the same _documents cache, stopped state or callbacks; may have a
      // different _subscriptionHandle, and gets its userId from the
      // session, not from this object.
      _recreate: function () {
        var self = this;
        return new Subscription(self._session, self._handler, self._subscriptionId, self._params, self._name);
      },
      /**
       * @summary Call inside the publish function.  Stops this client's subscription, triggering a call on the client to the `onStop` callback passed to [`Meteor.subscribe`](#meteor_subscribe), if any. If `error` is not a [`Meteor.Error`](#meteor_error), it will be [sanitized](#meteor_error).
       * @locus Server
       * @param {Error} error The error to pass to the client.
       * @instance
       * @memberOf Subscription
       */
      error: function (error) {
        var self = this;
        if (self._isDeactivated()) return;
        self._session._stopSubscription(self._subscriptionId, error);
      },
      // Note that while our DDP client will notice that you've called stop() on the
      // server (and clean up its _subscriptions table) we don't actually provide a
      // mechanism for an app to notice this (the subscribe onError callback only
      // triggers if there is an error).

      /**
       * @summary Call inside the publish function.  Stops this client's subscription and invokes the client's `onStop` callback with no error.
       * @locus Server
       * @instance
       * @memberOf Subscription
       */
      stop: function () {
        var self = this;
        if (self._isDeactivated()) return;
        self._session._stopSubscription(self._subscriptionId);
      },
      /**
       * @summary Call inside the publish function.  Registers a callback function to run when the subscription is stopped.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {Function} func The callback function
       */
      onStop: function (callback) {
        var self = this;
        callback = Meteor.bindEnvironment(callback, 'onStop callback', self);
        if (self._isDeactivated()) callback();else self._stopCallbacks.push(callback);
      },
      // This returns true if the sub has been deactivated, *OR* if the session was
      // destroyed but the deferred call to _deactivateAllSubscriptions hasn't
      // happened yet.
      _isDeactivated: function () {
        var self = this;
        return self._deactivated || self._session.inQueue === null;
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that a document has been added to the record set.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {String} collection The name of the collection that contains the new document.
       * @param {String} id The new document's ID.
       * @param {Object} fields The fields in the new document.  If `_id` is present it is ignored.
       */
      added(collectionName, id, fields) {
        if (this._isDeactivated()) return;
        id = this._idFilter.idStringify(id);
        if (this._session.server.getPublicationStrategy(collectionName).doAccountingForCollection) {
          let ids = this._documents.get(collectionName);
          if (ids == null) {
            ids = new Set();
            this._documents.set(collectionName, ids);
          }
          ids.add(id);
        }
        this._session.added(this._subscriptionHandle, collectionName, id, fields);
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that a document in the record set has been modified.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {String} collection The name of the collection that contains the changed document.
       * @param {String} id The changed document's ID.
       * @param {Object} fields The fields in the document that have changed, together with their new values.  If a field is not present in `fields` it was left unchanged; if it is present in `fields` and has a value of `undefined` it was removed from the document.  If `_id` is present it is ignored.
       */
      changed(collectionName, id, fields) {
        if (this._isDeactivated()) return;
        id = this._idFilter.idStringify(id);
        this._session.changed(this._subscriptionHandle, collectionName, id, fields);
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that a document has been removed from the record set.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {String} collection The name of the collection that the document has been removed from.
       * @param {String} id The ID of the document that has been removed.
       */
      removed(collectionName, id) {
        if (this._isDeactivated()) return;
        id = this._idFilter.idStringify(id);
        if (this._session.server.getPublicationStrategy(collectionName).doAccountingForCollection) {
          // We don't bother to delete sets of things in a collection if the
          // collection is empty.  It could break _removeAllDocuments.
          this._documents.get(collectionName).delete(id);
        }
        this._session.removed(this._subscriptionHandle, collectionName, id);
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that an initial, complete snapshot of the record set has been sent.  This will trigger a call on the client to the `onReady` callback passed to  [`Meteor.subscribe`](#meteor_subscribe), if any.
       * @locus Server
       * @memberOf Subscription
       * @instance
       */
      ready: function () {
        var self = this;
        if (self._isDeactivated()) return;
        if (!self._subscriptionId) return; // Unnecessary but ignored for universal sub
        if (!self._ready) {
          self._session.sendReady([self._subscriptionId]);
          self._ready = true;
        }
      }
    });

    /******************************************************************************/
    /* Server                                                                     */
    /******************************************************************************/

    Server = function () {
      let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var self = this;

      // The default heartbeat interval is 30 seconds on the server and 35
      // seconds on the client.  Since the client doesn't need to send a
      // ping as long as it is receiving pings, this means that pings
      // normally go from the server to the client.
      //
      // Note: Troposphere depends on the ability to mutate
      // Meteor.server.options.heartbeatTimeout! This is a hack, but it's life.
      self.options = _objectSpread({
        heartbeatInterval: 15000,
        heartbeatTimeout: 15000,
        // For testing, allow responding to pings to be disabled.
        respondToPings: true,
        defaultPublicationStrategy: publicationStrategies.SERVER_MERGE
      }, options);

      // Map of callbacks to call when a new connection comes in to the
      // server and completes DDP version negotiation. Use an object instead
      // of an array so we can safely remove one from the list while
      // iterating over it.
      self.onConnectionHook = new Hook({
        debugPrintExceptions: "onConnection callback"
      });

      // Map of callbacks to call when a new message comes in.
      self.onMessageHook = new Hook({
        debugPrintExceptions: "onMessage callback"
      });
      self.publish_handlers = {};
      self.universal_publish_handlers = [];
      self.method_handlers = {};
      self._publicationStrategies = {};
      self.sessions = new Map(); // map from id to session

      self.stream_server = new StreamServer();
      self.stream_server.register(function (socket) {
        // socket implements the SockJSConnection interface
        socket._meteorSession = null;
        var sendError = function (reason, offendingMessage) {
          var msg = {
            msg: 'error',
            reason: reason
          };
          if (offendingMessage) msg.offendingMessage = offendingMessage;
          socket.send(DDPCommon.stringifyDDP(msg));
        };
        socket.on('data', function (raw_msg) {
          if (Meteor._printReceivedDDP) {
            Meteor._debug("Received DDP", raw_msg);
          }
          try {
            try {
              var msg = DDPCommon.parseDDP(raw_msg);
            } catch (err) {
              sendError('Parse error');
              return;
            }
            if (msg === null || !msg.msg) {
              sendError('Bad request', msg);
              return;
            }
            if (msg.msg === 'connect') {
              if (socket._meteorSession) {
                sendError("Already connected", msg);
                return;
              }
              self._handleConnect(socket, msg);
              return;
            }
            if (!socket._meteorSession) {
              sendError('Must connect first', msg);
              return;
            }
            socket._meteorSession.processMessage(msg);
          } catch (e) {
            // XXX print stack nicely
            Meteor._debug("Internal exception while processing message", msg, e);
          }
        });
        socket.on('close', function () {
          if (socket._meteorSession) {
            socket._meteorSession.close();
          }
        });
      });
    };
    Object.assign(Server.prototype, {
      /**
       * @summary Register a callback to be called when a new DDP connection is made to the server.
       * @locus Server
       * @param {function} callback The function to call when a new DDP connection is established.
       * @memberOf Meteor
       * @importFromPackage meteor
       */
      onConnection: function (fn) {
        var self = this;
        return self.onConnectionHook.register(fn);
      },
      /**
       * @summary Set publication strategy for the given collection. Publications strategies are available from `DDPServer.publicationStrategies`. You call this method from `Meteor.server`, like `Meteor.server.setPublicationStrategy()`
       * @locus Server
       * @alias setPublicationStrategy
       * @param collectionName {String}
       * @param strategy {{useCollectionView: boolean, doAccountingForCollection: boolean}}
       * @memberOf Meteor.server
       * @importFromPackage meteor
       */
      setPublicationStrategy(collectionName, strategy) {
        if (!Object.values(publicationStrategies).includes(strategy)) {
          throw new Error("Invalid merge strategy: ".concat(strategy, " \n        for collection ").concat(collectionName));
        }
        this._publicationStrategies[collectionName] = strategy;
      },
      /**
       * @summary Gets the publication strategy for the requested collection. You call this method from `Meteor.server`, like `Meteor.server.getPublicationStrategy()`
       * @locus Server
       * @alias getPublicationStrategy
       * @param collectionName {String}
       * @memberOf Meteor.server
       * @importFromPackage meteor
       * @return {{useCollectionView: boolean, doAccountingForCollection: boolean}}
       */
      getPublicationStrategy(collectionName) {
        return this._publicationStrategies[collectionName] || this.options.defaultPublicationStrategy;
      },
      /**
       * @summary Register a callback to be called when a new DDP message is received.
       * @locus Server
       * @param {function} callback The function to call when a new DDP message is received.
       * @memberOf Meteor
       * @importFromPackage meteor
       */
      onMessage: function (fn) {
        var self = this;
        return self.onMessageHook.register(fn);
      },
      _handleConnect: function (socket, msg) {
        var self = this;

        // The connect message must specify a version and an array of supported
        // versions, and it must claim to support what it is proposing.
        if (!(typeof msg.version === 'string' && _.isArray(msg.support) && _.all(msg.support, _.isString) && _.contains(msg.support, msg.version))) {
          socket.send(DDPCommon.stringifyDDP({
            msg: 'failed',
            version: DDPCommon.SUPPORTED_DDP_VERSIONS[0]
          }));
          socket.close();
          return;
        }

        // In the future, handle session resumption: something like:
        //  socket._meteorSession = self.sessions[msg.session]
        var version = calculateVersion(msg.support, DDPCommon.SUPPORTED_DDP_VERSIONS);
        if (msg.version !== version) {
          // The best version to use (according to the client's stated preferences)
          // is not the one the client is trying to use. Inform them about the best
          // version to use.
          socket.send(DDPCommon.stringifyDDP({
            msg: 'failed',
            version: version
          }));
          socket.close();
          return;
        }

        // Yay, version matches! Create a new session.
        // Note: Troposphere depends on the ability to mutate
        // Meteor.server.options.heartbeatTimeout! This is a hack, but it's life.
        socket._meteorSession = new Session(self, version, socket, self.options);
        self.sessions.set(socket._meteorSession.id, socket._meteorSession);
        self.onConnectionHook.each(function (callback) {
          if (socket._meteorSession) callback(socket._meteorSession.connectionHandle);
          return true;
        });
      },
      /**
       * Register a publish handler function.
       *
       * @param name {String} identifier for query
       * @param handler {Function} publish handler
       * @param options {Object}
       *
       * Server will call handler function on each new subscription,
       * either when receiving DDP sub message for a named subscription, or on
       * DDP connect for a universal subscription.
       *
       * If name is null, this will be a subscription that is
       * automatically established and permanently on for all connected
       * client, instead of a subscription that can be turned on and off
       * with subscribe().
       *
       * options to contain:
       *  - (mostly internal) is_auto: true if generated automatically
       *    from an autopublish hook. this is for cosmetic purposes only
       *    (it lets us determine whether to print a warning suggesting
       *    that you turn off autopublish).
       */

      /**
       * @summary Publish a record set.
       * @memberOf Meteor
       * @importFromPackage meteor
       * @locus Server
       * @param {String|Object} name If String, name of the record set.  If Object, publications Dictionary of publish functions by name.  If `null`, the set has no name, and the record set is automatically sent to all connected clients.
       * @param {Function} func Function called on the server each time a client subscribes.  Inside the function, `this` is the publish handler object, described below.  If the client passed arguments to `subscribe`, the function is called with the same arguments.
       */
      publish: function (name, handler, options) {
        var self = this;
        if (!_.isObject(name)) {
          options = options || {};
          if (name && name in self.publish_handlers) {
            Meteor._debug("Ignoring duplicate publish named '" + name + "'");
            return;
          }
          if (Package.autopublish && !options.is_auto) {
            // They have autopublish on, yet they're trying to manually
            // pick stuff to publish. They probably should turn off
            // autopublish. (This check isn't perfect -- if you create a
            // publish before you turn on autopublish, it won't catch
            // it, but this will definitely handle the simple case where
            // you've added the autopublish package to your app, and are
            // calling publish from your app code).
            if (!self.warned_about_autopublish) {
              self.warned_about_autopublish = true;
              Meteor._debug("** You've set up some data subscriptions with Meteor.publish(), but\n" + "** you still have autopublish turned on. Because autopublish is still\n" + "** on, your Meteor.publish() calls won't have much effect. All data\n" + "** will still be sent to all clients.\n" + "**\n" + "** Turn off autopublish by removing the autopublish package:\n" + "**\n" + "**   $ meteor remove autopublish\n" + "**\n" + "** .. and make sure you have Meteor.publish() and Meteor.subscribe() calls\n" + "** for each collection that you want clients to see.\n");
            }
          }
          if (name) self.publish_handlers[name] = handler;else {
            self.universal_publish_handlers.push(handler);
            // Spin up the new publisher on any existing session too. Run each
            // session's subscription in a new Fiber, so that there's no change for
            // self.sessions to change while we're running this loop.
            self.sessions.forEach(function (session) {
              if (!session._dontStartNewUniversalSubs) {
                session._startSubscription(handler);
              }
            });
          }
        } else {
          _.each(name, function (value, key) {
            self.publish(key, value, {});
          });
        }
      },
      _removeSession: function (session) {
        var self = this;
        self.sessions.delete(session.id);
      },
      /**
       * @summary Tells if the method call came from a call or a callAsync.
       * @locus Anywhere
       * @memberOf Meteor
       * @importFromPackage meteor
       * @returns boolean
       */
      isAsyncCall: function () {
        return DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
      },
      /**
       * @summary Defines functions that can be invoked over the network by clients.
       * @locus Anywhere
       * @param {Object} methods Dictionary whose keys are method names and values are functions.
       * @memberOf Meteor
       * @importFromPackage meteor
       */
      methods: function (methods) {
        var self = this;
        _.each(methods, function (func, name) {
          if (typeof func !== 'function') throw new Error("Method '" + name + "' must be a function");
          if (self.method_handlers[name]) throw new Error("A method named '" + name + "' is already defined");
          self.method_handlers[name] = func;
        });
      },
      call: function (name) {
        for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }
        if (args.length && typeof args[args.length - 1] === "function") {
          // If it's a function, the last argument is the result callback, not
          // a parameter to the remote method.
          var callback = args.pop();
        }
        return this.apply(name, args, callback);
      },
      // A version of the call method that always returns a Promise.
      callAsync: function (name) {
        var _args$;
        for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
          args[_key2 - 1] = arguments[_key2];
        }
        const options = (_args$ = args[0]) !== null && _args$ !== void 0 && _args$.hasOwnProperty('returnStubValue') ? args.shift() : {};
        DDP._CurrentMethodInvocation._set();
        DDP._CurrentMethodInvocation._setCallAsyncMethodRunning(true);
        const promise = new Promise((resolve, reject) => {
          DDP._CurrentCallAsyncInvocation._set({
            name,
            hasCallAsyncParent: true
          });
          this.applyAsync(name, args, _objectSpread({
            isFromCallAsync: true
          }, options)).then(resolve).catch(reject).finally(() => {
            DDP._CurrentCallAsyncInvocation._set();
          });
        });
        return promise.finally(() => DDP._CurrentMethodInvocation._setCallAsyncMethodRunning(false));
      },
      apply: function (name, args, options, callback) {
        // We were passed 3 arguments. They may be either (name, args, options)
        // or (name, args, callback)
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        } else {
          options = options || {};
        }
        const promise = this.applyAsync(name, args, options);

        // Return the result in whichever way the caller asked for it. Note that we
        // do NOT block on the write fence in an analogous way to how the client
        // blocks on the relevant data being visible, so you are NOT guaranteed that
        // cursor observe callbacks have fired when your callback is invoked. (We
        // can change this if there's a real use case).
        if (callback) {
          promise.then(result => callback(undefined, result), exception => callback(exception));
        } else {
          return promise;
        }
      },
      // @param options {Optional Object}
      applyAsync: function (name, args, options) {
        // Run the handler
        var handler = this.method_handlers[name];
        if (!handler) {
          return Promise.reject(new Meteor.Error(404, "Method '".concat(name, "' not found")));
        }
        // If this is a method call from within another method or publish function,
        // get the user state from the outer method or publish function, otherwise
        // don't allow setUserId to be called
        var userId = null;
        let setUserId = () => {
          throw new Error("Can't call setUserId on a server initiated method call");
        };
        var connection = null;
        var currentMethodInvocation = DDP._CurrentMethodInvocation.get();
        var currentPublicationInvocation = DDP._CurrentPublicationInvocation.get();
        var randomSeed = null;
        if (currentMethodInvocation) {
          userId = currentMethodInvocation.userId;
          setUserId = userId => currentMethodInvocation.setUserId(userId);
          connection = currentMethodInvocation.connection;
          randomSeed = DDPCommon.makeRpcSeed(currentMethodInvocation, name);
        } else if (currentPublicationInvocation) {
          userId = currentPublicationInvocation.userId;
          setUserId = userId => currentPublicationInvocation._session._setUserId(userId);
          connection = currentPublicationInvocation.connection;
        }
        var invocation = new DDPCommon.MethodInvocation({
          isSimulation: false,
          userId,
          setUserId,
          connection,
          randomSeed
        });
        return new Promise((resolve, reject) => {
          let result;
          try {
            result = DDP._CurrentMethodInvocation.withValue(invocation, () => maybeAuditArgumentChecks(handler, invocation, EJSON.clone(args), "internal call to '" + name + "'"));
          } catch (e) {
            return reject(e);
          }
          if (!Meteor._isPromise(result)) {
            return resolve(result);
          }
          result.then(r => resolve(r)).catch(reject);
        }).then(EJSON.clone);
      },
      _urlForSession: function (sessionId) {
        var self = this;
        var session = self.sessions.get(sessionId);
        if (session) return session._socketUrl;else return null;
      }
    });
    var calculateVersion = function (clientSupportedVersions, serverSupportedVersions) {
      var correctVersion = _.find(clientSupportedVersions, function (version) {
        return _.contains(serverSupportedVersions, version);
      });
      if (!correctVersion) {
        correctVersion = serverSupportedVersions[0];
      }
      return correctVersion;
    };
    DDPServer._calculateVersion = calculateVersion;

    // "blind" exceptions other than those that were deliberately thrown to signal
    // errors to the client
    var wrapInternalException = function (exception, context) {
      if (!exception) return exception;

      // To allow packages to throw errors intended for the client but not have to
      // depend on the Meteor.Error class, `isClientSafe` can be set to true on any
      // error before it is thrown.
      if (exception.isClientSafe) {
        if (!(exception instanceof Meteor.Error)) {
          const originalMessage = exception.message;
          exception = new Meteor.Error(exception.error, exception.reason, exception.details);
          exception.message = originalMessage;
        }
        return exception;
      }

      // Tests can set the '_expectedByTest' flag on an exception so it won't go to
      // the server log.
      if (!exception._expectedByTest) {
        Meteor._debug("Exception " + context, exception.stack);
        if (exception.sanitizedError) {
          Meteor._debug("Sanitized and reported to the client as:", exception.sanitizedError);
          Meteor._debug();
        }
      }

      // Did the error contain more details that could have been useful if caught in
      // server code (or if thrown from non-client-originated code), but also
      // provided a "sanitized" version with more context than 500 Internal server
      // error? Use that.
      if (exception.sanitizedError) {
        if (exception.sanitizedError.isClientSafe) return exception.sanitizedError;
        Meteor._debug("Exception " + context + " provides a sanitizedError that " + "does not have isClientSafe property set; ignoring");
      }
      return new Meteor.Error(500, "Internal server error");
    };

    // Audit argument checks, if the audit-argument-checks package exists (it is a
    // weak dependency of this package).
    var maybeAuditArgumentChecks = function (f, context, args, description) {
      args = args || [];
      if (Package['audit-argument-checks']) {
        return Match._failIfArgumentsAreNotAllChecked(f, context, args, description);
      }
      return f.apply(context, args);
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"writefence.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/writefence.js                                                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// A write fence collects a group of writes, and provides a callback
// when all of the writes are fully committed and propagated (all
// observers have been notified of the write and acknowledged it.)
//
DDPServer._WriteFence = class {
  constructor() {
    this.armed = false;
    this.fired = false;
    this.retired = false;
    this.outstanding_writes = 0;
    this.before_fire_callbacks = [];
    this.completion_callbacks = [];
  }

  // Start tracking a write, and return an object to represent it. The
  // object has a single method, committed(). This method should be
  // called when the write is fully committed and propagated. You can
  // continue to add writes to the WriteFence up until it is triggered
  // (calls its callbacks because all writes have committed.)
  beginWrite() {
    if (this.retired) return {
      committed: function () {}
    };
    if (this.fired) throw new Error("fence has already activated -- too late to add writes");
    this.outstanding_writes++;
    let committed = false;
    const _committedFn = async () => {
      if (committed) throw new Error("committed called twice on the same write");
      committed = true;
      this.outstanding_writes--;
      await this._maybeFire();
    };
    return {
      committed: _committedFn
    };
  }

  // Arm the fence. Once the fence is armed, and there are no more
  // uncommitted writes, it will activate.
  arm() {
    if (this === DDPServer._getCurrentFence()) throw Error("Can't arm the current fence");
    this.armed = true;
    return this._maybeFire();
  }

  // Register a function to be called once before firing the fence.
  // Callback function can add new writes to the fence, in which case
  // it won't fire until those writes are done as well.
  onBeforeFire(func) {
    if (this.fired) throw new Error("fence has already activated -- too late to " + "add a callback");
    this.before_fire_callbacks.push(func);
  }

  // Register a function to be called when the fence fires.
  onAllCommitted(func) {
    if (this.fired) throw new Error("fence has already activated -- too late to " + "add a callback");
    this.completion_callbacks.push(func);
  }
  async _armAndWait() {
    let resolver;
    const returnValue = new Promise(r => resolver = r);
    this.onAllCommitted(resolver);
    await this.arm();
    return returnValue;
  }
  // Convenience function. Arms the fence, then blocks until it fires.
  async armAndWait() {
    return this._armAndWait();
  }
  async _maybeFire() {
    if (this.fired) throw new Error("write fence already activated?");
    if (this.armed && !this.outstanding_writes) {
      const invokeCallback = async func => {
        try {
          await func(this);
        } catch (err) {
          Meteor._debug("exception in write fence callback:", err);
        }
      };
      this.outstanding_writes++;
      while (this.before_fire_callbacks.length > 0) {
        const cb = this.before_fire_callbacks.shift();
        await invokeCallback(cb);
      }
      this.outstanding_writes--;
      if (!this.outstanding_writes) {
        this.fired = true;
        const callbacks = this.completion_callbacks || [];
        this.completion_callbacks = [];
        while (callbacks.length > 0) {
          const cb = callbacks.shift();
          await invokeCallback(cb);
        }
      }
    }
  }

  // Deactivate this fence so that adding more writes has no effect.
  // The fence must have already fired.
  retire() {
    if (!this.fired) throw new Error("Can't retire a fence that hasn't fired.");
    this.retired = true;
  }
};

// The current write fence. When there is a current write fence, code
// that writes to databases should register their writes with it using
// beginWrite().
//
DDPServer._CurrentWriteFence = new Meteor.EnvironmentVariable();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"crossbar.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/crossbar.js                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// A "crossbar" is a class that provides structured notification registration.
// See _match for the definition of how a notification matches a trigger.
// All notifications and triggers must have a string key named 'collection'.

DDPServer._Crossbar = function (options) {
  var self = this;
  options = options || {};
  self.nextId = 1;
  // map from collection name (string) -> listener id -> object. each object has
  // keys 'trigger', 'callback'.  As a hack, the empty string means "no
  // collection".
  self.listenersByCollection = {};
  self.listenersByCollectionCount = {};
  self.factPackage = options.factPackage || "livedata";
  self.factName = options.factName || null;
};
_.extend(DDPServer._Crossbar.prototype, {
  // msg is a trigger or a notification
  _collectionForMessage: function (msg) {
    var self = this;
    if (!_.has(msg, 'collection')) {
      return '';
    } else if (typeof msg.collection === 'string') {
      if (msg.collection === '') throw Error("Message has empty collection!");
      return msg.collection;
    } else {
      throw Error("Message has non-string collection!");
    }
  },
  // Listen for notification that match 'trigger'. A notification
  // matches if it has the key-value pairs in trigger as a
  // subset. When a notification matches, call 'callback', passing
  // the actual notification.
  //
  // Returns a listen handle, which is an object with a method
  // stop(). Call stop() to stop listening.
  //
  // XXX It should be legal to call fire() from inside a listen()
  // callback?
  listen: function (trigger, callback) {
    var self = this;
    var id = self.nextId++;
    var collection = self._collectionForMessage(trigger);
    var record = {
      trigger: EJSON.clone(trigger),
      callback: callback
    };
    if (!_.has(self.listenersByCollection, collection)) {
      self.listenersByCollection[collection] = {};
      self.listenersByCollectionCount[collection] = 0;
    }
    self.listenersByCollection[collection][id] = record;
    self.listenersByCollectionCount[collection]++;
    if (self.factName && Package['facts-base']) {
      Package['facts-base'].Facts.incrementServerFact(self.factPackage, self.factName, 1);
    }
    return {
      stop: function () {
        if (self.factName && Package['facts-base']) {
          Package['facts-base'].Facts.incrementServerFact(self.factPackage, self.factName, -1);
        }
        delete self.listenersByCollection[collection][id];
        self.listenersByCollectionCount[collection]--;
        if (self.listenersByCollectionCount[collection] === 0) {
          delete self.listenersByCollection[collection];
          delete self.listenersByCollectionCount[collection];
        }
      }
    };
  },
  // Fire the provided 'notification' (an object whose attribute
  // values are all JSON-compatibile) -- inform all matching listeners
  // (registered with listen()).
  //
  // If fire() is called inside a write fence, then each of the
  // listener callbacks will be called inside the write fence as well.
  //
  // The listeners may be invoked in parallel, rather than serially.
  fire: async function (notification) {
    var self = this;
    var collection = self._collectionForMessage(notification);
    if (!_.has(self.listenersByCollection, collection)) {
      return;
    }
    var listenersForCollection = self.listenersByCollection[collection];
    var callbackIds = [];
    _.each(listenersForCollection, function (l, id) {
      if (self._matches(notification, l.trigger)) {
        callbackIds.push(id);
      }
    });

    // Listener callbacks can yield, so we need to first find all the ones that
    // match in a single iteration over self.listenersByCollection (which can't
    // be mutated during this iteration), and then invoke the matching
    // callbacks, checking before each call to ensure they haven't stopped.
    // Note that we don't have to check that
    // self.listenersByCollection[collection] still === listenersForCollection,
    // because the only way that stops being true is if listenersForCollection
    // first gets reduced down to the empty object (and then never gets
    // increased again).
    for (const id of callbackIds) {
      if (_.has(listenersForCollection, id)) {
        await listenersForCollection[id].callback(notification);
      }
    }
  },
  // A notification matches a trigger if all keys that exist in both are equal.
  //
  // Examples:
  //  N:{collection: "C"} matches T:{collection: "C"}
  //    (a non-targeted write to a collection matches a
  //     non-targeted query)
  //  N:{collection: "C", id: "X"} matches T:{collection: "C"}
  //    (a targeted write to a collection matches a non-targeted query)
  //  N:{collection: "C"} matches T:{collection: "C", id: "X"}
  //    (a non-targeted write to a collection matches a
  //     targeted query)
  //  N:{collection: "C", id: "X"} matches T:{collection: "C", id: "X"}
  //    (a targeted write to a collection matches a targeted query targeted
  //     at the same document)
  //  N:{collection: "C", id: "X"} does not match T:{collection: "C", id: "Y"}
  //    (a targeted write to a collection does not match a targeted query
  //     targeted at a different document)
  _matches: function (notification, trigger) {
    // Most notifications that use the crossbar have a string `collection` and
    // maybe an `id` that is a string or ObjectID. We're already dividing up
    // triggers by collection, but let's fast-track "nope, different ID" (and
    // avoid the overly generic EJSON.equals). This makes a noticeable
    // performance difference; see https://github.com/meteor/meteor/pull/3697
    if (typeof notification.id === 'string' && typeof trigger.id === 'string' && notification.id !== trigger.id) {
      return false;
    }
    if (notification.id instanceof MongoID.ObjectID && trigger.id instanceof MongoID.ObjectID && !notification.id.equals(trigger.id)) {
      return false;
    }
    return _.all(trigger, function (triggerValue, key) {
      return !_.has(notification, key) || EJSON.equals(triggerValue, notification[key]);
    });
  }
});

// The "invalidation crossbar" is a specific instance used by the DDP server to
// implement write fence notifications. Listener callbacks on this crossbar
// should call beginWrite on the current write fence before they return, if they
// want to delay the write fence from firing (ie, the DDP method-data-updated
// message from being sent).
DDPServer._InvalidationCrossbar = new DDPServer._Crossbar({
  factName: "invalidation-crossbar-listeners"
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"server_convenience.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/server_convenience.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
if (process.env.DDP_DEFAULT_CONNECTION_URL) {
  __meteor_runtime_config__.DDP_DEFAULT_CONNECTION_URL = process.env.DDP_DEFAULT_CONNECTION_URL;
}
Meteor.server = new Server();
Meteor.refresh = async function (notification) {
  await DDPServer._InvalidationCrossbar.fire(notification);
};

// Proxy the public methods of Meteor.server so they can
// be called directly on Meteor.
_.each(['publish', 'isAsyncCall', 'methods', 'call', 'callAsync', 'apply', 'applyAsync', 'onConnection', 'onMessage'], function (name) {
  Meteor[name] = _.bind(Meteor.server[name], Meteor.server);
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      DDPServer: DDPServer
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/ddp-server/stream_server.js",
    "/node_modules/meteor/ddp-server/livedata_server.js",
    "/node_modules/meteor/ddp-server/writefence.js",
    "/node_modules/meteor/ddp-server/crossbar.js",
    "/node_modules/meteor/ddp-server/server_convenience.js"
  ]
}});

//# sourceURL=meteor://💻app/packages/ddp-server.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLXNlcnZlci9zdHJlYW1fc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL2xpdmVkYXRhX3NlcnZlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLXNlcnZlci93cml0ZWZlbmNlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL2Nyb3NzYmFyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL3NlcnZlcl9jb252ZW5pZW5jZS5qcyJdLCJuYW1lcyI6WyJ3ZWJzb2NrZXRFeHRlbnNpb25zIiwiXyIsIm9uY2UiLCJleHRlbnNpb25zIiwid2Vic29ja2V0Q29tcHJlc3Npb25Db25maWciLCJwcm9jZXNzIiwiZW52IiwiU0VSVkVSX1dFQlNPQ0tFVF9DT01QUkVTU0lPTiIsIkpTT04iLCJwYXJzZSIsInB1c2giLCJOcG0iLCJyZXF1aXJlIiwiY29uZmlndXJlIiwicGF0aFByZWZpeCIsIl9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18iLCJST09UX1VSTF9QQVRIX1BSRUZJWCIsIlN0cmVhbVNlcnZlciIsInNlbGYiLCJyZWdpc3RyYXRpb25fY2FsbGJhY2tzIiwib3Blbl9zb2NrZXRzIiwicHJlZml4IiwiUm91dGVQb2xpY3kiLCJkZWNsYXJlIiwic29ja2pzIiwic2VydmVyT3B0aW9ucyIsImxvZyIsImhlYXJ0YmVhdF9kZWxheSIsImRpc2Nvbm5lY3RfZGVsYXkiLCJkaXNhYmxlX2NvcnMiLCJESVNBQkxFX1NPQ0tKU19DT1JTIiwianNlc3Npb25pZCIsIlVTRV9KU0VTU0lPTklEIiwiRElTQUJMRV9XRUJTT0NLRVRTIiwid2Vic29ja2V0IiwiZmF5ZV9zZXJ2ZXJfb3B0aW9ucyIsInNlcnZlciIsImNyZWF0ZVNlcnZlciIsIldlYkFwcCIsImh0dHBTZXJ2ZXIiLCJyZW1vdmVMaXN0ZW5lciIsIl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayIsImluc3RhbGxIYW5kbGVycyIsImFkZExpc3RlbmVyIiwiX3JlZGlyZWN0V2Vic29ja2V0RW5kcG9pbnQiLCJvbiIsInNvY2tldCIsInNldFdlYnNvY2tldFRpbWVvdXQiLCJ0aW1lb3V0IiwicHJvdG9jb2wiLCJfc2Vzc2lvbiIsInJlY3YiLCJjb25uZWN0aW9uIiwic2V0VGltZW91dCIsInNlbmQiLCJkYXRhIiwid3JpdGUiLCJ3aXRob3V0IiwiVEVTVF9NRVRBREFUQSIsInN0cmluZ2lmeSIsInRlc3RNZXNzYWdlT25Db25uZWN0IiwiZWFjaCIsImNhbGxiYWNrIiwiT2JqZWN0IiwiYXNzaWduIiwicHJvdG90eXBlIiwicmVnaXN0ZXIiLCJhbGxfc29ja2V0cyIsInZhbHVlcyIsImZvckVhY2giLCJldmVudCIsIm9sZEh0dHBTZXJ2ZXJMaXN0ZW5lcnMiLCJsaXN0ZW5lcnMiLCJzbGljZSIsInJlbW92ZUFsbExpc3RlbmVycyIsIm5ld0xpc3RlbmVyIiwicmVxdWVzdCIsImFyZ3MiLCJhcmd1bWVudHMiLCJ1cmwiLCJwYXJzZWRVcmwiLCJwYXRobmFtZSIsImZvcm1hdCIsIm9sZExpc3RlbmVyIiwiYXBwbHkiLCJfb2JqZWN0U3ByZWFkIiwibW9kdWxlIiwibGluayIsImRlZmF1bHQiLCJ2IiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJERFBTZXJ2ZXIiLCJwdWJsaWNhdGlvblN0cmF0ZWdpZXMiLCJTRVJWRVJfTUVSR0UiLCJ1c2VEdW1teURvY3VtZW50VmlldyIsInVzZUNvbGxlY3Rpb25WaWV3IiwiZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbiIsIk5PX01FUkdFX05PX0hJU1RPUlkiLCJOT19NRVJHRSIsIk5PX01FUkdFX01VTFRJIiwiRHVtbXlEb2N1bWVudFZpZXciLCJleGlzdHNJbiIsIlNldCIsImRhdGFCeUtleSIsIk1hcCIsImdldEZpZWxkcyIsImNsZWFyRmllbGQiLCJzdWJzY3JpcHRpb25IYW5kbGUiLCJrZXkiLCJjaGFuZ2VDb2xsZWN0b3IiLCJ1bmRlZmluZWQiLCJjaGFuZ2VGaWVsZCIsInZhbHVlIiwiaXNBZGQiLCJTZXNzaW9uRG9jdW1lbnRWaWV3IiwiX1Nlc3Npb25Eb2N1bWVudFZpZXciLCJfZ2V0Q3VycmVudEZlbmNlIiwiY3VycmVudEludm9jYXRpb24iLCJfQ3VycmVudFdyaXRlRmVuY2UiLCJnZXQiLCJERFAiLCJfQ3VycmVudE1ldGhvZEludm9jYXRpb24iLCJmZW5jZSIsImV4dGVuZCIsInJldCIsInByZWNlZGVuY2VMaXN0IiwicmVtb3ZlZFZhbHVlIiwiaSIsImxlbmd0aCIsInByZWNlZGVuY2UiLCJzcGxpY2UiLCJkZWxldGUiLCJFSlNPTiIsImVxdWFscyIsImNsb25lIiwiaGFzIiwic2V0IiwiZWx0IiwiZmluZCIsIlNlc3Npb25Db2xsZWN0aW9uVmlldyIsImNvbGxlY3Rpb25OYW1lIiwic2Vzc2lvbkNhbGxiYWNrcyIsImRvY3VtZW50cyIsImNhbGxiYWNrcyIsIl9TZXNzaW9uQ29sbGVjdGlvblZpZXciLCJpc0VtcHR5Iiwic2l6ZSIsImRpZmYiLCJwcmV2aW91cyIsIkRpZmZTZXF1ZW5jZSIsImRpZmZNYXBzIiwiYm90aCIsImJpbmQiLCJkaWZmRG9jdW1lbnQiLCJyaWdodE9ubHkiLCJpZCIsIm5vd0RWIiwiYWRkZWQiLCJsZWZ0T25seSIsInByZXZEViIsInJlbW92ZWQiLCJmaWVsZHMiLCJkaWZmT2JqZWN0cyIsInByZXYiLCJub3ciLCJjaGFuZ2VkIiwiZG9jVmlldyIsIk1ldGVvciIsImdldFB1YmxpY2F0aW9uU3RyYXRlZ3kiLCJhZGQiLCJjaGFuZ2VkUmVzdWx0IiwiRXJyb3IiLCJlcnIiLCJTZXNzaW9uIiwidmVyc2lvbiIsIm9wdGlvbnMiLCJSYW5kb20iLCJpbml0aWFsaXplZCIsImluUXVldWUiLCJfRG91YmxlRW5kZWRRdWV1ZSIsImJsb2NrZWQiLCJ3b3JrZXJSdW5uaW5nIiwiY2FjaGVkVW5ibG9jayIsIl9uYW1lZFN1YnMiLCJfdW5pdmVyc2FsU3VicyIsInVzZXJJZCIsImNvbGxlY3Rpb25WaWV3cyIsIl9pc1NlbmRpbmciLCJfZG9udFN0YXJ0TmV3VW5pdmVyc2FsU3VicyIsIl9wZW5kaW5nUmVhZHkiLCJfY2xvc2VDYWxsYmFja3MiLCJfc29ja2V0VXJsIiwiX3Jlc3BvbmRUb1BpbmdzIiwicmVzcG9uZFRvUGluZ3MiLCJjb25uZWN0aW9uSGFuZGxlIiwiY2xvc2UiLCJvbkNsb3NlIiwiZm4iLCJjYiIsImJpbmRFbnZpcm9ubWVudCIsImRlZmVyIiwiY2xpZW50QWRkcmVzcyIsIl9jbGllbnRBZGRyZXNzIiwiaHR0cEhlYWRlcnMiLCJoZWFkZXJzIiwibXNnIiwic2Vzc2lvbiIsInN0YXJ0VW5pdmVyc2FsU3VicyIsImhlYXJ0YmVhdEludGVydmFsIiwiaGVhcnRiZWF0IiwiRERQQ29tbW9uIiwiSGVhcnRiZWF0IiwiaGVhcnRiZWF0VGltZW91dCIsIm9uVGltZW91dCIsInNlbmRQaW5nIiwic3RhcnQiLCJQYWNrYWdlIiwiRmFjdHMiLCJpbmNyZW1lbnRTZXJ2ZXJGYWN0Iiwic2VuZFJlYWR5Iiwic3Vic2NyaXB0aW9uSWRzIiwic3VicyIsInN1YnNjcmlwdGlvbklkIiwiX2NhblNlbmQiLCJzZW5kQWRkZWQiLCJjb2xsZWN0aW9uIiwic2VuZENoYW5nZWQiLCJzZW5kUmVtb3ZlZCIsImdldFNlbmRDYWxsYmFja3MiLCJnZXRDb2xsZWN0aW9uVmlldyIsInZpZXciLCJoYW5kbGVycyIsInVuaXZlcnNhbF9wdWJsaXNoX2hhbmRsZXJzIiwiaGFuZGxlciIsIl9zdGFydFN1YnNjcmlwdGlvbiIsInN0b3AiLCJfbWV0ZW9yU2Vzc2lvbiIsIl9kZWFjdGl2YXRlQWxsU3Vic2NyaXB0aW9ucyIsIl9yZW1vdmVTZXNzaW9uIiwiX3ByaW50U2VudEREUCIsIl9kZWJ1ZyIsInN0cmluZ2lmeUREUCIsInNlbmRFcnJvciIsInJlYXNvbiIsIm9mZmVuZGluZ01lc3NhZ2UiLCJwcm9jZXNzTWVzc2FnZSIsIm1zZ19pbiIsIm1lc3NhZ2VSZWNlaXZlZCIsInByb2Nlc3NOZXh0Iiwic2hpZnQiLCJydW5IYW5kbGVycyIsInVuYmxvY2siLCJvbk1lc3NhZ2VIb29rIiwicHJvdG9jb2xfaGFuZGxlcnMiLCJyZXN1bHQiLCJjYWxsIiwiX2lzUHJvbWlzZSIsImZpbmFsbHkiLCJzdWIiLCJuYW1lIiwicGFyYW1zIiwiQXJyYXkiLCJwdWJsaXNoX2hhbmRsZXJzIiwiZXJyb3IiLCJjb25jYXQiLCJERFBSYXRlTGltaXRlciIsInJhdGVMaW1pdGVySW5wdXQiLCJ0eXBlIiwiY29ubmVjdGlvbklkIiwiX2luY3JlbWVudCIsInJhdGVMaW1pdFJlc3VsdCIsIl9jaGVjayIsImFsbG93ZWQiLCJnZXRFcnJvck1lc3NhZ2UiLCJ0aW1lVG9SZXNldCIsInVuc3ViIiwiX3N0b3BTdWJzY3JpcHRpb24iLCJtZXRob2QiLCJyYW5kb21TZWVkIiwiX1dyaXRlRmVuY2UiLCJvbkFsbENvbW1pdHRlZCIsInJldGlyZSIsIm1ldGhvZHMiLCJtZXRob2RfaGFuZGxlcnMiLCJhcm0iLCJpbnZvY2F0aW9uIiwiTWV0aG9kSW52b2NhdGlvbiIsImlzU2ltdWxhdGlvbiIsInNldFVzZXJJZCIsIl9zZXRVc2VySWQiLCJwcm9taXNlIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJnZXRDdXJyZW50TWV0aG9kSW52b2NhdGlvblJlc3VsdCIsIndpdGhWYWx1ZSIsIm1heWJlQXVkaXRBcmd1bWVudENoZWNrcyIsImtleU5hbWUiLCJmaW5pc2giLCJwYXlsb2FkIiwidGhlbiIsImV4Y2VwdGlvbiIsIndyYXBJbnRlcm5hbEV4Y2VwdGlvbiIsIl9lYWNoU3ViIiwiZiIsIl9kaWZmQ29sbGVjdGlvblZpZXdzIiwiYmVmb3JlQ1ZzIiwibGVmdFZhbHVlIiwicmlnaHRWYWx1ZSIsImRvYyIsIl9kZWFjdGl2YXRlIiwib2xkTmFtZWRTdWJzIiwiYWxsIiwibWFwIiwiX3JlZiIsIm5ld1N1YiIsIl9yZWNyZWF0ZSIsIl9ydW5IYW5kbGVyIiwiX25vWWllbGRzQWxsb3dlZCIsInN1YklkIiwiU3Vic2NyaXB0aW9uIiwidW5ibG9ja0hhbmRlciIsInN1Yk5hbWUiLCJtYXliZVN1YiIsIl9uYW1lIiwiX3JlbW92ZUFsbERvY3VtZW50cyIsInJlc3BvbnNlIiwiaHR0cEZvcndhcmRlZENvdW50IiwicGFyc2VJbnQiLCJyZW1vdGVBZGRyZXNzIiwiZm9yd2FyZGVkRm9yIiwiaXNTdHJpbmciLCJ0cmltIiwic3BsaXQiLCJfaGFuZGxlciIsIl9zdWJzY3JpcHRpb25JZCIsIl9wYXJhbXMiLCJfc3Vic2NyaXB0aW9uSGFuZGxlIiwiX2RlYWN0aXZhdGVkIiwiX3N0b3BDYWxsYmFja3MiLCJfZG9jdW1lbnRzIiwiX3JlYWR5IiwiX2lkRmlsdGVyIiwiaWRTdHJpbmdpZnkiLCJNb25nb0lEIiwiaWRQYXJzZSIsInJlc3VsdE9yVGhlbmFibGUiLCJfQ3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbiIsImUiLCJfaXNEZWFjdGl2YXRlZCIsImlzVGhlbmFibGUiLCJfcHVibGlzaEhhbmRsZXJSZXN1bHQiLCJyZXMiLCJpc0N1cnNvciIsImMiLCJfcHVibGlzaEN1cnNvciIsInJlYWR5IiwiaXNBcnJheSIsImNvbGxlY3Rpb25OYW1lcyIsIl9nZXRDb2xsZWN0aW9uTmFtZSIsImN1ciIsIl9jYWxsU3RvcENhbGxiYWNrcyIsImNvbGxlY3Rpb25Eb2NzIiwic3RySWQiLCJvblN0b3AiLCJpZHMiLCJTZXJ2ZXIiLCJkZWZhdWx0UHVibGljYXRpb25TdHJhdGVneSIsIm9uQ29ubmVjdGlvbkhvb2siLCJIb29rIiwiZGVidWdQcmludEV4Y2VwdGlvbnMiLCJfcHVibGljYXRpb25TdHJhdGVnaWVzIiwic2Vzc2lvbnMiLCJzdHJlYW1fc2VydmVyIiwicmF3X21zZyIsIl9wcmludFJlY2VpdmVkRERQIiwicGFyc2VERFAiLCJfaGFuZGxlQ29ubmVjdCIsIm9uQ29ubmVjdGlvbiIsInNldFB1YmxpY2F0aW9uU3RyYXRlZ3kiLCJzdHJhdGVneSIsImluY2x1ZGVzIiwib25NZXNzYWdlIiwic3VwcG9ydCIsImNvbnRhaW5zIiwiU1VQUE9SVEVEX0REUF9WRVJTSU9OUyIsImNhbGN1bGF0ZVZlcnNpb24iLCJwdWJsaXNoIiwiaXNPYmplY3QiLCJhdXRvcHVibGlzaCIsImlzX2F1dG8iLCJ3YXJuZWRfYWJvdXRfYXV0b3B1Ymxpc2giLCJpc0FzeW5jQ2FsbCIsIl9pc0NhbGxBc3luY01ldGhvZFJ1bm5pbmciLCJmdW5jIiwiX2xlbiIsIl9rZXkiLCJwb3AiLCJjYWxsQXN5bmMiLCJfYXJncyQiLCJfbGVuMiIsIl9rZXkyIiwiaGFzT3duUHJvcGVydHkiLCJfc2V0IiwiX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmciLCJfQ3VycmVudENhbGxBc3luY0ludm9jYXRpb24iLCJoYXNDYWxsQXN5bmNQYXJlbnQiLCJhcHBseUFzeW5jIiwiaXNGcm9tQ2FsbEFzeW5jIiwiY2F0Y2giLCJjdXJyZW50TWV0aG9kSW52b2NhdGlvbiIsImN1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24iLCJtYWtlUnBjU2VlZCIsInIiLCJfdXJsRm9yU2Vzc2lvbiIsInNlc3Npb25JZCIsImNsaWVudFN1cHBvcnRlZFZlcnNpb25zIiwic2VydmVyU3VwcG9ydGVkVmVyc2lvbnMiLCJjb3JyZWN0VmVyc2lvbiIsIl9jYWxjdWxhdGVWZXJzaW9uIiwiY29udGV4dCIsImlzQ2xpZW50U2FmZSIsIm9yaWdpbmFsTWVzc2FnZSIsIm1lc3NhZ2UiLCJkZXRhaWxzIiwiX2V4cGVjdGVkQnlUZXN0Iiwic3RhY2siLCJzYW5pdGl6ZWRFcnJvciIsImRlc2NyaXB0aW9uIiwiTWF0Y2giLCJfZmFpbElmQXJndW1lbnRzQXJlTm90QWxsQ2hlY2tlZCIsIl9fcmVpZnlfYXN5bmNfcmVzdWx0X18iLCJfcmVpZnlFcnJvciIsImFzeW5jIiwiY29uc3RydWN0b3IiLCJhcm1lZCIsImZpcmVkIiwicmV0aXJlZCIsIm91dHN0YW5kaW5nX3dyaXRlcyIsImJlZm9yZV9maXJlX2NhbGxiYWNrcyIsImNvbXBsZXRpb25fY2FsbGJhY2tzIiwiYmVnaW5Xcml0ZSIsImNvbW1pdHRlZCIsIl9jb21taXR0ZWRGbiIsIl9tYXliZUZpcmUiLCJvbkJlZm9yZUZpcmUiLCJfYXJtQW5kV2FpdCIsInJlc29sdmVyIiwicmV0dXJuVmFsdWUiLCJhcm1BbmRXYWl0IiwiaW52b2tlQ2FsbGJhY2siLCJFbnZpcm9ubWVudFZhcmlhYmxlIiwiX0Nyb3NzYmFyIiwibmV4dElkIiwibGlzdGVuZXJzQnlDb2xsZWN0aW9uIiwibGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnQiLCJmYWN0UGFja2FnZSIsImZhY3ROYW1lIiwiX2NvbGxlY3Rpb25Gb3JNZXNzYWdlIiwibGlzdGVuIiwidHJpZ2dlciIsInJlY29yZCIsImZpcmUiLCJub3RpZmljYXRpb24iLCJsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uIiwiY2FsbGJhY2tJZHMiLCJsIiwiX21hdGNoZXMiLCJPYmplY3RJRCIsInRyaWdnZXJWYWx1ZSIsIl9JbnZhbGlkYXRpb25Dcm9zc2JhciIsIkREUF9ERUZBVUxUX0NPTk5FQ1RJT05fVVJMIiwicmVmcmVzaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSUEsbUJBQW1CLEdBQUdDLENBQUMsQ0FBQ0MsSUFBSSxDQUFDLFlBQVk7RUFDM0MsSUFBSUMsVUFBVSxHQUFHLEVBQUU7RUFFbkIsSUFBSUMsMEJBQTBCLEdBQUdDLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDQyw0QkFBNEIsR0FDakVDLElBQUksQ0FBQ0MsS0FBSyxDQUFDSixPQUFPLENBQUNDLEdBQUcsQ0FBQ0MsNEJBQTRCLENBQUMsR0FBRyxDQUFDLENBQUM7RUFDakUsSUFBSUgsMEJBQTBCLEVBQUU7SUFDOUJELFVBQVUsQ0FBQ08sSUFBSSxDQUFDQyxHQUFHLENBQUNDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDQyxTQUFTLENBQ3pEVCwwQkFDRixDQUFDLENBQUM7RUFDSjtFQUVBLE9BQU9ELFVBQVU7QUFDbkIs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RTVCdk0sTUFBTSxDQUFDaVQsT0FBTyxHQUFHLGdCQUFnQlQsWUFBWSxFQUFFO0VBQzdDLE1BQU1wWCxTQUFTLENBQUMyWCxxQkFBcUIsQ0FBQ1IsSUFBSSxDQUFDQyxZQUFZLENBQUM7QUFDMUQsQ0FBQzs7QUFFRDtBQUNBO0FBQ0E5YyxDQUFDLENBQUM0RCxJQUFJLENBQ0osQ0FDRSxTQUFTLEVBQ1QsYUFBYSxFQUNiLFNBQVMsRUFDVCxNQUFNLEVBQ04sV0FBVyxFQUNYLE9BQU8sRUFDUCxZQUFZLEVBQ1osY0FBYyxFQUNkLFdBQVcsQ0FDWixFQUNELFVBQVNzTSxJQUFJLEVBQUU7RUFDYjVGLE1BQU0sQ0FBQzRGLElBQUksQ0FBQyxHQUFHbFEsQ0FBQyxDQUFDdUosSUFBSSxDQUFDZSxNQUFNLENBQUNuSSxNQUFNLENBQUMrTixJQUFJLENBQUMsRUFBRTVGLE1BQU0sQ0FBQ25JLE1BQU0sQ0FBQztBQUMzRCxDQUNGLENBQUMsQyIsImZpbGUiOiIvcGFja2FnZXMvZGRwLXNlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIEJ5IGRlZmF1bHQsIHdlIHVzZSB0aGUgcGVybWVzc2FnZS1kZWZsYXRlIGV4dGVuc2lvbiB3aXRoIGRlZmF1bHRcbi8vIGNvbmZpZ3VyYXRpb24uIElmICRTRVJWRVJfV0VCU09DS0VUX0NPTVBSRVNTSU9OIGlzIHNldCwgdGhlbiBpdCBtdXN0IGJlIHZhbGlkXG4vLyBKU09OLiBJZiBpdCByZXByZXNlbnRzIGEgZmFsc2V5IHZhbHVlLCB0aGVuIHdlIGRvIG5vdCB1c2UgcGVybWVzc2FnZS1kZWZsYXRlXG4vLyBhdCBhbGw7IG90aGVyd2lzZSwgdGhlIEpTT04gdmFsdWUgaXMgdXNlZCBhcyBhbiBhcmd1bWVudCB0byBkZWZsYXRlJ3Ncbi8vIGNvbmZpZ3VyZSBtZXRob2Q7IHNlZVxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2ZheWUvcGVybWVzc2FnZS1kZWZsYXRlLW5vZGUvYmxvYi9tYXN0ZXIvUkVBRE1FLm1kXG4vL1xuLy8gKFdlIGRvIHRoaXMgaW4gYW4gXy5vbmNlIGluc3RlYWQgb2YgYXQgc3RhcnR1cCwgYmVjYXVzZSB3ZSBkb24ndCB3YW50IHRvXG4vLyBjcmFzaCB0aGUgdG9vbCBkdXJpbmcgaXNvcGFja2V0IGxvYWQgaWYgeW91ciBKU09OIGRvZXNuJ3QgcGFyc2UuIFRoaXMgaXMgb25seVxuLy8gYSBwcm9ibGVtIGJlY2F1c2UgdGhlIHRvb2wgaGFzIHRvIGxvYWQgdGhlIEREUCBzZXJ2ZXIgY29kZSBqdXN0IGluIG9yZGVyIHRvXG4vLyBiZSBhIEREUCBjbGllbnQ7IHNlZSBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvMzQ1MiAuKVxudmFyIHdlYnNvY2tldEV4dGVuc2lvbnMgPSBfLm9uY2UoZnVuY3Rpb24gKCkge1xuICB2YXIgZXh0ZW5zaW9ucyA9IFtdO1xuXG4gIHZhciB3ZWJzb2NrZXRDb21wcmVzc2lvbkNvbmZpZyA9IHByb2Nlc3MuZW52LlNFUlZFUl9XRUJTT0NLRVRfQ09NUFJFU1NJT05cbiAgICAgICAgPyBKU09OLnBhcnNlKHByb2Nlc3MuZW52LlNFUlZFUl9XRUJTT0NLRVRfQ09NUFJFU1NJT04pIDoge307XG4gIGlmICh3ZWJzb2NrZXRDb21wcmVzc2lvbkNvbmZpZykge1xuICAgIGV4dGVuc2lvbnMucHVzaChOcG0ucmVxdWlyZSgncGVybWVzc2FnZS1kZWZsYXRlJykuY29uZmlndXJlKFxuICAgICAgd2Vic29ja2V0Q29tcHJlc3Npb25Db25maWdcbiAgICApKTtcbiAgfVxuXG4gIHJldHVybiBleHRlbnNpb25zO1xufSk7XG5cbnZhciBwYXRoUHJlZml4ID0gX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ST09UX1VSTF9QQVRIX1BSRUZJWCB8fCAgXCJcIjtcblxuU3RyZWFtU2VydmVyID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYucmVnaXN0cmF0aW9uX2NhbGxiYWNrcyA9IFtdO1xuICBzZWxmLm9wZW5fc29ja2V0cyA9IFtdO1xuXG4gIC8vIEJlY2F1c2Ugd2UgYXJlIGluc3RhbGxpbmcgZGlyZWN0bHkgb250byBXZWJBcHAuaHR0cFNlcnZlciBpbnN0ZWFkIG9mIHVzaW5nXG4gIC8vIFdlYkFwcC5hcHAsIHdlIGhhdmUgdG8gcHJvY2VzcyB0aGUgcGF0aCBwcmVmaXggb3Vyc2VsdmVzLlxuICBzZWxmLnByZWZpeCA9IHBhdGhQcmVmaXggKyAnL3NvY2tqcyc7XG4gIFJvdXRlUG9saWN5LmRlY2xhcmUoc2VsZi5wcmVmaXggKyAnLycsICduZXR3b3JrJyk7XG5cbiAgLy8gc2V0IHVwIHNvY2tqc1xuICB2YXIgc29ja2pzID0gTnBtLnJlcXVpcmUoJ3NvY2tqcycpO1xuICB2YXIgc2VydmVyT3B0aW9ucyA9IHtcbiAgICBwcmVmaXg6IHNlbGYucHJlZml4LFxuICAgIGxvZzogZnVuY3Rpb24oKSB7fSxcbiAgICAvLyB0aGlzIGlzIHRoZSBkZWZhdWx0LCBidXQgd2UgY29kZSBpdCBleHBsaWNpdGx5IGJlY2F1c2Ugd2UgZGVwZW5kXG4gICAgLy8gb24gaXQgaW4gc3RyZWFtX2NsaWVudDpIRUFSVEJFQVRfVElNRU9VVFxuICAgIGhlYXJ0YmVhdF9kZWxheTogNDUwMDAsXG4gICAgLy8gVGhlIGRlZmF1bHQgZGlzY29ubmVjdF9kZWxheSBpcyA1IHNlY29uZHMsIGJ1dCBpZiB0aGUgc2VydmVyIGVuZHMgdXAgQ1BVXG4gICAgLy8gYm91bmQgZm9yIHRoYXQgbXVjaCB0aW1lLCBTb2NrSlMgbWlnaHQgbm90IG5vdGljZSB0aGF0IHRoZSB1c2VyIGhhc1xuICAgIC8vIHJlY29ubmVjdGVkIGJlY2F1c2UgdGhlIHRpbWVyIChvZiBkaXNjb25uZWN0X2RlbGF5IG1zKSBjYW4gZmlyZSBiZWZvcmVcbiAgICAvLyBTb2NrSlMgcHJvY2Vzc2VzIHRoZSBuZXcgY29ubmVjdGlvbi4gRXZlbnR1YWxseSB3ZSdsbCBmaXggdGhpcyBieSBub3RcbiAgICAvLyBjb21iaW5pbmcgQ1BVLWhlYXZ5IHByb2Nlc3Npbmcgd2l0aCBTb2NrSlMgdGVybWluYXRpb24gKGVnIGEgcHJveHkgd2hpY2hcbiAgICAvLyBjb252ZXJ0cyB0byBVbml4IHNvY2tldHMpIGJ1dCBmb3Igbm93LCByYWlzZSB0aGUgZGVsYXkuXG4gICAgZGlzY29ubmVjdF9kZWxheTogNjAgKiAxMDAwLFxuICAgIC8vIEFsbG93IGRpc2FibGluZyBvZiBDT1JTIHJlcXVlc3RzIHRvIGFkZHJlc3NcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvODMxNy5cbiAgICBkaXNhYmxlX2NvcnM6ICEhcHJvY2Vzcy5lbnYuRElTQUJMRV9TT0NLSlNfQ09SUyxcbiAgICAvLyBTZXQgdGhlIFVTRV9KU0VTU0lPTklEIGVudmlyb25tZW50IHZhcmlhYmxlIHRvIGVuYWJsZSBzZXR0aW5nIHRoZVxuICAgIC8vIEpTRVNTSU9OSUQgY29va2llLiBUaGlzIGlzIHVzZWZ1bCBmb3Igc2V0dGluZyB1cCBwcm94aWVzIHdpdGhcbiAgICAvLyBzZXNzaW9uIGFmZmluaXR5LlxuICAgIGpzZXNzaW9uaWQ6ICEhcHJvY2Vzcy5lbnYuVVNFX0pTRVNTSU9OSURcbiAgfTtcblxuICAvLyBJZiB5b3Uga25vdyB5b3VyIHNlcnZlciBlbnZpcm9ubWVudCAoZWcsIHByb3hpZXMpIHdpbGwgcHJldmVudCB3ZWJzb2NrZXRzXG4gIC8vIGZyb20gZXZlciB3b3JraW5nLCBzZXQgJERJU0FCTEVfV0VCU09DS0VUUyBhbmQgU29ja0pTIGNsaWVudHMgKGllLFxuICAvLyBicm93c2Vycykgd2lsbCBub3Qgd2FzdGUgdGltZSBhdHRlbXB0aW5nIHRvIHVzZSB0aGVtLlxuICAvLyAoWW91ciBzZXJ2ZXIgd2lsbCBzdGlsbCBoYXZlIGEgL3dlYnNvY2tldCBlbmRwb2ludC4pXG4gIGlmIChwcm9jZXNzLmVudi5ESVNBQkxFX1dFQlNPQ0tFVFMpIHtcbiAgICBzZXJ2ZXJPcHRpb25zLndlYnNvY2tldCA9IGZhbHNlO1xuICB9IGVsc2Uge1xuICAgIHNlcnZlck9wdGlvbnMuZmF5ZV9zZXJ2ZXJfb3B0aW9ucyA9IHtcbiAgICAgIGV4dGVuc2lvbnM6IHdlYnNvY2tldEV4dGVuc2lvbnMoKVxuICAgIH07XG4gIH1cblxuICBzZWxmLnNlcnZlciA9IHNvY2tqcy5jcmVhdGVTZXJ2ZXIoc2VydmVyT3B0aW9ucyk7XG5cbiAgLy8gSW5zdGFsbCB0aGUgc29ja2pzIGhhbmRsZXJzLCBidXQgd2Ugd2FudCB0byBrZWVwIGFyb3VuZCBvdXIgb3duIHBhcnRpY3VsYXJcbiAgLy8gcmVxdWVzdCBoYW5kbGVyIHRoYXQgYWRqdXN0cyBpZGxlIHRpbWVvdXRzIHdoaWxlIHdlIGhhdmUgYW4gb3V0c3RhbmRpbmdcbiAgLy8gcmVxdWVzdC4gIFRoaXMgY29tcGVuc2F0ZXMgZm9yIHRoZSBmYWN0IHRoYXQgc29ja2pzIHJlbW92ZXMgYWxsIGxpc3RlbmVyc1xuICAvLyBmb3IgXCJyZXF1ZXN0XCIgdG8gYWRkIGl0cyBvd24uXG4gIFdlYkFwcC5odHRwU2VydmVyLnJlbW92ZUxpc3RlbmVyKFxuICAgICdyZXF1ZXN0JywgV2ViQXBwLl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayk7XG4gIHNlbGYuc2VydmVyLmluc3RhbGxIYW5kbGVycyhXZWJBcHAuaHR0cFNlcnZlcik7XG4gIFdlYkFwcC5odHRwU2VydmVyLmFkZExpc3RlbmVyKFxuICAgICdyZXF1ZXN0JywgV2ViQXBwLl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayk7XG5cbiAgLy8gU3VwcG9ydCB0aGUgL3dlYnNvY2tldCBlbmRwb2ludFxuICBzZWxmLl9yZWRpcmVjdFdlYnNvY2tldEVuZHBvaW50KCk7XG5cbiAgc2VsZi5zZXJ2ZXIub24oJ2Nvbm5lY3Rpb24nLCBmdW5jdGlvbiAoc29ja2V0KSB7XG4gICAgLy8gc29ja2pzIHNvbWV0aW1lcyBwYXNzZXMgdXMgbnVsbCBpbnN0ZWFkIG9mIGEgc29ja2V0IG9iamVjdFxuICAgIC8vIHNvIHdlIG5lZWQgdG8gZ3VhcmQgYWdhaW5zdCB0aGF0LiBzZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3NvY2tqcy9zb2NranMtbm9kZS9pc3N1ZXMvMTIxXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzEwNDY4XG4gICAgaWYgKCFzb2NrZXQpIHJldHVybjtcblxuICAgIC8vIFdlIHdhbnQgdG8gbWFrZSBzdXJlIHRoYXQgaWYgYSBjbGllbnQgY29ubmVjdHMgdG8gdXMgYW5kIGRvZXMgdGhlIGluaXRpYWxcbiAgICAvLyBXZWJzb2NrZXQgaGFuZHNoYWtlIGJ1dCBuZXZlciBnZXRzIHRvIHRoZSBERFAgaGFuZHNoYWtlLCB0aGF0IHdlXG4gICAgLy8gZXZlbnR1YWxseSBraWxsIHRoZSBzb2NrZXQuICBPbmNlIHRoZSBERFAgaGFuZHNoYWtlIGhhcHBlbnMsIEREUFxuICAgIC8vIGhlYXJ0YmVhdGluZyB3aWxsIHdvcmsuIEFuZCBiZWZvcmUgdGhlIFdlYnNvY2tldCBoYW5kc2hha2UsIHRoZSB0aW1lb3V0c1xuICAgIC8vIHdlIHNldCBhdCB0aGUgc2VydmVyIGxldmVsIGluIHdlYmFwcF9zZXJ2ZXIuanMgd2lsbCB3b3JrLiBCdXRcbiAgICAvLyBmYXllLXdlYnNvY2tldCBjYWxscyBzZXRUaW1lb3V0KDApIG9uIGFueSBzb2NrZXQgaXQgdGFrZXMgb3Zlciwgc28gdGhlcmVcbiAgICAvLyBpcyBhbiBcImluIGJldHdlZW5cIiBzdGF0ZSB3aGVyZSB0aGlzIGRvZXNuJ3QgaGFwcGVuLiAgV2Ugd29yayBhcm91bmQgdGhpc1xuICAgIC8vIGJ5IGV4cGxpY2l0bHkgc2V0dGluZyB0aGUgc29ja2V0IHRpbWVvdXQgdG8gYSByZWxhdGl2ZWx5IGxhcmdlIHRpbWUgaGVyZSxcbiAgICAvLyBhbmQgc2V0dGluZyBpdCBiYWNrIHRvIHplcm8gd2hlbiB3ZSBzZXQgdXAgdGhlIGhlYXJ0YmVhdCBpblxuICAgIC8vIGxpdmVkYXRhX3NlcnZlci5qcy5cbiAgICBzb2NrZXQuc2V0V2Vic29ja2V0VGltZW91dCA9IGZ1bmN0aW9uICh0aW1lb3V0KSB7XG4gICAgICBpZiAoKHNvY2tldC5wcm90b2NvbCA9PT0gJ3dlYnNvY2tldCcgfHxcbiAgICAgICAgICAgc29ja2V0LnByb3RvY29sID09PSAnd2Vic29ja2V0LXJhdycpXG4gICAgICAgICAgJiYgc29ja2V0Ll9zZXNzaW9uLnJlY3YpIHtcbiAgICAgICAgc29ja2V0Ll9zZXNzaW9uLnJlY3YuY29ubmVjdGlvbi5zZXRUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgfVxuICAgIH07XG4gICAgc29ja2V0LnNldFdlYnNvY2tldFRpbWVvdXQoNDUgKiAxMDAwKTtcblxuICAgIHNvY2tldC5zZW5kID0gZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgIHNvY2tldC53cml0ZShkYXRhKTtcbiAgICB9O1xuICAgIHNvY2tldC5vbignY2xvc2UnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLm9wZW5fc29ja2V0cyA9IF8ud2l0aG91dChzZWxmLm9wZW5fc29ja2V0cywgc29ja2V0KTtcbiAgICB9KTtcbiAgICBzZWxmLm9wZW5fc29ja2V0cy5wdXNoKHNvY2tldCk7XG5cbiAgICAvLyBvbmx5IHRvIHNlbmQgYSBtZXNzYWdlIGFmdGVyIGNvbm5lY3Rpb24gb24gdGVzdHMsIHVzZWZ1bCBmb3JcbiAgICAvLyBzb2NrZXQtc3RyZWFtLWNsaWVudC9zZXJ2ZXItdGVzdHMuanNcbiAgICBpZiAocHJvY2Vzcy5lbnYuVEVTVF9NRVRBREFUQSAmJiBwcm9jZXNzLmVudi5URVNUX01FVEFEQVRBICE9PSBcInt9XCIpIHtcbiAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHsgdGVzdE1lc3NhZ2VPbkNvbm5lY3Q6IHRydWUgfSkpO1xuICAgIH1cblxuICAgIC8vIGNhbGwgYWxsIG91ciBjYWxsYmFja3Mgd2hlbiB3ZSBnZXQgYSBuZXcgc29ja2V0LiB0aGV5IHdpbGwgZG8gdGhlXG4gICAgLy8gd29yayBvZiBzZXR0aW5nIHVwIGhhbmRsZXJzIGFuZCBzdWNoIGZvciBzcGVjaWZpYyBtZXNzYWdlcy5cbiAgICBfLmVhY2goc2VsZi5yZWdpc3RyYXRpb25fY2FsbGJhY2tzLCBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIGNhbGxiYWNrKHNvY2tldCk7XG4gICAgfSk7XG4gIH0pO1xuXG59O1xuXG5PYmplY3QuYXNzaWduKFN0cmVhbVNlcnZlci5wcm90b3R5cGUsIHtcbiAgLy8gY2FsbCBteSBjYWxsYmFjayB3aGVuIGEgbmV3IHNvY2tldCBjb25uZWN0cy5cbiAgLy8gYWxzbyBjYWxsIGl0IGZvciBhbGwgY3VycmVudCBjb25uZWN0aW9ucy5cbiAgcmVnaXN0ZXI6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnJlZ2lzdHJhdGlvbl9jYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG4gICAgXy5lYWNoKHNlbGYuYWxsX3NvY2tldHMoKSwgZnVuY3Rpb24gKHNvY2tldCkge1xuICAgICAgY2FsbGJhY2soc29ja2V0KTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBnZXQgYSBsaXN0IG9mIGFsbCBzb2NrZXRzXG4gIGFsbF9zb2NrZXRzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBfLnZhbHVlcyhzZWxmLm9wZW5fc29ja2V0cyk7XG4gIH0sXG5cbiAgLy8gUmVkaXJlY3QgL3dlYnNvY2tldCB0byAvc29ja2pzL3dlYnNvY2tldCBpbiBvcmRlciB0byBub3QgZXhwb3NlXG4gIC8vIHNvY2tqcyB0byBjbGllbnRzIHRoYXQgd2FudCB0byB1c2UgcmF3IHdlYnNvY2tldHNcbiAgX3JlZGlyZWN0V2Vic29ja2V0RW5kcG9pbnQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBVbmZvcnR1bmF0ZWx5IHdlIGNhbid0IHVzZSBhIGNvbm5lY3QgbWlkZGxld2FyZSBoZXJlIHNpbmNlXG4gICAgLy8gc29ja2pzIGluc3RhbGxzIGl0c2VsZiBwcmlvciB0byBhbGwgZXhpc3RpbmcgbGlzdGVuZXJzXG4gICAgLy8gKG1lYW5pbmcgcHJpb3IgdG8gYW55IGNvbm5lY3QgbWlkZGxld2FyZXMpIHNvIHdlIG5lZWQgdG8gdGFrZVxuICAgIC8vIGFuIGFwcHJvYWNoIHNpbWlsYXIgdG8gb3ZlcnNoYWRvd0xpc3RlbmVycyBpblxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9zb2NranMvc29ja2pzLW5vZGUvYmxvYi9jZjgyMGM1NWFmNmE5OTUzZTE2NTU4NTU1YTMxZGVjZWE1NTRmNzBlL3NyYy91dGlscy5jb2ZmZWVcbiAgICBbJ3JlcXVlc3QnLCAndXBncmFkZSddLmZvckVhY2goKGV2ZW50KSA9PiB7XG4gICAgICB2YXIgaHR0cFNlcnZlciA9IFdlYkFwcC5odHRwU2VydmVyO1xuICAgICAgdmFyIG9sZEh0dHBTZXJ2ZXJMaXN0ZW5lcnMgPSBodHRwU2VydmVyLmxpc3RlbmVycyhldmVudCkuc2xpY2UoMCk7XG4gICAgICBodHRwU2VydmVyLnJlbW92ZUFsbExpc3RlbmVycyhldmVudCk7XG5cbiAgICAgIC8vIHJlcXVlc3QgYW5kIHVwZ3JhZGUgaGF2ZSBkaWZmZXJlbnQgYXJndW1lbnRzIHBhc3NlZCBidXRcbiAgICAgIC8vIHdlIG9ubHkgY2FyZSBhYm91dCB0aGUgZmlyc3Qgb25lIHdoaWNoIGlzIGFsd2F5cyByZXF1ZXN0XG4gICAgICB2YXIgbmV3TGlzdGVuZXIgPSBmdW5jdGlvbihyZXF1ZXN0IC8qLCBtb3JlQXJndW1lbnRzICovKSB7XG4gICAgICAgIC8vIFN0b3JlIGFyZ3VtZW50cyBmb3IgdXNlIHdpdGhpbiB0aGUgY2xvc3VyZSBiZWxvd1xuICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcblxuICAgICAgICAvLyBUT0RPIHJlcGxhY2Ugd2l0aCB1cmwgcGFja2FnZVxuICAgICAgICB2YXIgdXJsID0gTnBtLnJlcXVpcmUoJ3VybCcpO1xuXG4gICAgICAgIC8vIFJld3JpdGUgL3dlYnNvY2tldCBhbmQgL3dlYnNvY2tldC8gdXJscyB0byAvc29ja2pzL3dlYnNvY2tldCB3aGlsZVxuICAgICAgICAvLyBwcmVzZXJ2aW5nIHF1ZXJ5IHN0cmluZy5cbiAgICAgICAgdmFyIHBhcnNlZFVybCA9IHVybC5wYXJzZShyZXF1ZXN0LnVybCk7XG4gICAgICAgIGlmIChwYXJzZWRVcmwucGF0aG5hbWUgPT09IHBhdGhQcmVmaXggKyAnL3dlYnNvY2tldCcgfHxcbiAgICAgICAgICAgIHBhcnNlZFVybC5wYXRobmFtZSA9PT0gcGF0aFByZWZpeCArICcvd2Vic29ja2V0LycpIHtcbiAgICAgICAgICBwYXJzZWRVcmwucGF0aG5hbWUgPSBzZWxmLnByZWZpeCArICcvd2Vic29ja2V0JztcbiAgICAgICAgICByZXF1ZXN0LnVybCA9IHVybC5mb3JtYXQocGFyc2VkVXJsKTtcbiAgICAgICAgfVxuICAgICAgICBfLmVhY2gob2xkSHR0cFNlcnZlckxpc3RlbmVycywgZnVuY3Rpb24ob2xkTGlzdGVuZXIpIHtcbiAgICAgICAgICBvbGRMaXN0ZW5lci5hcHBseShodHRwU2VydmVyLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgaHR0cFNlcnZlci5hZGRMaXN0ZW5lcihldmVudCwgbmV3TGlzdGVuZXIpO1xuICAgIH0pO1xuICB9XG59KTtcbiIsIkREUFNlcnZlciA9IHt9O1xuXG4vLyBQdWJsaWNhdGlvbiBzdHJhdGVnaWVzIGRlZmluZSBob3cgd2UgaGFuZGxlIGRhdGEgZnJvbSBwdWJsaXNoZWQgY3Vyc29ycyBhdCB0aGUgY29sbGVjdGlvbiBsZXZlbFxuLy8gVGhpcyBhbGxvd3Mgc29tZW9uZSB0bzpcbi8vIC0gQ2hvb3NlIGEgdHJhZGUtb2ZmIGJldHdlZW4gY2xpZW50LXNlcnZlciBiYW5kd2lkdGggYW5kIHNlcnZlciBtZW1vcnkgdXNhZ2Vcbi8vIC0gSW1wbGVtZW50IHNwZWNpYWwgKG5vbi1tb25nbykgY29sbGVjdGlvbnMgbGlrZSB2b2xhdGlsZSBtZXNzYWdlIHF1ZXVlc1xuY29uc3QgcHVibGljYXRpb25TdHJhdGVnaWVzID0ge1xuICAvLyBTRVJWRVJfTUVSR0UgaXMgdGhlIGRlZmF1bHQgc3RyYXRlZ3kuXG4gIC8vIFdoZW4gdXNpbmcgdGhpcyBzdHJhdGVneSwgdGhlIHNlcnZlciBtYWludGFpbnMgYSBjb3B5IG9mIGFsbCBkYXRhIGEgY29ubmVjdGlvbiBpcyBzdWJzY3JpYmVkIHRvLlxuICAvLyBUaGlzIGFsbG93cyB1cyB0byBvbmx5IHNlbmQgZGVsdGFzIG92ZXIgbXVsdGlwbGUgcHVibGljYXRpb25zLlxuICBTRVJWRVJfTUVSR0U6IHtcbiAgICB1c2VEdW1teURvY3VtZW50VmlldzogZmFsc2UsXG4gICAgdXNlQ29sbGVjdGlvblZpZXc6IHRydWUsXG4gICAgZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbjogdHJ1ZSxcbiAgfSxcbiAgLy8gVGhlIE5PX01FUkdFX05PX0hJU1RPUlkgc3RyYXRlZ3kgcmVzdWx0cyBpbiB0aGUgc2VydmVyIHNlbmRpbmcgYWxsIHB1YmxpY2F0aW9uIGRhdGFcbiAgLy8gZGlyZWN0bHkgdG8gdGhlIGNsaWVudC4gSXQgZG9lcyBub3QgcmVtZW1iZXIgd2hhdCBpdCBoYXMgcHJldmlvdXNseSBzZW50XG4gIC8vIHRvIGl0IHdpbGwgbm90IHRyaWdnZXIgcmVtb3ZlZCBtZXNzYWdlcyB3aGVuIGEgc3Vic2NyaXB0aW9uIGlzIHN0b3BwZWQuXG4gIC8vIFRoaXMgc2hvdWxkIG9ubHkgYmUgY2hvc2VuIGZvciBzcGVjaWFsIHVzZSBjYXNlcyBsaWtlIHNlbmQtYW5kLWZvcmdldCBxdWV1ZXMuXG4gIE5PX01FUkdFX05PX0hJU1RPUlk6IHtcbiAgICB1c2VEdW1teURvY3VtZW50VmlldzogZmFsc2UsXG4gICAgdXNlQ29sbGVjdGlvblZpZXc6IGZhbHNlLFxuICAgIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IGZhbHNlLFxuICB9LFxuICAvLyBOT19NRVJHRSBpcyBzaW1pbGFyIHRvIE5PX01FUkdFX05PX0hJU1RPUlkgYnV0IHRoZSBzZXJ2ZXIgd2lsbCByZW1lbWJlciB0aGUgSURzIGl0IGhhc1xuICAvLyBzZW50IHRvIHRoZSBjbGllbnQgc28gaXQgY2FuIHJlbW92ZSB0aGVtIHdoZW4gYSBzdWJzY3JpcHRpb24gaXMgc3RvcHBlZC5cbiAgLy8gVGhpcyBzdHJhdGVneSBjYW4gYmUgdXNlZCB3aGVuIGEgY29sbGVjdGlvbiBpcyBvbmx5IHVzZWQgaW4gYSBzaW5nbGUgcHVibGljYXRpb24uXG4gIE5PX01FUkdFOiB7XG4gICAgdXNlRHVtbXlEb2N1bWVudFZpZXc6IGZhbHNlLFxuICAgIHVzZUNvbGxlY3Rpb25WaWV3OiBmYWxzZSxcbiAgICBkb0FjY291bnRpbmdGb3JDb2xsZWN0aW9uOiB0cnVlLFxuICB9LFxuICAvLyBOT19NRVJHRV9NVUxUSSBpcyBzaW1pbGFyIHRvIGBOT19NRVJHRWAsIGJ1dCBpdCBkb2VzIHRyYWNrIHdoZXRoZXIgYSBkb2N1bWVudCBpc1xuICAvLyB1c2VkIGJ5IG11bHRpcGxlIHB1YmxpY2F0aW9ucy4gVGhpcyBoYXMgc29tZSBtZW1vcnkgb3ZlcmhlYWQsIGJ1dCBpdCBzdGlsbCBkb2VzIG5vdCBkb1xuICAvLyBkaWZmaW5nIHNvIGl0J3MgZmFzdGVyIGFuZCBzbGltbWVyIHRoYW4gU0VSVkVSX01FUkdFLlxuICBOT19NRVJHRV9NVUxUSToge1xuICAgIHVzZUR1bW15RG9jdW1lbnRWaWV3OiB0cnVlLFxuICAgIHVzZUNvbGxlY3Rpb25WaWV3OiB0cnVlLFxuICAgIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IHRydWVcbiAgfVxufTtcblxuRERQU2VydmVyLnB1YmxpY2F0aW9uU3RyYXRlZ2llcyA9IHB1YmxpY2F0aW9uU3RyYXRlZ2llcztcblxuLy8gVGhpcyBmaWxlIGNvbnRhaW5zIGNsYXNzZXM6XG4vLyAqIFNlc3Npb24gLSBUaGUgc2VydmVyJ3MgY29ubmVjdGlvbiB0byBhIHNpbmdsZSBERFAgY2xpZW50XG4vLyAqIFN1YnNjcmlwdGlvbiAtIEEgc2luZ2xlIHN1YnNjcmlwdGlvbiBmb3IgYSBzaW5nbGUgY2xpZW50XG4vLyAqIFNlcnZlciAtIEFuIGVudGlyZSBzZXJ2ZXIgdGhhdCBtYXkgdGFsayB0byA+IDEgY2xpZW50LiBBIEREUCBlbmRwb2ludC5cbi8vXG4vLyBTZXNzaW9uIGFuZCBTdWJzY3JpcHRpb24gYXJlIGZpbGUgc2NvcGUuIEZvciBub3csIHVudGlsIHdlIGZyZWV6ZVxuLy8gdGhlIGludGVyZmFjZSwgU2VydmVyIGlzIHBhY2thZ2Ugc2NvcGUgKGluIHRoZSBmdXR1cmUgaXQgc2hvdWxkIGJlXG4vLyBleHBvcnRlZCkuXG52YXIgRHVtbXlEb2N1bWVudFZpZXcgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5leGlzdHNJbiA9IG5ldyBTZXQoKTsgLy8gc2V0IG9mIHN1YnNjcmlwdGlvbkhhbmRsZVxuICBzZWxmLmRhdGFCeUtleSA9IG5ldyBNYXAoKTsgLy8ga2V5LT4gWyB7c3Vic2NyaXB0aW9uSGFuZGxlLCB2YWx1ZX0gYnkgcHJlY2VkZW5jZV1cbn07XG5cbk9iamVjdC5hc3NpZ24oRHVtbXlEb2N1bWVudFZpZXcucHJvdG90eXBlLCB7XG4gIGdldEZpZWxkczogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB7fVxuICB9LFxuXG4gIGNsZWFyRmllbGQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgY2hhbmdlQ29sbGVjdG9yKSB7XG4gICAgY2hhbmdlQ29sbGVjdG9yW2tleV0gPSB1bmRlZmluZWRcbiAgfSxcblxuICBjaGFuZ2VGaWVsZDogZnVuY3Rpb24gKHN1YnNjcmlwdGlvbkhhbmRsZSwga2V5LCB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VDb2xsZWN0b3IsIGlzQWRkKSB7XG4gICAgY2hhbmdlQ29sbGVjdG9yW2tleV0gPSB2YWx1ZVxuICB9XG59KTtcblxuLy8gUmVwcmVzZW50cyBhIHNpbmdsZSBkb2N1bWVudCBpbiBhIFNlc3Npb25Db2xsZWN0aW9uVmlld1xudmFyIFNlc3Npb25Eb2N1bWVudFZpZXcgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5leGlzdHNJbiA9IG5ldyBTZXQoKTsgLy8gc2V0IG9mIHN1YnNjcmlwdGlvbkhhbmRsZVxuICBzZWxmLmRhdGFCeUtleSA9IG5ldyBNYXAoKTsgLy8ga2V5LT4gWyB7c3Vic2NyaXB0aW9uSGFuZGxlLCB2YWx1ZX0gYnkgcHJlY2VkZW5jZV1cbn07XG5cbkREUFNlcnZlci5fU2Vzc2lvbkRvY3VtZW50VmlldyA9IFNlc3Npb25Eb2N1bWVudFZpZXc7XG5cbkREUFNlcnZlci5fZ2V0Q3VycmVudEZlbmNlID0gZnVuY3Rpb24gKCkge1xuICBsZXQgY3VycmVudEludm9jYXRpb24gPSB0aGlzLl9DdXJyZW50V3JpdGVGZW5jZS5nZXQoKTtcbiAgaWYgKGN1cnJlbnRJbnZvY2F0aW9uKSB7XG4gICAgcmV0dXJuIGN1cnJlbnRJbnZvY2F0aW9uO1xuICB9XG4gIGN1cnJlbnRJbnZvY2F0aW9uID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgcmV0dXJuIGN1cnJlbnRJbnZvY2F0aW9uID8gY3VycmVudEludm9jYXRpb24uZmVuY2UgOiB1bmRlZmluZWQ7XG59O1xuXG5fLmV4dGVuZChTZXNzaW9uRG9jdW1lbnRWaWV3LnByb3RvdHlwZSwge1xuXG4gIGdldEZpZWxkczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcmV0ID0ge307XG4gICAgc2VsZi5kYXRhQnlLZXkuZm9yRWFjaChmdW5jdGlvbiAocHJlY2VkZW5jZUxpc3QsIGtleSkge1xuICAgICAgcmV0W2tleV0gPSBwcmVjZWRlbmNlTGlzdFswXS52YWx1ZTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmV0O1xuICB9LFxuXG4gIGNsZWFyRmllbGQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgY2hhbmdlQ29sbGVjdG9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC8vIFB1Ymxpc2ggQVBJIGlnbm9yZXMgX2lkIGlmIHByZXNlbnQgaW4gZmllbGRzXG4gICAgaWYgKGtleSA9PT0gXCJfaWRcIilcbiAgICAgIHJldHVybjtcbiAgICB2YXIgcHJlY2VkZW5jZUxpc3QgPSBzZWxmLmRhdGFCeUtleS5nZXQoa2V5KTtcblxuICAgIC8vIEl0J3Mgb2theSB0byBjbGVhciBmaWVsZHMgdGhhdCBkaWRuJ3QgZXhpc3QuIE5vIG5lZWQgdG8gdGhyb3dcbiAgICAvLyBhbiBlcnJvci5cbiAgICBpZiAoIXByZWNlZGVuY2VMaXN0KVxuICAgICAgcmV0dXJuO1xuXG4gICAgdmFyIHJlbW92ZWRWYWx1ZSA9IHVuZGVmaW5lZDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByZWNlZGVuY2VMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcHJlY2VkZW5jZSA9IHByZWNlZGVuY2VMaXN0W2ldO1xuICAgICAgaWYgKHByZWNlZGVuY2Uuc3Vic2NyaXB0aW9uSGFuZGxlID09PSBzdWJzY3JpcHRpb25IYW5kbGUpIHtcbiAgICAgICAgLy8gVGhlIHZpZXcncyB2YWx1ZSBjYW4gb25seSBjaGFuZ2UgaWYgdGhpcyBzdWJzY3JpcHRpb24gaXMgdGhlIG9uZSB0aGF0XG4gICAgICAgIC8vIHVzZWQgdG8gaGF2ZSBwcmVjZWRlbmNlLlxuICAgICAgICBpZiAoaSA9PT0gMClcbiAgICAgICAgICByZW1vdmVkVmFsdWUgPSBwcmVjZWRlbmNlLnZhbHVlO1xuICAgICAgICBwcmVjZWRlbmNlTGlzdC5zcGxpY2UoaSwgMSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAocHJlY2VkZW5jZUxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICBzZWxmLmRhdGFCeUtleS5kZWxldGUoa2V5KTtcbiAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSBpZiAocmVtb3ZlZFZhbHVlICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICAgICFFSlNPTi5lcXVhbHMocmVtb3ZlZFZhbHVlLCBwcmVjZWRlbmNlTGlzdFswXS52YWx1ZSkpIHtcbiAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gcHJlY2VkZW5jZUxpc3RbMF0udmFsdWU7XG4gICAgfVxuICB9LFxuXG4gIGNoYW5nZUZpZWxkOiBmdW5jdGlvbiAoc3Vic2NyaXB0aW9uSGFuZGxlLCBrZXksIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZUNvbGxlY3RvciwgaXNBZGQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gUHVibGlzaCBBUEkgaWdub3JlcyBfaWQgaWYgcHJlc2VudCBpbiBmaWVsZHNcbiAgICBpZiAoa2V5ID09PSBcIl9pZFwiKVxuICAgICAgcmV0dXJuO1xuXG4gICAgLy8gRG9uJ3Qgc2hhcmUgc3RhdGUgd2l0aCB0aGUgZGF0YSBwYXNzZWQgaW4gYnkgdGhlIHVzZXIuXG4gICAgdmFsdWUgPSBFSlNPTi5jbG9uZSh2YWx1ZSk7XG5cbiAgICBpZiAoIXNlbGYuZGF0YUJ5S2V5LmhhcyhrZXkpKSB7XG4gICAgICBzZWxmLmRhdGFCeUtleS5zZXQoa2V5LCBbe3N1YnNjcmlwdGlvbkhhbmRsZTogc3Vic2NyaXB0aW9uSGFuZGxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWV9XSk7XG4gICAgICBjaGFuZ2VDb2xsZWN0b3Jba2V5XSA9IHZhbHVlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgcHJlY2VkZW5jZUxpc3QgPSBzZWxmLmRhdGFCeUtleS5nZXQoa2V5KTtcbiAgICB2YXIgZWx0O1xuICAgIGlmICghaXNBZGQpIHtcbiAgICAgIGVsdCA9IHByZWNlZGVuY2VMaXN0LmZpbmQoZnVuY3Rpb24gKHByZWNlZGVuY2UpIHtcbiAgICAgICAgICByZXR1cm4gcHJlY2VkZW5jZS5zdWJzY3JpcHRpb25IYW5kbGUgPT09IHN1YnNjcmlwdGlvbkhhbmRsZTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChlbHQpIHtcbiAgICAgIGlmIChlbHQgPT09IHByZWNlZGVuY2VMaXN0WzBdICYmICFFSlNPTi5lcXVhbHModmFsdWUsIGVsdC52YWx1ZSkpIHtcbiAgICAgICAgLy8gdGhpcyBzdWJzY3JpcHRpb24gaXMgY2hhbmdpbmcgdGhlIHZhbHVlIG9mIHRoaXMgZmllbGQuXG4gICAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gdmFsdWU7XG4gICAgICB9XG4gICAgICBlbHQudmFsdWUgPSB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdGhpcyBzdWJzY3JpcHRpb24gaXMgbmV3bHkgY2FyaW5nIGFib3V0IHRoaXMgZmllbGRcbiAgICAgIHByZWNlZGVuY2VMaXN0LnB1c2goe3N1YnNjcmlwdGlvbkhhbmRsZTogc3Vic2NyaXB0aW9uSGFuZGxlLCB2YWx1ZTogdmFsdWV9KTtcbiAgICB9XG5cbiAgfVxufSk7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGNsaWVudCdzIHZpZXcgb2YgYSBzaW5nbGUgY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IGNvbGxlY3Rpb25OYW1lIE5hbWUgb2YgdGhlIGNvbGxlY3Rpb24gaXQgcmVwcmVzZW50c1xuICogQHBhcmFtIHtPYmplY3QuPFN0cmluZywgRnVuY3Rpb24+fSBzZXNzaW9uQ2FsbGJhY2tzIFRoZSBjYWxsYmFja3MgZm9yIGFkZGVkLCBjaGFuZ2VkLCByZW1vdmVkXG4gKiBAY2xhc3MgU2Vzc2lvbkNvbGxlY3Rpb25WaWV3XG4gKi9cbnZhciBTZXNzaW9uQ29sbGVjdGlvblZpZXcgPSBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHNlc3Npb25DYWxsYmFja3MpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLmNvbGxlY3Rpb25OYW1lID0gY29sbGVjdGlvbk5hbWU7XG4gIHNlbGYuZG9jdW1lbnRzID0gbmV3IE1hcCgpO1xuICBzZWxmLmNhbGxiYWNrcyA9IHNlc3Npb25DYWxsYmFja3M7XG59O1xuXG5ERFBTZXJ2ZXIuX1Nlc3Npb25Db2xsZWN0aW9uVmlldyA9IFNlc3Npb25Db2xsZWN0aW9uVmlldztcblxuXG5PYmplY3QuYXNzaWduKFNlc3Npb25Db2xsZWN0aW9uVmlldy5wcm90b3R5cGUsIHtcblxuICBpc0VtcHR5OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLmRvY3VtZW50cy5zaXplID09PSAwO1xuICB9LFxuXG4gIGRpZmY6IGZ1bmN0aW9uIChwcmV2aW91cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBEaWZmU2VxdWVuY2UuZGlmZk1hcHMocHJldmlvdXMuZG9jdW1lbnRzLCBzZWxmLmRvY3VtZW50cywge1xuICAgICAgYm90aDogXy5iaW5kKHNlbGYuZGlmZkRvY3VtZW50LCBzZWxmKSxcblxuICAgICAgcmlnaHRPbmx5OiBmdW5jdGlvbiAoaWQsIG5vd0RWKSB7XG4gICAgICAgIHNlbGYuY2FsbGJhY2tzLmFkZGVkKHNlbGYuY29sbGVjdGlvbk5hbWUsIGlkLCBub3dEVi5nZXRGaWVsZHMoKSk7XG4gICAgICB9LFxuXG4gICAgICBsZWZ0T25seTogZnVuY3Rpb24gKGlkLCBwcmV2RFYpIHtcbiAgICAgICAgc2VsZi5jYWxsYmFja3MucmVtb3ZlZChzZWxmLmNvbGxlY3Rpb25OYW1lLCBpZCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG5cbiAgZGlmZkRvY3VtZW50OiBmdW5jdGlvbiAoaWQsIHByZXZEViwgbm93RFYpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGZpZWxkcyA9IHt9O1xuICAgIERpZmZTZXF1ZW5jZS5kaWZmT2JqZWN0cyhwcmV2RFYuZ2V0RmllbGRzKCksIG5vd0RWLmdldEZpZWxkcygpLCB7XG4gICAgICBib3RoOiBmdW5jdGlvbiAoa2V5LCBwcmV2LCBub3cpIHtcbiAgICAgICAgaWYgKCFFSlNPTi5lcXVhbHMocHJldiwgbm93KSlcbiAgICAgICAgICBmaWVsZHNba2V5XSA9IG5vdztcbiAgICAgIH0sXG4gICAgICByaWdodE9ubHk6IGZ1bmN0aW9uIChrZXksIG5vdykge1xuICAgICAgICBmaWVsZHNba2V5XSA9IG5vdztcbiAgICAgIH0sXG4gICAgICBsZWZ0T25seTogZnVuY3Rpb24oa2V5LCBwcmV2KSB7XG4gICAgICAgIGZpZWxkc1trZXldID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHNlbGYuY2FsbGJhY2tzLmNoYW5nZWQoc2VsZi5jb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcyk7XG4gIH0sXG5cbiAgYWRkZWQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGlkLCBmaWVsZHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGRvY1ZpZXcgPSBzZWxmLmRvY3VtZW50cy5nZXQoaWQpO1xuICAgIHZhciBhZGRlZCA9IGZhbHNlO1xuICAgIGlmICghZG9jVmlldykge1xuICAgICAgYWRkZWQgPSB0cnVlO1xuICAgICAgaWYgKE1ldGVvci5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneSh0aGlzLmNvbGxlY3Rpb25OYW1lKS51c2VEdW1teURvY3VtZW50Vmlldykge1xuICAgICAgICBkb2NWaWV3ID0gbmV3IER1bW15RG9jdW1lbnRWaWV3KCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkb2NWaWV3ID0gbmV3IFNlc3Npb25Eb2N1bWVudFZpZXcoKTtcbiAgICAgIH1cblxuICAgICAgc2VsZi5kb2N1bWVudHMuc2V0KGlkLCBkb2NWaWV3KTtcbiAgICB9XG4gICAgZG9jVmlldy5leGlzdHNJbi5hZGQoc3Vic2NyaXB0aW9uSGFuZGxlKTtcbiAgICB2YXIgY2hhbmdlQ29sbGVjdG9yID0ge307XG4gICAgXy5lYWNoKGZpZWxkcywgZnVuY3Rpb24gKHZhbHVlLCBrZXkpIHtcbiAgICAgIGRvY1ZpZXcuY2hhbmdlRmllbGQoXG4gICAgICAgIHN1YnNjcmlwdGlvbkhhbmRsZSwga2V5LCB2YWx1ZSwgY2hhbmdlQ29sbGVjdG9yLCB0cnVlKTtcbiAgICB9KTtcbiAgICBpZiAoYWRkZWQpXG4gICAgICBzZWxmLmNhbGxiYWNrcy5hZGRlZChzZWxmLmNvbGxlY3Rpb25OYW1lLCBpZCwgY2hhbmdlQ29sbGVjdG9yKTtcbiAgICBlbHNlXG4gICAgICBzZWxmLmNhbGxiYWNrcy5jaGFuZ2VkKHNlbGYuY29sbGVjdGlvbk5hbWUsIGlkLCBjaGFuZ2VDb2xsZWN0b3IpO1xuICB9LFxuXG4gIGNoYW5nZWQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGlkLCBjaGFuZ2VkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBjaGFuZ2VkUmVzdWx0ID0ge307XG4gICAgdmFyIGRvY1ZpZXcgPSBzZWxmLmRvY3VtZW50cy5nZXQoaWQpO1xuICAgIGlmICghZG9jVmlldylcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNvdWxkIG5vdCBmaW5kIGVsZW1lbnQgd2l0aCBpZCBcIiArIGlkICsgXCIgdG8gY2hhbmdlXCIpO1xuICAgIF8uZWFjaChjaGFuZ2VkLCBmdW5jdGlvbiAodmFsdWUsIGtleSkge1xuICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpXG4gICAgICAgIGRvY1ZpZXcuY2xlYXJGaWVsZChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgY2hhbmdlZFJlc3VsdCk7XG4gICAgICBlbHNlXG4gICAgICAgIGRvY1ZpZXcuY2hhbmdlRmllbGQoc3Vic2NyaXB0aW9uSGFuZGxlLCBrZXksIHZhbHVlLCBjaGFuZ2VkUmVzdWx0KTtcbiAgICB9KTtcbiAgICBzZWxmLmNhbGxiYWNrcy5jaGFuZ2VkKHNlbGYuY29sbGVjdGlvbk5hbWUsIGlkLCBjaGFuZ2VkUmVzdWx0KTtcbiAgfSxcblxuICByZW1vdmVkOiBmdW5jdGlvbiAoc3Vic2NyaXB0aW9uSGFuZGxlLCBpZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgZG9jVmlldyA9IHNlbGYuZG9jdW1lbnRzLmdldChpZCk7XG4gICAgaWYgKCFkb2NWaWV3KSB7XG4gICAgICB2YXIgZXJyID0gbmV3IEVycm9yKFwiUmVtb3ZlZCBub25leGlzdGVudCBkb2N1bWVudCBcIiArIGlkKTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gICAgZG9jVmlldy5leGlzdHNJbi5kZWxldGUoc3Vic2NyaXB0aW9uSGFuZGxlKTtcbiAgICBpZiAoZG9jVmlldy5leGlzdHNJbi5zaXplID09PSAwKSB7XG4gICAgICAvLyBpdCBpcyBnb25lIGZyb20gZXZlcnlvbmVcbiAgICAgIHNlbGYuY2FsbGJhY2tzLnJlbW92ZWQoc2VsZi5jb2xsZWN0aW9uTmFtZSwgaWQpO1xuICAgICAgc2VsZi5kb2N1bWVudHMuZGVsZXRlKGlkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGNoYW5nZWQgPSB7fTtcbiAgICAgIC8vIHJlbW92ZSB0aGlzIHN1YnNjcmlwdGlvbiBmcm9tIGV2ZXJ5IHByZWNlZGVuY2UgbGlzdFxuICAgICAgLy8gYW5kIHJlY29yZCB0aGUgY2hhbmdlc1xuICAgICAgZG9jVmlldy5kYXRhQnlLZXkuZm9yRWFjaChmdW5jdGlvbiAocHJlY2VkZW5jZUxpc3QsIGtleSkge1xuICAgICAgICBkb2NWaWV3LmNsZWFyRmllbGQoc3Vic2NyaXB0aW9uSGFuZGxlLCBrZXksIGNoYW5nZWQpO1xuICAgICAgfSk7XG5cbiAgICAgIHNlbGYuY2FsbGJhY2tzLmNoYW5nZWQoc2VsZi5jb2xsZWN0aW9uTmFtZSwgaWQsIGNoYW5nZWQpO1xuICAgIH1cbiAgfVxufSk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKiBTZXNzaW9uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqL1xuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxudmFyIFNlc3Npb24gPSBmdW5jdGlvbiAoc2VydmVyLCB2ZXJzaW9uLCBzb2NrZXQsIG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLmlkID0gUmFuZG9tLmlkKCk7XG5cbiAgc2VsZi5zZXJ2ZXIgPSBzZXJ2ZXI7XG4gIHNlbGYudmVyc2lvbiA9IHZlcnNpb247XG5cbiAgc2VsZi5pbml0aWFsaXplZCA9IGZhbHNlO1xuICBzZWxmLnNvY2tldCA9IHNvY2tldDtcblxuICAvLyBTZXQgdG8gbnVsbCB3aGVuIHRoZSBzZXNzaW9uIGlzIGRlc3Ryb3llZC4gTXVsdGlwbGUgcGxhY2VzIGJlbG93XG4gIC8vIHVzZSB0aGlzIHRvIGRldGVybWluZSBpZiB0aGUgc2Vzc2lvbiBpcyBhbGl2ZSBvciBub3QuXG4gIHNlbGYuaW5RdWV1ZSA9IG5ldyBNZXRlb3IuX0RvdWJsZUVuZGVkUXVldWUoKTtcblxuICBzZWxmLmJsb2NrZWQgPSBmYWxzZTtcbiAgc2VsZi53b3JrZXJSdW5uaW5nID0gZmFsc2U7XG5cbiAgc2VsZi5jYWNoZWRVbmJsb2NrID0gbnVsbDtcblxuICAvLyBTdWIgb2JqZWN0cyBmb3IgYWN0aXZlIHN1YnNjcmlwdGlvbnNcbiAgc2VsZi5fbmFtZWRTdWJzID0gbmV3IE1hcCgpO1xuICBzZWxmLl91bml2ZXJzYWxTdWJzID0gW107XG5cbiAgc2VsZi51c2VySWQgPSBudWxsO1xuXG4gIHNlbGYuY29sbGVjdGlvblZpZXdzID0gbmV3IE1hcCgpO1xuXG4gIC8vIFNldCB0aGlzIHRvIGZhbHNlIHRvIG5vdCBzZW5kIG1lc3NhZ2VzIHdoZW4gY29sbGVjdGlvblZpZXdzIGFyZVxuICAvLyBtb2RpZmllZC4gVGhpcyBpcyBkb25lIHdoZW4gcmVydW5uaW5nIHN1YnMgaW4gX3NldFVzZXJJZCBhbmQgdGhvc2UgbWVzc2FnZXNcbiAgLy8gYXJlIGNhbGN1bGF0ZWQgdmlhIGEgZGlmZiBpbnN0ZWFkLlxuICBzZWxmLl9pc1NlbmRpbmcgPSB0cnVlO1xuXG4gIC8vIElmIHRoaXMgaXMgdHJ1ZSwgZG9uJ3Qgc3RhcnQgYSBuZXdseS1jcmVhdGVkIHVuaXZlcnNhbCBwdWJsaXNoZXIgb24gdGhpc1xuICAvLyBzZXNzaW9uLiBUaGUgc2Vzc2lvbiB3aWxsIHRha2UgY2FyZSBvZiBzdGFydGluZyBpdCB3aGVuIGFwcHJvcHJpYXRlLlxuICBzZWxmLl9kb250U3RhcnROZXdVbml2ZXJzYWxTdWJzID0gZmFsc2U7XG5cbiAgLy8gV2hlbiB3ZSBhcmUgcmVydW5uaW5nIHN1YnNjcmlwdGlvbnMsIGFueSByZWFkeSBtZXNzYWdlc1xuICAvLyB3ZSB3YW50IHRvIGJ1ZmZlciB1cCBmb3Igd2hlbiB3ZSBhcmUgZG9uZSByZXJ1bm5pbmcgc3Vic2NyaXB0aW9uc1xuICBzZWxmLl9wZW5kaW5nUmVhZHkgPSBbXTtcblxuICAvLyBMaXN0IG9mIGNhbGxiYWNrcyB0byBjYWxsIHdoZW4gdGhpcyBjb25uZWN0aW9uIGlzIGNsb3NlZC5cbiAgc2VsZi5fY2xvc2VDYWxsYmFja3MgPSBbXTtcblxuXG4gIC8vIFhYWCBIQUNLOiBJZiBhIHNvY2tqcyBjb25uZWN0aW9uLCBzYXZlIG9mZiB0aGUgVVJMLiBUaGlzIGlzXG4gIC8vIHRlbXBvcmFyeSBhbmQgd2lsbCBnbyBhd2F5IGluIHRoZSBuZWFyIGZ1dHVyZS5cbiAgc2VsZi5fc29ja2V0VXJsID0gc29ja2V0LnVybDtcblxuICAvLyBBbGxvdyB0ZXN0cyB0byBkaXNhYmxlIHJlc3BvbmRpbmcgdG8gcGluZ3MuXG4gIHNlbGYuX3Jlc3BvbmRUb1BpbmdzID0gb3B0aW9ucy5yZXNwb25kVG9QaW5ncztcblxuICAvLyBUaGlzIG9iamVjdCBpcyB0aGUgcHVibGljIGludGVyZmFjZSB0byB0aGUgc2Vzc2lvbi4gSW4gdGhlIHB1YmxpY1xuICAvLyBBUEksIGl0IGlzIGNhbGxlZCB0aGUgYGNvbm5lY3Rpb25gIG9iamVjdC4gIEludGVybmFsbHkgd2UgY2FsbCBpdFxuICAvLyBhIGBjb25uZWN0aW9uSGFuZGxlYCB0byBhdm9pZCBhbWJpZ3VpdHkuXG4gIHNlbGYuY29ubmVjdGlvbkhhbmRsZSA9IHtcbiAgICBpZDogc2VsZi5pZCxcbiAgICBjbG9zZTogZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5jbG9zZSgpO1xuICAgIH0sXG4gICAgb25DbG9zZTogZnVuY3Rpb24gKGZuKSB7XG4gICAgICB2YXIgY2IgPSBNZXRlb3IuYmluZEVudmlyb25tZW50KGZuLCBcImNvbm5lY3Rpb24gb25DbG9zZSBjYWxsYmFja1wiKTtcbiAgICAgIGlmIChzZWxmLmluUXVldWUpIHtcbiAgICAgICAgc2VsZi5fY2xvc2VDYWxsYmFja3MucHVzaChjYik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBpZiB3ZSdyZSBhbHJlYWR5IGNsb3NlZCwgY2FsbCB0aGUgY2FsbGJhY2suXG4gICAgICAgIE1ldGVvci5kZWZlcihjYik7XG4gICAgICB9XG4gICAgfSxcbiAgICBjbGllbnRBZGRyZXNzOiBzZWxmLl9jbGllbnRBZGRyZXNzKCksXG4gICAgaHR0cEhlYWRlcnM6IHNlbGYuc29ja2V0LmhlYWRlcnNcbiAgfTtcblxuICBzZWxmLnNlbmQoeyBtc2c6ICdjb25uZWN0ZWQnLCBzZXNzaW9uOiBzZWxmLmlkIH0pO1xuXG4gIC8vIE9uIGluaXRpYWwgY29ubmVjdCwgc3BpbiB1cCBhbGwgdGhlIHVuaXZlcnNhbCBwdWJsaXNoZXJzLlxuICBzZWxmLnN0YXJ0VW5pdmVyc2FsU3VicygpO1xuXG4gIGlmICh2ZXJzaW9uICE9PSAncHJlMScgJiYgb3B0aW9ucy5oZWFydGJlYXRJbnRlcnZhbCAhPT0gMCkge1xuICAgIC8vIFdlIG5vIGxvbmdlciBuZWVkIHRoZSBsb3cgbGV2ZWwgdGltZW91dCBiZWNhdXNlIHdlIGhhdmUgaGVhcnRiZWF0cy5cbiAgICBzb2NrZXQuc2V0V2Vic29ja2V0VGltZW91dCgwKTtcblxuICAgIHNlbGYuaGVhcnRiZWF0ID0gbmV3IEREUENvbW1vbi5IZWFydGJlYXQoe1xuICAgICAgaGVhcnRiZWF0SW50ZXJ2YWw6IG9wdGlvbnMuaGVhcnRiZWF0SW50ZXJ2YWwsXG4gICAgICBoZWFydGJlYXRUaW1lb3V0OiBvcHRpb25zLmhlYXJ0YmVhdFRpbWVvdXQsXG4gICAgICBvblRpbWVvdXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5jbG9zZSgpO1xuICAgICAgfSxcbiAgICAgIHNlbmRQaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYuc2VuZCh7bXNnOiAncGluZyd9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBzZWxmLmhlYXJ0YmVhdC5zdGFydCgpO1xuICB9XG5cbiAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgIFwibGl2ZWRhdGFcIiwgXCJzZXNzaW9uc1wiLCAxKTtcbn07XG5cbk9iamVjdC5hc3NpZ24oU2Vzc2lvbi5wcm90b3R5cGUsIHtcbiAgc2VuZFJlYWR5OiBmdW5jdGlvbiAoc3Vic2NyaXB0aW9uSWRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9pc1NlbmRpbmcpIHtcbiAgICAgIHNlbGYuc2VuZCh7bXNnOiBcInJlYWR5XCIsIHN1YnM6IHN1YnNjcmlwdGlvbklkc30pO1xuICAgIH0gZWxzZSB7XG4gICAgICBfLmVhY2goc3Vic2NyaXB0aW9uSWRzLCBmdW5jdGlvbiAoc3Vic2NyaXB0aW9uSWQpIHtcbiAgICAgICAgc2VsZi5fcGVuZGluZ1JlYWR5LnB1c2goc3Vic2NyaXB0aW9uSWQpO1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIF9jYW5TZW5kKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuX2lzU2VuZGluZyB8fCAhdGhpcy5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkudXNlQ29sbGVjdGlvblZpZXc7XG4gIH0sXG5cblxuICBzZW5kQWRkZWQoY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAodGhpcy5fY2FuU2VuZChjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgIHRoaXMuc2VuZCh7IG1zZzogJ2FkZGVkJywgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMgfSk7XG4gICAgfVxuICB9LFxuXG4gIHNlbmRDaGFuZ2VkKGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKSB7XG4gICAgaWYgKF8uaXNFbXB0eShmaWVsZHMpKVxuICAgICAgcmV0dXJuO1xuXG4gICAgaWYgKHRoaXMuX2NhblNlbmQoY29sbGVjdGlvbk5hbWUpKSB7XG4gICAgICB0aGlzLnNlbmQoe1xuICAgICAgICBtc2c6IFwiY2hhbmdlZFwiLFxuICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgaWQsXG4gICAgICAgIGZpZWxkc1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIHNlbmRSZW1vdmVkKGNvbGxlY3Rpb25OYW1lLCBpZCkge1xuICAgIGlmICh0aGlzLl9jYW5TZW5kKGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgdGhpcy5zZW5kKHttc2c6IFwicmVtb3ZlZFwiLCBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSwgaWR9KTtcbiAgICB9XG4gIH0sXG5cbiAgZ2V0U2VuZENhbGxiYWNrczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4ge1xuICAgICAgYWRkZWQ6IF8uYmluZChzZWxmLnNlbmRBZGRlZCwgc2VsZiksXG4gICAgICBjaGFuZ2VkOiBfLmJpbmQoc2VsZi5zZW5kQ2hhbmdlZCwgc2VsZiksXG4gICAgICByZW1vdmVkOiBfLmJpbmQoc2VsZi5zZW5kUmVtb3ZlZCwgc2VsZilcbiAgICB9O1xuICB9LFxuXG4gIGdldENvbGxlY3Rpb25WaWV3OiBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHJldCA9IHNlbGYuY29sbGVjdGlvblZpZXdzLmdldChjb2xsZWN0aW9uTmFtZSk7XG4gICAgaWYgKCFyZXQpIHtcbiAgICAgIHJldCA9IG5ldyBTZXNzaW9uQ29sbGVjdGlvblZpZXcoY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5nZXRTZW5kQ2FsbGJhY2tzKCkpO1xuICAgICAgc2VsZi5jb2xsZWN0aW9uVmlld3Muc2V0KGNvbGxlY3Rpb25OYW1lLCByZXQpO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xuICB9LFxuXG4gIGFkZGVkKHN1YnNjcmlwdGlvbkhhbmRsZSwgY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAodGhpcy5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkudXNlQ29sbGVjdGlvblZpZXcpIHtcbiAgICAgIGNvbnN0IHZpZXcgPSB0aGlzLmdldENvbGxlY3Rpb25WaWV3KGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgIHZpZXcuYWRkZWQoc3Vic2NyaXB0aW9uSGFuZGxlLCBpZCwgZmllbGRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZW5kQWRkZWQoY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpO1xuICAgIH1cbiAgfSxcblxuICByZW1vdmVkKHN1YnNjcmlwdGlvbkhhbmRsZSwgY29sbGVjdGlvbk5hbWUsIGlkKSB7XG4gICAgaWYgKHRoaXMuc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUpLnVzZUNvbGxlY3Rpb25WaWV3KSB7XG4gICAgICBjb25zdCB2aWV3ID0gdGhpcy5nZXRDb2xsZWN0aW9uVmlldyhjb2xsZWN0aW9uTmFtZSk7XG4gICAgICB2aWV3LnJlbW92ZWQoc3Vic2NyaXB0aW9uSGFuZGxlLCBpZCk7XG4gICAgICBpZiAodmlldy5pc0VtcHR5KCkpIHtcbiAgICAgICAgIHRoaXMuY29sbGVjdGlvblZpZXdzLmRlbGV0ZShjb2xsZWN0aW9uTmFtZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2VuZFJlbW92ZWQoY29sbGVjdGlvbk5hbWUsIGlkKTtcbiAgICB9XG4gIH0sXG5cbiAgY2hhbmdlZChzdWJzY3JpcHRpb25IYW5kbGUsIGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKSB7XG4gICAgaWYgKHRoaXMuc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUpLnVzZUNvbGxlY3Rpb25WaWV3KSB7XG4gICAgICBjb25zdCB2aWV3ID0gdGhpcy5nZXRDb2xsZWN0aW9uVmlldyhjb2xsZWN0aW9uTmFtZSk7XG4gICAgICB2aWV3LmNoYW5nZWQoc3Vic2NyaXB0aW9uSGFuZGxlLCBpZCwgZmllbGRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZW5kQ2hhbmdlZChjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcyk7XG4gICAgfVxuICB9LFxuXG4gIHN0YXJ0VW5pdmVyc2FsU3ViczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBNYWtlIGEgc2hhbGxvdyBjb3B5IG9mIHRoZSBzZXQgb2YgdW5pdmVyc2FsIGhhbmRsZXJzIGFuZCBzdGFydCB0aGVtLiBJZlxuICAgIC8vIGFkZGl0aW9uYWwgdW5pdmVyc2FsIHB1Ymxpc2hlcnMgc3RhcnQgd2hpbGUgd2UncmUgcnVubmluZyB0aGVtIChkdWUgdG9cbiAgICAvLyB5aWVsZGluZyksIHRoZXkgd2lsbCBydW4gc2VwYXJhdGVseSBhcyBwYXJ0IG9mIFNlcnZlci5wdWJsaXNoLlxuICAgIHZhciBoYW5kbGVycyA9IF8uY2xvbmUoc2VsZi5zZXJ2ZXIudW5pdmVyc2FsX3B1Ymxpc2hfaGFuZGxlcnMpO1xuICAgIF8uZWFjaChoYW5kbGVycywgZnVuY3Rpb24gKGhhbmRsZXIpIHtcbiAgICAgIHNlbGYuX3N0YXJ0U3Vic2NyaXB0aW9uKGhhbmRsZXIpO1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIERlc3Ryb3kgdGhpcyBzZXNzaW9uIGFuZCB1bnJlZ2lzdGVyIGl0IGF0IHRoZSBzZXJ2ZXIuXG4gIGNsb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gRGVzdHJveSB0aGlzIHNlc3Npb24sIGV2ZW4gaWYgaXQncyBub3QgcmVnaXN0ZXJlZCBhdCB0aGVcbiAgICAvLyBzZXJ2ZXIuIFN0b3AgYWxsIHByb2Nlc3NpbmcgYW5kIHRlYXIgZXZlcnl0aGluZyBkb3duLiBJZiBhIHNvY2tldFxuICAgIC8vIHdhcyBhdHRhY2hlZCwgY2xvc2UgaXQuXG5cbiAgICAvLyBBbHJlYWR5IGRlc3Ryb3llZC5cbiAgICBpZiAoISBzZWxmLmluUXVldWUpXG4gICAgICByZXR1cm47XG5cbiAgICAvLyBEcm9wIHRoZSBtZXJnZSBib3ggZGF0YSBpbW1lZGlhdGVseS5cbiAgICBzZWxmLmluUXVldWUgPSBudWxsO1xuICAgIHNlbGYuY29sbGVjdGlvblZpZXdzID0gbmV3IE1hcCgpO1xuXG4gICAgaWYgKHNlbGYuaGVhcnRiZWF0KSB7XG4gICAgICBzZWxmLmhlYXJ0YmVhdC5zdG9wKCk7XG4gICAgICBzZWxmLmhlYXJ0YmVhdCA9IG51bGw7XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuc29ja2V0KSB7XG4gICAgICBzZWxmLnNvY2tldC5jbG9zZSgpO1xuICAgICAgc2VsZi5zb2NrZXQuX21ldGVvclNlc3Npb24gPSBudWxsO1xuICAgIH1cblxuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgIFwibGl2ZWRhdGFcIiwgXCJzZXNzaW9uc1wiLCAtMSk7XG5cbiAgICBNZXRlb3IuZGVmZXIoZnVuY3Rpb24gKCkge1xuICAgICAgLy8gU3RvcCBjYWxsYmFja3MgY2FuIHlpZWxkLCBzbyB3ZSBkZWZlciB0aGlzIG9uIGNsb3NlLlxuICAgICAgLy8gc3ViLl9pc0RlYWN0aXZhdGVkKCkgZGV0ZWN0cyB0aGF0IHdlIHNldCBpblF1ZXVlIHRvIG51bGwgYW5kXG4gICAgICAvLyB0cmVhdHMgaXQgYXMgc2VtaS1kZWFjdGl2YXRlZCAoaXQgd2lsbCBpZ25vcmUgaW5jb21pbmcgY2FsbGJhY2tzLCBldGMpLlxuICAgICAgc2VsZi5fZGVhY3RpdmF0ZUFsbFN1YnNjcmlwdGlvbnMoKTtcblxuICAgICAgLy8gRGVmZXIgY2FsbGluZyB0aGUgY2xvc2UgY2FsbGJhY2tzLCBzbyB0aGF0IHRoZSBjYWxsZXIgY2xvc2luZ1xuICAgICAgLy8gdGhlIHNlc3Npb24gaXNuJ3Qgd2FpdGluZyBmb3IgYWxsIHRoZSBjYWxsYmFja3MgdG8gY29tcGxldGUuXG4gICAgICBfLmVhY2goc2VsZi5fY2xvc2VDYWxsYmFja3MsIGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICAvLyBVbnJlZ2lzdGVyIHRoZSBzZXNzaW9uLlxuICAgIHNlbGYuc2VydmVyLl9yZW1vdmVTZXNzaW9uKHNlbGYpO1xuICB9LFxuXG4gIC8vIFNlbmQgYSBtZXNzYWdlIChkb2luZyBub3RoaW5nIGlmIG5vIHNvY2tldCBpcyBjb25uZWN0ZWQgcmlnaHQgbm93KS5cbiAgLy8gSXQgc2hvdWxkIGJlIGEgSlNPTiBvYmplY3QgKGl0IHdpbGwgYmUgc3RyaW5naWZpZWQpLlxuICBzZW5kOiBmdW5jdGlvbiAobXNnKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuc29ja2V0KSB7XG4gICAgICBpZiAoTWV0ZW9yLl9wcmludFNlbnRERFApXG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJTZW50IEREUFwiLCBERFBDb21tb24uc3RyaW5naWZ5RERQKG1zZykpO1xuICAgICAgc2VsZi5zb2NrZXQuc2VuZChERFBDb21tb24uc3RyaW5naWZ5RERQKG1zZykpO1xuICAgIH1cbiAgfSxcblxuICAvLyBTZW5kIGEgY29ubmVjdGlvbiBlcnJvci5cbiAgc2VuZEVycm9yOiBmdW5jdGlvbiAocmVhc29uLCBvZmZlbmRpbmdNZXNzYWdlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBtc2cgPSB7bXNnOiAnZXJyb3InLCByZWFzb246IHJlYXNvbn07XG4gICAgaWYgKG9mZmVuZGluZ01lc3NhZ2UpXG4gICAgICBtc2cub2ZmZW5kaW5nTWVzc2FnZSA9IG9mZmVuZGluZ01lc3NhZ2U7XG4gICAgc2VsZi5zZW5kKG1zZyk7XG4gIH0sXG5cbiAgLy8gUHJvY2VzcyAnbXNnJyBhcyBhbiBpbmNvbWluZyBtZXNzYWdlLiBBcyBhIGd1YXJkIGFnYWluc3RcbiAgLy8gcmFjZSBjb25kaXRpb25zIGR1cmluZyByZWNvbm5lY3Rpb24sIGlnbm9yZSB0aGUgbWVzc2FnZSBpZlxuICAvLyAnc29ja2V0JyBpcyBub3QgdGhlIGN1cnJlbnRseSBjb25uZWN0ZWQgc29ja2V0LlxuICAvL1xuICAvLyBXZSBydW4gdGhlIG1lc3NhZ2VzIGZyb20gdGhlIGNsaWVudCBvbmUgYXQgYSB0aW1lLCBpbiB0aGUgb3JkZXJcbiAgLy8gZ2l2ZW4gYnkgdGhlIGNsaWVudC4gVGhlIG1lc3NhZ2UgaGFuZGxlciBpcyBwYXNzZWQgYW4gaWRlbXBvdGVudFxuICAvLyBmdW5jdGlvbiAndW5ibG9jaycgd2hpY2ggaXQgbWF5IGNhbGwgdG8gYWxsb3cgb3RoZXIgbWVzc2FnZXMgdG9cbiAgLy8gYmVnaW4gcnVubmluZyBpbiBwYXJhbGxlbCBpbiBhbm90aGVyIGZpYmVyIChmb3IgZXhhbXBsZSwgYSBtZXRob2RcbiAgLy8gdGhhdCB3YW50cyB0byB5aWVsZCkuIE90aGVyd2lzZSwgaXQgaXMgYXV0b21hdGljYWxseSB1bmJsb2NrZWRcbiAgLy8gd2hlbiBpdCByZXR1cm5zLlxuICAvL1xuICAvLyBBY3R1YWxseSwgd2UgZG9uJ3QgaGF2ZSB0byAndG90YWxseSBvcmRlcicgdGhlIG1lc3NhZ2VzIGluIHRoaXNcbiAgLy8gd2F5LCBidXQgaXQncyB0aGUgZWFzaWVzdCB0aGluZyB0aGF0J3MgY29ycmVjdC4gKHVuc3ViIG5lZWRzIHRvXG4gIC8vIGJlIG9yZGVyZWQgYWdhaW5zdCBzdWIsIG1ldGhvZHMgbmVlZCB0byBiZSBvcmRlcmVkIGFnYWluc3QgZWFjaFxuICAvLyBvdGhlcikuXG4gIHByb2Nlc3NNZXNzYWdlOiBmdW5jdGlvbiAobXNnX2luKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5pblF1ZXVlKSAvLyB3ZSBoYXZlIGJlZW4gZGVzdHJveWVkLlxuICAgICAgcmV0dXJuO1xuXG4gICAgLy8gUmVzcG9uZCB0byBwaW5nIGFuZCBwb25nIG1lc3NhZ2VzIGltbWVkaWF0ZWx5IHdpdGhvdXQgcXVldWluZy5cbiAgICAvLyBJZiB0aGUgbmVnb3RpYXRlZCBERFAgdmVyc2lvbiBpcyBcInByZTFcIiB3aGljaCBkaWRuJ3Qgc3VwcG9ydFxuICAgIC8vIHBpbmdzLCBwcmVzZXJ2ZSB0aGUgXCJwcmUxXCIgYmVoYXZpb3Igb2YgcmVzcG9uZGluZyB3aXRoIGEgXCJiYWRcbiAgICAvLyByZXF1ZXN0XCIgZm9yIHRoZSB1bmtub3duIG1lc3NhZ2VzLlxuICAgIC8vXG4gICAgLy8gRmliZXJzIGFyZSBuZWVkZWQgYmVjYXVzZSBoZWFydGJlYXRzIHVzZSBNZXRlb3Iuc2V0VGltZW91dCwgd2hpY2hcbiAgICAvLyBuZWVkcyBhIEZpYmVyLiBXZSBjb3VsZCBhY3R1YWxseSB1c2UgcmVndWxhciBzZXRUaW1lb3V0IGFuZCBhdm9pZFxuICAgIC8vIHRoZXNlIG5ldyBmaWJlcnMsIGJ1dCBpdCBpcyBlYXNpZXIgdG8ganVzdCBtYWtlIGV2ZXJ5dGhpbmcgdXNlXG4gICAgLy8gTWV0ZW9yLnNldFRpbWVvdXQgYW5kIG5vdCB0aGluayB0b28gaGFyZC5cbiAgICAvL1xuICAgIC8vIEFueSBtZXNzYWdlIGNvdW50cyBhcyByZWNlaXZpbmcgYSBwb25nLCBhcyBpdCBkZW1vbnN0cmF0ZXMgdGhhdFxuICAgIC8vIHRoZSBjbGllbnQgaXMgc3RpbGwgYWxpdmUuXG4gICAgaWYgKHNlbGYuaGVhcnRiZWF0KSB7XG4gICAgICBzZWxmLmhlYXJ0YmVhdC5tZXNzYWdlUmVjZWl2ZWQoKTtcbiAgICB9O1xuXG4gICAgaWYgKHNlbGYudmVyc2lvbiAhPT0gJ3ByZTEnICYmIG1zZ19pbi5tc2cgPT09ICdwaW5nJykge1xuICAgICAgaWYgKHNlbGYuX3Jlc3BvbmRUb1BpbmdzKVxuICAgICAgICBzZWxmLnNlbmQoe21zZzogXCJwb25nXCIsIGlkOiBtc2dfaW4uaWR9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHNlbGYudmVyc2lvbiAhPT0gJ3ByZTEnICYmIG1zZ19pbi5tc2cgPT09ICdwb25nJykge1xuICAgICAgLy8gU2luY2UgZXZlcnl0aGluZyBpcyBhIHBvbmcsIHRoZXJlIGlzIG5vdGhpbmcgdG8gZG9cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzZWxmLmluUXVldWUucHVzaChtc2dfaW4pO1xuICAgIGlmIChzZWxmLndvcmtlclJ1bm5pbmcpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi53b3JrZXJSdW5uaW5nID0gdHJ1ZTtcblxuICAgIHZhciBwcm9jZXNzTmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBtc2cgPSBzZWxmLmluUXVldWUgJiYgc2VsZi5pblF1ZXVlLnNoaWZ0KCk7XG5cbiAgICAgIGlmICghbXNnKSB7XG4gICAgICAgIHNlbGYud29ya2VyUnVubmluZyA9IGZhbHNlO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHJ1bkhhbmRsZXJzKCkge1xuICAgICAgICB2YXIgYmxvY2tlZCA9IHRydWU7XG5cbiAgICAgICAgdmFyIHVuYmxvY2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgaWYgKCFibG9ja2VkKVxuICAgICAgICAgICAgcmV0dXJuOyAvLyBpZGVtcG90ZW50XG4gICAgICAgICAgYmxvY2tlZCA9IGZhbHNlO1xuICAgICAgICAgIHByb2Nlc3NOZXh0KCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2VsZi5zZXJ2ZXIub25NZXNzYWdlSG9vay5lYWNoKGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICAgIGNhbGxiYWNrKG1zZywgc2VsZik7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChfLmhhcyhzZWxmLnByb3RvY29sX2hhbmRsZXJzLCBtc2cubXNnKSkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHNlbGYucHJvdG9jb2xfaGFuZGxlcnNbbXNnLm1zZ10uY2FsbChcbiAgICAgICAgICAgIHNlbGYsXG4gICAgICAgICAgICBtc2csXG4gICAgICAgICAgICB1bmJsb2NrXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGlmIChNZXRlb3IuX2lzUHJvbWlzZShyZXN1bHQpKSB7XG4gICAgICAgICAgICByZXN1bHQuZmluYWxseSgoKSA9PiB1bmJsb2NrKCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1bmJsb2NrKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNlbGYuc2VuZEVycm9yKCdCYWQgcmVxdWVzdCcsIG1zZyk7XG4gICAgICAgICAgdW5ibG9jaygpOyAvLyBpbiBjYXNlIHRoZSBoYW5kbGVyIGRpZG4ndCBhbHJlYWR5IGRvIGl0XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcnVuSGFuZGxlcnMoKTtcbiAgICB9O1xuXG4gICAgcHJvY2Vzc05leHQoKTtcbiAgfSxcblxuICBwcm90b2NvbF9oYW5kbGVyczoge1xuICAgIHN1YjogYXN5bmMgZnVuY3Rpb24gKG1zZywgdW5ibG9jaykge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAvLyBjYWNoZVVuYmxvY2sgdGVtcG9yYXJseSwgc28gd2UgY2FuIGNhcHR1cmUgaXQgbGF0ZXJcbiAgICAgIC8vIHdlIHdpbGwgdXNlIHVuYmxvY2sgaW4gY3VycmVudCBldmVudExvb3AsIHNvIHRoaXMgaXMgc2FmZVxuICAgICAgc2VsZi5jYWNoZWRVbmJsb2NrID0gdW5ibG9jaztcblxuICAgICAgLy8gcmVqZWN0IG1hbGZvcm1lZCBtZXNzYWdlc1xuICAgICAgaWYgKHR5cGVvZiAobXNnLmlkKSAhPT0gXCJzdHJpbmdcIiB8fFxuICAgICAgICAgIHR5cGVvZiAobXNnLm5hbWUpICE9PSBcInN0cmluZ1wiIHx8XG4gICAgICAgICAgKCgncGFyYW1zJyBpbiBtc2cpICYmICEobXNnLnBhcmFtcyBpbnN0YW5jZW9mIEFycmF5KSkpIHtcbiAgICAgICAgc2VsZi5zZW5kRXJyb3IoXCJNYWxmb3JtZWQgc3Vic2NyaXB0aW9uXCIsIG1zZyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKCFzZWxmLnNlcnZlci5wdWJsaXNoX2hhbmRsZXJzW21zZy5uYW1lXSkge1xuICAgICAgICBzZWxmLnNlbmQoe1xuICAgICAgICAgIG1zZzogJ25vc3ViJywgaWQ6IG1zZy5pZCxcbiAgICAgICAgICBlcnJvcjogbmV3IE1ldGVvci5FcnJvcig0MDQsIGBTdWJzY3JpcHRpb24gJyR7bXNnLm5hbWV9JyBub3QgZm91bmRgKX0pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChzZWxmLl9uYW1lZFN1YnMuaGFzKG1zZy5pZCkpXG4gICAgICAgIC8vIHN1YnMgYXJlIGlkZW1wb3RlbnQsIG9yIHJhdGhlciwgdGhleSBhcmUgaWdub3JlZCBpZiBhIHN1YlxuICAgICAgICAvLyB3aXRoIHRoYXQgaWQgYWxyZWFkeSBleGlzdHMuIHRoaXMgaXMgaW1wb3J0YW50IGR1cmluZ1xuICAgICAgICAvLyByZWNvbm5lY3QuXG4gICAgICAgIHJldHVybjtcblxuICAgICAgLy8gWFhYIEl0J2QgYmUgbXVjaCBiZXR0ZXIgaWYgd2UgaGFkIGdlbmVyaWMgaG9va3Mgd2hlcmUgYW55IHBhY2thZ2UgY2FuXG4gICAgICAvLyBob29rIGludG8gc3Vic2NyaXB0aW9uIGhhbmRsaW5nLCBidXQgaW4gdGhlIG1lYW4gd2hpbGUgd2Ugc3BlY2lhbCBjYXNlXG4gICAgICAvLyBkZHAtcmF0ZS1saW1pdGVyIHBhY2thZ2UuIFRoaXMgaXMgYWxzbyBkb25lIGZvciB3ZWFrIHJlcXVpcmVtZW50cyB0b1xuICAgICAgLy8gYWRkIHRoZSBkZHAtcmF0ZS1saW1pdGVyIHBhY2thZ2UgaW4gY2FzZSB3ZSBkb24ndCBoYXZlIEFjY291bnRzLiBBXG4gICAgICAvLyB1c2VyIHRyeWluZyB0byB1c2UgdGhlIGRkcC1yYXRlLWxpbWl0ZXIgbXVzdCBleHBsaWNpdGx5IHJlcXVpcmUgaXQuXG4gICAgICBpZiAoUGFja2FnZVsnZGRwLXJhdGUtbGltaXRlciddKSB7XG4gICAgICAgIHZhciBERFBSYXRlTGltaXRlciA9IFBhY2thZ2VbJ2RkcC1yYXRlLWxpbWl0ZXInXS5ERFBSYXRlTGltaXRlcjtcbiAgICAgICAgdmFyIHJhdGVMaW1pdGVySW5wdXQgPSB7XG4gICAgICAgICAgdXNlcklkOiBzZWxmLnVzZXJJZCxcbiAgICAgICAgICBjbGllbnRBZGRyZXNzOiBzZWxmLmNvbm5lY3Rpb25IYW5kbGUuY2xpZW50QWRkcmVzcyxcbiAgICAgICAgICB0eXBlOiBcInN1YnNjcmlwdGlvblwiLFxuICAgICAgICAgIG5hbWU6IG1zZy5uYW1lLFxuICAgICAgICAgIGNvbm5lY3Rpb25JZDogc2VsZi5pZFxuICAgICAgICB9O1xuXG4gICAgICAgIEREUFJhdGVMaW1pdGVyLl9pbmNyZW1lbnQocmF0ZUxpbWl0ZXJJbnB1dCk7XG4gICAgICAgIHZhciByYXRlTGltaXRSZXN1bHQgPSBERFBSYXRlTGltaXRlci5fY2hlY2socmF0ZUxpbWl0ZXJJbnB1dCk7XG4gICAgICAgIGlmICghcmF0ZUxpbWl0UmVzdWx0LmFsbG93ZWQpIHtcbiAgICAgICAgICBzZWxmLnNlbmQoe1xuICAgICAgICAgICAgbXNnOiAnbm9zdWInLCBpZDogbXNnLmlkLFxuICAgICAgICAgICAgZXJyb3I6IG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgICAgICAgICd0b28tbWFueS1yZXF1ZXN0cycsXG4gICAgICAgICAgICAgIEREUFJhdGVMaW1pdGVyLmdldEVycm9yTWVzc2FnZShyYXRlTGltaXRSZXN1bHQpLFxuICAgICAgICAgICAgICB7dGltZVRvUmVzZXQ6IHJhdGVMaW1pdFJlc3VsdC50aW1lVG9SZXNldH0pXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhciBoYW5kbGVyID0gc2VsZi5zZXJ2ZXIucHVibGlzaF9oYW5kbGVyc1ttc2cubmFtZV07XG5cbiAgICAgIGF3YWl0IHNlbGYuX3N0YXJ0U3Vic2NyaXB0aW9uKGhhbmRsZXIsIG1zZy5pZCwgbXNnLnBhcmFtcywgbXNnLm5hbWUpO1xuXG4gICAgICAvLyBjbGVhbmluZyBjYWNoZWQgdW5ibG9ja1xuICAgICAgc2VsZi5jYWNoZWRVbmJsb2NrID0gbnVsbDtcbiAgICB9LFxuXG4gICAgdW5zdWI6IGZ1bmN0aW9uIChtc2cpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgc2VsZi5fc3RvcFN1YnNjcmlwdGlvbihtc2cuaWQpO1xuICAgIH0sXG5cbiAgICBtZXRob2Q6IGFzeW5jIGZ1bmN0aW9uIChtc2csIHVuYmxvY2spIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgLy8gUmVqZWN0IG1hbGZvcm1lZCBtZXNzYWdlcy5cbiAgICAgIC8vIEZvciBub3csIHdlIHNpbGVudGx5IGlnbm9yZSB1bmtub3duIGF0dHJpYnV0ZXMsXG4gICAgICAvLyBmb3IgZm9yd2FyZHMgY29tcGF0aWJpbGl0eS5cbiAgICAgIGlmICh0eXBlb2YgKG1zZy5pZCkgIT09IFwic3RyaW5nXCIgfHxcbiAgICAgICAgICB0eXBlb2YgKG1zZy5tZXRob2QpICE9PSBcInN0cmluZ1wiIHx8XG4gICAgICAgICAgKCgncGFyYW1zJyBpbiBtc2cpICYmICEobXNnLnBhcmFtcyBpbnN0YW5jZW9mIEFycmF5KSkgfHxcbiAgICAgICAgICAoKCdyYW5kb21TZWVkJyBpbiBtc2cpICYmICh0eXBlb2YgbXNnLnJhbmRvbVNlZWQgIT09IFwic3RyaW5nXCIpKSkge1xuICAgICAgICBzZWxmLnNlbmRFcnJvcihcIk1hbGZvcm1lZCBtZXRob2QgaW52b2NhdGlvblwiLCBtc2cpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZhciByYW5kb21TZWVkID0gbXNnLnJhbmRvbVNlZWQgfHwgbnVsbDtcblxuICAgICAgLy8gU2V0IHVwIHRvIG1hcmsgdGhlIG1ldGhvZCBhcyBzYXRpc2ZpZWQgb25jZSBhbGwgb2JzZXJ2ZXJzXG4gICAgICAvLyAoYW5kIHN1YnNjcmlwdGlvbnMpIGhhdmUgcmVhY3RlZCB0byBhbnkgd3JpdGVzIHRoYXQgd2VyZVxuICAgICAgLy8gZG9uZS5cbiAgICAgIHZhciBmZW5jZSA9IG5ldyBERFBTZXJ2ZXIuX1dyaXRlRmVuY2U7XG4gICAgICBmZW5jZS5vbkFsbENvbW1pdHRlZChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIFJldGlyZSB0aGUgZmVuY2Ugc28gdGhhdCBmdXR1cmUgd3JpdGVzIGFyZSBhbGxvd2VkLlxuICAgICAgICAvLyBUaGlzIG1lYW5zIHRoYXQgY2FsbGJhY2tzIGxpa2UgdGltZXJzIGFyZSBmcmVlIHRvIHVzZVxuICAgICAgICAvLyB0aGUgZmVuY2UsIGFuZCBpZiB0aGV5IGZpcmUgYmVmb3JlIGl0J3MgYXJtZWQgKGZvclxuICAgICAgICAvLyBleGFtcGxlLCBiZWNhdXNlIHRoZSBtZXRob2Qgd2FpdHMgZm9yIHRoZW0pIHRoZWlyXG4gICAgICAgIC8vIHdyaXRlcyB3aWxsIGJlIGluY2x1ZGVkIGluIHRoZSBmZW5jZS5cbiAgICAgICAgZmVuY2UucmV0aXJlKCk7XG4gICAgICAgIHNlbGYuc2VuZCh7bXNnOiAndXBkYXRlZCcsIG1ldGhvZHM6IFttc2cuaWRdfSk7XG4gICAgICB9KTtcblxuICAgICAgLy8gRmluZCB0aGUgaGFuZGxlclxuICAgICAgdmFyIGhhbmRsZXIgPSBzZWxmLnNlcnZlci5tZXRob2RfaGFuZGxlcnNbbXNnLm1ldGhvZF07XG4gICAgICBpZiAoIWhhbmRsZXIpIHtcbiAgICAgICAgc2VsZi5zZW5kKHtcbiAgICAgICAgICBtc2c6ICdyZXN1bHQnLCBpZDogbXNnLmlkLFxuICAgICAgICAgIGVycm9yOiBuZXcgTWV0ZW9yLkVycm9yKDQwNCwgYE1ldGhvZCAnJHttc2cubWV0aG9kfScgbm90IGZvdW5kYCl9KTtcbiAgICAgICAgYXdhaXQgZmVuY2UuYXJtKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIGludm9jYXRpb24gPSBuZXcgRERQQ29tbW9uLk1ldGhvZEludm9jYXRpb24oe1xuICAgICAgICBuYW1lOiBtc2cubWV0aG9kLFxuICAgICAgICBpc1NpbXVsYXRpb246IGZhbHNlLFxuICAgICAgICB1c2VySWQ6IHNlbGYudXNlcklkLFxuICAgICAgICBzZXRVc2VySWQodXNlcklkKSB7XG4gICAgICAgICAgcmV0dXJuIHNlbGYuX3NldFVzZXJJZCh1c2VySWQpO1xuICAgICAgICB9LFxuICAgICAgICB1bmJsb2NrOiB1bmJsb2NrLFxuICAgICAgICBjb25uZWN0aW9uOiBzZWxmLmNvbm5lY3Rpb25IYW5kbGUsXG4gICAgICAgIHJhbmRvbVNlZWQ6IHJhbmRvbVNlZWQsXG4gICAgICAgIGZlbmNlLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vIFhYWCBJdCdkIGJlIGJldHRlciBpZiB3ZSBjb3VsZCBob29rIGludG8gbWV0aG9kIGhhbmRsZXJzIGJldHRlciBidXRcbiAgICAgICAgLy8gZm9yIG5vdywgd2UgbmVlZCB0byBjaGVjayBpZiB0aGUgZGRwLXJhdGUtbGltaXRlciBleGlzdHMgc2luY2Ugd2VcbiAgICAgICAgLy8gaGF2ZSBhIHdlYWsgcmVxdWlyZW1lbnQgZm9yIHRoZSBkZHAtcmF0ZS1saW1pdGVyIHBhY2thZ2UgdG8gYmUgYWRkZWRcbiAgICAgICAgLy8gdG8gb3VyIGFwcGxpY2F0aW9uLlxuICAgICAgICBpZiAoUGFja2FnZVsnZGRwLXJhdGUtbGltaXRlciddKSB7XG4gICAgICAgICAgdmFyIEREUFJhdGVMaW1pdGVyID0gUGFja2FnZVsnZGRwLXJhdGUtbGltaXRlciddLkREUFJhdGVMaW1pdGVyO1xuICAgICAgICAgIHZhciByYXRlTGltaXRlcklucHV0ID0ge1xuICAgICAgICAgICAgdXNlcklkOiBzZWxmLnVzZXJJZCxcbiAgICAgICAgICAgIGNsaWVudEFkZHJlc3M6IHNlbGYuY29ubmVjdGlvbkhhbmRsZS5jbGllbnRBZGRyZXNzLFxuICAgICAgICAgICAgdHlwZTogXCJtZXRob2RcIixcbiAgICAgICAgICAgIG5hbWU6IG1zZy5tZXRob2QsXG4gICAgICAgICAgICBjb25uZWN0aW9uSWQ6IHNlbGYuaWRcbiAgICAgICAgICB9O1xuICAgICAgICAgIEREUFJhdGVMaW1pdGVyLl9pbmNyZW1lbnQocmF0ZUxpbWl0ZXJJbnB1dCk7XG4gICAgICAgICAgdmFyIHJhdGVMaW1pdFJlc3VsdCA9IEREUFJhdGVMaW1pdGVyLl9jaGVjayhyYXRlTGltaXRlcklucHV0KVxuICAgICAgICAgIGlmICghcmF0ZUxpbWl0UmVzdWx0LmFsbG93ZWQpIHtcbiAgICAgICAgICAgIHJlamVjdChuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICAgICAgICBcInRvby1tYW55LXJlcXVlc3RzXCIsXG4gICAgICAgICAgICAgIEREUFJhdGVMaW1pdGVyLmdldEVycm9yTWVzc2FnZShyYXRlTGltaXRSZXN1bHQpLFxuICAgICAgICAgICAgICB7dGltZVRvUmVzZXQ6IHJhdGVMaW1pdFJlc3VsdC50aW1lVG9SZXNldH1cbiAgICAgICAgICAgICkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cblxuICAgICAgICBjb25zdCBnZXRDdXJyZW50TWV0aG9kSW52b2NhdGlvblJlc3VsdCA9ICgpID0+XG4gICAgICAgICAgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi53aXRoVmFsdWUoXG4gICAgICAgICAgICBpbnZvY2F0aW9uLFxuICAgICAgICAgICAgKCkgPT5cbiAgICAgICAgICAgICAgbWF5YmVBdWRpdEFyZ3VtZW50Q2hlY2tzKFxuICAgICAgICAgICAgICAgIGhhbmRsZXIsXG4gICAgICAgICAgICAgICAgaW52b2NhdGlvbixcbiAgICAgICAgICAgICAgICBtc2cucGFyYW1zLFxuICAgICAgICAgICAgICAgIFwiY2FsbCB0byAnXCIgKyBtc2cubWV0aG9kICsgXCInXCJcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbmFtZTogJ2dldEN1cnJlbnRNZXRob2RJbnZvY2F0aW9uUmVzdWx0JyxcbiAgICAgICAgICAgICAga2V5TmFtZTogJ2dldEN1cnJlbnRNZXRob2RJbnZvY2F0aW9uUmVzdWx0JyxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICApO1xuXG4gICAgICAgIHJlc29sdmUoXG4gICAgICAgICAgRERQU2VydmVyLl9DdXJyZW50V3JpdGVGZW5jZS53aXRoVmFsdWUoXG4gICAgICAgICAgICBmZW5jZSxcbiAgICAgICAgICAgIGdldEN1cnJlbnRNZXRob2RJbnZvY2F0aW9uUmVzdWx0LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBuYW1lOiAnRERQU2VydmVyLl9DdXJyZW50V3JpdGVGZW5jZScsXG4gICAgICAgICAgICAgIGtleU5hbWU6ICdfQ3VycmVudFdyaXRlRmVuY2UnLFxuICAgICAgICAgICAgfVxuICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICAgIH0pO1xuXG4gICAgICBhc3luYyBmdW5jdGlvbiBmaW5pc2goKSB7XG4gICAgICAgIGF3YWl0IGZlbmNlLmFybSgpO1xuICAgICAgICB1bmJsb2NrKCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHBheWxvYWQgPSB7XG4gICAgICAgIG1zZzogXCJyZXN1bHRcIixcbiAgICAgICAgaWQ6IG1zZy5pZFxuICAgICAgfTtcbiAgICAgIHJldHVybiBwcm9taXNlLnRoZW4oYXN5bmMgcmVzdWx0ID0+IHtcbiAgICAgICAgYXdhaXQgZmluaXNoKCk7XG4gICAgICAgIGlmIChyZXN1bHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHBheWxvYWQucmVzdWx0ID0gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuc2VuZChwYXlsb2FkKTtcbiAgICAgIH0sIGFzeW5jIChleGNlcHRpb24pID0+IHtcbiAgICAgICAgYXdhaXQgZmluaXNoKCk7XG4gICAgICAgIHBheWxvYWQuZXJyb3IgPSB3cmFwSW50ZXJuYWxFeGNlcHRpb24oXG4gICAgICAgICAgZXhjZXB0aW9uLFxuICAgICAgICAgIGB3aGlsZSBpbnZva2luZyBtZXRob2QgJyR7bXNnLm1ldGhvZH0nYFxuICAgICAgICApO1xuICAgICAgICBzZWxmLnNlbmQocGF5bG9hZCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG5cbiAgX2VhY2hTdWI6IGZ1bmN0aW9uIChmKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuX25hbWVkU3Vicy5mb3JFYWNoKGYpO1xuICAgIHNlbGYuX3VuaXZlcnNhbFN1YnMuZm9yRWFjaChmKTtcbiAgfSxcblxuICBfZGlmZkNvbGxlY3Rpb25WaWV3czogZnVuY3Rpb24gKGJlZm9yZUNWcykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBEaWZmU2VxdWVuY2UuZGlmZk1hcHMoYmVmb3JlQ1ZzLCBzZWxmLmNvbGxlY3Rpb25WaWV3cywge1xuICAgICAgYm90aDogZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCBsZWZ0VmFsdWUsIHJpZ2h0VmFsdWUpIHtcbiAgICAgICAgcmlnaHRWYWx1ZS5kaWZmKGxlZnRWYWx1ZSk7XG4gICAgICB9LFxuICAgICAgcmlnaHRPbmx5OiBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHJpZ2h0VmFsdWUpIHtcbiAgICAgICAgcmlnaHRWYWx1ZS5kb2N1bWVudHMuZm9yRWFjaChmdW5jdGlvbiAoZG9jVmlldywgaWQpIHtcbiAgICAgICAgICBzZWxmLnNlbmRBZGRlZChjb2xsZWN0aW9uTmFtZSwgaWQsIGRvY1ZpZXcuZ2V0RmllbGRzKCkpO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgICBsZWZ0T25seTogZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCBsZWZ0VmFsdWUpIHtcbiAgICAgICAgbGVmdFZhbHVlLmRvY3VtZW50cy5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGlkKSB7XG4gICAgICAgICAgc2VsZi5zZW5kUmVtb3ZlZChjb2xsZWN0aW9uTmFtZSwgaWQpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICAvLyBTZXRzIHRoZSBjdXJyZW50IHVzZXIgaWQgaW4gYWxsIGFwcHJvcHJpYXRlIGNvbnRleHRzIGFuZCByZXJ1bnNcbiAgLy8gYWxsIHN1YnNjcmlwdGlvbnNcbiAgYXN5bmMgX3NldFVzZXJJZCh1c2VySWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAodXNlcklkICE9PSBudWxsICYmIHR5cGVvZiB1c2VySWQgIT09IFwic3RyaW5nXCIpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJzZXRVc2VySWQgbXVzdCBiZSBjYWxsZWQgb24gc3RyaW5nIG9yIG51bGwsIG5vdCBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgdHlwZW9mIHVzZXJJZCk7XG5cbiAgICAvLyBQcmV2ZW50IG5ld2x5LWNyZWF0ZWQgdW5pdmVyc2FsIHN1YnNjcmlwdGlvbnMgZnJvbSBiZWluZyBhZGRlZCB0byBvdXJcbiAgICAvLyBzZXNzaW9uLiBUaGV5IHdpbGwgYmUgZm91bmQgYmVsb3cgd2hlbiB3ZSBjYWxsIHN0YXJ0VW5pdmVyc2FsU3Vicy5cbiAgICAvL1xuICAgIC8vIChXZSBkb24ndCBoYXZlIHRvIHdvcnJ5IGFib3V0IG5hbWVkIHN1YnNjcmlwdGlvbnMsIGJlY2F1c2Ugd2Ugb25seSBhZGRcbiAgICAvLyB0aGVtIHdoZW4gd2UgcHJvY2VzcyBhICdzdWInIG1lc3NhZ2UuIFdlIGFyZSBjdXJyZW50bHkgcHJvY2Vzc2luZyBhXG4gICAgLy8gJ21ldGhvZCcgbWVzc2FnZSwgYW5kIHRoZSBtZXRob2QgZGlkIG5vdCB1bmJsb2NrLCBiZWNhdXNlIGl0IGlzIGlsbGVnYWxcbiAgICAvLyB0byBjYWxsIHNldFVzZXJJZCBhZnRlciB1bmJsb2NrLiBUaHVzIHdlIGNhbm5vdCBiZSBjb25jdXJyZW50bHkgYWRkaW5nIGFcbiAgICAvLyBuZXcgbmFtZWQgc3Vic2NyaXB0aW9uKS5cbiAgICBzZWxmLl9kb250U3RhcnROZXdVbml2ZXJzYWxTdWJzID0gdHJ1ZTtcblxuICAgIC8vIFByZXZlbnQgY3VycmVudCBzdWJzIGZyb20gdXBkYXRpbmcgb3VyIGNvbGxlY3Rpb25WaWV3cyBhbmQgY2FsbCB0aGVpclxuICAgIC8vIHN0b3AgY2FsbGJhY2tzLiBUaGlzIG1heSB5aWVsZC5cbiAgICBzZWxmLl9lYWNoU3ViKGZ1bmN0aW9uIChzdWIpIHtcbiAgICAgIHN1Yi5fZGVhY3RpdmF0ZSgpO1xuICAgIH0pO1xuXG4gICAgLy8gQWxsIHN1YnMgc2hvdWxkIG5vdyBiZSBkZWFjdGl2YXRlZC4gU3RvcCBzZW5kaW5nIG1lc3NhZ2VzIHRvIHRoZSBjbGllbnQsXG4gICAgLy8gc2F2ZSB0aGUgc3RhdGUgb2YgdGhlIHB1Ymxpc2hlZCBjb2xsZWN0aW9ucywgcmVzZXQgdG8gYW4gZW1wdHkgdmlldywgYW5kXG4gICAgLy8gdXBkYXRlIHRoZSB1c2VySWQuXG4gICAgc2VsZi5faXNTZW5kaW5nID0gZmFsc2U7XG4gICAgdmFyIGJlZm9yZUNWcyA9IHNlbGYuY29sbGVjdGlvblZpZXdzO1xuICAgIHNlbGYuY29sbGVjdGlvblZpZXdzID0gbmV3IE1hcCgpO1xuICAgIHNlbGYudXNlcklkID0gdXNlcklkO1xuXG4gICAgLy8gX3NldFVzZXJJZCBpcyBub3JtYWxseSBjYWxsZWQgZnJvbSBhIE1ldGVvciBtZXRob2Qgd2l0aFxuICAgIC8vIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24gc2V0LiBCdXQgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbiBpcyBub3RcbiAgICAvLyBleHBlY3RlZCB0byBiZSBzZXQgaW5zaWRlIGEgcHVibGlzaCBmdW5jdGlvbiwgc28gd2UgdGVtcG9yYXJ5IHVuc2V0IGl0LlxuICAgIC8vIEluc2lkZSBhIHB1Ymxpc2ggZnVuY3Rpb24gRERQLl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uIGlzIHNldC5cbiAgICBhd2FpdCBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLndpdGhWYWx1ZSh1bmRlZmluZWQsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIFNhdmUgdGhlIG9sZCBuYW1lZCBzdWJzLCBhbmQgcmVzZXQgdG8gaGF2aW5nIG5vIHN1YnNjcmlwdGlvbnMuXG4gICAgICB2YXIgb2xkTmFtZWRTdWJzID0gc2VsZi5fbmFtZWRTdWJzO1xuICAgICAgc2VsZi5fbmFtZWRTdWJzID0gbmV3IE1hcCgpO1xuICAgICAgc2VsZi5fdW5pdmVyc2FsU3VicyA9IFtdO1xuXG5cblxuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoWy4uLm9sZE5hbWVkU3Vic10ubWFwKGFzeW5jIChbc3Vic2NyaXB0aW9uSWQsIHN1Yl0pID0+IHtcbiAgICAgICAgY29uc3QgbmV3U3ViID0gc3ViLl9yZWNyZWF0ZSgpO1xuICAgICAgICBzZWxmLl9uYW1lZFN1YnMuc2V0KHN1YnNjcmlwdGlvbklkLCBuZXdTdWIpO1xuICAgICAgICAvLyBuYjogaWYgdGhlIGhhbmRsZXIgdGhyb3dzIG9yIGNhbGxzIHRoaXMuZXJyb3IoKSwgaXQgd2lsbCBpbiBmYWN0XG4gICAgICAgIC8vIGltbWVkaWF0ZWx5IHNlbmQgaXRzICdub3N1YicuIFRoaXMgaXMgT0ssIHRob3VnaC5cbiAgICAgICAgYXdhaXQgbmV3U3ViLl9ydW5IYW5kbGVyKCk7XG4gICAgICB9KSk7XG5cbiAgICAgIC8vIEFsbG93IG5ld2x5LWNyZWF0ZWQgdW5pdmVyc2FsIHN1YnMgdG8gYmUgc3RhcnRlZCBvbiBvdXIgY29ubmVjdGlvbiBpblxuICAgICAgLy8gcGFyYWxsZWwgd2l0aCB0aGUgb25lcyB3ZSdyZSBzcGlubmluZyB1cCBoZXJlLCBhbmQgc3BpbiB1cCB1bml2ZXJzYWxcbiAgICAgIC8vIHN1YnMuXG4gICAgICBzZWxmLl9kb250U3RhcnROZXdVbml2ZXJzYWxTdWJzID0gZmFsc2U7XG4gICAgICBzZWxmLnN0YXJ0VW5pdmVyc2FsU3VicygpO1xuICAgIH0sIHsgbmFtZTogJ19zZXRVc2VySWQnIH0pO1xuXG4gICAgLy8gU3RhcnQgc2VuZGluZyBtZXNzYWdlcyBhZ2FpbiwgYmVnaW5uaW5nIHdpdGggdGhlIGRpZmYgZnJvbSB0aGUgcHJldmlvdXNcbiAgICAvLyBzdGF0ZSBvZiB0aGUgd29ybGQgdG8gdGhlIGN1cnJlbnQgc3RhdGUuIE5vIHlpZWxkcyBhcmUgYWxsb3dlZCBkdXJpbmdcbiAgICAvLyB0aGlzIGRpZmYsIHNvIHRoYXQgb3RoZXIgY2hhbmdlcyBjYW5ub3QgaW50ZXJsZWF2ZS5cbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl9pc1NlbmRpbmcgPSB0cnVlO1xuICAgICAgc2VsZi5fZGlmZkNvbGxlY3Rpb25WaWV3cyhiZWZvcmVDVnMpO1xuICAgICAgaWYgKCFfLmlzRW1wdHkoc2VsZi5fcGVuZGluZ1JlYWR5KSkge1xuICAgICAgICBzZWxmLnNlbmRSZWFkeShzZWxmLl9wZW5kaW5nUmVhZHkpO1xuICAgICAgICBzZWxmLl9wZW5kaW5nUmVhZHkgPSBbXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICBfc3RhcnRTdWJzY3JpcHRpb246IGZ1bmN0aW9uIChoYW5kbGVyLCBzdWJJZCwgcGFyYW1zLCBuYW1lKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIHN1YiA9IG5ldyBTdWJzY3JpcHRpb24oXG4gICAgICBzZWxmLCBoYW5kbGVyLCBzdWJJZCwgcGFyYW1zLCBuYW1lKTtcblxuICAgIGxldCB1bmJsb2NrSGFuZGVyID0gc2VsZi5jYWNoZWRVbmJsb2NrO1xuICAgIC8vIF9zdGFydFN1YnNjcmlwdGlvbiBtYXkgY2FsbCBmcm9tIGEgbG90IHBsYWNlc1xuICAgIC8vIHNvIGNhY2hlZFVuYmxvY2sgbWlnaHQgYmUgbnVsbCBpbiBzb21lY2FzZXNcbiAgICAvLyBhc3NpZ24gdGhlIGNhY2hlZFVuYmxvY2tcbiAgICBzdWIudW5ibG9jayA9IHVuYmxvY2tIYW5kZXIgfHwgKCgpID0+IHt9KTtcblxuICAgIGlmIChzdWJJZClcbiAgICAgIHNlbGYuX25hbWVkU3Vicy5zZXQoc3ViSWQsIHN1Yik7XG4gICAgZWxzZVxuICAgICAgc2VsZi5fdW5pdmVyc2FsU3Vicy5wdXNoKHN1Yik7XG5cbiAgICByZXR1cm4gc3ViLl9ydW5IYW5kbGVyKCk7XG4gIH0sXG5cbiAgLy8gVGVhciBkb3duIHNwZWNpZmllZCBzdWJzY3JpcHRpb25cbiAgX3N0b3BTdWJzY3JpcHRpb246IGZ1bmN0aW9uIChzdWJJZCwgZXJyb3IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgc3ViTmFtZSA9IG51bGw7XG4gICAgaWYgKHN1YklkKSB7XG4gICAgICB2YXIgbWF5YmVTdWIgPSBzZWxmLl9uYW1lZFN1YnMuZ2V0KHN1YklkKTtcbiAgICAgIGlmIChtYXliZVN1Yikge1xuICAgICAgICBzdWJOYW1lID0gbWF5YmVTdWIuX25hbWU7XG4gICAgICAgIG1heWJlU3ViLl9yZW1vdmVBbGxEb2N1bWVudHMoKTtcbiAgICAgICAgbWF5YmVTdWIuX2RlYWN0aXZhdGUoKTtcbiAgICAgICAgc2VsZi5fbmFtZWRTdWJzLmRlbGV0ZShzdWJJZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHJlc3BvbnNlID0ge21zZzogJ25vc3ViJywgaWQ6IHN1YklkfTtcblxuICAgIGlmIChlcnJvcikge1xuICAgICAgcmVzcG9uc2UuZXJyb3IgPSB3cmFwSW50ZXJuYWxFeGNlcHRpb24oXG4gICAgICAgIGVycm9yLFxuICAgICAgICBzdWJOYW1lID8gKFwiZnJvbSBzdWIgXCIgKyBzdWJOYW1lICsgXCIgaWQgXCIgKyBzdWJJZClcbiAgICAgICAgICA6IChcImZyb20gc3ViIGlkIFwiICsgc3ViSWQpKTtcbiAgICB9XG5cbiAgICBzZWxmLnNlbmQocmVzcG9uc2UpO1xuICB9LFxuXG4gIC8vIFRlYXIgZG93biBhbGwgc3Vic2NyaXB0aW9ucy4gTm90ZSB0aGF0IHRoaXMgZG9lcyBOT1Qgc2VuZCByZW1vdmVkIG9yIG5vc3ViXG4gIC8vIG1lc3NhZ2VzLCBzaW5jZSB3ZSBhc3N1bWUgdGhlIGNsaWVudCBpcyBnb25lLlxuICBfZGVhY3RpdmF0ZUFsbFN1YnNjcmlwdGlvbnM6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBzZWxmLl9uYW1lZFN1YnMuZm9yRWFjaChmdW5jdGlvbiAoc3ViLCBpZCkge1xuICAgICAgc3ViLl9kZWFjdGl2YXRlKCk7XG4gICAgfSk7XG4gICAgc2VsZi5fbmFtZWRTdWJzID0gbmV3IE1hcCgpO1xuXG4gICAgc2VsZi5fdW5pdmVyc2FsU3Vicy5mb3JFYWNoKGZ1bmN0aW9uIChzdWIpIHtcbiAgICAgIHN1Yi5fZGVhY3RpdmF0ZSgpO1xuICAgIH0pO1xuICAgIHNlbGYuX3VuaXZlcnNhbFN1YnMgPSBbXTtcbiAgfSxcblxuICAvLyBEZXRlcm1pbmUgdGhlIHJlbW90ZSBjbGllbnQncyBJUCBhZGRyZXNzLCBiYXNlZCBvbiB0aGVcbiAgLy8gSFRUUF9GT1JXQVJERURfQ09VTlQgZW52aXJvbm1lbnQgdmFyaWFibGUgcmVwcmVzZW50aW5nIGhvdyBtYW55XG4gIC8vIHByb3hpZXMgdGhlIHNlcnZlciBpcyBiZWhpbmQuXG4gIF9jbGllbnRBZGRyZXNzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gRm9yIHRoZSByZXBvcnRlZCBjbGllbnQgYWRkcmVzcyBmb3IgYSBjb25uZWN0aW9uIHRvIGJlIGNvcnJlY3QsXG4gICAgLy8gdGhlIGRldmVsb3BlciBtdXN0IHNldCB0aGUgSFRUUF9GT1JXQVJERURfQ09VTlQgZW52aXJvbm1lbnRcbiAgICAvLyB2YXJpYWJsZSB0byBhbiBpbnRlZ2VyIHJlcHJlc2VudGluZyB0aGUgbnVtYmVyIG9mIGhvcHMgdGhleVxuICAgIC8vIGV4cGVjdCBpbiB0aGUgYHgtZm9yd2FyZGVkLWZvcmAgaGVhZGVyLiBFLmcuLCBzZXQgdG8gXCIxXCIgaWYgdGhlXG4gICAgLy8gc2VydmVyIGlzIGJlaGluZCBvbmUgcHJveHkuXG4gICAgLy9cbiAgICAvLyBUaGlzIGNvdWxkIGJlIGNvbXB1dGVkIG9uY2UgYXQgc3RhcnR1cCBpbnN0ZWFkIG9mIGV2ZXJ5IHRpbWUuXG4gICAgdmFyIGh0dHBGb3J3YXJkZWRDb3VudCA9IHBhcnNlSW50KHByb2Nlc3MuZW52WydIVFRQX0ZPUldBUkRFRF9DT1VOVCddKSB8fCAwO1xuXG4gICAgaWYgKGh0dHBGb3J3YXJkZWRDb3VudCA9PT0gMClcbiAgICAgIHJldHVybiBzZWxmLnNvY2tldC5yZW1vdGVBZGRyZXNzO1xuXG4gICAgdmFyIGZvcndhcmRlZEZvciA9IHNlbGYuc29ja2V0LmhlYWRlcnNbXCJ4LWZvcndhcmRlZC1mb3JcIl07XG4gICAgaWYgKCEgXy5pc1N0cmluZyhmb3J3YXJkZWRGb3IpKVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgZm9yd2FyZGVkRm9yID0gZm9yd2FyZGVkRm9yLnRyaW0oKS5zcGxpdCgvXFxzKixcXHMqLyk7XG5cbiAgICAvLyBUeXBpY2FsbHkgdGhlIGZpcnN0IHZhbHVlIGluIHRoZSBgeC1mb3J3YXJkZWQtZm9yYCBoZWFkZXIgaXNcbiAgICAvLyB0aGUgb3JpZ2luYWwgSVAgYWRkcmVzcyBvZiB0aGUgY2xpZW50IGNvbm5lY3RpbmcgdG8gdGhlIGZpcnN0XG4gICAgLy8gcHJveHkuICBIb3dldmVyLCB0aGUgZW5kIHVzZXIgY2FuIGVhc2lseSBzcG9vZiB0aGUgaGVhZGVyLCBpblxuICAgIC8vIHdoaWNoIGNhc2UgdGhlIGZpcnN0IHZhbHVlKHMpIHdpbGwgYmUgdGhlIGZha2UgSVAgYWRkcmVzcyBmcm9tXG4gICAgLy8gdGhlIHVzZXIgcHJldGVuZGluZyB0byBiZSBhIHByb3h5IHJlcG9ydGluZyB0aGUgb3JpZ2luYWwgSVBcbiAgICAvLyBhZGRyZXNzIHZhbHVlLiAgQnkgY291bnRpbmcgSFRUUF9GT1JXQVJERURfQ09VTlQgYmFjayBmcm9tIHRoZVxuICAgIC8vIGVuZCBvZiB0aGUgbGlzdCwgd2UgZW5zdXJlIHRoYXQgd2UgZ2V0IHRoZSBJUCBhZGRyZXNzIGJlaW5nXG4gICAgLy8gcmVwb3J0ZWQgYnkgKm91ciogZmlyc3QgcHJveHkuXG5cbiAgICBpZiAoaHR0cEZvcndhcmRlZENvdW50IDwgMCB8fCBodHRwRm9yd2FyZGVkQ291bnQgPiBmb3J3YXJkZWRGb3IubGVuZ3RoKVxuICAgICAgcmV0dXJuIG51bGw7XG5cbiAgICByZXR1cm4gZm9yd2FyZGVkRm9yW2ZvcndhcmRlZEZvci5sZW5ndGggLSBodHRwRm9yd2FyZGVkQ291bnRdO1xuICB9XG59KTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qIFN1YnNjcmlwdGlvbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICovXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vLyBDdG9yIGZvciBhIHN1YiBoYW5kbGU6IHRoZSBpbnB1dCB0byBlYWNoIHB1Ymxpc2ggZnVuY3Rpb25cblxuLy8gSW5zdGFuY2UgbmFtZSBpcyB0aGlzIGJlY2F1c2UgaXQncyB1c3VhbGx5IHJlZmVycmVkIHRvIGFzIHRoaXMgaW5zaWRlIGFcbi8vIHB1Ymxpc2hcbi8qKlxuICogQHN1bW1hcnkgVGhlIHNlcnZlcidzIHNpZGUgb2YgYSBzdWJzY3JpcHRpb25cbiAqIEBjbGFzcyBTdWJzY3JpcHRpb25cbiAqIEBpbnN0YW5jZU5hbWUgdGhpc1xuICogQHNob3dJbnN0YW5jZU5hbWUgdHJ1ZVxuICovXG52YXIgU3Vic2NyaXB0aW9uID0gZnVuY3Rpb24gKFxuICAgIHNlc3Npb24sIGhhbmRsZXIsIHN1YnNjcmlwdGlvbklkLCBwYXJhbXMsIG5hbWUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLl9zZXNzaW9uID0gc2Vzc2lvbjsgLy8gdHlwZSBpcyBTZXNzaW9uXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEFjY2VzcyBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uIFRoZSBpbmNvbWluZyBbY29ubmVjdGlvbl0oI21ldGVvcl9vbmNvbm5lY3Rpb24pIGZvciB0aGlzIHN1YnNjcmlwdGlvbi5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbmFtZSAgY29ubmVjdGlvblxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKi9cbiAgc2VsZi5jb25uZWN0aW9uID0gc2Vzc2lvbi5jb25uZWN0aW9uSGFuZGxlOyAvLyBwdWJsaWMgQVBJIG9iamVjdFxuXG4gIHNlbGYuX2hhbmRsZXIgPSBoYW5kbGVyO1xuXG4gIC8vIE15IHN1YnNjcmlwdGlvbiBJRCAoZ2VuZXJhdGVkIGJ5IGNsaWVudCwgdW5kZWZpbmVkIGZvciB1bml2ZXJzYWwgc3VicykuXG4gIHNlbGYuX3N1YnNjcmlwdGlvbklkID0gc3Vic2NyaXB0aW9uSWQ7XG4gIC8vIFVuZGVmaW5lZCBmb3IgdW5pdmVyc2FsIHN1YnNcbiAgc2VsZi5fbmFtZSA9IG5hbWU7XG5cbiAgc2VsZi5fcGFyYW1zID0gcGFyYW1zIHx8IFtdO1xuXG4gIC8vIE9ubHkgbmFtZWQgc3Vic2NyaXB0aW9ucyBoYXZlIElEcywgYnV0IHdlIG5lZWQgc29tZSBzb3J0IG9mIHN0cmluZ1xuICAvLyBpbnRlcm5hbGx5IHRvIGtlZXAgdHJhY2sgb2YgYWxsIHN1YnNjcmlwdGlvbnMgaW5zaWRlXG4gIC8vIFNlc3Npb25Eb2N1bWVudFZpZXdzLiBXZSB1c2UgdGhpcyBzdWJzY3JpcHRpb25IYW5kbGUgZm9yIHRoYXQuXG4gIGlmIChzZWxmLl9zdWJzY3JpcHRpb25JZCkge1xuICAgIHNlbGYuX3N1YnNjcmlwdGlvbkhhbmRsZSA9ICdOJyArIHNlbGYuX3N1YnNjcmlwdGlvbklkO1xuICB9IGVsc2Uge1xuICAgIHNlbGYuX3N1YnNjcmlwdGlvbkhhbmRsZSA9ICdVJyArIFJhbmRvbS5pZCgpO1xuICB9XG5cbiAgLy8gSGFzIF9kZWFjdGl2YXRlIGJlZW4gY2FsbGVkP1xuICBzZWxmLl9kZWFjdGl2YXRlZCA9IGZhbHNlO1xuXG4gIC8vIFN0b3AgY2FsbGJhY2tzIHRvIGcvYyB0aGlzIHN1Yi4gIGNhbGxlZCB3LyB6ZXJvIGFyZ3VtZW50cy5cbiAgc2VsZi5fc3RvcENhbGxiYWNrcyA9IFtdO1xuXG4gIC8vIFRoZSBzZXQgb2YgKGNvbGxlY3Rpb24sIGRvY3VtZW50aWQpIHRoYXQgdGhpcyBzdWJzY3JpcHRpb24gaGFzXG4gIC8vIGFuIG9waW5pb24gYWJvdXQuXG4gIHNlbGYuX2RvY3VtZW50cyA9IG5ldyBNYXAoKTtcblxuICAvLyBSZW1lbWJlciBpZiB3ZSBhcmUgcmVhZHkuXG4gIHNlbGYuX3JlYWR5ID0gZmFsc2U7XG5cbiAgLy8gUGFydCBvZiB0aGUgcHVibGljIEFQSTogdGhlIHVzZXIgb2YgdGhpcyBzdWIuXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEFjY2VzcyBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uIFRoZSBpZCBvZiB0aGUgbG9nZ2VkLWluIHVzZXIsIG9yIGBudWxsYCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbi5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqIEBuYW1lICB1c2VySWRcbiAgICogQGluc3RhbmNlXG4gICAqL1xuICBzZWxmLnVzZXJJZCA9IHNlc3Npb24udXNlcklkO1xuXG4gIC8vIEZvciBub3csIHRoZSBpZCBmaWx0ZXIgaXMgZ29pbmcgdG8gZGVmYXVsdCB0b1xuICAvLyB0aGUgdG8vZnJvbSBERFAgbWV0aG9kcyBvbiBNb25nb0lELCB0b1xuICAvLyBzcGVjaWZpY2FsbHkgZGVhbCB3aXRoIG1vbmdvL21pbmltb25nbyBPYmplY3RJZHMuXG5cbiAgLy8gTGF0ZXIsIHlvdSB3aWxsIGJlIGFibGUgdG8gbWFrZSB0aGlzIGJlIFwicmF3XCJcbiAgLy8gaWYgeW91IHdhbnQgdG8gcHVibGlzaCBhIGNvbGxlY3Rpb24gdGhhdCB5b3Uga25vd1xuICAvLyBqdXN0IGhhcyBzdHJpbmdzIGZvciBrZXlzIGFuZCBubyBmdW5ueSBidXNpbmVzcywgdG9cbiAgLy8gYSBERFAgY29uc3VtZXIgdGhhdCBpc24ndCBtaW5pbW9uZ28uXG5cbiAgc2VsZi5faWRGaWx0ZXIgPSB7XG4gICAgaWRTdHJpbmdpZnk6IE1vbmdvSUQuaWRTdHJpbmdpZnksXG4gICAgaWRQYXJzZTogTW9uZ29JRC5pZFBhcnNlXG4gIH07XG5cbiAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgIFwibGl2ZWRhdGFcIiwgXCJzdWJzY3JpcHRpb25zXCIsIDEpO1xufTtcblxuT2JqZWN0LmFzc2lnbihTdWJzY3JpcHRpb24ucHJvdG90eXBlLCB7XG4gIF9ydW5IYW5kbGVyOiBhc3luYyBmdW5jdGlvbigpIHtcbiAgICAvLyBYWFggc2hvdWxkIHdlIHVuYmxvY2soKSBoZXJlPyBFaXRoZXIgYmVmb3JlIHJ1bm5pbmcgdGhlIHB1Ymxpc2hcbiAgICAvLyBmdW5jdGlvbiwgb3IgYmVmb3JlIHJ1bm5pbmcgX3B1Ymxpc2hDdXJzb3IuXG4gICAgLy9cbiAgICAvLyBSaWdodCBub3csIGVhY2ggcHVibGlzaCBmdW5jdGlvbiBibG9ja3MgYWxsIGZ1dHVyZSBwdWJsaXNoZXMgYW5kXG4gICAgLy8gbWV0aG9kcyB3YWl0aW5nIG9uIGRhdGEgZnJvbSBNb25nbyAob3Igd2hhdGV2ZXIgZWxzZSB0aGUgZnVuY3Rpb25cbiAgICAvLyBibG9ja3Mgb24pLiBUaGlzIHByb2JhYmx5IHNsb3dzIHBhZ2UgbG9hZCBpbiBjb21tb24gY2FzZXMuXG5cbiAgICBpZiAoIXRoaXMudW5ibG9jaykge1xuICAgICAgdGhpcy51bmJsb2NrID0gKCkgPT4ge307XG4gICAgfVxuXG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgbGV0IHJlc3VsdE9yVGhlbmFibGUgPSBudWxsO1xuICAgIHRyeSB7XG4gICAgICByZXN1bHRPclRoZW5hYmxlID0gRERQLl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uLndpdGhWYWx1ZShcbiAgICAgICAgc2VsZixcbiAgICAgICAgKCkgPT5cbiAgICAgICAgICBtYXliZUF1ZGl0QXJndW1lbnRDaGVja3MoXG4gICAgICAgICAgICBzZWxmLl9oYW5kbGVyLFxuICAgICAgICAgICAgc2VsZixcbiAgICAgICAgICAgIEVKU09OLmNsb25lKHNlbGYuX3BhcmFtcyksXG4gICAgICAgICAgICAvLyBJdCdzIE9LIHRoYXQgdGhpcyB3b3VsZCBsb29rIHdlaXJkIGZvciB1bml2ZXJzYWwgc3Vic2NyaXB0aW9ucyxcbiAgICAgICAgICAgIC8vIGJlY2F1c2UgdGhleSBoYXZlIG5vIGFyZ3VtZW50cyBzbyB0aGVyZSBjYW4gbmV2ZXIgYmUgYW5cbiAgICAgICAgICAgIC8vIGF1ZGl0LWFyZ3VtZW50LWNoZWNrcyBmYWlsdXJlLlxuICAgICAgICAgICAgXCJwdWJsaXNoZXIgJ1wiICsgc2VsZi5fbmFtZSArIFwiJ1wiXG4gICAgICAgICAgKSxcbiAgICAgICAgeyBuYW1lOiBzZWxmLl9uYW1lIH1cbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgc2VsZi5lcnJvcihlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBEaWQgdGhlIGhhbmRsZXIgY2FsbCB0aGlzLmVycm9yIG9yIHRoaXMuc3RvcD9cbiAgICBpZiAoc2VsZi5faXNEZWFjdGl2YXRlZCgpKSByZXR1cm47XG5cbiAgICAvLyBCb3RoIGNvbnZlbnRpb25hbCBhbmQgYXN5bmMgcHVibGlzaCBoYW5kbGVyIGZ1bmN0aW9ucyBhcmUgc3VwcG9ydGVkLlxuICAgIC8vIElmIGFuIG9iamVjdCBpcyByZXR1cm5lZCB3aXRoIGEgdGhlbigpIGZ1bmN0aW9uLCBpdCBpcyBlaXRoZXIgYSBwcm9taXNlXG4gICAgLy8gb3IgdGhlbmFibGUgYW5kIHdpbGwgYmUgcmVzb2x2ZWQgYXN5bmNocm9ub3VzbHkuXG4gICAgY29uc3QgaXNUaGVuYWJsZSA9XG4gICAgICByZXN1bHRPclRoZW5hYmxlICYmIHR5cGVvZiByZXN1bHRPclRoZW5hYmxlLnRoZW4gPT09ICdmdW5jdGlvbic7XG4gICAgaWYgKGlzVGhlbmFibGUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHNlbGYuX3B1Ymxpc2hIYW5kbGVyUmVzdWx0KGF3YWl0IHJlc3VsdE9yVGhlbmFibGUpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHNlbGYuZXJyb3IoZSlcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgYXdhaXQgc2VsZi5fcHVibGlzaEhhbmRsZXJSZXN1bHQocmVzdWx0T3JUaGVuYWJsZSk7XG4gICAgfVxuICB9LFxuXG4gIGFzeW5jIF9wdWJsaXNoSGFuZGxlclJlc3VsdCAocmVzKSB7XG4gICAgLy8gU1BFQ0lBTCBDQVNFOiBJbnN0ZWFkIG9mIHdyaXRpbmcgdGhlaXIgb3duIGNhbGxiYWNrcyB0aGF0IGludm9rZVxuICAgIC8vIHRoaXMuYWRkZWQvY2hhbmdlZC9yZWFkeS9ldGMsIHRoZSB1c2VyIGNhbiBqdXN0IHJldHVybiBhIGNvbGxlY3Rpb25cbiAgICAvLyBjdXJzb3Igb3IgYXJyYXkgb2YgY3Vyc29ycyBmcm9tIHRoZSBwdWJsaXNoIGZ1bmN0aW9uOyB3ZSBjYWxsIHRoZWlyXG4gICAgLy8gX3B1Ymxpc2hDdXJzb3IgbWV0aG9kIHdoaWNoIHN0YXJ0cyBvYnNlcnZpbmcgdGhlIGN1cnNvciBhbmQgcHVibGlzaGVzIHRoZVxuICAgIC8vIHJlc3VsdHMuIE5vdGUgdGhhdCBfcHVibGlzaEN1cnNvciBkb2VzIE5PVCBjYWxsIHJlYWR5KCkuXG4gICAgLy9cbiAgICAvLyBYWFggVGhpcyB1c2VzIGFuIHVuZG9jdW1lbnRlZCBpbnRlcmZhY2Ugd2hpY2ggb25seSB0aGUgTW9uZ28gY3Vyc29yXG4gICAgLy8gaW50ZXJmYWNlIHB1Ymxpc2hlcy4gU2hvdWxkIHdlIG1ha2UgdGhpcyBpbnRlcmZhY2UgcHVibGljIGFuZCBlbmNvdXJhZ2VcbiAgICAvLyB1c2VycyB0byBpbXBsZW1lbnQgaXQgdGhlbXNlbHZlcz8gQXJndWFibHksIGl0J3MgdW5uZWNlc3Nhcnk7IHVzZXJzIGNhblxuICAgIC8vIGFscmVhZHkgd3JpdGUgdGhlaXIgb3duIGZ1bmN0aW9ucyBsaWtlXG4gICAgLy8gICB2YXIgcHVibGlzaE15UmVhY3RpdmVUaGluZ3kgPSBmdW5jdGlvbiAobmFtZSwgaGFuZGxlcikge1xuICAgIC8vICAgICBNZXRlb3IucHVibGlzaChuYW1lLCBmdW5jdGlvbiAoKSB7XG4gICAgLy8gICAgICAgdmFyIHJlYWN0aXZlVGhpbmd5ID0gaGFuZGxlcigpO1xuICAgIC8vICAgICAgIHJlYWN0aXZlVGhpbmd5LnB1Ymxpc2hNZSgpO1xuICAgIC8vICAgICB9KTtcbiAgICAvLyAgIH07XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGlzQ3Vyc29yID0gZnVuY3Rpb24gKGMpIHtcbiAgICAgIHJldHVybiBjICYmIGMuX3B1Ymxpc2hDdXJzb3I7XG4gICAgfTtcbiAgICBpZiAoaXNDdXJzb3IocmVzKSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgcmVzLl9wdWJsaXNoQ3Vyc29yKHNlbGYpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBzZWxmLmVycm9yKGUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyBfcHVibGlzaEN1cnNvciBvbmx5IHJldHVybnMgYWZ0ZXIgdGhlIGluaXRpYWwgYWRkZWQgY2FsbGJhY2tzIGhhdmUgcnVuLlxuICAgICAgLy8gbWFyayBzdWJzY3JpcHRpb24gYXMgcmVhZHkuXG4gICAgICBzZWxmLnJlYWR5KCk7XG4gICAgfSBlbHNlIGlmIChfLmlzQXJyYXkocmVzKSkge1xuICAgICAgLy8gQ2hlY2sgYWxsIHRoZSBlbGVtZW50cyBhcmUgY3Vyc29yc1xuICAgICAgaWYgKCEgXy5hbGwocmVzLCBpc0N1cnNvcikpIHtcbiAgICAgICAgc2VsZi5lcnJvcihuZXcgRXJyb3IoXCJQdWJsaXNoIGZ1bmN0aW9uIHJldHVybmVkIGFuIGFycmF5IG9mIG5vbi1DdXJzb3JzXCIpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgLy8gRmluZCBkdXBsaWNhdGUgY29sbGVjdGlvbiBuYW1lc1xuICAgICAgLy8gWFhYIHdlIHNob3VsZCBzdXBwb3J0IG92ZXJsYXBwaW5nIGN1cnNvcnMsIGJ1dCB0aGF0IHdvdWxkIHJlcXVpcmUgdGhlXG4gICAgICAvLyBtZXJnZSBib3ggdG8gYWxsb3cgb3ZlcmxhcCB3aXRoaW4gYSBzdWJzY3JpcHRpb25cbiAgICAgIHZhciBjb2xsZWN0aW9uTmFtZXMgPSB7fTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gcmVzW2ldLl9nZXRDb2xsZWN0aW9uTmFtZSgpO1xuICAgICAgICBpZiAoXy5oYXMoY29sbGVjdGlvbk5hbWVzLCBjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgICAgICBzZWxmLmVycm9yKG5ldyBFcnJvcihcbiAgICAgICAgICAgIFwiUHVibGlzaCBmdW5jdGlvbiByZXR1cm5lZCBtdWx0aXBsZSBjdXJzb3JzIGZvciBjb2xsZWN0aW9uIFwiICtcbiAgICAgICAgICAgICAgY29sbGVjdGlvbk5hbWUpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29sbGVjdGlvbk5hbWVzW2NvbGxlY3Rpb25OYW1lXSA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHJlcy5tYXAoY3VyID0+IGN1ci5fcHVibGlzaEN1cnNvcihzZWxmKSkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBzZWxmLmVycm9yKGUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBzZWxmLnJlYWR5KCk7XG4gICAgfSBlbHNlIGlmIChyZXMpIHtcbiAgICAgIC8vIFRydXRoeSB2YWx1ZXMgb3RoZXIgdGhhbiBjdXJzb3JzIG9yIGFycmF5cyBhcmUgcHJvYmFibHkgYVxuICAgICAgLy8gdXNlciBtaXN0YWtlIChwb3NzaWJsZSByZXR1cm5pbmcgYSBNb25nbyBkb2N1bWVudCB2aWEsIHNheSxcbiAgICAgIC8vIGBjb2xsLmZpbmRPbmUoKWApLlxuICAgICAgc2VsZi5lcnJvcihuZXcgRXJyb3IoXCJQdWJsaXNoIGZ1bmN0aW9uIGNhbiBvbmx5IHJldHVybiBhIEN1cnNvciBvciBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgKyBcImFuIGFycmF5IG9mIEN1cnNvcnNcIikpO1xuICAgIH1cbiAgfSxcblxuICAvLyBUaGlzIGNhbGxzIGFsbCBzdG9wIGNhbGxiYWNrcyBhbmQgcHJldmVudHMgdGhlIGhhbmRsZXIgZnJvbSB1cGRhdGluZyBhbnlcbiAgLy8gU2Vzc2lvbkNvbGxlY3Rpb25WaWV3cyBmdXJ0aGVyLiBJdCdzIHVzZWQgd2hlbiB0aGUgdXNlciB1bnN1YnNjcmliZXMgb3JcbiAgLy8gZGlzY29ubmVjdHMsIGFzIHdlbGwgYXMgZHVyaW5nIHNldFVzZXJJZCByZS1ydW5zLiBJdCBkb2VzICpOT1QqIHNlbmRcbiAgLy8gcmVtb3ZlZCBtZXNzYWdlcyBmb3IgdGhlIHB1Ymxpc2hlZCBvYmplY3RzOyBpZiB0aGF0IGlzIG5lY2Vzc2FyeSwgY2FsbFxuICAvLyBfcmVtb3ZlQWxsRG9jdW1lbnRzIGZpcnN0LlxuICBfZGVhY3RpdmF0ZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9kZWFjdGl2YXRlZClcbiAgICAgIHJldHVybjtcbiAgICBzZWxmLl9kZWFjdGl2YXRlZCA9IHRydWU7XG4gICAgc2VsZi5fY2FsbFN0b3BDYWxsYmFja3MoKTtcbiAgICBQYWNrYWdlWydmYWN0cy1iYXNlJ10gJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICBcImxpdmVkYXRhXCIsIFwic3Vic2NyaXB0aW9uc1wiLCAtMSk7XG4gIH0sXG5cbiAgX2NhbGxTdG9wQ2FsbGJhY2tzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC8vIFRlbGwgbGlzdGVuZXJzLCBzbyB0aGV5IGNhbiBjbGVhbiB1cFxuICAgIHZhciBjYWxsYmFja3MgPSBzZWxmLl9zdG9wQ2FsbGJhY2tzO1xuICAgIHNlbGYuX3N0b3BDYWxsYmFja3MgPSBbXTtcbiAgICBfLmVhY2goY2FsbGJhY2tzLCBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIGNhbGxiYWNrKCk7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gU2VuZCByZW1vdmUgbWVzc2FnZXMgZm9yIGV2ZXJ5IGRvY3VtZW50LlxuICBfcmVtb3ZlQWxsRG9jdW1lbnRzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX2RvY3VtZW50cy5mb3JFYWNoKGZ1bmN0aW9uIChjb2xsZWN0aW9uRG9jcywgY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgY29sbGVjdGlvbkRvY3MuZm9yRWFjaChmdW5jdGlvbiAoc3RySWQpIHtcbiAgICAgICAgICBzZWxmLnJlbW92ZWQoY29sbGVjdGlvbk5hbWUsIHNlbGYuX2lkRmlsdGVyLmlkUGFyc2Uoc3RySWQpKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBSZXR1cm5zIGEgbmV3IFN1YnNjcmlwdGlvbiBmb3IgdGhlIHNhbWUgc2Vzc2lvbiB3aXRoIHRoZSBzYW1lXG4gIC8vIGluaXRpYWwgY3JlYXRpb24gcGFyYW1ldGVycy4gVGhpcyBpc24ndCBhIGNsb25lOiBpdCBkb2Vzbid0IGhhdmVcbiAgLy8gdGhlIHNhbWUgX2RvY3VtZW50cyBjYWNoZSwgc3RvcHBlZCBzdGF0ZSBvciBjYWxsYmFja3M7IG1heSBoYXZlIGFcbiAgLy8gZGlmZmVyZW50IF9zdWJzY3JpcHRpb25IYW5kbGUsIGFuZCBnZXRzIGl0cyB1c2VySWQgZnJvbSB0aGVcbiAgLy8gc2Vzc2lvbiwgbm90IGZyb20gdGhpcyBvYmplY3QuXG4gIF9yZWNyZWF0ZTogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gbmV3IFN1YnNjcmlwdGlvbihcbiAgICAgIHNlbGYuX3Nlc3Npb24sIHNlbGYuX2hhbmRsZXIsIHNlbGYuX3N1YnNjcmlwdGlvbklkLCBzZWxmLl9wYXJhbXMsXG4gICAgICBzZWxmLl9uYW1lKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uICBTdG9wcyB0aGlzIGNsaWVudCdzIHN1YnNjcmlwdGlvbiwgdHJpZ2dlcmluZyBhIGNhbGwgb24gdGhlIGNsaWVudCB0byB0aGUgYG9uU3RvcGAgY2FsbGJhY2sgcGFzc2VkIHRvIFtgTWV0ZW9yLnN1YnNjcmliZWBdKCNtZXRlb3Jfc3Vic2NyaWJlKSwgaWYgYW55LiBJZiBgZXJyb3JgIGlzIG5vdCBhIFtgTWV0ZW9yLkVycm9yYF0oI21ldGVvcl9lcnJvciksIGl0IHdpbGwgYmUgW3Nhbml0aXplZF0oI21ldGVvcl9lcnJvcikuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgVGhlIGVycm9yIHRvIHBhc3MgdG8gdGhlIGNsaWVudC5cbiAgICogQGluc3RhbmNlXG4gICAqIEBtZW1iZXJPZiBTdWJzY3JpcHRpb25cbiAgICovXG4gIGVycm9yOiBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2lzRGVhY3RpdmF0ZWQoKSlcbiAgICAgIHJldHVybjtcbiAgICBzZWxmLl9zZXNzaW9uLl9zdG9wU3Vic2NyaXB0aW9uKHNlbGYuX3N1YnNjcmlwdGlvbklkLCBlcnJvcik7XG4gIH0sXG5cbiAgLy8gTm90ZSB0aGF0IHdoaWxlIG91ciBERFAgY2xpZW50IHdpbGwgbm90aWNlIHRoYXQgeW91J3ZlIGNhbGxlZCBzdG9wKCkgb24gdGhlXG4gIC8vIHNlcnZlciAoYW5kIGNsZWFuIHVwIGl0cyBfc3Vic2NyaXB0aW9ucyB0YWJsZSkgd2UgZG9uJ3QgYWN0dWFsbHkgcHJvdmlkZSBhXG4gIC8vIG1lY2hhbmlzbSBmb3IgYW4gYXBwIHRvIG5vdGljZSB0aGlzICh0aGUgc3Vic2NyaWJlIG9uRXJyb3IgY2FsbGJhY2sgb25seVxuICAvLyB0cmlnZ2VycyBpZiB0aGVyZSBpcyBhbiBlcnJvcikuXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgU3RvcHMgdGhpcyBjbGllbnQncyBzdWJzY3JpcHRpb24gYW5kIGludm9rZXMgdGhlIGNsaWVudCdzIGBvblN0b3BgIGNhbGxiYWNrIHdpdGggbm8gZXJyb3IuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQGluc3RhbmNlXG4gICAqIEBtZW1iZXJPZiBTdWJzY3JpcHRpb25cbiAgICovXG4gIHN0b3A6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2lzRGVhY3RpdmF0ZWQoKSlcbiAgICAgIHJldHVybjtcbiAgICBzZWxmLl9zZXNzaW9uLl9zdG9wU3Vic2NyaXB0aW9uKHNlbGYuX3N1YnNjcmlwdGlvbklkKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uICBSZWdpc3RlcnMgYSBjYWxsYmFjayBmdW5jdGlvbiB0byBydW4gd2hlbiB0aGUgc3Vic2NyaXB0aW9uIGlzIHN0b3BwZWQuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgY2FsbGJhY2sgZnVuY3Rpb25cbiAgICovXG4gIG9uU3RvcDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGNhbGxiYWNrID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChjYWxsYmFjaywgJ29uU3RvcCBjYWxsYmFjaycsIHNlbGYpO1xuICAgIGlmIChzZWxmLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICBjYWxsYmFjaygpO1xuICAgIGVsc2VcbiAgICAgIHNlbGYuX3N0b3BDYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG4gIH0sXG5cbiAgLy8gVGhpcyByZXR1cm5zIHRydWUgaWYgdGhlIHN1YiBoYXMgYmVlbiBkZWFjdGl2YXRlZCwgKk9SKiBpZiB0aGUgc2Vzc2lvbiB3YXNcbiAgLy8gZGVzdHJveWVkIGJ1dCB0aGUgZGVmZXJyZWQgY2FsbCB0byBfZGVhY3RpdmF0ZUFsbFN1YnNjcmlwdGlvbnMgaGFzbid0XG4gIC8vIGhhcHBlbmVkIHlldC5cbiAgX2lzRGVhY3RpdmF0ZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIHNlbGYuX2RlYWN0aXZhdGVkIHx8IHNlbGYuX3Nlc3Npb24uaW5RdWV1ZSA9PT0gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uICBJbmZvcm1zIHRoZSBzdWJzY3JpYmVyIHRoYXQgYSBkb2N1bWVudCBoYXMgYmVlbiBhZGRlZCB0byB0aGUgcmVjb3JkIHNldC5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gY29sbGVjdGlvbiBUaGUgbmFtZSBvZiB0aGUgY29sbGVjdGlvbiB0aGF0IGNvbnRhaW5zIHRoZSBuZXcgZG9jdW1lbnQuXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBpZCBUaGUgbmV3IGRvY3VtZW50J3MgSUQuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBmaWVsZHMgVGhlIGZpZWxkcyBpbiB0aGUgbmV3IGRvY3VtZW50LiAgSWYgYF9pZGAgaXMgcHJlc2VudCBpdCBpcyBpZ25vcmVkLlxuICAgKi9cbiAgYWRkZWQgKGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKSB7XG4gICAgaWYgKHRoaXMuX2lzRGVhY3RpdmF0ZWQoKSlcbiAgICAgIHJldHVybjtcbiAgICBpZCA9IHRoaXMuX2lkRmlsdGVyLmlkU3RyaW5naWZ5KGlkKTtcblxuICAgIGlmICh0aGlzLl9zZXNzaW9uLnNlcnZlci5nZXRQdWJsaWNhdGlvblN0cmF0ZWd5KGNvbGxlY3Rpb25OYW1lKS5kb0FjY291bnRpbmdGb3JDb2xsZWN0aW9uKSB7XG4gICAgICBsZXQgaWRzID0gdGhpcy5fZG9jdW1lbnRzLmdldChjb2xsZWN0aW9uTmFtZSk7XG4gICAgICBpZiAoaWRzID09IG51bGwpIHtcbiAgICAgICAgaWRzID0gbmV3IFNldCgpO1xuICAgICAgICB0aGlzLl9kb2N1bWVudHMuc2V0KGNvbGxlY3Rpb25OYW1lLCBpZHMpO1xuICAgICAgfVxuICAgICAgaWRzLmFkZChpZCk7XG4gICAgfVxuXG4gICAgdGhpcy5fc2Vzc2lvbi5hZGRlZCh0aGlzLl9zdWJzY3JpcHRpb25IYW5kbGUsIGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uICBJbmZvcm1zIHRoZSBzdWJzY3JpYmVyIHRoYXQgYSBkb2N1bWVudCBpbiB0aGUgcmVjb3JkIHNldCBoYXMgYmVlbiBtb2RpZmllZC5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gY29sbGVjdGlvbiBUaGUgbmFtZSBvZiB0aGUgY29sbGVjdGlvbiB0aGF0IGNvbnRhaW5zIHRoZSBjaGFuZ2VkIGRvY3VtZW50LlxuICAgKiBAcGFyYW0ge1N0cmluZ30gaWQgVGhlIGNoYW5nZWQgZG9jdW1lbnQncyBJRC5cbiAgICogQHBhcmFtIHtPYmplY3R9IGZpZWxkcyBUaGUgZmllbGRzIGluIHRoZSBkb2N1bWVudCB0aGF0IGhhdmUgY2hhbmdlZCwgdG9nZXRoZXIgd2l0aCB0aGVpciBuZXcgdmFsdWVzLiAgSWYgYSBmaWVsZCBpcyBub3QgcHJlc2VudCBpbiBgZmllbGRzYCBpdCB3YXMgbGVmdCB1bmNoYW5nZWQ7IGlmIGl0IGlzIHByZXNlbnQgaW4gYGZpZWxkc2AgYW5kIGhhcyBhIHZhbHVlIG9mIGB1bmRlZmluZWRgIGl0IHdhcyByZW1vdmVkIGZyb20gdGhlIGRvY3VtZW50LiAgSWYgYF9pZGAgaXMgcHJlc2VudCBpdCBpcyBpZ25vcmVkLlxuICAgKi9cbiAgY2hhbmdlZCAoY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAodGhpcy5faXNEZWFjdGl2YXRlZCgpKVxuICAgICAgcmV0dXJuO1xuICAgIGlkID0gdGhpcy5faWRGaWx0ZXIuaWRTdHJpbmdpZnkoaWQpO1xuICAgIHRoaXMuX3Nlc3Npb24uY2hhbmdlZCh0aGlzLl9zdWJzY3JpcHRpb25IYW5kbGUsIGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uICBJbmZvcm1zIHRoZSBzdWJzY3JpYmVyIHRoYXQgYSBkb2N1bWVudCBoYXMgYmVlbiByZW1vdmVkIGZyb20gdGhlIHJlY29yZCBzZXQuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIG5hbWUgb2YgdGhlIGNvbGxlY3Rpb24gdGhhdCB0aGUgZG9jdW1lbnQgaGFzIGJlZW4gcmVtb3ZlZCBmcm9tLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gaWQgVGhlIElEIG9mIHRoZSBkb2N1bWVudCB0aGF0IGhhcyBiZWVuIHJlbW92ZWQuXG4gICAqL1xuICByZW1vdmVkIChjb2xsZWN0aW9uTmFtZSwgaWQpIHtcbiAgICBpZiAodGhpcy5faXNEZWFjdGl2YXRlZCgpKVxuICAgICAgcmV0dXJuO1xuICAgIGlkID0gdGhpcy5faWRGaWx0ZXIuaWRTdHJpbmdpZnkoaWQpO1xuXG4gICAgaWYgKHRoaXMuX3Nlc3Npb24uc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUpLmRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb24pIHtcbiAgICAgIC8vIFdlIGRvbid0IGJvdGhlciB0byBkZWxldGUgc2V0cyBvZiB0aGluZ3MgaW4gYSBjb2xsZWN0aW9uIGlmIHRoZVxuICAgICAgLy8gY29sbGVjdGlvbiBpcyBlbXB0eS4gIEl0IGNvdWxkIGJyZWFrIF9yZW1vdmVBbGxEb2N1bWVudHMuXG4gICAgICB0aGlzLl9kb2N1bWVudHMuZ2V0KGNvbGxlY3Rpb25OYW1lKS5kZWxldGUoaWQpO1xuICAgIH1cblxuICAgIHRoaXMuX3Nlc3Npb24ucmVtb3ZlZCh0aGlzLl9zdWJzY3JpcHRpb25IYW5kbGUsIGNvbGxlY3Rpb25OYW1lLCBpZCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgSW5mb3JtcyB0aGUgc3Vic2NyaWJlciB0aGF0IGFuIGluaXRpYWwsIGNvbXBsZXRlIHNuYXBzaG90IG9mIHRoZSByZWNvcmQgc2V0IGhhcyBiZWVuIHNlbnQuICBUaGlzIHdpbGwgdHJpZ2dlciBhIGNhbGwgb24gdGhlIGNsaWVudCB0byB0aGUgYG9uUmVhZHlgIGNhbGxiYWNrIHBhc3NlZCB0byAgW2BNZXRlb3Iuc3Vic2NyaWJlYF0oI21ldGVvcl9zdWJzY3JpYmUpLCBpZiBhbnkuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICovXG4gIHJlYWR5OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgaWYgKCFzZWxmLl9zdWJzY3JpcHRpb25JZClcbiAgICAgIHJldHVybjsgIC8vIFVubmVjZXNzYXJ5IGJ1dCBpZ25vcmVkIGZvciB1bml2ZXJzYWwgc3ViXG4gICAgaWYgKCFzZWxmLl9yZWFkeSkge1xuICAgICAgc2VsZi5fc2Vzc2lvbi5zZW5kUmVhZHkoW3NlbGYuX3N1YnNjcmlwdGlvbklkXSk7XG4gICAgICBzZWxmLl9yZWFkeSA9IHRydWU7XG4gICAgfVxuICB9XG59KTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qIFNlcnZlciAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICovXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5TZXJ2ZXIgPSBmdW5jdGlvbiAob3B0aW9ucyA9IHt9KSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICAvLyBUaGUgZGVmYXVsdCBoZWFydGJlYXQgaW50ZXJ2YWwgaXMgMzAgc2Vjb25kcyBvbiB0aGUgc2VydmVyIGFuZCAzNVxuICAvLyBzZWNvbmRzIG9uIHRoZSBjbGllbnQuICBTaW5jZSB0aGUgY2xpZW50IGRvZXNuJ3QgbmVlZCB0byBzZW5kIGFcbiAgLy8gcGluZyBhcyBsb25nIGFzIGl0IGlzIHJlY2VpdmluZyBwaW5ncywgdGhpcyBtZWFucyB0aGF0IHBpbmdzXG4gIC8vIG5vcm1hbGx5IGdvIGZyb20gdGhlIHNlcnZlciB0byB0aGUgY2xpZW50LlxuICAvL1xuICAvLyBOb3RlOiBUcm9wb3NwaGVyZSBkZXBlbmRzIG9uIHRoZSBhYmlsaXR5IHRvIG11dGF0ZVxuICAvLyBNZXRlb3Iuc2VydmVyLm9wdGlvbnMuaGVhcnRiZWF0VGltZW91dCEgVGhpcyBpcyBhIGhhY2ssIGJ1dCBpdCdzIGxpZmUuXG4gIHNlbGYub3B0aW9ucyA9IHtcbiAgICBoZWFydGJlYXRJbnRlcnZhbDogMTUwMDAsXG4gICAgaGVhcnRiZWF0VGltZW91dDogMTUwMDAsXG4gICAgLy8gRm9yIHRlc3RpbmcsIGFsbG93IHJlc3BvbmRpbmcgdG8gcGluZ3MgdG8gYmUgZGlzYWJsZWQuXG4gICAgcmVzcG9uZFRvUGluZ3M6IHRydWUsXG4gICAgZGVmYXVsdFB1YmxpY2F0aW9uU3RyYXRlZ3k6IHB1YmxpY2F0aW9uU3RyYXRlZ2llcy5TRVJWRVJfTUVSR0UsXG4gICAgLi4ub3B0aW9ucyxcbiAgfTtcblxuICAvLyBNYXAgb2YgY2FsbGJhY2tzIHRvIGNhbGwgd2hlbiBhIG5ldyBjb25uZWN0aW9uIGNvbWVzIGluIHRvIHRoZVxuICAvLyBzZXJ2ZXIgYW5kIGNvbXBsZXRlcyBERFAgdmVyc2lvbiBuZWdvdGlhdGlvbi4gVXNlIGFuIG9iamVjdCBpbnN0ZWFkXG4gIC8vIG9mIGFuIGFycmF5IHNvIHdlIGNhbiBzYWZlbHkgcmVtb3ZlIG9uZSBmcm9tIHRoZSBsaXN0IHdoaWxlXG4gIC8vIGl0ZXJhdGluZyBvdmVyIGl0LlxuICBzZWxmLm9uQ29ubmVjdGlvbkhvb2sgPSBuZXcgSG9vayh7XG4gICAgZGVidWdQcmludEV4Y2VwdGlvbnM6IFwib25Db25uZWN0aW9uIGNhbGxiYWNrXCJcbiAgfSk7XG5cbiAgLy8gTWFwIG9mIGNhbGxiYWNrcyB0byBjYWxsIHdoZW4gYSBuZXcgbWVzc2FnZSBjb21lcyBpbi5cbiAgc2VsZi5vbk1lc3NhZ2VIb29rID0gbmV3IEhvb2soe1xuICAgIGRlYnVnUHJpbnRFeGNlcHRpb25zOiBcIm9uTWVzc2FnZSBjYWxsYmFja1wiXG4gIH0pO1xuXG4gIHNlbGYucHVibGlzaF9oYW5kbGVycyA9IHt9O1xuICBzZWxmLnVuaXZlcnNhbF9wdWJsaXNoX2hhbmRsZXJzID0gW107XG5cbiAgc2VsZi5tZXRob2RfaGFuZGxlcnMgPSB7fTtcblxuICBzZWxmLl9wdWJsaWNhdGlvblN0cmF0ZWdpZXMgPSB7fTtcblxuICBzZWxmLnNlc3Npb25zID0gbmV3IE1hcCgpOyAvLyBtYXAgZnJvbSBpZCB0byBzZXNzaW9uXG5cbiAgc2VsZi5zdHJlYW1fc2VydmVyID0gbmV3IFN0cmVhbVNlcnZlcigpO1xuXG4gIHNlbGYuc3RyZWFtX3NlcnZlci5yZWdpc3RlcihmdW5jdGlvbiAoc29ja2V0KSB7XG4gICAgLy8gc29ja2V0IGltcGxlbWVudHMgdGhlIFNvY2tKU0Nvbm5lY3Rpb24gaW50ZXJmYWNlXG4gICAgc29ja2V0Ll9tZXRlb3JTZXNzaW9uID0gbnVsbDtcblxuICAgIHZhciBzZW5kRXJyb3IgPSBmdW5jdGlvbiAocmVhc29uLCBvZmZlbmRpbmdNZXNzYWdlKSB7XG4gICAgICB2YXIgbXNnID0ge21zZzogJ2Vycm9yJywgcmVhc29uOiByZWFzb259O1xuICAgICAgaWYgKG9mZmVuZGluZ01lc3NhZ2UpXG4gICAgICAgIG1zZy5vZmZlbmRpbmdNZXNzYWdlID0gb2ZmZW5kaW5nTWVzc2FnZTtcbiAgICAgIHNvY2tldC5zZW5kKEREUENvbW1vbi5zdHJpbmdpZnlERFAobXNnKSk7XG4gICAgfTtcblxuICAgIHNvY2tldC5vbignZGF0YScsIGZ1bmN0aW9uIChyYXdfbXNnKSB7XG4gICAgICBpZiAoTWV0ZW9yLl9wcmludFJlY2VpdmVkRERQKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJSZWNlaXZlZCBERFBcIiwgcmF3X21zZyk7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHZhciBtc2cgPSBERFBDb21tb24ucGFyc2VERFAocmF3X21zZyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIHNlbmRFcnJvcignUGFyc2UgZXJyb3InKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1zZyA9PT0gbnVsbCB8fCAhbXNnLm1zZykge1xuICAgICAgICAgIHNlbmRFcnJvcignQmFkIHJlcXVlc3QnLCBtc2cpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtc2cubXNnID09PSAnY29ubmVjdCcpIHtcbiAgICAgICAgICBpZiAoc29ja2V0Ll9tZXRlb3JTZXNzaW9uKSB7XG4gICAgICAgICAgICBzZW5kRXJyb3IoXCJBbHJlYWR5IGNvbm5lY3RlZFwiLCBtc2cpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHNlbGYuX2hhbmRsZUNvbm5lY3Qoc29ja2V0LCBtc2cpO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFzb2NrZXQuX21ldGVvclNlc3Npb24pIHtcbiAgICAgICAgICBzZW5kRXJyb3IoJ011c3QgY29ubmVjdCBmaXJzdCcsIG1zZyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbi5wcm9jZXNzTWVzc2FnZShtc2cpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBYWFggcHJpbnQgc3RhY2sgbmljZWx5XG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJJbnRlcm5hbCBleGNlcHRpb24gd2hpbGUgcHJvY2Vzc2luZyBtZXNzYWdlXCIsIG1zZywgZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBzb2NrZXQub24oJ2Nsb3NlJywgZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHNvY2tldC5fbWV0ZW9yU2Vzc2lvbikge1xuICAgICAgICBzb2NrZXQuX21ldGVvclNlc3Npb24uY2xvc2UoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG59O1xuXG5PYmplY3QuYXNzaWduKFNlcnZlci5wcm90b3R5cGUsIHtcblxuICAvKipcbiAgICogQHN1bW1hcnkgUmVnaXN0ZXIgYSBjYWxsYmFjayB0byBiZSBjYWxsZWQgd2hlbiBhIG5ldyBERFAgY29ubmVjdGlvbiBpcyBtYWRlIHRvIHRoZSBzZXJ2ZXIuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgd2hlbiBhIG5ldyBERFAgY29ubmVjdGlvbiBpcyBlc3RhYmxpc2hlZC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqL1xuICBvbkNvbm5lY3Rpb246IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gc2VsZi5vbkNvbm5lY3Rpb25Ib29rLnJlZ2lzdGVyKGZuKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgU2V0IHB1YmxpY2F0aW9uIHN0cmF0ZWd5IGZvciB0aGUgZ2l2ZW4gY29sbGVjdGlvbi4gUHVibGljYXRpb25zIHN0cmF0ZWdpZXMgYXJlIGF2YWlsYWJsZSBmcm9tIGBERFBTZXJ2ZXIucHVibGljYXRpb25TdHJhdGVnaWVzYC4gWW91IGNhbGwgdGhpcyBtZXRob2QgZnJvbSBgTWV0ZW9yLnNlcnZlcmAsIGxpa2UgYE1ldGVvci5zZXJ2ZXIuc2V0UHVibGljYXRpb25TdHJhdGVneSgpYFxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBhbGlhcyBzZXRQdWJsaWNhdGlvblN0cmF0ZWd5XG4gICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgKiBAcGFyYW0gc3RyYXRlZ3kge3t1c2VDb2xsZWN0aW9uVmlldzogYm9vbGVhbiwgZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbjogYm9vbGVhbn19XG4gICAqIEBtZW1iZXJPZiBNZXRlb3Iuc2VydmVyXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICovXG4gIHNldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUsIHN0cmF0ZWd5KSB7XG4gICAgaWYgKCFPYmplY3QudmFsdWVzKHB1YmxpY2F0aW9uU3RyYXRlZ2llcykuaW5jbHVkZXMoc3RyYXRlZ3kpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbWVyZ2Ugc3RyYXRlZ3k6ICR7c3RyYXRlZ3l9IFxuICAgICAgICBmb3IgY29sbGVjdGlvbiAke2NvbGxlY3Rpb25OYW1lfWApO1xuICAgIH1cbiAgICB0aGlzLl9wdWJsaWNhdGlvblN0cmF0ZWdpZXNbY29sbGVjdGlvbk5hbWVdID0gc3RyYXRlZ3k7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEdldHMgdGhlIHB1YmxpY2F0aW9uIHN0cmF0ZWd5IGZvciB0aGUgcmVxdWVzdGVkIGNvbGxlY3Rpb24uIFlvdSBjYWxsIHRoaXMgbWV0aG9kIGZyb20gYE1ldGVvci5zZXJ2ZXJgLCBsaWtlIGBNZXRlb3Iuc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koKWBcbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAYWxpYXMgZ2V0UHVibGljYXRpb25TdHJhdGVneVxuICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICogQG1lbWJlck9mIE1ldGVvci5zZXJ2ZXJcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAcmV0dXJuIHt7dXNlQ29sbGVjdGlvblZpZXc6IGJvb2xlYW4sIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IGJvb2xlYW59fVxuICAgKi9cbiAgZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkge1xuICAgIHJldHVybiB0aGlzLl9wdWJsaWNhdGlvblN0cmF0ZWdpZXNbY29sbGVjdGlvbk5hbWVdXG4gICAgICB8fCB0aGlzLm9wdGlvbnMuZGVmYXVsdFB1YmxpY2F0aW9uU3RyYXRlZ3k7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJlZ2lzdGVyIGEgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIHdoZW4gYSBuZXcgRERQIG1lc3NhZ2UgaXMgcmVjZWl2ZWQuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgd2hlbiBhIG5ldyBERFAgbWVzc2FnZSBpcyByZWNlaXZlZC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqL1xuICBvbk1lc3NhZ2U6IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gc2VsZi5vbk1lc3NhZ2VIb29rLnJlZ2lzdGVyKGZuKTtcbiAgfSxcblxuICBfaGFuZGxlQ29ubmVjdDogZnVuY3Rpb24gKHNvY2tldCwgbXNnKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gVGhlIGNvbm5lY3QgbWVzc2FnZSBtdXN0IHNwZWNpZnkgYSB2ZXJzaW9uIGFuZCBhbiBhcnJheSBvZiBzdXBwb3J0ZWRcbiAgICAvLyB2ZXJzaW9ucywgYW5kIGl0IG11c3QgY2xhaW0gdG8gc3VwcG9ydCB3aGF0IGl0IGlzIHByb3Bvc2luZy5cbiAgICBpZiAoISh0eXBlb2YgKG1zZy52ZXJzaW9uKSA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgICBfLmlzQXJyYXkobXNnLnN1cHBvcnQpICYmXG4gICAgICAgICAgXy5hbGwobXNnLnN1cHBvcnQsIF8uaXNTdHJpbmcpICYmXG4gICAgICAgICAgXy5jb250YWlucyhtc2cuc3VwcG9ydCwgbXNnLnZlcnNpb24pKSkge1xuICAgICAgc29ja2V0LnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUCh7bXNnOiAnZmFpbGVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvbjogRERQQ29tbW9uLlNVUFBPUlRFRF9ERFBfVkVSU0lPTlNbMF19KSk7XG4gICAgICBzb2NrZXQuY2xvc2UoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBJbiB0aGUgZnV0dXJlLCBoYW5kbGUgc2Vzc2lvbiByZXN1bXB0aW9uOiBzb21ldGhpbmcgbGlrZTpcbiAgICAvLyAgc29ja2V0Ll9tZXRlb3JTZXNzaW9uID0gc2VsZi5zZXNzaW9uc1ttc2cuc2Vzc2lvbl1cbiAgICB2YXIgdmVyc2lvbiA9IGNhbGN1bGF0ZVZlcnNpb24obXNnLnN1cHBvcnQsIEREUENvbW1vbi5TVVBQT1JURURfRERQX1ZFUlNJT05TKTtcblxuICAgIGlmIChtc2cudmVyc2lvbiAhPT0gdmVyc2lvbikge1xuICAgICAgLy8gVGhlIGJlc3QgdmVyc2lvbiB0byB1c2UgKGFjY29yZGluZyB0byB0aGUgY2xpZW50J3Mgc3RhdGVkIHByZWZlcmVuY2VzKVxuICAgICAgLy8gaXMgbm90IHRoZSBvbmUgdGhlIGNsaWVudCBpcyB0cnlpbmcgdG8gdXNlLiBJbmZvcm0gdGhlbSBhYm91dCB0aGUgYmVzdFxuICAgICAgLy8gdmVyc2lvbiB0byB1c2UuXG4gICAgICBzb2NrZXQuc2VuZChERFBDb21tb24uc3RyaW5naWZ5RERQKHttc2c6ICdmYWlsZWQnLCB2ZXJzaW9uOiB2ZXJzaW9ufSkpO1xuICAgICAgc29ja2V0LmNsb3NlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gWWF5LCB2ZXJzaW9uIG1hdGNoZXMhIENyZWF0ZSBhIG5ldyBzZXNzaW9uLlxuICAgIC8vIE5vdGU6IFRyb3Bvc3BoZXJlIGRlcGVuZHMgb24gdGhlIGFiaWxpdHkgdG8gbXV0YXRlXG4gICAgLy8gTWV0ZW9yLnNlcnZlci5vcHRpb25zLmhlYXJ0YmVhdFRpbWVvdXQhIFRoaXMgaXMgYSBoYWNrLCBidXQgaXQncyBsaWZlLlxuICAgIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbiA9IG5ldyBTZXNzaW9uKHNlbGYsIHZlcnNpb24sIHNvY2tldCwgc2VsZi5vcHRpb25zKTtcbiAgICBzZWxmLnNlc3Npb25zLnNldChzb2NrZXQuX21ldGVvclNlc3Npb24uaWQsIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbik7XG4gICAgc2VsZi5vbkNvbm5lY3Rpb25Ib29rLmVhY2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICBpZiAoc29ja2V0Ll9tZXRlb3JTZXNzaW9uKVxuICAgICAgICBjYWxsYmFjayhzb2NrZXQuX21ldGVvclNlc3Npb24uY29ubmVjdGlvbkhhbmRsZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgfSxcbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgcHVibGlzaCBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfSBpZGVudGlmaWVyIGZvciBxdWVyeVxuICAgKiBAcGFyYW0gaGFuZGxlciB7RnVuY3Rpb259IHB1Ymxpc2ggaGFuZGxlclxuICAgKiBAcGFyYW0gb3B0aW9ucyB7T2JqZWN0fVxuICAgKlxuICAgKiBTZXJ2ZXIgd2lsbCBjYWxsIGhhbmRsZXIgZnVuY3Rpb24gb24gZWFjaCBuZXcgc3Vic2NyaXB0aW9uLFxuICAgKiBlaXRoZXIgd2hlbiByZWNlaXZpbmcgRERQIHN1YiBtZXNzYWdlIGZvciBhIG5hbWVkIHN1YnNjcmlwdGlvbiwgb3Igb25cbiAgICogRERQIGNvbm5lY3QgZm9yIGEgdW5pdmVyc2FsIHN1YnNjcmlwdGlvbi5cbiAgICpcbiAgICogSWYgbmFtZSBpcyBudWxsLCB0aGlzIHdpbGwgYmUgYSBzdWJzY3JpcHRpb24gdGhhdCBpc1xuICAgKiBhdXRvbWF0aWNhbGx5IGVzdGFibGlzaGVkIGFuZCBwZXJtYW5lbnRseSBvbiBmb3IgYWxsIGNvbm5lY3RlZFxuICAgKiBjbGllbnQsIGluc3RlYWQgb2YgYSBzdWJzY3JpcHRpb24gdGhhdCBjYW4gYmUgdHVybmVkIG9uIGFuZCBvZmZcbiAgICogd2l0aCBzdWJzY3JpYmUoKS5cbiAgICpcbiAgICogb3B0aW9ucyB0byBjb250YWluOlxuICAgKiAgLSAobW9zdGx5IGludGVybmFsKSBpc19hdXRvOiB0cnVlIGlmIGdlbmVyYXRlZCBhdXRvbWF0aWNhbGx5XG4gICAqICAgIGZyb20gYW4gYXV0b3B1Ymxpc2ggaG9vay4gdGhpcyBpcyBmb3IgY29zbWV0aWMgcHVycG9zZXMgb25seVxuICAgKiAgICAoaXQgbGV0cyB1cyBkZXRlcm1pbmUgd2hldGhlciB0byBwcmludCBhIHdhcm5pbmcgc3VnZ2VzdGluZ1xuICAgKiAgICB0aGF0IHlvdSB0dXJuIG9mZiBhdXRvcHVibGlzaCkuXG4gICAqL1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBQdWJsaXNoIGEgcmVjb3JkIHNldC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBuYW1lIElmIFN0cmluZywgbmFtZSBvZiB0aGUgcmVjb3JkIHNldC4gIElmIE9iamVjdCwgcHVibGljYXRpb25zIERpY3Rpb25hcnkgb2YgcHVibGlzaCBmdW5jdGlvbnMgYnkgbmFtZS4gIElmIGBudWxsYCwgdGhlIHNldCBoYXMgbm8gbmFtZSwgYW5kIHRoZSByZWNvcmQgc2V0IGlzIGF1dG9tYXRpY2FsbHkgc2VudCB0byBhbGwgY29ubmVjdGVkIGNsaWVudHMuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgRnVuY3Rpb24gY2FsbGVkIG9uIHRoZSBzZXJ2ZXIgZWFjaCB0aW1lIGEgY2xpZW50IHN1YnNjcmliZXMuICBJbnNpZGUgdGhlIGZ1bmN0aW9uLCBgdGhpc2AgaXMgdGhlIHB1Ymxpc2ggaGFuZGxlciBvYmplY3QsIGRlc2NyaWJlZCBiZWxvdy4gIElmIHRoZSBjbGllbnQgcGFzc2VkIGFyZ3VtZW50cyB0byBgc3Vic2NyaWJlYCwgdGhlIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIHRoZSBzYW1lIGFyZ3VtZW50cy5cbiAgICovXG4gIHB1Ymxpc2g6IGZ1bmN0aW9uIChuYW1lLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKCEgXy5pc09iamVjdChuYW1lKSkge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICAgIGlmIChuYW1lICYmIG5hbWUgaW4gc2VsZi5wdWJsaXNoX2hhbmRsZXJzKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJJZ25vcmluZyBkdXBsaWNhdGUgcHVibGlzaCBuYW1lZCAnXCIgKyBuYW1lICsgXCInXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChQYWNrYWdlLmF1dG9wdWJsaXNoICYmICFvcHRpb25zLmlzX2F1dG8pIHtcbiAgICAgICAgLy8gVGhleSBoYXZlIGF1dG9wdWJsaXNoIG9uLCB5ZXQgdGhleSdyZSB0cnlpbmcgdG8gbWFudWFsbHlcbiAgICAgICAgLy8gcGljayBzdHVmZiB0byBwdWJsaXNoLiBUaGV5IHByb2JhYmx5IHNob3VsZCB0dXJuIG9mZlxuICAgICAgICAvLyBhdXRvcHVibGlzaC4gKFRoaXMgY2hlY2sgaXNuJ3QgcGVyZmVjdCAtLSBpZiB5b3UgY3JlYXRlIGFcbiAgICAgICAgLy8gcHVibGlzaCBiZWZvcmUgeW91IHR1cm4gb24gYXV0b3B1Ymxpc2gsIGl0IHdvbid0IGNhdGNoXG4gICAgICAgIC8vIGl0LCBidXQgdGhpcyB3aWxsIGRlZmluaXRlbHkgaGFuZGxlIHRoZSBzaW1wbGUgY2FzZSB3aGVyZVxuICAgICAgICAvLyB5b3UndmUgYWRkZWQgdGhlIGF1dG9wdWJsaXNoIHBhY2thZ2UgdG8geW91ciBhcHAsIGFuZCBhcmVcbiAgICAgICAgLy8gY2FsbGluZyBwdWJsaXNoIGZyb20geW91ciBhcHAgY29kZSkuXG4gICAgICAgIGlmICghc2VsZi53YXJuZWRfYWJvdXRfYXV0b3B1Ymxpc2gpIHtcbiAgICAgICAgICBzZWxmLndhcm5lZF9hYm91dF9hdXRvcHVibGlzaCA9IHRydWU7XG4gICAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcbiAgICBcIioqIFlvdSd2ZSBzZXQgdXAgc29tZSBkYXRhIHN1YnNjcmlwdGlvbnMgd2l0aCBNZXRlb3IucHVibGlzaCgpLCBidXRcXG5cIiArXG4gICAgXCIqKiB5b3Ugc3RpbGwgaGF2ZSBhdXRvcHVibGlzaCB0dXJuZWQgb24uIEJlY2F1c2UgYXV0b3B1Ymxpc2ggaXMgc3RpbGxcXG5cIiArXG4gICAgXCIqKiBvbiwgeW91ciBNZXRlb3IucHVibGlzaCgpIGNhbGxzIHdvbid0IGhhdmUgbXVjaCBlZmZlY3QuIEFsbCBkYXRhXFxuXCIgK1xuICAgIFwiKiogd2lsbCBzdGlsbCBiZSBzZW50IHRvIGFsbCBjbGllbnRzLlxcblwiICtcbiAgICBcIioqXFxuXCIgK1xuICAgIFwiKiogVHVybiBvZmYgYXV0b3B1Ymxpc2ggYnkgcmVtb3ZpbmcgdGhlIGF1dG9wdWJsaXNoIHBhY2thZ2U6XFxuXCIgK1xuICAgIFwiKipcXG5cIiArXG4gICAgXCIqKiAgICQgbWV0ZW9yIHJlbW92ZSBhdXRvcHVibGlzaFxcblwiICtcbiAgICBcIioqXFxuXCIgK1xuICAgIFwiKiogLi4gYW5kIG1ha2Ugc3VyZSB5b3UgaGF2ZSBNZXRlb3IucHVibGlzaCgpIGFuZCBNZXRlb3Iuc3Vic2NyaWJlKCkgY2FsbHNcXG5cIiArXG4gICAgXCIqKiBmb3IgZWFjaCBjb2xsZWN0aW9uIHRoYXQgeW91IHdhbnQgY2xpZW50cyB0byBzZWUuXFxuXCIpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChuYW1lKVxuICAgICAgICBzZWxmLnB1Ymxpc2hfaGFuZGxlcnNbbmFtZV0gPSBoYW5kbGVyO1xuICAgICAgZWxzZSB7XG4gICAgICAgIHNlbGYudW5pdmVyc2FsX3B1Ymxpc2hfaGFuZGxlcnMucHVzaChoYW5kbGVyKTtcbiAgICAgICAgLy8gU3BpbiB1cCB0aGUgbmV3IHB1Ymxpc2hlciBvbiBhbnkgZXhpc3Rpbmcgc2Vzc2lvbiB0b28uIFJ1biBlYWNoXG4gICAgICAgIC8vIHNlc3Npb24ncyBzdWJzY3JpcHRpb24gaW4gYSBuZXcgRmliZXIsIHNvIHRoYXQgdGhlcmUncyBubyBjaGFuZ2UgZm9yXG4gICAgICAgIC8vIHNlbGYuc2Vzc2lvbnMgdG8gY2hhbmdlIHdoaWxlIHdlJ3JlIHJ1bm5pbmcgdGhpcyBsb29wLlxuICAgICAgICBzZWxmLnNlc3Npb25zLmZvckVhY2goZnVuY3Rpb24gKHNlc3Npb24pIHtcbiAgICAgICAgICBpZiAoIXNlc3Npb24uX2RvbnRTdGFydE5ld1VuaXZlcnNhbFN1YnMpIHtcbiAgICAgICAgICAgIHNlc3Npb24uX3N0YXJ0U3Vic2NyaXB0aW9uKGhhbmRsZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2V7XG4gICAgICBfLmVhY2gobmFtZSwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgICBzZWxmLnB1Ymxpc2goa2V5LCB2YWx1ZSwge30pO1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIF9yZW1vdmVTZXNzaW9uOiBmdW5jdGlvbiAoc2Vzc2lvbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnNlc3Npb25zLmRlbGV0ZShzZXNzaW9uLmlkKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgVGVsbHMgaWYgdGhlIG1ldGhvZCBjYWxsIGNhbWUgZnJvbSBhIGNhbGwgb3IgYSBjYWxsQXN5bmMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQHJldHVybnMgYm9vbGVhblxuICAgKi9cbiAgaXNBc3luY0NhbGw6IGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX2lzQ2FsbEFzeW5jTWV0aG9kUnVubmluZygpXG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IERlZmluZXMgZnVuY3Rpb25zIHRoYXQgY2FuIGJlIGludm9rZWQgb3ZlciB0aGUgbmV0d29yayBieSBjbGllbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtPYmplY3R9IG1ldGhvZHMgRGljdGlvbmFyeSB3aG9zZSBrZXlzIGFyZSBtZXRob2QgbmFtZXMgYW5kIHZhbHVlcyBhcmUgZnVuY3Rpb25zLlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICovXG4gIG1ldGhvZHM6IGZ1bmN0aW9uIChtZXRob2RzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIF8uZWFjaChtZXRob2RzLCBmdW5jdGlvbiAoZnVuYywgbmFtZSkge1xuICAgICAgaWYgKHR5cGVvZiBmdW5jICE9PSAnZnVuY3Rpb24nKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNZXRob2QgJ1wiICsgbmFtZSArIFwiJyBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XG4gICAgICBpZiAoc2VsZi5tZXRob2RfaGFuZGxlcnNbbmFtZV0pXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgbWV0aG9kIG5hbWVkICdcIiArIG5hbWUgKyBcIicgaXMgYWxyZWFkeSBkZWZpbmVkXCIpO1xuICAgICAgc2VsZi5tZXRob2RfaGFuZGxlcnNbbmFtZV0gPSBmdW5jO1xuICAgIH0pO1xuICB9LFxuXG4gIGNhbGw6IGZ1bmN0aW9uIChuYW1lLCAuLi5hcmdzKSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoICYmIHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgLy8gSWYgaXQncyBhIGZ1bmN0aW9uLCB0aGUgbGFzdCBhcmd1bWVudCBpcyB0aGUgcmVzdWx0IGNhbGxiYWNrLCBub3RcbiAgICAgIC8vIGEgcGFyYW1ldGVyIHRvIHRoZSByZW1vdGUgbWV0aG9kLlxuICAgICAgdmFyIGNhbGxiYWNrID0gYXJncy5wb3AoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5hcHBseShuYW1lLCBhcmdzLCBjYWxsYmFjayk7XG4gIH0sXG5cbiAgLy8gQSB2ZXJzaW9uIG9mIHRoZSBjYWxsIG1ldGhvZCB0aGF0IGFsd2F5cyByZXR1cm5zIGEgUHJvbWlzZS5cbiAgY2FsbEFzeW5jOiBmdW5jdGlvbiAobmFtZSwgLi4uYXJncykge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBhcmdzWzBdPy5oYXNPd25Qcm9wZXJ0eSgncmV0dXJuU3R1YlZhbHVlJylcbiAgICAgID8gYXJncy5zaGlmdCgpXG4gICAgICA6IHt9O1xuICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldCgpO1xuICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmcodHJ1ZSk7XG4gICAgY29uc3QgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIEREUC5fQ3VycmVudENhbGxBc3luY0ludm9jYXRpb24uX3NldCh7IG5hbWUsIGhhc0NhbGxBc3luY1BhcmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuYXBwbHlBc3luYyhuYW1lLCBhcmdzLCB7IGlzRnJvbUNhbGxBc3luYzogdHJ1ZSwgLi4ub3B0aW9ucyB9KVxuICAgICAgICAudGhlbihyZXNvbHZlKVxuICAgICAgICAuY2F0Y2gocmVqZWN0KVxuICAgICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgRERQLl9DdXJyZW50Q2FsbEFzeW5jSW52b2NhdGlvbi5fc2V0KCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBwcm9taXNlLmZpbmFsbHkoKCkgPT5cbiAgICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmcoZmFsc2UpXG4gICAgKTtcbiAgfSxcblxuICBhcHBseTogZnVuY3Rpb24gKG5hbWUsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgLy8gV2Ugd2VyZSBwYXNzZWQgMyBhcmd1bWVudHMuIFRoZXkgbWF5IGJlIGVpdGhlciAobmFtZSwgYXJncywgb3B0aW9ucylcbiAgICAvLyBvciAobmFtZSwgYXJncywgY2FsbGJhY2spXG4gICAgaWYgKCEgY2FsbGJhY2sgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgfVxuICAgIGNvbnN0IHByb21pc2UgPSB0aGlzLmFwcGx5QXN5bmMobmFtZSwgYXJncywgb3B0aW9ucyk7XG5cbiAgICAvLyBSZXR1cm4gdGhlIHJlc3VsdCBpbiB3aGljaGV2ZXIgd2F5IHRoZSBjYWxsZXIgYXNrZWQgZm9yIGl0LiBOb3RlIHRoYXQgd2VcbiAgICAvLyBkbyBOT1QgYmxvY2sgb24gdGhlIHdyaXRlIGZlbmNlIGluIGFuIGFuYWxvZ291cyB3YXkgdG8gaG93IHRoZSBjbGllbnRcbiAgICAvLyBibG9ja3Mgb24gdGhlIHJlbGV2YW50IGRhdGEgYmVpbmcgdmlzaWJsZSwgc28geW91IGFyZSBOT1QgZ3VhcmFudGVlZCB0aGF0XG4gICAgLy8gY3Vyc29yIG9ic2VydmUgY2FsbGJhY2tzIGhhdmUgZmlyZWQgd2hlbiB5b3VyIGNhbGxiYWNrIGlzIGludm9rZWQuIChXZVxuICAgIC8vIGNhbiBjaGFuZ2UgdGhpcyBpZiB0aGVyZSdzIGEgcmVhbCB1c2UgY2FzZSkuXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICBwcm9taXNlLnRoZW4oXG4gICAgICAgIHJlc3VsdCA9PiBjYWxsYmFjayh1bmRlZmluZWQsIHJlc3VsdCksXG4gICAgICAgIGV4Y2VwdGlvbiA9PiBjYWxsYmFjayhleGNlcHRpb24pXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gQHBhcmFtIG9wdGlvbnMge09wdGlvbmFsIE9iamVjdH1cbiAgYXBwbHlBc3luYzogZnVuY3Rpb24gKG5hbWUsIGFyZ3MsIG9wdGlvbnMpIHtcbiAgICAvLyBSdW4gdGhlIGhhbmRsZXJcbiAgICB2YXIgaGFuZGxlciA9IHRoaXMubWV0aG9kX2hhbmRsZXJzW25hbWVdO1xuXG4gICAgaWYgKCEgaGFuZGxlcikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KFxuICAgICAgICBuZXcgTWV0ZW9yLkVycm9yKDQwNCwgYE1ldGhvZCAnJHtuYW1lfScgbm90IGZvdW5kYClcbiAgICAgICk7XG4gICAgfVxuICAgIC8vIElmIHRoaXMgaXMgYSBtZXRob2QgY2FsbCBmcm9tIHdpdGhpbiBhbm90aGVyIG1ldGhvZCBvciBwdWJsaXNoIGZ1bmN0aW9uLFxuICAgIC8vIGdldCB0aGUgdXNlciBzdGF0ZSBmcm9tIHRoZSBvdXRlciBtZXRob2Qgb3IgcHVibGlzaCBmdW5jdGlvbiwgb3RoZXJ3aXNlXG4gICAgLy8gZG9uJ3QgYWxsb3cgc2V0VXNlcklkIHRvIGJlIGNhbGxlZFxuICAgIHZhciB1c2VySWQgPSBudWxsO1xuICAgIGxldCBzZXRVc2VySWQgPSAoKSA9PiB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjYWxsIHNldFVzZXJJZCBvbiBhIHNlcnZlciBpbml0aWF0ZWQgbWV0aG9kIGNhbGxcIik7XG4gICAgfTtcbiAgICB2YXIgY29ubmVjdGlvbiA9IG51bGw7XG4gICAgdmFyIGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgICB2YXIgY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbiA9IEREUC5fQ3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi5nZXQoKTtcbiAgICB2YXIgcmFuZG9tU2VlZCA9IG51bGw7XG5cbiAgICBpZiAoY3VycmVudE1ldGhvZEludm9jYXRpb24pIHtcbiAgICAgIHVzZXJJZCA9IGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLnVzZXJJZDtcbiAgICAgIHNldFVzZXJJZCA9ICh1c2VySWQpID0+IGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLnNldFVzZXJJZCh1c2VySWQpO1xuICAgICAgY29ubmVjdGlvbiA9IGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmNvbm5lY3Rpb247XG4gICAgICByYW5kb21TZWVkID0gRERQQ29tbW9uLm1ha2VScGNTZWVkKGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLCBuYW1lKTtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24pIHtcbiAgICAgIHVzZXJJZCA9IGN1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24udXNlcklkO1xuICAgICAgc2V0VXNlcklkID0gKHVzZXJJZCkgPT4gY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi5fc2Vzc2lvbi5fc2V0VXNlcklkKHVzZXJJZCk7XG4gICAgICBjb25uZWN0aW9uID0gY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi5jb25uZWN0aW9uO1xuICAgIH1cblxuICAgIHZhciBpbnZvY2F0aW9uID0gbmV3IEREUENvbW1vbi5NZXRob2RJbnZvY2F0aW9uKHtcbiAgICAgIGlzU2ltdWxhdGlvbjogZmFsc2UsXG4gICAgICB1c2VySWQsXG4gICAgICBzZXRVc2VySWQsXG4gICAgICBjb25uZWN0aW9uLFxuICAgICAgcmFuZG9tU2VlZFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZXN1bHQ7XG4gICAgICB0cnkge1xuICAgICAgICByZXN1bHQgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLndpdGhWYWx1ZShpbnZvY2F0aW9uLCAoKSA9PlxuICAgICAgICAgIG1heWJlQXVkaXRBcmd1bWVudENoZWNrcyhcbiAgICAgICAgICAgIGhhbmRsZXIsXG4gICAgICAgICAgICBpbnZvY2F0aW9uLFxuICAgICAgICAgICAgRUpTT04uY2xvbmUoYXJncyksXG4gICAgICAgICAgICBcImludGVybmFsIGNhbGwgdG8gJ1wiICsgbmFtZSArIFwiJ1wiXG4gICAgICAgICAgKVxuICAgICAgICApO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gcmVqZWN0KGUpO1xuICAgICAgfVxuICAgICAgaWYgKCFNZXRlb3IuX2lzUHJvbWlzZShyZXN1bHQpKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlKHJlc3VsdCk7XG4gICAgICB9XG4gICAgICByZXN1bHQudGhlbihyID0+IHJlc29sdmUocikpLmNhdGNoKHJlamVjdCk7XG4gICAgfSkudGhlbihFSlNPTi5jbG9uZSk7XG4gIH0sXG5cbiAgX3VybEZvclNlc3Npb246IGZ1bmN0aW9uIChzZXNzaW9uSWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHNlc3Npb24gPSBzZWxmLnNlc3Npb25zLmdldChzZXNzaW9uSWQpO1xuICAgIGlmIChzZXNzaW9uKVxuICAgICAgcmV0dXJuIHNlc3Npb24uX3NvY2tldFVybDtcbiAgICBlbHNlXG4gICAgICByZXR1cm4gbnVsbDtcbiAgfVxufSk7XG5cbnZhciBjYWxjdWxhdGVWZXJzaW9uID0gZnVuY3Rpb24gKGNsaWVudFN1cHBvcnRlZFZlcnNpb25zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyU3VwcG9ydGVkVmVyc2lvbnMpIHtcbiAgdmFyIGNvcnJlY3RWZXJzaW9uID0gXy5maW5kKGNsaWVudFN1cHBvcnRlZFZlcnNpb25zLCBmdW5jdGlvbiAodmVyc2lvbikge1xuICAgIHJldHVybiBfLmNvbnRhaW5zKHNlcnZlclN1cHBvcnRlZFZlcnNpb25zLCB2ZXJzaW9uKTtcbiAgfSk7XG4gIGlmICghY29ycmVjdFZlcnNpb24pIHtcbiAgICBjb3JyZWN0VmVyc2lvbiA9IHNlcnZlclN1cHBvcnRlZFZlcnNpb25zWzBdO1xuICB9XG4gIHJldHVybiBjb3JyZWN0VmVyc2lvbjtcbn07XG5cbkREUFNlcnZlci5fY2FsY3VsYXRlVmVyc2lvbiA9IGNhbGN1bGF0ZVZlcnNpb247XG5cblxuLy8gXCJibGluZFwiIGV4Y2VwdGlvbnMgb3RoZXIgdGhhbiB0aG9zZSB0aGF0IHdlcmUgZGVsaWJlcmF0ZWx5IHRocm93biB0byBzaWduYWxcbi8vIGVycm9ycyB0byB0aGUgY2xpZW50XG52YXIgd3JhcEludGVybmFsRXhjZXB0aW9uID0gZnVuY3Rpb24gKGV4Y2VwdGlvbiwgY29udGV4dCkge1xuICBpZiAoIWV4Y2VwdGlvbikgcmV0dXJuIGV4Y2VwdGlvbjtcblxuICAvLyBUbyBhbGxvdyBwYWNrYWdlcyB0byB0aHJvdyBlcnJvcnMgaW50ZW5kZWQgZm9yIHRoZSBjbGllbnQgYnV0IG5vdCBoYXZlIHRvXG4gIC8vIGRlcGVuZCBvbiB0aGUgTWV0ZW9yLkVycm9yIGNsYXNzLCBgaXNDbGllbnRTYWZlYCBjYW4gYmUgc2V0IHRvIHRydWUgb24gYW55XG4gIC8vIGVycm9yIGJlZm9yZSBpdCBpcyB0aHJvd24uXG4gIGlmIChleGNlcHRpb24uaXNDbGllbnRTYWZlKSB7XG4gICAgaWYgKCEoZXhjZXB0aW9uIGluc3RhbmNlb2YgTWV0ZW9yLkVycm9yKSkge1xuICAgICAgY29uc3Qgb3JpZ2luYWxNZXNzYWdlID0gZXhjZXB0aW9uLm1lc3NhZ2U7XG4gICAgICBleGNlcHRpb24gPSBuZXcgTWV0ZW9yLkVycm9yKGV4Y2VwdGlvbi5lcnJvciwgZXhjZXB0aW9uLnJlYXNvbiwgZXhjZXB0aW9uLmRldGFpbHMpO1xuICAgICAgZXhjZXB0aW9uLm1lc3NhZ2UgPSBvcmlnaW5hbE1lc3NhZ2U7XG4gICAgfVxuICAgIHJldHVybiBleGNlcHRpb247XG4gIH1cblxuICAvLyBUZXN0cyBjYW4gc2V0IHRoZSAnX2V4cGVjdGVkQnlUZXN0JyBmbGFnIG9uIGFuIGV4Y2VwdGlvbiBzbyBpdCB3b24ndCBnbyB0b1xuICAvLyB0aGUgc2VydmVyIGxvZy5cbiAgaWYgKCFleGNlcHRpb24uX2V4cGVjdGVkQnlUZXN0KSB7XG4gICAgTWV0ZW9yLl9kZWJ1ZyhcIkV4Y2VwdGlvbiBcIiArIGNvbnRleHQsIGV4Y2VwdGlvbi5zdGFjayk7XG4gICAgaWYgKGV4Y2VwdGlvbi5zYW5pdGl6ZWRFcnJvcikge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIlNhbml0aXplZCBhbmQgcmVwb3J0ZWQgdG8gdGhlIGNsaWVudCBhczpcIiwgZXhjZXB0aW9uLnNhbml0aXplZEVycm9yKTtcbiAgICAgIE1ldGVvci5fZGVidWcoKTtcbiAgICB9XG4gIH1cblxuICAvLyBEaWQgdGhlIGVycm9yIGNvbnRhaW4gbW9yZSBkZXRhaWxzIHRoYXQgY291bGQgaGF2ZSBiZWVuIHVzZWZ1bCBpZiBjYXVnaHQgaW5cbiAgLy8gc2VydmVyIGNvZGUgKG9yIGlmIHRocm93biBmcm9tIG5vbi1jbGllbnQtb3JpZ2luYXRlZCBjb2RlKSwgYnV0IGFsc29cbiAgLy8gcHJvdmlkZWQgYSBcInNhbml0aXplZFwiIHZlcnNpb24gd2l0aCBtb3JlIGNvbnRleHQgdGhhbiA1MDAgSW50ZXJuYWwgc2VydmVyXG4gIC8vIGVycm9yPyBVc2UgdGhhdC5cbiAgaWYgKGV4Y2VwdGlvbi5zYW5pdGl6ZWRFcnJvcikge1xuICAgIGlmIChleGNlcHRpb24uc2FuaXRpemVkRXJyb3IuaXNDbGllbnRTYWZlKVxuICAgICAgcmV0dXJuIGV4Y2VwdGlvbi5zYW5pdGl6ZWRFcnJvcjtcbiAgICBNZXRlb3IuX2RlYnVnKFwiRXhjZXB0aW9uIFwiICsgY29udGV4dCArIFwiIHByb3ZpZGVzIGEgc2FuaXRpemVkRXJyb3IgdGhhdCBcIiArXG4gICAgICAgICAgICAgICAgICBcImRvZXMgbm90IGhhdmUgaXNDbGllbnRTYWZlIHByb3BlcnR5IHNldDsgaWdub3JpbmdcIik7XG4gIH1cblxuICByZXR1cm4gbmV3IE1ldGVvci5FcnJvcig1MDAsIFwiSW50ZXJuYWwgc2VydmVyIGVycm9yXCIpO1xufTtcblxuXG4vLyBBdWRpdCBhcmd1bWVudCBjaGVja3MsIGlmIHRoZSBhdWRpdC1hcmd1bWVudC1jaGVja3MgcGFja2FnZSBleGlzdHMgKGl0IGlzIGFcbi8vIHdlYWsgZGVwZW5kZW5jeSBvZiB0aGlzIHBhY2thZ2UpLlxudmFyIG1heWJlQXVkaXRBcmd1bWVudENoZWNrcyA9IGZ1bmN0aW9uIChmLCBjb250ZXh0LCBhcmdzLCBkZXNjcmlwdGlvbikge1xuICBhcmdzID0gYXJncyB8fCBbXTtcbiAgaWYgKFBhY2thZ2VbJ2F1ZGl0LWFyZ3VtZW50LWNoZWNrcyddKSB7XG4gICAgcmV0dXJuIE1hdGNoLl9mYWlsSWZBcmd1bWVudHNBcmVOb3RBbGxDaGVja2VkKFxuICAgICAgZiwgY29udGV4dCwgYXJncywgZGVzY3JpcHRpb24pO1xuICB9XG4gIHJldHVybiBmLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xufTtcbiIsIi8vIEEgd3JpdGUgZmVuY2UgY29sbGVjdHMgYSBncm91cCBvZiB3cml0ZXMsIGFuZCBwcm92aWRlcyBhIGNhbGxiYWNrXG4vLyB3aGVuIGFsbCBvZiB0aGUgd3JpdGVzIGFyZSBmdWxseSBjb21taXR0ZWQgYW5kIHByb3BhZ2F0ZWQgKGFsbFxuLy8gb2JzZXJ2ZXJzIGhhdmUgYmVlbiBub3RpZmllZCBvZiB0aGUgd3JpdGUgYW5kIGFja25vd2xlZGdlZCBpdC4pXG4vL1xuRERQU2VydmVyLl9Xcml0ZUZlbmNlID0gY2xhc3Mge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmFybWVkID0gZmFsc2U7XG4gICAgdGhpcy5maXJlZCA9IGZhbHNlO1xuICAgIHRoaXMucmV0aXJlZCA9IGZhbHNlO1xuICAgIHRoaXMub3V0c3RhbmRpbmdfd3JpdGVzID0gMDtcbiAgICB0aGlzLmJlZm9yZV9maXJlX2NhbGxiYWNrcyA9IFtdO1xuICAgIHRoaXMuY29tcGxldGlvbl9jYWxsYmFja3MgPSBbXTtcbiAgfVxuXG4gIC8vIFN0YXJ0IHRyYWNraW5nIGEgd3JpdGUsIGFuZCByZXR1cm4gYW4gb2JqZWN0IHRvIHJlcHJlc2VudCBpdC4gVGhlXG4gIC8vIG9iamVjdCBoYXMgYSBzaW5nbGUgbWV0aG9kLCBjb21taXR0ZWQoKS4gVGhpcyBtZXRob2Qgc2hvdWxkIGJlXG4gIC8vIGNhbGxlZCB3aGVuIHRoZSB3cml0ZSBpcyBmdWxseSBjb21taXR0ZWQgYW5kIHByb3BhZ2F0ZWQuIFlvdSBjYW5cbiAgLy8gY29udGludWUgdG8gYWRkIHdyaXRlcyB0byB0aGUgV3JpdGVGZW5jZSB1cCB1bnRpbCBpdCBpcyB0cmlnZ2VyZWRcbiAgLy8gKGNhbGxzIGl0cyBjYWxsYmFja3MgYmVjYXVzZSBhbGwgd3JpdGVzIGhhdmUgY29tbWl0dGVkLilcbiAgYmVnaW5Xcml0ZSgpIHtcbiAgICBpZiAodGhpcy5yZXRpcmVkKVxuICAgICAgcmV0dXJuIHsgY29tbWl0dGVkOiBmdW5jdGlvbiAoKSB7fSB9O1xuXG4gICAgaWYgKHRoaXMuZmlyZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJmZW5jZSBoYXMgYWxyZWFkeSBhY3RpdmF0ZWQgLS0gdG9vIGxhdGUgdG8gYWRkIHdyaXRlc1wiKTtcblxuICAgIHRoaXMub3V0c3RhbmRpbmdfd3JpdGVzKys7XG4gICAgbGV0IGNvbW1pdHRlZCA9IGZhbHNlO1xuICAgIGNvbnN0IF9jb21taXR0ZWRGbiA9IGFzeW5jICgpID0+IHtcbiAgICAgIGlmIChjb21taXR0ZWQpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImNvbW1pdHRlZCBjYWxsZWQgdHdpY2Ugb24gdGhlIHNhbWUgd3JpdGVcIik7XG4gICAgICBjb21taXR0ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5vdXRzdGFuZGluZ193cml0ZXMtLTtcbiAgICAgIGF3YWl0IHRoaXMuX21heWJlRmlyZSgpO1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29tbWl0dGVkOiBfY29tbWl0dGVkRm4sXG4gICAgfTtcbiAgfVxuXG4gIC8vIEFybSB0aGUgZmVuY2UuIE9uY2UgdGhlIGZlbmNlIGlzIGFybWVkLCBhbmQgdGhlcmUgYXJlIG5vIG1vcmVcbiAgLy8gdW5jb21taXR0ZWQgd3JpdGVzLCBpdCB3aWxsIGFjdGl2YXRlLlxuICBhcm0oKSB7XG5cbiAgICBpZiAodGhpcyA9PT0gRERQU2VydmVyLl9nZXRDdXJyZW50RmVuY2UoKSlcbiAgICAgIHRocm93IEVycm9yKFwiQ2FuJ3QgYXJtIHRoZSBjdXJyZW50IGZlbmNlXCIpO1xuICAgIHRoaXMuYXJtZWQgPSB0cnVlO1xuICAgIHJldHVybiB0aGlzLl9tYXliZUZpcmUoKTtcbiAgfVxuXG4gIC8vIFJlZ2lzdGVyIGEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIG9uY2UgYmVmb3JlIGZpcmluZyB0aGUgZmVuY2UuXG4gIC8vIENhbGxiYWNrIGZ1bmN0aW9uIGNhbiBhZGQgbmV3IHdyaXRlcyB0byB0aGUgZmVuY2UsIGluIHdoaWNoIGNhc2VcbiAgLy8gaXQgd29uJ3QgZmlyZSB1bnRpbCB0aG9zZSB3cml0ZXMgYXJlIGRvbmUgYXMgd2VsbC5cbiAgb25CZWZvcmVGaXJlKGZ1bmMpIHtcbiAgICBpZiAodGhpcy5maXJlZClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImZlbmNlIGhhcyBhbHJlYWR5IGFjdGl2YXRlZCAtLSB0b28gbGF0ZSB0byBcIiArXG4gICAgICAgICAgXCJhZGQgYSBjYWxsYmFja1wiKTtcbiAgICB0aGlzLmJlZm9yZV9maXJlX2NhbGxiYWNrcy5wdXNoKGZ1bmMpO1xuICB9XG5cbiAgLy8gUmVnaXN0ZXIgYSBmdW5jdGlvbiB0byBiZSBjYWxsZWQgd2hlbiB0aGUgZmVuY2UgZmlyZXMuXG4gIG9uQWxsQ29tbWl0dGVkKGZ1bmMpIHtcbiAgICBpZiAodGhpcy5maXJlZClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImZlbmNlIGhhcyBhbHJlYWR5IGFjdGl2YXRlZCAtLSB0b28gbGF0ZSB0byBcIiArXG4gICAgICAgICAgXCJhZGQgYSBjYWxsYmFja1wiKTtcbiAgICB0aGlzLmNvbXBsZXRpb25fY2FsbGJhY2tzLnB1c2goZnVuYyk7XG4gIH1cblxuICBhc3luYyBfYXJtQW5kV2FpdCgpIHtcbiAgICBsZXQgcmVzb2x2ZXI7XG4gICAgY29uc3QgcmV0dXJuVmFsdWUgPSBuZXcgUHJvbWlzZShyID0+IHJlc29sdmVyID0gcik7XG4gICAgdGhpcy5vbkFsbENvbW1pdHRlZChyZXNvbHZlcik7XG4gICAgYXdhaXQgdGhpcy5hcm0oKTtcblxuICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbiAgfVxuICAvLyBDb252ZW5pZW5jZSBmdW5jdGlvbi4gQXJtcyB0aGUgZmVuY2UsIHRoZW4gYmxvY2tzIHVudGlsIGl0IGZpcmVzLlxuICBhc3luYyBhcm1BbmRXYWl0KCkge1xuICAgIHJldHVybiB0aGlzLl9hcm1BbmRXYWl0KCk7XG4gIH1cblxuICBhc3luYyBfbWF5YmVGaXJlKCkge1xuICAgIGlmICh0aGlzLmZpcmVkKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwid3JpdGUgZmVuY2UgYWxyZWFkeSBhY3RpdmF0ZWQ/XCIpO1xuICAgIGlmICh0aGlzLmFybWVkICYmICF0aGlzLm91dHN0YW5kaW5nX3dyaXRlcykge1xuICAgICAgY29uc3QgaW52b2tlQ2FsbGJhY2sgPSBhc3luYyAoZnVuYykgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IGZ1bmModGhpcyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIE1ldGVvci5fZGVidWcoXCJleGNlcHRpb24gaW4gd3JpdGUgZmVuY2UgY2FsbGJhY2s6XCIsIGVycik7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHRoaXMub3V0c3RhbmRpbmdfd3JpdGVzKys7XG4gICAgICB3aGlsZSAodGhpcy5iZWZvcmVfZmlyZV9jYWxsYmFja3MubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBjYiA9IHRoaXMuYmVmb3JlX2ZpcmVfY2FsbGJhY2tzLnNoaWZ0KCk7XG4gICAgICAgIGF3YWl0IGludm9rZUNhbGxiYWNrKGNiKTtcbiAgICAgIH1cbiAgICAgIHRoaXMub3V0c3RhbmRpbmdfd3JpdGVzLS07XG5cbiAgICAgIGlmICghdGhpcy5vdXRzdGFuZGluZ193cml0ZXMpIHtcbiAgICAgICAgdGhpcy5maXJlZCA9IHRydWU7XG4gICAgICAgIGNvbnN0IGNhbGxiYWNrcyA9IHRoaXMuY29tcGxldGlvbl9jYWxsYmFja3MgfHwgW107XG4gICAgICAgIHRoaXMuY29tcGxldGlvbl9jYWxsYmFja3MgPSBbXTtcbiAgICAgICAgd2hpbGUgKGNhbGxiYWNrcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgY29uc3QgY2IgPSBjYWxsYmFja3Muc2hpZnQoKTtcbiAgICAgICAgICBhd2FpdCBpbnZva2VDYWxsYmFjayhjYik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBEZWFjdGl2YXRlIHRoaXMgZmVuY2Ugc28gdGhhdCBhZGRpbmcgbW9yZSB3cml0ZXMgaGFzIG5vIGVmZmVjdC5cbiAgLy8gVGhlIGZlbmNlIG11c3QgaGF2ZSBhbHJlYWR5IGZpcmVkLlxuICByZXRpcmUoKSB7XG4gICAgaWYgKCF0aGlzLmZpcmVkKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgcmV0aXJlIGEgZmVuY2UgdGhhdCBoYXNuJ3QgZmlyZWQuXCIpO1xuICAgIHRoaXMucmV0aXJlZCA9IHRydWU7XG4gIH1cbn07XG5cbi8vIFRoZSBjdXJyZW50IHdyaXRlIGZlbmNlLiBXaGVuIHRoZXJlIGlzIGEgY3VycmVudCB3cml0ZSBmZW5jZSwgY29kZVxuLy8gdGhhdCB3cml0ZXMgdG8gZGF0YWJhc2VzIHNob3VsZCByZWdpc3RlciB0aGVpciB3cml0ZXMgd2l0aCBpdCB1c2luZ1xuLy8gYmVnaW5Xcml0ZSgpLlxuLy9cbkREUFNlcnZlci5fQ3VycmVudFdyaXRlRmVuY2UgPSBuZXcgTWV0ZW9yLkVudmlyb25tZW50VmFyaWFibGU7XG4iLCIvLyBBIFwiY3Jvc3NiYXJcIiBpcyBhIGNsYXNzIHRoYXQgcHJvdmlkZXMgc3RydWN0dXJlZCBub3RpZmljYXRpb24gcmVnaXN0cmF0aW9uLlxuLy8gU2VlIF9tYXRjaCBmb3IgdGhlIGRlZmluaXRpb24gb2YgaG93IGEgbm90aWZpY2F0aW9uIG1hdGNoZXMgYSB0cmlnZ2VyLlxuLy8gQWxsIG5vdGlmaWNhdGlvbnMgYW5kIHRyaWdnZXJzIG11c3QgaGF2ZSBhIHN0cmluZyBrZXkgbmFtZWQgJ2NvbGxlY3Rpb24nLlxuXG5ERFBTZXJ2ZXIuX0Nyb3NzYmFyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICBzZWxmLm5leHRJZCA9IDE7XG4gIC8vIG1hcCBmcm9tIGNvbGxlY3Rpb24gbmFtZSAoc3RyaW5nKSAtPiBsaXN0ZW5lciBpZCAtPiBvYmplY3QuIGVhY2ggb2JqZWN0IGhhc1xuICAvLyBrZXlzICd0cmlnZ2VyJywgJ2NhbGxiYWNrJy4gIEFzIGEgaGFjaywgdGhlIGVtcHR5IHN0cmluZyBtZWFucyBcIm5vXG4gIC8vIGNvbGxlY3Rpb25cIi5cbiAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb24gPSB7fTtcbiAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25Db3VudCA9IHt9O1xuICBzZWxmLmZhY3RQYWNrYWdlID0gb3B0aW9ucy5mYWN0UGFja2FnZSB8fCBcImxpdmVkYXRhXCI7XG4gIHNlbGYuZmFjdE5hbWUgPSBvcHRpb25zLmZhY3ROYW1lIHx8IG51bGw7XG59O1xuXG5fLmV4dGVuZChERFBTZXJ2ZXIuX0Nyb3NzYmFyLnByb3RvdHlwZSwge1xuICAvLyBtc2cgaXMgYSB0cmlnZ2VyIG9yIGEgbm90aWZpY2F0aW9uXG4gIF9jb2xsZWN0aW9uRm9yTWVzc2FnZTogZnVuY3Rpb24gKG1zZykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoISBfLmhhcyhtc2csICdjb2xsZWN0aW9uJykpIHtcbiAgICAgIHJldHVybiAnJztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZihtc2cuY29sbGVjdGlvbikgPT09ICdzdHJpbmcnKSB7XG4gICAgICBpZiAobXNnLmNvbGxlY3Rpb24gPT09ICcnKVxuICAgICAgICB0aHJvdyBFcnJvcihcIk1lc3NhZ2UgaGFzIGVtcHR5IGNvbGxlY3Rpb24hXCIpO1xuICAgICAgcmV0dXJuIG1zZy5jb2xsZWN0aW9uO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBFcnJvcihcIk1lc3NhZ2UgaGFzIG5vbi1zdHJpbmcgY29sbGVjdGlvbiFcIik7XG4gICAgfVxuICB9LFxuXG4gIC8vIExpc3RlbiBmb3Igbm90aWZpY2F0aW9uIHRoYXQgbWF0Y2ggJ3RyaWdnZXInLiBBIG5vdGlmaWNhdGlvblxuICAvLyBtYXRjaGVzIGlmIGl0IGhhcyB0aGUga2V5LXZhbHVlIHBhaXJzIGluIHRyaWdnZXIgYXMgYVxuICAvLyBzdWJzZXQuIFdoZW4gYSBub3RpZmljYXRpb24gbWF0Y2hlcywgY2FsbCAnY2FsbGJhY2snLCBwYXNzaW5nXG4gIC8vIHRoZSBhY3R1YWwgbm90aWZpY2F0aW9uLlxuICAvL1xuICAvLyBSZXR1cm5zIGEgbGlzdGVuIGhhbmRsZSwgd2hpY2ggaXMgYW4gb2JqZWN0IHdpdGggYSBtZXRob2RcbiAgLy8gc3RvcCgpLiBDYWxsIHN0b3AoKSB0byBzdG9wIGxpc3RlbmluZy5cbiAgLy9cbiAgLy8gWFhYIEl0IHNob3VsZCBiZSBsZWdhbCB0byBjYWxsIGZpcmUoKSBmcm9tIGluc2lkZSBhIGxpc3RlbigpXG4gIC8vIGNhbGxiYWNrP1xuICBsaXN0ZW46IGZ1bmN0aW9uICh0cmlnZ2VyLCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgaWQgPSBzZWxmLm5leHRJZCsrO1xuXG4gICAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLl9jb2xsZWN0aW9uRm9yTWVzc2FnZSh0cmlnZ2VyKTtcbiAgICB2YXIgcmVjb3JkID0ge3RyaWdnZXI6IEVKU09OLmNsb25lKHRyaWdnZXIpLCBjYWxsYmFjazogY2FsbGJhY2t9O1xuICAgIGlmICghIF8uaGFzKHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uLCBjb2xsZWN0aW9uKSkge1xuICAgICAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbl0gPSB7fTtcbiAgICAgIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnRbY29sbGVjdGlvbl0gPSAwO1xuICAgIH1cbiAgICBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uXVtpZF0gPSByZWNvcmQ7XG4gICAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25Db3VudFtjb2xsZWN0aW9uXSsrO1xuXG4gICAgaWYgKHNlbGYuZmFjdE5hbWUgJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddKSB7XG4gICAgICBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgICAgc2VsZi5mYWN0UGFja2FnZSwgc2VsZi5mYWN0TmFtZSwgMSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0b3A6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHNlbGYuZmFjdE5hbWUgJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddKSB7XG4gICAgICAgICAgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICAgICAgICBzZWxmLmZhY3RQYWNrYWdlLCBzZWxmLmZhY3ROYW1lLCAtMSk7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25dW2lkXTtcbiAgICAgICAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25Db3VudFtjb2xsZWN0aW9uXS0tO1xuICAgICAgICBpZiAoc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25Db3VudFtjb2xsZWN0aW9uXSA9PT0gMCkge1xuICAgICAgICAgIGRlbGV0ZSBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uXTtcbiAgICAgICAgICBkZWxldGUgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25Db3VudFtjb2xsZWN0aW9uXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gIH0sXG5cbiAgLy8gRmlyZSB0aGUgcHJvdmlkZWQgJ25vdGlmaWNhdGlvbicgKGFuIG9iamVjdCB3aG9zZSBhdHRyaWJ1dGVcbiAgLy8gdmFsdWVzIGFyZSBhbGwgSlNPTi1jb21wYXRpYmlsZSkgLS0gaW5mb3JtIGFsbCBtYXRjaGluZyBsaXN0ZW5lcnNcbiAgLy8gKHJlZ2lzdGVyZWQgd2l0aCBsaXN0ZW4oKSkuXG4gIC8vXG4gIC8vIElmIGZpcmUoKSBpcyBjYWxsZWQgaW5zaWRlIGEgd3JpdGUgZmVuY2UsIHRoZW4gZWFjaCBvZiB0aGVcbiAgLy8gbGlzdGVuZXIgY2FsbGJhY2tzIHdpbGwgYmUgY2FsbGVkIGluc2lkZSB0aGUgd3JpdGUgZmVuY2UgYXMgd2VsbC5cbiAgLy9cbiAgLy8gVGhlIGxpc3RlbmVycyBtYXkgYmUgaW52b2tlZCBpbiBwYXJhbGxlbCwgcmF0aGVyIHRoYW4gc2VyaWFsbHkuXG4gIGZpcmU6IGFzeW5jIGZ1bmN0aW9uIChub3RpZmljYXRpb24pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgY29sbGVjdGlvbiA9IHNlbGYuX2NvbGxlY3Rpb25Gb3JNZXNzYWdlKG5vdGlmaWNhdGlvbik7XG5cbiAgICBpZiAoISBfLmhhcyhzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbiwgY29sbGVjdGlvbikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgbGlzdGVuZXJzRm9yQ29sbGVjdGlvbiA9IHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25dO1xuICAgIHZhciBjYWxsYmFja0lkcyA9IFtdO1xuICAgIF8uZWFjaChsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uLCBmdW5jdGlvbiAobCwgaWQpIHtcbiAgICAgIGlmIChzZWxmLl9tYXRjaGVzKG5vdGlmaWNhdGlvbiwgbC50cmlnZ2VyKSkge1xuICAgICAgICBjYWxsYmFja0lkcy5wdXNoKGlkKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIExpc3RlbmVyIGNhbGxiYWNrcyBjYW4geWllbGQsIHNvIHdlIG5lZWQgdG8gZmlyc3QgZmluZCBhbGwgdGhlIG9uZXMgdGhhdFxuICAgIC8vIG1hdGNoIGluIGEgc2luZ2xlIGl0ZXJhdGlvbiBvdmVyIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uICh3aGljaCBjYW4ndFxuICAgIC8vIGJlIG11dGF0ZWQgZHVyaW5nIHRoaXMgaXRlcmF0aW9uKSwgYW5kIHRoZW4gaW52b2tlIHRoZSBtYXRjaGluZ1xuICAgIC8vIGNhbGxiYWNrcywgY2hlY2tpbmcgYmVmb3JlIGVhY2ggY2FsbCB0byBlbnN1cmUgdGhleSBoYXZlbid0IHN0b3BwZWQuXG4gICAgLy8gTm90ZSB0aGF0IHdlIGRvbid0IGhhdmUgdG8gY2hlY2sgdGhhdFxuICAgIC8vIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25dIHN0aWxsID09PSBsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uLFxuICAgIC8vIGJlY2F1c2UgdGhlIG9ubHkgd2F5IHRoYXQgc3RvcHMgYmVpbmcgdHJ1ZSBpcyBpZiBsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uXG4gICAgLy8gZmlyc3QgZ2V0cyByZWR1Y2VkIGRvd24gdG8gdGhlIGVtcHR5IG9iamVjdCAoYW5kIHRoZW4gbmV2ZXIgZ2V0c1xuICAgIC8vIGluY3JlYXNlZCBhZ2FpbikuXG4gICAgZm9yIChjb25zdCBpZCBvZiBjYWxsYmFja0lkcykge1xuICAgICAgaWYgKF8uaGFzKGxpc3RlbmVyc0ZvckNvbGxlY3Rpb24sIGlkKSkge1xuICAgICAgICBhd2FpdCBsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uW2lkXS5jYWxsYmFjayhub3RpZmljYXRpb24pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICAvLyBBIG5vdGlmaWNhdGlvbiBtYXRjaGVzIGEgdHJpZ2dlciBpZiBhbGwga2V5cyB0aGF0IGV4aXN0IGluIGJvdGggYXJlIGVxdWFsLlxuICAvL1xuICAvLyBFeGFtcGxlczpcbiAgLy8gIE46e2NvbGxlY3Rpb246IFwiQ1wifSBtYXRjaGVzIFQ6e2NvbGxlY3Rpb246IFwiQ1wifVxuICAvLyAgICAoYSBub24tdGFyZ2V0ZWQgd3JpdGUgdG8gYSBjb2xsZWN0aW9uIG1hdGNoZXMgYVxuICAvLyAgICAgbm9uLXRhcmdldGVkIHF1ZXJ5KVxuICAvLyAgTjp7Y29sbGVjdGlvbjogXCJDXCIsIGlkOiBcIlhcIn0gbWF0Y2hlcyBUOntjb2xsZWN0aW9uOiBcIkNcIn1cbiAgLy8gICAgKGEgdGFyZ2V0ZWQgd3JpdGUgdG8gYSBjb2xsZWN0aW9uIG1hdGNoZXMgYSBub24tdGFyZ2V0ZWQgcXVlcnkpXG4gIC8vICBOOntjb2xsZWN0aW9uOiBcIkNcIn0gbWF0Y2hlcyBUOntjb2xsZWN0aW9uOiBcIkNcIiwgaWQ6IFwiWFwifVxuICAvLyAgICAoYSBub24tdGFyZ2V0ZWQgd3JpdGUgdG8gYSBjb2xsZWN0aW9uIG1hdGNoZXMgYVxuICAvLyAgICAgdGFyZ2V0ZWQgcXVlcnkpXG4gIC8vICBOOntjb2xsZWN0aW9uOiBcIkNcIiwgaWQ6IFwiWFwifSBtYXRjaGVzIFQ6e2NvbGxlY3Rpb246IFwiQ1wiLCBpZDogXCJYXCJ9XG4gIC8vICAgIChhIHRhcmdldGVkIHdyaXRlIHRvIGEgY29sbGVjdGlvbiBtYXRjaGVzIGEgdGFyZ2V0ZWQgcXVlcnkgdGFyZ2V0ZWRcbiAgLy8gICAgIGF0IHRoZSBzYW1lIGRvY3VtZW50KVxuICAvLyAgTjp7Y29sbGVjdGlvbjogXCJDXCIsIGlkOiBcIlhcIn0gZG9lcyBub3QgbWF0Y2ggVDp7Y29sbGVjdGlvbjogXCJDXCIsIGlkOiBcIllcIn1cbiAgLy8gICAgKGEgdGFyZ2V0ZWQgd3JpdGUgdG8gYSBjb2xsZWN0aW9uIGRvZXMgbm90IG1hdGNoIGEgdGFyZ2V0ZWQgcXVlcnlcbiAgLy8gICAgIHRhcmdldGVkIGF0IGEgZGlmZmVyZW50IGRvY3VtZW50KVxuICBfbWF0Y2hlczogZnVuY3Rpb24gKG5vdGlmaWNhdGlvbiwgdHJpZ2dlcikge1xuICAgIC8vIE1vc3Qgbm90aWZpY2F0aW9ucyB0aGF0IHVzZSB0aGUgY3Jvc3NiYXIgaGF2ZSBhIHN0cmluZyBgY29sbGVjdGlvbmAgYW5kXG4gICAgLy8gbWF5YmUgYW4gYGlkYCB0aGF0IGlzIGEgc3RyaW5nIG9yIE9iamVjdElELiBXZSdyZSBhbHJlYWR5IGRpdmlkaW5nIHVwXG4gICAgLy8gdHJpZ2dlcnMgYnkgY29sbGVjdGlvbiwgYnV0IGxldCdzIGZhc3QtdHJhY2sgXCJub3BlLCBkaWZmZXJlbnQgSURcIiAoYW5kXG4gICAgLy8gYXZvaWQgdGhlIG92ZXJseSBnZW5lcmljIEVKU09OLmVxdWFscykuIFRoaXMgbWFrZXMgYSBub3RpY2VhYmxlXG4gICAgLy8gcGVyZm9ybWFuY2UgZGlmZmVyZW5jZTsgc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL3B1bGwvMzY5N1xuICAgIGlmICh0eXBlb2Yobm90aWZpY2F0aW9uLmlkKSA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgdHlwZW9mKHRyaWdnZXIuaWQpID09PSAnc3RyaW5nJyAmJlxuICAgICAgICBub3RpZmljYXRpb24uaWQgIT09IHRyaWdnZXIuaWQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKG5vdGlmaWNhdGlvbi5pZCBpbnN0YW5jZW9mIE1vbmdvSUQuT2JqZWN0SUQgJiZcbiAgICAgICAgdHJpZ2dlci5pZCBpbnN0YW5jZW9mIE1vbmdvSUQuT2JqZWN0SUQgJiZcbiAgICAgICAgISBub3RpZmljYXRpb24uaWQuZXF1YWxzKHRyaWdnZXIuaWQpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIF8uYWxsKHRyaWdnZXIsIGZ1bmN0aW9uICh0cmlnZ2VyVmFsdWUsIGtleSkge1xuICAgICAgcmV0dXJuICFfLmhhcyhub3RpZmljYXRpb24sIGtleSkgfHxcbiAgICAgICAgRUpTT04uZXF1YWxzKHRyaWdnZXJWYWx1ZSwgbm90aWZpY2F0aW9uW2tleV0pO1xuICAgIH0pO1xuICB9XG59KTtcblxuLy8gVGhlIFwiaW52YWxpZGF0aW9uIGNyb3NzYmFyXCIgaXMgYSBzcGVjaWZpYyBpbnN0YW5jZSB1c2VkIGJ5IHRoZSBERFAgc2VydmVyIHRvXG4vLyBpbXBsZW1lbnQgd3JpdGUgZmVuY2Ugbm90aWZpY2F0aW9ucy4gTGlzdGVuZXIgY2FsbGJhY2tzIG9uIHRoaXMgY3Jvc3NiYXJcbi8vIHNob3VsZCBjYWxsIGJlZ2luV3JpdGUgb24gdGhlIGN1cnJlbnQgd3JpdGUgZmVuY2UgYmVmb3JlIHRoZXkgcmV0dXJuLCBpZiB0aGV5XG4vLyB3YW50IHRvIGRlbGF5IHRoZSB3cml0ZSBmZW5jZSBmcm9tIGZpcmluZyAoaWUsIHRoZSBERFAgbWV0aG9kLWRhdGEtdXBkYXRlZFxuLy8gbWVzc2FnZSBmcm9tIGJlaW5nIHNlbnQpLlxuRERQU2VydmVyLl9JbnZhbGlkYXRpb25Dcm9zc2JhciA9IG5ldyBERFBTZXJ2ZXIuX0Nyb3NzYmFyKHtcbiAgZmFjdE5hbWU6IFwiaW52YWxpZGF0aW9uLWNyb3NzYmFyLWxpc3RlbmVyc1wiXG59KTtcbiIsImlmIChwcm9jZXNzLmVudi5ERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTCkge1xuICBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLkREUF9ERUZBVUxUX0NPTk5FQ1RJT05fVVJMID1cbiAgICBwcm9jZXNzLmVudi5ERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTDtcbn1cblxuTWV0ZW9yLnNlcnZlciA9IG5ldyBTZXJ2ZXIoKTtcblxuTWV0ZW9yLnJlZnJlc2ggPSBhc3luYyBmdW5jdGlvbiAobm90aWZpY2F0aW9uKSB7XG4gIGF3YWl0IEREUFNlcnZlci5fSW52YWxpZGF0aW9uQ3Jvc3NiYXIuZmlyZShub3RpZmljYXRpb24pO1xufTtcblxuLy8gUHJveHkgdGhlIHB1YmxpYyBtZXRob2RzIG9mIE1ldGVvci5zZXJ2ZXIgc28gdGhleSBjYW5cbi8vIGJlIGNhbGxlZCBkaXJlY3RseSBvbiBNZXRlb3IuXG5fLmVhY2goXG4gIFtcbiAgICAncHVibGlzaCcsXG4gICAgJ2lzQXN5bmNDYWxsJyxcbiAgICAnbWV0aG9kcycsXG4gICAgJ2NhbGwnLFxuICAgICdjYWxsQXN5bmMnLFxuICAgICdhcHBseScsXG4gICAgJ2FwcGx5QXN5bmMnLFxuICAgICdvbkNvbm5lY3Rpb24nLFxuICAgICdvbk1lc3NhZ2UnLFxuICBdLFxuICBmdW5jdGlvbihuYW1lKSB7XG4gICAgTWV0ZW9yW25hbWVdID0gXy5iaW5kKE1ldGVvci5zZXJ2ZXJbbmFtZV0sIE1ldGVvci5zZXJ2ZXIpO1xuICB9XG4pO1xuIl19
