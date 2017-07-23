#!/bin/bash 
r.js -o app.build.js
babel --plugins transform-es2015-template-literals ../out/L.js --out-file ../out/L.js
cp ../out/L.js ../../sample-app/public/js/lib/lagomorph