define(["Handlebars", "DOMModel", "scanner"], function(Handlebars, DOMModel, scanner) {

  return {


    /*
    * 
    */
    renderDomElement: function($containerSelector, html, renderType, callback, forceImmediateRender) {
      renderType = renderType || 'replace'; 
      callback = callback || null;
      forceImmediateRender = forceImmediateRender || false;

      DOMModel.callbacks = DOMModel.callbacks || [];
      if (callback) {
        DOMModel.callbacks.push(callback);
      }

      if (forceImmediateRender) {
        $containerSelector.html(html);
        return;
      }

      var $shadowDOM = DOMModel.getCurrentShadowDOM();
    
      if (!$shadowDOM ) {
        DOMModel.setCurrentShadowDOM( DOMModel.getCurrentPageDOMSelector().clone() );
      }
      
      DOMModel.alterShadowDOM($containerSelector, html, renderType);
      
      scanner.scan(DOMModel.getCurrentShadowDOM());

      if (!DOMModel.renderinProgress) { //block multiple simaltaneous shadow DOM renders
        DOMModel.renderinProgress = true;

         _.defer(function() {
          _.each(DOMModel.callbacks, function(callback) {
            callback();
          });


          DOMModel.writeShadowDOMToBrowser(); //make all enqueued changes
          DOMModel.renderinProgress = false;
          DOMModel.callbacks = [];
          DOMModel.setCurrentShadowDOM(null);        
        });

      }
       
    

      

      // getCurrentPageDOMSelector

      //problem if container is page??

      //needs to take a callback so that can be sure to happen after dom update

      // switch(renderType) {
      //   case 'replace':
      //     if ( _.isObject($containerSelector) ) { //jquery obj passed in
      //       $containerSelector.html(html);
      //     }
      //     else {
      //       $(containerSelector).html(html);
      //     }
          
      //   break;
      // }
      
    }


  }


});