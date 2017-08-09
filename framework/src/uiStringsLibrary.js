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

      UIStringsLibrary = new LLibrary();

      if (uiStrings) {
        UIStringsLibrary.addItem('allUiStrings', uiStrings, true);
      }

    },

    getLibrary: function() {
      return UIStringsLibrary;
    },

    getUIStringByKey: function(key) {
      return this.getLibrary() && this.getLibrary().allUiStrings ? objectUtils.getDataFromObjectByPath(this.getLibrary().allUiStrings, key) : null;
    },


  }
});