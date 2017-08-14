define(["pageClassLibrary", "LPage"], function(pageClassLibrary, LPage) {

  return {

    pageDefinitions: null, //json

    startRouter: function(pages, homepageName, pageWrapperSelector) {
      this.pageDefinitions = pages;
      this.pageWrapperSelector = pageWrapperSelector;
      this.pageClassLibrary = pageClassLibrary; //needed when this is passed via apply
      this.LPage = LPage;

      var routes = {};
      var self = this;


      _.each(pages, function(pageDef, key) {
        routes[key] = function() {self.renderPage(key)};
      }, this);

      var router = Router(routes);

      // router.configure({
      //   on: this.renderPage.apply(this)
      // });

      router.init();

      if (!window.location.hash || window.location.hash.length <= 1) {
        this.navigateToPage(homepageName);
      }
      
    },

    navigateToPage: function(pageName) {
      var uri = window.location.href.split("#")[0];
      window.location.href = uri + '#' + pageName;
    },

    renderPage: function(key) {
      //TODO: if page not found, go back to last one in the history! ??????
      // _.defer(function() { //wait out uri change
      //   debugger;
        var pageKey = key;//window.location.hash.slice(1);
        var pageClass = this.pageClassLibrary.getPageByRoute(pageKey);

        // if (!pageClass) { //TODO: would be nice to re-use classes but won;'t work!!'
          console.log('creating class for page:', pageKey);      
          pageClass = new LPage( this.pageDefinitions[pageKey] );
          this.pageClassLibrary.getLibrary().addItem(pageKey, pageClass, true);
        // }

        pageClass.renderPage( this.pageWrapperSelector );
      // });
      
    }


  }
});


// var routes = {
//         '/author': showAuthorInfo,
//         '/books': listBooks
//       };
