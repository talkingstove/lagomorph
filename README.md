# lagomorph
IN VERY EARLY DEVELOPMENT. 

Please visit the wiki for an overview: 
https://github.com/talkingstove/lagomorph/wiki/Overview-and-Principles

And to read about what's here so far:
https://github.com/talkingstove/lagomorph/wiki/So-Far


Our goal is to create  multi-tenant-compatible, CMS-friendly, backend- and data-structure-agnostic, offline-work-capable, "use what you want" frontend framework.

TO BUILD FRAMEWORK:
1) If needed, "npm install -g requirejs" so r.js will be available
2) From /framework/scripts in terminal: sh build-local.sh

TO RUN SAMPLE APP: 
Install Mongodb if needed: see video here for instructions for mac https://youtu.be/_WJ8m5QHvwc (for windows: https://youtu.be/sBdaRlgb4N8)

Run mongod from terminal

Go to /sample-app and run `npm install` and `node app.js`

Local app will be available at http://localhost:4000/, with your changes copied into its L.js by the build script!

UNIT TESTS (for framework):
cd to framework
karma start
karma run (known issue: tests fail in phantom.js)