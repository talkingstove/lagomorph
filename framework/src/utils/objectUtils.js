define([], function() {

	return {


    getDataFromObjectByPath: function(object, path) {
      var nameArray = path.split('.');
      var currentObject = object;

      for (var i=0; i<nameArray.length; i++) {  
        if ( _.isUndefined(currentObject[nameArray[i]]) ) {
          currentObject = null;
          break;
        }
        else {
          currentObject = currentObject[nameArray[i]];
        }
      }

      return currentObject;
    }


	}


});