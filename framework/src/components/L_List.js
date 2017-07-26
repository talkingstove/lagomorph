define(["Handlebars", "LModule"], function(Handlebars, LModule) {

	return LModule.extend(function(base) {
		  return {
		    // The `init` method serves as the constructor.
		    init: function(params) {
	    		params = params || {};

	    		base.init(params);
	        // Insert private functions here
	        console.log('L-List Module with params:', params);

	        if (params.template) { //override template per instance when desired!
	        	this.template = params.template;
	        }

	        if (params.childTemplate) { //override template per instance when desired!
	        	this.childTemplate = params.childTemplate;
	        }

	        //give it its own template not that of the superclass!!
	        this.compiledTemplate = this.Handlebars.compile(this.template);
		    },

		    //Handlebars template
		    //overridable via the JSON config of any given instance of the component
		    //usage: this.renderView('h1', {contents: 'yo'});
		    template: `
					  <ul>
					    I am a list
					  </ul>
					`,

				childTemplate: `
					  <li>
					    {{childContents}}
					  </li>
					`,

				/*
				* override to put children into contents
				*/
				renderView: function(targetSelector, templateParams) {
					templateParams = templateParams || {};

					if ( !templateParams.childrenData || !_.isArray(templateParams.childrenData) ) {

					}

					var html = this.compiledTemplate(templateParams);
					$(targetSelector).html(html);

					//todo: now get the data for the list and render items
		    }	
		    
		  }
	});
});