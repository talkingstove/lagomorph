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

	        if (params.listItemTemplate) { //override template per instance when desired!
	        	this.listItemTemplate = params.listItemTemplate;
	        }

	        //give it its own template not that of the superclass!!
	        this.compiledTemplate = this.Handlebars.compile(this.template);
	        this.compiledListItemTemplate = this.Handlebars.compile(this.listItemTemplate);
		    },

		    data: { 
		    	listItems: null //expect []
	    	},

	    	 //listItems maps to the data which is returned from the Connector
	    	 //if array, data-template_binding is used for each item!
		    template: `
					  <ul data-data_binding="listItems" data-template_binding="compiledListItemTemplate">			   
					  </ul>
					`,

				listItemTemplate: `
					  <li>
					    {{caption}}
					  </li>
					`
				
		    
		  }
	});
});