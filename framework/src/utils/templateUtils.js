define(["Handlebars", "uiStringsLibrary", "himalaya"], function(Handlebars, uiStringsLibrary, himalaya) {

	return {


    /*
    * in json object, replace "[[[my.kyename]]]" with the key
    */
		replaceUIStringKeys: function(data) {
      
    },

    compileTemplate: function(templateSource) {
      //clean up "bad" characters from template literals
      templateSource = templateSource.replace(/\t/g, '');
      templateSource = templateSource.replace(/\n/g, '');
      templateSource = templateSource.trim();

      var $templateSource = $(templateSource);

      //TODO: nested wont work???
      _.each($templateSource, function(node) {
        var $node = $(node);
        if ($node.data('ui_string')) {
          var subValue = uiStringsLibrary.getUIStringByKey( $node.data('ui_string') );
          if (subValue) {
            $node.text(subValue);
          }
        }      
      });

      
      var parsedTemplateSource = $templateSource.wrap('<div></div>').html();

      return Handlebars.compile(parsedTemplateSource);
    },

    lookUpStringKey: function(key) {
      return uiStringsLibrary.getUIStringByKey(key);
    }


	}


});