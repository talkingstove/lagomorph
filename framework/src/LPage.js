/*
*/
define(["Handlebars", "LModule", "viewUtils", "componentInstanceLibrary", "ajaxRequester", "connectorLibrary", "connectorUtils", "objectUtils", "templateUtils", "scanner"], function(Handlebars, LModule, viewUtils, componentInstanceLibrary, ajaxRequester, connectorLibrary, connectorUtils, objectUtils, templateUtils, scanner) {

  return LModule.extend(function(base) {
      
    return {

      init: function(params) {    
        base.init(params);
        this.id = 'page_' + params.id;
        this.useCachedData = params.useCachedData || false;
      
      },

      renderPage: function(pageWrapperSelector) {
        //TODO: optional data caching
        var $pageWrapperSelector = $(pageWrapperSelector);
        this.$parentSelector = $pageWrapperSelector; //??/

        this.loadComponent($pageWrapperSelector);
        scanner.scan($pageWrapperSelector);
      }

      // "pages": {
      //   "/home": {
      //     "template": "<div>homepage<button data-navlink={'route': '/testpage'}>Navigate</button></div>",
      //     "useCachedData": false
      //   }
      // }

     
    }

  });
});






