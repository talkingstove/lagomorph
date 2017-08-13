define(["Fiber"], function(Fiber) {

  var LLibrary = Fiber.extend(function(base) {
      return {
        // The `init` method serves as the constructor.
        init: function(params) {
            this.storage = {}; //in order for this to be an instance var and not on the class, MUST be declared in init!!
        },

        getItem: function(id) {
          return this.storage[id] || null;
        },

        addMultipleItems: function(itemsMap, overwriteItems) {
          overwriteItems = overwriteItems || false;

          _.each(itemsMap, function(item, key) {
            this.addItem(key, item, overwriteItems);
          }, this);
        },

        addItem: function(id, item, overwriteItem) {
          overwriteItem = overwriteItem || false;

          if (!overwriteItem && this.getItem(id) ) {
            console.error('attempted to register dupe component without overwriteItem=true with id:', id);
            return;
          }
          else if (overwriteItem && this.storage[id] && this.storage[id].destroy) {
            this.storage[id].destroy();
          }

          this.storage[id] = item;
        },

        deleteItem: function(id, itemDestroyAlreadyCalled) {
          if (!this.storage[id]) {
            console.warn('attempted to delete non-existent item with id', id);
            return;
          }

          itemDestroyAlreadyCalled = itemDestroyAlreadyCalled || false;

          if(this.storage[id].destroy && !this.storage[id].isDestroyed && !itemDestroyAlreadyCalled) {
            this.storage[id].destroy();
          }

          delete this.storage[id];
        }
        
      }
  });

  return LLibrary;
});