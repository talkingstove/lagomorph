define(["componentInstanceLibrary"], function(componentInstanceLibrary) {

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

          //definition must provide at minimum a type and id in the json
          var compData = $component.data('lagomorph-component'); //jquery converts to object for free


          if ( !(_.isObject(compData)) ) {
            console.warn('Invalid data JSON for component:', component);
            return;
          }

          var compViewData = compData.viewParams;
          // var compDataSources = compData.dataSources;

          var moduleClass = L.componentDefinitions[compViewData.type];//todo: bad name -- component
          compViewData.$parentSelector = $component; //todo: bad name -- componentWrapper
          var moduleInstance = new moduleClass(compData);

          //todo: add module instance to global library for easy lookup (get by id, search data for, etc)

          moduleInstance.loadComponent($component); //todo: pre-render in case data is needed from server

        }, this);

      }, this);
    }



  }
});