define([], function() {

	return {
  	scan: function() {
  		console.log('SCANNING...');

  		//find Lagomorph blocks that may contain components
  		var $blocks = $('.lagomorph-block');

  		_.each($blocks, function(block) {
  			var $block = $(block);
  			var $components = $block.find('[data-lagomorph-component], [data-lc]');

        _.each($components, function(component) {
          var $component = $(component);
          var compData = $component.data('lagomorph-component'); //jquery converts to object for free

          //todo: valid json check

          var moduleClass = L.componentDefinitions[compData.type];
          compData.$parentSelector = $component; //todo: bad name -- componentWrapper
          var moduleInstance = new moduleClass(compData);

          //todo: add module instance to global library for easy lookup (get by id, search data for, etc)

          moduleInstance.renderView($component); //todo: pre-render in case data is needed from server

        }, this);

  		}, this);
  	}



  }
});