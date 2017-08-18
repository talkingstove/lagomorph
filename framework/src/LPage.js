/*
*/
define(["scanner", "DOMModel"], function(scanner, DOMModel) {

  return LModule.extend(function(base) {
      
    return {

      init: function(params) {    
        params = params || {};
        base.init(params);
       
        this.data = params.data || {};

        this.id = 'page_' + params.id;
        this.useCachedData = params.useCachedData || false;
      
      },

      renderPage: function(pageWrapperSelector) {
        //TODO: optional data caching
        var $pageWrapperSelector = $(pageWrapperSelector);
        this.$parentSelector = $pageWrapperSelector; //??/

        this.loadComponent($pageWrapperSelector);
        scanner.scan($pageWrapperSelector, this.useCachedData);
      }

    }

  });
});






