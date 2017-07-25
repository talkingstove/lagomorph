define(["Handlebars", "LBase"], function(Handlebars, LBase) {

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

				/*
				*
				*/
				renderView: function(targetSelector, templateParams) {
					templateParams = templateParams || {};

					var html = this.compiledTemplate(templateParams);
					$(targetSelector).html(html);
		    }

		//     var theTemplateScript = "Welcome {{name}}, {{species}} from {{planet}} !!";

  // // Compile the template directly as below
  // var theTemplate = Handlebars.compile(theTemplateScript);

  // // Pass your data to the template
  // var theCompiledHtml = theTemplate(data);

  // // Add the compiled html to the page
  // $('.content-placeholder').html(theCompiledHtml); 
		    
		}

		return module;
	});
});