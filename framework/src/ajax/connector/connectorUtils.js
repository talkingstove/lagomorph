define(["objectUtils", "templateUtils"], function(objectUtils, templateUtils) {

	return {

    processData: function(rawDataFromServer, connector) {
      var objectMap = connector.objectMap;
      var dataFromServer = connector.srcPath ? objectUtils.getDataFromObjectByPath( rawDataFromServer, connector.srcPath ) : rawDataFromServer;

      switch(objectMap.dataType) {
        case 'array':
          var finalArray = [];

          for (var i=0; i<dataFromServer.length; i++) {
            finalArray.push( this.processDataItem(dataFromServer[i], objectMap.eachChildDefinition) );
          }

          return finalArray;
        break;
        case 'object': //TODO: untested
          _.each(dataFromServer, function(dataItem) {
            this.processDataItem(dataItem, objectMap.eachChildDefinition); 
          }, this);

          return dataFromServer;
        break;
        default:
          console.error('objectmap must have valid dataType. Got:', objectMap.dataType);
        break;
      } 
    },

    processDataItem: function(dataItem, mapDefinition) {
      //null = direct copy
      var data = (!mapDefinition || mapDefinition.srcPath === null) ? dataItem : objectUtils.getDataFromObjectByPath(dataItem, mapDefinition.srcPath);
      
      //replace i18n string keys in format "[[[i18n.my.key]]]" as needed
      return templateUtils.replaceUIStringKeys(data);
      //TOOD: deep copy
    } 

	}

});