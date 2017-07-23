# lagomorph
UNDER DEVELOPMENT. Please visit the wiki for an overview: 
https://github.com/talkingstove/lagomorph/wiki/Overview-and-Principles

Our goal is to create  multi-tenant-compatible, CMS-friendly, backend- and data-structure-agnostic, offline-work-capable, "use what you want" frontend framework.

TO BUILD FRAMEWORK:
1) If needed, "npm install -g requirejs" so r.js will be available
2) From /framework/scripts in terminal:
=> r.js -o app.build.min.js (outputs out/L.min.js)
OR to build un-minified version for local use => r.js -o app.build.js (outputs out/L.js)

TO USE NEWLY-BUILT VERSION IN SAMPLE-APP:
=> cp ../out/L.js ../../sample-app/public/js/lib/lagomorph

TO RUN SAMPLE APP: 
Install Mongodb if needed: see video here for instructions for mac https://youtu.be/_WJ8m5QHvwc (for windows: https://youtu.be/sBdaRlgb4N8)

Run mongod from terminal

Go to /sample-app and run `npm install` and `node app.js`
