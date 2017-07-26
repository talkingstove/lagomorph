define(["Handlebars", "LBase", "viewUtils"], function(Handlebars, LBase, viewUtils) {

	return LBase.extend(function(base) {
			
			var module = {

				self: this,
		  	Handlebars: Handlebars,
		    // The `init` method serves as the constructor.
		    init: function(params) {
		        // Insert private functions here
		        console.log('L Module with params:', params);
		        this.compiledTemplate = this.Handlebars.compile(this.template);
		    },

		    //Handlebars template
		    //overridable via the JSON config of any given instance of the component
		    template: `
					  <div>
					    <span>Some HTML here</span>
					  </div>
					`,

				compiledTemplate: null,

				//put model here so we only ever need one of these????

				/*
				*
				*/
				renderView: function(targetSelector, templateParams) {
					templateParams = templateParams || {};
					var html = this.compiledTemplate(templateParams);

					viewUtils.renderDomElement(targetSelector, html);
		    }		    
		}

		return module;
	});
});