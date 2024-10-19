var require = meteorInstall({"imports":{"api":{"links.ts":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// imports/api/links.ts                                                                                             //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
!function (module1) {
  module1.export({
    LinksCollection: () => LinksCollection
  });
  let Mongo;
  module1.link("meteor/mongo", {
    Mongo(v) {
      Mongo = v;
    }
  }, 0);
  ___INIT_METEOR_FAST_REFRESH(module);
  const LinksCollection = new Mongo.Collection('links');
}.call(this, module);
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"ui":{"App.tsx":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// imports/ui/App.tsx                                                                                               //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
!function (module1) {
  module1.export({
    App: () => App
  });
  let React;
  module1.link("react", {
    default(v) {
      React = v;
    }
  }, 0);
  let Hello;
  module1.link("./Hello", {
    Hello(v) {
      Hello = v;
    }
  }, 1);
  let Info;
  module1.link("./Info", {
    Info(v) {
      Info = v;
    }
  }, 2);
  ___INIT_METEOR_FAST_REFRESH(module);
  const App = () => /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Welcome to Meteor!"), /*#__PURE__*/React.createElement(Hello, null), /*#__PURE__*/React.createElement(Info, null));
  _c = App;
  var _c;
  $RefreshReg$(_c, "App");
}.call(this, module);
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Hello.tsx":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// imports/ui/Hello.tsx                                                                                             //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
!function (module1) {
  module1.export({
    Hello: () => Hello
  });
  let React, useState;
  module1.link("react", {
    default(v) {
      React = v;
    },
    useState(v) {
      useState = v;
    }
  }, 0);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  const Hello = () => {
    _s();
    const [counter, setCounter] = useState(0);
    const increment = () => {
      setCounter(counter + 1);
    };
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
      onClick: increment
    }, "Click Me"), /*#__PURE__*/React.createElement("p", null, "You've pressed the button ", counter, " times."));
  };
  _s(Hello, "mgO7WMHyhiBnLtH7uw/qAj2Cy9A=");
  _c = Hello;
  var _c;
  $RefreshReg$(_c, "Hello");
}.call(this, module);
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"Info.tsx":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// imports/ui/Info.tsx                                                                                              //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
!function (module1) {
  module1.export({
    Info: () => Info
  });
  let React;
  module1.link("react", {
    default(v) {
      React = v;
    }
  }, 0);
  let useFind, useSubscribe;
  module1.link("meteor/react-meteor-data", {
    useFind(v) {
      useFind = v;
    },
    useSubscribe(v) {
      useSubscribe = v;
    }
  }, 1);
  let LinksCollection;
  module1.link("../api/links", {
    LinksCollection(v) {
      LinksCollection = v;
    }
  }, 2);
  ___INIT_METEOR_FAST_REFRESH(module);
  var _s = $RefreshSig$();
  const Info = () => {
    _s();
    const isLoading = useSubscribe("links");
    const links = useFind(() => LinksCollection.find());
    if (isLoading()) {
      return /*#__PURE__*/React.createElement("div", null, "Loading...");
    }
    const makeLink = link => {
      return /*#__PURE__*/React.createElement("li", {
        key: link._id
      }, /*#__PURE__*/React.createElement("a", {
        href: link.url,
        target: "_blank"
      }, link.title));
    };
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "Learn Meteor!"), /*#__PURE__*/React.createElement("ul", null, links.map(makeLink)));
  };
  _s(Info, "QEkHgo/x/dyE6gVwltHrOUobStg=", false, function () {
    return [useSubscribe, useFind];
  });
  _c = Info;
  var _c;
  $RefreshReg$(_c, "Info");
}.call(this, module);
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"client":{"main.tsx":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// client/main.tsx                                                                                                  //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
!function (module1) {
  let React;
  module1.link("react", {
    default(v) {
      React = v;
    }
  }, 0);
  let createRoot;
  module1.link("react-dom/client", {
    createRoot(v) {
      createRoot = v;
    }
  }, 1);
  let Meteor;
  module1.link("meteor/meteor", {
    Meteor(v) {
      Meteor = v;
    }
  }, 2);
  let App;
  module1.link("/imports/ui/App", {
    App(v) {
      App = v;
    }
  }, 3);
  ___INIT_METEOR_FAST_REFRESH(module);
  Meteor.startup(() => {
    const container = document.getElementById('react-target');
    const root = createRoot(container);
    root.render( /*#__PURE__*/React.createElement(App, null));
  });
}.call(this, module);
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},{
  "extensions": [
    ".js",
    ".json",
    ".html",
    ".d.ts",
    ".ts",
    ".tsx",
    ".css"
  ]
});

require("/client/main.tsx");