define(["Handlebars"], function(Handlebars) {

  return {


    /*
    * 
    */
    renderDomElement: function($containerSelector, html, renderType, callback, forceImmediateRender) {
      renderType = renderType || 'replace'; 
      callback = callback || null;
      forceImmediateRender = forceImmediateRender || false;

      //if !currentphatomPage --> make phatntom page, modify, set timeout to put it back into page
      //else add change to currnet phantom page
      //thus, sync changes line up in a queue!

      //problem if container is page??

      //needs to take a callback so that can be sure to happen after dom update

      switch(renderType) {
        case 'replace':
          if ( _.isObject($containerSelector) ) { //jquery obj passed in
            $containerSelector.html(html);
          }
          else {
            $(containerSelector).html(html);
          }
          
        break;
      }
      
    }


  }


});