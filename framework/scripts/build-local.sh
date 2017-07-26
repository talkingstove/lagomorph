#!/bin/bash 
r.js -o app.build.js
babel --plugins transform-es2015-template-literals ../out/L.js --out-file ../out/L.js
cp ../out/L.js ../../sample-app/public/js/lib/lagomorph
sass ../css/final.scss:../out/styles.css
cp ../out/styles.css ../../sample-app/public/stylesheets/lagomorph
echo "***** local build complete. L.js and styles.css copied to sample-app *****"