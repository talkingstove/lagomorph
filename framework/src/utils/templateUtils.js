define(["Handlebars", "uiStringsLibrary"], function(Handlebars, uiStringsLibrary) {

	return {


    /*
    * in json object, replace "[[[my.kyename]]]" with the key
    */
		replaceUIStringKeys: function(data) {
      
    },

    compileTemplate: function(templateSource) {
      // var $templateSource = $(templateSource);
      // var $stringContainers = $templateSource.find('[data-ui_string]');

      // _.each($stringContainers, function(stringContainer) {
      //   var subValue = uiStringsLibrary.getUIStringByKey( $(stringContainer).data('ui_string') );
      //   if (subValue) {
      //     $(stringContainer).text(subValue);
      //   }
      // });

      // var parsedTemplateSource = null;
      // debugger;

      return Handlebars.compile(templateSource);
    },

    lookUpStringKey: function(key) {
      return uiStringsLibrary.getUIStringByKey(key);
    }


	}


});