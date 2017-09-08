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

      var $shadowEl;
      //***TODO: resolve problem of classless elements
      //TODO: address parent issue
      //https://stackoverflow.com/questions/9382028/get-the-current-jquery-selector-string
      if ($containerSelector.is('#page-wrapper')) {
        $shadowEl = $shadowDOM;
      }
      else {
        if (!($containerSelector.attr('class'))) {
          console.error('Cant use shadowDOM on el with no Class:', $containerSelector);
          return;
        }

        $shadowEl = $shadowDOM.find('.' + $containerSelector.attr('class').split(" ").join('.')).length ? $shadowDOM.find('.' + $containerSelector.attr('class').split(" ").join('.')) : null;
      }

      console.log('$containerSelector', $containerSelector);
      console.log('$shadowEl', $shadowEl);

   

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





