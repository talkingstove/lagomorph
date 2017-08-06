define(["Handlebars", "LBase", "viewUtils", "componentInstanceLibrary"], function(Handlebars, LBase, viewUtils, componentInstanceLibrary) {

	return LBase.extend(function(base) {
			
			var module = {

				self: this,
		  	Handlebars: Handlebars,
		  	dataConnectors: [], //specifies remote data source(s) and specific ways they should be loaded into this module 
		  	//maps a componentDataInputDefinition obj that is a prop of this class to a dataSource definition from the library --- creates a "connector" containing data map and instructions to render in the view

		    // The `init` method serves as the constructor.
		    init: function(params) {
		        
		        base.init(params);
		        var compViewData = params.viewParams;
          	var compDataSources = params.dataSources || null;

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
		        this.dataSources = compDataSources;
		        this.viewData = compViewData;

		        componentInstanceLibrary.registerComponent(this);


		        this.dataConnectors = params.dataConnectors || [];
		        this.compiledTemplate = this.Handlebars.compile(this.template); //TODO: cache standard templates in a libary
		    },

		    //always the same for every instance
		    componentDataInputDefinitions: {
		    	// 'photosList': {
		    	// 	//map of data structure this component needs to print eg a photolist
		    	// }
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
		// 			"dataSources": {
		// 	"listItems": { //name that the compoent knows about as a "hole" to put things in
		// 		"dataSource": "list_1_Items",
		// 		"lazyLoad": true
		// 	}
		// }

					if (this.dataConnectors.length) {
						var allPromises = [];

						//use dataSourceInstructions.dataSourceName to get the info on the ajax call

						$.when.all(allPromises).then(function(schemas) {
						     console.log("DONE", this, schemas); // 'schemas' is now an array


						     debugger;

						     //when we have the data from the server and its valid, run it thro the connector and into the view

						     //make data from ajax calls ready to be included in the view, then render it
						     this.renderView(targetSelector); //self???
						}, function(e) {
						     console.log("My ajax failed");
						});

					}
					else {
						this.renderView(targetSelector);
					}
				},

				// loadDataSource: function(instructions) {

				// },

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






