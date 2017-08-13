/*
*/
define(["Handlebars", "LModule", "viewUtils", "componentInstanceLibrary", "ajaxRequester", "connectorLibrary", "connectorUtils", "objectUtils", "templateUtils"], function(Handlebars, LModule, viewUtils, componentInstanceLibrary, ajaxRequester, connectorLibrary, connectorUtils, objectUtils, templateUtils) {

  return LModule.extend(function(base) {
      
    return {

      init: function(params) {
          
        base.init(params);

        var compViewData = params.viewParams || {};
        var compDataContracts = params.dataContracts || [];

        //TODO: add default attrs like unique id, class name etc
        var id = compViewData.id;
        var type = compViewData.type;
        var $parentSelector = compViewData.$parentSelector;

        if (!id) {
          console.error('attempted to created component without id!');
          return;
        }
        if (!type) {
          console.error('attempted to created component without type!');
          return;
        }

        this.id = id;
        this.type = type;
        this.$parentSelector = $parentSelector;
        this.dataContracts = compDataContracts;
        this.viewData = compViewData;

        componentInstanceLibrary.registerComponent(this);
      
      }

      

     
    }

  });
});






