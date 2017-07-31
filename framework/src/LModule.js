define(["Handlebars", "LBase", "viewUtils"], function(Handlebars, LBase, viewUtils) {

	return LBase.extend(function(base) {
			
			var module = {

				self: this,
		  	Handlebars: Handlebars,
		    // The `init` method serves as the constructor.
		    init: function(params) {
		        // Insert private functions here
		        base.init(params);
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
				* get any necessary data and do anything else needed before rendering the view
				*/
				loadComponent: function(targetSelector) {
		// 			"dataSources": {
		// 	"listItems": {
		// 		"dataSource": "list_1_Items",
		// 		"lazyLoad": true
		// 	}
		// }



					this.renderView(targetSelector);
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






