define(["objectUtils"], function(objectUtils) {

	return {


    processData: function(dataFromServer, objectMap) {
      switch(objectMap.dataType) {
        case 'array':
          var finalArray = [];

          for (var i=0; i<dataFromServer.length; i++) {
            finalArray.push( this.processDataItem(dataFromServer[i], objectMap.eachChildDefinition) );
          }

          return finalArray;

        break;
        case 'object':
          //TODO
        break;
        default:
          console.error('objectmap must have valid dataType. Got:', objectMap.dataType);
        break;
      } 
    },

    processDataItem: function(dataItem, mapDefinition) {
      return (mapDefinition.srcPath === null) ? dataItem : objectUtils.getDataFromObjectByPath(dataItem, mapDefinition.srcPath);
      //TOOD: deep copy
    } 


	}


});



// "list1PhotoListConnector": {
//      "srcPath": "data.photos",
//      "destinationPath": "listItems", //goes to processedData with this name, then module renders it
//      "objectMap": { //parent object can have children of an array or nested objects
//        "dataType": "array",
//        "eachChildDefinition": { //child of an array, defined relative to the object root
//          "dataType": "object",
//          "srcPath": null, //=root, so just copy the object
//          "destinationPath": null
//        }
//      }
//    }