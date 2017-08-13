define(["LLibrary", "objectUtils"], function(LLibrary, objectUtils) {

  //makes the singleton avaible to the global window.L, or via require
	return {

    UIStringsLibrary: null,

    initializeUIStringsLibrary: function(uiStrings) {
      uiStrings = uiStrings || null;
      if (this.UIStringsLibrary !== null) {
        console.warn('UIStringsLibrary singleton already initialized');
        return;
      }

      this.UIStringsLibrary = new LLibrary();

      if (uiStrings) {
        this.getLibrary().addItem('allUiStrings', uiStrings, true);
      }

    },

    getLibrary: function() {
      return this.UIStringsLibrary;
    },

    getUIStringByKey: function(key) {
      return this.getLibrary() && this.getLibrary().storage.allUiStrings ? objectUtils.getDataFromObjectByPath(this.getLibrary().storage.allUiStrings, key) : null;
    },


  }
});