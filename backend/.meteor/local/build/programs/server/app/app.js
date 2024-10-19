Package["core-runtime"].queue("null",function () {/* Imports for global scope */

MongoInternals = Package.mongo.MongoInternals;
Mongo = Package.mongo.Mongo;
ReactiveVar = Package['reactive-var'].ReactiveVar;
ECMAScript = Package.ecmascript.ECMAScript;
Meteor = Package.meteor.Meteor;
global = Package.meteor.global;
meteorEnv = Package.meteor.meteorEnv;
EmitterPromise = Package.meteor.EmitterPromise;
WebApp = Package.webapp.WebApp;
WebAppInternals = Package.webapp.WebAppInternals;
main = Package.webapp.main;
DDP = Package['ddp-client'].DDP;
DDPServer = Package['ddp-server'].DDPServer;
LaunchScreen = Package['launch-screen'].LaunchScreen;
meteorInstall = Package.modules.meteorInstall;
Promise = Package.promise.Promise;
Autoupdate = Package.autoupdate.Autoupdate;

var require = meteorInstall({"imports":{"api":{"links.ts":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                        //
// imports/api/links.ts                                                                   //
//                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////
                                                                                          //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      LinksCollection: () => LinksCollection
    });
    let Mongo;
    module.link("meteor/mongo", {
      Mongo(v) {
        Mongo = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const LinksCollection = new Mongo.Collection('links');
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////

}}},"server":{"main.ts":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                        //
// server/main.ts                                                                         //
//                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////
                                                                                          //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    let LinksCollection;
    module.link("/imports/api/links", {
      LinksCollection(v) {
        LinksCollection = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    async function insertLink(_ref) {
      let {
        title,
        url
      } = _ref;
      await LinksCollection.insertAsync({
        title,
        url,
        createdAt: new Date()
      });
    }
    Meteor.startup(async () => {
      // If the Links collection is empty, add some data.
      if ((await LinksCollection.find().countAsync()) === 0) {
        await insertLink({
          title: 'Do the Tutorial',
          url: 'https://www.meteor.com/tutorials/react/creating-an-app'
        });
        await insertLink({
          title: 'Follow the Guide',
          url: 'https://guide.meteor.com'
        });
        await insertLink({
          title: 'Read the Docs',
          url: 'https://docs.meteor.com'
        });
        await insertLink({
          title: 'Discussions',
          url: 'https://forums.meteor.com'
        });
      }
      // We publish the entire Links collection to all clients.
      // In order to be fetched in real-time to the clients
      Meteor.publish("links", function () {
        return LinksCollection.find();
      });
    });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////

}}},{
  "extensions": [
    ".js",
    ".json",
    ".d.ts",
    ".ts",
    ".tsx"
  ]
});


/* Exports */
return {
  require: require,
  eagerModulePaths: [
    "/server/main.ts"
  ]
}});

//# sourceURL=meteor://💻app/app/app.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9hcGkvbGlua3MudHMiLCJtZXRlb3I6Ly/wn5K7YXBwL3NlcnZlci9tYWluLnRzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydCIsIkxpbmtzQ29sbGVjdGlvbiIsIk1vbmdvIiwibGluayIsInYiLCJfX3JlaWZ5V2FpdEZvckRlcHNfXyIsIkNvbGxlY3Rpb24iLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJzZWxmIiwiYXN5bmMiLCJNZXRlb3IiLCJpbnNlcnRMaW5rIiwiX3JlZiIsInRpdGxlIiwidXJsIiwiaW5zZXJ0QXN5bmMiLCJjcmVhdGVkQXQiLCJEYXRlIiwic3RhcnR1cCIsImZpbmQiLCJjb3VudEFzeW5jIiwicHVibGlzaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBQSxNQUFBLENBQU9DLE1BQUUsQ0FBSztNQUFBQyxlQUFRLEVBQUFBLENBQUEsS0FBQUE7SUFBZTtJQUFBLElBQUFDLEtBQUE7SUFBQUgsTUFBQSxDQUFBSSxJQUFBO01BQUFELE1BQUFFLENBQUE7UUFBQUYsS0FBQSxHQUFBRSxDQUFBO01BQUE7SUFBQTtJQUFBLElBQUFDLG9CQUFBLFdBQUFBLG9CQUFBO0lBUzlCLE1BQU1KLGVBQWUsR0FBRyxJQUFJQyxLQUFLLENBQUNJLFVBQVUsQ0FBTyxPQUFPLENBQUM7SUFBQ0Msc0JBQUE7RUFBQSxTQUFBQyxXQUFBO0lBQUEsT0FBQUQsc0JBQUEsQ0FBQUMsV0FBQTtFQUFBO0VBQUFELHNCQUFBO0FBQUE7RUFBQUUsSUFBQTtFQUFBQyxLQUFBO0FBQUEsRzs7Ozs7Ozs7Ozs7Ozs7SUNUbkUsSUFBQUMsTUFBUztJQUFBWixNQUFRLENBQUFJLElBQUEsQ0FBTSxlQUFlLEVBQUM7TUFBQVEsT0FBQVAsQ0FBQTtRQUFBTyxNQUFBLEdBQUFQLENBQUE7TUFBQTtJQUFBO0lBQUEsSUFBQUgsZUFBQTtJQUFBRixNQUFBLENBQUFJLElBQUE7TUFBQUYsZ0JBQUFHLENBQUE7UUFBQUgsZUFBQSxHQUFBRyxDQUFBO01BQUE7SUFBQTtJQUFBLElBQUFDLG9CQUFBLFdBQUFBLG9CQUFBO0lBR3ZDLGVBQWVPLFVBQVVBLENBQUFDLElBQUEsRUFBNEM7TUFBQSxJQUEzQztRQUFFQyxLQUFLO1FBQUVDO01BQUcsQ0FBK0IsR0FBQUYsSUFBQTtNQUNuRSxNQUFNWixlQUFlLENBQUNlLFdBQVcsQ0FBQztRQUFFRixLQUFLO1FBQUVDLEdBQUc7UUFBRUUsU0FBUyxFQUFFLElBQUlDLElBQUk7TUFBRSxDQUFFLENBQUM7SUFDMUU7SUFFQVAsTUFBTSxDQUFDUSxPQUFPLENBQUMsWUFBVztNQUN4QjtNQUNBLElBQUksT0FBTWxCLGVBQWUsQ0FBQ21CLElBQUksRUFBRSxDQUFDQyxVQUFVLEVBQUUsTUFBSyxDQUFDLEVBQUU7UUFDbkQsTUFBTVQsVUFBVSxDQUFDO1VBQ2ZFLEtBQUssRUFBRSxpQkFBaUI7VUFDeEJDLEdBQUcsRUFBRTtTQUNOLENBQUM7UUFFRixNQUFNSCxVQUFVLENBQUM7VUFDZkUsS0FBSyxFQUFFLGtCQUFrQjtVQUN6QkMsR0FBRyxFQUFFO1NBQ04sQ0FBQztRQUVGLE1BQU1ILFVBQVUsQ0FBQztVQUNmRSxLQUFLLEVBQUUsZUFBZTtVQUN0QkMsR0FBRyxFQUFFO1NBQ04sQ0FBQztRQUVGLE1BQU1ILFVBQVUsQ0FBQztVQUNmRSxLQUFLLEVBQUUsYUFBYTtVQUNwQkMsR0FBRyxFQUFFO1NBQ04sQ0FBQztNQUNKO01BRUE7TUFDQTtNQUNBSixNQUFNLENBQUNXLE9BQU8sQ0FBQyxPQUFPLEVBQUU7UUFDdEIsT0FBT3JCLGVBQWUsQ0FBQ21CLElBQUksRUFBRTtNQUMvQixDQUFDLENBQUM7SUFDSixDQUFDLENBQUM7SUFBQ2Isc0JBQUE7RUFBQSxTQUFBQyxXQUFBO0lBQUEsT0FBQUQsc0JBQUEsQ0FBQUMsV0FBQTtFQUFBO0VBQUFELHNCQUFBO0FBQUE7RUFBQUUsSUFBQTtFQUFBQyxLQUFBO0FBQUEsRyIsImZpbGUiOiIvYXBwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTW9uZ28gfSBmcm9tICdtZXRlb3IvbW9uZ28nO1xuXG5leHBvcnQgaW50ZXJmYWNlIExpbmsge1xuICBfaWQ/OiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIHVybDogc3RyaW5nO1xuICBjcmVhdGVkQXQ6IERhdGU7XG59XG5cbmV4cG9ydCBjb25zdCBMaW5rc0NvbGxlY3Rpb24gPSBuZXcgTW9uZ28uQ29sbGVjdGlvbjxMaW5rPignbGlua3MnKTtcbiIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgTGluaywgTGlua3NDb2xsZWN0aW9uIH0gZnJvbSAnL2ltcG9ydHMvYXBpL2xpbmtzJztcblxuYXN5bmMgZnVuY3Rpb24gaW5zZXJ0TGluayh7IHRpdGxlLCB1cmwgfTogUGljazxMaW5rLCAndGl0bGUnIHwgJ3VybCc+KSB7XG4gIGF3YWl0IExpbmtzQ29sbGVjdGlvbi5pbnNlcnRBc3luYyh7IHRpdGxlLCB1cmwsIGNyZWF0ZWRBdDogbmV3IERhdGUoKSB9KTtcbn1cblxuTWV0ZW9yLnN0YXJ0dXAoYXN5bmMgKCkgPT4ge1xuICAvLyBJZiB0aGUgTGlua3MgY29sbGVjdGlvbiBpcyBlbXB0eSwgYWRkIHNvbWUgZGF0YS5cbiAgaWYgKGF3YWl0IExpbmtzQ29sbGVjdGlvbi5maW5kKCkuY291bnRBc3luYygpID09PSAwKSB7XG4gICAgYXdhaXQgaW5zZXJ0TGluayh7XG4gICAgICB0aXRsZTogJ0RvIHRoZSBUdXRvcmlhbCcsXG4gICAgICB1cmw6ICdodHRwczovL3d3dy5tZXRlb3IuY29tL3R1dG9yaWFscy9yZWFjdC9jcmVhdGluZy1hbi1hcHAnLFxuICAgIH0pO1xuXG4gICAgYXdhaXQgaW5zZXJ0TGluayh7XG4gICAgICB0aXRsZTogJ0ZvbGxvdyB0aGUgR3VpZGUnLFxuICAgICAgdXJsOiAnaHR0cHM6Ly9ndWlkZS5tZXRlb3IuY29tJyxcbiAgICB9KTtcblxuICAgIGF3YWl0IGluc2VydExpbmsoe1xuICAgICAgdGl0bGU6ICdSZWFkIHRoZSBEb2NzJyxcbiAgICAgIHVybDogJ2h0dHBzOi8vZG9jcy5tZXRlb3IuY29tJyxcbiAgICB9KTtcblxuICAgIGF3YWl0IGluc2VydExpbmsoe1xuICAgICAgdGl0bGU6ICdEaXNjdXNzaW9ucycsXG4gICAgICB1cmw6ICdodHRwczovL2ZvcnVtcy5tZXRlb3IuY29tJyxcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFdlIHB1Ymxpc2ggdGhlIGVudGlyZSBMaW5rcyBjb2xsZWN0aW9uIHRvIGFsbCBjbGllbnRzLlxuICAvLyBJbiBvcmRlciB0byBiZSBmZXRjaGVkIGluIHJlYWwtdGltZSB0byB0aGUgY2xpZW50c1xuICBNZXRlb3IucHVibGlzaChcImxpbmtzXCIsIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gTGlua3NDb2xsZWN0aW9uLmZpbmQoKTtcbiAgfSk7XG59KTtcbiJdfQ==
