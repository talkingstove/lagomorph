define(["jquery", "underscore", "Handlebars"], function($, _, Handlebar ) {

	var viewUtils = {

    /*
    * abstracted from jQuery in case we ever want to remove it or even use React, etc
    */
		renderDomElement: function(containerSelector, html, renderType) {
      renderType = renderType || 'replace'; 

      switch(renderType) {
        case 'replace':
          if (_.isObject(containerSelector)) { //jquery obj passed in
            containerSelector.html(html);
          }
          else {
            $(containerSelector).html(html);
          }
          
        break;
      }
      
    }


	}

	 
	return viewUtils;
});