define(["componentInstanceLibrary"], function(componentInstanceLibrary) {

  return {
    scan: function($target) {
      console.log('SCANNING:', $target);
      var $components = $target.find('[data-lagomorph-component], [data-lc]');

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

        $target.find('[data-lagomorph-component], [data-lc]').removeAttr('data-lagomorph-component').removeAttr('data-lc');

       

        moduleInstance.loadComponent($component);

      }, this);
    }



  }
});