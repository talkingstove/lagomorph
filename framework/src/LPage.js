/*
*/
define(["LModule", "scanner", "DOMModel"], function(LModule, scanner, DOMModel) {

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
        var self = this;
        //TODO: optional data caching
        var $pageWrapperSelector = $(pageWrapperSelector);
        this.$parentSelector = $pageWrapperSelector; //??/

        this.loadComponent($pageWrapperSelector);
        var $selector = $pageWrapperSelector; 
       
       // setTimeout(function() { //wait for phantom dom TODO: nad
       //  scanner.scan($selector, self.useCachedData);
       // }, 2);
       
   
        
      },

      getDOMElement: function() {
        return this.$parentSelector;
      }

    }

  });
});






