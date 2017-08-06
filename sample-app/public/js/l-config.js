lParams = {
	// componentConfigLocation: {
	// 	"url": '/ajax/component-config.json'
	// },
	dataSources: { //a source of data from an endpoint and a contract of expectations, but not bound to any module
		//these pass into L's data source library so the framework can look them up by name on  a component config
		"samplePhotoListInfo": {
			"url": '/ajax/test-photo-info.json',
			"method": "GET",
			"dataStructure": {} //todo
		}
	},
	connectors: {
		"list1PhotoListConnector": {
			"objectMap": {
				"srcPath": "data.photos",
				"destinationPath": "listItems", //goes to processedData with this name, then module renders it
				"objectParams": {
					"dataType": "array",
					"eachChildDefinition": { //child of an array, defined relative to the object root
						"dataType": "object",
						"srcPath": null, //=root
						"destinationPath": null
					}
				}
			}
		}
	}

}