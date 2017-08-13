define(["pageClassLibrary", "LPage"], function(pageClassLibrary, LPage) {

  return {

    pageDefinitions: null, //json

    startRouter: function(pages, homepageName, pageWrapperSelector) {
      this.pageDefinitions = pages;
      this.pageWrapperSelector = pageWrapperSelector;
      this.pageClassLibrary = pageClassLibrary; //needed when this is passed via apply
      this.LPage = LPage;

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
      this.navigateToPage(homepageName);
    },

    navigateToPage: function(pageName) {
      var uri = window.location.href.split("#")[0];
      window.location.href = uri + '#' + pageName;
    },

    renderPage: function() {
      //TODO: if page not found, go back to last one in the history! ??????

      var pageKey = window.location.hash.slice(1);
      var pageClass = this.pageClassLibrary.getPageByRoute(pageKey);

      if (!pageClass) {
        pageClass = new LPage( this.pageDefinitions[pageKey] );
      }

      pageClass.renderPage( this.pageWrapperSelector );
    }


  }
});


// var routes = {
//         '/author': showAuthorInfo,
//         '/books': listBooks
//       };
