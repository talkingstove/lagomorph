# lagomorph
Rabbits, pikas, and hares.

UNDER DEVELOPMENT.

Our goal is to create  multi-tenant-compatible, CMS-friendly, backend- and data-structure-agnostic, offline-work-capable, "use what you want" frontend framework.

TO BUILD FRAMEWORK:
1) If needed, "npm install -g requirejs" so r.js will be available
2) From /framework/scripts in terminal:
=> r.js -o app.build.js 
OR to build un-minified version for local use => r.js -o app.build.js optimize=none

TO USE NEWLY-BUILT VERSION IN SAMPLE-APP:
=> cp ../out/L.js ../../sample-app/public/js/lib/lagomorph

3) install Mongodb, see video here for instructions for mac https://youtu.be/_WJ8m5QHvwc (for windows: https://youtu.be/sBdaRlgb4N8)
4) to run sample-app, go to /sample-app and run `npm install` and `node app.js`
