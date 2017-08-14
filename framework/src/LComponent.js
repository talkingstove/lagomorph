/*
*/
define(["Handlebars", "LModule", "viewUtils", "componentInstanceLibrary", "ajaxRequester", "connectorLibrary", "connectorUtils", "objectUtils", "templateUtils"], function(Handlebars, LModule, viewUtils, componentInstanceLibrary, ajaxRequester, connectorLibrary, connectorUtils, objectUtils, templateUtils) {

  return LModule.extend(function(base) {
      
    return {

      init: function(params) {
        params = params || {};
        // if (params.template) { //override template per instance when desired!
        //   this.template = params.template;
        // }
        
        base.init(params);

        // this.viewData = params.viewData || {};//why???
        // var compViewData = this.viewData || {};
        var compDataContracts = params.dataContracts || [];

        //TODO: add default attrs like unique id, class name etc
        var id = this.viewParams.id;
        var type = this.viewParams.type;
        var $parentSelector = this.viewParams.$parentSelector;

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
        // this.viewData = compViewData;

        componentInstanceLibrary.registerComponent(this);
      
      }

      

     
    }

  });
});






