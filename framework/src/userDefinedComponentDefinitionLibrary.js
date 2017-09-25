define(["LLibrary"], function(LLibrary) {

  //makes the singleton avaible to the global window.L, or via require
  return {

    UserDefinedComponentDefinitionLibrary: null,

    initializeUserDefinedComponentDefinitionLibrary: function(userDefinedComponents) {
      userDefinedComponents = userDefinedComponents || null;
      if (this.UserDefinedComponentDefinitionLibrary !== null) {
        console.warn('UserDefinedComponentDefinitionLibrary singleton already initialized');
        return;
      }

      this.UserDefinedComponentDefinitionLibrary = new LLibrary();

      if (userDefinedComponents) {
        this.getLibrary().addMultipleItems(userDefinedComponents, true);
      }

    },

    getLibrary: function() {
      return this.UserDefinedComponentDefinitionLibrary;
    },

    getUserDefinedComponentDefinitionLibraryByName: function(name) {
      return this.getLibrary() ? this.getLibrary().storage[name] : null;
    }


  }
});