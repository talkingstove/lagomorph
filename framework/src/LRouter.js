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
      }, this);

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
      var self = this;
      //TODO: if page not found, go back to last one in the history! ??????
      _.defer(function() { //wait out uri change
        var pageKey = window.location.hash.slice(1);
        var pageClass = self.pageClassLibrary.getPageByRoute(pageKey);

        if (!pageClass) {
          console.log('creating class for page:', pageKey);      
          pageClass = new LPage( self.pageDefinitions[pageKey] );
          self.pageClassLibrary.getLibrary().addItem(pageKey, pageClass);
        }

        pageClass.renderPage( self.pageWrapperSelector );
      });
      
    }


  }
});


// var routes = {
//         '/author': showAuthorInfo,
//         '/books': listBooks
//       };
