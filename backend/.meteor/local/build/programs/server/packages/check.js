Package["core-runtime"].queue("check",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var EJSON = Package.ejson.EJSON;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var check, Match;

var require = meteorInstall({"node_modules":{"meteor":{"check":{"match.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/check/match.js                                                                                           //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      check: () => check,
      Match: () => Match
    });
    let isPlainObject;
    module.link("./isPlainObject", {
      isPlainObject(v) {
        isPlainObject = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // Things we explicitly do NOT support:
    //    - heterogenous arrays

    const currentArgumentChecker = new Meteor.EnvironmentVariable();
    const hasOwn = Object.prototype.hasOwnProperty;
    const format = result => {
      const err = new Match.Error(result.message);
      if (result.path) {
        err.message += " in field ".concat(result.path);
        err.path = result.path;
      }
      return err;
    };

    /**
     * @summary Check that a value matches a [pattern](#matchpatterns).
     * If the value does not match the pattern, throw a `Match.Error`.
     * By default, it will throw immediately at the first error encountered. Pass in { throwAllErrors: true } to throw all errors.
     *
     * Particularly useful to assert that arguments to a function have the right
     * types and structure.
     * @locus Anywhere
     * @param {Any} value The value to check
     * @param {MatchPattern} pattern The pattern to match `value` against
     * @param {Object} [options={}] Additional options for check
     * @param {Boolean} [options.throwAllErrors=false] If true, throw all errors
     */
    function check(value, pattern) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {
        throwAllErrors: false
      };
      // Record that check got called, if somebody cared.
      //
      // We use getOrNullIfOutsideFiber so that it's OK to call check()
      // from non-Fiber server contexts; the downside is that if you forget to
      // bindEnvironment on some random callback in your method/publisher,
      // it might not find the argumentChecker and you'll get an error about
      // not checking an argument that it looks like you're checking (instead
      // of just getting a "Node code must run in a Fiber" error).
      const argChecker = currentArgumentChecker.getOrNullIfOutsideFiber();
      if (argChecker) {
        argChecker.checking(value);
      }
      const result = testSubtree(value, pattern, options.throwAllErrors);
      if (result) {
        if (options.throwAllErrors) {
          throw Array.isArray(result) ? result.map(r => format(r)) : [format(result)];
        } else {
          throw format(result);
        }
      }
    }
    ;

    /**
     * @namespace Match
     * @summary The namespace for all Match types and methods.
     */
    const Match = {
      Optional: function (pattern) {
        return new Optional(pattern);
      },
      Maybe: function (pattern) {
        return new Maybe(pattern);
      },
      OneOf: function () {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        return new OneOf(args);
      },
      Any: ['__any__'],
      Where: function (condition) {
        return new Where(condition);
      },
      ObjectIncluding: function (pattern) {
        return new ObjectIncluding(pattern);
      },
      ObjectWithValues: function (pattern) {
        return new ObjectWithValues(pattern);
      },
      // Matches only signed 32-bit integers
      Integer: ['__integer__'],
      // XXX matchers should know how to describe themselves for errors
      Error: Meteor.makeErrorType('Match.Error', function (msg) {
        this.message = "Match error: ".concat(msg);

        // The path of the value that failed to match. Initially empty, this gets
        // populated by catching and rethrowing the exception as it goes back up the
        // stack.
        // E.g.: "vals[3].entity.created"
        this.path = '';

        // If this gets sent over DDP, don't give full internal details but at least
        // provide something better than 500 Internal server error.
        this.sanitizedError = new Meteor.Error(400, 'Match failed');
      }),
      // Tests to see if value matches pattern. Unlike check, it merely returns true
      // or false (unless an error other than Match.Error was thrown). It does not
      // interact with _failIfArgumentsAreNotAllChecked.
      // XXX maybe also implement a Match.match which returns more information about
      //     failures but without using exception handling or doing what check()
      //     does with _failIfArgumentsAreNotAllChecked and Meteor.Error conversion

      /**
       * @summary Returns true if the value matches the pattern.
       * @locus Anywhere
       * @param {Any} value The value to check
       * @param {MatchPattern} pattern The pattern to match `value` against
       */
      test(value, pattern) {
        return !testSubtree(value, pattern);
      },
      // Runs `f.apply(context, args)`. If check() is not called on every element of
      // `args` (either directly or in the first level of an array), throws an error
      // (using `description` in the message).
      _failIfArgumentsAreNotAllChecked(f, context, args, description) {
        const argChecker = new ArgumentChecker(args, description);
        const result = currentArgumentChecker.withValue(argChecker, () => f.apply(context, args));

        // If f didn't itself throw, make sure it checked all of its arguments.
        argChecker.throwUnlessAllArgumentsHaveBeenChecked();
        return result;
      }
    };
    class Optional {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    class Maybe {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    class OneOf {
      constructor(choices) {
        if (!choices || choices.length === 0) {
          throw new Error('Must provide at least one choice to Match.OneOf');
        }
        this.choices = choices;
      }
    }
    class Where {
      constructor(condition) {
        this.condition = condition;
      }
    }
    class ObjectIncluding {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    class ObjectWithValues {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    const stringForErrorMessage = function (value) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (value === null) {
        return 'null';
      }
      if (options.onlyShowType) {
        return typeof value;
      }

      // Your average non-object things.  Saves from doing the try/catch below for.
      if (typeof value !== 'object') {
        return EJSON.stringify(value);
      }
      try {
        // Find objects with circular references since EJSON doesn't support them yet (Issue #4778 + Unaccepted PR)
        // If the native stringify is going to choke, EJSON.stringify is going to choke too.
        JSON.stringify(value);
      } catch (stringifyError) {
        if (stringifyError.name === 'TypeError') {
          return typeof value;
        }
      }
      return EJSON.stringify(value);
    };
    const typeofChecks = [[String, 'string'], [Number, 'number'], [Boolean, 'boolean'],
    // While we don't allow undefined/function in EJSON, this is good for optional
    // arguments with OneOf.
    [Function, 'function'], [undefined, 'undefined']];

    // Return `false` if it matches. Otherwise, returns an object with a `message` and a `path` field or an array of objects each with a `message` and a `path` field when collecting errors.
    const testSubtree = function (value, pattern) {
      let collectErrors = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
      let errors = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
      let path = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : '';
      // Match anything!
      if (pattern === Match.Any) {
        return false;
      }

      // Basic atomic types.
      // Do not match boxed objects (e.g. String, Boolean)
      for (let i = 0; i < typeofChecks.length; ++i) {
        if (pattern === typeofChecks[i][0]) {
          if (typeof value === typeofChecks[i][1]) {
            return false;
          }
          return {
            message: "Expected ".concat(typeofChecks[i][1], ", got ").concat(stringForErrorMessage(value, {
              onlyShowType: true
            })),
            path: ''
          };
        }
      }
      if (pattern === null) {
        if (value === null) {
          return false;
        }
        return {
          message: "Expected null, got ".concat(stringForErrorMessage(value)),
          path: ''
        };
      }

      // Strings, numbers, and booleans match literally. Goes well with Match.OneOf.
      if (typeof pattern === 'string' || typeof pattern === 'number' || typeof pattern === 'boolean') {
        if (value === pattern) {
          return false;
        }
        return {
          message: "Expected ".concat(pattern, ", got ").concat(stringForErrorMessage(value)),
          path: ''
        };
      }

      // Match.Integer is special type encoded with array
      if (pattern === Match.Integer) {
        // There is no consistent and reliable way to check if variable is a 64-bit
        // integer. One of the popular solutions is to get reminder of division by 1
        // but this method fails on really large floats with big precision.
        // E.g.: 1.348192308491824e+23 % 1 === 0 in V8
        // Bitwise operators work consistantly but always cast variable to 32-bit
        // signed integer according to JavaScript specs.
        if (typeof value === 'number' && (value | 0) === value) {
          return false;
        }
        return {
          message: "Expected Integer, got ".concat(stringForErrorMessage(value)),
          path: ''
        };
      }

      // 'Object' is shorthand for Match.ObjectIncluding({});
      if (pattern === Object) {
        pattern = Match.ObjectIncluding({});
      }

      // Array (checked AFTER Any, which is implemented as an Array).
      if (pattern instanceof Array) {
        if (pattern.length !== 1) {
          return {
            message: "Bad pattern: arrays must have one type element ".concat(stringForErrorMessage(pattern)),
            path: ''
          };
        }
        if (!Array.isArray(value) && !isArguments(value)) {
          return {
            message: "Expected array, got ".concat(stringForErrorMessage(value)),
            path: ''
          };
        }
        for (let i = 0, length = value.length; i < length; i++) {
          const arrPath = "".concat(path, "[").concat(i, "]");
          const result = testSubtree(value[i], pattern[0], collectErrors, errors, arrPath);
          if (result) {
            result.path = _prependPath(collectErrors ? arrPath : i, result.path);
            if (!collectErrors) return result;
            if (typeof value[i] !== 'object' || result.message) errors.push(result);
          }
        }
        if (!collectErrors) return false;
        return errors.length === 0 ? false : errors;
      }

      // Arbitrary validation checks. The condition can return false or throw a
      // Match.Error (ie, it can internally use check()) to fail.
      if (pattern instanceof Where) {
        let result;
        try {
          result = pattern.condition(value);
        } catch (err) {
          if (!(err instanceof Match.Error)) {
            throw err;
          }
          return {
            message: err.message,
            path: err.path
          };
        }
        if (result) {
          return false;
        }

        // XXX this error is terrible

        return {
          message: 'Failed Match.Where validation',
          path: ''
        };
      }
      if (pattern instanceof Maybe) {
        pattern = Match.OneOf(undefined, null, pattern.pattern);
      } else if (pattern instanceof Optional) {
        pattern = Match.OneOf(undefined, pattern.pattern);
      }
      if (pattern instanceof OneOf) {
        for (let i = 0; i < pattern.choices.length; ++i) {
          const result = testSubtree(value, pattern.choices[i]);
          if (!result) {
            // No error? Yay, return.
            return false;
          }

          // Match errors just mean try another choice.
        }

        // XXX this error is terrible
        return {
          message: 'Failed Match.OneOf, Match.Maybe or Match.Optional validation',
          path: ''
        };
      }

      // A function that isn't something we special-case is assumed to be a
      // constructor.
      if (pattern instanceof Function) {
        if (value instanceof pattern) {
          return false;
        }
        return {
          message: "Expected ".concat(pattern.name || 'particular constructor'),
          path: ''
        };
      }
      let unknownKeysAllowed = false;
      let unknownKeyPattern;
      if (pattern instanceof ObjectIncluding) {
        unknownKeysAllowed = true;
        pattern = pattern.pattern;
      }
      if (pattern instanceof ObjectWithValues) {
        unknownKeysAllowed = true;
        unknownKeyPattern = [pattern.pattern];
        pattern = {}; // no required keys
      }
      if (typeof pattern !== 'object') {
        return {
          message: 'Bad pattern: unknown pattern type',
          path: ''
        };
      }

      // An object, with required and optional keys. Note that this does NOT do
      // structural matches against objects of special types that happen to match
      // the pattern: this really needs to be a plain old {Object}!
      if (typeof value !== 'object') {
        return {
          message: "Expected object, got ".concat(typeof value),
          path: ''
        };
      }
      if (value === null) {
        return {
          message: "Expected object, got null",
          path: ''
        };
      }
      if (!isPlainObject(value)) {
        return {
          message: "Expected plain object",
          path: ''
        };
      }
      const requiredPatterns = Object.create(null);
      const optionalPatterns = Object.create(null);
      Object.keys(pattern).forEach(key => {
        const subPattern = pattern[key];
        if (subPattern instanceof Optional || subPattern instanceof Maybe) {
          optionalPatterns[key] = subPattern.pattern;
        } else {
          requiredPatterns[key] = subPattern;
        }
      });
      for (let key in Object(value)) {
        const subValue = value[key];
        const objPath = path ? "".concat(path, ".").concat(key) : key;
        if (hasOwn.call(requiredPatterns, key)) {
          const result = testSubtree(subValue, requiredPatterns[key], collectErrors, errors, objPath);
          if (result) {
            result.path = _prependPath(collectErrors ? objPath : key, result.path);
            if (!collectErrors) return result;
            if (typeof subValue !== 'object' || result.message) errors.push(result);
          }
          delete requiredPatterns[key];
        } else if (hasOwn.call(optionalPatterns, key)) {
          const result = testSubtree(subValue, optionalPatterns[key], collectErrors, errors, objPath);
          if (result) {
            result.path = _prependPath(collectErrors ? objPath : key, result.path);
            if (!collectErrors) return result;
            if (typeof subValue !== 'object' || result.message) errors.push(result);
          }
        } else {
          if (!unknownKeysAllowed) {
            const result = {
              message: 'Unknown key',
              path: key
            };
            if (!collectErrors) return result;
            errors.push(result);
          }
          if (unknownKeyPattern) {
            const result = testSubtree(subValue, unknownKeyPattern[0], collectErrors, errors, objPath);
            if (result) {
              result.path = _prependPath(collectErrors ? objPath : key, result.path);
              if (!collectErrors) return result;
              if (typeof subValue !== 'object' || result.message) errors.push(result);
            }
          }
        }
      }
      const keys = Object.keys(requiredPatterns);
      if (keys.length) {
        const result = {
          message: "Missing key '".concat(keys[0], "'"),
          path: ''
        };
        if (!collectErrors) return result;
        errors.push(result);
      }
      if (!collectErrors) return false;
      return errors.length === 0 ? false : errors;
    };
    class ArgumentChecker {
      constructor(args, description) {
        // Make a SHALLOW copy of the arguments. (We'll be doing identity checks
        // against its contents.)
        this.args = [...args];

        // Since the common case will be to check arguments in order, and we splice
        // out arguments when we check them, make it so we splice out from the end
        // rather than the beginning.
        this.args.reverse();
        this.description = description;
      }
      checking(value) {
        if (this._checkingOneValue(value)) {
          return;
        }

        // Allow check(arguments, [String]) or check(arguments.slice(1), [String])
        // or check([foo, bar], [String]) to count... but only if value wasn't
        // itself an argument.
        if (Array.isArray(value) || isArguments(value)) {
          Array.prototype.forEach.call(value, this._checkingOneValue.bind(this));
        }
      }
      _checkingOneValue(value) {
        for (let i = 0; i < this.args.length; ++i) {
          // Is this value one of the arguments? (This can have a false positive if
          // the argument is an interned primitive, but it's still a good enough
          // check.)
          // (NaN is not === to itself, so we have to check specially.)
          if (value === this.args[i] || Number.isNaN(value) && Number.isNaN(this.args[i])) {
            this.args.splice(i, 1);
            return true;
          }
        }
        return false;
      }
      throwUnlessAllArgumentsHaveBeenChecked() {
        if (this.args.length > 0) throw new Error("Did not check() all arguments during ".concat(this.description));
      }
    }
    const _jsKeywords = ['do', 'if', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'false', 'null', 'this', 'true', 'void', 'with', 'break', 'catch', 'class', 'const', 'super', 'throw', 'while', 'yield', 'delete', 'export', 'import', 'public', 'return', 'static', 'switch', 'typeof', 'default', 'extends', 'finally', 'package', 'private', 'continue', 'debugger', 'function', 'arguments', 'interface', 'protected', 'implements', 'instanceof'];

    // Assumes the base of path is already escaped properly
    // returns key + base
    const _prependPath = (key, base) => {
      if (typeof key === 'number' || key.match(/^[0-9]+$/)) {
        key = "[".concat(key, "]");
      } else if (!key.match(/^[a-z_$][0-9a-z_$.[\]]*$/i) || _jsKeywords.indexOf(key) >= 0) {
        key = JSON.stringify([key]);
      }
      if (base && base[0] !== '[') {
        return "".concat(key, ".").concat(base);
      }
      return key + base;
    };
    const isObject = value => typeof value === 'object' && value !== null;
    const baseIsArguments = item => isObject(item) && Object.prototype.toString.call(item) === '[object Arguments]';
    const isArguments = baseIsArguments(function () {
      return arguments;
    }()) ? baseIsArguments : value => isObject(value) && typeof value.callee === 'function';
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"isPlainObject.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/check/isPlainObject.js                                                                                   //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
module.export({
  isPlainObject: () => isPlainObject
});
// Copy of jQuery.isPlainObject for the server side from jQuery v3.1.1.

const class2type = {};
const toString = class2type.toString;
const hasOwn = Object.prototype.hasOwnProperty;
const fnToString = hasOwn.toString;
const ObjectFunctionString = fnToString.call(Object);
const getProto = Object.getPrototypeOf;
const isPlainObject = obj => {
  let proto;
  let Ctor;

  // Detect obvious negatives
  // Use toString instead of jQuery.type to catch host objects
  if (!obj || toString.call(obj) !== '[object Object]') {
    return false;
  }
  proto = getProto(obj);

  // Objects with no prototype (e.g., `Object.create( null )`) are plain
  if (!proto) {
    return true;
  }

  // Objects with prototype are plain iff they were constructed by a global Object function
  Ctor = hasOwn.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor === 'function' && fnToString.call(Ctor) === ObjectFunctionString;
};
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      check: check,
      Match: Match
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/check/match.js"
  ],
  mainModulePath: "/node_modules/meteor/check/match.js"
}});

//# sourceURL=meteor://💻app/packages/check.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY2hlY2svbWF0Y2guanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2NoZWNrL2lzUGxhaW5PYmplY3QuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiY2hlY2siLCJNYXRjaCIsImlzUGxhaW5PYmplY3QiLCJsaW5rIiwidiIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwiY3VycmVudEFyZ3VtZW50Q2hlY2tlciIsIk1ldGVvciIsIkVudmlyb25tZW50VmFyaWFibGUiLCJoYXNPd24iLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImZvcm1hdCIsInJlc3VsdCIsImVyciIsIkVycm9yIiwibWVzc2FnZSIsInBhdGgiLCJjb25jYXQiLCJ2YWx1ZSIsInBhdHRlcm4iLCJvcHRpb25zIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwidW5kZWZpbmVkIiwidGhyb3dBbGxFcnJvcnMiLCJhcmdDaGVja2VyIiwiZ2V0T3JOdWxsSWZPdXRzaWRlRmliZXIiLCJjaGVja2luZyIsInRlc3RTdWJ0cmVlIiwiQXJyYXkiLCJpc0FycmF5IiwibWFwIiwiciIsIk9wdGlvbmFsIiwiTWF5YmUiLCJPbmVPZiIsIl9sZW4iLCJhcmdzIiwiX2tleSIsIkFueSIsIldoZXJlIiwiY29uZGl0aW9uIiwiT2JqZWN0SW5jbHVkaW5nIiwiT2JqZWN0V2l0aFZhbHVlcyIsIkludGVnZXIiLCJtYWtlRXJyb3JUeXBlIiwibXNnIiwic2FuaXRpemVkRXJyb3IiLCJ0ZXN0IiwiX2ZhaWxJZkFyZ3VtZW50c0FyZU5vdEFsbENoZWNrZWQiLCJmIiwiY29udGV4dCIsImRlc2NyaXB0aW9uIiwiQXJndW1lbnRDaGVja2VyIiwid2l0aFZhbHVlIiwiYXBwbHkiLCJ0aHJvd1VubGVzc0FsbEFyZ3VtZW50c0hhdmVCZWVuQ2hlY2tlZCIsImNvbnN0cnVjdG9yIiwiY2hvaWNlcyIsInN0cmluZ0ZvckVycm9yTWVzc2FnZSIsIm9ubHlTaG93VHlwZSIsIkVKU09OIiwic3RyaW5naWZ5IiwiSlNPTiIsInN0cmluZ2lmeUVycm9yIiwibmFtZSIsInR5cGVvZkNoZWNrcyIsIlN0cmluZyIsIk51bWJlciIsIkJvb2xlYW4iLCJGdW5jdGlvbiIsImNvbGxlY3RFcnJvcnMiLCJlcnJvcnMiLCJpIiwiaXNBcmd1bWVudHMiLCJhcnJQYXRoIiwiX3ByZXBlbmRQYXRoIiwicHVzaCIsInVua25vd25LZXlzQWxsb3dlZCIsInVua25vd25LZXlQYXR0ZXJuIiwicmVxdWlyZWRQYXR0ZXJucyIsImNyZWF0ZSIsIm9wdGlvbmFsUGF0dGVybnMiLCJrZXlzIiwiZm9yRWFjaCIsImtleSIsInN1YlBhdHRlcm4iLCJzdWJWYWx1ZSIsIm9ialBhdGgiLCJjYWxsIiwicmV2ZXJzZSIsIl9jaGVja2luZ09uZVZhbHVlIiwiYmluZCIsImlzTmFOIiwic3BsaWNlIiwiX2pzS2V5d29yZHMiLCJiYXNlIiwibWF0Y2giLCJpbmRleE9mIiwiaXNPYmplY3QiLCJiYXNlSXNBcmd1bWVudHMiLCJpdGVtIiwidG9TdHJpbmciLCJjYWxsZWUiLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJzZWxmIiwiYXN5bmMiLCJjbGFzczJ0eXBlIiwiZm5Ub1N0cmluZyIsIk9iamVjdEZ1bmN0aW9uU3RyaW5nIiwiZ2V0UHJvdG8iLCJnZXRQcm90b3R5cGVPZiIsIm9iaiIsInByb3RvIiwiQ3RvciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUFBLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDO01BQUNDLEtBQUssRUFBQ0EsQ0FBQSxLQUFJQSxLQUFLO01BQUNDLEtBQUssRUFBQ0EsQ0FBQSxLQUFJQTtJQUFLLENBQUMsQ0FBQztJQUFDLElBQUlDLGFBQWE7SUFBQ0osTUFBTSxDQUFDSyxJQUFJLENBQUMsaUJBQWlCLEVBQUM7TUFBQ0QsYUFBYUEsQ0FBQ0UsQ0FBQyxFQUFDO1FBQUNGLGFBQWEsR0FBQ0UsQ0FBQztNQUFBO0lB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QUM7QUFFcEQsTUFBTXVHLFFBQVEsR0FBR3ZHLE1BQU0sQ0FBQ3dHLGNBQWM7QUFFL0IsTUFBTWhILGFBQWEsR0FBR2lILEdBQUcsSUFBSTtFQUNsQyxJQUFJQyxLQUFLO0VBQ1QsSUFBSUMsSUFBSTs7RUFFUjtFQUNBO0VBQ0EsSUFBSSxDQUFDRixHQUFHLElBQUlYLFFBQVEsQ0FBQ2IsSUFBSSxDQUFDd0IsR0FBRyxDQUFDLEtBQUssaUJBQWlCLEVBQUU7SUFDcEQsT0FBTyxLQUFLO0VBQ2Q7RUFFQUMsS0FBSyxHQUFHSCxRQUFRLENBQUNFLEdBQUcsQ0FBQzs7RUFFckI7RUFDQSxJQUFJLENBQUNDLEtBQUssRUFBRTtJQUNWLE9BQU8sSUFBSTtFQUNiOztFQUVBO0VBQ0FDLElBQUksR0FBRzVHLE1BQU0sQ0FBQ2tGLElBQUksQ0FBQ3lCLEtBQUssRUFBRSxhQUFhLENBQUMsSUFBSUEsS0FBSyxDQUFDekQsV0FBVztFQUM3RCxPQUFPLE9BQU8wRCxJQUFJLEtBQUssVUFBVSxJQUMvQk4sVUFBVSxDQUFDcEIsSUFBSSxDQUFDMEIsSUFBSSxDQUFDLEtBQUtMLG9CQUFvQjtBQUNsRCxDQUFDLEMiLCJmaWxlIjoiL3BhY2thZ2VzL2NoZWNrLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gWFhYIGRvY3NcbmltcG9ydCB7IGlzUGxhaW5PYmplY3QgfSBmcm9tICcuL2lzUGxhaW5PYmplY3QnO1xuXG4vLyBUaGluZ3Mgd2UgZXhwbGljaXRseSBkbyBOT1Qgc3VwcG9ydDpcbi8vICAgIC0gaGV0ZXJvZ2Vub3VzIGFycmF5c1xuXG5jb25zdCBjdXJyZW50QXJndW1lbnRDaGVja2VyID0gbmV3IE1ldGVvci5FbnZpcm9ubWVudFZhcmlhYmxlO1xuY29uc3QgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuY29uc3QgZm9ybWF0ID0gcmVzdWx0ID0+IHtcbiAgY29uc3QgZXJyID0gbmV3IE1hdGNoLkVycm9yKHJlc3VsdC5tZXNzYWdlKTtcbiAgaWYgKHJlc3VsdC5wYXRoKSB7XG4gICAgZXJyLm1lc3NhZ2UgKz0gYCBpbiBmaWVsZCAke3Jlc3VsdC5wYXRofWA7XG4gICAgZXJyLnBhdGggPSByZXN1bHQucGF0aDtcbiAgfVxuXG4gIHJldHVybiBlcnI7XG59XG5cbi8qKlxuICogQHN1bW1hcnkgQ2hlY2sgdGhhdCBhIHZhbHVlIG1hdGNoZXMgYSBbcGF0dGVybl0oI21hdGNocGF0dGVybnMpLlxuICogSWYgdGhlIHZhbHVlIGRvZXMgbm90IG1hdGNoIHRoZSBwYXR0ZXJuLCB0aHJvdyBhIGBNYXRjaC5FcnJvcmAuXG4gKiBCeSBkZWZhdWx0LCBpdCB3aWxsIHRocm93IGltbWVkaWF0ZWx5IGF0IHRoZSBmaXJzdCBlcnJvciBlbmNvdW50ZXJlZC4gUGFzcyBpbiB7IHRocm93QWxsRXJyb3JzOiB0cnVlIH0gdG8gdGhyb3cgYWxsIGVycm9ycy5cbiAqXG4gKiBQYXJ0aWN1bGFybHkgdXNlZnVsIHRvIGFzc2VydCB0aGF0IGFyZ3VtZW50cyB0byBhIGZ1bmN0aW9uIGhhdmUgdGhlIHJpZ2h0XG4gKiB0eXBlcyBhbmQgc3RydWN0dXJlLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAcGFyYW0ge0FueX0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrXG4gKiBAcGFyYW0ge01hdGNoUGF0dGVybn0gcGF0dGVybiBUaGUgcGF0dGVybiB0byBtYXRjaCBgdmFsdWVgIGFnYWluc3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gQWRkaXRpb25hbCBvcHRpb25zIGZvciBjaGVja1xuICogQHBhcmFtIHtCb29sZWFufSBbb3B0aW9ucy50aHJvd0FsbEVycm9ycz1mYWxzZV0gSWYgdHJ1ZSwgdGhyb3cgYWxsIGVycm9yc1xuICovXG5leHBvcnQgZnVuY3Rpb24gY2hlY2sodmFsdWUsIHBhdHRlcm4sIG9wdGlvbnMgPSB7IHRocm93QWxsRXJyb3JzOiBmYWxzZSB9KSB7XG4gIC8vIFJlY29yZCB0aGF0IGNoZWNrIGdvdCBjYWxsZWQsIGlmIHNvbWVib2R5IGNhcmVkLlxuICAvL1xuICAvLyBXZSB1c2UgZ2V0T3JOdWxsSWZPdXRzaWRlRmliZXIgc28gdGhhdCBpdCdzIE9LIHRvIGNhbGwgY2hlY2soKVxuICAvLyBmcm9tIG5vbi1GaWJlciBzZXJ2ZXIgY29udGV4dHM7IHRoZSBkb3duc2lkZSBpcyB0aGF0IGlmIHlvdSBmb3JnZXQgdG9cbiAgLy8gYmluZEVudmlyb25tZW50IG9uIHNvbWUgcmFuZG9tIGNhbGxiYWNrIGluIHlvdXIgbWV0aG9kL3B1Ymxpc2hlcixcbiAgLy8gaXQgbWlnaHQgbm90IGZpbmQgdGhlIGFyZ3VtZW50Q2hlY2tlciBhbmQgeW91J2xsIGdldCBhbiBlcnJvciBhYm91dFxuICAvLyBub3QgY2hlY2tpbmcgYW4gYXJndW1lbnQgdGhhdCBpdCBsb29rcyBsaWtlIHlvdSdyZSBjaGVja2luZyAoaW5zdGVhZFxuICAvLyBvZiBqdXN0IGdldHRpbmcgYSBcIk5vZGUgY29kZSBtdXN0IHJ1biBpbiBhIEZpYmVyXCIgZXJyb3IpLlxuICBjb25zdCBhcmdDaGVja2VyID0gY3VycmVudEFyZ3VtZW50Q2hlY2tlci5nZXRPck51bGxJZk91dHNpZGVGaWJlcigpO1xuICBpZiAoYXJnQ2hlY2tlcikge1xuICAgIGFyZ0NoZWNrZXIuY2hlY2tpbmcodmFsdWUpO1xuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gdGVzdFN1YnRyZWUodmFsdWUsIHBhdHRlcm4sIG9wdGlvbnMudGhyb3dBbGxFcnJvcnMpO1xuXG4gIGlmIChyZXN1bHQpIHtcbiAgICBpZiAob3B0aW9ucy50aHJvd0FsbEVycm9ycykge1xuICAgICAgdGhyb3cgQXJyYXkuaXNBcnJheShyZXN1bHQpID8gcmVzdWx0Lm1hcChyID0+IGZvcm1hdChyKSkgOiBbZm9ybWF0KHJlc3VsdCldXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGZvcm1hdChyZXN1bHQpXG4gICAgfVxuICB9XG59O1xuXG4vKipcbiAqIEBuYW1lc3BhY2UgTWF0Y2hcbiAqIEBzdW1tYXJ5IFRoZSBuYW1lc3BhY2UgZm9yIGFsbCBNYXRjaCB0eXBlcyBhbmQgbWV0aG9kcy5cbiAqL1xuZXhwb3J0IGNvbnN0IE1hdGNoID0ge1xuICBPcHRpb25hbDogZnVuY3Rpb24ocGF0dGVybikge1xuICAgIHJldHVybiBuZXcgT3B0aW9uYWwocGF0dGVybik7XG4gIH0sXG5cbiAgTWF5YmU6IGZ1bmN0aW9uKHBhdHRlcm4pIHtcbiAgICByZXR1cm4gbmV3IE1heWJlKHBhdHRlcm4pO1xuICB9LFxuXG4gIE9uZU9mOiBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgcmV0dXJuIG5ldyBPbmVPZihhcmdzKTtcbiAgfSxcblxuICBBbnk6IFsnX19hbnlfXyddLFxuICBXaGVyZTogZnVuY3Rpb24oY29uZGl0aW9uKSB7XG4gICAgcmV0dXJuIG5ldyBXaGVyZShjb25kaXRpb24pO1xuICB9LFxuXG4gIE9iamVjdEluY2x1ZGluZzogZnVuY3Rpb24ocGF0dGVybikge1xuICAgIHJldHVybiBuZXcgT2JqZWN0SW5jbHVkaW5nKHBhdHRlcm4pXG4gIH0sXG5cbiAgT2JqZWN0V2l0aFZhbHVlczogZnVuY3Rpb24ocGF0dGVybikge1xuICAgIHJldHVybiBuZXcgT2JqZWN0V2l0aFZhbHVlcyhwYXR0ZXJuKTtcbiAgfSxcblxuICAvLyBNYXRjaGVzIG9ubHkgc2lnbmVkIDMyLWJpdCBpbnRlZ2Vyc1xuICBJbnRlZ2VyOiBbJ19faW50ZWdlcl9fJ10sXG5cbiAgLy8gWFhYIG1hdGNoZXJzIHNob3VsZCBrbm93IGhvdyB0byBkZXNjcmliZSB0aGVtc2VsdmVzIGZvciBlcnJvcnNcbiAgRXJyb3I6IE1ldGVvci5tYWtlRXJyb3JUeXBlKCdNYXRjaC5FcnJvcicsIGZ1bmN0aW9uIChtc2cpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBgTWF0Y2ggZXJyb3I6ICR7bXNnfWA7XG5cbiAgICAvLyBUaGUgcGF0aCBvZiB0aGUgdmFsdWUgdGhhdCBmYWlsZWQgdG8gbWF0Y2guIEluaXRpYWxseSBlbXB0eSwgdGhpcyBnZXRzXG4gICAgLy8gcG9wdWxhdGVkIGJ5IGNhdGNoaW5nIGFuZCByZXRocm93aW5nIHRoZSBleGNlcHRpb24gYXMgaXQgZ29lcyBiYWNrIHVwIHRoZVxuICAgIC8vIHN0YWNrLlxuICAgIC8vIEUuZy46IFwidmFsc1szXS5lbnRpdHkuY3JlYXRlZFwiXG4gICAgdGhpcy5wYXRoID0gJyc7XG5cbiAgICAvLyBJZiB0aGlzIGdldHMgc2VudCBvdmVyIEREUCwgZG9uJ3QgZ2l2ZSBmdWxsIGludGVybmFsIGRldGFpbHMgYnV0IGF0IGxlYXN0XG4gICAgLy8gcHJvdmlkZSBzb21ldGhpbmcgYmV0dGVyIHRoYW4gNTAwIEludGVybmFsIHNlcnZlciBlcnJvci5cbiAgICB0aGlzLnNhbml0aXplZEVycm9yID0gbmV3IE1ldGVvci5FcnJvcig0MDAsICdNYXRjaCBmYWlsZWQnKTtcbiAgfSksXG5cbiAgLy8gVGVzdHMgdG8gc2VlIGlmIHZhbHVlIG1hdGNoZXMgcGF0dGVybi4gVW5saWtlIGNoZWNrLCBpdCBtZXJlbHkgcmV0dXJucyB0cnVlXG4gIC8vIG9yIGZhbHNlICh1bmxlc3MgYW4gZXJyb3Igb3RoZXIgdGhhbiBNYXRjaC5FcnJvciB3YXMgdGhyb3duKS4gSXQgZG9lcyBub3RcbiAgLy8gaW50ZXJhY3Qgd2l0aCBfZmFpbElmQXJndW1lbnRzQXJlTm90QWxsQ2hlY2tlZC5cbiAgLy8gWFhYIG1heWJlIGFsc28gaW1wbGVtZW50IGEgTWF0Y2gubWF0Y2ggd2hpY2ggcmV0dXJucyBtb3JlIGluZm9ybWF0aW9uIGFib3V0XG4gIC8vICAgICBmYWlsdXJlcyBidXQgd2l0aG91dCB1c2luZyBleGNlcHRpb24gaGFuZGxpbmcgb3IgZG9pbmcgd2hhdCBjaGVjaygpXG4gIC8vICAgICBkb2VzIHdpdGggX2ZhaWxJZkFyZ3VtZW50c0FyZU5vdEFsbENoZWNrZWQgYW5kIE1ldGVvci5FcnJvciBjb252ZXJzaW9uXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJldHVybnMgdHJ1ZSBpZiB0aGUgdmFsdWUgbWF0Y2hlcyB0aGUgcGF0dGVybi5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBwYXJhbSB7QW55fSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2tcbiAgICogQHBhcmFtIHtNYXRjaFBhdHRlcm59IHBhdHRlcm4gVGhlIHBhdHRlcm4gdG8gbWF0Y2ggYHZhbHVlYCBhZ2FpbnN0XG4gICAqL1xuICB0ZXN0KHZhbHVlLCBwYXR0ZXJuKSB7XG4gICAgcmV0dXJuICF0ZXN0U3VidHJlZSh2YWx1ZSwgcGF0dGVybik7XG4gIH0sXG5cbiAgLy8gUnVucyBgZi5hcHBseShjb250ZXh0LCBhcmdzKWAuIElmIGNoZWNrKCkgaXMgbm90IGNhbGxlZCBvbiBldmVyeSBlbGVtZW50IG9mXG4gIC8vIGBhcmdzYCAoZWl0aGVyIGRpcmVjdGx5IG9yIGluIHRoZSBmaXJzdCBsZXZlbCBvZiBhbiBhcnJheSksIHRocm93cyBhbiBlcnJvclxuICAvLyAodXNpbmcgYGRlc2NyaXB0aW9uYCBpbiB0aGUgbWVzc2FnZSkuXG4gIF9mYWlsSWZBcmd1bWVudHNBcmVOb3RBbGxDaGVja2VkKGYsIGNvbnRleHQsIGFyZ3MsIGRlc2NyaXB0aW9uKSB7XG4gICAgY29uc3QgYXJnQ2hlY2tlciA9IG5ldyBBcmd1bWVudENoZWNrZXIoYXJncywgZGVzY3JpcHRpb24pO1xuICAgIGNvbnN0IHJlc3VsdCA9IGN1cnJlbnRBcmd1bWVudENoZWNrZXIud2l0aFZhbHVlKFxuICAgICAgYXJnQ2hlY2tlcixcbiAgICAgICgpID0+IGYuYXBwbHkoY29udGV4dCwgYXJncylcbiAgICApO1xuXG4gICAgLy8gSWYgZiBkaWRuJ3QgaXRzZWxmIHRocm93LCBtYWtlIHN1cmUgaXQgY2hlY2tlZCBhbGwgb2YgaXRzIGFyZ3VtZW50cy5cbiAgICBhcmdDaGVja2VyLnRocm93VW5sZXNzQWxsQXJndW1lbnRzSGF2ZUJlZW5DaGVja2VkKCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufTtcblxuY2xhc3MgT3B0aW9uYWwge1xuICBjb25zdHJ1Y3RvcihwYXR0ZXJuKSB7XG4gICAgdGhpcy5wYXR0ZXJuID0gcGF0dGVybjtcbiAgfVxufVxuXG5jbGFzcyBNYXliZSB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4pIHtcbiAgICB0aGlzLnBhdHRlcm4gPSBwYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIE9uZU9mIHtcbiAgY29uc3RydWN0b3IoY2hvaWNlcykge1xuICAgIGlmICghY2hvaWNlcyB8fCBjaG9pY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNdXN0IHByb3ZpZGUgYXQgbGVhc3Qgb25lIGNob2ljZSB0byBNYXRjaC5PbmVPZicpO1xuICAgIH1cblxuICAgIHRoaXMuY2hvaWNlcyA9IGNob2ljZXM7XG4gIH1cbn1cblxuY2xhc3MgV2hlcmUge1xuICBjb25zdHJ1Y3Rvcihjb25kaXRpb24pIHtcbiAgICB0aGlzLmNvbmRpdGlvbiA9IGNvbmRpdGlvbjtcbiAgfVxufVxuXG5jbGFzcyBPYmplY3RJbmNsdWRpbmcge1xuICBjb25zdHJ1Y3RvcihwYXR0ZXJuKSB7XG4gICAgdGhpcy5wYXR0ZXJuID0gcGF0dGVybjtcbiAgfVxufVxuXG5jbGFzcyBPYmplY3RXaXRoVmFsdWVzIHtcbiAgY29uc3RydWN0b3IocGF0dGVybikge1xuICAgIHRoaXMucGF0dGVybiA9IHBhdHRlcm47XG4gIH1cbn1cblxuY29uc3Qgc3RyaW5nRm9yRXJyb3JNZXNzYWdlID0gKHZhbHVlLCBvcHRpb25zID0ge30pID0+IHtcbiAgaWYgKCB2YWx1ZSA9PT0gbnVsbCApIHtcbiAgICByZXR1cm4gJ251bGwnO1xuICB9XG5cbiAgaWYgKCBvcHRpb25zLm9ubHlTaG93VHlwZSApIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlO1xuICB9XG5cbiAgLy8gWW91ciBhdmVyYWdlIG5vbi1vYmplY3QgdGhpbmdzLiAgU2F2ZXMgZnJvbSBkb2luZyB0aGUgdHJ5L2NhdGNoIGJlbG93IGZvci5cbiAgaWYgKCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnICkge1xuICAgIHJldHVybiBFSlNPTi5zdHJpbmdpZnkodmFsdWUpXG4gIH1cblxuICB0cnkge1xuXG4gICAgLy8gRmluZCBvYmplY3RzIHdpdGggY2lyY3VsYXIgcmVmZXJlbmNlcyBzaW5jZSBFSlNPTiBkb2Vzbid0IHN1cHBvcnQgdGhlbSB5ZXQgKElzc3VlICM0Nzc4ICsgVW5hY2NlcHRlZCBQUilcbiAgICAvLyBJZiB0aGUgbmF0aXZlIHN0cmluZ2lmeSBpcyBnb2luZyB0byBjaG9rZSwgRUpTT04uc3RyaW5naWZ5IGlzIGdvaW5nIHRvIGNob2tlIHRvby5cbiAgICBKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XG4gIH0gY2F0Y2ggKHN0cmluZ2lmeUVycm9yKSB7XG4gICAgaWYgKCBzdHJpbmdpZnlFcnJvci5uYW1lID09PSAnVHlwZUVycm9yJyApIHtcbiAgICAgIHJldHVybiB0eXBlb2YgdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIEVKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XG59O1xuXG5jb25zdCB0eXBlb2ZDaGVja3MgPSBbXG4gIFtTdHJpbmcsICdzdHJpbmcnXSxcbiAgW051bWJlciwgJ251bWJlciddLFxuICBbQm9vbGVhbiwgJ2Jvb2xlYW4nXSxcblxuICAvLyBXaGlsZSB3ZSBkb24ndCBhbGxvdyB1bmRlZmluZWQvZnVuY3Rpb24gaW4gRUpTT04sIHRoaXMgaXMgZ29vZCBmb3Igb3B0aW9uYWxcbiAgLy8gYXJndW1lbnRzIHdpdGggT25lT2YuXG4gIFtGdW5jdGlvbiwgJ2Z1bmN0aW9uJ10sXG4gIFt1bmRlZmluZWQsICd1bmRlZmluZWQnXSxcbl07XG5cbi8vIFJldHVybiBgZmFsc2VgIGlmIGl0IG1hdGNoZXMuIE90aGVyd2lzZSwgcmV0dXJucyBhbiBvYmplY3Qgd2l0aCBhIGBtZXNzYWdlYCBhbmQgYSBgcGF0aGAgZmllbGQgb3IgYW4gYXJyYXkgb2Ygb2JqZWN0cyBlYWNoIHdpdGggYSBgbWVzc2FnZWAgYW5kIGEgYHBhdGhgIGZpZWxkIHdoZW4gY29sbGVjdGluZyBlcnJvcnMuXG5jb25zdCB0ZXN0U3VidHJlZSA9ICh2YWx1ZSwgcGF0dGVybiwgY29sbGVjdEVycm9ycyA9IGZhbHNlLCBlcnJvcnMgPSBbXSwgcGF0aCA9ICcnKSA9PiB7XG4gIC8vIE1hdGNoIGFueXRoaW5nIVxuICBpZiAocGF0dGVybiA9PT0gTWF0Y2guQW55KSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gQmFzaWMgYXRvbWljIHR5cGVzLlxuICAvLyBEbyBub3QgbWF0Y2ggYm94ZWQgb2JqZWN0cyAoZS5nLiBTdHJpbmcsIEJvb2xlYW4pXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdHlwZW9mQ2hlY2tzLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKHBhdHRlcm4gPT09IHR5cGVvZkNoZWNrc1tpXVswXSkge1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gdHlwZW9mQ2hlY2tzW2ldWzFdKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWVzc2FnZTogYEV4cGVjdGVkICR7dHlwZW9mQ2hlY2tzW2ldWzFdfSwgZ290ICR7c3RyaW5nRm9yRXJyb3JNZXNzYWdlKHZhbHVlLCB7IG9ubHlTaG93VHlwZTogdHJ1ZSB9KX1gLFxuICAgICAgICBwYXRoOiAnJyxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgaWYgKHBhdHRlcm4gPT09IG51bGwpIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogYEV4cGVjdGVkIG51bGwsIGdvdCAke3N0cmluZ0ZvckVycm9yTWVzc2FnZSh2YWx1ZSl9YCxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG4gIH1cblxuICAvLyBTdHJpbmdzLCBudW1iZXJzLCBhbmQgYm9vbGVhbnMgbWF0Y2ggbGl0ZXJhbGx5LiBHb2VzIHdlbGwgd2l0aCBNYXRjaC5PbmVPZi5cbiAgaWYgKHR5cGVvZiBwYXR0ZXJuID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgcGF0dGVybiA9PT0gJ251bWJlcicgfHwgdHlwZW9mIHBhdHRlcm4gPT09ICdib29sZWFuJykge1xuICAgIGlmICh2YWx1ZSA9PT0gcGF0dGVybikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiBgRXhwZWN0ZWQgJHtwYXR0ZXJufSwgZ290ICR7c3RyaW5nRm9yRXJyb3JNZXNzYWdlKHZhbHVlKX1gLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIC8vIE1hdGNoLkludGVnZXIgaXMgc3BlY2lhbCB0eXBlIGVuY29kZWQgd2l0aCBhcnJheVxuICBpZiAocGF0dGVybiA9PT0gTWF0Y2guSW50ZWdlcikge1xuXG4gICAgLy8gVGhlcmUgaXMgbm8gY29uc2lzdGVudCBhbmQgcmVsaWFibGUgd2F5IHRvIGNoZWNrIGlmIHZhcmlhYmxlIGlzIGEgNjQtYml0XG4gICAgLy8gaW50ZWdlci4gT25lIG9mIHRoZSBwb3B1bGFyIHNvbHV0aW9ucyBpcyB0byBnZXQgcmVtaW5kZXIgb2YgZGl2aXNpb24gYnkgMVxuICAgIC8vIGJ1dCB0aGlzIG1ldGhvZCBmYWlscyBvbiByZWFsbHkgbGFyZ2UgZmxvYXRzIHdpdGggYmlnIHByZWNpc2lvbi5cbiAgICAvLyBFLmcuOiAxLjM0ODE5MjMwODQ5MTgyNGUrMjMgJSAxID09PSAwIGluIFY4XG4gICAgLy8gQml0d2lzZSBvcGVyYXRvcnMgd29yayBjb25zaXN0YW50bHkgYnV0IGFsd2F5cyBjYXN0IHZhcmlhYmxlIHRvIDMyLWJpdFxuICAgIC8vIHNpZ25lZCBpbnRlZ2VyIGFjY29yZGluZyB0byBKYXZhU2NyaXB0IHNwZWNzLlxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmICh2YWx1ZSB8IDApID09PSB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiBgRXhwZWN0ZWQgSW50ZWdlciwgZ290ICR7c3RyaW5nRm9yRXJyb3JNZXNzYWdlKHZhbHVlKX1gLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIC8vICdPYmplY3QnIGlzIHNob3J0aGFuZCBmb3IgTWF0Y2guT2JqZWN0SW5jbHVkaW5nKHt9KTtcbiAgaWYgKHBhdHRlcm4gPT09IE9iamVjdCkge1xuICAgIHBhdHRlcm4gPSBNYXRjaC5PYmplY3RJbmNsdWRpbmcoe30pO1xuICB9XG5cbiAgLy8gQXJyYXkgKGNoZWNrZWQgQUZURVIgQW55LCB3aGljaCBpcyBpbXBsZW1lbnRlZCBhcyBhbiBBcnJheSkuXG4gIGlmIChwYXR0ZXJuIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICBpZiAocGF0dGVybi5sZW5ndGggIT09IDEpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1lc3NhZ2U6IGBCYWQgcGF0dGVybjogYXJyYXlzIG11c3QgaGF2ZSBvbmUgdHlwZSBlbGVtZW50ICR7c3RyaW5nRm9yRXJyb3JNZXNzYWdlKHBhdHRlcm4pfWAsXG4gICAgICAgIHBhdGg6ICcnLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpICYmICFpc0FyZ3VtZW50cyh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1lc3NhZ2U6IGBFeHBlY3RlZCBhcnJheSwgZ290ICR7c3RyaW5nRm9yRXJyb3JNZXNzYWdlKHZhbHVlKX1gLFxuICAgICAgICBwYXRoOiAnJyxcbiAgICAgIH07XG4gICAgfVxuXG5cbiAgICBmb3IgKGxldCBpID0gMCwgbGVuZ3RoID0gdmFsdWUubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGFyclBhdGggPSBgJHtwYXRofVske2l9XWBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHRlc3RTdWJ0cmVlKHZhbHVlW2ldLCBwYXR0ZXJuWzBdLCBjb2xsZWN0RXJyb3JzLCBlcnJvcnMsIGFyclBhdGgpO1xuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICByZXN1bHQucGF0aCA9IF9wcmVwZW5kUGF0aChjb2xsZWN0RXJyb3JzID8gYXJyUGF0aCA6IGksIHJlc3VsdC5wYXRoKVxuICAgICAgICBpZiAoIWNvbGxlY3RFcnJvcnMpIHJldHVybiByZXN1bHQ7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWVbaV0gIT09ICdvYmplY3QnIHx8IHJlc3VsdC5tZXNzYWdlKSBlcnJvcnMucHVzaChyZXN1bHQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFjb2xsZWN0RXJyb3JzKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIGVycm9ycy5sZW5ndGggPT09IDAgPyBmYWxzZSA6IGVycm9ycztcbiAgfVxuXG4gIC8vIEFyYml0cmFyeSB2YWxpZGF0aW9uIGNoZWNrcy4gVGhlIGNvbmRpdGlvbiBjYW4gcmV0dXJuIGZhbHNlIG9yIHRocm93IGFcbiAgLy8gTWF0Y2guRXJyb3IgKGllLCBpdCBjYW4gaW50ZXJuYWxseSB1c2UgY2hlY2soKSkgdG8gZmFpbC5cbiAgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBXaGVyZSkge1xuICAgIGxldCByZXN1bHQ7XG4gICAgdHJ5IHtcbiAgICAgIHJlc3VsdCA9IHBhdHRlcm4uY29uZGl0aW9uKHZhbHVlKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmICghKGVyciBpbnN0YW5jZW9mIE1hdGNoLkVycm9yKSkge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1lc3NhZ2U6IGVyci5tZXNzYWdlLFxuICAgICAgICBwYXRoOiBlcnIucGF0aFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAocmVzdWx0KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gWFhYIHRoaXMgZXJyb3IgaXMgdGVycmlibGVcblxuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiAnRmFpbGVkIE1hdGNoLldoZXJlIHZhbGlkYXRpb24nLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIGlmIChwYXR0ZXJuIGluc3RhbmNlb2YgTWF5YmUpIHtcbiAgICBwYXR0ZXJuID0gTWF0Y2guT25lT2YodW5kZWZpbmVkLCBudWxsLCBwYXR0ZXJuLnBhdHRlcm4pO1xuICB9IGVsc2UgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBPcHRpb25hbCkge1xuICAgIHBhdHRlcm4gPSBNYXRjaC5PbmVPZih1bmRlZmluZWQsIHBhdHRlcm4ucGF0dGVybik7XG4gIH1cblxuICBpZiAocGF0dGVybiBpbnN0YW5jZW9mIE9uZU9mKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuLmNob2ljZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHRlc3RTdWJ0cmVlKHZhbHVlLCBwYXR0ZXJuLmNob2ljZXNbaV0pO1xuICAgICAgaWYgKCFyZXN1bHQpIHtcblxuICAgICAgICAvLyBObyBlcnJvcj8gWWF5LCByZXR1cm4uXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8gTWF0Y2ggZXJyb3JzIGp1c3QgbWVhbiB0cnkgYW5vdGhlciBjaG9pY2UuXG4gICAgfVxuXG4gICAgLy8gWFhYIHRoaXMgZXJyb3IgaXMgdGVycmlibGVcbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogJ0ZhaWxlZCBNYXRjaC5PbmVPZiwgTWF0Y2guTWF5YmUgb3IgTWF0Y2guT3B0aW9uYWwgdmFsaWRhdGlvbicsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgLy8gQSBmdW5jdGlvbiB0aGF0IGlzbid0IHNvbWV0aGluZyB3ZSBzcGVjaWFsLWNhc2UgaXMgYXNzdW1lZCB0byBiZSBhXG4gIC8vIGNvbnN0cnVjdG9yLlxuICBpZiAocGF0dGVybiBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgcGF0dGVybikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiBgRXhwZWN0ZWQgJHtwYXR0ZXJuLm5hbWUgfHwgJ3BhcnRpY3VsYXIgY29uc3RydWN0b3InfWAsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgbGV0IHVua25vd25LZXlzQWxsb3dlZCA9IGZhbHNlO1xuICBsZXQgdW5rbm93bktleVBhdHRlcm47XG4gIGlmIChwYXR0ZXJuIGluc3RhbmNlb2YgT2JqZWN0SW5jbHVkaW5nKSB7XG4gICAgdW5rbm93bktleXNBbGxvd2VkID0gdHJ1ZTtcbiAgICBwYXR0ZXJuID0gcGF0dGVybi5wYXR0ZXJuO1xuICB9XG5cbiAgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBPYmplY3RXaXRoVmFsdWVzKSB7XG4gICAgdW5rbm93bktleXNBbGxvd2VkID0gdHJ1ZTtcbiAgICB1bmtub3duS2V5UGF0dGVybiA9IFtwYXR0ZXJuLnBhdHRlcm5dO1xuICAgIHBhdHRlcm4gPSB7fTsgIC8vIG5vIHJlcXVpcmVkIGtleXNcbiAgfVxuXG4gIGlmICh0eXBlb2YgcGF0dGVybiAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogJ0JhZCBwYXR0ZXJuOiB1bmtub3duIHBhdHRlcm4gdHlwZScsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgLy8gQW4gb2JqZWN0LCB3aXRoIHJlcXVpcmVkIGFuZCBvcHRpb25hbCBrZXlzLiBOb3RlIHRoYXQgdGhpcyBkb2VzIE5PVCBkb1xuICAvLyBzdHJ1Y3R1cmFsIG1hdGNoZXMgYWdhaW5zdCBvYmplY3RzIG9mIHNwZWNpYWwgdHlwZXMgdGhhdCBoYXBwZW4gdG8gbWF0Y2hcbiAgLy8gdGhlIHBhdHRlcm46IHRoaXMgcmVhbGx5IG5lZWRzIHRvIGJlIGEgcGxhaW4gb2xkIHtPYmplY3R9IVxuICBpZiAodHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiBgRXhwZWN0ZWQgb2JqZWN0LCBnb3QgJHt0eXBlb2YgdmFsdWV9YCxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG4gIH1cblxuICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogYEV4cGVjdGVkIG9iamVjdCwgZ290IG51bGxgLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIGlmICghIGlzUGxhaW5PYmplY3QodmFsdWUpKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6IGBFeHBlY3RlZCBwbGFpbiBvYmplY3RgLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHJlcXVpcmVkUGF0dGVybnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICBjb25zdCBvcHRpb25hbFBhdHRlcm5zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICBPYmplY3Qua2V5cyhwYXR0ZXJuKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgY29uc3Qgc3ViUGF0dGVybiA9IHBhdHRlcm5ba2V5XTtcbiAgICBpZiAoc3ViUGF0dGVybiBpbnN0YW5jZW9mIE9wdGlvbmFsIHx8XG4gICAgICAgIHN1YlBhdHRlcm4gaW5zdGFuY2VvZiBNYXliZSkge1xuICAgICAgb3B0aW9uYWxQYXR0ZXJuc1trZXldID0gc3ViUGF0dGVybi5wYXR0ZXJuO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXF1aXJlZFBhdHRlcm5zW2tleV0gPSBzdWJQYXR0ZXJuO1xuICAgIH1cbiAgfSk7XG5cbiAgZm9yIChsZXQga2V5IGluIE9iamVjdCh2YWx1ZSkpIHtcbiAgICBjb25zdCBzdWJWYWx1ZSA9IHZhbHVlW2tleV07XG4gICAgY29uc3Qgb2JqUGF0aCA9IHBhdGggPyBgJHtwYXRofS4ke2tleX1gIDoga2V5O1xuICAgIGlmIChoYXNPd24uY2FsbChyZXF1aXJlZFBhdHRlcm5zLCBrZXkpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZShzdWJWYWx1ZSwgcmVxdWlyZWRQYXR0ZXJuc1trZXldLCBjb2xsZWN0RXJyb3JzLCBlcnJvcnMsIG9ialBhdGgpO1xuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICByZXN1bHQucGF0aCA9IF9wcmVwZW5kUGF0aChjb2xsZWN0RXJyb3JzID8gb2JqUGF0aCA6IGtleSwgcmVzdWx0LnBhdGgpXG4gICAgICAgIGlmICghY29sbGVjdEVycm9ycykgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgaWYgKHR5cGVvZiBzdWJWYWx1ZSAhPT0gJ29iamVjdCcgfHwgcmVzdWx0Lm1lc3NhZ2UpIGVycm9ycy5wdXNoKHJlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIGRlbGV0ZSByZXF1aXJlZFBhdHRlcm5zW2tleV07XG4gICAgfSBlbHNlIGlmIChoYXNPd24uY2FsbChvcHRpb25hbFBhdHRlcm5zLCBrZXkpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZShzdWJWYWx1ZSwgb3B0aW9uYWxQYXR0ZXJuc1trZXldLCBjb2xsZWN0RXJyb3JzLCBlcnJvcnMsIG9ialBhdGgpO1xuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICByZXN1bHQucGF0aCA9IF9wcmVwZW5kUGF0aChjb2xsZWN0RXJyb3JzID8gb2JqUGF0aCA6IGtleSwgcmVzdWx0LnBhdGgpXG4gICAgICAgIGlmICghY29sbGVjdEVycm9ycykgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgaWYgKHR5cGVvZiBzdWJWYWx1ZSAhPT0gJ29iamVjdCcgfHwgcmVzdWx0Lm1lc3NhZ2UpIGVycm9ycy5wdXNoKHJlc3VsdCk7XG4gICAgICB9XG5cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCF1bmtub3duS2V5c0FsbG93ZWQpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICAgIG1lc3NhZ2U6ICdVbmtub3duIGtleScsXG4gICAgICAgICAgcGF0aDoga2V5LFxuICAgICAgICB9O1xuICAgICAgICBpZiAoIWNvbGxlY3RFcnJvcnMpIHJldHVybiByZXN1bHQ7XG4gICAgICAgIGVycm9ycy5wdXNoKHJlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIGlmICh1bmtub3duS2V5UGF0dGVybikge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZShzdWJWYWx1ZSwgdW5rbm93bktleVBhdHRlcm5bMF0sIGNvbGxlY3RFcnJvcnMsIGVycm9ycywgb2JqUGF0aCk7XG4gICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICByZXN1bHQucGF0aCA9IF9wcmVwZW5kUGF0aChjb2xsZWN0RXJyb3JzID8gb2JqUGF0aCA6IGtleSwgcmVzdWx0LnBhdGgpXG4gICAgICAgICAgaWYgKCFjb2xsZWN0RXJyb3JzKSByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgIGlmICh0eXBlb2Ygc3ViVmFsdWUgIT09ICdvYmplY3QnIHx8IHJlc3VsdC5tZXNzYWdlKSBlcnJvcnMucHVzaChyZXN1bHQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHJlcXVpcmVkUGF0dGVybnMpO1xuICBpZiAoa2V5cy5sZW5ndGgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBtZXNzYWdlOiBgTWlzc2luZyBrZXkgJyR7a2V5c1swXX0nYCxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG5cbiAgICBpZiAoIWNvbGxlY3RFcnJvcnMpIHJldHVybiByZXN1bHQ7XG4gICAgZXJyb3JzLnB1c2gocmVzdWx0KTtcbiAgfVxuXG4gIGlmICghY29sbGVjdEVycm9ycykgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gZXJyb3JzLmxlbmd0aCA9PT0gMCA/IGZhbHNlIDogZXJyb3JzO1xufTtcblxuY2xhc3MgQXJndW1lbnRDaGVja2VyIHtcbiAgY29uc3RydWN0b3IgKGFyZ3MsIGRlc2NyaXB0aW9uKSB7XG5cbiAgICAvLyBNYWtlIGEgU0hBTExPVyBjb3B5IG9mIHRoZSBhcmd1bWVudHMuIChXZSdsbCBiZSBkb2luZyBpZGVudGl0eSBjaGVja3NcbiAgICAvLyBhZ2FpbnN0IGl0cyBjb250ZW50cy4pXG4gICAgdGhpcy5hcmdzID0gWy4uLmFyZ3NdO1xuXG4gICAgLy8gU2luY2UgdGhlIGNvbW1vbiBjYXNlIHdpbGwgYmUgdG8gY2hlY2sgYXJndW1lbnRzIGluIG9yZGVyLCBhbmQgd2Ugc3BsaWNlXG4gICAgLy8gb3V0IGFyZ3VtZW50cyB3aGVuIHdlIGNoZWNrIHRoZW0sIG1ha2UgaXQgc28gd2Ugc3BsaWNlIG91dCBmcm9tIHRoZSBlbmRcbiAgICAvLyByYXRoZXIgdGhhbiB0aGUgYmVnaW5uaW5nLlxuICAgIHRoaXMuYXJncy5yZXZlcnNlKCk7XG4gICAgdGhpcy5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuICB9XG5cbiAgY2hlY2tpbmcodmFsdWUpIHtcbiAgICBpZiAodGhpcy5fY2hlY2tpbmdPbmVWYWx1ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBBbGxvdyBjaGVjayhhcmd1bWVudHMsIFtTdHJpbmddKSBvciBjaGVjayhhcmd1bWVudHMuc2xpY2UoMSksIFtTdHJpbmddKVxuICAgIC8vIG9yIGNoZWNrKFtmb28sIGJhcl0sIFtTdHJpbmddKSB0byBjb3VudC4uLiBidXQgb25seSBpZiB2YWx1ZSB3YXNuJ3RcbiAgICAvLyBpdHNlbGYgYW4gYXJndW1lbnQuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpIHx8IGlzQXJndW1lbnRzKHZhbHVlKSkge1xuICAgICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCh2YWx1ZSwgdGhpcy5fY2hlY2tpbmdPbmVWYWx1ZS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICBfY2hlY2tpbmdPbmVWYWx1ZSh2YWx1ZSkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5hcmdzLmxlbmd0aDsgKytpKSB7XG5cbiAgICAgIC8vIElzIHRoaXMgdmFsdWUgb25lIG9mIHRoZSBhcmd1bWVudHM/IChUaGlzIGNhbiBoYXZlIGEgZmFsc2UgcG9zaXRpdmUgaWZcbiAgICAgIC8vIHRoZSBhcmd1bWVudCBpcyBhbiBpbnRlcm5lZCBwcmltaXRpdmUsIGJ1dCBpdCdzIHN0aWxsIGEgZ29vZCBlbm91Z2hcbiAgICAgIC8vIGNoZWNrLilcbiAgICAgIC8vIChOYU4gaXMgbm90ID09PSB0byBpdHNlbGYsIHNvIHdlIGhhdmUgdG8gY2hlY2sgc3BlY2lhbGx5LilcbiAgICAgIGlmICh2YWx1ZSA9PT0gdGhpcy5hcmdzW2ldIHx8XG4gICAgICAgICAgKE51bWJlci5pc05hTih2YWx1ZSkgJiYgTnVtYmVyLmlzTmFOKHRoaXMuYXJnc1tpXSkpKSB7XG4gICAgICAgIHRoaXMuYXJncy5zcGxpY2UoaSwgMSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICB0aHJvd1VubGVzc0FsbEFyZ3VtZW50c0hhdmVCZWVuQ2hlY2tlZCgpIHtcbiAgICBpZiAodGhpcy5hcmdzLmxlbmd0aCA+IDApXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYERpZCBub3QgY2hlY2soKSBhbGwgYXJndW1lbnRzIGR1cmluZyAke3RoaXMuZGVzY3JpcHRpb259YCk7XG4gIH1cbn1cblxuY29uc3QgX2pzS2V5d29yZHMgPSBbJ2RvJywgJ2lmJywgJ2luJywgJ2ZvcicsICdsZXQnLCAnbmV3JywgJ3RyeScsICd2YXInLCAnY2FzZScsXG4gICdlbHNlJywgJ2VudW0nLCAnZXZhbCcsICdmYWxzZScsICdudWxsJywgJ3RoaXMnLCAndHJ1ZScsICd2b2lkJywgJ3dpdGgnLFxuICAnYnJlYWsnLCAnY2F0Y2gnLCAnY2xhc3MnLCAnY29uc3QnLCAnc3VwZXInLCAndGhyb3cnLCAnd2hpbGUnLCAneWllbGQnLFxuICAnZGVsZXRlJywgJ2V4cG9ydCcsICdpbXBvcnQnLCAncHVibGljJywgJ3JldHVybicsICdzdGF0aWMnLCAnc3dpdGNoJyxcbiAgJ3R5cGVvZicsICdkZWZhdWx0JywgJ2V4dGVuZHMnLCAnZmluYWxseScsICdwYWNrYWdlJywgJ3ByaXZhdGUnLCAnY29udGludWUnLFxuICAnZGVidWdnZXInLCAnZnVuY3Rpb24nLCAnYXJndW1lbnRzJywgJ2ludGVyZmFjZScsICdwcm90ZWN0ZWQnLCAnaW1wbGVtZW50cycsXG4gICdpbnN0YW5jZW9mJ107XG5cbi8vIEFzc3VtZXMgdGhlIGJhc2Ugb2YgcGF0aCBpcyBhbHJlYWR5IGVzY2FwZWQgcHJvcGVybHlcbi8vIHJldHVybnMga2V5ICsgYmFzZVxuY29uc3QgX3ByZXBlbmRQYXRoID0gKGtleSwgYmFzZSkgPT4ge1xuICBpZiAoKHR5cGVvZiBrZXkpID09PSAnbnVtYmVyJyB8fCBrZXkubWF0Y2goL15bMC05XSskLykpIHtcbiAgICBrZXkgPSBgWyR7a2V5fV1gO1xuICB9IGVsc2UgaWYgKCFrZXkubWF0Y2goL15bYS16XyRdWzAtOWEtel8kLltcXF1dKiQvaSkgfHxcbiAgICAgICAgICAgICBfanNLZXl3b3Jkcy5pbmRleE9mKGtleSkgPj0gMCkge1xuICAgIGtleSA9IEpTT04uc3RyaW5naWZ5KFtrZXldKTtcbiAgfVxuXG4gIGlmIChiYXNlICYmIGJhc2VbMF0gIT09ICdbJykge1xuICAgIHJldHVybiBgJHtrZXl9LiR7YmFzZX1gO1xuICB9XG5cbiAgcmV0dXJuIGtleSArIGJhc2U7XG59XG5cbmNvbnN0IGlzT2JqZWN0ID0gdmFsdWUgPT4gdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbDtcblxuY29uc3QgYmFzZUlzQXJndW1lbnRzID0gaXRlbSA9PlxuICBpc09iamVjdChpdGVtKSAmJlxuICBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaXRlbSkgPT09ICdbb2JqZWN0IEFyZ3VtZW50c10nO1xuXG5jb25zdCBpc0FyZ3VtZW50cyA9IGJhc2VJc0FyZ3VtZW50cyhmdW5jdGlvbigpIHsgcmV0dXJuIGFyZ3VtZW50czsgfSgpKSA/XG4gIGJhc2VJc0FyZ3VtZW50cyA6XG4gIHZhbHVlID0+IGlzT2JqZWN0KHZhbHVlKSAmJiB0eXBlb2YgdmFsdWUuY2FsbGVlID09PSAnZnVuY3Rpb24nO1xuIiwiLy8gQ29weSBvZiBqUXVlcnkuaXNQbGFpbk9iamVjdCBmb3IgdGhlIHNlcnZlciBzaWRlIGZyb20galF1ZXJ5IHYzLjEuMS5cblxuY29uc3QgY2xhc3MydHlwZSA9IHt9O1xuXG5jb25zdCB0b1N0cmluZyA9IGNsYXNzMnR5cGUudG9TdHJpbmc7XG5cbmNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbmNvbnN0IGZuVG9TdHJpbmcgPSBoYXNPd24udG9TdHJpbmc7XG5cbmNvbnN0IE9iamVjdEZ1bmN0aW9uU3RyaW5nID0gZm5Ub1N0cmluZy5jYWxsKE9iamVjdCk7XG5cbmNvbnN0IGdldFByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mO1xuXG5leHBvcnQgY29uc3QgaXNQbGFpbk9iamVjdCA9IG9iaiA9PiB7XG4gIGxldCBwcm90bztcbiAgbGV0IEN0b3I7XG5cbiAgLy8gRGV0ZWN0IG9idmlvdXMgbmVnYXRpdmVzXG4gIC8vIFVzZSB0b1N0cmluZyBpbnN0ZWFkIG9mIGpRdWVyeS50eXBlIHRvIGNhdGNoIGhvc3Qgb2JqZWN0c1xuICBpZiAoIW9iaiB8fCB0b1N0cmluZy5jYWxsKG9iaikgIT09ICdbb2JqZWN0IE9iamVjdF0nKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJvdG8gPSBnZXRQcm90byhvYmopO1xuXG4gIC8vIE9iamVjdHMgd2l0aCBubyBwcm90b3R5cGUgKGUuZy4sIGBPYmplY3QuY3JlYXRlKCBudWxsIClgKSBhcmUgcGxhaW5cbiAgaWYgKCFwcm90bykge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gT2JqZWN0cyB3aXRoIHByb3RvdHlwZSBhcmUgcGxhaW4gaWZmIHRoZXkgd2VyZSBjb25zdHJ1Y3RlZCBieSBhIGdsb2JhbCBPYmplY3QgZnVuY3Rpb25cbiAgQ3RvciA9IGhhc093bi5jYWxsKHByb3RvLCAnY29uc3RydWN0b3InKSAmJiBwcm90by5jb25zdHJ1Y3RvcjtcbiAgcmV0dXJuIHR5cGVvZiBDdG9yID09PSAnZnVuY3Rpb24nICYmIFxuICAgIGZuVG9TdHJpbmcuY2FsbChDdG9yKSA9PT0gT2JqZWN0RnVuY3Rpb25TdHJpbmc7XG59O1xuIl19
