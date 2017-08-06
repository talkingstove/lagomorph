define(["Handlebars", "LBase", "viewUtils"], function(Handlebars, LBase, viewUtils) {

	return LBase.extend(function(base) {
			
			var module = {

				self: this,
		  	Handlebars: Handlebars,
		  	dataSourceInstructions: [], //specifies data source(s) and specific ways they should be loaded into this module

		    // The `init` method serves as the constructor.
		    init: function(params) {
		        
		        base.init(params);
		        this.dataSourceInstructions = params.dataSourceInstructions || [];
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
		// 			"dataSources": {
		// 	"listItems": { //name that the compoent knows about as a "hole" to put things in
		// 		"dataSource": "list_1_Items",
		// 		"lazyLoad": true
		// 	}
		// }

					if (this.dataSourceInstructions.length) {
						//promise to load all data sources and render view only when finished
						for (var i=0; i<this.dataSourceInstructions.length; i++) {
							this.loadDataSource( this.dataSourceInstructions[i] )
						}

					}
					else {
						this.renderView(targetSelector);
					}
				},

				loadDataSource: function(instructions) {

				},

				/*
				*
				*/
				renderView: function(targetSelector) {
					var html = this.compiledTemplate(this.viewData);

					viewUtils.renderDomElement(targetSelector, html);
		    }		    
		}

		return module;
	});
});






