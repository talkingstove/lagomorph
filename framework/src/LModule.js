define(["Handlebars", "LBase", "viewUtils", "componentInstanceLibrary", "ajaxRequester", "connectorLibrary"], function(Handlebars, LBase, viewUtils, componentInstanceLibrary, ajaxRequester, connectorLibrary) {

	return LBase.extend(function(base) {
			
			var module = {

				self: this,
		  	Handlebars: Handlebars,
		  	dataConnectors: [], //specifies remote data source(s) and specific ways they should be loaded into this module 
		  	//maps a componentDataInputDefinition obj that is a prop of this class to a dataSource definition from the library --- creates a "connector" containing data map and instructions to render in the view



		  	//**** TODO: proper model with getters and setters
		  	//**** TODO: each one should be associated with passable render method
		  	processedData: { //after connector does its work, data is deposited here with predictible names for every instance of N component 

		  	},

		    // The `init` method serves as the constructor.
		    init: function(params) {
		        
		        base.init(params);
		        var compViewData = params.viewParams;
          	var compDataContracts = params.dataContracts || null;

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


		        // this.dataConnectors = params.dataConnectors || [];
		        this.compiledTemplate = this.Handlebars.compile(this.template); //TODO: cache standard templates in a libary
		    },

		    

		    //Handlebars template
		    //overridable via the JSON config of any given instance of the component
		    template: `
					  <div>
					    <span>Some HTML here</span>
					  </div>
					`,

				compiledTemplate: null,

				/*
				* entry point from scanner.js (or called directly)
				* get any necessary data and do anything else needed before rendering the view to the DOM
				*/
				loadComponent: function(targetSelector) {
					var self = this;
		

					/*
					* Component instantiator gave us one or more data contracts
					* We must fulfill them before we can render the view
					* at the end, data will be added to this.processedData
					* for view data, name will map to 1-N data-data_source_name's in html template
					*/
				
					var allPromises = []; //if no promises it resolves immediately

					for (var i=0; i<this.dataContracts.length; i++) {
						var thisContract = this.dataContracts[i];
						var promise =  ajaxRequester.createAjaxCallPromise( thisContract.dataSource );
						allPromises.push(promise);
						
					}
					//use dataSourceInstructions.dataSourceName to get the info on the ajax call

					$.when.all(allPromises).then(function(schemas) {
					     console.log("DONE", this, schemas); // 'schemas' is now an array

					     //untested assumption: when.all returns schemas in matching order
					     for (var j=0; j<schemas.length; j++) {
					     		var thisDataContract = self.dataContracts[j];
					     		var connector = connectorLibrary.getConnectorByName( thisDataContract.connector ); //json


					     		//... look up connector from library, make transformation
					     		//... connector obj tells us where it goes, what to do
					     		// connector has a processedData name, it puts it there and then renderView takes over

	// 				     		connectors: {
	// 	"list1PhotoListConnector": {
	// 		"objectMap": {
	// 			"srcPath": "data.photos",
	// 			"destinationPath": "listItems", //goes to processedData with this name, then module renders it
	// 			"objectParams": {
	// 				"dataType": "array",
	// 				"eachChildDefinition": { //child of an array, defined relative to the object root
	// 					"dataType": "object",
	// 					"srcPath": null, //=root
	// 					"destinationPath": null
	// 				}
	// 			}
	// 		}
	// 	}
	// }


					     }


					     //when we have the data from the server and its valid, run it thro the connector and into the view

					     //make data from ajax calls ready to be included in the view, then render it
					     self.renderView(targetSelector);
					}, function(e) {
					     console.log("My ajax failed");
					});

					
				},

		// dataContracts": [
		// 	{	
		// 		
		// 		"dataSource": "samplePhotoListInfo", //resuable, looks up from library, maybe used mutiple times
		// 		"connector": "list1PhotoListConnector" //resuable, looks up from library, maybe used mutiple times, but same dataSource could be connected to different 
		// 	}		
		// ]

				/*
				*
				*/
				renderView: function(targetSelector) {



					var html = this.compiledTemplate(this.viewData);

					viewUtils.renderDomElement(targetSelector, html);
		    },

		    destroy: function() {
		    	if (this.$parentSelector) {
			    	this.$parentSelector.html('');
			    	this.$parentSelector = null; //remove coupling to DOM
			    }
		    }		    
		}

		return module;
	});
});






