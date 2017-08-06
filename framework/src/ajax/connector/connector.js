define(["Handlebars", "LBase", "viewUtils", "componentInstanceLibrary"], function(Handlebars, LBase, viewUtils, componentInstanceLibrary) {

	return LBase.extend(function(base) {
			
			return {

				serverDataStructure: null, //as json

				componentDataStructure: null, //as json

				targetInView: null, //string

			
		    // The `init` method serves as the constructor.
		    init: function(params) {
	        if (!params.serverDataStructure) {
	        	console.error('Connector requires serverDataStructure');
	        }
	        if (!params.componentDataStructure) {
	        	console.error('Connector requires componentDataStructure');
	        }

	        this.serverDataStructure = params.serverDataStructure;
	        this.componentDataStructure = params.componentDataStructure;
		    },

		    /*
		    * an ajax call, etc has just returned
		    * using the JSON maps that were instantiated when the class was created,
		    * transform the data into the structure needed by the component and return it for UI use
		    */
		    trasformServerDataForComponent: function(serverData) {

		    }
    
		}

	});
});






