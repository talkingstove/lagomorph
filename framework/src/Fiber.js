//     Fiber.js 1.0.5
//     @author: Kirollos Risk
//
//     Copyright (c) 2012 LinkedIn.
//     All Rights Reserved. Apache Software License 2.0
//     http://www.apache.org/licenses/LICENSE-2.0
(function(){(function(a,b){if(typeof exports==="object"){module.exports=b(this)}else{if(typeof define==="function"&&define.amd){define(function(){return b(a)})}else{a.Fiber=b(a)}}}(this,function(c){var b=false,a=Array.prototype,d=c.Fiber;function f(i,h){var g;for(g in i){if(i.hasOwnProperty(g)){h[g]=i[g]}}}function e(){}e.extend=function(i){var h=this.prototype,g=i(h),j;function k(){if(!b){this.init.apply(this,arguments);this.init=void 0}}b=true;j=k.prototype=new this;b=false;j.init=function(){if(typeof h.init==="function"){h.init.apply(this,arguments)}};f(g,j);j.constructor=k;k.__base__=h;k.extend=k.prototype.extend||e.extend;return k};e.proxy=function(j,g){var h,k={},i;if(arguments.length===1){g=j;j=g.constructor.__base__}i=function(l){return function(){return j[l].apply(g,arguments)}};for(h in j){if(j.hasOwnProperty(h)&&typeof j[h]==="function"){k[h]=i(h)}}return k};e.decorate=function(h){var k,l=h.constructor.__base__,j=a.slice.call(arguments,1),g=j.length;for(k=0;k<g;k++){f(j[k].call(h,l),h)}};e.mixin=function(k){var j,l=k.__base__,h=a.slice.call(arguments,1),g=h.length;for(j=0;j<g;j++){f(h[j](l),k.prototype)}};e.noConflict=function(){c.Fiber=d;return e};return e}))}());