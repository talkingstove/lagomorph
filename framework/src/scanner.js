define(["componentInstanceLibrary"], function(componentInstanceLibrary) {

  return {
    scan: function($target) {
      console.log('SCANNING:', $target);
      var $components = $target.find('[data-lagomorph-component], [data-lc]').not('[data-rendered]');

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

        var moduleClass = L.componentDefinitions[compViewData.type];
        compViewData.$parentSelector = $component; //todo: bad name -- componentWrapper
        var moduleInstance = new moduleClass(compData);

        //****IMPORTANT!!! mark as rendered or it will re-render in an infinite loop on subsequent scans!!
        $component.attr('data-rendered', true);

        moduleInstance.loadComponent($component);

      }, this);
    }



  }
});