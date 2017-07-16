/**
 * @license almond 0.3.3 Copyright jQuery Foundation and other contributors.
 * Released under MIT license, http://github.com/requirejs/almond/LICENSE
 */

!function(n,e){"function"==typeof define&&define.amd?define([],e):n.libGlobalName=e()}(this,function(){var n,e,r;return function(t){function i(n,e){return x.call(n,e)}function o(n,e){var r,t,i,o,f,u,c,l,s,a,p,d,g=e&&e.split("/"),h=b.map,m=h&&h["*"]||{};if(n){for(n=n.split("/"),f=n.length-1,b.nodeIdCompat&&E.test(n[f])&&(n[f]=n[f].replace(E,"")),"."===n[0].charAt(0)&&g&&(d=g.slice(0,g.length-1),n=d.concat(n)),s=0;s<n.length;s++)if(p=n[s],"."===p)n.splice(s,1),s-=1;else if(".."===p){if(0===s||1===s&&".."===n[2]||".."===n[s-1])continue;s>0&&(n.splice(s-1,2),s-=2)}n=n.join("/")}if((g||m)&&h){for(r=n.split("/"),s=r.length;s>0;s-=1){if(t=r.slice(0,s).join("/"),g)for(a=g.length;a>0;a-=1)if(i=h[g.slice(0,a).join("/")],i&&(i=i[t])){o=i,u=s;break}if(o)break;!c&&m&&m[t]&&(c=m[t],l=s)}!o&&c&&(o=c,u=l),o&&(r.splice(0,u,o),n=r.join("/"))}return n}function f(n,e){return function(){var r=j.call(arguments,0);return"string"!=typeof r[0]&&1===r.length&&r.push(null),g.apply(t,r.concat([n,e]))}}function u(n){return function(e){return o(e,n)}}function c(n){return function(e){y[n]=e}}function l(n){if(i(v,n)){var e=v[n];delete v[n],w[n]=!0,d.apply(t,e)}if(!i(y,n)&&!i(w,n))throw new Error("No "+n);return y[n]}function s(n){var e,r=n?n.indexOf("!"):-1;return r>-1&&(e=n.substring(0,r),n=n.substring(r+1,n.length)),[e,n]}function a(n){return n?s(n):[]}function p(n){return function(){return b&&b.config&&b.config[n]||{}}}var d,g,h,m,y={},v={},b={},w={},x=Object.prototype.hasOwnProperty,j=[].slice,E=/\.js$/;h=function(n,e){var r,t=s(n),i=t[0],f=e[1];return n=t[1],i&&(i=o(i,f),r=l(i)),i?n=r&&r.normalize?r.normalize(n,u(f)):o(n,f):(n=o(n,f),t=s(n),i=t[0],n=t[1],i&&(r=l(i))),{f:i?i+"!"+n:n,n:n,pr:i,p:r}},m={require:function(n){return f(n)},exports:function(n){var e=y[n];return"undefined"!=typeof e?e:y[n]={}},module:function(n){return{id:n,uri:"",exports:y[n],config:p(n)}}},d=function(n,e,r,o){var u,s,p,d,g,b,x,j=[],E=typeof r;if(o=o||n,b=a(o),"undefined"===E||"function"===E){for(e=!e.length&&r.length?["require","exports","module"]:e,g=0;g<e.length;g+=1)if(d=h(e[g],b),s=d.f,"require"===s)j[g]=m.require(n);else if("exports"===s)j[g]=m.exports(n),x=!0;else if("module"===s)u=j[g]=m.module(n);else if(i(y,s)||i(v,s)||i(w,s))j[g]=l(s);else{if(!d.p)throw new Error(n+" missing "+s);d.p.load(d.n,f(o,!0),c(s),{}),j[g]=y[s]}p=r?r.apply(y[n],j):void 0,n&&(u&&u.exports!==t&&u.exports!==y[n]?y[n]=u.exports:p===t&&x||(y[n]=p))}else n&&(y[n]=r)},n=e=g=function(n,e,r,i,o){if("string"==typeof n)return m[n]?m[n](e):l(h(n,a(e)).f);if(!n.splice){if(b=n,b.deps&&g(b.deps,b.callback),!e)return;e.splice?(n=e,e=r,r=null):n=t}return e=e||function(){},"function"==typeof r&&(r=i,i=o),i?d(t,n,e,r):setTimeout(function(){d(t,n,e,r)},4),g},g.config=function(n){return g(n)},n._defined=y,r=function(n,e,r){if("string"!=typeof n)throw new Error("See almond README: incorrect module build, no module name");e.splice||(r=e,e=[]),i(y,n)||i(v,n)||(v[n]=[n,e,r])},r.amd={jQuery:!0}}(),r("../lib/almond",function(){}),r("scanner",[],function(){return{scan:function(){console.log("SCANNING...")}}}),r("lagomorph",["scanner"],function(n){var e={scanner:n,start:function(){this.scanner.scan()}};return window.L=e,e}),e("lagomorph")});