//////////////////////////////////////////////////////////////////////////
//                                                                      //
// This is a generated file. You can view the original                  //
// source in your browser if your browser supports source maps.         //
// Source maps are supported by all recent versions of Chrome, Safari,  //
// and Firefox, and by Internet Explorer 11.                            //
//                                                                      //
//////////////////////////////////////////////////////////////////////////


Package["core-runtime"].queue("webapp",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var meteorInstall = Package.modules.meteorInstall;
var meteorBabelHelpers = Package.modules.meteorBabelHelpers;
var Promise = Package.promise.Promise;
var Symbol = Package['ecmascript-runtime-client'].Symbol;
var Map = Package['ecmascript-runtime-client'].Map;
var Set = Package['ecmascript-runtime-client'].Set;

/* Package-scope variables */
var WebApp;

var require = meteorInstall({"node_modules":{"meteor":{"webapp":{"webapp_client.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////
//                                                                            //
// packages/webapp/webapp_client.js                                           //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////
                                                                              //
module.export({
  WebApp: function () {
    return WebApp;
  }
});
var WebApp = {
  _isCssLoaded: function () {
    if (document.styleSheets.length === 0) {
      return true;
    }
    return Array.prototype.find.call(document.styleSheets, function (sheet) {
      if (sheet.cssText && !sheet.cssRules) {
        // IE8
        return !sheet.cssText.match(/meteor-css-not-found-error/);
      }
      return !Array.prototype.find.call(sheet.cssRules, function (rule) {
        return rule.selectorText === '.meteor-css-not-found-error';
      });
    });
  }
};
////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      WebApp: WebApp
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/webapp/webapp_client.js"
  ],
  mainModulePath: "/node_modules/meteor/webapp/webapp_client.js"
}});
