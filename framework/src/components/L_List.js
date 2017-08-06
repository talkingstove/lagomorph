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

		    /*
		    * the datasource instructions in the json tell us about an endpoint and
		    * the contract so we know what to expect from the backend
		    *
		    * the instructions on the module tell us how to put that expected data into a useful stucture for this component
		    * and then render it
		    *
		    * a middleware component like "activeUser" sets its expectations here so it can be stacked onto others
		    * the user needs to pass in their own activeUser endpoint which includes maps to activeUser component props
		    * eg new ActiveUserModule(activeUserEndpoint, map{fn: firstname})
		    * ^^^^ ActiveUserModule needs to provide the template for the map so it can tell us what it needs
		    *
		    * in this case, "listItems" can be anything, it just needs data that matches up to the childTemplate
		    *
		    * data maps and data sources can both be extermalized in json; end user can pick a "grouping" for a ready-made set
		    */
		    // dataSourceInstructions: {
		    // 	//??????????
		    // },

		    processedData: { 
		    	listItems: null
	    	},

	    	 //listItems maps to the data which is returned from the Connector
		    template: `
					  <ul data-data_binding="listItems">
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
		   //  	listItems: null
	    // 	},

	    // ^^^^^ knows specifically what to do with listItems bc it's a list: use the child template
	    //***** it just generically puts them into child template, which is up to you


					var html = this.compiledTemplate(this.viewData);

					viewUtils.renderDomElement(targetSelector, html);
		    }		  
		    
		  }
	});
});