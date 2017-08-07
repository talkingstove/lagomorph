define(["Handlebars", "underscore", "LModule", "viewUtils"], function(Handlebars, _,  LModule, viewUtils) {

	return LModule.extend(function(base) {
		  return {
		    // The `init` method serves as the constructor.
		    init: function(params) {
	    		params = params || {};

	    		base.init(params);

	        if (params.template) { //override template per instance when desired!
	        	this.template = params.template;
	        }

	        if (params.childTemplate) { //override template per instance when desired!
	        	this.childTemplate = params.childTemplate;
	        }

	        //give it its own template not that of the superclass!!
	        this.compiledTemplate = this.Handlebars.compile(this.template);
		    },

		    processedData: { 
		    	listItems: null //expect []
	    	},

	    	 //listItems maps to the data which is returned from the Connector
		    template: `
					  <ul data-data_binding="listItems" data-template_binding="childTemplate">
					    I am a list
					  </ul>
					`,

				//probably overridden	
				childTemplate: `
					  <li>
					    {{childContents}}
					  </li>
					`,

				/*
				* override to put children into contents
				*/
				renderView: function(targetSelector) {
												//      		processedData: { 
		   //  	listItems: null // expect []
	    // 	},

	    // ^^^^^ knows specifically what to do with listItems bc it's a list: use the child template
	    //***** it just generically puts them into child template, which is up to you


					var html = this.compiledTemplate(this.viewData);

					viewUtils.renderDomElement(targetSelector, html);
		    }		  
		    
		  }
	});
});