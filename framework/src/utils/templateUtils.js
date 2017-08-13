define(["Handlebars", "uiStringsLibrary", "himalaya"], function(Handlebars, uiStringsLibrary, himalaya) {

  return {

    /*
    * in json object, replace "[[[my.keyname]]]" with the key
    */
    replaceUIStringKeys: function(data) {
      parseIfNeeded(data);
      return data;

      function parseIfNeeded(item, key, curDataObj) {
        if ( _.isString(item) ) {
          if (item.indexOf('[[[') === 0) { //TOOD: make [[[ ]]] a changable constant
            var parsedVal = parseStringKey(item);

            if (curDataObj) {
              curDataObj[key] = parsedVal;
            }
            else { //simple string case
              item = parsedVal;
            }           
          }
        }
        else if (_.isArray(data) || _.isObject(data)) {
          _.each(data, function(dataItem, key) {
            parseIfNeeded(dataItem, key, data);
          });
        }
      }

      function parseStringKey(str) {
        return uiStringsLibrary.getUIStringByKey( str.substr(3, str.length-6) );
      }
    },

    compileTemplate: function(templateSource) {
      //clean up "bad" characters from template literals
      templateSource = templateSource.replace(/\t/g, '');
      templateSource = templateSource.replace(/\n/g, '');
      templateSource = templateSource.trim();

      var $templateSource = $('<div>' + templateSource + '</div>');

      _.each($templateSource.find('[data-ui_string]'), function(node) {
        var $node = $(node);
        var subValue = uiStringsLibrary.getUIStringByKey( $node.data('ui_string') );
        if (subValue) {
          $node.text(subValue);
        }
              
      });

      
      var parsedTemplateSource = $templateSource.html();
     
      return Handlebars.compile(parsedTemplateSource);
    },

    lookUpStringKey: function(key) {
      return uiStringsLibrary.getUIStringByKey(key);
    }


  }


});