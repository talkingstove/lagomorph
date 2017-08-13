define(["pageLibrary"], function(pageLibrary) {

  return {

    pageDefinitions: null,

    startRouter: function(pages, homepageName) {
      this.pageDefinitions = pages;
      var routes = {};

        _.each(pages, function(pageDef, key) {
          var routeName = key;
          routes[routeName] = $.noop;
        });

        var router = Router(routes);

        router.configure({
          on: this.renderPage.apply(this)
        });

        router.init();
        this.goToPage(homepageName);
    },

    goToPage: function(pageName) {
      var uri = window.location.href.split("#")[0];
      window.location.href = uri + '#' + pageName;
    },

    renderPage: function() {
      var pageKey = window.location.hash.slice(1);
      var template = this.pageDefinitions[pageKey].template;

      //put a LPage in the page linrary if not in there
      //if it is, call render(refresh server calls || use cache)
    }


  }
});


// var routes = {
//         '/author': showAuthorInfo,
//         '/books': listBooks
//       };

//       //
//       // instantiate the router.
//       //
//       var router = Router(routes);

//       //
//       // a global configuration setting.
//       //
//       router.configure({
//         on: allroutes
//       });
//       router.init();