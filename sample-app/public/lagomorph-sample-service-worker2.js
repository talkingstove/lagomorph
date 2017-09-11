/*
 Copyright 2016 Google Inc. All Rights Reserved.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
     http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

// Names of the two caches used in this version of the service worker.
// Change to v2, etc. when you update any of the local resources, which will
// in turn trigger the install event again.
const PRECACHE = 'precache-v4';
const RUNTIME = 'runtime';

// A list of local resources we always want to be cached.
const PRECACHE_URLS = [
  'noapp.html',
  // './', // Alias for index.html
  // 'lib/lagomorph/L.js',
  // 'userDefinedComponents.js'
];

// The install handler takes care of precaching the resources we always need.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(self.skipWaiting())
  );
});

// The activate handler takes care of cleaning up old caches.
// self.addEventListener('activate', event => {
//   const currentCaches = [PRECACHE, RUNTIME];
//   event.waitUntil(
//     caches.keys().then(cacheNames => {
//       return cacheNames.filter(cacheName => !currentCaches.includes(cacheName));
//     }).then(cachesToDelete => {
//       return Promise.all(cachesToDelete.map(cacheToDelete => {
//         return caches.delete(cacheToDelete);
//       }));
//     }).then(() => self.clients.claim())
//   );
// });

// The fetch handler serves responses for same-origin resources from a cache.
// If no response is found, it populates the runtime cache with the response
// from the network before returning it to the page.
self.addEventListener('fetch', event => {
  // Skip cross-origin requests, like those for Google Analytics.

//*********************************************************
  //"runtime" is just a name we made up
  //if we match to a single cache instead of all... https://developer.mozilla.org/en-US/docs/Web/API/Cache/match
  //then the user could say... "use cache 20170901"
  //then he will use the files he cached on that day if he wants a solid versiob
  //would need to resuse this logic with a user inputted name instead of the const RUNTIME:
  // return caches.open(RUNTIME).then(cache => {
  //         return fetch(event.request).then(response => {
  //           // Put a copy of the response in the runtime cache.
  //           return cache.put(event.request, response.clone()).then(() => {
  //             return response;
  //           });
  //         });

//this would probably work best with syncAPI bc it's more intentional than just listening to any fetch (??)
//actully probably need a list of urls and call them, then fetch listener does its thing
//*********************************************************

// return caches.open(OFFLINE_CACHE).then(function(cache) {
//           return cache.match(OFFLINE_URL);
//         });
  
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          console.log('loading cached file via service worker:', event.request.url);
          return cachedResponse; //stop, file loaded from cache
        }

        return caches.open('20171007').then(cache => {
          return fetch(event.request).then(response => { //actual fetch from server if we made it this fae
            // Put a copy of the server response in the specified cache.
            return cache.put(event.request, response.clone()).then(() => {
              return response;
            });
          });
        });
      })
    );
  }
});