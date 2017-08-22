define(["LModel"], function(LModel) {

  //makes the singleton avaible to the global window.L, or via require
	return {

    DOMModel: null,

    initializeDOMModel: function() {
      if (this.DOMModel !== null) {
        console.warn('DOMModel singleton already initialized');
        return;
      }

      this.DOMModel = new LModel();
      this.getDOMModel().set('currentShadowDOM', null);
    },

    getDOMModel: function() {
      return this.DOMModel;
    },

    registerCurrentPage: function(pageClass) {
      this.getDOMModel().set('currentPageClass', pageClass);
    },

    getCurrentPage: function() {
      return this.getDOMModel().get('currentPageClass');
    },

    getCurrentShadowDOM: function() {
      return this.getDOMModel().get('currentShadowDOM');
    },

    setCurrentShadowDOM: function($shadowDOM) {
      return this.getDOMModel().set('currentShadowDOM', $shadowDOM);
    },

    getCurrentPageDOMSelector: function() {
      return this.getDOMModel().get('currentPageClass') ? this.getDOMModel().get('currentPageClass').getDOMElement() : null;
    },

    alterShadowDOM: function($containerSelector, html, renderType) {
      if ( !this.getCurrentShadowDOM() ) {
        console.warn('attempted to alter non-existent shadow DOM');
        return;
      };

      var $shadowDOM = this.getCurrentShadowDOM();

      if ( !_.isObject($containerSelector) ) {
        $containerSelector = $($containerSelector);
      }

      //default to parent ??TODO: bad
      var $shadowEl = $shadowDOM.find('.' + $containerSelector.attr('class').split(" ").join('.')).length ? $shadowDOM.find('.' + $containerSelector.attr('class').split(" ").join('.')) : $shadowDOM;
      console.log('$containerSelector', $containerSelector);
      console.log('$shadowEl', $shadowEl);

      debugger;

      switch(renderType) {
        case 'replace':
            $shadowEl.html(html);
          
        break;
      }
    },

    writeShadowDOMToBrowser: function() {
      console.log('rendering shadow DOM to page');
      this.getCurrentPageDOMSelector().html ( this.getCurrentShadowDOM().html() );
    }

  }
});





