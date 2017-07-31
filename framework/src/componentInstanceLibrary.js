define(["LLibrary"], function(LLibrary) {

  //makes the component library singleton avaible to the global window.L, or via require
	return {

    ComponentInstanceLibrary: null,

    initializeComponentInstanceLibrary: function() {
      if (this.ComponentInstanceLibrary !== null) {
        console.warn('ComponentInstanceLibrary singleton already initialized');
        return;
      }

      ComponentInstanceLibrary = new LLibrary();
    },

    getLibrary: function() {
      return ComponentInstanceLibrary;
    },

    registerComponent: function(component, overwriteInstance) {
      var id = component.id;
      overwriteInstance = overwriteInstance || false;

      if (!id) {
        console.error('attempted to register component without id!');
        return;
      }

      if (!overwriteInstance && ComponentInstanceLibrary.getItem(id) ) {
        console.error('attempted to register dupe component with id:', id);
        return;
      }

      ComponentInstanceLibrary.addItem(id, component);

    }


  }
});