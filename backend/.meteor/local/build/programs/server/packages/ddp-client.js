Package["core-runtime"].queue("ddp-client",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Retry = Package.retry.Retry;
var IdMap = Package['id-map'].IdMap;
var ECMAScript = Package.ecmascript.ECMAScript;
var Hook = Package['callback-hook'].Hook;
var DDPCommon = Package['ddp-common'].DDPCommon;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var MongoID = Package['mongo-id'].MongoID;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var options, callback, args, DDP;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-client":{"server":{"server.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/server/server.js                                                                               //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.link("../common/namespace.js", {
      DDP: "DDP"
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"common":{"MethodInvoker.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/common/MethodInvoker.js                                                                        //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.export({
  default: () => MethodInvoker
});
class MethodInvoker {
  constructor(options) {
    // Public (within this file) fields.
    this.methodId = options.methodId;
    this.sentMessage = false;
    this._callback = options.callback;
    this._connection = options.connection;
    this._message = options.message;
    this._onResultReceived = options.onResultReceived || (() => {});
    this._wait = options.wait;
    this.noRetry = options.noRetry;
    this._methodResult = null;
    this._dataVisible = false;

    // Register with the connection.
    this._connection._methodInvokers[this.methodId] = this;
  }
  // Sends the method message to the server. May be called additional times if
  // we lose the connection and reconnect before receiving a result.
  sendMessage() {
    // This function is called before sending a method (including resending on
    // reconnect). We should only (re)send methods where we don't already have a
    // result!
    if (this.gotResult()) throw new Error('sendingMethod is called on method with result');

    // If we're re-sending it, it doesn't matter if data was written the first
    // time.
    this._dataVisible = false;
    this.sentMessage = true;

    // If this is a wait method, make all data messages be buffered until it is
    // done.
    if (this._wait) this._connection._methodsBlockingQuiescence[this.methodId] = true;

    // Actually send the message.
    this._connection._send(this._message);
  }
  // Invoke the callback, if we have both a result and know that all data has
  // been written to the local cache.
  _maybeInvokeCallback() {
    if (this._methodResult && this._dataVisible) {
      // Call the callback. (This won't throw: the callback was wrapped with
      // bindEnvironment.)
      this._callback(this._methodResult[0], this._methodResult[1]);

      // Forget about this method.
      delete this._connection._methodInvokers[this.methodId];

      // Let the connection know that this method is finished, so it can try to
      // move on to the next block of methods.
      this._connection._outstandingMethodFinished();
    }
  }
  // Call with the result of the method from the server. Only may be called
  // once; once it is called, you should not call sendMessage again.
  // If the user provided an onResultReceived callback, call it immediately.
  // Then invoke the main callback if data is also visible.
  receiveResult(err, result) {
    if (this.gotResult()) throw new Error('Methods should only receive results once');
    this._methodResult = [err, result];
    this._onResultReceived(err, result);
    this._maybeInvokeCallback();
  }
  // Call this when all data written by the method is visible. This means that
  // the method has returns its "data is done" message *AND* all server
  // documents that are buffered at that time have been written to the local
  // cache. Invokes the main callback if the result has been received.
  dataVisible() {
    this._dataVisible = true;
    this._maybeInvokeCallback();
  }
  // True if receiveResult has been called.
  gotResult() {
    return !!this._methodResult;
  }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livedata_connection.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/common/livedata_connection.js                                                                  //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectWithoutProperties;
    module.link("@babel/runtime/helpers/objectWithoutProperties", {
      default(v) {
        _objectWithoutProperties = v;
      }
    }, 0);
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 1);
    const _excluded = ["stubInvocation", "invocation"],
      _excluded2 = ["stubInvocation", "invocation"];
    module.export({
      Connection: () => Connection
    });
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    let DDPCommon;
    module.link("meteor/ddp-common", {
      DDPCommon(v) {
        DDPCommon = v;
      }
    }, 1);
    let Tracker;
    module.link("meteor/tracker", {
      Tracker(v) {
        Tracker = v;
      }
    }, 2);
    let EJSON;
    module.link("meteor/ejson", {
      EJSON(v) {
        EJSON = v;
      }
    }, 3);
    let Random;
    module.link("meteor/random", {
      Random(v) {
        Random = v;
      }
    }, 4);
    let Hook;
    module.link("meteor/callback-hook", {
      Hook(v) {
        Hook = v;
      }
    }, 5);
    let MongoID;
    module.link("meteor/mongo-id", {
      MongoID(v) {
        MongoID = v;
      }
    }, 6);
    let DDP;
    module.link("./namespace.js", {
      DDP(v) {
        DDP = v;
      }
    }, 7);
    let MethodInvoker;
    module.link("./MethodInvoker.js", {
      default(v) {
        MethodInvoker = v;
      }
    }, 8);
    let hasOwn, slice, keys, isEmpty, last;
    module.link("meteor/ddp-common/utils.js", {
      hasOwn(v) {
        hasOwn = v;
      },
      slice(v) {
        slice = v;
      },
      keys(v) {
        keys = v;
      },
      isEmpty(v) {
        isEmpty = v;
      },
      last(v) {
        last = v;
      }
    }, 9);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class MongoIDMap extends IdMap {
      constructor() {
        super(MongoID.idStringify, MongoID.idParse);
      }
    }

    // @param url {String|Object} URL to Meteor app,
    //   or an object as a test hook (see code)
    // Options:
    //   reloadWithOutstanding: is it OK to reload if there are outstanding methods?
    //   headers: extra headers to send on the websockets connection, for
    //     server-to-server DDP only
    //   _sockjsOptions: Specifies options to pass through to the sockjs client
    //   onDDPNegotiationVersionFailure: callback when version negotiation fails.
    //
    // XXX There should be a way to destroy a DDP connection, causing all
    // outstanding method calls to fail.
    //
    // XXX Our current way of handling failure and reconnection is great
    // for an app (where we want to tolerate being disconnected as an
    // expect state, and keep trying forever to reconnect) but cumbersome
    // for something like a command line tool that wants to make a
    // connection, call a method, and print an error if connection
    // fails. We should have better usability in the latter case (while
    // still transparently reconnecting if it's just a transient failure
    // or the server migrating us).
    class Connection {
      constructor(url, options) {
        const self = this;
        this.options = options = _objectSpread({
          onConnected() {},
          onDDPVersionNegotiationFailure(description) {
            Meteor._debug(description);
          },
          heartbeatInterval: 17500,
          heartbeatTimeout: 15000,
          npmFayeOptions: Object.create(null),
          // These options are only for testing.
          reloadWithOutstanding: false,
          supportedDDPVersions: DDPCommon.SUPPORTED_DDP_VERSIONS,
          retry: true,
          respondToPings: true,
          // When updates are coming within this ms interval, batch them together.
          bufferedWritesInterval: 5,
          // Flush buffers immediately if writes are happening continuously for more than this many ms.
          bufferedWritesMaxAge: 500
        }, options);

        // If set, called when we reconnect, queuing method calls _before_ the
        // existing outstanding ones.
        // NOTE: This feature has been preserved for backwards compatibility. The
        // preferred method of setting a callback on reconnect is to use
        // DDP.onReconnect.
        self.onReconnect = null;

        // as a test hook, allow passing a stream instead of a url.
        if (typeof url === 'object') {
          self._stream = url;
        } else {
          const {
            ClientStream
          } = require("meteor/socket-stream-client");
          self._stream = new ClientStream(url, {
            retry: options.retry,
            ConnectionError: DDP.ConnectionError,
            headers: options.headers,
            _sockjsOptions: options._sockjsOptions,
            // Used to keep some tests quiet, or for other cases in which
            // the right thing to do with connection errors is to silently
            // fail (e.g. sending package usage stats). At some point we
            // should have a real API for handling client-stream-level
            // errors.
            _dontPrintErrors: options._dontPrintErrors,
            connectTimeoutMs: options.connectTimeoutMs,
            npmFayeOptions: options.npmFayeOptions
          });
        }
        self._lastSessionId = null;
        self._versionSuggestion = null; // The last proposed DDP version.
        self._version = null; // The DDP version agreed on by client and server.
        self._stores = Object.create(null); // name -> object with methods
        self._methodHandlers = Object.create(null); // name -> func
        self._nextMethodId = 1;
        self._supportedDDPVersions = options.supportedDDPVersions;
        self._heartbeatInterval = options.heartbeatInterval;
        self._heartbeatTimeout = options.heartbeatTimeout;

        // Tracks methods which the user has tried to call but which have not yet
        // called their user callback (ie, they are waiting on their result or for all
        // of their writes to be written to the local cache). Map from method ID to
        // MethodInvoker object.
        self._methodInvokers = Object.create(null);

        // Tracks methods which the user has called but whose result messages have not
        // arrived yet.
        //
        // _outstandingMethodBlocks is an array of blocks of methods. Each block
        // represents a set of methods that can run at the same time. The first block
        // represents the methods which are currently in flight; subsequent blocks
        // must wait for previous blocks to be fully finished before they can be sent
        // to the server.
        //
        // Each block is an object with the following fields:
        // - methods: a list of MethodInvoker objects
        // - wait: a boolean; if true, this block had a single method invoked with
        //         the "wait" option
        //
        // There will never be adjacent blocks with wait=false, because the only thing
        // that makes methods need to be serialized is a wait method.
        //
        // Methods are removed from the first block when their "result" is
        // received. The entire first block is only removed when all of the in-flight
        // methods have received their results (so the "methods" list is empty) *AND*
        // all of the data written by those methods are visible in the local cache. So
        // it is possible for the first block's methods list to be empty, if we are
        // still waiting for some objects to quiesce.
        //
        // Example:
        //  _outstandingMethodBlocks = [
        //    {wait: false, methods: []},
        //    {wait: true, methods: [<MethodInvoker for 'login'>]},
        //    {wait: false, methods: [<MethodInvoker for 'foo'>,
        //                            <MethodInvoker for 'bar'>]}]
        // This means that there were some methods which were sent to the server and
        // which have returned their results, but some of the data written by
        // the methods may not be visible in the local cache. Once all that data is
        // visible, we will send a 'login' method. Once the login method has returned
        // and all the data is visible (including re-running subs if userId changes),
        // we will send the 'foo' and 'bar' methods in parallel.
        self._outstandingMethodBlocks = [];

        // method ID -> array of objects with keys 'collection' and 'id', listing
        // documents written by a given method's stub. keys are associated with
        // methods whose stub wrote at least one document, and whose data-done message
        // has not yet been received.
        self._documentsWrittenByStub = {};
        // collection -> IdMap of "server document" object. A "server document" has:
        // - "document": the version of the document according the
        //   server (ie, the snapshot before a stub wrote it, amended by any changes
        //   received from the server)
        //   It is undefined if we think the document does not exist
        // - "writtenByStubs": a set of method IDs whose stubs wrote to the document
        //   whose "data done" messages have not yet been processed
        self._serverDocuments = {};

        // Array of callbacks to be called after the next update of the local
        // cache. Used for:
        //  - Calling methodInvoker.dataVisible and sub ready callbacks after
        //    the relevant data is flushed.
        //  - Invoking the callbacks of "half-finished" methods after reconnect
        //    quiescence. Specifically, methods whose result was received over the old
        //    connection (so we don't re-send it) but whose data had not been made
        //    visible.
        self._afterUpdateCallbacks = [];

        // In two contexts, we buffer all incoming data messages and then process them
        // all at once in a single update:
        //   - During reconnect, we buffer all data messages until all subs that had
        //     been ready before reconnect are ready again, and all methods that are
        //     active have returned their "data done message"; then
        //   - During the execution of a "wait" method, we buffer all data messages
        //     until the wait method gets its "data done" message. (If the wait method
        //     occurs during reconnect, it doesn't get any special handling.)
        // all data messages are processed in one update.
        //
        // The following fields are used for this "quiescence" process.

        // This buffers the messages that aren't being processed yet.
        self._messagesBufferedUntilQuiescence = [];
        // Map from method ID -> true. Methods are removed from this when their
        // "data done" message is received, and we will not quiesce until it is
        // empty.
        self._methodsBlockingQuiescence = {};
        // map from sub ID -> true for subs that were ready (ie, called the sub
        // ready callback) before reconnect but haven't become ready again yet
        self._subsBeingRevived = {}; // map from sub._id -> true
        // if true, the next data update should reset all stores. (set during
        // reconnect.)
        self._resetStores = false;

        // name -> array of updates for (yet to be created) collections
        self._updatesForUnknownStores = {};
        // if we're blocking a migration, the retry func
        self._retryMigrate = null;
        self.__flushBufferedWrites = Meteor.bindEnvironment(self._flushBufferedWrites, 'flushing DDP buffered writes', self);
        // Collection name -> array of messages.
        self._bufferedWrites = {};
        // When current buffer of updates must be flushed at, in ms timestamp.
        self._bufferedWritesFlushAt = null;
        // Timeout handle for the next processing of all pending writes
        self._bufferedWritesFlushHandle = null;
        self._bufferedWritesInterval = options.bufferedWritesInterval;
        self._bufferedWritesMaxAge = options.bufferedWritesMaxAge;

        // metadata for subscriptions.  Map from sub ID to object with keys:
        //   - id
        //   - name
        //   - params
        //   - inactive (if true, will be cleaned up if not reused in re-run)
        //   - ready (has the 'ready' message been received?)
        //   - readyCallback (an optional callback to call when ready)
        //   - errorCallback (an optional callback to call if the sub terminates with
        //                    an error, XXX COMPAT WITH 1.0.3.1)
        //   - stopCallback (an optional callback to call when the sub terminates
        //     for any reason, with an error argument if an error triggered the stop)
        self._subscriptions = {};

        // Reactive userId.
        self._userId = null;
        self._userIdDeps = new Tracker.Dependency();

        // Block auto-reload while we're waiting for method responses.
        if (Meteor.isClient && Package.reload && !options.reloadWithOutstanding) {
          Package.reload.Reload._onMigrate(retry => {
            if (!self._readyToMigrate()) {
              self._retryMigrate = retry;
              return [false];
            } else {
              return [true];
            }
          });
        }
        const onDisconnect = () => {
          if (self._heartbeat) {
            self._heartbeat.stop();
            self._heartbeat = null;
          }
        };
        if (Meteor.isServer) {
          self._stream.on('message', Meteor.bindEnvironment(this.onMessage.bind(this), 'handling DDP message'));
          self._stream.on('reset', Meteor.bindEnvironment(this.onReset.bind(this), 'handling DDP reset'));
          self._stream.on('disconnect', Meteor.bindEnvironment(onDisconnect, 'handling DDP disconnect'));
        } else {
          self._stream.on('message', this.onMessage.bind(this));
          self._stream.on('reset', this.onReset.bind(this));
          self._stream.on('disconnect', onDisconnect);
        }
      }

      // 'name' is the name of the data on the wire that should go in the
      // store. 'wrappedStore' should be an object with methods beginUpdate, update,
      // endUpdate, saveOriginals, retrieveOriginals. see Collection for an example.
      createStoreMethods(name, wrappedStore) {
        const self = this;
        if (name in self._stores) return false;

        // Wrap the input object in an object which makes any store method not
        // implemented by 'store' into a no-op.
        const store = Object.create(null);
        const keysOfStore = ['update', 'beginUpdate', 'endUpdate', 'saveOriginals', 'retrieveOriginals', 'getDoc', '_getCollection'];
        keysOfStore.forEach(method => {
          store[method] = function () {
            if (wrappedStore[method]) {
              return wrappedStore[method](...arguments);
            }
          };
        });
        self._stores[name] = store;
        return store;
      }
      registerStoreClient(name, wrappedStore) {
        const self = this;
        const store = self.createStoreMethods(name, wrappedStore);
        const queued = self._updatesForUnknownStores[name];
        if (Array.isArray(queued)) {
          store.beginUpdate(queued.length, false);
          queued.forEach(msg => {
            store.update(msg);
          });
          store.endUpdate();
          delete self._updatesForUnknownStores[name];
        }
        return true;
      }
      async registerStoreServer(name, wrappedStore) {
        const self = this;
        const store = self.createStoreMethods(name, wrappedStore);
        const queued = self._updatesForUnknownStores[name];
        if (Array.isArray(queued)) {
          await store.beginUpdate(queued.length, false);
          for (const msg of queued) {
            await store.update(msg);
          }
          await store.endUpdate();
          delete self._updatesForUnknownStores[name];
        }
        return true;
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.subscribe
       * @summary Subscribe to a record set.  Returns a handle that provides
       * `stop()` and `ready()` methods.
       * @locus Client
       * @param {String} name Name of the subscription.  Matches the name of the
       * server's `publish()` call.
       * @param {EJSONable} [arg1,arg2...] Optional arguments passed to publisher
       * function on server.
       * @param {Function|Object} [callbacks] Optional. May include `onStop`
       * and `onReady` callbacks. If there is an error, it is passed as an
       * argument to `onStop`. If a function is passed instead of an object, it
       * is interpreted as an `onReady` callback.
       */
      subscribe(name /* .. [arguments] .. (callback|callbacks) */) {
        const self = this;
        const params = slice.call(arguments, 1);
        let callbacks = Object.create(null);
        if (params.length) {
          const lastParam = params[params.length - 1];
          if (typeof lastParam === 'function') {
            callbacks.onReady = params.pop();
          } else if (lastParam && [lastParam.onReady,
          // XXX COMPAT WITH 1.0.3.1 onError used to exist, but now we use
          // onStop with an error callback instead.
          lastParam.onError, lastParam.onStop].some(f => typeof f === "function")) {
            callbacks = params.pop();
          }
        }

        // Is there an existing sub with the same name and param, run in an
        // invalidated Computation? This will happen if we are rerunning an
        // existing computation.
        //
        // For example, consider a rerun of:
        //
        //     Tracker.autorun(function () {
        //       Meteor.subscribe("foo", Session.get("foo"));
        //       Meteor.subscribe("bar", Session.get("bar"));
        //     });
        //
        // If "foo" has changed but "bar" has not, we will match the "bar"
        // subcribe to an existing inactive subscription in order to not
        // unsub and resub the subscription unnecessarily.
        //
        // We only look for one such sub; if there are N apparently-identical subs
        // being invalidated, we will require N matching subscribe calls to keep
        // them all active.
        const existing = Object.values(self._subscriptions).find(sub => sub.inactive && sub.name === name && EJSON.equals(sub.params, params));
        let id;
        if (existing) {
          id = existing.id;
          existing.inactive = false; // reactivate

          if (callbacks.onReady) {
            // If the sub is not already ready, replace any ready callback with the
            // one provided now. (It's not really clear what users would expect for
            // an onReady callback inside an autorun; the semantics we provide is
            // that at the time the sub first becomes ready, we call the last
            // onReady callback provided, if any.)
            // If the sub is already ready, run the ready callback right away.
            // It seems that users would expect an onReady callback inside an
            // autorun to trigger once the sub first becomes ready and also
            // when re-subs happens.
            if (existing.ready) {
              callbacks.onReady();
            } else {
              existing.readyCallback = callbacks.onReady;
            }
          }

          // XXX COMPAT WITH 1.0.3.1 we used to have onError but now we call
          // onStop with an optional error argument
          if (callbacks.onError) {
            // Replace existing callback if any, so that errors aren't
            // double-reported.
            existing.errorCallback = callbacks.onError;
          }
          if (callbacks.onStop) {
            existing.stopCallback = callbacks.onStop;
          }
        } else {
          // New sub! Generate an id, save it locally, and send message.
          id = Random.id();
          self._subscriptions[id] = {
            id: id,
            name: name,
            params: EJSON.clone(params),
            inactive: false,
            ready: false,
            readyDeps: new Tracker.Dependency(),
            readyCallback: callbacks.onReady,
            // XXX COMPAT WITH 1.0.3.1 #errorCallback
            errorCallback: callbacks.onError,
            stopCallback: callbacks.onStop,
            connection: self,
            remove() {
              delete this.connection._subscriptions[this.id];
              this.ready && this.readyDeps.changed();
            },
            stop() {
              this.connection._sendQueued({
                msg: 'unsub',
                id: id
              });
              this.remove();
              if (callbacks.onStop) {
                callbacks.onStop();
              }
            }
          };
          self._send({
            msg: 'sub',
            id: id,
            name: name,
            params: params
          });
        }

        // return a handle to the application.
        const handle = {
          stop() {
            if (!hasOwn.call(self._subscriptions, id)) {
              return;
            }
            self._subscriptions[id].stop();
          },
          ready() {
            // return false if we've unsubscribed.
            if (!hasOwn.call(self._subscriptions, id)) {
              return false;
            }
            const record = self._subscriptions[id];
            record.readyDeps.depend();
            return record.ready;
          },
          subscriptionId: id
        };
        if (Tracker.active) {
          // We're in a reactive computation, so we'd like to unsubscribe when the
          // computation is invalidated... but not if the rerun just re-subscribes
          // to the same subscription!  When a rerun happens, we use onInvalidate
          // as a change to mark the subscription "inactive" so that it can
          // be reused from the rerun.  If it isn't reused, it's killed from
          // an afterFlush.
          Tracker.onInvalidate(c => {
            if (hasOwn.call(self._subscriptions, id)) {
              self._subscriptions[id].inactive = true;
            }
            Tracker.afterFlush(() => {
              if (hasOwn.call(self._subscriptions, id) && self._subscriptions[id].inactive) {
                handle.stop();
              }
            });
          });
        }
        return handle;
      }

      /**
       * @summary Tells if the method call came from a call or a callAsync.
       * @alias Meteor.isAsyncCall
       * @locus Anywhere
       * @memberOf Meteor
       * @importFromPackage meteor
       * @returns boolean
       */
      isAsyncCall() {
        return DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
      }
      methods(methods) {
        Object.entries(methods).forEach(_ref => {
          let [name, func] = _ref;
          if (typeof func !== 'function') {
            throw new Error("Method '" + name + "' must be a function");
          }
          if (this._methodHandlers[name]) {
            throw new Error("A method named '" + name + "' is already defined");
          }
          this._methodHandlers[name] = func;
        });
      }
      _getIsSimulation(_ref2) {
        let {
          isFromCallAsync,
          alreadyInSimulation
        } = _ref2;
        if (!isFromCallAsync) {
          return alreadyInSimulation;
        }
        return alreadyInSimulation && DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.call
       * @summary Invokes a method with a sync stub, passing any number of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable} [arg1,arg2...] Optional method arguments
       * @param {Function} [asyncCallback] Optional callback, which is called asynchronously with the error or result after the method is complete. If not provided, the method runs synchronously if possible (see below).
       */
      call(name /* .. [arguments] .. callback */) {
        // if it's a function, the last argument is the result callback,
        // not a parameter to the remote method.
        const args = slice.call(arguments, 1);
        let callback;
        if (args.length && typeof args[args.length - 1] === 'function') {
          callback = args.pop();
        }
        return this.apply(name, args, callback);
      }
      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.callAsync
       * @summary Invokes a method with an async stub, passing any number of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable} [arg1,arg2...] Optional method arguments
       * @returns {Promise}
       */
      callAsync(name /* .. [arguments] .. */) {
        const args = slice.call(arguments, 1);
        if (args.length && typeof args[args.length - 1] === 'function') {
          throw new Error("Meteor.callAsync() does not accept a callback. You should 'await' the result, or use .then().");
        }
        return this.applyAsync(name, args, {
          returnServerResultPromise: true
        });
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.apply
       * @summary Invoke a method passing an array of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable[]} args Method arguments
       * @param {Object} [options]
       * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
       * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
       * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
       * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
       * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
       * @param {Function} [asyncCallback] Optional callback; same semantics as in [`Meteor.call`](#meteor_call).
       */
      apply(name, args, options, callback) {
        const _this$_stubCall = this._stubCall(name, EJSON.clone(args)),
          {
            stubInvocation,
            invocation
          } = _this$_stubCall,
          stubOptions = _objectWithoutProperties(_this$_stubCall, _excluded);
        if (stubOptions.hasStub) {
          if (!this._getIsSimulation({
            alreadyInSimulation: stubOptions.alreadyInSimulation,
            isFromCallAsync: stubOptions.isFromCallAsync
          })) {
            this._saveOriginals();
          }
          try {
            stubOptions.stubReturnValue = DDP._CurrentMethodInvocation.withValue(invocation, stubInvocation);
            if (Meteor._isPromise(stubOptions.stubReturnValue)) {
              Meteor._debug("Method ".concat(name, ": Calling a method that has an async method stub with call/apply can lead to unexpected behaviors. Use callAsync/applyAsync instead."));
            }
          } catch (e) {
            stubOptions.exception = e;
          }
        }
        return this._apply(name, stubOptions, args, options, callback);
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.applyAsync
       * @summary Invoke a method passing an array of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable[]} args Method arguments
       * @param {Object} [options]
       * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
       * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
       * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
       * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
       * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
       * @param {Boolean} options.returnServerResultPromise (Client only) If true, the promise returned by applyAsync will resolve to the server's return value, rather than the stub's return value. This is useful when you want to ensure that the server's return value is used, even if the stub returns a promise. The same behavior as `callAsync`.
       */
      applyAsync(name, args, options) {
        let callback = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
        const stubPromise = this._applyAsyncStubInvocation(name, args, options);
        const promise = this._applyAsync({
          name,
          args,
          options,
          callback,
          stubPromise
        });
        if (Meteor.isClient) {
          // only return the stubReturnValue
          promise.stubPromise = stubPromise.then(o => {
            if (o.exception) {
              throw o.exception;
            }
            return o.stubReturnValue;
          });
          // this avoids attribute recursion
          promise.serverPromise = new Promise((resolve, reject) => promise.then(resolve).catch(reject));
        }
        return promise;
      }
      async _applyAsyncStubInvocation(name, args, options) {
        const _this$_stubCall2 = this._stubCall(name, EJSON.clone(args), options),
          {
            stubInvocation,
            invocation
          } = _this$_stubCall2,
          stubOptions = _objectWithoutProperties(_this$_stubCall2, _excluded2);
        if (stubOptions.hasStub) {
          if (!this._getIsSimulation({
            alreadyInSimulation: stubOptions.alreadyInSimulation,
            isFromCallAsync: stubOptions.isFromCallAsync
          })) {
            this._saveOriginals();
          }
          try {
            /*
             * The code below follows the same logic as the function withValues().
             *
             * But as the Meteor package is not compiled by ecmascript, it is unable to use newer syntax in the browser,
             * such as, the async/await.
             *
             * So, to keep supporting old browsers, like IE 11, we're creating the logic one level above.
             */
            const currentContext = DDP._CurrentMethodInvocation._setNewContextAndGetCurrent(invocation);
            try {
              stubOptions.stubReturnValue = await stubInvocation();
            } catch (e) {
              stubOptions.exception = e;
            } finally {
              DDP._CurrentMethodInvocation._set(currentContext);
            }
          } catch (e) {
            stubOptions.exception = e;
          }
        }
        return stubOptions;
      }
      async _applyAsync(_ref3) {
        let {
          name,
          args,
          options,
          callback,
          stubPromise
        } = _ref3;
        const stubOptions = await stubPromise;
        return this._apply(name, stubOptions, args, options, callback);
      }
      _apply(name, stubCallValue, args, options, callback) {
        const self = this;
        // We were passed 3 arguments. They may be either (name, args, options)
        // or (name, args, callback)
        if (!callback && typeof options === 'function') {
          callback = options;
          options = Object.create(null);
        }
        options = options || Object.create(null);
        if (callback) {
          // XXX would it be better form to do the binding in stream.on,
          // or caller, instead of here?
          // XXX improve error message (and how we report it)
          callback = Meteor.bindEnvironment(callback, "delivering result of invoking '" + name + "'");
        }
        const {
          hasStub,
          exception,
          stubReturnValue,
          alreadyInSimulation,
          randomSeed
        } = stubCallValue;

        // Keep our args safe from mutation (eg if we don't send the message for a
        // while because of a wait method).
        args = EJSON.clone(args);
        // If we're in a simulation, stop and return the result we have,
        // rather than going on to do an RPC. If there was no stub,
        // we'll end up returning undefined.
        if (this._getIsSimulation({
          alreadyInSimulation,
          isFromCallAsync: stubCallValue.isFromCallAsync
        })) {
          if (callback) {
            callback(exception, stubReturnValue);
            return undefined;
          }
          if (exception) throw exception;
          return stubReturnValue;
        }

        // We only create the methodId here because we don't actually need one if
        // we're already in a simulation
        const methodId = '' + self._nextMethodId++;
        if (hasStub) {
          self._retrieveAndStoreOriginals(methodId);
        }

        // Generate the DDP message for the method call. Note that on the client,
        // it is important that the stub have finished before we send the RPC, so
        // that we know we have a complete list of which local documents the stub
        // wrote.
        const message = {
          msg: 'method',
          id: methodId,
          method: name,
          params: args
        };

        // If an exception occurred in a stub, and we're ignoring it
        // because we're doing an RPC and want to use what the server
        // returns instead, log it so the developer knows
        // (unless they explicitly ask to see the error).
        //
        // Tests can set the '_expectedByTest' flag on an exception so it won't
        // go to log.
        if (exception) {
          if (options.throwStubExceptions) {
            throw exception;
          } else if (!exception._expectedByTest) {
            Meteor._debug("Exception while simulating the effect of invoking '" + name + "'", exception);
          }
        }

        // At this point we're definitely doing an RPC, and we're going to
        // return the value of the RPC to the caller.

        // If the caller didn't give a callback, decide what to do.
        let future;
        if (!callback) {
          if (Meteor.isClient && !options.returnServerResultPromise && (!options.isFromCallAsync || options.returnStubValue)) {
            // On the client, we don't have fibers, so we can't block. The
            // only thing we can do is to return undefined and discard the
            // result of the RPC. If an error occurred then print the error
            // to the console.
            callback = err => {
              err && Meteor._debug("Error invoking Method '" + name + "'", err);
            };
          } else {
            // On the server, make the function synchronous. Throw on
            // errors, return on success.
            future = new Promise((resolve, reject) => {
              callback = function () {
                for (var _len = arguments.length, allArgs = new Array(_len), _key = 0; _key < _len; _key++) {
                  allArgs[_key] = arguments[_key];
                }
                let args = Array.from(allArgs);
                let err = args.shift();
                if (err) {
                  reject(err);
                  return;
                }
                resolve(...args);
              };
            });
          }
        }

        // Send the randomSeed only if we used it
        if (randomSeed.value !== null) {
          message.randomSeed = randomSeed.value;
        }
        const methodInvoker = new MethodInvoker({
          methodId,
          callback: callback,
          connection: self,
          onResultReceived: options.onResultReceived,
          wait: !!options.wait,
          message: message,
          noRetry: !!options.noRetry
        });
        if (options.wait) {
          // It's a wait method! Wait methods go in their own block.
          self._outstandingMethodBlocks.push({
            wait: true,
            methods: [methodInvoker]
          });
        } else {
          // Not a wait method. Start a new block if the previous block was a wait
          // block, and add it to the last block of methods.
          if (isEmpty(self._outstandingMethodBlocks) || last(self._outstandingMethodBlocks).wait) {
            self._outstandingMethodBlocks.push({
              wait: false,
              methods: []
            });
          }
          last(self._outstandingMethodBlocks).methods.push(methodInvoker);
        }

        // If we added it to the first block, send it out now.
        if (self._outstandingMethodBlocks.length === 1) methodInvoker.sendMessage();

        // If we're using the default callback on the server,
        // block waiting for the result.
        if (future) {
          // This is the result of the method ran in the client.
          // You can opt-in in getting the local result by running:
          // const { stubPromise, serverPromise } = Meteor.callAsync(...);
          // const whatServerDid = await serverPromise;
          if (options.returnStubValue) {
            return future.then(() => stubReturnValue);
          }
          return future;
        }
        return options.returnStubValue ? stubReturnValue : undefined;
      }
      _stubCall(name, args, options) {
        // Run the stub, if we have one. The stub is supposed to make some
        // temporary writes to the database to give the user a smooth experience
        // until the actual result of executing the method comes back from the
        // server (whereupon the temporary writes to the database will be reversed
        // during the beginUpdate/endUpdate process.)
        //
        // Normally, we ignore the return value of the stub (even if it is an
        // exception), in favor of the real return value from the server. The
        // exception is if the *caller* is a stub. In that case, we're not going
        // to do a RPC, so we use the return value of the stub as our return
        // value.
        const self = this;
        const enclosing = DDP._CurrentMethodInvocation.get();
        const stub = self._methodHandlers[name];
        const alreadyInSimulation = enclosing === null || enclosing === void 0 ? void 0 : enclosing.isSimulation;
        const isFromCallAsync = enclosing === null || enclosing === void 0 ? void 0 : enclosing._isFromCallAsync;
        const randomSeed = {
          value: null
        };
        const defaultReturn = {
          alreadyInSimulation,
          randomSeed,
          isFromCallAsync
        };
        if (!stub) {
          return _objectSpread(_objectSpread({}, defaultReturn), {}, {
            hasStub: false
          });
        }

        // Lazily generate a randomSeed, only if it is requested by the stub.
        // The random streams only have utility if they're used on both the client
        // and the server; if the client doesn't generate any 'random' values
        // then we don't expect the server to generate any either.
        // Less commonly, the server may perform different actions from the client,
        // and may in fact generate values where the client did not, but we don't
        // have any client-side values to match, so even here we may as well just
        // use a random seed on the server.  In that case, we don't pass the
        // randomSeed to save bandwidth, and we don't even generate it to save a
        // bit of CPU and to avoid consuming entropy.

        const randomSeedGenerator = () => {
          if (randomSeed.value === null) {
            randomSeed.value = DDPCommon.makeRpcSeed(enclosing, name);
          }
          return randomSeed.value;
        };
        const setUserId = userId => {
          self.setUserId(userId);
        };
        const invocation = new DDPCommon.MethodInvocation({
          name,
          isSimulation: true,
          userId: self.userId(),
          isFromCallAsync: options === null || options === void 0 ? void 0 : options.isFromCallAsync,
          setUserId: setUserId,
          randomSeed() {
            return randomSeedGenerator();
          }
        });

        // Note that unlike in the corresponding server code, we never audit
        // that stubs check() their arguments.
        const stubInvocation = () => {
          if (Meteor.isServer) {
            // Because saveOriginals and retrieveOriginals aren't reentrant,
            // don't allow stubs to yield.
            return Meteor._noYieldsAllowed(() => {
              // re-clone, so that the stub can't affect our caller's values
              return stub.apply(invocation, EJSON.clone(args));
            });
          } else {
            return stub.apply(invocation, EJSON.clone(args));
          }
        };
        return _objectSpread(_objectSpread({}, defaultReturn), {}, {
          hasStub: true,
          stubInvocation,
          invocation
        });
      }

      // Before calling a method stub, prepare all stores to track changes and allow
      // _retrieveAndStoreOriginals to get the original versions of changed
      // documents.
      _saveOriginals() {
        if (!this._waitingForQuiescence()) {
          this._flushBufferedWritesClient();
        }
        Object.values(this._stores).forEach(store => {
          store.saveOriginals();
        });
      }

      // Retrieves the original versions of all documents modified by the stub for
      // method 'methodId' from all stores and saves them to _serverDocuments (keyed
      // by document) and _documentsWrittenByStub (keyed by method ID).
      _retrieveAndStoreOriginals(methodId) {
        const self = this;
        if (self._documentsWrittenByStub[methodId]) throw new Error('Duplicate methodId in _retrieveAndStoreOriginals');
        const docsWritten = [];
        Object.entries(self._stores).forEach(_ref4 => {
          let [collection, store] = _ref4;
          const originals = store.retrieveOriginals();
          // not all stores define retrieveOriginals
          if (!originals) return;
          originals.forEach((doc, id) => {
            docsWritten.push({
              collection,
              id
            });
            if (!hasOwn.call(self._serverDocuments, collection)) {
              self._serverDocuments[collection] = new MongoIDMap();
            }
            const serverDoc = self._serverDocuments[collection].setDefault(id, Object.create(null));
            if (serverDoc.writtenByStubs) {
              // We're not the first stub to write this doc. Just add our method ID
              // to the record.
              serverDoc.writtenByStubs[methodId] = true;
            } else {
              // First stub! Save the original value and our method ID.
              serverDoc.document = doc;
              serverDoc.flushCallbacks = [];
              serverDoc.writtenByStubs = Object.create(null);
              serverDoc.writtenByStubs[methodId] = true;
            }
          });
        });
        if (!isEmpty(docsWritten)) {
          self._documentsWrittenByStub[methodId] = docsWritten;
        }
      }

      // This is very much a private function we use to make the tests
      // take up fewer server resources after they complete.
      _unsubscribeAll() {
        Object.values(this._subscriptions).forEach(sub => {
          // Avoid killing the autoupdate subscription so that developers
          // still get hot code pushes when writing tests.
          //
          // XXX it's a hack to encode knowledge about autoupdate here,
          // but it doesn't seem worth it yet to have a special API for
          // subscriptions to preserve after unit tests.
          if (sub.name !== 'meteor_autoupdate_clientVersions') {
            sub.stop();
          }
        });
      }

      // Sends the DDP stringification of the given message object
      _send(obj) {
        this._stream.send(DDPCommon.stringifyDDP(obj));
      }

      // Always queues the call before sending the message
      // Used, for example, on subscription.[id].stop() to make sure a "sub" message is always called before an "unsub" message
      // https://github.com/meteor/meteor/issues/13212
      //
      // This is part of the actual fix for the rest check:
      // https://github.com/meteor/meteor/pull/13236
      _sendQueued(obj) {
        this._send(obj, true);
      }

      // We detected via DDP-level heartbeats that we've lost the
      // connection.  Unlike `disconnect` or `close`, a lost connection
      // will be automatically retried.
      _lostConnection(error) {
        this._stream._lostConnection(error);
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.status
       * @summary Get the current connection status. A reactive data source.
       * @locus Client
       */
      status() {
        return this._stream.status(...arguments);
      }

      /**
       * @summary Force an immediate reconnection attempt if the client is not connected to the server.
       This method does nothing if the client is already connected.
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.reconnect
       * @locus Client
       */
      reconnect() {
        return this._stream.reconnect(...arguments);
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.disconnect
       * @summary Disconnect the client from the server.
       * @locus Client
       */
      disconnect() {
        return this._stream.disconnect(...arguments);
      }
      close() {
        return this._stream.disconnect({
          _permanent: true
        });
      }

      ///
      /// Reactive user system
      ///
      userId() {
        if (this._userIdDeps) this._userIdDeps.depend();
        return this._userId;
      }
      setUserId(userId) {
        // Avoid invalidating dependents if setUserId is called with current value.
        if (this._userId === userId) return;
        this._userId = userId;
        if (this._userIdDeps) this._userIdDeps.changed();
      }

      // Returns true if we are in a state after reconnect of waiting for subs to be
      // revived or early methods to finish their data, or we are waiting for a
      // "wait" method to finish.
      _waitingForQuiescence() {
        return !isEmpty(this._subsBeingRevived) || !isEmpty(this._methodsBlockingQuiescence);
      }

      // Returns true if any method whose message has been sent to the server has
      // not yet invoked its user callback.
      _anyMethodsAreOutstanding() {
        const invokers = this._methodInvokers;
        return Object.values(invokers).some(invoker => !!invoker.sentMessage);
      }
      async _livedata_connected(msg) {
        const self = this;
        if (self._version !== 'pre1' && self._heartbeatInterval !== 0) {
          self._heartbeat = new DDPCommon.Heartbeat({
            heartbeatInterval: self._heartbeatInterval,
            heartbeatTimeout: self._heartbeatTimeout,
            onTimeout() {
              self._lostConnection(new DDP.ConnectionError('DDP heartbeat timed out'));
            },
            sendPing() {
              self._send({
                msg: 'ping'
              });
            }
          });
          self._heartbeat.start();
        }

        // If this is a reconnect, we'll have to reset all stores.
        if (self._lastSessionId) self._resetStores = true;
        let reconnectedToPreviousSession;
        if (typeof msg.session === 'string') {
          reconnectedToPreviousSession = self._lastSessionId === msg.session;
          self._lastSessionId = msg.session;
        }
        if (reconnectedToPreviousSession) {
          // Successful reconnection -- pick up where we left off.  Note that right
          // now, this never happens: the server never connects us to a previous
          // session, because DDP doesn't provide enough data for the server to know
          // what messages the client has processed. We need to improve DDP to make
          // this possible, at which point we'll probably need more code here.
          return;
        }

        // Server doesn't have our data any more. Re-sync a new session.

        // Forget about messages we were buffering for unknown collections. They'll
        // be resent if still relevant.
        self._updatesForUnknownStores = Object.create(null);
        if (self._resetStores) {
          // Forget about the effects of stubs. We'll be resetting all collections
          // anyway.
          self._documentsWrittenByStub = Object.create(null);
          self._serverDocuments = Object.create(null);
        }

        // Clear _afterUpdateCallbacks.
        self._afterUpdateCallbacks = [];

        // Mark all named subscriptions which are ready (ie, we already called the
        // ready callback) as needing to be revived.
        // XXX We should also block reconnect quiescence until unnamed subscriptions
        //     (eg, autopublish) are done re-publishing to avoid flicker!
        self._subsBeingRevived = Object.create(null);
        Object.entries(self._subscriptions).forEach(_ref5 => {
          let [id, sub] = _ref5;
          if (sub.ready) {
            self._subsBeingRevived[id] = true;
          }
        });

        // Arrange for "half-finished" methods to have their callbacks run, and
        // track methods that were sent on this connection so that we don't
        // quiesce until they are all done.
        //
        // Start by clearing _methodsBlockingQuiescence: methods sent before
        // reconnect don't matter, and any "wait" methods sent on the new connection
        // that we drop here will be restored by the loop below.
        self._methodsBlockingQuiescence = Object.create(null);
        if (self._resetStores) {
          const invokers = self._methodInvokers;
          keys(invokers).forEach(id => {
            const invoker = invokers[id];
            if (invoker.gotResult()) {
              // This method already got its result, but it didn't call its callback
              // because its data didn't become visible. We did not resend the
              // method RPC. We'll call its callback when we get a full quiesce,
              // since that's as close as we'll get to "data must be visible".
              self._afterUpdateCallbacks.push(function () {
                return invoker.dataVisible(...arguments);
              });
            } else if (invoker.sentMessage) {
              // This method has been sent on this connection (maybe as a resend
              // from the last connection, maybe from onReconnect, maybe just very
              // quickly before processing the connected message).
              //
              // We don't need to do anything special to ensure its callbacks get
              // called, but we'll count it as a method which is preventing
              // reconnect quiescence. (eg, it might be a login method that was run
              // from onReconnect, and we don't want to see flicker by seeing a
              // logged-out state.)
              self._methodsBlockingQuiescence[invoker.methodId] = true;
            }
          });
        }
        self._messagesBufferedUntilQuiescence = [];

        // If we're not waiting on any methods or subs, we can reset the stores and
        // call the callbacks immediately.
        if (!self._waitingForQuiescence()) {
          if (self._resetStores) {
            for (const store of Object.values(self._stores)) {
              await store.beginUpdate(0, true);
              await store.endUpdate();
            }
            self._resetStores = false;
          }
          self._runAfterUpdateCallbacks();
        }
      }
      async _processOneDataMessage(msg, updates) {
        const messageType = msg.msg;

        // msg is one of ['added', 'changed', 'removed', 'ready', 'updated']
        if (messageType === 'added') {
          await this._process_added(msg, updates);
        } else if (messageType === 'changed') {
          this._process_changed(msg, updates);
        } else if (messageType === 'removed') {
          this._process_removed(msg, updates);
        } else if (messageType === 'ready') {
          this._process_ready(msg, updates);
        } else if (messageType === 'updated') {
          this._process_updated(msg, updates);
        } else if (messageType === 'nosub') {
          // ignore this
        } else {
          Meteor._debug('discarding unknown livedata data message type', msg);
        }
      }
      async _livedata_data(msg) {
        const self = this;
        if (self._waitingForQuiescence()) {
          self._messagesBufferedUntilQuiescence.push(msg);
          if (msg.msg === 'nosub') {
            delete self._subsBeingRevived[msg.id];
          }
          if (msg.subs) {
            msg.subs.forEach(subId => {
              delete self._subsBeingRevived[subId];
            });
          }
          if (msg.methods) {
            msg.methods.forEach(methodId => {
              delete self._methodsBlockingQuiescence[methodId];
            });
          }
          if (self._waitingForQuiescence()) {
            return;
          }

          // No methods or subs are blocking quiescence!
          // We'll now process and all of our buffered messages, reset all stores,
          // and apply them all at once.

          const bufferedMessages = self._messagesBufferedUntilQuiescence;
          for (const bufferedMessage of Object.values(bufferedMessages)) {
            await self._processOneDataMessage(bufferedMessage, self._bufferedWrites);
          }
          self._messagesBufferedUntilQuiescence = [];
        } else {
          await self._processOneDataMessage(msg, self._bufferedWrites);
        }

        // Immediately flush writes when:
        //  1. Buffering is disabled. Or;
        //  2. any non-(added/changed/removed) message arrives.
        const standardWrite = msg.msg === "added" || msg.msg === "changed" || msg.msg === "removed";
        if (self._bufferedWritesInterval === 0 || !standardWrite) {
          await self._flushBufferedWrites();
          return;
        }
        if (self._bufferedWritesFlushAt === null) {
          self._bufferedWritesFlushAt = new Date().valueOf() + self._bufferedWritesMaxAge;
        } else if (self._bufferedWritesFlushAt < new Date().valueOf()) {
          await self._flushBufferedWrites();
          return;
        }
        if (self._bufferedWritesFlushHandle) {
          clearTimeout(self._bufferedWritesFlushHandle);
        }
        self._bufferedWritesFlushHandle = setTimeout(() => {
          // __flushBufferedWrites is a promise, so with this we can wait the promise to finish
          // before doing something
          self._liveDataWritesPromise = self.__flushBufferedWrites();
          if (Meteor._isPromise(self._liveDataWritesPromise)) {
            self._liveDataWritesPromise.finally(() => self._liveDataWritesPromise = undefined);
          }
        }, self._bufferedWritesInterval);
      }
      _prepareBuffersToFlush() {
        const self = this;
        if (self._bufferedWritesFlushHandle) {
          clearTimeout(self._bufferedWritesFlushHandle);
          self._bufferedWritesFlushHandle = null;
        }
        self._bufferedWritesFlushAt = null;
        // We need to clear the buffer before passing it to
        //  performWrites. As there's no guarantee that it
        //  will exit cleanly.
        const writes = self._bufferedWrites;
        self._bufferedWrites = Object.create(null);
        return writes;
      }
      async _flushBufferedWritesServer() {
        const self = this;
        const writes = self._prepareBuffersToFlush();
        await self._performWritesServer(writes);
      }
      _flushBufferedWritesClient() {
        const self = this;
        const writes = self._prepareBuffersToFlush();
        self._performWritesClient(writes);
      }
      _flushBufferedWrites() {
        const self = this;
        return Meteor.isClient ? self._flushBufferedWritesClient() : self._flushBufferedWritesServer();
      }
      async _performWritesServer(updates) {
        const self = this;
        if (self._resetStores || !isEmpty(updates)) {
          // Begin a transactional update of each store.

          for (const [storeName, store] of Object.entries(self._stores)) {
            await store.beginUpdate(hasOwn.call(updates, storeName) ? updates[storeName].length : 0, self._resetStores);
          }
          self._resetStores = false;
          for (const [storeName, updateMessages] of Object.entries(updates)) {
            const store = self._stores[storeName];
            if (store) {
              for (const updateMessage of updateMessages) {
                await store.update(updateMessage);
              }
            } else {
              // Nobody's listening for this data. Queue it up until
              // someone wants it.
              // XXX memory use will grow without bound if you forget to
              // create a collection or just don't care about it... going
              // to have to do something about that.
              const updates = self._updatesForUnknownStores;
              if (!hasOwn.call(updates, storeName)) {
                updates[storeName] = [];
              }
              updates[storeName].push(...updateMessages);
            }
          }
          // End update transaction.
          for (const store of Object.values(self._stores)) {
            await store.endUpdate();
          }
        }
        self._runAfterUpdateCallbacks();
      }
      _performWritesClient(updates) {
        const self = this;
        if (self._resetStores || !isEmpty(updates)) {
          // Begin a transactional update of each store.

          for (const [storeName, store] of Object.entries(self._stores)) {
            store.beginUpdate(hasOwn.call(updates, storeName) ? updates[storeName].length : 0, self._resetStores);
          }
          self._resetStores = false;
          for (const [storeName, updateMessages] of Object.entries(updates)) {
            const store = self._stores[storeName];
            if (store) {
              for (const updateMessage of updateMessages) {
                store.update(updateMessage);
              }
            } else {
              // Nobody's listening for this data. Queue it up until
              // someone wants it.
              // XXX memory use will grow without bound if you forget to
              // create a collection or just don't care about it... going
              // to have to do something about that.
              const updates = self._updatesForUnknownStores;
              if (!hasOwn.call(updates, storeName)) {
                updates[storeName] = [];
              }
              updates[storeName].push(...updateMessages);
            }
          }
          // End update transaction.
          for (const store of Object.values(self._stores)) {
            store.endUpdate();
          }
        }
        self._runAfterUpdateCallbacks();
      }

      // Call any callbacks deferred with _runWhenAllServerDocsAreFlushed whose
      // relevant docs have been flushed, as well as dataVisible callbacks at
      // reconnect-quiescence time.
      _runAfterUpdateCallbacks() {
        const self = this;
        const callbacks = self._afterUpdateCallbacks;
        self._afterUpdateCallbacks = [];
        callbacks.forEach(c => {
          c();
        });
      }
      _pushUpdate(updates, collection, msg) {
        if (!hasOwn.call(updates, collection)) {
          updates[collection] = [];
        }
        updates[collection].push(msg);
      }
      _getServerDoc(collection, id) {
        const self = this;
        if (!hasOwn.call(self._serverDocuments, collection)) {
          return null;
        }
        const serverDocsForCollection = self._serverDocuments[collection];
        return serverDocsForCollection.get(id) || null;
      }
      async _process_added(msg, updates) {
        const self = this;
        const id = MongoID.idParse(msg.id);
        const serverDoc = self._getServerDoc(msg.collection, id);
        if (serverDoc) {
          // Some outstanding stub wrote here.
          const isExisting = serverDoc.document !== undefined;
          serverDoc.document = msg.fields || Object.create(null);
          serverDoc.document._id = id;
          if (self._resetStores) {
            // During reconnect the server is sending adds for existing ids.
            // Always push an update so that document stays in the store after
            // reset. Use current version of the document for this update, so
            // that stub-written values are preserved.
            const currentDoc = await self._stores[msg.collection].getDoc(msg.id);
            if (currentDoc !== undefined) msg.fields = currentDoc;
            self._pushUpdate(updates, msg.collection, msg);
          } else if (isExisting) {
            throw new Error('Server sent add for existing id: ' + msg.id);
          }
        } else {
          self._pushUpdate(updates, msg.collection, msg);
        }
      }
      _process_changed(msg, updates) {
        const self = this;
        const serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));
        if (serverDoc) {
          if (serverDoc.document === undefined) throw new Error('Server sent changed for nonexisting id: ' + msg.id);
          DiffSequence.applyChanges(serverDoc.document, msg.fields);
        } else {
          self._pushUpdate(updates, msg.collection, msg);
        }
      }
      _process_removed(msg, updates) {
        const self = this;
        const serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));
        if (serverDoc) {
          // Some outstanding stub wrote here.
          if (serverDoc.document === undefined) throw new Error('Server sent removed for nonexisting id:' + msg.id);
          serverDoc.document = undefined;
        } else {
          self._pushUpdate(updates, msg.collection, {
            msg: 'removed',
            collection: msg.collection,
            id: msg.id
          });
        }
      }
      _process_updated(msg, updates) {
        const self = this;
        // Process "method done" messages.

        msg.methods.forEach(methodId => {
          const docs = self._documentsWrittenByStub[methodId] || {};
          Object.values(docs).forEach(written => {
            const serverDoc = self._getServerDoc(written.collection, written.id);
            if (!serverDoc) {
              throw new Error('Lost serverDoc for ' + JSON.stringify(written));
            }
            if (!serverDoc.writtenByStubs[methodId]) {
              throw new Error('Doc ' + JSON.stringify(written) + ' not written by  method ' + methodId);
            }
            delete serverDoc.writtenByStubs[methodId];
            if (isEmpty(serverDoc.writtenByStubs)) {
              // All methods whose stubs wrote this method have completed! We can
              // now copy the saved document to the database (reverting the stub's
              // change if the server did not write to this object, or applying the
              // server's writes if it did).

              // This is a fake ddp 'replace' message.  It's just for talking
              // between livedata connections and minimongo.  (We have to stringify
              // the ID because it's supposed to look like a wire message.)
              self._pushUpdate(updates, written.collection, {
                msg: 'replace',
                id: MongoID.idStringify(written.id),
                replace: serverDoc.document
              });
              // Call all flush callbacks.

              serverDoc.flushCallbacks.forEach(c => {
                c();
              });

              // Delete this completed serverDocument. Don't bother to GC empty
              // IdMaps inside self._serverDocuments, since there probably aren't
              // many collections and they'll be written repeatedly.
              self._serverDocuments[written.collection].remove(written.id);
            }
          });
          delete self._documentsWrittenByStub[methodId];

          // We want to call the data-written callback, but we can't do so until all
          // currently buffered messages are flushed.
          const callbackInvoker = self._methodInvokers[methodId];
          if (!callbackInvoker) {
            throw new Error('No callback invoker for method ' + methodId);
          }
          self._runWhenAllServerDocsAreFlushed(function () {
            return callbackInvoker.dataVisible(...arguments);
          });
        });
      }
      _process_ready(msg, updates) {
        const self = this;
        // Process "sub ready" messages. "sub ready" messages don't take effect
        // until all current server documents have been flushed to the local
        // database. We can use a write fence to implement this.

        msg.subs.forEach(subId => {
          self._runWhenAllServerDocsAreFlushed(() => {
            const subRecord = self._subscriptions[subId];
            // Did we already unsubscribe?
            if (!subRecord) return;
            // Did we already receive a ready message? (Oops!)
            if (subRecord.ready) return;
            subRecord.ready = true;
            subRecord.readyCallback && subRecord.readyCallback();
            subRecord.readyDeps.changed();
          });
        });
      }

      // Ensures that "f" will be called after all documents currently in
      // _serverDocuments have been written to the local cache. f will not be called
      // if the connection is lost before then!
      _runWhenAllServerDocsAreFlushed(f) {
        const self = this;
        const runFAfterUpdates = () => {
          self._afterUpdateCallbacks.push(f);
        };
        let unflushedServerDocCount = 0;
        const onServerDocFlush = () => {
          --unflushedServerDocCount;
          if (unflushedServerDocCount === 0) {
            // This was the last doc to flush! Arrange to run f after the updates
            // have been applied.
            runFAfterUpdates();
          }
        };
        Object.values(self._serverDocuments).forEach(serverDocuments => {
          serverDocuments.forEach(serverDoc => {
            const writtenByStubForAMethodWithSentMessage = keys(serverDoc.writtenByStubs).some(methodId => {
              const invoker = self._methodInvokers[methodId];
              return invoker && invoker.sentMessage;
            });
            if (writtenByStubForAMethodWithSentMessage) {
              ++unflushedServerDocCount;
              serverDoc.flushCallbacks.push(onServerDocFlush);
            }
          });
        });
        if (unflushedServerDocCount === 0) {
          // There aren't any buffered docs --- we can call f as soon as the current
          // round of updates is applied!
          runFAfterUpdates();
        }
      }
      async _livedata_nosub(msg) {
        const self = this;

        // First pass it through _livedata_data, which only uses it to help get
        // towards quiescence.
        await self._livedata_data(msg);

        // Do the rest of our processing immediately, with no
        // buffering-until-quiescence.

        // we weren't subbed anyway, or we initiated the unsub.
        if (!hasOwn.call(self._subscriptions, msg.id)) {
          return;
        }

        // XXX COMPAT WITH 1.0.3.1 #errorCallback
        const errorCallback = self._subscriptions[msg.id].errorCallback;
        const stopCallback = self._subscriptions[msg.id].stopCallback;
        self._subscriptions[msg.id].remove();
        const meteorErrorFromMsg = msgArg => {
          return msgArg && msgArg.error && new Meteor.Error(msgArg.error.error, msgArg.error.reason, msgArg.error.details);
        };

        // XXX COMPAT WITH 1.0.3.1 #errorCallback
        if (errorCallback && msg.error) {
          errorCallback(meteorErrorFromMsg(msg));
        }
        if (stopCallback) {
          stopCallback(meteorErrorFromMsg(msg));
        }
      }
      async _livedata_result(msg) {
        // id, result or error. error has error (code), reason, details

        const self = this;

        // Lets make sure there are no buffered writes before returning result.
        if (!isEmpty(self._bufferedWrites)) {
          await self._flushBufferedWrites();
        }

        // find the outstanding request
        // should be O(1) in nearly all realistic use cases
        if (isEmpty(self._outstandingMethodBlocks)) {
          Meteor._debug('Received method result but no methods outstanding');
          return;
        }
        const currentMethodBlock = self._outstandingMethodBlocks[0].methods;
        let i;
        const m = currentMethodBlock.find((method, idx) => {
          const found = method.methodId === msg.id;
          if (found) i = idx;
          return found;
        });
        if (!m) {
          Meteor._debug("Can't match method response to original method call", msg);
          return;
        }

        // Remove from current method block. This may leave the block empty, but we
        // don't move on to the next block until the callback has been delivered, in
        // _outstandingMethodFinished.
        currentMethodBlock.splice(i, 1);
        if (hasOwn.call(msg, 'error')) {
          m.receiveResult(new Meteor.Error(msg.error.error, msg.error.reason, msg.error.details));
        } else {
          // msg.result may be undefined if the method didn't return a
          // value
          m.receiveResult(undefined, msg.result);
        }
      }

      // Called by MethodInvoker after a method's callback is invoked.  If this was
      // the last outstanding method in the current block, runs the next block. If
      // there are no more methods, consider accepting a hot code push.
      _outstandingMethodFinished() {
        const self = this;
        if (self._anyMethodsAreOutstanding()) return;

        // No methods are outstanding. This should mean that the first block of
        // methods is empty. (Or it might not exist, if this was a method that
        // half-finished before disconnect/reconnect.)
        if (!isEmpty(self._outstandingMethodBlocks)) {
          const firstBlock = self._outstandingMethodBlocks.shift();
          if (!isEmpty(firstBlock.methods)) throw new Error('No methods outstanding but nonempty block: ' + JSON.stringify(firstBlock));

          // Send the outstanding methods now in the first block.
          if (!isEmpty(self._outstandingMethodBlocks)) self._sendOutstandingMethods();
        }

        // Maybe accept a hot code push.
        self._maybeMigrate();
      }

      // Sends messages for all the methods in the first block in
      // _outstandingMethodBlocks.
      _sendOutstandingMethods() {
        const self = this;
        if (isEmpty(self._outstandingMethodBlocks)) {
          return;
        }
        self._outstandingMethodBlocks[0].methods.forEach(m => {
          m.sendMessage();
        });
      }
      _livedata_error(msg) {
        Meteor._debug('Received error from server: ', msg.reason);
        if (msg.offendingMessage) Meteor._debug('For: ', msg.offendingMessage);
      }
      _sendOutstandingMethodBlocksMessages(oldOutstandingMethodBlocks) {
        const self = this;
        if (isEmpty(oldOutstandingMethodBlocks)) return;

        // We have at least one block worth of old outstanding methods to try
        // again. First: did onReconnect actually send anything? If not, we just
        // restore all outstanding methods and run the first block.
        if (isEmpty(self._outstandingMethodBlocks)) {
          self._outstandingMethodBlocks = oldOutstandingMethodBlocks;
          self._sendOutstandingMethods();
          return;
        }

        // OK, there are blocks on both sides. Special case: merge the last block of
        // the reconnect methods with the first block of the original methods, if
        // neither of them are "wait" blocks.
        if (!last(self._outstandingMethodBlocks).wait && !oldOutstandingMethodBlocks[0].wait) {
          oldOutstandingMethodBlocks[0].methods.forEach(m => {
            last(self._outstandingMethodBlocks).methods.push(m);

            // If this "last block" is also the first block, send the message.
            if (self._outstandingMethodBlocks.length === 1) {
              m.sendMessage();
            }
          });
          oldOutstandingMethodBlocks.shift();
        }

        // Now add the rest of the original blocks on.
        self._outstandingMethodBlocks.push(...oldOutstandingMethodBlocks);
      }
      _callOnReconnectAndSendAppropriateOutstandingMethods() {
        const self = this;
        const oldOutstandingMethodBlocks = self._outstandingMethodBlocks;
        self._outstandingMethodBlocks = [];
        self.onReconnect && self.onReconnect();
        DDP._reconnectHook.each(callback => {
          callback(self);
          return true;
        });
        self._sendOutstandingMethodBlocksMessages(oldOutstandingMethodBlocks);
      }

      // We can accept a hot code push if there are no methods in flight.
      _readyToMigrate() {
        return isEmpty(this._methodInvokers);
      }

      // If we were blocking a migration, see if it's now possible to continue.
      // Call whenever the set of outstanding/blocked methods shrinks.
      _maybeMigrate() {
        const self = this;
        if (self._retryMigrate && self._readyToMigrate()) {
          self._retryMigrate();
          self._retryMigrate = null;
        }
      }
      async onMessage(raw_msg) {
        let msg;
        try {
          msg = DDPCommon.parseDDP(raw_msg);
        } catch (e) {
          Meteor._debug('Exception while parsing DDP', e);
          return;
        }

        // Any message counts as receiving a pong, as it demonstrates that
        // the server is still alive.
        if (this._heartbeat) {
          this._heartbeat.messageReceived();
        }
        if (msg === null || !msg.msg) {
          if (!msg || !msg.testMessageOnConnect) {
            if (Object.keys(msg).length === 1 && msg.server_id) return;
            Meteor._debug('discarding invalid livedata message', msg);
          }
          return;
        }
        if (msg.msg === 'connected') {
          this._version = this._versionSuggestion;
          await this._livedata_connected(msg);
          this.options.onConnected();
        } else if (msg.msg === 'failed') {
          if (this._supportedDDPVersions.indexOf(msg.version) >= 0) {
            this._versionSuggestion = msg.version;
            this._stream.reconnect({
              _force: true
            });
          } else {
            const description = 'DDP version negotiation failed; server requested version ' + msg.version;
            this._stream.disconnect({
              _permanent: true,
              _error: description
            });
            this.options.onDDPVersionNegotiationFailure(description);
          }
        } else if (msg.msg === 'ping' && this.options.respondToPings) {
          this._send({
            msg: 'pong',
            id: msg.id
          });
        } else if (msg.msg === 'pong') {
          // noop, as we assume everything's a pong
        } else if (['added', 'changed', 'removed', 'ready', 'updated'].includes(msg.msg)) {
          await this._livedata_data(msg);
        } else if (msg.msg === 'nosub') {
          await this._livedata_nosub(msg);
        } else if (msg.msg === 'result') {
          await this._livedata_result(msg);
        } else if (msg.msg === 'error') {
          this._livedata_error(msg);
        } else {
          Meteor._debug('discarding unknown livedata message type', msg);
        }
      }
      onReset() {
        // Send a connect message at the beginning of the stream.
        // NOTE: reset is called even on the first connection, so this is
        // the only place we send this message.
        const msg = {
          msg: 'connect'
        };
        if (this._lastSessionId) msg.session = this._lastSessionId;
        msg.version = this._versionSuggestion || this._supportedDDPVersions[0];
        this._versionSuggestion = msg.version;
        msg.support = this._supportedDDPVersions;
        this._send(msg);

        // Mark non-retry calls as failed. This has to be done early as getting these methods out of the
        // current block is pretty important to making sure that quiescence is properly calculated, as
        // well as possibly moving on to another useful block.

        // Only bother testing if there is an outstandingMethodBlock (there might not be, especially if
        // we are connecting for the first time.
        if (this._outstandingMethodBlocks.length > 0) {
          // If there is an outstanding method block, we only care about the first one as that is the
          // one that could have already sent messages with no response, that are not allowed to retry.
          const currentMethodBlock = this._outstandingMethodBlocks[0].methods;
          this._outstandingMethodBlocks[0].methods = currentMethodBlock.filter(methodInvoker => {
            // Methods with 'noRetry' option set are not allowed to re-send after
            // recovering dropped connection.
            if (methodInvoker.sentMessage && methodInvoker.noRetry) {
              // Make sure that the method is told that it failed.
              methodInvoker.receiveResult(new Meteor.Error('invocation-failed', 'Method invocation might have failed due to dropped connection. ' + 'Failing because `noRetry` option was passed to Meteor.apply.'));
            }

            // Only keep a method if it wasn't sent or it's allowed to retry.
            // This may leave the block empty, but we don't move on to the next
            // block until the callback has been delivered, in _outstandingMethodFinished.
            return !(methodInvoker.sentMessage && methodInvoker.noRetry);
          });
        }

        // Now, to minimize setup latency, go ahead and blast out all of
        // our pending methods ands subscriptions before we've even taken
        // the necessary RTT to know if we successfully reconnected. (1)
        // They're supposed to be idempotent, and where they are not,
        // they can block retry in apply; (2) even if we did reconnect,
        // we're not sure what messages might have gotten lost
        // (in either direction) since we were disconnected (TCP being
        // sloppy about that.)

        // If the current block of methods all got their results (but didn't all get
        // their data visible), discard the empty block now.
        if (this._outstandingMethodBlocks.length > 0 && this._outstandingMethodBlocks[0].methods.length === 0) {
          this._outstandingMethodBlocks.shift();
        }

        // Mark all messages as unsent, they have not yet been sent on this
        // connection.
        keys(this._methodInvokers).forEach(id => {
          this._methodInvokers[id].sentMessage = false;
        });

        // If an `onReconnect` handler is set, call it first. Go through
        // some hoops to ensure that methods that are called from within
        // `onReconnect` get executed _before_ ones that were originally
        // outstanding (since `onReconnect` is used to re-establish auth
        // certificates)
        this._callOnReconnectAndSendAppropriateOutstandingMethods();

        // add new subscriptions at the end. this way they take effect after
        // the handlers and we don't see flicker.
        Object.entries(this._subscriptions).forEach(_ref6 => {
          let [id, sub] = _ref6;
          this._sendQueued({
            msg: 'sub',
            id: id,
            name: sub.name,
            params: sub.params
          });
        });
      }
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"namespace.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/common/namespace.js                                                                            //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      DDP: () => DDP
    });
    let DDPCommon;
    module.link("meteor/ddp-common", {
      DDPCommon(v) {
        DDPCommon = v;
      }
    }, 0);
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 1);
    let Connection;
    module.link("./livedata_connection.js", {
      Connection(v) {
        Connection = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // This array allows the `_allSubscriptionsReady` method below, which
    // is used by the `spiderable` package, to keep track of whether all
    // data is ready.
    const allConnections = [];

    /**
     * @namespace DDP
     * @summary Namespace for DDP-related methods/classes.
     */
    const DDP = {};
    // This is private but it's used in a few places. accounts-base uses
    // it to get the current user. Meteor.setTimeout and friends clear
    // it. We can probably find a better way to factor this.
    DDP._CurrentMethodInvocation = new Meteor.EnvironmentVariable();
    DDP._CurrentPublicationInvocation = new Meteor.EnvironmentVariable();

    // XXX: Keep DDP._CurrentInvocation for backwards-compatibility.
    DDP._CurrentInvocation = DDP._CurrentMethodInvocation;
    DDP._CurrentCallAsyncInvocation = new Meteor.EnvironmentVariable();

    // This is passed into a weird `makeErrorType` function that expects its thing
    // to be a constructor
    function connectionErrorConstructor(message) {
      this.message = message;
    }
    DDP.ConnectionError = Meteor.makeErrorType('DDP.ConnectionError', connectionErrorConstructor);
    DDP.ForcedReconnectError = Meteor.makeErrorType('DDP.ForcedReconnectError', () => {});

    // Returns the named sequence of pseudo-random values.
    // The scope will be DDP._CurrentMethodInvocation.get(), so the stream will produce
    // consistent values for method calls on the client and server.
    DDP.randomStream = name => {
      const scope = DDP._CurrentMethodInvocation.get();
      return DDPCommon.RandomStream.get(scope, name);
    };

    // @param url {String} URL to Meteor app,
    //     e.g.:
    //     "subdomain.meteor.com",
    //     "http://subdomain.meteor.com",
    //     "/",
    //     "ddp+sockjs://ddp--****-foo.meteor.com/sockjs"

    /**
     * @summary Connect to the server of a different Meteor application to subscribe to its document sets and invoke its remote methods.
     * @locus Anywhere
     * @param {String} url The URL of another Meteor application.
     * @param {Object} [options]
     * @param {Boolean} options.reloadWithOutstanding is it OK to reload if there are outstanding methods?
     * @param {Object} options.headers extra headers to send on the websockets connection, for server-to-server DDP only
     * @param {Object} options._sockjsOptions Specifies options to pass through to the sockjs client
     * @param {Function} options.onDDPNegotiationVersionFailure callback when version negotiation fails.
     */
    DDP.connect = (url, options) => {
      const ret = new Connection(url, options);
      allConnections.push(ret); // hack. see below.
      return ret;
    };
    DDP._reconnectHook = new Hook({
      bindEnvironment: false
    });

    /**
     * @summary Register a function to call as the first step of
     * reconnecting. This function can call methods which will be executed before
     * any other outstanding methods. For example, this can be used to re-establish
     * the appropriate authentication context on the connection.
     * @locus Anywhere
     * @param {Function} callback The function to call. It will be called with a
     * single argument, the [connection object](#ddp_connect) that is reconnecting.
     */
    DDP.onReconnect = callback => DDP._reconnectHook.register(callback);

    // Hack for `spiderable` package: a way to see if the page is done
    // loading all the data it needs.
    //
    DDP._allSubscriptionsReady = () => allConnections.every(conn => Object.values(conn._subscriptions).every(sub => sub.ready));
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      DDP: DDP
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/ddp-client/server/server.js"
  ],
  mainModulePath: "/node_modules/meteor/ddp-client/server/server.js"
}});

//# sourceURL=meteor://💻app/packages/ddp-client.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLWNsaWVudC9zZXJ2ZXIvc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9NZXRob2RJbnZva2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9saXZlZGF0YV9jb25uZWN0aW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9uYW1lc3BhY2UuanMiXSwibmFtZXMiOlsibW9kdWxlIiwibGluayIsIkREUCIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwic2VsZiIsImFzeW5jIiwiZXhwb3J0IiwiZGVmYXVsdCIsIk1ldGhvZEludm9rZXIiLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJtZXRob2RJZCIsInNlbnRNZXNzYWdlIiwiX2NhbGxiYWNrIiwiY2FsbGJhY2siLCJfY29ubmVjdGlvbiIsImNvbm5lY3Rpb24iLCJfbWVzc2FnZSIsIm1lc3NhZ2UiLCJfb25SZXN1bHRSZWNlaXZlZCIsIm9uUmVzdWx0UmVjZWl2ZWQiLCJfd2FpdCIsIndhaXQiLCJub1JldHJ5IiwiX21ldGhvZFJlc3VsdCIsIl9kYXRhVmlzaWJsZSIsIl9tZXRob2RJbnZva2VycyIsInNlbmRNZXNzYWdlIiwiZ290UmVzdWx0IiwiRXJyb3IiLCJfbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSIsIl9zZW5kIiwiX21heWJlSW52b2tlQ2FsbGJhY2siLCJfb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZCIsInJlY2VpdmVSZXN1bHQiLCJlcnIiLCJyZXN1bHQiLCJkYXRhVmlzaWJsZSIsIl9vYmplY3RXaXRob3V0UHJvcGVydGllcyIsInYiLCJfb2JqZWN0U3ByZWFkIiwiX2V4Y2x1ZGVkIiwiX2V4Y2x1ZGVkMiIsIkNvbm5lY3Rpb24iLCJNZXRlb3IiLCJERFBDb21tb24iLCJUcmFja2VyIiwiRUpTT04iLCJSYW5kb20iLCJIb29rIiwiTW9uZ29JRCIsImhhc093biIsInNsaWNlIiwia2V5cyIsImlzRW1wdHkiLCJsYXN0IiwiTW9uZ29JRE1hcCIsIklkTWFwIiwiaWRTdHJpbmdpZnkiLCJpZFBhcnNlIiwidXJsIiwib25Db25uZWN0ZWQiLCJvbkREUFZlcnNpb25OZWdvdGlhdGlvbkZhaWx1cmUiLCJkZXNjcmlwdGlvbiIsIl9kZWJ1ZyIsImhlYXJ0YmVhdEludGVydmFsIiwiaGVhcnRiZWF0VGltZW91dCIsIm5wbUZheWVPcHRpb25zIiwiT2JqZWN0IiwiY3JlYXRlIiwicmVsb2FkV2l0aE91dHN0YW5kaW5nIiwic3VwcG9ydGVkRERQVmVyc2lvbnMiLCJTVVBQT1JURURfRERQX1ZFUlNJT05TIiwicmV0cnkiLCJyZXNwb25kVG9QaW5ncyIsImJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwiLCJidWZmZXJlZFdyaXRlc01heEFnZSIsIm9uUmVjb25uZWN0IiwiX3N0cmVhbSIsIkNsaWVudFN0cmVhbSIsInJlcXVpcmUiLCJDb25uZWN0aW9uRXJyb3IiLCJoZWFkZXJzIiwiX3NvY2tqc09wdGlvbnMiLCJfZG9udFByaW50RXJyb3JzIiwiY29ubmVjdFRpbWVvdXRNcyIsIl9sYXN0U2Vzc2lvbklkIiwiX3ZlcnNpb25TdWdnZXN0aW9uIiwiX3ZlcnNpb24iLCJfc3RvcmVzIiwiX21ldGhvZEhhbmRsZXJzIiwiX25leHRNZXRob2RJZCIsIl9zdXBwb3J0ZWRERFBWZXJzaW9ucyIsIl9oZWFydGJlYXRJbnRlcnZhbCIsIl9oZWFydGJlYXRUaW1lb3V0IiwiX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzIiwiX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWIiLCJfc2VydmVyRG9jdW1lbnRzIiwiX2FmdGVyVXBkYXRlQ2FsbGJhY2tzIiwiX21lc3NhZ2VzQnVmZmVyZWRVbnRpbFF1aWVzY2VuY2UiLCJfc3Vic0JlaW5nUmV2aXZlZCIsIl9yZXNldFN0b3JlcyIsIl91cGRhdGVzRm9yVW5rbm93blN0b3JlcyIsIl9yZXRyeU1pZ3JhdGUiLCJfX2ZsdXNoQnVmZmVyZWRXcml0ZXMiLCJiaW5kRW52aXJvbm1lbnQiLCJfZmx1c2hCdWZmZXJlZFdyaXRlcyIsIl9idWZmZXJlZFdyaXRlcyIsIl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQiLCJfYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSIsIl9idWZmZXJlZFdyaXRlc0ludGVydmFsIiwiX2J1ZmZlcmVkV3JpdGVzTWF4QWdlIiwiX3N1YnNjcmlwdGlvbnMiLCJfdXNlcklkIiwiX3VzZXJJZERlcHMiLCJEZXBlbmRlbmN5IiwiaXNDbGllbnQiLCJQYWNrYWdlIiwicmVsb2FkIiwiUmVsb2FkIiwiX29uTWlncmF0ZSIsIl9yZWFkeVRvTWlncmF0ZSIsIm9uRGlzY29ubmVjdCIsIl9oZWFydGJlYXQiLCJzdG9wIiwiaXNTZXJ2ZXIiLCJvbiIsIm9uTWVzc2FnZSIsImJpbmQiLCJvblJlc2V0IiwiY3JlYXRlU3RvcmVNZXRob2RzIiwibmFtZSIsIndyYXBwZWRTdG9yZSIsInN0b3JlIiwia2V5c09mU3RvcmUiLCJmb3JFYWNoIiwibWV0aG9kIiwiYXJndW1lbnRzIiwicmVnaXN0ZXJTdG9yZUNsaWVudCIsInF1ZXVlZCIsIkFycmF5IiwiaXNBcnJheSIsImJlZ2luVXBkYXRlIiwibGVuZ3RoIiwibXNnIiwidXBkYXRlIiwiZW5kVXBkYXRlIiwicmVnaXN0ZXJTdG9yZVNlcnZlciIsInN1YnNjcmliZSIsInBhcmFtcyIsImNhbGwiLCJjYWxsYmFja3MiLCJsYXN0UGFyYW0iLCJvblJlYWR5IiwicG9wIiwib25FcnJvciIsIm9uU3RvcCIsInNvbWUiLCJmIiwiZXhpc3RpbmciLCJ2YWx1ZXMiLCJmaW5kIiwic3ViIiwiaW5hY3RpdmUiLCJlcXVhbHMiLCJpZCIsInJlYWR5IiwicmVhZHlDYWxsYmFjayIsImVycm9yQ2FsbGJhY2siLCJzdG9wQ2FsbGJhY2siLCJjbG9uZSIsInJlYWR5RGVwcyIsInJlbW92ZSIsImNoYW5nZWQiLCJfc2VuZFF1ZXVlZCIsImhhbmRsZSIsInJlY29yZCIsImRlcGVuZCIsInN1YnNjcmlwdGlvbklkIiwiYWN0aXZlIiwib25JbnZhbGlkYXRlIiwiYyIsImFmdGVyRmx1c2giLCJpc0FzeW5jQ2FsbCIsIl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbiIsIl9pc0NhbGxBc3luY01ldGhvZFJ1bm5pbmciLCJtZXRob2RzIiwiZW50cmllcyIsIl9yZWYiLCJmdW5jIiwiX2dldElzU2ltdWxhdGlvbiIsIl9yZWYyIiwiaXNGcm9tQ2FsbEFzeW5jIiwiYWxyZWFkeUluU2ltdWxhdGlvbiIsImFyZ3MiLCJhcHBseSIsImNhbGxBc3luYyIsImFwcGx5QXN5bmMiLCJyZXR1cm5TZXJ2ZXJSZXN1bHRQcm9taXNlIiwiX3RoaXMkX3N0dWJDYWxsIiwiX3N0dWJDYWxsIiwic3R1Ykludm9jYXRpb24iLCJpbnZvY2F0aW9uIiwic3R1Yk9wdGlvbnMiLCJoYXNTdHViIiwiX3NhdmVPcmlnaW5hbHMiLCJzdHViUmV0dXJuVmFsdWUiLCJ3aXRoVmFsdWUiLCJfaXNQcm9taXNlIiwiY29uY2F0IiwiZSIsImV4Y2VwdGlvbiIsIl9hcHBseSIsInVuZGVmaW5lZCIsInN0dWJQcm9taXNlIiwiX2FwcGx5QXN5bmNTdHViSW52b2NhdGlvbiIsInByb21pc2UiLCJfYXBwbHlBc3luYyIsInRoZW4iLCJvIiwic2VydmVyUHJvbWlzZSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiY2F0Y2giLCJfdGhpcyRfc3R1YkNhbGwyIiwiY3VycmVudENvbnRleHQiLCJfc2V0TmV3Q29udGV4dEFuZEdldEN1cnJlbnQiLCJfc2V0IiwiX3JlZjMiLCJzdHViQ2FsbFZhbHVlIiwicmFuZG9tU2VlZCIsIl9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzIiwidGhyb3dTdHViRXhjZXB0aW9ucyIsIl9leHBlY3RlZEJ5VGVzdCIsImZ1dHVyZSIsInJldHVyblN0dWJWYWx1ZSIsIl9sZW4iLCJhbGxBcmdzIiwiX2tleSIsImZyb20iLCJzaGlmdCIsInZhbHVlIiwibWV0aG9kSW52b2tlciIsInB1c2giLCJlbmNsb3NpbmciLCJnZXQiLCJzdHViIiwiaXNTaW11bGF0aW9uIiwiX2lzRnJvbUNhbGxBc3luYyIsImRlZmF1bHRSZXR1cm4iLCJyYW5kb21TZWVkR2VuZXJhdG9yIiwibWFrZVJwY1NlZWQiLCJzZXRVc2VySWQiLCJ1c2VySWQiLCJNZXRob2RJbnZvY2F0aW9uIiwiX25vWWllbGRzQWxsb3dlZCIsIl93YWl0aW5nRm9yUXVpZXNjZW5jZSIsIl9mbHVzaEJ1ZmZlcmVkV3JpdGVzQ2xpZW50Iiwic2F2ZU9yaWdpbmFscyIsImRvY3NXcml0dGVuIiwiX3JlZjQiLCJjb2xsZWN0aW9uIiwib3JpZ2luYWxzIiwicmV0cmlldmVPcmlnaW5hbHMiLCJkb2MiLCJzZXJ2ZXJEb2MiLCJzZXREZWZhdWx0Iiwid3JpdHRlbkJ5U3R1YnMiLCJkb2N1bWVudCIsImZsdXNoQ2FsbGJhY2tzIiwiX3Vuc3Vic2NyaWJlQWxsIiwib2JqIiwic2VuZCIsInN0cmluZ2lmeUREUCIsIl9sb3N0Q29ubmVjdGlvbiIsImVycm9yIiwic3RhdHVzIiwicmVjb25uZWN0IiwiZGlzY29ubmVjdCIsImNsb3NlIiwiX3Blcm1hbmVudCIsIl9hbnlNZXRob2RzQXJlT3V0c3RhbmRpbmciLCJpbnZva2VycyIsImludm9rZXIiLCJfbGl2ZWRhdGFfY29ubmVjdGVkIiwiSGVhcnRiZWF0Iiwib25UaW1lb3V0Iiwic2VuZFBpbmciLCJzdGFydCIsInJlY29ubmVjdGVkVG9QcmV2aW91c1Nlc3Npb24iLCJzZXNzaW9uIiwiX3JlZjUiLCJfcnVuQWZ0ZXJVcGRhdGVDYWxsYmFja3MiLCJfcHJvY2Vzc09uZURhdGFNZXNzYWdlIiwidXBkYXRlcyIsIm1lc3NhZ2VUeXBlIiwiX3Byb2Nlc3NfYWRkZWQiLCJfcHJvY2Vzc19jaGFuZ2VkIiwiX3Byb2Nlc3NfcmVtb3ZlZCIsIl9wcm9jZXNzX3JlYWR5IiwiX3Byb2Nlc3NfdXBkYXRlZCIsIl9saXZlZGF0YV9kYXRhIiwic3VicyIsInN1YklkIiwiYnVmZmVyZWRNZXNzYWdlcyIsImJ1ZmZlcmVkTWVzc2FnZSIsInN0YW5kYXJkV3JpdGUiLCJEYXRlIiwidmFsdWVPZiIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJfbGl2ZURhdGFXcml0ZXNQcm9taXNlIiwiZmluYWxseSIsIl9wcmVwYXJlQnVmZmVyc1RvRmx1c2giLCJ3cml0ZXMiLCJfZmx1c2hCdWZmZXJlZFdyaXRlc1NlcnZlciIsIl9wZXJmb3JtV3JpdGVzU2VydmVyIiwiX3BlcmZvcm1Xcml0ZXNDbGllbnQiLCJzdG9yZU5hbWUiLCJ1cGRhdGVNZXNzYWdlcyIsInVwZGF0ZU1lc3NhZ2UiLCJfcHVzaFVwZGF0ZSIsIl9nZXRTZXJ2ZXJEb2MiLCJzZXJ2ZXJEb2NzRm9yQ29sbGVjdGlvbiIsImlzRXhpc3RpbmciLCJmaWVsZHMiLCJfaWQiLCJjdXJyZW50RG9jIiwiZ2V0RG9jIiwiRGlmZlNlcXVlbmNlIiwiYXBwbHlDaGFuZ2VzIiwiZG9jcyIsIndyaXR0ZW4iLCJKU09OIiwic3RyaW5naWZ5IiwicmVwbGFjZSIsImNhbGxiYWNrSW52b2tlciIsIl9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQiLCJzdWJSZWNvcmQiLCJydW5GQWZ0ZXJVcGRhdGVzIiwidW5mbHVzaGVkU2VydmVyRG9jQ291bnQiLCJvblNlcnZlckRvY0ZsdXNoIiwic2VydmVyRG9jdW1lbnRzIiwid3JpdHRlbkJ5U3R1YkZvckFNZXRob2RXaXRoU2VudE1lc3NhZ2UiLCJfbGl2ZWRhdGFfbm9zdWIiLCJtZXRlb3JFcnJvckZyb21Nc2ciLCJtc2dBcmciLCJyZWFzb24iLCJkZXRhaWxzIiwiX2xpdmVkYXRhX3Jlc3VsdCIsImN1cnJlbnRNZXRob2RCbG9jayIsImkiLCJtIiwiaWR4IiwiZm91bmQiLCJzcGxpY2UiLCJmaXJzdEJsb2NrIiwiX3NlbmRPdXRzdGFuZGluZ01ldGhvZHMiLCJfbWF5YmVNaWdyYXRlIiwiX2xpdmVkYXRhX2Vycm9yIiwib2ZmZW5kaW5nTWVzc2FnZSIsIl9zZW5kT3V0c3RhbmRpbmdNZXRob2RCbG9ja3NNZXNzYWdlcyIsIm9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzIiwiX2NhbGxPblJlY29ubmVjdEFuZFNlbmRBcHByb3ByaWF0ZU91dHN0YW5kaW5nTWV0aG9kcyIsIl9yZWNvbm5lY3RIb29rIiwiZWFjaCIsInJhd19tc2ciLCJwYXJzZUREUCIsIm1lc3NhZ2VSZWNlaXZlZCIsInRlc3RNZXNzYWdlT25Db25uZWN0Iiwic2VydmVyX2lkIiwiaW5kZXhPZiIsInZlcnNpb24iLCJfZm9yY2UiLCJfZXJyb3IiLCJpbmNsdWRlcyIsInN1cHBvcnQiLCJmaWx0ZXIiLCJfcmVmNiIsImFsbENvbm5lY3Rpb25zIiwiRW52aXJvbm1lbnRWYXJpYWJsZSIsIl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uIiwiX0N1cnJlbnRJbnZvY2F0aW9uIiwiX0N1cnJlbnRDYWxsQXN5bmNJbnZvY2F0aW9uIiwiY29ubmVjdGlvbkVycm9yQ29uc3RydWN0b3IiLCJtYWtlRXJyb3JUeXBlIiwiRm9yY2VkUmVjb25uZWN0RXJyb3IiLCJyYW5kb21TdHJlYW0iLCJzY29wZSIsIlJhbmRvbVN0cmVhbSIsImNvbm5lY3QiLCJyZXQiLCJyZWdpc3RlciIsIl9hbGxTdWJzY3JpcHRpb25zUmVhZHkiLCJldmVyeSIsImNvbm4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUFBLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLHdCQUF3QixFQUFDO01BQUNDLEdBQUcsRUFBQztJQUFLLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJQyxvQkFBb0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNQSxvQkFBb0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUFDQyxzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHOzs7Ozs7Ozs7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QzZXLGNBQWMsQ0FBQzRCLFFBQVEsQ0FBQzNYLFFBQVEsQ0FBQzs7SUFFbkU7SUFDQTtJQUNBO0lBQ0FkLEdBQUcsQ0FBQzBZLHNCQUFzQixHQUFHLE1BQU1kLGNBQWMsQ0FBQ2UsS0FBSyxDQUNyREMsSUFBSSxJQUFJeFUsTUFBTSxDQUFDNEYsTUFBTSxDQUFDNE8sSUFBSSxDQUFDNVIsY0FBYyxDQUFDLENBQUMyUixLQUFLLENBQUN6TyxHQUFHLElBQUlBLEdBQUcsQ0FBQ0ksS0FBSyxDQUNuRSxDQUFDO0lBQUNwSyxzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHIiwiZmlsZSI6Ii9wYWNrYWdlcy9kZHAtY2xpZW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IHsgRERQIH0gZnJvbSAnLi4vY29tbW9uL25hbWVzcGFjZS5qcyc7XG4iLCIvLyBBIE1ldGhvZEludm9rZXIgbWFuYWdlcyBzZW5kaW5nIGEgbWV0aG9kIHRvIHRoZSBzZXJ2ZXIgYW5kIGNhbGxpbmcgdGhlIHVzZXInc1xuLy8gY2FsbGJhY2tzLiBPbiBjb25zdHJ1Y3Rpb24sIGl0IHJlZ2lzdGVycyBpdHNlbGYgaW4gdGhlIGNvbm5lY3Rpb24nc1xuLy8gX21ldGhvZEludm9rZXJzIG1hcDsgaXQgcmVtb3ZlcyBpdHNlbGYgb25jZSB0aGUgbWV0aG9kIGlzIGZ1bGx5IGZpbmlzaGVkIGFuZFxuLy8gdGhlIGNhbGxiYWNrIGlzIGludm9rZWQuIFRoaXMgb2NjdXJzIHdoZW4gaXQgaGFzIGJvdGggcmVjZWl2ZWQgYSByZXN1bHQsXG4vLyBhbmQgdGhlIGRhdGEgd3JpdHRlbiBieSBpdCBpcyBmdWxseSB2aXNpYmxlLlxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWV0aG9kSW52b2tlciB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICAvLyBQdWJsaWMgKHdpdGhpbiB0aGlzIGZpbGUpIGZpZWxkcy5cbiAgICB0aGlzLm1ldGhvZElkID0gb3B0aW9ucy5tZXRob2RJZDtcbiAgICB0aGlzLnNlbnRNZXNzYWdlID0gZmFsc2U7XG5cbiAgICB0aGlzLl9jYWxsYmFjayA9IG9wdGlvbnMuY2FsbGJhY2s7XG4gICAgdGhpcy5fY29ubmVjdGlvbiA9IG9wdGlvbnMuY29ubmVjdGlvbjtcbiAgICB0aGlzLl9tZXNzYWdlID0gb3B0aW9ucy5tZXNzYWdlO1xuICAgIHRoaXMuX29uUmVzdWx0UmVjZWl2ZWQgPSBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQgfHwgKCgpID0+IHt9KTtcbiAgICB0aGlzLl93YWl0ID0gb3B0aW9ucy53YWl0O1xuICAgIHRoaXMubm9SZXRyeSA9IG9wdGlvbnMubm9SZXRyeTtcbiAgICB0aGlzLl9tZXRob2RSZXN1bHQgPSBudWxsO1xuICAgIHRoaXMuX2RhdGFWaXNpYmxlID0gZmFsc2U7XG5cbiAgICAvLyBSZWdpc3RlciB3aXRoIHRoZSBjb25uZWN0aW9uLlxuICAgIHRoaXMuX2Nvbm5lY3Rpb24uX21ldGhvZEludm9rZXJzW3RoaXMubWV0aG9kSWRdID0gdGhpcztcbiAgfVxuICAvLyBTZW5kcyB0aGUgbWV0aG9kIG1lc3NhZ2UgdG8gdGhlIHNlcnZlci4gTWF5IGJlIGNhbGxlZCBhZGRpdGlvbmFsIHRpbWVzIGlmXG4gIC8vIHdlIGxvc2UgdGhlIGNvbm5lY3Rpb24gYW5kIHJlY29ubmVjdCBiZWZvcmUgcmVjZWl2aW5nIGEgcmVzdWx0LlxuICBzZW5kTWVzc2FnZSgpIHtcbiAgICAvLyBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBiZWZvcmUgc2VuZGluZyBhIG1ldGhvZCAoaW5jbHVkaW5nIHJlc2VuZGluZyBvblxuICAgIC8vIHJlY29ubmVjdCkuIFdlIHNob3VsZCBvbmx5IChyZSlzZW5kIG1ldGhvZHMgd2hlcmUgd2UgZG9uJ3QgYWxyZWFkeSBoYXZlIGFcbiAgICAvLyByZXN1bHQhXG4gICAgaWYgKHRoaXMuZ290UmVzdWx0KCkpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3NlbmRpbmdNZXRob2QgaXMgY2FsbGVkIG9uIG1ldGhvZCB3aXRoIHJlc3VsdCcpO1xuXG4gICAgLy8gSWYgd2UncmUgcmUtc2VuZGluZyBpdCwgaXQgZG9lc24ndCBtYXR0ZXIgaWYgZGF0YSB3YXMgd3JpdHRlbiB0aGUgZmlyc3RcbiAgICAvLyB0aW1lLlxuICAgIHRoaXMuX2RhdGFWaXNpYmxlID0gZmFsc2U7XG4gICAgdGhpcy5zZW50TWVzc2FnZSA9IHRydWU7XG5cbiAgICAvLyBJZiB0aGlzIGlzIGEgd2FpdCBtZXRob2QsIG1ha2UgYWxsIGRhdGEgbWVzc2FnZXMgYmUgYnVmZmVyZWQgdW50aWwgaXQgaXNcbiAgICAvLyBkb25lLlxuICAgIGlmICh0aGlzLl93YWl0KVxuICAgICAgdGhpcy5fY29ubmVjdGlvbi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZVt0aGlzLm1ldGhvZElkXSA9IHRydWU7XG5cbiAgICAvLyBBY3R1YWxseSBzZW5kIHRoZSBtZXNzYWdlLlxuICAgIHRoaXMuX2Nvbm5lY3Rpb24uX3NlbmQodGhpcy5fbWVzc2FnZSk7XG4gIH1cbiAgLy8gSW52b2tlIHRoZSBjYWxsYmFjaywgaWYgd2UgaGF2ZSBib3RoIGEgcmVzdWx0IGFuZCBrbm93IHRoYXQgYWxsIGRhdGEgaGFzXG4gIC8vIGJlZW4gd3JpdHRlbiB0byB0aGUgbG9jYWwgY2FjaGUuXG4gIF9tYXliZUludm9rZUNhbGxiYWNrKCkge1xuICAgIGlmICh0aGlzLl9tZXRob2RSZXN1bHQgJiYgdGhpcy5fZGF0YVZpc2libGUpIHtcbiAgICAgIC8vIENhbGwgdGhlIGNhbGxiYWNrLiAoVGhpcyB3b24ndCB0aHJvdzogdGhlIGNhbGxiYWNrIHdhcyB3cmFwcGVkIHdpdGhcbiAgICAgIC8vIGJpbmRFbnZpcm9ubWVudC4pXG4gICAgICB0aGlzLl9jYWxsYmFjayh0aGlzLl9tZXRob2RSZXN1bHRbMF0sIHRoaXMuX21ldGhvZFJlc3VsdFsxXSk7XG5cbiAgICAgIC8vIEZvcmdldCBhYm91dCB0aGlzIG1ldGhvZC5cbiAgICAgIGRlbGV0ZSB0aGlzLl9jb25uZWN0aW9uLl9tZXRob2RJbnZva2Vyc1t0aGlzLm1ldGhvZElkXTtcblxuICAgICAgLy8gTGV0IHRoZSBjb25uZWN0aW9uIGtub3cgdGhhdCB0aGlzIG1ldGhvZCBpcyBmaW5pc2hlZCwgc28gaXQgY2FuIHRyeSB0b1xuICAgICAgLy8gbW92ZSBvbiB0byB0aGUgbmV4dCBibG9jayBvZiBtZXRob2RzLlxuICAgICAgdGhpcy5fY29ubmVjdGlvbi5fb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZCgpO1xuICAgIH1cbiAgfVxuICAvLyBDYWxsIHdpdGggdGhlIHJlc3VsdCBvZiB0aGUgbWV0aG9kIGZyb20gdGhlIHNlcnZlci4gT25seSBtYXkgYmUgY2FsbGVkXG4gIC8vIG9uY2U7IG9uY2UgaXQgaXMgY2FsbGVkLCB5b3Ugc2hvdWxkIG5vdCBjYWxsIHNlbmRNZXNzYWdlIGFnYWluLlxuICAvLyBJZiB0aGUgdXNlciBwcm92aWRlZCBhbiBvblJlc3VsdFJlY2VpdmVkIGNhbGxiYWNrLCBjYWxsIGl0IGltbWVkaWF0ZWx5LlxuICAvLyBUaGVuIGludm9rZSB0aGUgbWFpbiBjYWxsYmFjayBpZiBkYXRhIGlzIGFsc28gdmlzaWJsZS5cbiAgcmVjZWl2ZVJlc3VsdChlcnIsIHJlc3VsdCkge1xuICAgIGlmICh0aGlzLmdvdFJlc3VsdCgpKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2RzIHNob3VsZCBvbmx5IHJlY2VpdmUgcmVzdWx0cyBvbmNlJyk7XG4gICAgdGhpcy5fbWV0aG9kUmVzdWx0ID0gW2VyciwgcmVzdWx0XTtcbiAgICB0aGlzLl9vblJlc3VsdFJlY2VpdmVkKGVyciwgcmVzdWx0KTtcbiAgICB0aGlzLl9tYXliZUludm9rZUNhbGxiYWNrKCk7XG4gIH1cbiAgLy8gQ2FsbCB0aGlzIHdoZW4gYWxsIGRhdGEgd3JpdHRlbiBieSB0aGUgbWV0aG9kIGlzIHZpc2libGUuIFRoaXMgbWVhbnMgdGhhdFxuICAvLyB0aGUgbWV0aG9kIGhhcyByZXR1cm5zIGl0cyBcImRhdGEgaXMgZG9uZVwiIG1lc3NhZ2UgKkFORCogYWxsIHNlcnZlclxuICAvLyBkb2N1bWVudHMgdGhhdCBhcmUgYnVmZmVyZWQgYXQgdGhhdCB0aW1lIGhhdmUgYmVlbiB3cml0dGVuIHRvIHRoZSBsb2NhbFxuICAvLyBjYWNoZS4gSW52b2tlcyB0aGUgbWFpbiBjYWxsYmFjayBpZiB0aGUgcmVzdWx0IGhhcyBiZWVuIHJlY2VpdmVkLlxuICBkYXRhVmlzaWJsZSgpIHtcbiAgICB0aGlzLl9kYXRhVmlzaWJsZSA9IHRydWU7XG4gICAgdGhpcy5fbWF5YmVJbnZva2VDYWxsYmFjaygpO1xuICB9XG4gIC8vIFRydWUgaWYgcmVjZWl2ZVJlc3VsdCBoYXMgYmVlbiBjYWxsZWQuXG4gIGdvdFJlc3VsdCgpIHtcbiAgICByZXR1cm4gISF0aGlzLl9tZXRob2RSZXN1bHQ7XG4gIH1cbn1cbiIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgRERQQ29tbW9uIH0gZnJvbSAnbWV0ZW9yL2RkcC1jb21tb24nO1xuaW1wb3J0IHsgVHJhY2tlciB9IGZyb20gJ21ldGVvci90cmFja2VyJztcbmltcG9ydCB7IEVKU09OIH0gZnJvbSAnbWV0ZW9yL2Vqc29uJztcbmltcG9ydCB7IFJhbmRvbSB9IGZyb20gJ21ldGVvci9yYW5kb20nO1xuaW1wb3J0IHsgSG9vayB9IGZyb20gJ21ldGVvci9jYWxsYmFjay1ob29rJztcbmltcG9ydCB7IE1vbmdvSUQgfSBmcm9tICdtZXRlb3IvbW9uZ28taWQnO1xuaW1wb3J0IHsgRERQIH0gZnJvbSAnLi9uYW1lc3BhY2UuanMnO1xuaW1wb3J0IE1ldGhvZEludm9rZXIgZnJvbSAnLi9NZXRob2RJbnZva2VyLmpzJztcbmltcG9ydCB7XG4gIGhhc093bixcbiAgc2xpY2UsXG4gIGtleXMsXG4gIGlzRW1wdHksXG4gIGxhc3QsXG59IGZyb20gXCJtZXRlb3IvZGRwLWNvbW1vbi91dGlscy5qc1wiO1xuXG5jbGFzcyBNb25nb0lETWFwIGV4dGVuZHMgSWRNYXAge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihNb25nb0lELmlkU3RyaW5naWZ5LCBNb25nb0lELmlkUGFyc2UpO1xuICB9XG59XG5cbi8vIEBwYXJhbSB1cmwge1N0cmluZ3xPYmplY3R9IFVSTCB0byBNZXRlb3IgYXBwLFxuLy8gICBvciBhbiBvYmplY3QgYXMgYSB0ZXN0IGhvb2sgKHNlZSBjb2RlKVxuLy8gT3B0aW9uczpcbi8vICAgcmVsb2FkV2l0aE91dHN0YW5kaW5nOiBpcyBpdCBPSyB0byByZWxvYWQgaWYgdGhlcmUgYXJlIG91dHN0YW5kaW5nIG1ldGhvZHM/XG4vLyAgIGhlYWRlcnM6IGV4dHJhIGhlYWRlcnMgdG8gc2VuZCBvbiB0aGUgd2Vic29ja2V0cyBjb25uZWN0aW9uLCBmb3Jcbi8vICAgICBzZXJ2ZXItdG8tc2VydmVyIEREUCBvbmx5XG4vLyAgIF9zb2NranNPcHRpb25zOiBTcGVjaWZpZXMgb3B0aW9ucyB0byBwYXNzIHRocm91Z2ggdG8gdGhlIHNvY2tqcyBjbGllbnRcbi8vICAgb25ERFBOZWdvdGlhdGlvblZlcnNpb25GYWlsdXJlOiBjYWxsYmFjayB3aGVuIHZlcnNpb24gbmVnb3RpYXRpb24gZmFpbHMuXG4vL1xuLy8gWFhYIFRoZXJlIHNob3VsZCBiZSBhIHdheSB0byBkZXN0cm95IGEgRERQIGNvbm5lY3Rpb24sIGNhdXNpbmcgYWxsXG4vLyBvdXRzdGFuZGluZyBtZXRob2QgY2FsbHMgdG8gZmFpbC5cbi8vXG4vLyBYWFggT3VyIGN1cnJlbnQgd2F5IG9mIGhhbmRsaW5nIGZhaWx1cmUgYW5kIHJlY29ubmVjdGlvbiBpcyBncmVhdFxuLy8gZm9yIGFuIGFwcCAod2hlcmUgd2Ugd2FudCB0byB0b2xlcmF0ZSBiZWluZyBkaXNjb25uZWN0ZWQgYXMgYW5cbi8vIGV4cGVjdCBzdGF0ZSwgYW5kIGtlZXAgdHJ5aW5nIGZvcmV2ZXIgdG8gcmVjb25uZWN0KSBidXQgY3VtYmVyc29tZVxuLy8gZm9yIHNvbWV0aGluZyBsaWtlIGEgY29tbWFuZCBsaW5lIHRvb2wgdGhhdCB3YW50cyB0byBtYWtlIGFcbi8vIGNvbm5lY3Rpb24sIGNhbGwgYSBtZXRob2QsIGFuZCBwcmludCBhbiBlcnJvciBpZiBjb25uZWN0aW9uXG4vLyBmYWlscy4gV2Ugc2hvdWxkIGhhdmUgYmV0dGVyIHVzYWJpbGl0eSBpbiB0aGUgbGF0dGVyIGNhc2UgKHdoaWxlXG4vLyBzdGlsbCB0cmFuc3BhcmVudGx5IHJlY29ubmVjdGluZyBpZiBpdCdzIGp1c3QgYSB0cmFuc2llbnQgZmFpbHVyZVxuLy8gb3IgdGhlIHNlcnZlciBtaWdyYXRpbmcgdXMpLlxuZXhwb3J0IGNsYXNzIENvbm5lY3Rpb24ge1xuICBjb25zdHJ1Y3Rvcih1cmwsIG9wdGlvbnMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgPSB7XG4gICAgICBvbkNvbm5lY3RlZCgpIHt9LFxuICAgICAgb25ERFBWZXJzaW9uTmVnb3RpYXRpb25GYWlsdXJlKGRlc2NyaXB0aW9uKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoZGVzY3JpcHRpb24pO1xuICAgICAgfSxcbiAgICAgIGhlYXJ0YmVhdEludGVydmFsOiAxNzUwMCxcbiAgICAgIGhlYXJ0YmVhdFRpbWVvdXQ6IDE1MDAwLFxuICAgICAgbnBtRmF5ZU9wdGlvbnM6IE9iamVjdC5jcmVhdGUobnVsbCksXG4gICAgICAvLyBUaGVzZSBvcHRpb25zIGFyZSBvbmx5IGZvciB0ZXN0aW5nLlxuICAgICAgcmVsb2FkV2l0aE91dHN0YW5kaW5nOiBmYWxzZSxcbiAgICAgIHN1cHBvcnRlZEREUFZlcnNpb25zOiBERFBDb21tb24uU1VQUE9SVEVEX0REUF9WRVJTSU9OUyxcbiAgICAgIHJldHJ5OiB0cnVlLFxuICAgICAgcmVzcG9uZFRvUGluZ3M6IHRydWUsXG4gICAgICAvLyBXaGVuIHVwZGF0ZXMgYXJlIGNvbWluZyB3aXRoaW4gdGhpcyBtcyBpbnRlcnZhbCwgYmF0Y2ggdGhlbSB0b2dldGhlci5cbiAgICAgIGJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWw6IDUsXG4gICAgICAvLyBGbHVzaCBidWZmZXJzIGltbWVkaWF0ZWx5IGlmIHdyaXRlcyBhcmUgaGFwcGVuaW5nIGNvbnRpbnVvdXNseSBmb3IgbW9yZSB0aGFuIHRoaXMgbWFueSBtcy5cbiAgICAgIGJ1ZmZlcmVkV3JpdGVzTWF4QWdlOiA1MDAsXG5cbiAgICAgIC4uLm9wdGlvbnNcbiAgICB9O1xuXG4gICAgLy8gSWYgc2V0LCBjYWxsZWQgd2hlbiB3ZSByZWNvbm5lY3QsIHF1ZXVpbmcgbWV0aG9kIGNhbGxzIF9iZWZvcmVfIHRoZVxuICAgIC8vIGV4aXN0aW5nIG91dHN0YW5kaW5nIG9uZXMuXG4gICAgLy8gTk9URTogVGhpcyBmZWF0dXJlIGhhcyBiZWVuIHByZXNlcnZlZCBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuIFRoZVxuICAgIC8vIHByZWZlcnJlZCBtZXRob2Qgb2Ygc2V0dGluZyBhIGNhbGxiYWNrIG9uIHJlY29ubmVjdCBpcyB0byB1c2VcbiAgICAvLyBERFAub25SZWNvbm5lY3QuXG4gICAgc2VsZi5vblJlY29ubmVjdCA9IG51bGw7XG5cbiAgICAvLyBhcyBhIHRlc3QgaG9vaywgYWxsb3cgcGFzc2luZyBhIHN0cmVhbSBpbnN0ZWFkIG9mIGEgdXJsLlxuICAgIGlmICh0eXBlb2YgdXJsID09PSAnb2JqZWN0Jykge1xuICAgICAgc2VsZi5fc3RyZWFtID0gdXJsO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7IENsaWVudFN0cmVhbSB9ID0gcmVxdWlyZShcIm1ldGVvci9zb2NrZXQtc3RyZWFtLWNsaWVudFwiKTtcbiAgICAgIHNlbGYuX3N0cmVhbSA9IG5ldyBDbGllbnRTdHJlYW0odXJsLCB7XG4gICAgICAgIHJldHJ5OiBvcHRpb25zLnJldHJ5LFxuICAgICAgICBDb25uZWN0aW9uRXJyb3I6IEREUC5Db25uZWN0aW9uRXJyb3IsXG4gICAgICAgIGhlYWRlcnM6IG9wdGlvbnMuaGVhZGVycyxcbiAgICAgICAgX3NvY2tqc09wdGlvbnM6IG9wdGlvbnMuX3NvY2tqc09wdGlvbnMsXG4gICAgICAgIC8vIFVzZWQgdG8ga2VlcCBzb21lIHRlc3RzIHF1aWV0LCBvciBmb3Igb3RoZXIgY2FzZXMgaW4gd2hpY2hcbiAgICAgICAgLy8gdGhlIHJpZ2h0IHRoaW5nIHRvIGRvIHdpdGggY29ubmVjdGlvbiBlcnJvcnMgaXMgdG8gc2lsZW50bHlcbiAgICAgICAgLy8gZmFpbCAoZS5nLiBzZW5kaW5nIHBhY2thZ2UgdXNhZ2Ugc3RhdHMpLiBBdCBzb21lIHBvaW50IHdlXG4gICAgICAgIC8vIHNob3VsZCBoYXZlIGEgcmVhbCBBUEkgZm9yIGhhbmRsaW5nIGNsaWVudC1zdHJlYW0tbGV2ZWxcbiAgICAgICAgLy8gZXJyb3JzLlxuICAgICAgICBfZG9udFByaW50RXJyb3JzOiBvcHRpb25zLl9kb250UHJpbnRFcnJvcnMsXG4gICAgICAgIGNvbm5lY3RUaW1lb3V0TXM6IG9wdGlvbnMuY29ubmVjdFRpbWVvdXRNcyxcbiAgICAgICAgbnBtRmF5ZU9wdGlvbnM6IG9wdGlvbnMubnBtRmF5ZU9wdGlvbnNcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbGYuX2xhc3RTZXNzaW9uSWQgPSBudWxsO1xuICAgIHNlbGYuX3ZlcnNpb25TdWdnZXN0aW9uID0gbnVsbDsgLy8gVGhlIGxhc3QgcHJvcG9zZWQgRERQIHZlcnNpb24uXG4gICAgc2VsZi5fdmVyc2lvbiA9IG51bGw7IC8vIFRoZSBERFAgdmVyc2lvbiBhZ3JlZWQgb24gYnkgY2xpZW50IGFuZCBzZXJ2ZXIuXG4gICAgc2VsZi5fc3RvcmVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTsgLy8gbmFtZSAtPiBvYmplY3Qgd2l0aCBtZXRob2RzXG4gICAgc2VsZi5fbWV0aG9kSGFuZGxlcnMgPSBPYmplY3QuY3JlYXRlKG51bGwpOyAvLyBuYW1lIC0+IGZ1bmNcbiAgICBzZWxmLl9uZXh0TWV0aG9kSWQgPSAxO1xuICAgIHNlbGYuX3N1cHBvcnRlZEREUFZlcnNpb25zID0gb3B0aW9ucy5zdXBwb3J0ZWRERFBWZXJzaW9ucztcblxuICAgIHNlbGYuX2hlYXJ0YmVhdEludGVydmFsID0gb3B0aW9ucy5oZWFydGJlYXRJbnRlcnZhbDtcbiAgICBzZWxmLl9oZWFydGJlYXRUaW1lb3V0ID0gb3B0aW9ucy5oZWFydGJlYXRUaW1lb3V0O1xuXG4gICAgLy8gVHJhY2tzIG1ldGhvZHMgd2hpY2ggdGhlIHVzZXIgaGFzIHRyaWVkIHRvIGNhbGwgYnV0IHdoaWNoIGhhdmUgbm90IHlldFxuICAgIC8vIGNhbGxlZCB0aGVpciB1c2VyIGNhbGxiYWNrIChpZSwgdGhleSBhcmUgd2FpdGluZyBvbiB0aGVpciByZXN1bHQgb3IgZm9yIGFsbFxuICAgIC8vIG9mIHRoZWlyIHdyaXRlcyB0byBiZSB3cml0dGVuIHRvIHRoZSBsb2NhbCBjYWNoZSkuIE1hcCBmcm9tIG1ldGhvZCBJRCB0b1xuICAgIC8vIE1ldGhvZEludm9rZXIgb2JqZWN0LlxuICAgIHNlbGYuX21ldGhvZEludm9rZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIC8vIFRyYWNrcyBtZXRob2RzIHdoaWNoIHRoZSB1c2VyIGhhcyBjYWxsZWQgYnV0IHdob3NlIHJlc3VsdCBtZXNzYWdlcyBoYXZlIG5vdFxuICAgIC8vIGFycml2ZWQgeWV0LlxuICAgIC8vXG4gICAgLy8gX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzIGlzIGFuIGFycmF5IG9mIGJsb2NrcyBvZiBtZXRob2RzLiBFYWNoIGJsb2NrXG4gICAgLy8gcmVwcmVzZW50cyBhIHNldCBvZiBtZXRob2RzIHRoYXQgY2FuIHJ1biBhdCB0aGUgc2FtZSB0aW1lLiBUaGUgZmlyc3QgYmxvY2tcbiAgICAvLyByZXByZXNlbnRzIHRoZSBtZXRob2RzIHdoaWNoIGFyZSBjdXJyZW50bHkgaW4gZmxpZ2h0OyBzdWJzZXF1ZW50IGJsb2Nrc1xuICAgIC8vIG11c3Qgd2FpdCBmb3IgcHJldmlvdXMgYmxvY2tzIHRvIGJlIGZ1bGx5IGZpbmlzaGVkIGJlZm9yZSB0aGV5IGNhbiBiZSBzZW50XG4gICAgLy8gdG8gdGhlIHNlcnZlci5cbiAgICAvL1xuICAgIC8vIEVhY2ggYmxvY2sgaXMgYW4gb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZyBmaWVsZHM6XG4gICAgLy8gLSBtZXRob2RzOiBhIGxpc3Qgb2YgTWV0aG9kSW52b2tlciBvYmplY3RzXG4gICAgLy8gLSB3YWl0OiBhIGJvb2xlYW47IGlmIHRydWUsIHRoaXMgYmxvY2sgaGFkIGEgc2luZ2xlIG1ldGhvZCBpbnZva2VkIHdpdGhcbiAgICAvLyAgICAgICAgIHRoZSBcIndhaXRcIiBvcHRpb25cbiAgICAvL1xuICAgIC8vIFRoZXJlIHdpbGwgbmV2ZXIgYmUgYWRqYWNlbnQgYmxvY2tzIHdpdGggd2FpdD1mYWxzZSwgYmVjYXVzZSB0aGUgb25seSB0aGluZ1xuICAgIC8vIHRoYXQgbWFrZXMgbWV0aG9kcyBuZWVkIHRvIGJlIHNlcmlhbGl6ZWQgaXMgYSB3YWl0IG1ldGhvZC5cbiAgICAvL1xuICAgIC8vIE1ldGhvZHMgYXJlIHJlbW92ZWQgZnJvbSB0aGUgZmlyc3QgYmxvY2sgd2hlbiB0aGVpciBcInJlc3VsdFwiIGlzXG4gICAgLy8gcmVjZWl2ZWQuIFRoZSBlbnRpcmUgZmlyc3QgYmxvY2sgaXMgb25seSByZW1vdmVkIHdoZW4gYWxsIG9mIHRoZSBpbi1mbGlnaHRcbiAgICAvLyBtZXRob2RzIGhhdmUgcmVjZWl2ZWQgdGhlaXIgcmVzdWx0cyAoc28gdGhlIFwibWV0aG9kc1wiIGxpc3QgaXMgZW1wdHkpICpBTkQqXG4gICAgLy8gYWxsIG9mIHRoZSBkYXRhIHdyaXR0ZW4gYnkgdGhvc2UgbWV0aG9kcyBhcmUgdmlzaWJsZSBpbiB0aGUgbG9jYWwgY2FjaGUuIFNvXG4gICAgLy8gaXQgaXMgcG9zc2libGUgZm9yIHRoZSBmaXJzdCBibG9jaydzIG1ldGhvZHMgbGlzdCB0byBiZSBlbXB0eSwgaWYgd2UgYXJlXG4gICAgLy8gc3RpbGwgd2FpdGluZyBmb3Igc29tZSBvYmplY3RzIHRvIHF1aWVzY2UuXG4gICAgLy9cbiAgICAvLyBFeGFtcGxlOlxuICAgIC8vICBfb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXG4gICAgLy8gICAge3dhaXQ6IGZhbHNlLCBtZXRob2RzOiBbXX0sXG4gICAgLy8gICAge3dhaXQ6IHRydWUsIG1ldGhvZHM6IFs8TWV0aG9kSW52b2tlciBmb3IgJ2xvZ2luJz5dfSxcbiAgICAvLyAgICB7d2FpdDogZmFsc2UsIG1ldGhvZHM6IFs8TWV0aG9kSW52b2tlciBmb3IgJ2Zvbyc+LFxuICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxNZXRob2RJbnZva2VyIGZvciAnYmFyJz5dfV1cbiAgICAvLyBUaGlzIG1lYW5zIHRoYXQgdGhlcmUgd2VyZSBzb21lIG1ldGhvZHMgd2hpY2ggd2VyZSBzZW50IHRvIHRoZSBzZXJ2ZXIgYW5kXG4gICAgLy8gd2hpY2ggaGF2ZSByZXR1cm5lZCB0aGVpciByZXN1bHRzLCBidXQgc29tZSBvZiB0aGUgZGF0YSB3cml0dGVuIGJ5XG4gICAgLy8gdGhlIG1ldGhvZHMgbWF5IG5vdCBiZSB2aXNpYmxlIGluIHRoZSBsb2NhbCBjYWNoZS4gT25jZSBhbGwgdGhhdCBkYXRhIGlzXG4gICAgLy8gdmlzaWJsZSwgd2Ugd2lsbCBzZW5kIGEgJ2xvZ2luJyBtZXRob2QuIE9uY2UgdGhlIGxvZ2luIG1ldGhvZCBoYXMgcmV0dXJuZWRcbiAgICAvLyBhbmQgYWxsIHRoZSBkYXRhIGlzIHZpc2libGUgKGluY2x1ZGluZyByZS1ydW5uaW5nIHN1YnMgaWYgdXNlcklkIGNoYW5nZXMpLFxuICAgIC8vIHdlIHdpbGwgc2VuZCB0aGUgJ2ZvbycgYW5kICdiYXInIG1ldGhvZHMgaW4gcGFyYWxsZWwuXG4gICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXTtcblxuICAgIC8vIG1ldGhvZCBJRCAtPiBhcnJheSBvZiBvYmplY3RzIHdpdGgga2V5cyAnY29sbGVjdGlvbicgYW5kICdpZCcsIGxpc3RpbmdcbiAgICAvLyBkb2N1bWVudHMgd3JpdHRlbiBieSBhIGdpdmVuIG1ldGhvZCdzIHN0dWIuIGtleXMgYXJlIGFzc29jaWF0ZWQgd2l0aFxuICAgIC8vIG1ldGhvZHMgd2hvc2Ugc3R1YiB3cm90ZSBhdCBsZWFzdCBvbmUgZG9jdW1lbnQsIGFuZCB3aG9zZSBkYXRhLWRvbmUgbWVzc2FnZVxuICAgIC8vIGhhcyBub3QgeWV0IGJlZW4gcmVjZWl2ZWQuXG4gICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiA9IHt9O1xuICAgIC8vIGNvbGxlY3Rpb24gLT4gSWRNYXAgb2YgXCJzZXJ2ZXIgZG9jdW1lbnRcIiBvYmplY3QuIEEgXCJzZXJ2ZXIgZG9jdW1lbnRcIiBoYXM6XG4gICAgLy8gLSBcImRvY3VtZW50XCI6IHRoZSB2ZXJzaW9uIG9mIHRoZSBkb2N1bWVudCBhY2NvcmRpbmcgdGhlXG4gICAgLy8gICBzZXJ2ZXIgKGllLCB0aGUgc25hcHNob3QgYmVmb3JlIGEgc3R1YiB3cm90ZSBpdCwgYW1lbmRlZCBieSBhbnkgY2hhbmdlc1xuICAgIC8vICAgcmVjZWl2ZWQgZnJvbSB0aGUgc2VydmVyKVxuICAgIC8vICAgSXQgaXMgdW5kZWZpbmVkIGlmIHdlIHRoaW5rIHRoZSBkb2N1bWVudCBkb2VzIG5vdCBleGlzdFxuICAgIC8vIC0gXCJ3cml0dGVuQnlTdHVic1wiOiBhIHNldCBvZiBtZXRob2QgSURzIHdob3NlIHN0dWJzIHdyb3RlIHRvIHRoZSBkb2N1bWVudFxuICAgIC8vICAgd2hvc2UgXCJkYXRhIGRvbmVcIiBtZXNzYWdlcyBoYXZlIG5vdCB5ZXQgYmVlbiBwcm9jZXNzZWRcbiAgICBzZWxmLl9zZXJ2ZXJEb2N1bWVudHMgPSB7fTtcblxuICAgIC8vIEFycmF5IG9mIGNhbGxiYWNrcyB0byBiZSBjYWxsZWQgYWZ0ZXIgdGhlIG5leHQgdXBkYXRlIG9mIHRoZSBsb2NhbFxuICAgIC8vIGNhY2hlLiBVc2VkIGZvcjpcbiAgICAvLyAgLSBDYWxsaW5nIG1ldGhvZEludm9rZXIuZGF0YVZpc2libGUgYW5kIHN1YiByZWFkeSBjYWxsYmFja3MgYWZ0ZXJcbiAgICAvLyAgICB0aGUgcmVsZXZhbnQgZGF0YSBpcyBmbHVzaGVkLlxuICAgIC8vICAtIEludm9raW5nIHRoZSBjYWxsYmFja3Mgb2YgXCJoYWxmLWZpbmlzaGVkXCIgbWV0aG9kcyBhZnRlciByZWNvbm5lY3RcbiAgICAvLyAgICBxdWllc2NlbmNlLiBTcGVjaWZpY2FsbHksIG1ldGhvZHMgd2hvc2UgcmVzdWx0IHdhcyByZWNlaXZlZCBvdmVyIHRoZSBvbGRcbiAgICAvLyAgICBjb25uZWN0aW9uIChzbyB3ZSBkb24ndCByZS1zZW5kIGl0KSBidXQgd2hvc2UgZGF0YSBoYWQgbm90IGJlZW4gbWFkZVxuICAgIC8vICAgIHZpc2libGUuXG4gICAgc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3MgPSBbXTtcblxuICAgIC8vIEluIHR3byBjb250ZXh0cywgd2UgYnVmZmVyIGFsbCBpbmNvbWluZyBkYXRhIG1lc3NhZ2VzIGFuZCB0aGVuIHByb2Nlc3MgdGhlbVxuICAgIC8vIGFsbCBhdCBvbmNlIGluIGEgc2luZ2xlIHVwZGF0ZTpcbiAgICAvLyAgIC0gRHVyaW5nIHJlY29ubmVjdCwgd2UgYnVmZmVyIGFsbCBkYXRhIG1lc3NhZ2VzIHVudGlsIGFsbCBzdWJzIHRoYXQgaGFkXG4gICAgLy8gICAgIGJlZW4gcmVhZHkgYmVmb3JlIHJlY29ubmVjdCBhcmUgcmVhZHkgYWdhaW4sIGFuZCBhbGwgbWV0aG9kcyB0aGF0IGFyZVxuICAgIC8vICAgICBhY3RpdmUgaGF2ZSByZXR1cm5lZCB0aGVpciBcImRhdGEgZG9uZSBtZXNzYWdlXCI7IHRoZW5cbiAgICAvLyAgIC0gRHVyaW5nIHRoZSBleGVjdXRpb24gb2YgYSBcIndhaXRcIiBtZXRob2QsIHdlIGJ1ZmZlciBhbGwgZGF0YSBtZXNzYWdlc1xuICAgIC8vICAgICB1bnRpbCB0aGUgd2FpdCBtZXRob2QgZ2V0cyBpdHMgXCJkYXRhIGRvbmVcIiBtZXNzYWdlLiAoSWYgdGhlIHdhaXQgbWV0aG9kXG4gICAgLy8gICAgIG9jY3VycyBkdXJpbmcgcmVjb25uZWN0LCBpdCBkb2Vzbid0IGdldCBhbnkgc3BlY2lhbCBoYW5kbGluZy4pXG4gICAgLy8gYWxsIGRhdGEgbWVzc2FnZXMgYXJlIHByb2Nlc3NlZCBpbiBvbmUgdXBkYXRlLlxuICAgIC8vXG4gICAgLy8gVGhlIGZvbGxvd2luZyBmaWVsZHMgYXJlIHVzZWQgZm9yIHRoaXMgXCJxdWllc2NlbmNlXCIgcHJvY2Vzcy5cblxuICAgIC8vIFRoaXMgYnVmZmVycyB0aGUgbWVzc2FnZXMgdGhhdCBhcmVuJ3QgYmVpbmcgcHJvY2Vzc2VkIHlldC5cbiAgICBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlID0gW107XG4gICAgLy8gTWFwIGZyb20gbWV0aG9kIElEIC0+IHRydWUuIE1ldGhvZHMgYXJlIHJlbW92ZWQgZnJvbSB0aGlzIHdoZW4gdGhlaXJcbiAgICAvLyBcImRhdGEgZG9uZVwiIG1lc3NhZ2UgaXMgcmVjZWl2ZWQsIGFuZCB3ZSB3aWxsIG5vdCBxdWllc2NlIHVudGlsIGl0IGlzXG4gICAgLy8gZW1wdHkuXG4gICAgc2VsZi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSA9IHt9O1xuICAgIC8vIG1hcCBmcm9tIHN1YiBJRCAtPiB0cnVlIGZvciBzdWJzIHRoYXQgd2VyZSByZWFkeSAoaWUsIGNhbGxlZCB0aGUgc3ViXG4gICAgLy8gcmVhZHkgY2FsbGJhY2spIGJlZm9yZSByZWNvbm5lY3QgYnV0IGhhdmVuJ3QgYmVjb21lIHJlYWR5IGFnYWluIHlldFxuICAgIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWQgPSB7fTsgLy8gbWFwIGZyb20gc3ViLl9pZCAtPiB0cnVlXG4gICAgLy8gaWYgdHJ1ZSwgdGhlIG5leHQgZGF0YSB1cGRhdGUgc2hvdWxkIHJlc2V0IGFsbCBzdG9yZXMuIChzZXQgZHVyaW5nXG4gICAgLy8gcmVjb25uZWN0LilcbiAgICBzZWxmLl9yZXNldFN0b3JlcyA9IGZhbHNlO1xuXG4gICAgLy8gbmFtZSAtPiBhcnJheSBvZiB1cGRhdGVzIGZvciAoeWV0IHRvIGJlIGNyZWF0ZWQpIGNvbGxlY3Rpb25zXG4gICAgc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXMgPSB7fTtcbiAgICAvLyBpZiB3ZSdyZSBibG9ja2luZyBhIG1pZ3JhdGlvbiwgdGhlIHJldHJ5IGZ1bmNcbiAgICBzZWxmLl9yZXRyeU1pZ3JhdGUgPSBudWxsO1xuXG4gICAgc2VsZi5fX2ZsdXNoQnVmZmVyZWRXcml0ZXMgPSBNZXRlb3IuYmluZEVudmlyb25tZW50KFxuICAgICAgc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlcyxcbiAgICAgICdmbHVzaGluZyBERFAgYnVmZmVyZWQgd3JpdGVzJyxcbiAgICAgIHNlbGZcbiAgICApO1xuICAgIC8vIENvbGxlY3Rpb24gbmFtZSAtPiBhcnJheSBvZiBtZXNzYWdlcy5cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlcyA9IHt9O1xuICAgIC8vIFdoZW4gY3VycmVudCBidWZmZXIgb2YgdXBkYXRlcyBtdXN0IGJlIGZsdXNoZWQgYXQsIGluIG1zIHRpbWVzdGFtcC5cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPSBudWxsO1xuICAgIC8vIFRpbWVvdXQgaGFuZGxlIGZvciB0aGUgbmV4dCBwcm9jZXNzaW5nIG9mIGFsbCBwZW5kaW5nIHdyaXRlc1xuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUgPSBudWxsO1xuXG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNJbnRlcnZhbCA9IG9wdGlvbnMuYnVmZmVyZWRXcml0ZXNJbnRlcnZhbDtcbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc01heEFnZSA9IG9wdGlvbnMuYnVmZmVyZWRXcml0ZXNNYXhBZ2U7XG5cbiAgICAvLyBtZXRhZGF0YSBmb3Igc3Vic2NyaXB0aW9ucy4gIE1hcCBmcm9tIHN1YiBJRCB0byBvYmplY3Qgd2l0aCBrZXlzOlxuICAgIC8vICAgLSBpZFxuICAgIC8vICAgLSBuYW1lXG4gICAgLy8gICAtIHBhcmFtc1xuICAgIC8vICAgLSBpbmFjdGl2ZSAoaWYgdHJ1ZSwgd2lsbCBiZSBjbGVhbmVkIHVwIGlmIG5vdCByZXVzZWQgaW4gcmUtcnVuKVxuICAgIC8vICAgLSByZWFkeSAoaGFzIHRoZSAncmVhZHknIG1lc3NhZ2UgYmVlbiByZWNlaXZlZD8pXG4gICAgLy8gICAtIHJlYWR5Q2FsbGJhY2sgKGFuIG9wdGlvbmFsIGNhbGxiYWNrIHRvIGNhbGwgd2hlbiByZWFkeSlcbiAgICAvLyAgIC0gZXJyb3JDYWxsYmFjayAoYW4gb3B0aW9uYWwgY2FsbGJhY2sgdG8gY2FsbCBpZiB0aGUgc3ViIHRlcm1pbmF0ZXMgd2l0aFxuICAgIC8vICAgICAgICAgICAgICAgICAgICBhbiBlcnJvciwgWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEpXG4gICAgLy8gICAtIHN0b3BDYWxsYmFjayAoYW4gb3B0aW9uYWwgY2FsbGJhY2sgdG8gY2FsbCB3aGVuIHRoZSBzdWIgdGVybWluYXRlc1xuICAgIC8vICAgICBmb3IgYW55IHJlYXNvbiwgd2l0aCBhbiBlcnJvciBhcmd1bWVudCBpZiBhbiBlcnJvciB0cmlnZ2VyZWQgdGhlIHN0b3ApXG4gICAgc2VsZi5fc3Vic2NyaXB0aW9ucyA9IHt9O1xuXG4gICAgLy8gUmVhY3RpdmUgdXNlcklkLlxuICAgIHNlbGYuX3VzZXJJZCA9IG51bGw7XG4gICAgc2VsZi5fdXNlcklkRGVwcyA9IG5ldyBUcmFja2VyLkRlcGVuZGVuY3koKTtcblxuICAgIC8vIEJsb2NrIGF1dG8tcmVsb2FkIHdoaWxlIHdlJ3JlIHdhaXRpbmcgZm9yIG1ldGhvZCByZXNwb25zZXMuXG4gICAgaWYgKE1ldGVvci5pc0NsaWVudCAmJlxuICAgICAgUGFja2FnZS5yZWxvYWQgJiZcbiAgICAgICEgb3B0aW9ucy5yZWxvYWRXaXRoT3V0c3RhbmRpbmcpIHtcbiAgICAgIFBhY2thZ2UucmVsb2FkLlJlbG9hZC5fb25NaWdyYXRlKHJldHJ5ID0+IHtcbiAgICAgICAgaWYgKCEgc2VsZi5fcmVhZHlUb01pZ3JhdGUoKSkge1xuICAgICAgICAgIHNlbGYuX3JldHJ5TWlncmF0ZSA9IHJldHJ5O1xuICAgICAgICAgIHJldHVybiBbZmFsc2VdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBbdHJ1ZV07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IG9uRGlzY29ubmVjdCA9ICgpID0+IHtcbiAgICAgIGlmIChzZWxmLl9oZWFydGJlYXQpIHtcbiAgICAgICAgc2VsZi5faGVhcnRiZWF0LnN0b3AoKTtcbiAgICAgICAgc2VsZi5faGVhcnRiZWF0ID0gbnVsbDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKE1ldGVvci5pc1NlcnZlcikge1xuICAgICAgc2VsZi5fc3RyZWFtLm9uKFxuICAgICAgICAnbWVzc2FnZScsXG4gICAgICAgIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoXG4gICAgICAgICAgdGhpcy5vbk1lc3NhZ2UuYmluZCh0aGlzKSxcbiAgICAgICAgICAnaGFuZGxpbmcgRERQIG1lc3NhZ2UnXG4gICAgICAgIClcbiAgICAgICk7XG4gICAgICBzZWxmLl9zdHJlYW0ub24oXG4gICAgICAgICdyZXNldCcsXG4gICAgICAgIE1ldGVvci5iaW5kRW52aXJvbm1lbnQodGhpcy5vblJlc2V0LmJpbmQodGhpcyksICdoYW5kbGluZyBERFAgcmVzZXQnKVxuICAgICAgKTtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbihcbiAgICAgICAgJ2Rpc2Nvbm5lY3QnLFxuICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KG9uRGlzY29ubmVjdCwgJ2hhbmRsaW5nIEREUCBkaXNjb25uZWN0JylcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbignbWVzc2FnZScsIHRoaXMub25NZXNzYWdlLmJpbmQodGhpcykpO1xuICAgICAgc2VsZi5fc3RyZWFtLm9uKCdyZXNldCcsIHRoaXMub25SZXNldC5iaW5kKHRoaXMpKTtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbignZGlzY29ubmVjdCcsIG9uRGlzY29ubmVjdCk7XG4gICAgfVxuICB9XG5cbiAgLy8gJ25hbWUnIGlzIHRoZSBuYW1lIG9mIHRoZSBkYXRhIG9uIHRoZSB3aXJlIHRoYXQgc2hvdWxkIGdvIGluIHRoZVxuICAvLyBzdG9yZS4gJ3dyYXBwZWRTdG9yZScgc2hvdWxkIGJlIGFuIG9iamVjdCB3aXRoIG1ldGhvZHMgYmVnaW5VcGRhdGUsIHVwZGF0ZSxcbiAgLy8gZW5kVXBkYXRlLCBzYXZlT3JpZ2luYWxzLCByZXRyaWV2ZU9yaWdpbmFscy4gc2VlIENvbGxlY3Rpb24gZm9yIGFuIGV4YW1wbGUuXG4gIGNyZWF0ZVN0b3JlTWV0aG9kcyhuYW1lLCB3cmFwcGVkU3RvcmUpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChuYW1lIGluIHNlbGYuX3N0b3JlcykgcmV0dXJuIGZhbHNlO1xuXG4gICAgLy8gV3JhcCB0aGUgaW5wdXQgb2JqZWN0IGluIGFuIG9iamVjdCB3aGljaCBtYWtlcyBhbnkgc3RvcmUgbWV0aG9kIG5vdFxuICAgIC8vIGltcGxlbWVudGVkIGJ5ICdzdG9yZScgaW50byBhIG5vLW9wLlxuICAgIGNvbnN0IHN0b3JlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBjb25zdCBrZXlzT2ZTdG9yZSA9IFtcbiAgICAgICd1cGRhdGUnLFxuICAgICAgJ2JlZ2luVXBkYXRlJyxcbiAgICAgICdlbmRVcGRhdGUnLFxuICAgICAgJ3NhdmVPcmlnaW5hbHMnLFxuICAgICAgJ3JldHJpZXZlT3JpZ2luYWxzJyxcbiAgICAgICdnZXREb2MnLFxuICAgICAgJ19nZXRDb2xsZWN0aW9uJ1xuICAgIF07XG4gICAga2V5c09mU3RvcmUuZm9yRWFjaCgobWV0aG9kKSA9PiB7XG4gICAgICBzdG9yZVttZXRob2RdID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgaWYgKHdyYXBwZWRTdG9yZVttZXRob2RdKSB7XG4gICAgICAgICAgcmV0dXJuIHdyYXBwZWRTdG9yZVttZXRob2RdKC4uLmFyZ3MpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuICAgIHNlbGYuX3N0b3Jlc1tuYW1lXSA9IHN0b3JlO1xuICAgIHJldHVybiBzdG9yZTtcbiAgfVxuXG4gIHJlZ2lzdGVyU3RvcmVDbGllbnQobmFtZSwgd3JhcHBlZFN0b3JlKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBjb25zdCBzdG9yZSA9IHNlbGYuY3JlYXRlU3RvcmVNZXRob2RzKG5hbWUsIHdyYXBwZWRTdG9yZSk7XG5cbiAgICBjb25zdCBxdWV1ZWQgPSBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3Jlc1tuYW1lXTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShxdWV1ZWQpKSB7XG4gICAgICBzdG9yZS5iZWdpblVwZGF0ZShxdWV1ZWQubGVuZ3RoLCBmYWxzZSk7XG4gICAgICBxdWV1ZWQuZm9yRWFjaChtc2cgPT4ge1xuICAgICAgICBzdG9yZS51cGRhdGUobXNnKTtcbiAgICAgIH0pO1xuICAgICAgc3RvcmUuZW5kVXBkYXRlKCk7XG4gICAgICBkZWxldGUgc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXNbbmFtZV07XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgYXN5bmMgcmVnaXN0ZXJTdG9yZVNlcnZlcihuYW1lLCB3cmFwcGVkU3RvcmUpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGNvbnN0IHN0b3JlID0gc2VsZi5jcmVhdGVTdG9yZU1ldGhvZHMobmFtZSwgd3JhcHBlZFN0b3JlKTtcblxuICAgIGNvbnN0IHF1ZXVlZCA9IHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzW25hbWVdO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHF1ZXVlZCkpIHtcbiAgICAgIGF3YWl0IHN0b3JlLmJlZ2luVXBkYXRlKHF1ZXVlZC5sZW5ndGgsIGZhbHNlKTtcbiAgICAgIGZvciAoY29uc3QgbXNnIG9mIHF1ZXVlZCkge1xuICAgICAgICBhd2FpdCBzdG9yZS51cGRhdGUobXNnKTtcbiAgICAgIH1cbiAgICAgIGF3YWl0IHN0b3JlLmVuZFVwZGF0ZSgpO1xuICAgICAgZGVsZXRlIHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzW25hbWVdO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLnN1YnNjcmliZVxuICAgKiBAc3VtbWFyeSBTdWJzY3JpYmUgdG8gYSByZWNvcmQgc2V0LiAgUmV0dXJucyBhIGhhbmRsZSB0aGF0IHByb3ZpZGVzXG4gICAqIGBzdG9wKClgIGFuZCBgcmVhZHkoKWAgbWV0aG9kcy5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBzdWJzY3JpcHRpb24uICBNYXRjaGVzIHRoZSBuYW1lIG9mIHRoZVxuICAgKiBzZXJ2ZXIncyBgcHVibGlzaCgpYCBjYWxsLlxuICAgKiBAcGFyYW0ge0VKU09OYWJsZX0gW2FyZzEsYXJnMi4uLl0gT3B0aW9uYWwgYXJndW1lbnRzIHBhc3NlZCB0byBwdWJsaXNoZXJcbiAgICogZnVuY3Rpb24gb24gc2VydmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdH0gW2NhbGxiYWNrc10gT3B0aW9uYWwuIE1heSBpbmNsdWRlIGBvblN0b3BgXG4gICAqIGFuZCBgb25SZWFkeWAgY2FsbGJhY2tzLiBJZiB0aGVyZSBpcyBhbiBlcnJvciwgaXQgaXMgcGFzc2VkIGFzIGFuXG4gICAqIGFyZ3VtZW50IHRvIGBvblN0b3BgLiBJZiBhIGZ1bmN0aW9uIGlzIHBhc3NlZCBpbnN0ZWFkIG9mIGFuIG9iamVjdCwgaXRcbiAgICogaXMgaW50ZXJwcmV0ZWQgYXMgYW4gYG9uUmVhZHlgIGNhbGxiYWNrLlxuICAgKi9cbiAgc3Vic2NyaWJlKG5hbWUgLyogLi4gW2FyZ3VtZW50c10gLi4gKGNhbGxiYWNrfGNhbGxiYWNrcykgKi8pIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGNvbnN0IHBhcmFtcyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsZXQgY2FsbGJhY2tzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBpZiAocGFyYW1zLmxlbmd0aCkge1xuICAgICAgY29uc3QgbGFzdFBhcmFtID0gcGFyYW1zW3BhcmFtcy5sZW5ndGggLSAxXTtcbiAgICAgIGlmICh0eXBlb2YgbGFzdFBhcmFtID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrcy5vblJlYWR5ID0gcGFyYW1zLnBvcCgpO1xuICAgICAgfSBlbHNlIGlmIChsYXN0UGFyYW0gJiYgW1xuICAgICAgICBsYXN0UGFyYW0ub25SZWFkeSxcbiAgICAgICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgb25FcnJvciB1c2VkIHRvIGV4aXN0LCBidXQgbm93IHdlIHVzZVxuICAgICAgICAvLyBvblN0b3Agd2l0aCBhbiBlcnJvciBjYWxsYmFjayBpbnN0ZWFkLlxuICAgICAgICBsYXN0UGFyYW0ub25FcnJvcixcbiAgICAgICAgbGFzdFBhcmFtLm9uU3RvcFxuICAgICAgXS5zb21lKGYgPT4gdHlwZW9mIGYgPT09IFwiZnVuY3Rpb25cIikpIHtcbiAgICAgICAgY2FsbGJhY2tzID0gcGFyYW1zLnBvcCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElzIHRoZXJlIGFuIGV4aXN0aW5nIHN1YiB3aXRoIHRoZSBzYW1lIG5hbWUgYW5kIHBhcmFtLCBydW4gaW4gYW5cbiAgICAvLyBpbnZhbGlkYXRlZCBDb21wdXRhdGlvbj8gVGhpcyB3aWxsIGhhcHBlbiBpZiB3ZSBhcmUgcmVydW5uaW5nIGFuXG4gICAgLy8gZXhpc3RpbmcgY29tcHV0YXRpb24uXG4gICAgLy9cbiAgICAvLyBGb3IgZXhhbXBsZSwgY29uc2lkZXIgYSByZXJ1biBvZjpcbiAgICAvL1xuICAgIC8vICAgICBUcmFja2VyLmF1dG9ydW4oZnVuY3Rpb24gKCkge1xuICAgIC8vICAgICAgIE1ldGVvci5zdWJzY3JpYmUoXCJmb29cIiwgU2Vzc2lvbi5nZXQoXCJmb29cIikpO1xuICAgIC8vICAgICAgIE1ldGVvci5zdWJzY3JpYmUoXCJiYXJcIiwgU2Vzc2lvbi5nZXQoXCJiYXJcIikpO1xuICAgIC8vICAgICB9KTtcbiAgICAvL1xuICAgIC8vIElmIFwiZm9vXCIgaGFzIGNoYW5nZWQgYnV0IFwiYmFyXCIgaGFzIG5vdCwgd2Ugd2lsbCBtYXRjaCB0aGUgXCJiYXJcIlxuICAgIC8vIHN1YmNyaWJlIHRvIGFuIGV4aXN0aW5nIGluYWN0aXZlIHN1YnNjcmlwdGlvbiBpbiBvcmRlciB0byBub3RcbiAgICAvLyB1bnN1YiBhbmQgcmVzdWIgdGhlIHN1YnNjcmlwdGlvbiB1bm5lY2Vzc2FyaWx5LlxuICAgIC8vXG4gICAgLy8gV2Ugb25seSBsb29rIGZvciBvbmUgc3VjaCBzdWI7IGlmIHRoZXJlIGFyZSBOIGFwcGFyZW50bHktaWRlbnRpY2FsIHN1YnNcbiAgICAvLyBiZWluZyBpbnZhbGlkYXRlZCwgd2Ugd2lsbCByZXF1aXJlIE4gbWF0Y2hpbmcgc3Vic2NyaWJlIGNhbGxzIHRvIGtlZXBcbiAgICAvLyB0aGVtIGFsbCBhY3RpdmUuXG4gICAgY29uc3QgZXhpc3RpbmcgPSBPYmplY3QudmFsdWVzKHNlbGYuX3N1YnNjcmlwdGlvbnMpLmZpbmQoXG4gICAgICBzdWIgPT4gKHN1Yi5pbmFjdGl2ZSAmJiBzdWIubmFtZSA9PT0gbmFtZSAmJiBFSlNPTi5lcXVhbHMoc3ViLnBhcmFtcywgcGFyYW1zKSlcbiAgICApO1xuXG4gICAgbGV0IGlkO1xuICAgIGlmIChleGlzdGluZykge1xuICAgICAgaWQgPSBleGlzdGluZy5pZDtcbiAgICAgIGV4aXN0aW5nLmluYWN0aXZlID0gZmFsc2U7IC8vIHJlYWN0aXZhdGVcblxuICAgICAgaWYgKGNhbGxiYWNrcy5vblJlYWR5KSB7XG4gICAgICAgIC8vIElmIHRoZSBzdWIgaXMgbm90IGFscmVhZHkgcmVhZHksIHJlcGxhY2UgYW55IHJlYWR5IGNhbGxiYWNrIHdpdGggdGhlXG4gICAgICAgIC8vIG9uZSBwcm92aWRlZCBub3cuIChJdCdzIG5vdCByZWFsbHkgY2xlYXIgd2hhdCB1c2VycyB3b3VsZCBleHBlY3QgZm9yXG4gICAgICAgIC8vIGFuIG9uUmVhZHkgY2FsbGJhY2sgaW5zaWRlIGFuIGF1dG9ydW47IHRoZSBzZW1hbnRpY3Mgd2UgcHJvdmlkZSBpc1xuICAgICAgICAvLyB0aGF0IGF0IHRoZSB0aW1lIHRoZSBzdWIgZmlyc3QgYmVjb21lcyByZWFkeSwgd2UgY2FsbCB0aGUgbGFzdFxuICAgICAgICAvLyBvblJlYWR5IGNhbGxiYWNrIHByb3ZpZGVkLCBpZiBhbnkuKVxuICAgICAgICAvLyBJZiB0aGUgc3ViIGlzIGFscmVhZHkgcmVhZHksIHJ1biB0aGUgcmVhZHkgY2FsbGJhY2sgcmlnaHQgYXdheS5cbiAgICAgICAgLy8gSXQgc2VlbXMgdGhhdCB1c2VycyB3b3VsZCBleHBlY3QgYW4gb25SZWFkeSBjYWxsYmFjayBpbnNpZGUgYW5cbiAgICAgICAgLy8gYXV0b3J1biB0byB0cmlnZ2VyIG9uY2UgdGhlIHN1YiBmaXJzdCBiZWNvbWVzIHJlYWR5IGFuZCBhbHNvXG4gICAgICAgIC8vIHdoZW4gcmUtc3VicyBoYXBwZW5zLlxuICAgICAgICBpZiAoZXhpc3RpbmcucmVhZHkpIHtcbiAgICAgICAgICBjYWxsYmFja3Mub25SZWFkeSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGV4aXN0aW5nLnJlYWR5Q2FsbGJhY2sgPSBjYWxsYmFja3Mub25SZWFkeTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBYWFggQ09NUEFUIFdJVEggMS4wLjMuMSB3ZSB1c2VkIHRvIGhhdmUgb25FcnJvciBidXQgbm93IHdlIGNhbGxcbiAgICAgIC8vIG9uU3RvcCB3aXRoIGFuIG9wdGlvbmFsIGVycm9yIGFyZ3VtZW50XG4gICAgICBpZiAoY2FsbGJhY2tzLm9uRXJyb3IpIHtcbiAgICAgICAgLy8gUmVwbGFjZSBleGlzdGluZyBjYWxsYmFjayBpZiBhbnksIHNvIHRoYXQgZXJyb3JzIGFyZW4ndFxuICAgICAgICAvLyBkb3VibGUtcmVwb3J0ZWQuXG4gICAgICAgIGV4aXN0aW5nLmVycm9yQ2FsbGJhY2sgPSBjYWxsYmFja3Mub25FcnJvcjtcbiAgICAgIH1cblxuICAgICAgaWYgKGNhbGxiYWNrcy5vblN0b3ApIHtcbiAgICAgICAgZXhpc3Rpbmcuc3RvcENhbGxiYWNrID0gY2FsbGJhY2tzLm9uU3RvcDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTmV3IHN1YiEgR2VuZXJhdGUgYW4gaWQsIHNhdmUgaXQgbG9jYWxseSwgYW5kIHNlbmQgbWVzc2FnZS5cbiAgICAgIGlkID0gUmFuZG9tLmlkKCk7XG4gICAgICBzZWxmLl9zdWJzY3JpcHRpb25zW2lkXSA9IHtcbiAgICAgICAgaWQ6IGlkLFxuICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICBwYXJhbXM6IEVKU09OLmNsb25lKHBhcmFtcyksXG4gICAgICAgIGluYWN0aXZlOiBmYWxzZSxcbiAgICAgICAgcmVhZHk6IGZhbHNlLFxuICAgICAgICByZWFkeURlcHM6IG5ldyBUcmFja2VyLkRlcGVuZGVuY3koKSxcbiAgICAgICAgcmVhZHlDYWxsYmFjazogY2FsbGJhY2tzLm9uUmVhZHksXG4gICAgICAgIC8vIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xICNlcnJvckNhbGxiYWNrXG4gICAgICAgIGVycm9yQ2FsbGJhY2s6IGNhbGxiYWNrcy5vbkVycm9yLFxuICAgICAgICBzdG9wQ2FsbGJhY2s6IGNhbGxiYWNrcy5vblN0b3AsXG4gICAgICAgIGNvbm5lY3Rpb246IHNlbGYsXG4gICAgICAgIHJlbW92ZSgpIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5jb25uZWN0aW9uLl9zdWJzY3JpcHRpb25zW3RoaXMuaWRdO1xuICAgICAgICAgIHRoaXMucmVhZHkgJiYgdGhpcy5yZWFkeURlcHMuY2hhbmdlZCgpO1xuICAgICAgICB9LFxuICAgICAgICBzdG9wKCkge1xuICAgICAgICAgIHRoaXMuY29ubmVjdGlvbi5fc2VuZFF1ZXVlZCh7IG1zZzogJ3Vuc3ViJywgaWQ6IGlkIH0pO1xuICAgICAgICAgIHRoaXMucmVtb3ZlKCk7XG5cbiAgICAgICAgICBpZiAoY2FsbGJhY2tzLm9uU3RvcCkge1xuICAgICAgICAgICAgY2FsbGJhY2tzLm9uU3RvcCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHNlbGYuX3NlbmQoeyBtc2c6ICdzdWInLCBpZDogaWQsIG5hbWU6IG5hbWUsIHBhcmFtczogcGFyYW1zIH0pO1xuICAgIH1cblxuICAgIC8vIHJldHVybiBhIGhhbmRsZSB0byB0aGUgYXBwbGljYXRpb24uXG4gICAgY29uc3QgaGFuZGxlID0ge1xuICAgICAgc3RvcCgpIHtcbiAgICAgICAgaWYgKCEgaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdLnN0b3AoKTtcbiAgICAgIH0sXG4gICAgICByZWFkeSgpIHtcbiAgICAgICAgLy8gcmV0dXJuIGZhbHNlIGlmIHdlJ3ZlIHVuc3Vic2NyaWJlZC5cbiAgICAgICAgaWYgKCFoYXNPd24uY2FsbChzZWxmLl9zdWJzY3JpcHRpb25zLCBpZCkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVjb3JkID0gc2VsZi5fc3Vic2NyaXB0aW9uc1tpZF07XG4gICAgICAgIHJlY29yZC5yZWFkeURlcHMuZGVwZW5kKCk7XG4gICAgICAgIHJldHVybiByZWNvcmQucmVhZHk7XG4gICAgICB9LFxuICAgICAgc3Vic2NyaXB0aW9uSWQ6IGlkXG4gICAgfTtcblxuICAgIGlmIChUcmFja2VyLmFjdGl2ZSkge1xuICAgICAgLy8gV2UncmUgaW4gYSByZWFjdGl2ZSBjb21wdXRhdGlvbiwgc28gd2UnZCBsaWtlIHRvIHVuc3Vic2NyaWJlIHdoZW4gdGhlXG4gICAgICAvLyBjb21wdXRhdGlvbiBpcyBpbnZhbGlkYXRlZC4uLiBidXQgbm90IGlmIHRoZSByZXJ1biBqdXN0IHJlLXN1YnNjcmliZXNcbiAgICAgIC8vIHRvIHRoZSBzYW1lIHN1YnNjcmlwdGlvbiEgIFdoZW4gYSByZXJ1biBoYXBwZW5zLCB3ZSB1c2Ugb25JbnZhbGlkYXRlXG4gICAgICAvLyBhcyBhIGNoYW5nZSB0byBtYXJrIHRoZSBzdWJzY3JpcHRpb24gXCJpbmFjdGl2ZVwiIHNvIHRoYXQgaXQgY2FuXG4gICAgICAvLyBiZSByZXVzZWQgZnJvbSB0aGUgcmVydW4uICBJZiBpdCBpc24ndCByZXVzZWQsIGl0J3Mga2lsbGVkIGZyb21cbiAgICAgIC8vIGFuIGFmdGVyRmx1c2guXG4gICAgICBUcmFja2VyLm9uSW52YWxpZGF0ZSgoYykgPT4ge1xuICAgICAgICBpZiAoaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpKSB7XG4gICAgICAgICAgc2VsZi5fc3Vic2NyaXB0aW9uc1tpZF0uaW5hY3RpdmUgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgVHJhY2tlci5hZnRlckZsdXNoKCgpID0+IHtcbiAgICAgICAgICBpZiAoaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpICYmXG4gICAgICAgICAgICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdLmluYWN0aXZlKSB7XG4gICAgICAgICAgICBoYW5kbGUuc3RvcCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gaGFuZGxlO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFRlbGxzIGlmIHRoZSBtZXRob2QgY2FsbCBjYW1lIGZyb20gYSBjYWxsIG9yIGEgY2FsbEFzeW5jLlxuICAgKiBAYWxpYXMgTWV0ZW9yLmlzQXN5bmNDYWxsXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQHJldHVybnMgYm9vbGVhblxuICAgKi9cbiAgaXNBc3luY0NhbGwoKXtcbiAgICByZXR1cm4gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5faXNDYWxsQXN5bmNNZXRob2RSdW5uaW5nKClcbiAgfVxuICBtZXRob2RzKG1ldGhvZHMpIHtcbiAgICBPYmplY3QuZW50cmllcyhtZXRob2RzKS5mb3JFYWNoKChbbmFtZSwgZnVuY10pID0+IHtcbiAgICAgIGlmICh0eXBlb2YgZnVuYyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNZXRob2QgJ1wiICsgbmFtZSArIFwiJyBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5fbWV0aG9kSGFuZGxlcnNbbmFtZV0pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQSBtZXRob2QgbmFtZWQgJ1wiICsgbmFtZSArIFwiJyBpcyBhbHJlYWR5IGRlZmluZWRcIik7XG4gICAgICB9XG4gICAgICB0aGlzLl9tZXRob2RIYW5kbGVyc1tuYW1lXSA9IGZ1bmM7XG4gICAgfSk7XG4gIH1cblxuICBfZ2V0SXNTaW11bGF0aW9uKHtpc0Zyb21DYWxsQXN5bmMsIGFscmVhZHlJblNpbXVsYXRpb259KSB7XG4gICAgaWYgKCFpc0Zyb21DYWxsQXN5bmMpIHtcbiAgICAgIHJldHVybiBhbHJlYWR5SW5TaW11bGF0aW9uO1xuICAgIH1cbiAgICByZXR1cm4gYWxyZWFkeUluU2ltdWxhdGlvbiAmJiBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLl9pc0NhbGxBc3luY01ldGhvZFJ1bm5pbmcoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5jYWxsXG4gICAqIEBzdW1tYXJ5IEludm9rZXMgYSBtZXRob2Qgd2l0aCBhIHN5bmMgc3R1YiwgcGFzc2luZyBhbnkgbnVtYmVyIG9mIGFyZ3VtZW50cy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgbWV0aG9kIHRvIGludm9rZVxuICAgKiBAcGFyYW0ge0VKU09OYWJsZX0gW2FyZzEsYXJnMi4uLl0gT3B0aW9uYWwgbWV0aG9kIGFyZ3VtZW50c1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbYXN5bmNDYWxsYmFja10gT3B0aW9uYWwgY2FsbGJhY2ssIHdoaWNoIGlzIGNhbGxlZCBhc3luY2hyb25vdXNseSB3aXRoIHRoZSBlcnJvciBvciByZXN1bHQgYWZ0ZXIgdGhlIG1ldGhvZCBpcyBjb21wbGV0ZS4gSWYgbm90IHByb3ZpZGVkLCB0aGUgbWV0aG9kIHJ1bnMgc3luY2hyb25vdXNseSBpZiBwb3NzaWJsZSAoc2VlIGJlbG93KS5cbiAgICovXG4gIGNhbGwobmFtZSAvKiAuLiBbYXJndW1lbnRzXSAuLiBjYWxsYmFjayAqLykge1xuICAgIC8vIGlmIGl0J3MgYSBmdW5jdGlvbiwgdGhlIGxhc3QgYXJndW1lbnQgaXMgdGhlIHJlc3VsdCBjYWxsYmFjayxcbiAgICAvLyBub3QgYSBwYXJhbWV0ZXIgdG8gdGhlIHJlbW90ZSBtZXRob2QuXG4gICAgY29uc3QgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsZXQgY2FsbGJhY2s7XG4gICAgaWYgKGFyZ3MubGVuZ3RoICYmIHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gYXJncy5wb3AoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYXBwbHkobmFtZSwgYXJncywgY2FsbGJhY2spO1xuICB9XG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5jYWxsQXN5bmNcbiAgICogQHN1bW1hcnkgSW52b2tlcyBhIG1ldGhvZCB3aXRoIGFuIGFzeW5jIHN0dWIsIHBhc3NpbmcgYW55IG51bWJlciBvZiBhcmd1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIG1ldGhvZCB0byBpbnZva2VcbiAgICogQHBhcmFtIHtFSlNPTmFibGV9IFthcmcxLGFyZzIuLi5dIE9wdGlvbmFsIG1ldGhvZCBhcmd1bWVudHNcbiAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAqL1xuICBjYWxsQXN5bmMobmFtZSAvKiAuLiBbYXJndW1lbnRzXSAuLiAqLykge1xuICAgIGNvbnN0IGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgaWYgKGFyZ3MubGVuZ3RoICYmIHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgXCJNZXRlb3IuY2FsbEFzeW5jKCkgZG9lcyBub3QgYWNjZXB0IGEgY2FsbGJhY2suIFlvdSBzaG91bGQgJ2F3YWl0JyB0aGUgcmVzdWx0LCBvciB1c2UgLnRoZW4oKS5cIlxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5hcHBseUFzeW5jKG5hbWUsIGFyZ3MsIHsgcmV0dXJuU2VydmVyUmVzdWx0UHJvbWlzZTogdHJ1ZSB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5hcHBseVxuICAgKiBAc3VtbWFyeSBJbnZva2UgYSBtZXRob2QgcGFzc2luZyBhbiBhcnJheSBvZiBhcmd1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIG1ldGhvZCB0byBpbnZva2VcbiAgICogQHBhcmFtIHtFSlNPTmFibGVbXX0gYXJncyBNZXRob2QgYXJndW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLndhaXQgKENsaWVudCBvbmx5KSBJZiB0cnVlLCBkb24ndCBzZW5kIHRoaXMgbWV0aG9kIHVudGlsIGFsbCBwcmV2aW91cyBtZXRob2QgY2FsbHMgaGF2ZSBjb21wbGV0ZWQsIGFuZCBkb24ndCBzZW5kIGFueSBzdWJzZXF1ZW50IG1ldGhvZCBjYWxscyB1bnRpbCB0aGlzIG9uZSBpcyBjb21wbGV0ZWQuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMub25SZXN1bHRSZWNlaXZlZCAoQ2xpZW50IG9ubHkpIFRoaXMgY2FsbGJhY2sgaXMgaW52b2tlZCB3aXRoIHRoZSBlcnJvciBvciByZXN1bHQgb2YgdGhlIG1ldGhvZCAoanVzdCBsaWtlIGBhc3luY0NhbGxiYWNrYCkgYXMgc29vbiBhcyB0aGUgZXJyb3Igb3IgcmVzdWx0IGlzIGF2YWlsYWJsZS4gVGhlIGxvY2FsIGNhY2hlIG1heSBub3QgeWV0IHJlZmxlY3QgdGhlIHdyaXRlcyBwZXJmb3JtZWQgYnkgdGhlIG1ldGhvZC5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm5vUmV0cnkgKENsaWVudCBvbmx5KSBpZiB0cnVlLCBkb24ndCBzZW5kIHRoaXMgbWV0aG9kIGFnYWluIG9uIHJlbG9hZCwgc2ltcGx5IGNhbGwgdGhlIGNhbGxiYWNrIGFuIGVycm9yIHdpdGggdGhlIGVycm9yIGNvZGUgJ2ludm9jYXRpb24tZmFpbGVkJy5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnRocm93U3R1YkV4Y2VwdGlvbnMgKENsaWVudCBvbmx5KSBJZiB0cnVlLCBleGNlcHRpb25zIHRocm93biBieSBtZXRob2Qgc3R1YnMgd2lsbCBiZSB0aHJvd24gaW5zdGVhZCBvZiBsb2dnZWQsIGFuZCB0aGUgbWV0aG9kIHdpbGwgbm90IGJlIGludm9rZWQgb24gdGhlIHNlcnZlci5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnJldHVyblN0dWJWYWx1ZSAoQ2xpZW50IG9ubHkpIElmIHRydWUgdGhlbiBpbiBjYXNlcyB3aGVyZSB3ZSB3b3VsZCBoYXZlIG90aGVyd2lzZSBkaXNjYXJkZWQgdGhlIHN0dWIncyByZXR1cm4gdmFsdWUgYW5kIHJldHVybmVkIHVuZGVmaW5lZCwgaW5zdGVhZCB3ZSBnbyBhaGVhZCBhbmQgcmV0dXJuIGl0LiBTcGVjaWZpY2FsbHksIHRoaXMgaXMgYW55IHRpbWUgb3RoZXIgdGhhbiB3aGVuIChhKSB3ZSBhcmUgYWxyZWFkeSBpbnNpZGUgYSBzdHViIG9yIChiKSB3ZSBhcmUgaW4gTm9kZSBhbmQgbm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkLiBDdXJyZW50bHkgd2UgcmVxdWlyZSB0aGlzIGZsYWcgdG8gYmUgZXhwbGljaXRseSBwYXNzZWQgdG8gcmVkdWNlIHRoZSBsaWtlbGlob29kIHRoYXQgc3R1YiByZXR1cm4gdmFsdWVzIHdpbGwgYmUgY29uZnVzZWQgd2l0aCBzZXJ2ZXIgcmV0dXJuIHZhbHVlczsgd2UgbWF5IGltcHJvdmUgdGhpcyBpbiBmdXR1cmUuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFthc3luY0NhbGxiYWNrXSBPcHRpb25hbCBjYWxsYmFjazsgc2FtZSBzZW1hbnRpY3MgYXMgaW4gW2BNZXRlb3IuY2FsbGBdKCNtZXRlb3JfY2FsbCkuXG4gICAqL1xuICBhcHBseShuYW1lLCBhcmdzLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IHsgc3R1Ykludm9jYXRpb24sIGludm9jYXRpb24sIC4uLnN0dWJPcHRpb25zIH0gPSB0aGlzLl9zdHViQ2FsbChuYW1lLCBFSlNPTi5jbG9uZShhcmdzKSk7XG5cbiAgICBpZiAoc3R1Yk9wdGlvbnMuaGFzU3R1Yikge1xuICAgICAgaWYgKFxuICAgICAgICAhdGhpcy5fZ2V0SXNTaW11bGF0aW9uKHtcbiAgICAgICAgICBhbHJlYWR5SW5TaW11bGF0aW9uOiBzdHViT3B0aW9ucy5hbHJlYWR5SW5TaW11bGF0aW9uLFxuICAgICAgICAgIGlzRnJvbUNhbGxBc3luYzogc3R1Yk9wdGlvbnMuaXNGcm9tQ2FsbEFzeW5jLFxuICAgICAgICB9KVxuICAgICAgKSB7XG4gICAgICAgIHRoaXMuX3NhdmVPcmlnaW5hbHMoKTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIHN0dWJPcHRpb25zLnN0dWJSZXR1cm5WYWx1ZSA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb25cbiAgICAgICAgICAud2l0aFZhbHVlKGludm9jYXRpb24sIHN0dWJJbnZvY2F0aW9uKTtcbiAgICAgICAgaWYgKE1ldGVvci5faXNQcm9taXNlKHN0dWJPcHRpb25zLnN0dWJSZXR1cm5WYWx1ZSkpIHtcbiAgICAgICAgICBNZXRlb3IuX2RlYnVnKFxuICAgICAgICAgICAgYE1ldGhvZCAke25hbWV9OiBDYWxsaW5nIGEgbWV0aG9kIHRoYXQgaGFzIGFuIGFzeW5jIG1ldGhvZCBzdHViIHdpdGggY2FsbC9hcHBseSBjYW4gbGVhZCB0byB1bmV4cGVjdGVkIGJlaGF2aW9ycy4gVXNlIGNhbGxBc3luYy9hcHBseUFzeW5jIGluc3RlYWQuYFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgc3R1Yk9wdGlvbnMuZXhjZXB0aW9uID0gZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2FwcGx5KG5hbWUsIHN0dWJPcHRpb25zLCBhcmdzLCBvcHRpb25zLCBjYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuYXBwbHlBc3luY1xuICAgKiBAc3VtbWFyeSBJbnZva2UgYSBtZXRob2QgcGFzc2luZyBhbiBhcnJheSBvZiBhcmd1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIG1ldGhvZCB0byBpbnZva2VcbiAgICogQHBhcmFtIHtFSlNPTmFibGVbXX0gYXJncyBNZXRob2QgYXJndW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLndhaXQgKENsaWVudCBvbmx5KSBJZiB0cnVlLCBkb24ndCBzZW5kIHRoaXMgbWV0aG9kIHVudGlsIGFsbCBwcmV2aW91cyBtZXRob2QgY2FsbHMgaGF2ZSBjb21wbGV0ZWQsIGFuZCBkb24ndCBzZW5kIGFueSBzdWJzZXF1ZW50IG1ldGhvZCBjYWxscyB1bnRpbCB0aGlzIG9uZSBpcyBjb21wbGV0ZWQuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMub25SZXN1bHRSZWNlaXZlZCAoQ2xpZW50IG9ubHkpIFRoaXMgY2FsbGJhY2sgaXMgaW52b2tlZCB3aXRoIHRoZSBlcnJvciBvciByZXN1bHQgb2YgdGhlIG1ldGhvZCAoanVzdCBsaWtlIGBhc3luY0NhbGxiYWNrYCkgYXMgc29vbiBhcyB0aGUgZXJyb3Igb3IgcmVzdWx0IGlzIGF2YWlsYWJsZS4gVGhlIGxvY2FsIGNhY2hlIG1heSBub3QgeWV0IHJlZmxlY3QgdGhlIHdyaXRlcyBwZXJmb3JtZWQgYnkgdGhlIG1ldGhvZC5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm5vUmV0cnkgKENsaWVudCBvbmx5KSBpZiB0cnVlLCBkb24ndCBzZW5kIHRoaXMgbWV0aG9kIGFnYWluIG9uIHJlbG9hZCwgc2ltcGx5IGNhbGwgdGhlIGNhbGxiYWNrIGFuIGVycm9yIHdpdGggdGhlIGVycm9yIGNvZGUgJ2ludm9jYXRpb24tZmFpbGVkJy5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnRocm93U3R1YkV4Y2VwdGlvbnMgKENsaWVudCBvbmx5KSBJZiB0cnVlLCBleGNlcHRpb25zIHRocm93biBieSBtZXRob2Qgc3R1YnMgd2lsbCBiZSB0aHJvd24gaW5zdGVhZCBvZiBsb2dnZWQsIGFuZCB0aGUgbWV0aG9kIHdpbGwgbm90IGJlIGludm9rZWQgb24gdGhlIHNlcnZlci5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnJldHVyblN0dWJWYWx1ZSAoQ2xpZW50IG9ubHkpIElmIHRydWUgdGhlbiBpbiBjYXNlcyB3aGVyZSB3ZSB3b3VsZCBoYXZlIG90aGVyd2lzZSBkaXNjYXJkZWQgdGhlIHN0dWIncyByZXR1cm4gdmFsdWUgYW5kIHJldHVybmVkIHVuZGVmaW5lZCwgaW5zdGVhZCB3ZSBnbyBhaGVhZCBhbmQgcmV0dXJuIGl0LiBTcGVjaWZpY2FsbHksIHRoaXMgaXMgYW55IHRpbWUgb3RoZXIgdGhhbiB3aGVuIChhKSB3ZSBhcmUgYWxyZWFkeSBpbnNpZGUgYSBzdHViIG9yIChiKSB3ZSBhcmUgaW4gTm9kZSBhbmQgbm8gY2FsbGJhY2sgd2FzIHByb3ZpZGVkLiBDdXJyZW50bHkgd2UgcmVxdWlyZSB0aGlzIGZsYWcgdG8gYmUgZXhwbGljaXRseSBwYXNzZWQgdG8gcmVkdWNlIHRoZSBsaWtlbGlob29kIHRoYXQgc3R1YiByZXR1cm4gdmFsdWVzIHdpbGwgYmUgY29uZnVzZWQgd2l0aCBzZXJ2ZXIgcmV0dXJuIHZhbHVlczsgd2UgbWF5IGltcHJvdmUgdGhpcyBpbiBmdXR1cmUuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZXR1cm5TZXJ2ZXJSZXN1bHRQcm9taXNlIChDbGllbnQgb25seSkgSWYgdHJ1ZSwgdGhlIHByb21pc2UgcmV0dXJuZWQgYnkgYXBwbHlBc3luYyB3aWxsIHJlc29sdmUgdG8gdGhlIHNlcnZlcidzIHJldHVybiB2YWx1ZSwgcmF0aGVyIHRoYW4gdGhlIHN0dWIncyByZXR1cm4gdmFsdWUuIFRoaXMgaXMgdXNlZnVsIHdoZW4geW91IHdhbnQgdG8gZW5zdXJlIHRoYXQgdGhlIHNlcnZlcidzIHJldHVybiB2YWx1ZSBpcyB1c2VkLCBldmVuIGlmIHRoZSBzdHViIHJldHVybnMgYSBwcm9taXNlLiBUaGUgc2FtZSBiZWhhdmlvciBhcyBgY2FsbEFzeW5jYC5cbiAgICovXG4gIGFwcGx5QXN5bmMobmFtZSwgYXJncywgb3B0aW9ucywgY2FsbGJhY2sgPSBudWxsKSB7XG4gICAgY29uc3Qgc3R1YlByb21pc2UgPSB0aGlzLl9hcHBseUFzeW5jU3R1Ykludm9jYXRpb24obmFtZSwgYXJncywgb3B0aW9ucyk7XG5cbiAgICBjb25zdCBwcm9taXNlID0gdGhpcy5fYXBwbHlBc3luYyh7XG4gICAgICBuYW1lLFxuICAgICAgYXJncyxcbiAgICAgIG9wdGlvbnMsXG4gICAgICBjYWxsYmFjayxcbiAgICAgIHN0dWJQcm9taXNlLFxuICAgIH0pO1xuICAgIGlmIChNZXRlb3IuaXNDbGllbnQpIHtcbiAgICAgIC8vIG9ubHkgcmV0dXJuIHRoZSBzdHViUmV0dXJuVmFsdWVcbiAgICAgIHByb21pc2Uuc3R1YlByb21pc2UgPSBzdHViUHJvbWlzZS50aGVuKG8gPT4ge1xuICAgICAgICBpZiAoby5leGNlcHRpb24pIHtcbiAgICAgICAgICB0aHJvdyBvLmV4Y2VwdGlvbjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gby5zdHViUmV0dXJuVmFsdWU7XG4gICAgICB9KTtcbiAgICAgIC8vIHRoaXMgYXZvaWRzIGF0dHJpYnV0ZSByZWN1cnNpb25cbiAgICAgIHByb21pc2Uuc2VydmVyUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+XG4gICAgICAgIHByb21pc2UudGhlbihyZXNvbHZlKS5jYXRjaChyZWplY3QpLFxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIHByb21pc2U7XG4gIH1cbiAgYXN5bmMgX2FwcGx5QXN5bmNTdHViSW52b2NhdGlvbihuYW1lLCBhcmdzLCBvcHRpb25zKSB7XG4gICAgY29uc3QgeyBzdHViSW52b2NhdGlvbiwgaW52b2NhdGlvbiwgLi4uc3R1Yk9wdGlvbnMgfSA9IHRoaXMuX3N0dWJDYWxsKG5hbWUsIEVKU09OLmNsb25lKGFyZ3MpLCBvcHRpb25zKTtcbiAgICBpZiAoc3R1Yk9wdGlvbnMuaGFzU3R1Yikge1xuICAgICAgaWYgKFxuICAgICAgICAhdGhpcy5fZ2V0SXNTaW11bGF0aW9uKHtcbiAgICAgICAgICBhbHJlYWR5SW5TaW11bGF0aW9uOiBzdHViT3B0aW9ucy5hbHJlYWR5SW5TaW11bGF0aW9uLFxuICAgICAgICAgIGlzRnJvbUNhbGxBc3luYzogc3R1Yk9wdGlvbnMuaXNGcm9tQ2FsbEFzeW5jLFxuICAgICAgICB9KVxuICAgICAgKSB7XG4gICAgICAgIHRoaXMuX3NhdmVPcmlnaW5hbHMoKTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIC8qXG4gICAgICAgICAqIFRoZSBjb2RlIGJlbG93IGZvbGxvd3MgdGhlIHNhbWUgbG9naWMgYXMgdGhlIGZ1bmN0aW9uIHdpdGhWYWx1ZXMoKS5cbiAgICAgICAgICpcbiAgICAgICAgICogQnV0IGFzIHRoZSBNZXRlb3IgcGFja2FnZSBpcyBub3QgY29tcGlsZWQgYnkgZWNtYXNjcmlwdCwgaXQgaXMgdW5hYmxlIHRvIHVzZSBuZXdlciBzeW50YXggaW4gdGhlIGJyb3dzZXIsXG4gICAgICAgICAqIHN1Y2ggYXMsIHRoZSBhc3luYy9hd2FpdC5cbiAgICAgICAgICpcbiAgICAgICAgICogU28sIHRvIGtlZXAgc3VwcG9ydGluZyBvbGQgYnJvd3NlcnMsIGxpa2UgSUUgMTEsIHdlJ3JlIGNyZWF0aW5nIHRoZSBsb2dpYyBvbmUgbGV2ZWwgYWJvdmUuXG4gICAgICAgICAqL1xuICAgICAgICBjb25zdCBjdXJyZW50Q29udGV4dCA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldE5ld0NvbnRleHRBbmRHZXRDdXJyZW50KFxuICAgICAgICAgIGludm9jYXRpb25cbiAgICAgICAgKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBzdHViT3B0aW9ucy5zdHViUmV0dXJuVmFsdWUgPSBhd2FpdCBzdHViSW52b2NhdGlvbigpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgc3R1Yk9wdGlvbnMuZXhjZXB0aW9uID0gZTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLl9zZXQoY3VycmVudENvbnRleHQpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHN0dWJPcHRpb25zLmV4Y2VwdGlvbiA9IGU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzdHViT3B0aW9ucztcbiAgfVxuICBhc3luYyBfYXBwbHlBc3luYyh7IG5hbWUsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrLCBzdHViUHJvbWlzZSB9KSB7XG4gICAgY29uc3Qgc3R1Yk9wdGlvbnMgPSBhd2FpdCBzdHViUHJvbWlzZTtcbiAgICByZXR1cm4gdGhpcy5fYXBwbHkobmFtZSwgc3R1Yk9wdGlvbnMsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIF9hcHBseShuYW1lLCBzdHViQ2FsbFZhbHVlLCBhcmdzLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIC8vIFdlIHdlcmUgcGFzc2VkIDMgYXJndW1lbnRzLiBUaGV5IG1heSBiZSBlaXRoZXIgKG5hbWUsIGFyZ3MsIG9wdGlvbnMpXG4gICAgLy8gb3IgKG5hbWUsIGFyZ3MsIGNhbGxiYWNrKVxuICAgIGlmICghY2FsbGJhY2sgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIH1cbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAvLyBYWFggd291bGQgaXQgYmUgYmV0dGVyIGZvcm0gdG8gZG8gdGhlIGJpbmRpbmcgaW4gc3RyZWFtLm9uLFxuICAgICAgLy8gb3IgY2FsbGVyLCBpbnN0ZWFkIG9mIGhlcmU/XG4gICAgICAvLyBYWFggaW1wcm92ZSBlcnJvciBtZXNzYWdlIChhbmQgaG93IHdlIHJlcG9ydCBpdClcbiAgICAgIGNhbGxiYWNrID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChcbiAgICAgICAgY2FsbGJhY2ssXG4gICAgICAgIFwiZGVsaXZlcmluZyByZXN1bHQgb2YgaW52b2tpbmcgJ1wiICsgbmFtZSArIFwiJ1wiXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCB7XG4gICAgICBoYXNTdHViLFxuICAgICAgZXhjZXB0aW9uLFxuICAgICAgc3R1YlJldHVyblZhbHVlLFxuICAgICAgYWxyZWFkeUluU2ltdWxhdGlvbixcbiAgICAgIHJhbmRvbVNlZWQsXG4gICAgfSA9IHN0dWJDYWxsVmFsdWU7XG5cbiAgICAvLyBLZWVwIG91ciBhcmdzIHNhZmUgZnJvbSBtdXRhdGlvbiAoZWcgaWYgd2UgZG9uJ3Qgc2VuZCB0aGUgbWVzc2FnZSBmb3IgYVxuICAgIC8vIHdoaWxlIGJlY2F1c2Ugb2YgYSB3YWl0IG1ldGhvZCkuXG4gICAgYXJncyA9IEVKU09OLmNsb25lKGFyZ3MpO1xuICAgIC8vIElmIHdlJ3JlIGluIGEgc2ltdWxhdGlvbiwgc3RvcCBhbmQgcmV0dXJuIHRoZSByZXN1bHQgd2UgaGF2ZSxcbiAgICAvLyByYXRoZXIgdGhhbiBnb2luZyBvbiB0byBkbyBhbiBSUEMuIElmIHRoZXJlIHdhcyBubyBzdHViLFxuICAgIC8vIHdlJ2xsIGVuZCB1cCByZXR1cm5pbmcgdW5kZWZpbmVkLlxuICAgIGlmIChcbiAgICAgIHRoaXMuX2dldElzU2ltdWxhdGlvbih7XG4gICAgICAgIGFscmVhZHlJblNpbXVsYXRpb24sXG4gICAgICAgIGlzRnJvbUNhbGxBc3luYzogc3R1YkNhbGxWYWx1ZS5pc0Zyb21DYWxsQXN5bmMsXG4gICAgICB9KVxuICAgICkge1xuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKGV4Y2VwdGlvbiwgc3R1YlJldHVyblZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICAgIGlmIChleGNlcHRpb24pIHRocm93IGV4Y2VwdGlvbjtcbiAgICAgIHJldHVybiBzdHViUmV0dXJuVmFsdWU7XG4gICAgfVxuXG4gICAgLy8gV2Ugb25seSBjcmVhdGUgdGhlIG1ldGhvZElkIGhlcmUgYmVjYXVzZSB3ZSBkb24ndCBhY3R1YWxseSBuZWVkIG9uZSBpZlxuICAgIC8vIHdlJ3JlIGFscmVhZHkgaW4gYSBzaW11bGF0aW9uXG4gICAgY29uc3QgbWV0aG9kSWQgPSAnJyArIHNlbGYuX25leHRNZXRob2RJZCsrO1xuICAgIGlmIChoYXNTdHViKSB7XG4gICAgICBzZWxmLl9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzKG1ldGhvZElkKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSB0aGUgRERQIG1lc3NhZ2UgZm9yIHRoZSBtZXRob2QgY2FsbC4gTm90ZSB0aGF0IG9uIHRoZSBjbGllbnQsXG4gICAgLy8gaXQgaXMgaW1wb3J0YW50IHRoYXQgdGhlIHN0dWIgaGF2ZSBmaW5pc2hlZCBiZWZvcmUgd2Ugc2VuZCB0aGUgUlBDLCBzb1xuICAgIC8vIHRoYXQgd2Uga25vdyB3ZSBoYXZlIGEgY29tcGxldGUgbGlzdCBvZiB3aGljaCBsb2NhbCBkb2N1bWVudHMgdGhlIHN0dWJcbiAgICAvLyB3cm90ZS5cbiAgICBjb25zdCBtZXNzYWdlID0ge1xuICAgICAgbXNnOiAnbWV0aG9kJyxcbiAgICAgIGlkOiBtZXRob2RJZCxcbiAgICAgIG1ldGhvZDogbmFtZSxcbiAgICAgIHBhcmFtczogYXJnc1xuICAgIH07XG5cbiAgICAvLyBJZiBhbiBleGNlcHRpb24gb2NjdXJyZWQgaW4gYSBzdHViLCBhbmQgd2UncmUgaWdub3JpbmcgaXRcbiAgICAvLyBiZWNhdXNlIHdlJ3JlIGRvaW5nIGFuIFJQQyBhbmQgd2FudCB0byB1c2Ugd2hhdCB0aGUgc2VydmVyXG4gICAgLy8gcmV0dXJucyBpbnN0ZWFkLCBsb2cgaXQgc28gdGhlIGRldmVsb3BlciBrbm93c1xuICAgIC8vICh1bmxlc3MgdGhleSBleHBsaWNpdGx5IGFzayB0byBzZWUgdGhlIGVycm9yKS5cbiAgICAvL1xuICAgIC8vIFRlc3RzIGNhbiBzZXQgdGhlICdfZXhwZWN0ZWRCeVRlc3QnIGZsYWcgb24gYW4gZXhjZXB0aW9uIHNvIGl0IHdvbid0XG4gICAgLy8gZ28gdG8gbG9nLlxuICAgIGlmIChleGNlcHRpb24pIHtcbiAgICAgIGlmIChvcHRpb25zLnRocm93U3R1YkV4Y2VwdGlvbnMpIHtcbiAgICAgICAgdGhyb3cgZXhjZXB0aW9uO1xuICAgICAgfSBlbHNlIGlmICghZXhjZXB0aW9uLl9leHBlY3RlZEJ5VGVzdCkge1xuICAgICAgICBNZXRlb3IuX2RlYnVnKFxuICAgICAgICAgIFwiRXhjZXB0aW9uIHdoaWxlIHNpbXVsYXRpbmcgdGhlIGVmZmVjdCBvZiBpbnZva2luZyAnXCIgKyBuYW1lICsgXCInXCIsXG4gICAgICAgICAgZXhjZXB0aW9uXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQXQgdGhpcyBwb2ludCB3ZSdyZSBkZWZpbml0ZWx5IGRvaW5nIGFuIFJQQywgYW5kIHdlJ3JlIGdvaW5nIHRvXG4gICAgLy8gcmV0dXJuIHRoZSB2YWx1ZSBvZiB0aGUgUlBDIHRvIHRoZSBjYWxsZXIuXG5cbiAgICAvLyBJZiB0aGUgY2FsbGVyIGRpZG4ndCBnaXZlIGEgY2FsbGJhY2ssIGRlY2lkZSB3aGF0IHRvIGRvLlxuICAgIGxldCBmdXR1cmU7XG4gICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgaWYgKFxuICAgICAgICBNZXRlb3IuaXNDbGllbnQgJiZcbiAgICAgICAgIW9wdGlvbnMucmV0dXJuU2VydmVyUmVzdWx0UHJvbWlzZSAmJlxuICAgICAgICAoIW9wdGlvbnMuaXNGcm9tQ2FsbEFzeW5jIHx8IG9wdGlvbnMucmV0dXJuU3R1YlZhbHVlKVxuICAgICAgKSB7XG4gICAgICAgIC8vIE9uIHRoZSBjbGllbnQsIHdlIGRvbid0IGhhdmUgZmliZXJzLCBzbyB3ZSBjYW4ndCBibG9jay4gVGhlXG4gICAgICAgIC8vIG9ubHkgdGhpbmcgd2UgY2FuIGRvIGlzIHRvIHJldHVybiB1bmRlZmluZWQgYW5kIGRpc2NhcmQgdGhlXG4gICAgICAgIC8vIHJlc3VsdCBvZiB0aGUgUlBDLiBJZiBhbiBlcnJvciBvY2N1cnJlZCB0aGVuIHByaW50IHRoZSBlcnJvclxuICAgICAgICAvLyB0byB0aGUgY29uc29sZS5cbiAgICAgICAgY2FsbGJhY2sgPSAoZXJyKSA9PiB7XG4gICAgICAgICAgZXJyICYmIE1ldGVvci5fZGVidWcoXCJFcnJvciBpbnZva2luZyBNZXRob2QgJ1wiICsgbmFtZSArIFwiJ1wiLCBlcnIpO1xuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gT24gdGhlIHNlcnZlciwgbWFrZSB0aGUgZnVuY3Rpb24gc3luY2hyb25vdXMuIFRocm93IG9uXG4gICAgICAgIC8vIGVycm9ycywgcmV0dXJuIG9uIHN1Y2Nlc3MuXG4gICAgICAgIGZ1dHVyZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBjYWxsYmFjayA9ICguLi5hbGxBcmdzKSA9PiB7XG4gICAgICAgICAgICBsZXQgYXJncyA9IEFycmF5LmZyb20oYWxsQXJncyk7XG4gICAgICAgICAgICBsZXQgZXJyID0gYXJncy5zaGlmdCgpO1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzb2x2ZSguLi5hcmdzKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBTZW5kIHRoZSByYW5kb21TZWVkIG9ubHkgaWYgd2UgdXNlZCBpdFxuICAgIGlmIChyYW5kb21TZWVkLnZhbHVlICE9PSBudWxsKSB7XG4gICAgICBtZXNzYWdlLnJhbmRvbVNlZWQgPSByYW5kb21TZWVkLnZhbHVlO1xuICAgIH1cblxuICAgIGNvbnN0IG1ldGhvZEludm9rZXIgPSBuZXcgTWV0aG9kSW52b2tlcih7XG4gICAgICBtZXRob2RJZCxcbiAgICAgIGNhbGxiYWNrOiBjYWxsYmFjayxcbiAgICAgIGNvbm5lY3Rpb246IHNlbGYsXG4gICAgICBvblJlc3VsdFJlY2VpdmVkOiBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQsXG4gICAgICB3YWl0OiAhIW9wdGlvbnMud2FpdCxcbiAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICBub1JldHJ5OiAhIW9wdGlvbnMubm9SZXRyeVxuICAgIH0pO1xuXG4gICAgaWYgKG9wdGlvbnMud2FpdCkge1xuICAgICAgLy8gSXQncyBhIHdhaXQgbWV0aG9kISBXYWl0IG1ldGhvZHMgZ28gaW4gdGhlaXIgb3duIGJsb2NrLlxuICAgICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MucHVzaCh7XG4gICAgICAgIHdhaXQ6IHRydWUsXG4gICAgICAgIG1ldGhvZHM6IFttZXRob2RJbnZva2VyXVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vdCBhIHdhaXQgbWV0aG9kLiBTdGFydCBhIG5ldyBibG9jayBpZiB0aGUgcHJldmlvdXMgYmxvY2sgd2FzIGEgd2FpdFxuICAgICAgLy8gYmxvY2ssIGFuZCBhZGQgaXQgdG8gdGhlIGxhc3QgYmxvY2sgb2YgbWV0aG9kcy5cbiAgICAgIGlmIChpc0VtcHR5KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSB8fFxuICAgICAgICAgIGxhc3Qoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpLndhaXQpIHtcbiAgICAgICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MucHVzaCh7XG4gICAgICAgICAgd2FpdDogZmFsc2UsXG4gICAgICAgICAgbWV0aG9kczogW10sXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBsYXN0KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKS5tZXRob2RzLnB1c2gobWV0aG9kSW52b2tlcik7XG4gICAgfVxuXG4gICAgLy8gSWYgd2UgYWRkZWQgaXQgdG8gdGhlIGZpcnN0IGJsb2NrLCBzZW5kIGl0IG91dCBub3cuXG4gICAgaWYgKHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLmxlbmd0aCA9PT0gMSkgbWV0aG9kSW52b2tlci5zZW5kTWVzc2FnZSgpO1xuXG4gICAgLy8gSWYgd2UncmUgdXNpbmcgdGhlIGRlZmF1bHQgY2FsbGJhY2sgb24gdGhlIHNlcnZlcixcbiAgICAvLyBibG9jayB3YWl0aW5nIGZvciB0aGUgcmVzdWx0LlxuICAgIGlmIChmdXR1cmUpIHtcbiAgICAgIC8vIFRoaXMgaXMgdGhlIHJlc3VsdCBvZiB0aGUgbWV0aG9kIHJhbiBpbiB0aGUgY2xpZW50LlxuICAgICAgLy8gWW91IGNhbiBvcHQtaW4gaW4gZ2V0dGluZyB0aGUgbG9jYWwgcmVzdWx0IGJ5IHJ1bm5pbmc6XG4gICAgICAvLyBjb25zdCB7IHN0dWJQcm9taXNlLCBzZXJ2ZXJQcm9taXNlIH0gPSBNZXRlb3IuY2FsbEFzeW5jKC4uLik7XG4gICAgICAvLyBjb25zdCB3aGF0U2VydmVyRGlkID0gYXdhaXQgc2VydmVyUHJvbWlzZTtcbiAgICAgIGlmIChvcHRpb25zLnJldHVyblN0dWJWYWx1ZSkge1xuICAgICAgICByZXR1cm4gZnV0dXJlLnRoZW4oKCkgPT4gc3R1YlJldHVyblZhbHVlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmdXR1cmU7XG4gICAgfVxuICAgIHJldHVybiBvcHRpb25zLnJldHVyblN0dWJWYWx1ZSA/IHN0dWJSZXR1cm5WYWx1ZSA6IHVuZGVmaW5lZDtcbiAgfVxuXG5cbiAgX3N0dWJDYWxsKG5hbWUsIGFyZ3MsIG9wdGlvbnMpIHtcbiAgICAvLyBSdW4gdGhlIHN0dWIsIGlmIHdlIGhhdmUgb25lLiBUaGUgc3R1YiBpcyBzdXBwb3NlZCB0byBtYWtlIHNvbWVcbiAgICAvLyB0ZW1wb3Jhcnkgd3JpdGVzIHRvIHRoZSBkYXRhYmFzZSB0byBnaXZlIHRoZSB1c2VyIGEgc21vb3RoIGV4cGVyaWVuY2VcbiAgICAvLyB1bnRpbCB0aGUgYWN0dWFsIHJlc3VsdCBvZiBleGVjdXRpbmcgdGhlIG1ldGhvZCBjb21lcyBiYWNrIGZyb20gdGhlXG4gICAgLy8gc2VydmVyICh3aGVyZXVwb24gdGhlIHRlbXBvcmFyeSB3cml0ZXMgdG8gdGhlIGRhdGFiYXNlIHdpbGwgYmUgcmV2ZXJzZWRcbiAgICAvLyBkdXJpbmcgdGhlIGJlZ2luVXBkYXRlL2VuZFVwZGF0ZSBwcm9jZXNzLilcbiAgICAvL1xuICAgIC8vIE5vcm1hbGx5LCB3ZSBpZ25vcmUgdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgc3R1YiAoZXZlbiBpZiBpdCBpcyBhblxuICAgIC8vIGV4Y2VwdGlvbiksIGluIGZhdm9yIG9mIHRoZSByZWFsIHJldHVybiB2YWx1ZSBmcm9tIHRoZSBzZXJ2ZXIuIFRoZVxuICAgIC8vIGV4Y2VwdGlvbiBpcyBpZiB0aGUgKmNhbGxlciogaXMgYSBzdHViLiBJbiB0aGF0IGNhc2UsIHdlJ3JlIG5vdCBnb2luZ1xuICAgIC8vIHRvIGRvIGEgUlBDLCBzbyB3ZSB1c2UgdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgc3R1YiBhcyBvdXIgcmV0dXJuXG4gICAgLy8gdmFsdWUuXG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3QgZW5jbG9zaW5nID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgICBjb25zdCBzdHViID0gc2VsZi5fbWV0aG9kSGFuZGxlcnNbbmFtZV07XG4gICAgY29uc3QgYWxyZWFkeUluU2ltdWxhdGlvbiA9IGVuY2xvc2luZz8uaXNTaW11bGF0aW9uO1xuICAgIGNvbnN0IGlzRnJvbUNhbGxBc3luYyA9IGVuY2xvc2luZz8uX2lzRnJvbUNhbGxBc3luYztcbiAgICBjb25zdCByYW5kb21TZWVkID0geyB2YWx1ZTogbnVsbH07XG5cbiAgICBjb25zdCBkZWZhdWx0UmV0dXJuID0ge1xuICAgICAgYWxyZWFkeUluU2ltdWxhdGlvbixcbiAgICAgIHJhbmRvbVNlZWQsXG4gICAgICBpc0Zyb21DYWxsQXN5bmMsXG4gICAgfTtcbiAgICBpZiAoIXN0dWIpIHtcbiAgICAgIHJldHVybiB7IC4uLmRlZmF1bHRSZXR1cm4sIGhhc1N0dWI6IGZhbHNlIH07XG4gICAgfVxuXG4gICAgLy8gTGF6aWx5IGdlbmVyYXRlIGEgcmFuZG9tU2VlZCwgb25seSBpZiBpdCBpcyByZXF1ZXN0ZWQgYnkgdGhlIHN0dWIuXG4gICAgLy8gVGhlIHJhbmRvbSBzdHJlYW1zIG9ubHkgaGF2ZSB1dGlsaXR5IGlmIHRoZXkncmUgdXNlZCBvbiBib3RoIHRoZSBjbGllbnRcbiAgICAvLyBhbmQgdGhlIHNlcnZlcjsgaWYgdGhlIGNsaWVudCBkb2Vzbid0IGdlbmVyYXRlIGFueSAncmFuZG9tJyB2YWx1ZXNcbiAgICAvLyB0aGVuIHdlIGRvbid0IGV4cGVjdCB0aGUgc2VydmVyIHRvIGdlbmVyYXRlIGFueSBlaXRoZXIuXG4gICAgLy8gTGVzcyBjb21tb25seSwgdGhlIHNlcnZlciBtYXkgcGVyZm9ybSBkaWZmZXJlbnQgYWN0aW9ucyBmcm9tIHRoZSBjbGllbnQsXG4gICAgLy8gYW5kIG1heSBpbiBmYWN0IGdlbmVyYXRlIHZhbHVlcyB3aGVyZSB0aGUgY2xpZW50IGRpZCBub3QsIGJ1dCB3ZSBkb24ndFxuICAgIC8vIGhhdmUgYW55IGNsaWVudC1zaWRlIHZhbHVlcyB0byBtYXRjaCwgc28gZXZlbiBoZXJlIHdlIG1heSBhcyB3ZWxsIGp1c3RcbiAgICAvLyB1c2UgYSByYW5kb20gc2VlZCBvbiB0aGUgc2VydmVyLiAgSW4gdGhhdCBjYXNlLCB3ZSBkb24ndCBwYXNzIHRoZVxuICAgIC8vIHJhbmRvbVNlZWQgdG8gc2F2ZSBiYW5kd2lkdGgsIGFuZCB3ZSBkb24ndCBldmVuIGdlbmVyYXRlIGl0IHRvIHNhdmUgYVxuICAgIC8vIGJpdCBvZiBDUFUgYW5kIHRvIGF2b2lkIGNvbnN1bWluZyBlbnRyb3B5LlxuXG4gICAgY29uc3QgcmFuZG9tU2VlZEdlbmVyYXRvciA9ICgpID0+IHtcbiAgICAgIGlmIChyYW5kb21TZWVkLnZhbHVlID09PSBudWxsKSB7XG4gICAgICAgIHJhbmRvbVNlZWQudmFsdWUgPSBERFBDb21tb24ubWFrZVJwY1NlZWQoZW5jbG9zaW5nLCBuYW1lKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByYW5kb21TZWVkLnZhbHVlO1xuICAgIH07XG5cbiAgICBjb25zdCBzZXRVc2VySWQgPSB1c2VySWQgPT4ge1xuICAgICAgc2VsZi5zZXRVc2VySWQodXNlcklkKTtcbiAgICB9O1xuXG4gICAgY29uc3QgaW52b2NhdGlvbiA9IG5ldyBERFBDb21tb24uTWV0aG9kSW52b2NhdGlvbih7XG4gICAgICBuYW1lLFxuICAgICAgaXNTaW11bGF0aW9uOiB0cnVlLFxuICAgICAgdXNlcklkOiBzZWxmLnVzZXJJZCgpLFxuICAgICAgaXNGcm9tQ2FsbEFzeW5jOiBvcHRpb25zPy5pc0Zyb21DYWxsQXN5bmMsXG4gICAgICBzZXRVc2VySWQ6IHNldFVzZXJJZCxcbiAgICAgIHJhbmRvbVNlZWQoKSB7XG4gICAgICAgIHJldHVybiByYW5kb21TZWVkR2VuZXJhdG9yKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBOb3RlIHRoYXQgdW5saWtlIGluIHRoZSBjb3JyZXNwb25kaW5nIHNlcnZlciBjb2RlLCB3ZSBuZXZlciBhdWRpdFxuICAgIC8vIHRoYXQgc3R1YnMgY2hlY2soKSB0aGVpciBhcmd1bWVudHMuXG4gICAgY29uc3Qgc3R1Ykludm9jYXRpb24gPSAoKSA9PiB7XG4gICAgICAgIGlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgICAgICAgICAvLyBCZWNhdXNlIHNhdmVPcmlnaW5hbHMgYW5kIHJldHJpZXZlT3JpZ2luYWxzIGFyZW4ndCByZWVudHJhbnQsXG4gICAgICAgICAgLy8gZG9uJ3QgYWxsb3cgc3R1YnMgdG8geWllbGQuXG4gICAgICAgICAgcmV0dXJuIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKCgpID0+IHtcbiAgICAgICAgICAgIC8vIHJlLWNsb25lLCBzbyB0aGF0IHRoZSBzdHViIGNhbid0IGFmZmVjdCBvdXIgY2FsbGVyJ3MgdmFsdWVzXG4gICAgICAgICAgICByZXR1cm4gc3R1Yi5hcHBseShpbnZvY2F0aW9uLCBFSlNPTi5jbG9uZShhcmdzKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHN0dWIuYXBwbHkoaW52b2NhdGlvbiwgRUpTT04uY2xvbmUoYXJncykpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICByZXR1cm4geyAuLi5kZWZhdWx0UmV0dXJuLCBoYXNTdHViOiB0cnVlLCBzdHViSW52b2NhdGlvbiwgaW52b2NhdGlvbiB9O1xuICB9XG5cbiAgLy8gQmVmb3JlIGNhbGxpbmcgYSBtZXRob2Qgc3R1YiwgcHJlcGFyZSBhbGwgc3RvcmVzIHRvIHRyYWNrIGNoYW5nZXMgYW5kIGFsbG93XG4gIC8vIF9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzIHRvIGdldCB0aGUgb3JpZ2luYWwgdmVyc2lvbnMgb2YgY2hhbmdlZFxuICAvLyBkb2N1bWVudHMuXG4gIF9zYXZlT3JpZ2luYWxzKCkge1xuICAgIGlmICghIHRoaXMuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgIHRoaXMuX2ZsdXNoQnVmZmVyZWRXcml0ZXNDbGllbnQoKTtcbiAgICB9XG5cbiAgICBPYmplY3QudmFsdWVzKHRoaXMuX3N0b3JlcykuZm9yRWFjaCgoc3RvcmUpID0+IHtcbiAgICAgIHN0b3JlLnNhdmVPcmlnaW5hbHMoKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFJldHJpZXZlcyB0aGUgb3JpZ2luYWwgdmVyc2lvbnMgb2YgYWxsIGRvY3VtZW50cyBtb2RpZmllZCBieSB0aGUgc3R1YiBmb3JcbiAgLy8gbWV0aG9kICdtZXRob2RJZCcgZnJvbSBhbGwgc3RvcmVzIGFuZCBzYXZlcyB0aGVtIHRvIF9zZXJ2ZXJEb2N1bWVudHMgKGtleWVkXG4gIC8vIGJ5IGRvY3VtZW50KSBhbmQgX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWIgKGtleWVkIGJ5IG1ldGhvZCBJRCkuXG4gIF9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzKG1ldGhvZElkKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdEdXBsaWNhdGUgbWV0aG9kSWQgaW4gX3JldHJpZXZlQW5kU3RvcmVPcmlnaW5hbHMnKTtcblxuICAgIGNvbnN0IGRvY3NXcml0dGVuID0gW107XG5cbiAgICBPYmplY3QuZW50cmllcyhzZWxmLl9zdG9yZXMpLmZvckVhY2goKFtjb2xsZWN0aW9uLCBzdG9yZV0pID0+IHtcbiAgICAgIGNvbnN0IG9yaWdpbmFscyA9IHN0b3JlLnJldHJpZXZlT3JpZ2luYWxzKCk7XG4gICAgICAvLyBub3QgYWxsIHN0b3JlcyBkZWZpbmUgcmV0cmlldmVPcmlnaW5hbHNcbiAgICAgIGlmICghIG9yaWdpbmFscykgcmV0dXJuO1xuICAgICAgb3JpZ2luYWxzLmZvckVhY2goKGRvYywgaWQpID0+IHtcbiAgICAgICAgZG9jc1dyaXR0ZW4ucHVzaCh7IGNvbGxlY3Rpb24sIGlkIH0pO1xuICAgICAgICBpZiAoISBoYXNPd24uY2FsbChzZWxmLl9zZXJ2ZXJEb2N1bWVudHMsIGNvbGxlY3Rpb24pKSB7XG4gICAgICAgICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzW2NvbGxlY3Rpb25dID0gbmV3IE1vbmdvSURNYXAoKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzZXJ2ZXJEb2MgPSBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbY29sbGVjdGlvbl0uc2V0RGVmYXVsdChcbiAgICAgICAgICBpZCxcbiAgICAgICAgICBPYmplY3QuY3JlYXRlKG51bGwpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMpIHtcbiAgICAgICAgICAvLyBXZSdyZSBub3QgdGhlIGZpcnN0IHN0dWIgdG8gd3JpdGUgdGhpcyBkb2MuIEp1c3QgYWRkIG91ciBtZXRob2QgSURcbiAgICAgICAgICAvLyB0byB0aGUgcmVjb3JkLlxuICAgICAgICAgIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF0gPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEZpcnN0IHN0dWIhIFNhdmUgdGhlIG9yaWdpbmFsIHZhbHVlIGFuZCBvdXIgbWV0aG9kIElELlxuICAgICAgICAgIHNlcnZlckRvYy5kb2N1bWVudCA9IGRvYztcbiAgICAgICAgICBzZXJ2ZXJEb2MuZmx1c2hDYWxsYmFja3MgPSBbXTtcbiAgICAgICAgICBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgICAgIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBpZiAoISBpc0VtcHR5KGRvY3NXcml0dGVuKSkge1xuICAgICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YlttZXRob2RJZF0gPSBkb2NzV3JpdHRlbjtcbiAgICB9XG4gIH1cblxuICAvLyBUaGlzIGlzIHZlcnkgbXVjaCBhIHByaXZhdGUgZnVuY3Rpb24gd2UgdXNlIHRvIG1ha2UgdGhlIHRlc3RzXG4gIC8vIHRha2UgdXAgZmV3ZXIgc2VydmVyIHJlc291cmNlcyBhZnRlciB0aGV5IGNvbXBsZXRlLlxuICBfdW5zdWJzY3JpYmVBbGwoKSB7XG4gICAgT2JqZWN0LnZhbHVlcyh0aGlzLl9zdWJzY3JpcHRpb25zKS5mb3JFYWNoKChzdWIpID0+IHtcbiAgICAgIC8vIEF2b2lkIGtpbGxpbmcgdGhlIGF1dG91cGRhdGUgc3Vic2NyaXB0aW9uIHNvIHRoYXQgZGV2ZWxvcGVyc1xuICAgICAgLy8gc3RpbGwgZ2V0IGhvdCBjb2RlIHB1c2hlcyB3aGVuIHdyaXRpbmcgdGVzdHMuXG4gICAgICAvL1xuICAgICAgLy8gWFhYIGl0J3MgYSBoYWNrIHRvIGVuY29kZSBrbm93bGVkZ2UgYWJvdXQgYXV0b3VwZGF0ZSBoZXJlLFxuICAgICAgLy8gYnV0IGl0IGRvZXNuJ3Qgc2VlbSB3b3J0aCBpdCB5ZXQgdG8gaGF2ZSBhIHNwZWNpYWwgQVBJIGZvclxuICAgICAgLy8gc3Vic2NyaXB0aW9ucyB0byBwcmVzZXJ2ZSBhZnRlciB1bml0IHRlc3RzLlxuICAgICAgaWYgKHN1Yi5uYW1lICE9PSAnbWV0ZW9yX2F1dG91cGRhdGVfY2xpZW50VmVyc2lvbnMnKSB7XG4gICAgICAgIHN1Yi5zdG9wKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBTZW5kcyB0aGUgRERQIHN0cmluZ2lmaWNhdGlvbiBvZiB0aGUgZ2l2ZW4gbWVzc2FnZSBvYmplY3RcbiAgX3NlbmQob2JqKSB7XG4gICAgdGhpcy5fc3RyZWFtLnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUChvYmopKTtcbiAgfVxuXG4gIC8vIEFsd2F5cyBxdWV1ZXMgdGhlIGNhbGwgYmVmb3JlIHNlbmRpbmcgdGhlIG1lc3NhZ2VcbiAgLy8gVXNlZCwgZm9yIGV4YW1wbGUsIG9uIHN1YnNjcmlwdGlvbi5baWRdLnN0b3AoKSB0byBtYWtlIHN1cmUgYSBcInN1YlwiIG1lc3NhZ2UgaXMgYWx3YXlzIGNhbGxlZCBiZWZvcmUgYW4gXCJ1bnN1YlwiIG1lc3NhZ2VcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzEzMjEyXG4gIC8vXG4gIC8vIFRoaXMgaXMgcGFydCBvZiB0aGUgYWN0dWFsIGZpeCBmb3IgdGhlIHJlc3QgY2hlY2s6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL3B1bGwvMTMyMzZcbiAgX3NlbmRRdWV1ZWQob2JqKSB7XG4gICAgdGhpcy5fc2VuZChvYmosIHRydWUpO1xuICB9XG5cbiAgLy8gV2UgZGV0ZWN0ZWQgdmlhIEREUC1sZXZlbCBoZWFydGJlYXRzIHRoYXQgd2UndmUgbG9zdCB0aGVcbiAgLy8gY29ubmVjdGlvbi4gIFVubGlrZSBgZGlzY29ubmVjdGAgb3IgYGNsb3NlYCwgYSBsb3N0IGNvbm5lY3Rpb25cbiAgLy8gd2lsbCBiZSBhdXRvbWF0aWNhbGx5IHJldHJpZWQuXG4gIF9sb3N0Q29ubmVjdGlvbihlcnJvcikge1xuICAgIHRoaXMuX3N0cmVhbS5fbG9zdENvbm5lY3Rpb24oZXJyb3IpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLnN0YXR1c1xuICAgKiBAc3VtbWFyeSBHZXQgdGhlIGN1cnJlbnQgY29ubmVjdGlvbiBzdGF0dXMuIEEgcmVhY3RpdmUgZGF0YSBzb3VyY2UuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICovXG4gIHN0YXR1cyguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0cmVhbS5zdGF0dXMoLi4uYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgRm9yY2UgYW4gaW1tZWRpYXRlIHJlY29ubmVjdGlvbiBhdHRlbXB0IGlmIHRoZSBjbGllbnQgaXMgbm90IGNvbm5lY3RlZCB0byB0aGUgc2VydmVyLlxuXG4gIFRoaXMgbWV0aG9kIGRvZXMgbm90aGluZyBpZiB0aGUgY2xpZW50IGlzIGFscmVhZHkgY29ubmVjdGVkLlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5yZWNvbm5lY3RcbiAgICogQGxvY3VzIENsaWVudFxuICAgKi9cbiAgcmVjb25uZWN0KC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtLnJlY29ubmVjdCguLi5hcmdzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5kaXNjb25uZWN0XG4gICAqIEBzdW1tYXJ5IERpc2Nvbm5lY3QgdGhlIGNsaWVudCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICovXG4gIGRpc2Nvbm5lY3QoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9zdHJlYW0uZGlzY29ubmVjdCguLi5hcmdzKTtcbiAgfVxuXG4gIGNsb3NlKCkge1xuICAgIHJldHVybiB0aGlzLl9zdHJlYW0uZGlzY29ubmVjdCh7IF9wZXJtYW5lbnQ6IHRydWUgfSk7XG4gIH1cblxuICAvLy9cbiAgLy8vIFJlYWN0aXZlIHVzZXIgc3lzdGVtXG4gIC8vL1xuICB1c2VySWQoKSB7XG4gICAgaWYgKHRoaXMuX3VzZXJJZERlcHMpIHRoaXMuX3VzZXJJZERlcHMuZGVwZW5kKCk7XG4gICAgcmV0dXJuIHRoaXMuX3VzZXJJZDtcbiAgfVxuXG4gIHNldFVzZXJJZCh1c2VySWQpIHtcbiAgICAvLyBBdm9pZCBpbnZhbGlkYXRpbmcgZGVwZW5kZW50cyBpZiBzZXRVc2VySWQgaXMgY2FsbGVkIHdpdGggY3VycmVudCB2YWx1ZS5cbiAgICBpZiAodGhpcy5fdXNlcklkID09PSB1c2VySWQpIHJldHVybjtcbiAgICB0aGlzLl91c2VySWQgPSB1c2VySWQ7XG4gICAgaWYgKHRoaXMuX3VzZXJJZERlcHMpIHRoaXMuX3VzZXJJZERlcHMuY2hhbmdlZCgpO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0cnVlIGlmIHdlIGFyZSBpbiBhIHN0YXRlIGFmdGVyIHJlY29ubmVjdCBvZiB3YWl0aW5nIGZvciBzdWJzIHRvIGJlXG4gIC8vIHJldml2ZWQgb3IgZWFybHkgbWV0aG9kcyB0byBmaW5pc2ggdGhlaXIgZGF0YSwgb3Igd2UgYXJlIHdhaXRpbmcgZm9yIGFcbiAgLy8gXCJ3YWl0XCIgbWV0aG9kIHRvIGZpbmlzaC5cbiAgX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkge1xuICAgIHJldHVybiAoXG4gICAgICAhIGlzRW1wdHkodGhpcy5fc3Vic0JlaW5nUmV2aXZlZCkgfHxcbiAgICAgICEgaXNFbXB0eSh0aGlzLl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlKVxuICAgICk7XG4gIH1cblxuICAvLyBSZXR1cm5zIHRydWUgaWYgYW55IG1ldGhvZCB3aG9zZSBtZXNzYWdlIGhhcyBiZWVuIHNlbnQgdG8gdGhlIHNlcnZlciBoYXNcbiAgLy8gbm90IHlldCBpbnZva2VkIGl0cyB1c2VyIGNhbGxiYWNrLlxuICBfYW55TWV0aG9kc0FyZU91dHN0YW5kaW5nKCkge1xuICAgIGNvbnN0IGludm9rZXJzID0gdGhpcy5fbWV0aG9kSW52b2tlcnM7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXMoaW52b2tlcnMpLnNvbWUoKGludm9rZXIpID0+ICEhaW52b2tlci5zZW50TWVzc2FnZSk7XG4gIH1cblxuICBhc3luYyBfbGl2ZWRhdGFfY29ubmVjdGVkKG1zZykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHNlbGYuX3ZlcnNpb24gIT09ICdwcmUxJyAmJiBzZWxmLl9oZWFydGJlYXRJbnRlcnZhbCAhPT0gMCkge1xuICAgICAgc2VsZi5faGVhcnRiZWF0ID0gbmV3IEREUENvbW1vbi5IZWFydGJlYXQoe1xuICAgICAgICBoZWFydGJlYXRJbnRlcnZhbDogc2VsZi5faGVhcnRiZWF0SW50ZXJ2YWwsXG4gICAgICAgIGhlYXJ0YmVhdFRpbWVvdXQ6IHNlbGYuX2hlYXJ0YmVhdFRpbWVvdXQsXG4gICAgICAgIG9uVGltZW91dCgpIHtcbiAgICAgICAgICBzZWxmLl9sb3N0Q29ubmVjdGlvbihcbiAgICAgICAgICAgIG5ldyBERFAuQ29ubmVjdGlvbkVycm9yKCdERFAgaGVhcnRiZWF0IHRpbWVkIG91dCcpXG4gICAgICAgICAgKTtcbiAgICAgICAgfSxcbiAgICAgICAgc2VuZFBpbmcoKSB7XG4gICAgICAgICAgc2VsZi5fc2VuZCh7IG1zZzogJ3BpbmcnIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHNlbGYuX2hlYXJ0YmVhdC5zdGFydCgpO1xuICAgIH1cblxuICAgIC8vIElmIHRoaXMgaXMgYSByZWNvbm5lY3QsIHdlJ2xsIGhhdmUgdG8gcmVzZXQgYWxsIHN0b3Jlcy5cbiAgICBpZiAoc2VsZi5fbGFzdFNlc3Npb25JZCkgc2VsZi5fcmVzZXRTdG9yZXMgPSB0cnVlO1xuXG4gICAgbGV0IHJlY29ubmVjdGVkVG9QcmV2aW91c1Nlc3Npb247XG4gICAgaWYgKHR5cGVvZiBtc2cuc2Vzc2lvbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJlY29ubmVjdGVkVG9QcmV2aW91c1Nlc3Npb24gPSBzZWxmLl9sYXN0U2Vzc2lvbklkID09PSBtc2cuc2Vzc2lvbjtcbiAgICAgIHNlbGYuX2xhc3RTZXNzaW9uSWQgPSBtc2cuc2Vzc2lvbjtcbiAgICB9XG5cbiAgICBpZiAocmVjb25uZWN0ZWRUb1ByZXZpb3VzU2Vzc2lvbikge1xuICAgICAgLy8gU3VjY2Vzc2Z1bCByZWNvbm5lY3Rpb24gLS0gcGljayB1cCB3aGVyZSB3ZSBsZWZ0IG9mZi4gIE5vdGUgdGhhdCByaWdodFxuICAgICAgLy8gbm93LCB0aGlzIG5ldmVyIGhhcHBlbnM6IHRoZSBzZXJ2ZXIgbmV2ZXIgY29ubmVjdHMgdXMgdG8gYSBwcmV2aW91c1xuICAgICAgLy8gc2Vzc2lvbiwgYmVjYXVzZSBERFAgZG9lc24ndCBwcm92aWRlIGVub3VnaCBkYXRhIGZvciB0aGUgc2VydmVyIHRvIGtub3dcbiAgICAgIC8vIHdoYXQgbWVzc2FnZXMgdGhlIGNsaWVudCBoYXMgcHJvY2Vzc2VkLiBXZSBuZWVkIHRvIGltcHJvdmUgRERQIHRvIG1ha2VcbiAgICAgIC8vIHRoaXMgcG9zc2libGUsIGF0IHdoaWNoIHBvaW50IHdlJ2xsIHByb2JhYmx5IG5lZWQgbW9yZSBjb2RlIGhlcmUuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gU2VydmVyIGRvZXNuJ3QgaGF2ZSBvdXIgZGF0YSBhbnkgbW9yZS4gUmUtc3luYyBhIG5ldyBzZXNzaW9uLlxuXG4gICAgLy8gRm9yZ2V0IGFib3V0IG1lc3NhZ2VzIHdlIHdlcmUgYnVmZmVyaW5nIGZvciB1bmtub3duIGNvbGxlY3Rpb25zLiBUaGV5J2xsXG4gICAgLy8gYmUgcmVzZW50IGlmIHN0aWxsIHJlbGV2YW50LlxuICAgIHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIGlmIChzZWxmLl9yZXNldFN0b3Jlcykge1xuICAgICAgLy8gRm9yZ2V0IGFib3V0IHRoZSBlZmZlY3RzIG9mIHN0dWJzLiBXZSdsbCBiZSByZXNldHRpbmcgYWxsIGNvbGxlY3Rpb25zXG4gICAgICAvLyBhbnl3YXkuXG4gICAgICBzZWxmLl9kb2N1bWVudHNXcml0dGVuQnlTdHViID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAgIHNlbGYuX3NlcnZlckRvY3VtZW50cyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgfVxuXG4gICAgLy8gQ2xlYXIgX2FmdGVyVXBkYXRlQ2FsbGJhY2tzLlxuICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzID0gW107XG5cbiAgICAvLyBNYXJrIGFsbCBuYW1lZCBzdWJzY3JpcHRpb25zIHdoaWNoIGFyZSByZWFkeSAoaWUsIHdlIGFscmVhZHkgY2FsbGVkIHRoZVxuICAgIC8vIHJlYWR5IGNhbGxiYWNrKSBhcyBuZWVkaW5nIHRvIGJlIHJldml2ZWQuXG4gICAgLy8gWFhYIFdlIHNob3VsZCBhbHNvIGJsb2NrIHJlY29ubmVjdCBxdWllc2NlbmNlIHVudGlsIHVubmFtZWQgc3Vic2NyaXB0aW9uc1xuICAgIC8vICAgICAoZWcsIGF1dG9wdWJsaXNoKSBhcmUgZG9uZSByZS1wdWJsaXNoaW5nIHRvIGF2b2lkIGZsaWNrZXIhXG4gICAgc2VsZi5fc3Vic0JlaW5nUmV2aXZlZCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgT2JqZWN0LmVudHJpZXMoc2VsZi5fc3Vic2NyaXB0aW9ucykuZm9yRWFjaCgoW2lkLCBzdWJdKSA9PiB7XG4gICAgICBpZiAoc3ViLnJlYWR5KSB7XG4gICAgICAgIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWRbaWRdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEFycmFuZ2UgZm9yIFwiaGFsZi1maW5pc2hlZFwiIG1ldGhvZHMgdG8gaGF2ZSB0aGVpciBjYWxsYmFja3MgcnVuLCBhbmRcbiAgICAvLyB0cmFjayBtZXRob2RzIHRoYXQgd2VyZSBzZW50IG9uIHRoaXMgY29ubmVjdGlvbiBzbyB0aGF0IHdlIGRvbid0XG4gICAgLy8gcXVpZXNjZSB1bnRpbCB0aGV5IGFyZSBhbGwgZG9uZS5cbiAgICAvL1xuICAgIC8vIFN0YXJ0IGJ5IGNsZWFyaW5nIF9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlOiBtZXRob2RzIHNlbnQgYmVmb3JlXG4gICAgLy8gcmVjb25uZWN0IGRvbid0IG1hdHRlciwgYW5kIGFueSBcIndhaXRcIiBtZXRob2RzIHNlbnQgb24gdGhlIG5ldyBjb25uZWN0aW9uXG4gICAgLy8gdGhhdCB3ZSBkcm9wIGhlcmUgd2lsbCBiZSByZXN0b3JlZCBieSB0aGUgbG9vcCBiZWxvdy5cbiAgICBzZWxmLl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBpZiAoc2VsZi5fcmVzZXRTdG9yZXMpIHtcbiAgICAgIGNvbnN0IGludm9rZXJzID0gc2VsZi5fbWV0aG9kSW52b2tlcnM7XG4gICAgICBrZXlzKGludm9rZXJzKS5mb3JFYWNoKGlkID0+IHtcbiAgICAgICAgY29uc3QgaW52b2tlciA9IGludm9rZXJzW2lkXTtcbiAgICAgICAgaWYgKGludm9rZXIuZ290UmVzdWx0KCkpIHtcbiAgICAgICAgICAvLyBUaGlzIG1ldGhvZCBhbHJlYWR5IGdvdCBpdHMgcmVzdWx0LCBidXQgaXQgZGlkbid0IGNhbGwgaXRzIGNhbGxiYWNrXG4gICAgICAgICAgLy8gYmVjYXVzZSBpdHMgZGF0YSBkaWRuJ3QgYmVjb21lIHZpc2libGUuIFdlIGRpZCBub3QgcmVzZW5kIHRoZVxuICAgICAgICAgIC8vIG1ldGhvZCBSUEMuIFdlJ2xsIGNhbGwgaXRzIGNhbGxiYWNrIHdoZW4gd2UgZ2V0IGEgZnVsbCBxdWllc2NlLFxuICAgICAgICAgIC8vIHNpbmNlIHRoYXQncyBhcyBjbG9zZSBhcyB3ZSdsbCBnZXQgdG8gXCJkYXRhIG11c3QgYmUgdmlzaWJsZVwiLlxuICAgICAgICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzLnB1c2goXG4gICAgICAgICAgICAoLi4uYXJncykgPT4gaW52b2tlci5kYXRhVmlzaWJsZSguLi5hcmdzKVxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSBpZiAoaW52b2tlci5zZW50TWVzc2FnZSkge1xuICAgICAgICAgIC8vIFRoaXMgbWV0aG9kIGhhcyBiZWVuIHNlbnQgb24gdGhpcyBjb25uZWN0aW9uIChtYXliZSBhcyBhIHJlc2VuZFxuICAgICAgICAgIC8vIGZyb20gdGhlIGxhc3QgY29ubmVjdGlvbiwgbWF5YmUgZnJvbSBvblJlY29ubmVjdCwgbWF5YmUganVzdCB2ZXJ5XG4gICAgICAgICAgLy8gcXVpY2tseSBiZWZvcmUgcHJvY2Vzc2luZyB0aGUgY29ubmVjdGVkIG1lc3NhZ2UpLlxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gV2UgZG9uJ3QgbmVlZCB0byBkbyBhbnl0aGluZyBzcGVjaWFsIHRvIGVuc3VyZSBpdHMgY2FsbGJhY2tzIGdldFxuICAgICAgICAgIC8vIGNhbGxlZCwgYnV0IHdlJ2xsIGNvdW50IGl0IGFzIGEgbWV0aG9kIHdoaWNoIGlzIHByZXZlbnRpbmdcbiAgICAgICAgICAvLyByZWNvbm5lY3QgcXVpZXNjZW5jZS4gKGVnLCBpdCBtaWdodCBiZSBhIGxvZ2luIG1ldGhvZCB0aGF0IHdhcyBydW5cbiAgICAgICAgICAvLyBmcm9tIG9uUmVjb25uZWN0LCBhbmQgd2UgZG9uJ3Qgd2FudCB0byBzZWUgZmxpY2tlciBieSBzZWVpbmcgYVxuICAgICAgICAgIC8vIGxvZ2dlZC1vdXQgc3RhdGUuKVxuICAgICAgICAgIHNlbGYuX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2VbaW52b2tlci5tZXRob2RJZF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlID0gW107XG5cbiAgICAvLyBJZiB3ZSdyZSBub3Qgd2FpdGluZyBvbiBhbnkgbWV0aG9kcyBvciBzdWJzLCB3ZSBjYW4gcmVzZXQgdGhlIHN0b3JlcyBhbmRcbiAgICAvLyBjYWxsIHRoZSBjYWxsYmFja3MgaW1tZWRpYXRlbHkuXG4gICAgaWYgKCEgc2VsZi5fd2FpdGluZ0ZvclF1aWVzY2VuY2UoKSkge1xuICAgICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzKSB7XG4gICAgICAgIGZvciAoY29uc3Qgc3RvcmUgb2YgT2JqZWN0LnZhbHVlcyhzZWxmLl9zdG9yZXMpKSB7XG4gICAgICAgICAgYXdhaXQgc3RvcmUuYmVnaW5VcGRhdGUoMCwgdHJ1ZSk7XG4gICAgICAgICAgYXdhaXQgc3RvcmUuZW5kVXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi5fcmVzZXRTdG9yZXMgPSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHNlbGYuX3J1bkFmdGVyVXBkYXRlQ2FsbGJhY2tzKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgX3Byb2Nlc3NPbmVEYXRhTWVzc2FnZShtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBtZXNzYWdlVHlwZSA9IG1zZy5tc2c7XG5cbiAgICAvLyBtc2cgaXMgb25lIG9mIFsnYWRkZWQnLCAnY2hhbmdlZCcsICdyZW1vdmVkJywgJ3JlYWR5JywgJ3VwZGF0ZWQnXVxuICAgIGlmIChtZXNzYWdlVHlwZSA9PT0gJ2FkZGVkJykge1xuICAgICAgYXdhaXQgdGhpcy5fcHJvY2Vzc19hZGRlZChtc2csIHVwZGF0ZXMpO1xuICAgIH0gZWxzZSBpZiAobWVzc2FnZVR5cGUgPT09ICdjaGFuZ2VkJykge1xuICAgICAgdGhpcy5fcHJvY2Vzc19jaGFuZ2VkKG1zZywgdXBkYXRlcyk7XG4gICAgfSBlbHNlIGlmIChtZXNzYWdlVHlwZSA9PT0gJ3JlbW92ZWQnKSB7XG4gICAgICB0aGlzLl9wcm9jZXNzX3JlbW92ZWQobXNnLCB1cGRhdGVzKTtcbiAgICB9IGVsc2UgaWYgKG1lc3NhZ2VUeXBlID09PSAncmVhZHknKSB7XG4gICAgICB0aGlzLl9wcm9jZXNzX3JlYWR5KG1zZywgdXBkYXRlcyk7XG4gICAgfSBlbHNlIGlmIChtZXNzYWdlVHlwZSA9PT0gJ3VwZGF0ZWQnKSB7XG4gICAgICB0aGlzLl9wcm9jZXNzX3VwZGF0ZWQobXNnLCB1cGRhdGVzKTtcbiAgICB9IGVsc2UgaWYgKG1lc3NhZ2VUeXBlID09PSAnbm9zdWInKSB7XG4gICAgICAvLyBpZ25vcmUgdGhpc1xuICAgIH0gZWxzZSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKCdkaXNjYXJkaW5nIHVua25vd24gbGl2ZWRhdGEgZGF0YSBtZXNzYWdlIHR5cGUnLCBtc2cpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIF9saXZlZGF0YV9kYXRhKG1zZykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHNlbGYuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgIHNlbGYuX21lc3NhZ2VzQnVmZmVyZWRVbnRpbFF1aWVzY2VuY2UucHVzaChtc2cpO1xuXG4gICAgICBpZiAobXNnLm1zZyA9PT0gJ25vc3ViJykge1xuICAgICAgICBkZWxldGUgc2VsZi5fc3Vic0JlaW5nUmV2aXZlZFttc2cuaWRdO1xuICAgICAgfVxuXG4gICAgICBpZiAobXNnLnN1YnMpIHtcbiAgICAgICAgbXNnLnN1YnMuZm9yRWFjaChzdWJJZCA9PiB7XG4gICAgICAgICAgZGVsZXRlIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWRbc3ViSWRdO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1zZy5tZXRob2RzKSB7XG4gICAgICAgIG1zZy5tZXRob2RzLmZvckVhY2gobWV0aG9kSWQgPT4ge1xuICAgICAgICAgIGRlbGV0ZSBzZWxmLl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlW21ldGhvZElkXTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChzZWxmLl93YWl0aW5nRm9yUXVpZXNjZW5jZSgpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gTm8gbWV0aG9kcyBvciBzdWJzIGFyZSBibG9ja2luZyBxdWllc2NlbmNlIVxuICAgICAgLy8gV2UnbGwgbm93IHByb2Nlc3MgYW5kIGFsbCBvZiBvdXIgYnVmZmVyZWQgbWVzc2FnZXMsIHJlc2V0IGFsbCBzdG9yZXMsXG4gICAgICAvLyBhbmQgYXBwbHkgdGhlbSBhbGwgYXQgb25jZS5cblxuICAgICAgY29uc3QgYnVmZmVyZWRNZXNzYWdlcyA9IHNlbGYuX21lc3NhZ2VzQnVmZmVyZWRVbnRpbFF1aWVzY2VuY2U7XG4gICAgICBmb3IgKGNvbnN0IGJ1ZmZlcmVkTWVzc2FnZSBvZiBPYmplY3QudmFsdWVzKGJ1ZmZlcmVkTWVzc2FnZXMpKSB7XG4gICAgICAgIGF3YWl0IHNlbGYuX3Byb2Nlc3NPbmVEYXRhTWVzc2FnZShcbiAgICAgICAgICBidWZmZXJlZE1lc3NhZ2UsXG4gICAgICAgICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSA9IFtdO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGF3YWl0IHNlbGYuX3Byb2Nlc3NPbmVEYXRhTWVzc2FnZShtc2csIHNlbGYuX2J1ZmZlcmVkV3JpdGVzKTtcbiAgICB9XG5cbiAgICAvLyBJbW1lZGlhdGVseSBmbHVzaCB3cml0ZXMgd2hlbjpcbiAgICAvLyAgMS4gQnVmZmVyaW5nIGlzIGRpc2FibGVkLiBPcjtcbiAgICAvLyAgMi4gYW55IG5vbi0oYWRkZWQvY2hhbmdlZC9yZW1vdmVkKSBtZXNzYWdlIGFycml2ZXMuXG4gICAgY29uc3Qgc3RhbmRhcmRXcml0ZSA9XG4gICAgICBtc2cubXNnID09PSBcImFkZGVkXCIgfHxcbiAgICAgIG1zZy5tc2cgPT09IFwiY2hhbmdlZFwiIHx8XG4gICAgICBtc2cubXNnID09PSBcInJlbW92ZWRcIjtcblxuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ludGVydmFsID09PSAwIHx8ICEgc3RhbmRhcmRXcml0ZSkge1xuICAgICAgYXdhaXQgc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPT09IG51bGwpIHtcbiAgICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCA9XG4gICAgICAgIG5ldyBEYXRlKCkudmFsdWVPZigpICsgc2VsZi5fYnVmZmVyZWRXcml0ZXNNYXhBZ2U7XG4gICAgfSBlbHNlIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPCBuZXcgRGF0ZSgpLnZhbHVlT2YoKSkge1xuICAgICAgYXdhaXQgc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKSB7XG4gICAgICBjbGVhclRpbWVvdXQoc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSk7XG4gICAgfVxuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIC8vIF9fZmx1c2hCdWZmZXJlZFdyaXRlcyBpcyBhIHByb21pc2UsIHNvIHdpdGggdGhpcyB3ZSBjYW4gd2FpdCB0aGUgcHJvbWlzZSB0byBmaW5pc2hcbiAgICAgIC8vIGJlZm9yZSBkb2luZyBzb21ldGhpbmdcbiAgICAgIHNlbGYuX2xpdmVEYXRhV3JpdGVzUHJvbWlzZSA9IHNlbGYuX19mbHVzaEJ1ZmZlcmVkV3JpdGVzKCk7XG5cbiAgICAgIGlmIChNZXRlb3IuX2lzUHJvbWlzZShzZWxmLl9saXZlRGF0YVdyaXRlc1Byb21pc2UpKSB7XG4gICAgICAgIHNlbGYuX2xpdmVEYXRhV3JpdGVzUHJvbWlzZS5maW5hbGx5KFxuICAgICAgICAgICgpID0+IChzZWxmLl9saXZlRGF0YVdyaXRlc1Byb21pc2UgPSB1bmRlZmluZWQpXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSwgc2VsZi5fYnVmZmVyZWRXcml0ZXNJbnRlcnZhbCk7XG4gIH1cblxuICBfcHJlcGFyZUJ1ZmZlcnNUb0ZsdXNoKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKSB7XG4gICAgICBjbGVhclRpbWVvdXQoc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSk7XG4gICAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlID0gbnVsbDtcbiAgICB9XG5cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPSBudWxsO1xuICAgIC8vIFdlIG5lZWQgdG8gY2xlYXIgdGhlIGJ1ZmZlciBiZWZvcmUgcGFzc2luZyBpdCB0b1xuICAgIC8vICBwZXJmb3JtV3JpdGVzLiBBcyB0aGVyZSdzIG5vIGd1YXJhbnRlZSB0aGF0IGl0XG4gICAgLy8gIHdpbGwgZXhpdCBjbGVhbmx5LlxuICAgIGNvbnN0IHdyaXRlcyA9IHNlbGYuX2J1ZmZlcmVkV3JpdGVzO1xuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICByZXR1cm4gd3JpdGVzO1xuICB9XG5cbiAgYXN5bmMgX2ZsdXNoQnVmZmVyZWRXcml0ZXNTZXJ2ZXIoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3Qgd3JpdGVzID0gc2VsZi5fcHJlcGFyZUJ1ZmZlcnNUb0ZsdXNoKCk7XG4gICAgYXdhaXQgc2VsZi5fcGVyZm9ybVdyaXRlc1NlcnZlcih3cml0ZXMpO1xuICB9XG4gIF9mbHVzaEJ1ZmZlcmVkV3JpdGVzQ2xpZW50KCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHdyaXRlcyA9IHNlbGYuX3ByZXBhcmVCdWZmZXJzVG9GbHVzaCgpO1xuICAgIHNlbGYuX3BlcmZvcm1Xcml0ZXNDbGllbnQod3JpdGVzKTtcbiAgfVxuICBfZmx1c2hCdWZmZXJlZFdyaXRlcygpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gTWV0ZW9yLmlzQ2xpZW50XG4gICAgICA/IHNlbGYuX2ZsdXNoQnVmZmVyZWRXcml0ZXNDbGllbnQoKVxuICAgICAgOiBzZWxmLl9mbHVzaEJ1ZmZlcmVkV3JpdGVzU2VydmVyKCk7XG4gIH1cbiAgYXN5bmMgX3BlcmZvcm1Xcml0ZXNTZXJ2ZXIodXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzIHx8ICEgaXNFbXB0eSh1cGRhdGVzKSkge1xuICAgICAgLy8gQmVnaW4gYSB0cmFuc2FjdGlvbmFsIHVwZGF0ZSBvZiBlYWNoIHN0b3JlLlxuXG4gICAgICBmb3IgKGNvbnN0IFtzdG9yZU5hbWUsIHN0b3JlXSBvZiBPYmplY3QuZW50cmllcyhzZWxmLl9zdG9yZXMpKSB7XG4gICAgICAgIGF3YWl0IHN0b3JlLmJlZ2luVXBkYXRlKFxuICAgICAgICAgIGhhc093bi5jYWxsKHVwZGF0ZXMsIHN0b3JlTmFtZSlcbiAgICAgICAgICAgID8gdXBkYXRlc1tzdG9yZU5hbWVdLmxlbmd0aFxuICAgICAgICAgICAgOiAwLFxuICAgICAgICAgIHNlbGYuX3Jlc2V0U3RvcmVzXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHNlbGYuX3Jlc2V0U3RvcmVzID0gZmFsc2U7XG5cbiAgICAgIGZvciAoY29uc3QgW3N0b3JlTmFtZSwgdXBkYXRlTWVzc2FnZXNdIG9mIE9iamVjdC5lbnRyaWVzKHVwZGF0ZXMpKSB7XG4gICAgICAgIGNvbnN0IHN0b3JlID0gc2VsZi5fc3RvcmVzW3N0b3JlTmFtZV07XG4gICAgICAgIGlmIChzdG9yZSkge1xuICAgICAgICAgIGZvciAoY29uc3QgdXBkYXRlTWVzc2FnZSBvZiB1cGRhdGVNZXNzYWdlcykge1xuICAgICAgICAgICAgYXdhaXQgc3RvcmUudXBkYXRlKHVwZGF0ZU1lc3NhZ2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBOb2JvZHkncyBsaXN0ZW5pbmcgZm9yIHRoaXMgZGF0YS4gUXVldWUgaXQgdXAgdW50aWxcbiAgICAgICAgICAvLyBzb21lb25lIHdhbnRzIGl0LlxuICAgICAgICAgIC8vIFhYWCBtZW1vcnkgdXNlIHdpbGwgZ3JvdyB3aXRob3V0IGJvdW5kIGlmIHlvdSBmb3JnZXQgdG9cbiAgICAgICAgICAvLyBjcmVhdGUgYSBjb2xsZWN0aW9uIG9yIGp1c3QgZG9uJ3QgY2FyZSBhYm91dCBpdC4uLiBnb2luZ1xuICAgICAgICAgIC8vIHRvIGhhdmUgdG8gZG8gc29tZXRoaW5nIGFib3V0IHRoYXQuXG4gICAgICAgICAgY29uc3QgdXBkYXRlcyA9IHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzO1xuXG4gICAgICAgICAgaWYgKCEgaGFzT3duLmNhbGwodXBkYXRlcywgc3RvcmVOYW1lKSkge1xuICAgICAgICAgICAgdXBkYXRlc1tzdG9yZU5hbWVdID0gW107XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdXBkYXRlc1tzdG9yZU5hbWVdLnB1c2goLi4udXBkYXRlTWVzc2FnZXMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBFbmQgdXBkYXRlIHRyYW5zYWN0aW9uLlxuICAgICAgZm9yIChjb25zdCBzdG9yZSBvZiBPYmplY3QudmFsdWVzKHNlbGYuX3N0b3JlcykpIHtcbiAgICAgICAgYXdhaXQgc3RvcmUuZW5kVXBkYXRlKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc2VsZi5fcnVuQWZ0ZXJVcGRhdGVDYWxsYmFja3MoKTtcbiAgfVxuICBfcGVyZm9ybVdyaXRlc0NsaWVudCh1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoc2VsZi5fcmVzZXRTdG9yZXMgfHwgISBpc0VtcHR5KHVwZGF0ZXMpKSB7XG4gICAgICAvLyBCZWdpbiBhIHRyYW5zYWN0aW9uYWwgdXBkYXRlIG9mIGVhY2ggc3RvcmUuXG5cbiAgICAgIGZvciAoY29uc3QgW3N0b3JlTmFtZSwgc3RvcmVdIG9mIE9iamVjdC5lbnRyaWVzKHNlbGYuX3N0b3JlcykpIHtcbiAgICAgICAgc3RvcmUuYmVnaW5VcGRhdGUoXG4gICAgICAgICAgaGFzT3duLmNhbGwodXBkYXRlcywgc3RvcmVOYW1lKVxuICAgICAgICAgICAgPyB1cGRhdGVzW3N0b3JlTmFtZV0ubGVuZ3RoXG4gICAgICAgICAgICA6IDAsXG4gICAgICAgICAgc2VsZi5fcmVzZXRTdG9yZXNcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgc2VsZi5fcmVzZXRTdG9yZXMgPSBmYWxzZTtcblxuICAgICAgZm9yIChjb25zdCBbc3RvcmVOYW1lLCB1cGRhdGVNZXNzYWdlc10gb2YgT2JqZWN0LmVudHJpZXModXBkYXRlcykpIHtcbiAgICAgICAgY29uc3Qgc3RvcmUgPSBzZWxmLl9zdG9yZXNbc3RvcmVOYW1lXTtcbiAgICAgICAgaWYgKHN0b3JlKSB7XG4gICAgICAgICAgZm9yIChjb25zdCB1cGRhdGVNZXNzYWdlIG9mIHVwZGF0ZU1lc3NhZ2VzKSB7XG4gICAgICAgICAgICBzdG9yZS51cGRhdGUodXBkYXRlTWVzc2FnZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE5vYm9keSdzIGxpc3RlbmluZyBmb3IgdGhpcyBkYXRhLiBRdWV1ZSBpdCB1cCB1bnRpbFxuICAgICAgICAgIC8vIHNvbWVvbmUgd2FudHMgaXQuXG4gICAgICAgICAgLy8gWFhYIG1lbW9yeSB1c2Ugd2lsbCBncm93IHdpdGhvdXQgYm91bmQgaWYgeW91IGZvcmdldCB0b1xuICAgICAgICAgIC8vIGNyZWF0ZSBhIGNvbGxlY3Rpb24gb3IganVzdCBkb24ndCBjYXJlIGFib3V0IGl0Li4uIGdvaW5nXG4gICAgICAgICAgLy8gdG8gaGF2ZSB0byBkbyBzb21ldGhpbmcgYWJvdXQgdGhhdC5cbiAgICAgICAgICBjb25zdCB1cGRhdGVzID0gc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXM7XG5cbiAgICAgICAgICBpZiAoISBoYXNPd24uY2FsbCh1cGRhdGVzLCBzdG9yZU5hbWUpKSB7XG4gICAgICAgICAgICB1cGRhdGVzW3N0b3JlTmFtZV0gPSBbXTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB1cGRhdGVzW3N0b3JlTmFtZV0ucHVzaCguLi51cGRhdGVNZXNzYWdlcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIEVuZCB1cGRhdGUgdHJhbnNhY3Rpb24uXG4gICAgICBmb3IgKGNvbnN0IHN0b3JlIG9mIE9iamVjdC52YWx1ZXMoc2VsZi5fc3RvcmVzKSkge1xuICAgICAgICBzdG9yZS5lbmRVcGRhdGUoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzZWxmLl9ydW5BZnRlclVwZGF0ZUNhbGxiYWNrcygpO1xuICB9XG5cbiAgLy8gQ2FsbCBhbnkgY2FsbGJhY2tzIGRlZmVycmVkIHdpdGggX3J1bldoZW5BbGxTZXJ2ZXJEb2NzQXJlRmx1c2hlZCB3aG9zZVxuICAvLyByZWxldmFudCBkb2NzIGhhdmUgYmVlbiBmbHVzaGVkLCBhcyB3ZWxsIGFzIGRhdGFWaXNpYmxlIGNhbGxiYWNrcyBhdFxuICAvLyByZWNvbm5lY3QtcXVpZXNjZW5jZSB0aW1lLlxuICBfcnVuQWZ0ZXJVcGRhdGVDYWxsYmFja3MoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3QgY2FsbGJhY2tzID0gc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3M7XG4gICAgc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3MgPSBbXTtcbiAgICBjYWxsYmFja3MuZm9yRWFjaCgoYykgPT4ge1xuICAgICAgYygpO1xuICAgIH0pO1xuICB9XG5cbiAgX3B1c2hVcGRhdGUodXBkYXRlcywgY29sbGVjdGlvbiwgbXNnKSB7XG4gICAgaWYgKCEgaGFzT3duLmNhbGwodXBkYXRlcywgY29sbGVjdGlvbikpIHtcbiAgICAgIHVwZGF0ZXNbY29sbGVjdGlvbl0gPSBbXTtcbiAgICB9XG4gICAgdXBkYXRlc1tjb2xsZWN0aW9uXS5wdXNoKG1zZyk7XG4gIH1cblxuICBfZ2V0U2VydmVyRG9jKGNvbGxlY3Rpb24sIGlkKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCEgaGFzT3duLmNhbGwoc2VsZi5fc2VydmVyRG9jdW1lbnRzLCBjb2xsZWN0aW9uKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHNlcnZlckRvY3NGb3JDb2xsZWN0aW9uID0gc2VsZi5fc2VydmVyRG9jdW1lbnRzW2NvbGxlY3Rpb25dO1xuICAgIHJldHVybiBzZXJ2ZXJEb2NzRm9yQ29sbGVjdGlvbi5nZXQoaWQpIHx8IG51bGw7XG4gIH1cblxuICBhc3luYyBfcHJvY2Vzc19hZGRlZChtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCBpZCA9IE1vbmdvSUQuaWRQYXJzZShtc2cuaWQpO1xuICAgIGNvbnN0IHNlcnZlckRvYyA9IHNlbGYuX2dldFNlcnZlckRvYyhtc2cuY29sbGVjdGlvbiwgaWQpO1xuICAgIGlmIChzZXJ2ZXJEb2MpIHtcbiAgICAgIC8vIFNvbWUgb3V0c3RhbmRpbmcgc3R1YiB3cm90ZSBoZXJlLlxuICAgICAgY29uc3QgaXNFeGlzdGluZyA9IHNlcnZlckRvYy5kb2N1bWVudCAhPT0gdW5kZWZpbmVkO1xuXG4gICAgICBzZXJ2ZXJEb2MuZG9jdW1lbnQgPSBtc2cuZmllbGRzIHx8IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICBzZXJ2ZXJEb2MuZG9jdW1lbnQuX2lkID0gaWQ7XG5cbiAgICAgIGlmIChzZWxmLl9yZXNldFN0b3Jlcykge1xuICAgICAgICAvLyBEdXJpbmcgcmVjb25uZWN0IHRoZSBzZXJ2ZXIgaXMgc2VuZGluZyBhZGRzIGZvciBleGlzdGluZyBpZHMuXG4gICAgICAgIC8vIEFsd2F5cyBwdXNoIGFuIHVwZGF0ZSBzbyB0aGF0IGRvY3VtZW50IHN0YXlzIGluIHRoZSBzdG9yZSBhZnRlclxuICAgICAgICAvLyByZXNldC4gVXNlIGN1cnJlbnQgdmVyc2lvbiBvZiB0aGUgZG9jdW1lbnQgZm9yIHRoaXMgdXBkYXRlLCBzb1xuICAgICAgICAvLyB0aGF0IHN0dWItd3JpdHRlbiB2YWx1ZXMgYXJlIHByZXNlcnZlZC5cbiAgICAgICAgY29uc3QgY3VycmVudERvYyA9IGF3YWl0IHNlbGYuX3N0b3Jlc1ttc2cuY29sbGVjdGlvbl0uZ2V0RG9jKG1zZy5pZCk7XG4gICAgICAgIGlmIChjdXJyZW50RG9jICE9PSB1bmRlZmluZWQpIG1zZy5maWVsZHMgPSBjdXJyZW50RG9jO1xuXG4gICAgICAgIHNlbGYuX3B1c2hVcGRhdGUodXBkYXRlcywgbXNnLmNvbGxlY3Rpb24sIG1zZyk7XG4gICAgICB9IGVsc2UgaWYgKGlzRXhpc3RpbmcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTZXJ2ZXIgc2VudCBhZGQgZm9yIGV4aXN0aW5nIGlkOiAnICsgbXNnLmlkKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCBtc2cuY29sbGVjdGlvbiwgbXNnKTtcbiAgICB9XG4gIH1cblxuICBfcHJvY2Vzc19jaGFuZ2VkKG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHNlcnZlckRvYyA9IHNlbGYuX2dldFNlcnZlckRvYyhtc2cuY29sbGVjdGlvbiwgTW9uZ29JRC5pZFBhcnNlKG1zZy5pZCkpO1xuICAgIGlmIChzZXJ2ZXJEb2MpIHtcbiAgICAgIGlmIChzZXJ2ZXJEb2MuZG9jdW1lbnQgPT09IHVuZGVmaW5lZClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTZXJ2ZXIgc2VudCBjaGFuZ2VkIGZvciBub25leGlzdGluZyBpZDogJyArIG1zZy5pZCk7XG4gICAgICBEaWZmU2VxdWVuY2UuYXBwbHlDaGFuZ2VzKHNlcnZlckRvYy5kb2N1bWVudCwgbXNnLmZpZWxkcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX3B1c2hVcGRhdGUodXBkYXRlcywgbXNnLmNvbGxlY3Rpb24sIG1zZyk7XG4gICAgfVxuICB9XG5cbiAgX3Byb2Nlc3NfcmVtb3ZlZChtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCBzZXJ2ZXJEb2MgPSBzZWxmLl9nZXRTZXJ2ZXJEb2MobXNnLmNvbGxlY3Rpb24sIE1vbmdvSUQuaWRQYXJzZShtc2cuaWQpKTtcbiAgICBpZiAoc2VydmVyRG9jKSB7XG4gICAgICAvLyBTb21lIG91dHN0YW5kaW5nIHN0dWIgd3JvdGUgaGVyZS5cbiAgICAgIGlmIChzZXJ2ZXJEb2MuZG9jdW1lbnQgPT09IHVuZGVmaW5lZClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTZXJ2ZXIgc2VudCByZW1vdmVkIGZvciBub25leGlzdGluZyBpZDonICsgbXNnLmlkKTtcbiAgICAgIHNlcnZlckRvYy5kb2N1bWVudCA9IHVuZGVmaW5lZDtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCBtc2cuY29sbGVjdGlvbiwge1xuICAgICAgICBtc2c6ICdyZW1vdmVkJyxcbiAgICAgICAgY29sbGVjdGlvbjogbXNnLmNvbGxlY3Rpb24sXG4gICAgICAgIGlkOiBtc2cuaWRcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIF9wcm9jZXNzX3VwZGF0ZWQobXNnLCB1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgLy8gUHJvY2VzcyBcIm1ldGhvZCBkb25lXCIgbWVzc2FnZXMuXG5cbiAgICBtc2cubWV0aG9kcy5mb3JFYWNoKChtZXRob2RJZCkgPT4ge1xuICAgICAgY29uc3QgZG9jcyA9IHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdIHx8IHt9O1xuICAgICAgT2JqZWN0LnZhbHVlcyhkb2NzKS5mb3JFYWNoKCh3cml0dGVuKSA9PiB7XG4gICAgICAgIGNvbnN0IHNlcnZlckRvYyA9IHNlbGYuX2dldFNlcnZlckRvYyh3cml0dGVuLmNvbGxlY3Rpb24sIHdyaXR0ZW4uaWQpO1xuICAgICAgICBpZiAoISBzZXJ2ZXJEb2MpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0xvc3Qgc2VydmVyRG9jIGZvciAnICsgSlNPTi5zdHJpbmdpZnkod3JpdHRlbikpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF0pIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAnRG9jICcgK1xuICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeSh3cml0dGVuKSArXG4gICAgICAgICAgICAgICcgbm90IHdyaXR0ZW4gYnkgIG1ldGhvZCAnICtcbiAgICAgICAgICAgICAgbWV0aG9kSWRcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnNbbWV0aG9kSWRdO1xuICAgICAgICBpZiAoaXNFbXB0eShzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMpKSB7XG4gICAgICAgICAgLy8gQWxsIG1ldGhvZHMgd2hvc2Ugc3R1YnMgd3JvdGUgdGhpcyBtZXRob2QgaGF2ZSBjb21wbGV0ZWQhIFdlIGNhblxuICAgICAgICAgIC8vIG5vdyBjb3B5IHRoZSBzYXZlZCBkb2N1bWVudCB0byB0aGUgZGF0YWJhc2UgKHJldmVydGluZyB0aGUgc3R1YidzXG4gICAgICAgICAgLy8gY2hhbmdlIGlmIHRoZSBzZXJ2ZXIgZGlkIG5vdCB3cml0ZSB0byB0aGlzIG9iamVjdCwgb3IgYXBwbHlpbmcgdGhlXG4gICAgICAgICAgLy8gc2VydmVyJ3Mgd3JpdGVzIGlmIGl0IGRpZCkuXG5cbiAgICAgICAgICAvLyBUaGlzIGlzIGEgZmFrZSBkZHAgJ3JlcGxhY2UnIG1lc3NhZ2UuICBJdCdzIGp1c3QgZm9yIHRhbGtpbmdcbiAgICAgICAgICAvLyBiZXR3ZWVuIGxpdmVkYXRhIGNvbm5lY3Rpb25zIGFuZCBtaW5pbW9uZ28uICAoV2UgaGF2ZSB0byBzdHJpbmdpZnlcbiAgICAgICAgICAvLyB0aGUgSUQgYmVjYXVzZSBpdCdzIHN1cHBvc2VkIHRvIGxvb2sgbGlrZSBhIHdpcmUgbWVzc2FnZS4pXG4gICAgICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCB3cml0dGVuLmNvbGxlY3Rpb24sIHtcbiAgICAgICAgICAgIG1zZzogJ3JlcGxhY2UnLFxuICAgICAgICAgICAgaWQ6IE1vbmdvSUQuaWRTdHJpbmdpZnkod3JpdHRlbi5pZCksXG4gICAgICAgICAgICByZXBsYWNlOiBzZXJ2ZXJEb2MuZG9jdW1lbnRcbiAgICAgICAgICB9KTtcbiAgICAgICAgICAvLyBDYWxsIGFsbCBmbHVzaCBjYWxsYmFja3MuXG5cbiAgICAgICAgICBzZXJ2ZXJEb2MuZmx1c2hDYWxsYmFja3MuZm9yRWFjaCgoYykgPT4ge1xuICAgICAgICAgICAgYygpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gRGVsZXRlIHRoaXMgY29tcGxldGVkIHNlcnZlckRvY3VtZW50LiBEb24ndCBib3RoZXIgdG8gR0MgZW1wdHlcbiAgICAgICAgICAvLyBJZE1hcHMgaW5zaWRlIHNlbGYuX3NlcnZlckRvY3VtZW50cywgc2luY2UgdGhlcmUgcHJvYmFibHkgYXJlbid0XG4gICAgICAgICAgLy8gbWFueSBjb2xsZWN0aW9ucyBhbmQgdGhleSdsbCBiZSB3cml0dGVuIHJlcGVhdGVkbHkuXG4gICAgICAgICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzW3dyaXR0ZW4uY29sbGVjdGlvbl0ucmVtb3ZlKHdyaXR0ZW4uaWQpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGRlbGV0ZSBzZWxmLl9kb2N1bWVudHNXcml0dGVuQnlTdHViW21ldGhvZElkXTtcblxuICAgICAgLy8gV2Ugd2FudCB0byBjYWxsIHRoZSBkYXRhLXdyaXR0ZW4gY2FsbGJhY2ssIGJ1dCB3ZSBjYW4ndCBkbyBzbyB1bnRpbCBhbGxcbiAgICAgIC8vIGN1cnJlbnRseSBidWZmZXJlZCBtZXNzYWdlcyBhcmUgZmx1c2hlZC5cbiAgICAgIGNvbnN0IGNhbGxiYWNrSW52b2tlciA9IHNlbGYuX21ldGhvZEludm9rZXJzW21ldGhvZElkXTtcbiAgICAgIGlmICghIGNhbGxiYWNrSW52b2tlcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGNhbGxiYWNrIGludm9rZXIgZm9yIG1ldGhvZCAnICsgbWV0aG9kSWQpO1xuICAgICAgfVxuXG4gICAgICBzZWxmLl9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQoXG4gICAgICAgICguLi5hcmdzKSA9PiBjYWxsYmFja0ludm9rZXIuZGF0YVZpc2libGUoLi4uYXJncylcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cblxuICBfcHJvY2Vzc19yZWFkeShtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICAvLyBQcm9jZXNzIFwic3ViIHJlYWR5XCIgbWVzc2FnZXMuIFwic3ViIHJlYWR5XCIgbWVzc2FnZXMgZG9uJ3QgdGFrZSBlZmZlY3RcbiAgICAvLyB1bnRpbCBhbGwgY3VycmVudCBzZXJ2ZXIgZG9jdW1lbnRzIGhhdmUgYmVlbiBmbHVzaGVkIHRvIHRoZSBsb2NhbFxuICAgIC8vIGRhdGFiYXNlLiBXZSBjYW4gdXNlIGEgd3JpdGUgZmVuY2UgdG8gaW1wbGVtZW50IHRoaXMuXG5cbiAgICBtc2cuc3Vicy5mb3JFYWNoKChzdWJJZCkgPT4ge1xuICAgICAgc2VsZi5fcnVuV2hlbkFsbFNlcnZlckRvY3NBcmVGbHVzaGVkKCgpID0+IHtcbiAgICAgICAgY29uc3Qgc3ViUmVjb3JkID0gc2VsZi5fc3Vic2NyaXB0aW9uc1tzdWJJZF07XG4gICAgICAgIC8vIERpZCB3ZSBhbHJlYWR5IHVuc3Vic2NyaWJlP1xuICAgICAgICBpZiAoIXN1YlJlY29yZCkgcmV0dXJuO1xuICAgICAgICAvLyBEaWQgd2UgYWxyZWFkeSByZWNlaXZlIGEgcmVhZHkgbWVzc2FnZT8gKE9vcHMhKVxuICAgICAgICBpZiAoc3ViUmVjb3JkLnJlYWR5KSByZXR1cm47XG4gICAgICAgIHN1YlJlY29yZC5yZWFkeSA9IHRydWU7XG4gICAgICAgIHN1YlJlY29yZC5yZWFkeUNhbGxiYWNrICYmIHN1YlJlY29yZC5yZWFkeUNhbGxiYWNrKCk7XG4gICAgICAgIHN1YlJlY29yZC5yZWFkeURlcHMuY2hhbmdlZCgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBFbnN1cmVzIHRoYXQgXCJmXCIgd2lsbCBiZSBjYWxsZWQgYWZ0ZXIgYWxsIGRvY3VtZW50cyBjdXJyZW50bHkgaW5cbiAgLy8gX3NlcnZlckRvY3VtZW50cyBoYXZlIGJlZW4gd3JpdHRlbiB0byB0aGUgbG9jYWwgY2FjaGUuIGYgd2lsbCBub3QgYmUgY2FsbGVkXG4gIC8vIGlmIHRoZSBjb25uZWN0aW9uIGlzIGxvc3QgYmVmb3JlIHRoZW4hXG4gIF9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQoZikge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHJ1bkZBZnRlclVwZGF0ZXMgPSAoKSA9PiB7XG4gICAgICBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcy5wdXNoKGYpO1xuICAgIH07XG4gICAgbGV0IHVuZmx1c2hlZFNlcnZlckRvY0NvdW50ID0gMDtcbiAgICBjb25zdCBvblNlcnZlckRvY0ZsdXNoID0gKCkgPT4ge1xuICAgICAgLS11bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudDtcbiAgICAgIGlmICh1bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudCA9PT0gMCkge1xuICAgICAgICAvLyBUaGlzIHdhcyB0aGUgbGFzdCBkb2MgdG8gZmx1c2ghIEFycmFuZ2UgdG8gcnVuIGYgYWZ0ZXIgdGhlIHVwZGF0ZXNcbiAgICAgICAgLy8gaGF2ZSBiZWVuIGFwcGxpZWQuXG4gICAgICAgIHJ1bkZBZnRlclVwZGF0ZXMoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgT2JqZWN0LnZhbHVlcyhzZWxmLl9zZXJ2ZXJEb2N1bWVudHMpLmZvckVhY2goKHNlcnZlckRvY3VtZW50cykgPT4ge1xuICAgICAgc2VydmVyRG9jdW1lbnRzLmZvckVhY2goKHNlcnZlckRvYykgPT4ge1xuICAgICAgICBjb25zdCB3cml0dGVuQnlTdHViRm9yQU1ldGhvZFdpdGhTZW50TWVzc2FnZSA9XG4gICAgICAgICAga2V5cyhzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMpLnNvbWUobWV0aG9kSWQgPT4ge1xuICAgICAgICAgICAgY29uc3QgaW52b2tlciA9IHNlbGYuX21ldGhvZEludm9rZXJzW21ldGhvZElkXTtcbiAgICAgICAgICAgIHJldHVybiBpbnZva2VyICYmIGludm9rZXIuc2VudE1lc3NhZ2U7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHdyaXR0ZW5CeVN0dWJGb3JBTWV0aG9kV2l0aFNlbnRNZXNzYWdlKSB7XG4gICAgICAgICAgKyt1bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudDtcbiAgICAgICAgICBzZXJ2ZXJEb2MuZmx1c2hDYWxsYmFja3MucHVzaChvblNlcnZlckRvY0ZsdXNoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgaWYgKHVuZmx1c2hlZFNlcnZlckRvY0NvdW50ID09PSAwKSB7XG4gICAgICAvLyBUaGVyZSBhcmVuJ3QgYW55IGJ1ZmZlcmVkIGRvY3MgLS0tIHdlIGNhbiBjYWxsIGYgYXMgc29vbiBhcyB0aGUgY3VycmVudFxuICAgICAgLy8gcm91bmQgb2YgdXBkYXRlcyBpcyBhcHBsaWVkIVxuICAgICAgcnVuRkFmdGVyVXBkYXRlcygpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIF9saXZlZGF0YV9ub3N1Yihtc2cpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIC8vIEZpcnN0IHBhc3MgaXQgdGhyb3VnaCBfbGl2ZWRhdGFfZGF0YSwgd2hpY2ggb25seSB1c2VzIGl0IHRvIGhlbHAgZ2V0XG4gICAgLy8gdG93YXJkcyBxdWllc2NlbmNlLlxuICAgIGF3YWl0IHNlbGYuX2xpdmVkYXRhX2RhdGEobXNnKTtcblxuICAgIC8vIERvIHRoZSByZXN0IG9mIG91ciBwcm9jZXNzaW5nIGltbWVkaWF0ZWx5LCB3aXRoIG5vXG4gICAgLy8gYnVmZmVyaW5nLXVudGlsLXF1aWVzY2VuY2UuXG5cbiAgICAvLyB3ZSB3ZXJlbid0IHN1YmJlZCBhbnl3YXksIG9yIHdlIGluaXRpYXRlZCB0aGUgdW5zdWIuXG4gICAgaWYgKCEgaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgbXNnLmlkKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xICNlcnJvckNhbGxiYWNrXG4gICAgY29uc3QgZXJyb3JDYWxsYmFjayA9IHNlbGYuX3N1YnNjcmlwdGlvbnNbbXNnLmlkXS5lcnJvckNhbGxiYWNrO1xuICAgIGNvbnN0IHN0b3BDYWxsYmFjayA9IHNlbGYuX3N1YnNjcmlwdGlvbnNbbXNnLmlkXS5zdG9wQ2FsbGJhY2s7XG5cbiAgICBzZWxmLl9zdWJzY3JpcHRpb25zW21zZy5pZF0ucmVtb3ZlKCk7XG5cbiAgICBjb25zdCBtZXRlb3JFcnJvckZyb21Nc2cgPSBtc2dBcmcgPT4ge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgbXNnQXJnICYmXG4gICAgICAgIG1zZ0FyZy5lcnJvciAmJlxuICAgICAgICBuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICAgIG1zZ0FyZy5lcnJvci5lcnJvcixcbiAgICAgICAgICBtc2dBcmcuZXJyb3IucmVhc29uLFxuICAgICAgICAgIG1zZ0FyZy5lcnJvci5kZXRhaWxzXG4gICAgICAgIClcbiAgICAgICk7XG4gICAgfTtcblxuICAgIC8vIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xICNlcnJvckNhbGxiYWNrXG4gICAgaWYgKGVycm9yQ2FsbGJhY2sgJiYgbXNnLmVycm9yKSB7XG4gICAgICBlcnJvckNhbGxiYWNrKG1ldGVvckVycm9yRnJvbU1zZyhtc2cpKTtcbiAgICB9XG5cbiAgICBpZiAoc3RvcENhbGxiYWNrKSB7XG4gICAgICBzdG9wQ2FsbGJhY2sobWV0ZW9yRXJyb3JGcm9tTXNnKG1zZykpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIF9saXZlZGF0YV9yZXN1bHQobXNnKSB7XG4gICAgLy8gaWQsIHJlc3VsdCBvciBlcnJvci4gZXJyb3IgaGFzIGVycm9yIChjb2RlKSwgcmVhc29uLCBkZXRhaWxzXG5cbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIC8vIExldHMgbWFrZSBzdXJlIHRoZXJlIGFyZSBubyBidWZmZXJlZCB3cml0ZXMgYmVmb3JlIHJldHVybmluZyByZXN1bHQuXG4gICAgaWYgKCEgaXNFbXB0eShzZWxmLl9idWZmZXJlZFdyaXRlcykpIHtcbiAgICAgIGF3YWl0IHNlbGYuX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKTtcbiAgICB9XG5cbiAgICAvLyBmaW5kIHRoZSBvdXRzdGFuZGluZyByZXF1ZXN0XG4gICAgLy8gc2hvdWxkIGJlIE8oMSkgaW4gbmVhcmx5IGFsbCByZWFsaXN0aWMgdXNlIGNhc2VzXG4gICAgaWYgKGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKCdSZWNlaXZlZCBtZXRob2QgcmVzdWx0IGJ1dCBubyBtZXRob2RzIG91dHN0YW5kaW5nJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGN1cnJlbnRNZXRob2RCbG9jayA9IHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHM7XG4gICAgbGV0IGk7XG4gICAgY29uc3QgbSA9IGN1cnJlbnRNZXRob2RCbG9jay5maW5kKChtZXRob2QsIGlkeCkgPT4ge1xuICAgICAgY29uc3QgZm91bmQgPSBtZXRob2QubWV0aG9kSWQgPT09IG1zZy5pZDtcbiAgICAgIGlmIChmb3VuZCkgaSA9IGlkeDtcbiAgICAgIHJldHVybiBmb3VuZDtcbiAgICB9KTtcbiAgICBpZiAoIW0pIHtcbiAgICAgIE1ldGVvci5fZGVidWcoXCJDYW4ndCBtYXRjaCBtZXRob2QgcmVzcG9uc2UgdG8gb3JpZ2luYWwgbWV0aG9kIGNhbGxcIiwgbXNnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgZnJvbSBjdXJyZW50IG1ldGhvZCBibG9jay4gVGhpcyBtYXkgbGVhdmUgdGhlIGJsb2NrIGVtcHR5LCBidXQgd2VcbiAgICAvLyBkb24ndCBtb3ZlIG9uIHRvIHRoZSBuZXh0IGJsb2NrIHVudGlsIHRoZSBjYWxsYmFjayBoYXMgYmVlbiBkZWxpdmVyZWQsIGluXG4gICAgLy8gX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQuXG4gICAgY3VycmVudE1ldGhvZEJsb2NrLnNwbGljZShpLCAxKTtcblxuICAgIGlmIChoYXNPd24uY2FsbChtc2csICdlcnJvcicpKSB7XG4gICAgICBtLnJlY2VpdmVSZXN1bHQoXG4gICAgICAgIG5ldyBNZXRlb3IuRXJyb3IobXNnLmVycm9yLmVycm9yLCBtc2cuZXJyb3IucmVhc29uLCBtc2cuZXJyb3IuZGV0YWlscylcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG1zZy5yZXN1bHQgbWF5IGJlIHVuZGVmaW5lZCBpZiB0aGUgbWV0aG9kIGRpZG4ndCByZXR1cm4gYVxuICAgICAgLy8gdmFsdWVcbiAgICAgIG0ucmVjZWl2ZVJlc3VsdCh1bmRlZmluZWQsIG1zZy5yZXN1bHQpO1xuICAgIH1cbiAgfVxuXG4gIC8vIENhbGxlZCBieSBNZXRob2RJbnZva2VyIGFmdGVyIGEgbWV0aG9kJ3MgY2FsbGJhY2sgaXMgaW52b2tlZC4gIElmIHRoaXMgd2FzXG4gIC8vIHRoZSBsYXN0IG91dHN0YW5kaW5nIG1ldGhvZCBpbiB0aGUgY3VycmVudCBibG9jaywgcnVucyB0aGUgbmV4dCBibG9jay4gSWZcbiAgLy8gdGhlcmUgYXJlIG5vIG1vcmUgbWV0aG9kcywgY29uc2lkZXIgYWNjZXB0aW5nIGEgaG90IGNvZGUgcHVzaC5cbiAgX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2FueU1ldGhvZHNBcmVPdXRzdGFuZGluZygpKSByZXR1cm47XG5cbiAgICAvLyBObyBtZXRob2RzIGFyZSBvdXRzdGFuZGluZy4gVGhpcyBzaG91bGQgbWVhbiB0aGF0IHRoZSBmaXJzdCBibG9jayBvZlxuICAgIC8vIG1ldGhvZHMgaXMgZW1wdHkuIChPciBpdCBtaWdodCBub3QgZXhpc3QsIGlmIHRoaXMgd2FzIGEgbWV0aG9kIHRoYXRcbiAgICAvLyBoYWxmLWZpbmlzaGVkIGJlZm9yZSBkaXNjb25uZWN0L3JlY29ubmVjdC4pXG4gICAgaWYgKCEgaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHtcbiAgICAgIGNvbnN0IGZpcnN0QmxvY2sgPSBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5zaGlmdCgpO1xuICAgICAgaWYgKCEgaXNFbXB0eShmaXJzdEJsb2NrLm1ldGhvZHMpKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ05vIG1ldGhvZHMgb3V0c3RhbmRpbmcgYnV0IG5vbmVtcHR5IGJsb2NrOiAnICtcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KGZpcnN0QmxvY2spXG4gICAgICAgICk7XG5cbiAgICAgIC8vIFNlbmQgdGhlIG91dHN0YW5kaW5nIG1ldGhvZHMgbm93IGluIHRoZSBmaXJzdCBibG9jay5cbiAgICAgIGlmICghIGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKVxuICAgICAgICBzZWxmLl9zZW5kT3V0c3RhbmRpbmdNZXRob2RzKCk7XG4gICAgfVxuXG4gICAgLy8gTWF5YmUgYWNjZXB0IGEgaG90IGNvZGUgcHVzaC5cbiAgICBzZWxmLl9tYXliZU1pZ3JhdGUoKTtcbiAgfVxuXG4gIC8vIFNlbmRzIG1lc3NhZ2VzIGZvciBhbGwgdGhlIG1ldGhvZHMgaW4gdGhlIGZpcnN0IGJsb2NrIGluXG4gIC8vIF9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5cbiAgX3NlbmRPdXRzdGFuZGluZ01ldGhvZHMoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS5tZXRob2RzLmZvckVhY2gobSA9PiB7XG4gICAgICBtLnNlbmRNZXNzYWdlKCk7XG4gICAgfSk7XG4gIH1cblxuICBfbGl2ZWRhdGFfZXJyb3IobXNnKSB7XG4gICAgTWV0ZW9yLl9kZWJ1ZygnUmVjZWl2ZWQgZXJyb3IgZnJvbSBzZXJ2ZXI6ICcsIG1zZy5yZWFzb24pO1xuICAgIGlmIChtc2cub2ZmZW5kaW5nTWVzc2FnZSkgTWV0ZW9yLl9kZWJ1ZygnRm9yOiAnLCBtc2cub2ZmZW5kaW5nTWVzc2FnZSk7XG4gIH1cblxuICBfc2VuZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzTWVzc2FnZXMob2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBpZiAoaXNFbXB0eShvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHJldHVybjtcblxuICAgIC8vIFdlIGhhdmUgYXQgbGVhc3Qgb25lIGJsb2NrIHdvcnRoIG9mIG9sZCBvdXRzdGFuZGluZyBtZXRob2RzIHRvIHRyeVxuICAgIC8vIGFnYWluLiBGaXJzdDogZGlkIG9uUmVjb25uZWN0IGFjdHVhbGx5IHNlbmQgYW55dGhpbmc/IElmIG5vdCwgd2UganVzdFxuICAgIC8vIHJlc3RvcmUgYWxsIG91dHN0YW5kaW5nIG1ldGhvZHMgYW5kIHJ1biB0aGUgZmlyc3QgYmxvY2suXG4gICAgaWYgKGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSB7XG4gICAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcyA9IG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzO1xuICAgICAgc2VsZi5fc2VuZE91dHN0YW5kaW5nTWV0aG9kcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIE9LLCB0aGVyZSBhcmUgYmxvY2tzIG9uIGJvdGggc2lkZXMuIFNwZWNpYWwgY2FzZTogbWVyZ2UgdGhlIGxhc3QgYmxvY2sgb2ZcbiAgICAvLyB0aGUgcmVjb25uZWN0IG1ldGhvZHMgd2l0aCB0aGUgZmlyc3QgYmxvY2sgb2YgdGhlIG9yaWdpbmFsIG1ldGhvZHMsIGlmXG4gICAgLy8gbmVpdGhlciBvZiB0aGVtIGFyZSBcIndhaXRcIiBibG9ja3MuXG4gICAgaWYgKFxuICAgICAgIWxhc3Qoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpLndhaXQgJiZcbiAgICAgICFvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS53YWl0XG4gICAgKSB7XG4gICAgICBvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS5tZXRob2RzLmZvckVhY2goKG0pID0+IHtcbiAgICAgICAgbGFzdChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykubWV0aG9kcy5wdXNoKG0pO1xuXG4gICAgICAgIC8vIElmIHRoaXMgXCJsYXN0IGJsb2NrXCIgaXMgYWxzbyB0aGUgZmlyc3QgYmxvY2ssIHNlbmQgdGhlIG1lc3NhZ2UuXG4gICAgICAgIGlmIChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICBtLnNlbmRNZXNzYWdlKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5zaGlmdCgpO1xuICAgIH1cblxuICAgIC8vIE5vdyBhZGQgdGhlIHJlc3Qgb2YgdGhlIG9yaWdpbmFsIGJsb2NrcyBvbi5cbiAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5wdXNoKC4uLm9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzKTtcbiAgfVxuICBfY2FsbE9uUmVjb25uZWN0QW5kU2VuZEFwcHJvcHJpYXRlT3V0c3RhbmRpbmdNZXRob2RzKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzID0gc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3M7XG4gICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXTtcblxuICAgIHNlbGYub25SZWNvbm5lY3QgJiYgc2VsZi5vblJlY29ubmVjdCgpO1xuICAgIEREUC5fcmVjb25uZWN0SG9vay5lYWNoKChjYWxsYmFjaykgPT4ge1xuICAgICAgY2FsbGJhY2soc2VsZik7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcblxuICAgIHNlbGYuX3NlbmRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrc01lc3NhZ2VzKG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzKTtcbiAgfVxuXG4gIC8vIFdlIGNhbiBhY2NlcHQgYSBob3QgY29kZSBwdXNoIGlmIHRoZXJlIGFyZSBubyBtZXRob2RzIGluIGZsaWdodC5cbiAgX3JlYWR5VG9NaWdyYXRlKCkge1xuICAgIHJldHVybiBpc0VtcHR5KHRoaXMuX21ldGhvZEludm9rZXJzKTtcbiAgfVxuXG4gIC8vIElmIHdlIHdlcmUgYmxvY2tpbmcgYSBtaWdyYXRpb24sIHNlZSBpZiBpdCdzIG5vdyBwb3NzaWJsZSB0byBjb250aW51ZS5cbiAgLy8gQ2FsbCB3aGVuZXZlciB0aGUgc2V0IG9mIG91dHN0YW5kaW5nL2Jsb2NrZWQgbWV0aG9kcyBzaHJpbmtzLlxuICBfbWF5YmVNaWdyYXRlKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9yZXRyeU1pZ3JhdGUgJiYgc2VsZi5fcmVhZHlUb01pZ3JhdGUoKSkge1xuICAgICAgc2VsZi5fcmV0cnlNaWdyYXRlKCk7XG4gICAgICBzZWxmLl9yZXRyeU1pZ3JhdGUgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG9uTWVzc2FnZShyYXdfbXNnKSB7XG4gICAgbGV0IG1zZztcbiAgICB0cnkge1xuICAgICAgbXNnID0gRERQQ29tbW9uLnBhcnNlRERQKHJhd19tc2cpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIE1ldGVvci5fZGVidWcoJ0V4Y2VwdGlvbiB3aGlsZSBwYXJzaW5nIEREUCcsIGUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEFueSBtZXNzYWdlIGNvdW50cyBhcyByZWNlaXZpbmcgYSBwb25nLCBhcyBpdCBkZW1vbnN0cmF0ZXMgdGhhdFxuICAgIC8vIHRoZSBzZXJ2ZXIgaXMgc3RpbGwgYWxpdmUuXG4gICAgaWYgKHRoaXMuX2hlYXJ0YmVhdCkge1xuICAgICAgdGhpcy5faGVhcnRiZWF0Lm1lc3NhZ2VSZWNlaXZlZCgpO1xuICAgIH1cblxuICAgIGlmIChtc2cgPT09IG51bGwgfHwgIW1zZy5tc2cpIHtcbiAgICAgIGlmKCFtc2cgfHwgIW1zZy50ZXN0TWVzc2FnZU9uQ29ubmVjdCkge1xuICAgICAgICBpZiAoT2JqZWN0LmtleXMobXNnKS5sZW5ndGggPT09IDEgJiYgbXNnLnNlcnZlcl9pZCkgcmV0dXJuO1xuICAgICAgICBNZXRlb3IuX2RlYnVnKCdkaXNjYXJkaW5nIGludmFsaWQgbGl2ZWRhdGEgbWVzc2FnZScsIG1zZyk7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKG1zZy5tc2cgPT09ICdjb25uZWN0ZWQnKSB7XG4gICAgICB0aGlzLl92ZXJzaW9uID0gdGhpcy5fdmVyc2lvblN1Z2dlc3Rpb247XG4gICAgICBhd2FpdCB0aGlzLl9saXZlZGF0YV9jb25uZWN0ZWQobXNnKTtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkNvbm5lY3RlZCgpO1xuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ2ZhaWxlZCcpIHtcbiAgICAgIGlmICh0aGlzLl9zdXBwb3J0ZWRERFBWZXJzaW9ucy5pbmRleE9mKG1zZy52ZXJzaW9uKSA+PSAwKSB7XG4gICAgICAgIHRoaXMuX3ZlcnNpb25TdWdnZXN0aW9uID0gbXNnLnZlcnNpb247XG4gICAgICAgIHRoaXMuX3N0cmVhbS5yZWNvbm5lY3QoeyBfZm9yY2U6IHRydWUgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBkZXNjcmlwdGlvbiA9XG4gICAgICAgICAgJ0REUCB2ZXJzaW9uIG5lZ290aWF0aW9uIGZhaWxlZDsgc2VydmVyIHJlcXVlc3RlZCB2ZXJzaW9uICcgK1xuICAgICAgICAgIG1zZy52ZXJzaW9uO1xuICAgICAgICB0aGlzLl9zdHJlYW0uZGlzY29ubmVjdCh7IF9wZXJtYW5lbnQ6IHRydWUsIF9lcnJvcjogZGVzY3JpcHRpb24gfSk7XG4gICAgICAgIHRoaXMub3B0aW9ucy5vbkREUFZlcnNpb25OZWdvdGlhdGlvbkZhaWx1cmUoZGVzY3JpcHRpb24pO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ3BpbmcnICYmIHRoaXMub3B0aW9ucy5yZXNwb25kVG9QaW5ncykge1xuICAgICAgdGhpcy5fc2VuZCh7IG1zZzogJ3BvbmcnLCBpZDogbXNnLmlkIH0pO1xuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ3BvbmcnKSB7XG4gICAgICAvLyBub29wLCBhcyB3ZSBhc3N1bWUgZXZlcnl0aGluZydzIGEgcG9uZ1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICBbJ2FkZGVkJywgJ2NoYW5nZWQnLCAncmVtb3ZlZCcsICdyZWFkeScsICd1cGRhdGVkJ10uaW5jbHVkZXMobXNnLm1zZylcbiAgICApIHtcbiAgICAgIGF3YWl0IHRoaXMuX2xpdmVkYXRhX2RhdGEobXNnKTtcbiAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdub3N1YicpIHtcbiAgICAgIGF3YWl0IHRoaXMuX2xpdmVkYXRhX25vc3ViKG1zZyk7XG4gICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAncmVzdWx0Jykge1xuICAgICAgYXdhaXQgdGhpcy5fbGl2ZWRhdGFfcmVzdWx0KG1zZyk7XG4gICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAnZXJyb3InKSB7XG4gICAgICB0aGlzLl9saXZlZGF0YV9lcnJvcihtc2cpO1xuICAgIH0gZWxzZSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKCdkaXNjYXJkaW5nIHVua25vd24gbGl2ZWRhdGEgbWVzc2FnZSB0eXBlJywgbXNnKTtcbiAgICB9XG4gIH1cblxuICBvblJlc2V0KCkge1xuICAgIC8vIFNlbmQgYSBjb25uZWN0IG1lc3NhZ2UgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgc3RyZWFtLlxuICAgIC8vIE5PVEU6IHJlc2V0IGlzIGNhbGxlZCBldmVuIG9uIHRoZSBmaXJzdCBjb25uZWN0aW9uLCBzbyB0aGlzIGlzXG4gICAgLy8gdGhlIG9ubHkgcGxhY2Ugd2Ugc2VuZCB0aGlzIG1lc3NhZ2UuXG4gICAgY29uc3QgbXNnID0geyBtc2c6ICdjb25uZWN0JyB9O1xuICAgIGlmICh0aGlzLl9sYXN0U2Vzc2lvbklkKSBtc2cuc2Vzc2lvbiA9IHRoaXMuX2xhc3RTZXNzaW9uSWQ7XG4gICAgbXNnLnZlcnNpb24gPSB0aGlzLl92ZXJzaW9uU3VnZ2VzdGlvbiB8fCB0aGlzLl9zdXBwb3J0ZWRERFBWZXJzaW9uc1swXTtcbiAgICB0aGlzLl92ZXJzaW9uU3VnZ2VzdGlvbiA9IG1zZy52ZXJzaW9uO1xuICAgIG1zZy5zdXBwb3J0ID0gdGhpcy5fc3VwcG9ydGVkRERQVmVyc2lvbnM7XG4gICAgdGhpcy5fc2VuZChtc2cpO1xuXG4gICAgLy8gTWFyayBub24tcmV0cnkgY2FsbHMgYXMgZmFpbGVkLiBUaGlzIGhhcyB0byBiZSBkb25lIGVhcmx5IGFzIGdldHRpbmcgdGhlc2UgbWV0aG9kcyBvdXQgb2YgdGhlXG4gICAgLy8gY3VycmVudCBibG9jayBpcyBwcmV0dHkgaW1wb3J0YW50IHRvIG1ha2luZyBzdXJlIHRoYXQgcXVpZXNjZW5jZSBpcyBwcm9wZXJseSBjYWxjdWxhdGVkLCBhc1xuICAgIC8vIHdlbGwgYXMgcG9zc2libHkgbW92aW5nIG9uIHRvIGFub3RoZXIgdXNlZnVsIGJsb2NrLlxuXG4gICAgLy8gT25seSBib3RoZXIgdGVzdGluZyBpZiB0aGVyZSBpcyBhbiBvdXRzdGFuZGluZ01ldGhvZEJsb2NrICh0aGVyZSBtaWdodCBub3QgYmUsIGVzcGVjaWFsbHkgaWZcbiAgICAvLyB3ZSBhcmUgY29ubmVjdGluZyBmb3IgdGhlIGZpcnN0IHRpbWUuXG4gICAgaWYgKHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIElmIHRoZXJlIGlzIGFuIG91dHN0YW5kaW5nIG1ldGhvZCBibG9jaywgd2Ugb25seSBjYXJlIGFib3V0IHRoZSBmaXJzdCBvbmUgYXMgdGhhdCBpcyB0aGVcbiAgICAgIC8vIG9uZSB0aGF0IGNvdWxkIGhhdmUgYWxyZWFkeSBzZW50IG1lc3NhZ2VzIHdpdGggbm8gcmVzcG9uc2UsIHRoYXQgYXJlIG5vdCBhbGxvd2VkIHRvIHJldHJ5LlxuICAgICAgY29uc3QgY3VycmVudE1ldGhvZEJsb2NrID0gdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcztcbiAgICAgIHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHMgPSBjdXJyZW50TWV0aG9kQmxvY2suZmlsdGVyKFxuICAgICAgICBtZXRob2RJbnZva2VyID0+IHtcbiAgICAgICAgICAvLyBNZXRob2RzIHdpdGggJ25vUmV0cnknIG9wdGlvbiBzZXQgYXJlIG5vdCBhbGxvd2VkIHRvIHJlLXNlbmQgYWZ0ZXJcbiAgICAgICAgICAvLyByZWNvdmVyaW5nIGRyb3BwZWQgY29ubmVjdGlvbi5cbiAgICAgICAgICBpZiAobWV0aG9kSW52b2tlci5zZW50TWVzc2FnZSAmJiBtZXRob2RJbnZva2VyLm5vUmV0cnkpIHtcbiAgICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBtZXRob2QgaXMgdG9sZCB0aGF0IGl0IGZhaWxlZC5cbiAgICAgICAgICAgIG1ldGhvZEludm9rZXIucmVjZWl2ZVJlc3VsdChcbiAgICAgICAgICAgICAgbmV3IE1ldGVvci5FcnJvcihcbiAgICAgICAgICAgICAgICAnaW52b2NhdGlvbi1mYWlsZWQnLFxuICAgICAgICAgICAgICAgICdNZXRob2QgaW52b2NhdGlvbiBtaWdodCBoYXZlIGZhaWxlZCBkdWUgdG8gZHJvcHBlZCBjb25uZWN0aW9uLiAnICtcbiAgICAgICAgICAgICAgICAgICdGYWlsaW5nIGJlY2F1c2UgYG5vUmV0cnlgIG9wdGlvbiB3YXMgcGFzc2VkIHRvIE1ldGVvci5hcHBseS4nXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gT25seSBrZWVwIGEgbWV0aG9kIGlmIGl0IHdhc24ndCBzZW50IG9yIGl0J3MgYWxsb3dlZCB0byByZXRyeS5cbiAgICAgICAgICAvLyBUaGlzIG1heSBsZWF2ZSB0aGUgYmxvY2sgZW1wdHksIGJ1dCB3ZSBkb24ndCBtb3ZlIG9uIHRvIHRoZSBuZXh0XG4gICAgICAgICAgLy8gYmxvY2sgdW50aWwgdGhlIGNhbGxiYWNrIGhhcyBiZWVuIGRlbGl2ZXJlZCwgaW4gX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQuXG4gICAgICAgICAgcmV0dXJuICEobWV0aG9kSW52b2tlci5zZW50TWVzc2FnZSAmJiBtZXRob2RJbnZva2VyLm5vUmV0cnkpO1xuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIE5vdywgdG8gbWluaW1pemUgc2V0dXAgbGF0ZW5jeSwgZ28gYWhlYWQgYW5kIGJsYXN0IG91dCBhbGwgb2ZcbiAgICAvLyBvdXIgcGVuZGluZyBtZXRob2RzIGFuZHMgc3Vic2NyaXB0aW9ucyBiZWZvcmUgd2UndmUgZXZlbiB0YWtlblxuICAgIC8vIHRoZSBuZWNlc3NhcnkgUlRUIHRvIGtub3cgaWYgd2Ugc3VjY2Vzc2Z1bGx5IHJlY29ubmVjdGVkLiAoMSlcbiAgICAvLyBUaGV5J3JlIHN1cHBvc2VkIHRvIGJlIGlkZW1wb3RlbnQsIGFuZCB3aGVyZSB0aGV5IGFyZSBub3QsXG4gICAgLy8gdGhleSBjYW4gYmxvY2sgcmV0cnkgaW4gYXBwbHk7ICgyKSBldmVuIGlmIHdlIGRpZCByZWNvbm5lY3QsXG4gICAgLy8gd2UncmUgbm90IHN1cmUgd2hhdCBtZXNzYWdlcyBtaWdodCBoYXZlIGdvdHRlbiBsb3N0XG4gICAgLy8gKGluIGVpdGhlciBkaXJlY3Rpb24pIHNpbmNlIHdlIHdlcmUgZGlzY29ubmVjdGVkIChUQ1AgYmVpbmdcbiAgICAvLyBzbG9wcHkgYWJvdXQgdGhhdC4pXG5cbiAgICAvLyBJZiB0aGUgY3VycmVudCBibG9jayBvZiBtZXRob2RzIGFsbCBnb3QgdGhlaXIgcmVzdWx0cyAoYnV0IGRpZG4ndCBhbGwgZ2V0XG4gICAgLy8gdGhlaXIgZGF0YSB2aXNpYmxlKSwgZGlzY2FyZCB0aGUgZW1wdHkgYmxvY2sgbm93LlxuICAgIGlmIChcbiAgICAgIHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLmxlbmd0aCA+IDAgJiZcbiAgICAgIHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHMubGVuZ3RoID09PSAwXG4gICAgKSB7XG4gICAgICB0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5zaGlmdCgpO1xuICAgIH1cblxuICAgIC8vIE1hcmsgYWxsIG1lc3NhZ2VzIGFzIHVuc2VudCwgdGhleSBoYXZlIG5vdCB5ZXQgYmVlbiBzZW50IG9uIHRoaXNcbiAgICAvLyBjb25uZWN0aW9uLlxuICAgIGtleXModGhpcy5fbWV0aG9kSW52b2tlcnMpLmZvckVhY2goaWQgPT4ge1xuICAgICAgdGhpcy5fbWV0aG9kSW52b2tlcnNbaWRdLnNlbnRNZXNzYWdlID0gZmFsc2U7XG4gICAgfSk7XG5cbiAgICAvLyBJZiBhbiBgb25SZWNvbm5lY3RgIGhhbmRsZXIgaXMgc2V0LCBjYWxsIGl0IGZpcnN0LiBHbyB0aHJvdWdoXG4gICAgLy8gc29tZSBob29wcyB0byBlbnN1cmUgdGhhdCBtZXRob2RzIHRoYXQgYXJlIGNhbGxlZCBmcm9tIHdpdGhpblxuICAgIC8vIGBvblJlY29ubmVjdGAgZ2V0IGV4ZWN1dGVkIF9iZWZvcmVfIG9uZXMgdGhhdCB3ZXJlIG9yaWdpbmFsbHlcbiAgICAvLyBvdXRzdGFuZGluZyAoc2luY2UgYG9uUmVjb25uZWN0YCBpcyB1c2VkIHRvIHJlLWVzdGFibGlzaCBhdXRoXG4gICAgLy8gY2VydGlmaWNhdGVzKVxuICAgIHRoaXMuX2NhbGxPblJlY29ubmVjdEFuZFNlbmRBcHByb3ByaWF0ZU91dHN0YW5kaW5nTWV0aG9kcygpO1xuXG4gICAgLy8gYWRkIG5ldyBzdWJzY3JpcHRpb25zIGF0IHRoZSBlbmQuIHRoaXMgd2F5IHRoZXkgdGFrZSBlZmZlY3QgYWZ0ZXJcbiAgICAvLyB0aGUgaGFuZGxlcnMgYW5kIHdlIGRvbid0IHNlZSBmbGlja2VyLlxuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuX3N1YnNjcmlwdGlvbnMpLmZvckVhY2goKFtpZCwgc3ViXSkgPT4ge1xuICAgICAgdGhpcy5fc2VuZFF1ZXVlZCh7XG4gICAgICAgIG1zZzogJ3N1YicsXG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgbmFtZTogc3ViLm5hbWUsXG4gICAgICAgIHBhcmFtczogc3ViLnBhcmFtc1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn1cbiIsImltcG9ydCB7IEREUENvbW1vbiB9IGZyb20gJ21ldGVvci9kZHAtY29tbW9uJztcbmltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuXG5pbXBvcnQgeyBDb25uZWN0aW9uIH0gZnJvbSAnLi9saXZlZGF0YV9jb25uZWN0aW9uLmpzJztcblxuLy8gVGhpcyBhcnJheSBhbGxvd3MgdGhlIGBfYWxsU3Vic2NyaXB0aW9uc1JlYWR5YCBtZXRob2QgYmVsb3csIHdoaWNoXG4vLyBpcyB1c2VkIGJ5IHRoZSBgc3BpZGVyYWJsZWAgcGFja2FnZSwgdG8ga2VlcCB0cmFjayBvZiB3aGV0aGVyIGFsbFxuLy8gZGF0YSBpcyByZWFkeS5cbmNvbnN0IGFsbENvbm5lY3Rpb25zID0gW107XG5cbi8qKlxuICogQG5hbWVzcGFjZSBERFBcbiAqIEBzdW1tYXJ5IE5hbWVzcGFjZSBmb3IgRERQLXJlbGF0ZWQgbWV0aG9kcy9jbGFzc2VzLlxuICovXG5leHBvcnQgY29uc3QgRERQID0ge307XG5cbi8vIFRoaXMgaXMgcHJpdmF0ZSBidXQgaXQncyB1c2VkIGluIGEgZmV3IHBsYWNlcy4gYWNjb3VudHMtYmFzZSB1c2VzXG4vLyBpdCB0byBnZXQgdGhlIGN1cnJlbnQgdXNlci4gTWV0ZW9yLnNldFRpbWVvdXQgYW5kIGZyaWVuZHMgY2xlYXJcbi8vIGl0LiBXZSBjYW4gcHJvYmFibHkgZmluZCBhIGJldHRlciB3YXkgdG8gZmFjdG9yIHRoaXMuXG5ERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uID0gbmV3IE1ldGVvci5FbnZpcm9ubWVudFZhcmlhYmxlKCk7XG5ERFAuX0N1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24gPSBuZXcgTWV0ZW9yLkVudmlyb25tZW50VmFyaWFibGUoKTtcblxuLy8gWFhYOiBLZWVwIEREUC5fQ3VycmVudEludm9jYXRpb24gZm9yIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5LlxuRERQLl9DdXJyZW50SW52b2NhdGlvbiA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb247XG5cbkREUC5fQ3VycmVudENhbGxBc3luY0ludm9jYXRpb24gPSBuZXcgTWV0ZW9yLkVudmlyb25tZW50VmFyaWFibGUoKTtcblxuLy8gVGhpcyBpcyBwYXNzZWQgaW50byBhIHdlaXJkIGBtYWtlRXJyb3JUeXBlYCBmdW5jdGlvbiB0aGF0IGV4cGVjdHMgaXRzIHRoaW5nXG4vLyB0byBiZSBhIGNvbnN0cnVjdG9yXG5mdW5jdGlvbiBjb25uZWN0aW9uRXJyb3JDb25zdHJ1Y3RvcihtZXNzYWdlKSB7XG4gIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG59XG5cbkREUC5Db25uZWN0aW9uRXJyb3IgPSBNZXRlb3IubWFrZUVycm9yVHlwZShcbiAgJ0REUC5Db25uZWN0aW9uRXJyb3InLFxuICBjb25uZWN0aW9uRXJyb3JDb25zdHJ1Y3RvclxuKTtcblxuRERQLkZvcmNlZFJlY29ubmVjdEVycm9yID0gTWV0ZW9yLm1ha2VFcnJvclR5cGUoXG4gICdERFAuRm9yY2VkUmVjb25uZWN0RXJyb3InLFxuICAoKSA9PiB7fVxuKTtcblxuLy8gUmV0dXJucyB0aGUgbmFtZWQgc2VxdWVuY2Ugb2YgcHNldWRvLXJhbmRvbSB2YWx1ZXMuXG4vLyBUaGUgc2NvcGUgd2lsbCBiZSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpLCBzbyB0aGUgc3RyZWFtIHdpbGwgcHJvZHVjZVxuLy8gY29uc2lzdGVudCB2YWx1ZXMgZm9yIG1ldGhvZCBjYWxscyBvbiB0aGUgY2xpZW50IGFuZCBzZXJ2ZXIuXG5ERFAucmFuZG9tU3RyZWFtID0gbmFtZSA9PiB7XG4gIGNvbnN0IHNjb3BlID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgcmV0dXJuIEREUENvbW1vbi5SYW5kb21TdHJlYW0uZ2V0KHNjb3BlLCBuYW1lKTtcbn07XG5cbi8vIEBwYXJhbSB1cmwge1N0cmluZ30gVVJMIHRvIE1ldGVvciBhcHAsXG4vLyAgICAgZS5nLjpcbi8vICAgICBcInN1YmRvbWFpbi5tZXRlb3IuY29tXCIsXG4vLyAgICAgXCJodHRwOi8vc3ViZG9tYWluLm1ldGVvci5jb21cIixcbi8vICAgICBcIi9cIixcbi8vICAgICBcImRkcCtzb2NranM6Ly9kZHAtLSoqKiotZm9vLm1ldGVvci5jb20vc29ja2pzXCJcblxuLyoqXG4gKiBAc3VtbWFyeSBDb25uZWN0IHRvIHRoZSBzZXJ2ZXIgb2YgYSBkaWZmZXJlbnQgTWV0ZW9yIGFwcGxpY2F0aW9uIHRvIHN1YnNjcmliZSB0byBpdHMgZG9jdW1lbnQgc2V0cyBhbmQgaW52b2tlIGl0cyByZW1vdGUgbWV0aG9kcy5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtTdHJpbmd9IHVybCBUaGUgVVJMIG9mIGFub3RoZXIgTWV0ZW9yIGFwcGxpY2F0aW9uLlxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnJlbG9hZFdpdGhPdXRzdGFuZGluZyBpcyBpdCBPSyB0byByZWxvYWQgaWYgdGhlcmUgYXJlIG91dHN0YW5kaW5nIG1ldGhvZHM/XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5oZWFkZXJzIGV4dHJhIGhlYWRlcnMgdG8gc2VuZCBvbiB0aGUgd2Vic29ja2V0cyBjb25uZWN0aW9uLCBmb3Igc2VydmVyLXRvLXNlcnZlciBERFAgb25seVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMuX3NvY2tqc09wdGlvbnMgU3BlY2lmaWVzIG9wdGlvbnMgdG8gcGFzcyB0aHJvdWdoIHRvIHRoZSBzb2NranMgY2xpZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLm9uRERQTmVnb3RpYXRpb25WZXJzaW9uRmFpbHVyZSBjYWxsYmFjayB3aGVuIHZlcnNpb24gbmVnb3RpYXRpb24gZmFpbHMuXG4gKi9cbkREUC5jb25uZWN0ID0gKHVybCwgb3B0aW9ucykgPT4ge1xuICBjb25zdCByZXQgPSBuZXcgQ29ubmVjdGlvbih1cmwsIG9wdGlvbnMpO1xuICBhbGxDb25uZWN0aW9ucy5wdXNoKHJldCk7IC8vIGhhY2suIHNlZSBiZWxvdy5cbiAgcmV0dXJuIHJldDtcbn07XG5cbkREUC5fcmVjb25uZWN0SG9vayA9IG5ldyBIb29rKHsgYmluZEVudmlyb25tZW50OiBmYWxzZSB9KTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZWdpc3RlciBhIGZ1bmN0aW9uIHRvIGNhbGwgYXMgdGhlIGZpcnN0IHN0ZXAgb2ZcbiAqIHJlY29ubmVjdGluZy4gVGhpcyBmdW5jdGlvbiBjYW4gY2FsbCBtZXRob2RzIHdoaWNoIHdpbGwgYmUgZXhlY3V0ZWQgYmVmb3JlXG4gKiBhbnkgb3RoZXIgb3V0c3RhbmRpbmcgbWV0aG9kcy4gRm9yIGV4YW1wbGUsIHRoaXMgY2FuIGJlIHVzZWQgdG8gcmUtZXN0YWJsaXNoXG4gKiB0aGUgYXBwcm9wcmlhdGUgYXV0aGVudGljYXRpb24gY29udGV4dCBvbiB0aGUgY29ubmVjdGlvbi5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNhbGwuIEl0IHdpbGwgYmUgY2FsbGVkIHdpdGggYVxuICogc2luZ2xlIGFyZ3VtZW50LCB0aGUgW2Nvbm5lY3Rpb24gb2JqZWN0XSgjZGRwX2Nvbm5lY3QpIHRoYXQgaXMgcmVjb25uZWN0aW5nLlxuICovXG5ERFAub25SZWNvbm5lY3QgPSBjYWxsYmFjayA9PiBERFAuX3JlY29ubmVjdEhvb2sucmVnaXN0ZXIoY2FsbGJhY2spO1xuXG4vLyBIYWNrIGZvciBgc3BpZGVyYWJsZWAgcGFja2FnZTogYSB3YXkgdG8gc2VlIGlmIHRoZSBwYWdlIGlzIGRvbmVcbi8vIGxvYWRpbmcgYWxsIHRoZSBkYXRhIGl0IG5lZWRzLlxuLy9cbkREUC5fYWxsU3Vic2NyaXB0aW9uc1JlYWR5ID0gKCkgPT4gYWxsQ29ubmVjdGlvbnMuZXZlcnkoXG4gIGNvbm4gPT4gT2JqZWN0LnZhbHVlcyhjb25uLl9zdWJzY3JpcHRpb25zKS5ldmVyeShzdWIgPT4gc3ViLnJlYWR5KVxuKTtcbiJdfQ==
