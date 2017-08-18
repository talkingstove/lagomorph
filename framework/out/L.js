(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        //Allow using this built library as an AMD module
        //in another project. That other project will only
        //see this AMD call, not the internal modules in
        //the closure below.
        define([], factory);
    } else {
        //Browser globals case. Just assign the
        //result to a property on the global.
        root.libGlobalName = factory();
    }
})(this, function () {
    //almond, and your modules will be inlined here
    /**
     * @license almond 0.3.3 Copyright jQuery Foundation and other contributors.
     * Released under MIT license, http://github.com/requirejs/almond/LICENSE
     */
    //Going sloppy to avoid 'use strict' string cost, but strict practices should
    //be followed.
    /*global setTimeout: false */

    var requirejs, require, define;
    (function (undef) {
        var main,
            req,
            makeMap,
            handlers,
            defined = {},
            waiting = {},
            config = {},
            defining = {},
            hasOwn = Object.prototype.hasOwnProperty,
            aps = [].slice,
            jsSuffixRegExp = /\.js$/;

        function hasProp(obj, prop) {
            return hasOwn.call(obj, prop);
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @returns {String} normalized name
         */
        function normalize(name, baseName) {
            var nameParts,
                nameSegment,
                mapValue,
                foundMap,
                lastIndex,
                foundI,
                foundStarMap,
                starI,
                i,
                j,
                part,
                normalizedBaseParts,
                baseParts = baseName && baseName.split("/"),
                map = config.map,
                starMap = map && map['*'] || {};

            //Adjust any relative paths.
            if (name) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // If wanting node ID compatibility, strip .js from end
                // of IDs. Have to do this here, and not in nameToUrl
                // because node allows either .js or non .js to map
                // to same file.
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                // Starts with a '.' so need the baseName
                if (name[0].charAt(0) === '.' && baseParts) {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that 'directory' and not name of the baseName's
                    //module. For instance, baseName of 'one/two/three', maps to
                    //'one/two/three.js', but we want the directory, 'one/two' for
                    //this normalization.
                    normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    name = normalizedBaseParts.concat(name);
                }

                //start trimDots
                for (i = 0; i < name.length; i++) {
                    part = name[i];
                    if (part === '.') {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === '..') {
                        // If at the start, or previous value is still ..,
                        // keep them so that when converted to a path it may
                        // still work when converted to a path, even though
                        // as an ID it is less than ideal. In larger point
                        // releases, may be better to just kick out an error.
                        if (i === 0 || i === 1 && name[2] === '..' || name[i - 1] === '..') {
                            continue;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join('/');
            }

            //Apply map config if available.
            if ((baseParts || starMap) && map) {
                nameParts = name.split('/');

                for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join("/");

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = map[baseParts.slice(0, j).join('/')];

                            //baseName segment has  config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = mapValue[nameSegment];
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break;
                                }
                            }
                        }
                    }

                    if (foundMap) {
                        break;
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && starMap[nameSegment]) {
                        foundStarMap = starMap[nameSegment];
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            return name;
        }

        function makeRequire(relName, forceSync) {
            return function () {
                //A version of a require function that passes a moduleName
                //value for items that may need to
                //look up paths relative to the moduleName
                var args = aps.call(arguments, 0);

                //If first arg is not require('string'), and there is only
                //one arg, it is the array form without a callback. Insert
                //a null so that the following concat is correct.
                if (typeof args[0] !== 'string' && args.length === 1) {
                    args.push(null);
                }
                return req.apply(undef, args.concat([relName, forceSync]));
            };
        }

        function makeNormalize(relName) {
            return function (name) {
                return normalize(name, relName);
            };
        }

        function makeLoad(depName) {
            return function (value) {
                defined[depName] = value;
            };
        }

        function callDep(name) {
            if (hasProp(waiting, name)) {
                var args = waiting[name];
                delete waiting[name];
                defining[name] = true;
                main.apply(undef, args);
            }

            if (!hasProp(defined, name) && !hasProp(defining, name)) {
                throw new Error('No ' + name);
            }
            return defined[name];
        }

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        //Creates a parts array for a relName where first part is plugin ID,
        //second part is resource ID. Assumes relName has already been normalized.
        function makeRelParts(relName) {
            return relName ? splitPrefix(relName) : [];
        }

        /**
         * Makes a name map, normalizing the name, and using a plugin
         * for normalization if necessary. Grabs a ref to plugin
         * too, as an optimization.
         */
        makeMap = function (name, relParts) {
            var plugin,
                parts = splitPrefix(name),
                prefix = parts[0],
                relResourceName = relParts[1];

            name = parts[1];

            if (prefix) {
                prefix = normalize(prefix, relResourceName);
                plugin = callDep(prefix);
            }

            //Normalize according
            if (prefix) {
                if (plugin && plugin.normalize) {
                    name = plugin.normalize(name, makeNormalize(relResourceName));
                } else {
                    name = normalize(name, relResourceName);
                }
            } else {
                name = normalize(name, relResourceName);
                parts = splitPrefix(name);
                prefix = parts[0];
                name = parts[1];
                if (prefix) {
                    plugin = callDep(prefix);
                }
            }

            //Using ridiculous property names for space reasons
            return {
                f: prefix ? prefix + '!' + name : name, //fullName
                n: name,
                pr: prefix,
                p: plugin
            };
        };

        function makeConfig(name) {
            return function () {
                return config && config.config && config.config[name] || {};
            };
        }

        handlers = {
            require: function (name) {
                return makeRequire(name);
            },
            exports: function (name) {
                var e = defined[name];
                if (typeof e !== 'undefined') {
                    return e;
                } else {
                    return defined[name] = {};
                }
            },
            module: function (name) {
                return {
                    id: name,
                    uri: '',
                    exports: defined[name],
                    config: makeConfig(name)
                };
            }
        };

        main = function (name, deps, callback, relName) {
            var cjsModule,
                depName,
                ret,
                map,
                i,
                relParts,
                args = [],
                callbackType = typeof callback,
                usingExports;

            //Use name if no relName
            relName = relName || name;
            relParts = makeRelParts(relName);

            //Call the callback to define the module, if necessary.
            if (callbackType === 'undefined' || callbackType === 'function') {
                //Pull out the defined dependencies and pass the ordered
                //values to the callback.
                //Default to [require, exports, module] if no deps
                deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
                for (i = 0; i < deps.length; i += 1) {
                    map = makeMap(deps[i], relParts);
                    depName = map.f;

                    //Fast path CommonJS standard dependencies.
                    if (depName === "require") {
                        args[i] = handlers.require(name);
                    } else if (depName === "exports") {
                        //CommonJS module spec 1.1
                        args[i] = handlers.exports(name);
                        usingExports = true;
                    } else if (depName === "module") {
                        //CommonJS module spec 1.1
                        cjsModule = args[i] = handlers.module(name);
                    } else if (hasProp(defined, depName) || hasProp(waiting, depName) || hasProp(defining, depName)) {
                        args[i] = callDep(depName);
                    } else if (map.p) {
                        map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                        args[i] = defined[depName];
                    } else {
                        throw new Error(name + ' missing ' + depName);
                    }
                }

                ret = callback ? callback.apply(defined[name], args) : undefined;

                if (name) {
                    //If setting exports via "module" is in play,
                    //favor that over return value and exports. After that,
                    //favor a non-undefined return value over exports use.
                    if (cjsModule && cjsModule.exports !== undef && cjsModule.exports !== defined[name]) {
                        defined[name] = cjsModule.exports;
                    } else if (ret !== undef || !usingExports) {
                        //Use the return value from the function.
                        defined[name] = ret;
                    }
                }
            } else if (name) {
                //May just be an object definition for the module. Only
                //worry about defining if have a module name.
                defined[name] = callback;
            }
        };

        requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
            if (typeof deps === "string") {
                if (handlers[deps]) {
                    //callback in this case is really relName
                    return handlers[deps](callback);
                }
                //Just return the module wanted. In this scenario, the
                //deps arg is the module name, and second arg (if passed)
                //is just the relName.
                //Normalize module name, if it contains . or ..
                return callDep(makeMap(deps, makeRelParts(callback)).f);
            } else if (!deps.splice) {
                //deps is a config object, not an array.
                config = deps;
                if (config.deps) {
                    req(config.deps, config.callback);
                }
                if (!callback) {
                    return;
                }

                if (callback.splice) {
                    //callback is an array, which means it is a dependency list.
                    //Adjust args if there are dependencies
                    deps = callback;
                    callback = relName;
                    relName = null;
                } else {
                    deps = undef;
                }
            }

            //Support require(['a'])
            callback = callback || function () {};

            //If relName is a function, it is an errback handler,
            //so remove it.
            if (typeof relName === 'function') {
                relName = forceSync;
                forceSync = alt;
            }

            //Simulate async callback;
            if (forceSync) {
                main(undef, deps, callback, relName);
            } else {
                //Using a non-zero value because of concern for what old browsers
                //do, and latest browsers "upgrade" to 4 if lower value is used:
                //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
                //If want a value immediately, use require('id') instead -- something
                //that works in almond on the global level, but not guaranteed and
                //unlikely to work in other AMD implementations.
                setTimeout(function () {
                    main(undef, deps, callback, relName);
                }, 4);
            }

            return req;
        };

        /**
         * Just drops the config on the floor, but returns req in case
         * the config return value is used.
         */
        req.config = function (cfg) {
            return req(cfg);
        };

        /**
         * Expose module registry for debugging and tooling
         */
        requirejs._defined = defined;

        define = function (name, deps, callback) {
            if (typeof name !== 'string') {
                throw new Error('See almond README: incorrect module build, no module name');
            }

            //This module may not have dependencies
            if (!deps.splice) {
                //deps is not an array, so probably means
                //an object literal or factory function for
                //the value. Adjust args.
                callback = deps;
                deps = [];
            }

            if (!hasProp(defined, name) && !hasProp(waiting, name)) {
                waiting[name] = [name, deps, callback];
            }
        };

        define.amd = {
            jQuery: true
        };
    })();
    define("../lib/almond", function () {});

    /*! jQuery v2.0.0 | (c) 2005, 2013 jQuery Foundation, Inc. | jquery.org/license
    //@ sourceMappingURL=jquery.min.map
    */
    (function (e, undefined) {
        var t,
            n,
            r = typeof undefined,
            i = e.location,
            o = e.document,
            s = o.documentElement,
            a = e.jQuery,
            u = e.$,
            l = {},
            c = [],
            f = "2.0.0",
            p = c.concat,
            h = c.push,
            d = c.slice,
            g = c.indexOf,
            m = l.toString,
            y = l.hasOwnProperty,
            v = f.trim,
            x = function (e, n) {
            return new x.fn.init(e, n, t);
        },
            b = /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,
            w = /\S+/g,
            T = /^(?:(<[\w\W]+>)[^>]*|#([\w-]*))$/,
            C = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
            k = /^-ms-/,
            N = /-([\da-z])/gi,
            E = function (e, t) {
            return t.toUpperCase();
        },
            S = function () {
            o.removeEventListener("DOMContentLoaded", S, !1), e.removeEventListener("load", S, !1), x.ready();
        };x.fn = x.prototype = { jquery: f, constructor: x, init: function (e, t, n) {
                var r, i;if (!e) return this;if ("string" == typeof e) {
                    if (r = "<" === e.charAt(0) && ">" === e.charAt(e.length - 1) && e.length >= 3 ? [null, e, null] : T.exec(e), !r || !r[1] && t) return !t || t.jquery ? (t || n).find(e) : this.constructor(t).find(e);if (r[1]) {
                        if (t = t instanceof x ? t[0] : t, x.merge(this, x.parseHTML(r[1], t && t.nodeType ? t.ownerDocument || t : o, !0)), C.test(r[1]) && x.isPlainObject(t)) for (r in t) x.isFunction(this[r]) ? this[r](t[r]) : this.attr(r, t[r]);return this;
                    }return i = o.getElementById(r[2]), i && i.parentNode && (this.length = 1, this[0] = i), this.context = o, this.selector = e, this;
                }return e.nodeType ? (this.context = this[0] = e, this.length = 1, this) : x.isFunction(e) ? n.ready(e) : (e.selector !== undefined && (this.selector = e.selector, this.context = e.context), x.makeArray(e, this));
            }, selector: "", length: 0, toArray: function () {
                return d.call(this);
            }, get: function (e) {
                return null == e ? this.toArray() : 0 > e ? this[this.length + e] : this[e];
            }, pushStack: function (e) {
                var t = x.merge(this.constructor(), e);return t.prevObject = this, t.context = this.context, t;
            }, each: function (e, t) {
                return x.each(this, e, t);
            }, ready: function (e) {
                return x.ready.promise().done(e), this;
            }, slice: function () {
                return this.pushStack(d.apply(this, arguments));
            }, first: function () {
                return this.eq(0);
            }, last: function () {
                return this.eq(-1);
            }, eq: function (e) {
                var t = this.length,
                    n = +e + (0 > e ? t : 0);return this.pushStack(n >= 0 && t > n ? [this[n]] : []);
            }, map: function (e) {
                return this.pushStack(x.map(this, function (t, n) {
                    return e.call(t, n, t);
                }));
            }, end: function () {
                return this.prevObject || this.constructor(null);
            }, push: h, sort: [].sort, splice: [].splice }, x.fn.init.prototype = x.fn, x.extend = x.fn.extend = function () {
            var e,
                t,
                n,
                r,
                i,
                o,
                s = arguments[0] || {},
                a = 1,
                u = arguments.length,
                l = !1;for ("boolean" == typeof s && (l = s, s = arguments[1] || {}, a = 2), "object" == typeof s || x.isFunction(s) || (s = {}), u === a && (s = this, --a); u > a; a++) if (null != (e = arguments[a])) for (t in e) n = s[t], r = e[t], s !== r && (l && r && (x.isPlainObject(r) || (i = x.isArray(r))) ? (i ? (i = !1, o = n && x.isArray(n) ? n : []) : o = n && x.isPlainObject(n) ? n : {}, s[t] = x.extend(l, o, r)) : r !== undefined && (s[t] = r));return s;
        }, x.extend({ expando: "jQuery" + (f + Math.random()).replace(/\D/g, ""), noConflict: function (t) {
                return e.$ === x && (e.$ = u), t && e.jQuery === x && (e.jQuery = a), x;
            }, isReady: !1, readyWait: 1, holdReady: function (e) {
                e ? x.readyWait++ : x.ready(!0);
            }, ready: function (e) {
                (e === !0 ? --x.readyWait : x.isReady) || (x.isReady = !0, e !== !0 && --x.readyWait > 0 || (n.resolveWith(o, [x]), x.fn.trigger && x(o).trigger("ready").off("ready")));
            }, isFunction: function (e) {
                return "function" === x.type(e);
            }, isArray: Array.isArray, isWindow: function (e) {
                return null != e && e === e.window;
            }, isNumeric: function (e) {
                return !isNaN(parseFloat(e)) && isFinite(e);
            }, type: function (e) {
                return null == e ? e + "" : "object" == typeof e || "function" == typeof e ? l[m.call(e)] || "object" : typeof e;
            }, isPlainObject: function (e) {
                if ("object" !== x.type(e) || e.nodeType || x.isWindow(e)) return !1;try {
                    if (e.constructor && !y.call(e.constructor.prototype, "isPrototypeOf")) return !1;
                } catch (t) {
                    return !1;
                }return !0;
            }, isEmptyObject: function (e) {
                var t;for (t in e) return !1;return !0;
            }, error: function (e) {
                throw Error(e);
            }, parseHTML: function (e, t, n) {
                if (!e || "string" != typeof e) return null;"boolean" == typeof t && (n = t, t = !1), t = t || o;var r = C.exec(e),
                    i = !n && [];return r ? [t.createElement(r[1])] : (r = x.buildFragment([e], t, i), i && x(i).remove(), x.merge([], r.childNodes));
            }, parseJSON: JSON.parse, parseXML: function (e) {
                var t, n;if (!e || "string" != typeof e) return null;try {
                    n = new DOMParser(), t = n.parseFromString(e, "text/xml");
                } catch (r) {
                    t = undefined;
                }return (!t || t.getElementsByTagName("parsererror").length) && x.error("Invalid XML: " + e), t;
            }, noop: function () {}, globalEval: function (e) {
                var t,
                    n = eval;e = x.trim(e), e && (1 === e.indexOf("use strict") ? (t = o.createElement("script"), t.text = e, o.head.appendChild(t).parentNode.removeChild(t)) : n(e));
            }, camelCase: function (e) {
                return e.replace(k, "ms-").replace(N, E);
            }, nodeName: function (e, t) {
                return e.nodeName && e.nodeName.toLowerCase() === t.toLowerCase();
            }, each: function (e, t, n) {
                var r,
                    i = 0,
                    o = e.length,
                    s = j(e);if (n) {
                    if (s) {
                        for (; o > i; i++) if (r = t.apply(e[i], n), r === !1) break;
                    } else for (i in e) if (r = t.apply(e[i], n), r === !1) break;
                } else if (s) {
                    for (; o > i; i++) if (r = t.call(e[i], i, e[i]), r === !1) break;
                } else for (i in e) if (r = t.call(e[i], i, e[i]), r === !1) break;return e;
            }, trim: function (e) {
                return null == e ? "" : v.call(e);
            }, makeArray: function (e, t) {
                var n = t || [];return null != e && (j(Object(e)) ? x.merge(n, "string" == typeof e ? [e] : e) : h.call(n, e)), n;
            }, inArray: function (e, t, n) {
                return null == t ? -1 : g.call(t, e, n);
            }, merge: function (e, t) {
                var n = t.length,
                    r = e.length,
                    i = 0;if ("number" == typeof n) for (; n > i; i++) e[r++] = t[i];else while (t[i] !== undefined) e[r++] = t[i++];return e.length = r, e;
            }, grep: function (e, t, n) {
                var r,
                    i = [],
                    o = 0,
                    s = e.length;for (n = !!n; s > o; o++) r = !!t(e[o], o), n !== r && i.push(e[o]);return i;
            }, map: function (e, t, n) {
                var r,
                    i = 0,
                    o = e.length,
                    s = j(e),
                    a = [];if (s) for (; o > i; i++) r = t(e[i], i, n), null != r && (a[a.length] = r);else for (i in e) r = t(e[i], i, n), null != r && (a[a.length] = r);return p.apply([], a);
            }, guid: 1, proxy: function (e, t) {
                var n, r, i;return "string" == typeof t && (n = e[t], t = e, e = n), x.isFunction(e) ? (r = d.call(arguments, 2), i = function () {
                    return e.apply(t || this, r.concat(d.call(arguments)));
                }, i.guid = e.guid = e.guid || x.guid++, i) : undefined;
            }, access: function (e, t, n, r, i, o, s) {
                var a = 0,
                    u = e.length,
                    l = null == n;if ("object" === x.type(n)) {
                    i = !0;for (a in n) x.access(e, t, a, n[a], !0, o, s);
                } else if (r !== undefined && (i = !0, x.isFunction(r) || (s = !0), l && (s ? (t.call(e, r), t = null) : (l = t, t = function (e, t, n) {
                    return l.call(x(e), n);
                })), t)) for (; u > a; a++) t(e[a], n, s ? r : r.call(e[a], a, t(e[a], n)));return i ? e : l ? t.call(e) : u ? t(e[0], n) : o;
            }, now: Date.now, swap: function (e, t, n, r) {
                var i,
                    o,
                    s = {};for (o in t) s[o] = e.style[o], e.style[o] = t[o];i = n.apply(e, r || []);for (o in t) e.style[o] = s[o];return i;
            } }), x.ready.promise = function (t) {
            return n || (n = x.Deferred(), "complete" === o.readyState ? setTimeout(x.ready) : (o.addEventListener("DOMContentLoaded", S, !1), e.addEventListener("load", S, !1))), n.promise(t);
        }, x.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function (e, t) {
            l["[object " + t + "]"] = t.toLowerCase();
        });function j(e) {
            var t = e.length,
                n = x.type(e);return x.isWindow(e) ? !1 : 1 === e.nodeType && t ? !0 : "array" === n || "function" !== n && (0 === t || "number" == typeof t && t > 0 && t - 1 in e);
        }t = x(o), function (e, undefined) {
            var t,
                n,
                r,
                i,
                o,
                s,
                a,
                u,
                l,
                c,
                f,
                p,
                h,
                d,
                g,
                m,
                y = "sizzle" + -new Date(),
                v = e.document,
                b = {},
                w = 0,
                T = 0,
                C = ot(),
                k = ot(),
                N = ot(),
                E = !1,
                S = function () {
                return 0;
            },
                j = typeof undefined,
                D = 1 << 31,
                A = [],
                L = A.pop,
                q = A.push,
                H = A.push,
                O = A.slice,
                F = A.indexOf || function (e) {
                var t = 0,
                    n = this.length;for (; n > t; t++) if (this[t] === e) return t;return -1;
            },
                P = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",
                R = "[\\x20\\t\\r\\n\\f]",
                M = "(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",
                W = M.replace("w", "w#"),
                $ = "\\[" + R + "*(" + M + ")" + R + "*(?:([*^$|!~]?=)" + R + "*(?:(['\"])((?:\\\\.|[^\\\\])*?)\\3|(" + W + ")|)|)" + R + "*\\]",
                B = ":(" + M + ")(?:\\(((['\"])((?:\\\\.|[^\\\\])*?)\\3|((?:\\\\.|[^\\\\()[\\]]|" + $.replace(3, 8) + ")*)|.*)\\)|)",
                I = RegExp("^" + R + "+|((?:^|[^\\\\])(?:\\\\.)*)" + R + "+$", "g"),
                z = RegExp("^" + R + "*," + R + "*"),
                _ = RegExp("^" + R + "*([>+~]|" + R + ")" + R + "*"),
                X = RegExp(R + "*[+~]"),
                U = RegExp("=" + R + "*([^\\]'\"]*)" + R + "*\\]", "g"),
                Y = RegExp(B),
                V = RegExp("^" + W + "$"),
                G = { ID: RegExp("^#(" + M + ")"), CLASS: RegExp("^\\.(" + M + ")"), TAG: RegExp("^(" + M.replace("w", "w*") + ")"), ATTR: RegExp("^" + $), PSEUDO: RegExp("^" + B), CHILD: RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + R + "*(even|odd|(([+-]|)(\\d*)n|)" + R + "*(?:([+-]|)" + R + "*(\\d+)|))" + R + "*\\)|)", "i"), "boolean": RegExp("^(?:" + P + ")$", "i"), needsContext: RegExp("^" + R + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" + R + "*((?:-\\d)?\\d*)" + R + "*\\)|)(?=[^-]|$)", "i") },
                J = /^[^{]+\{\s*\[native \w/,
                Q = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,
                K = /^(?:input|select|textarea|button)$/i,
                Z = /^h\d$/i,
                et = /'|\\/g,
                tt = /\\([\da-fA-F]{1,6}[\x20\t\r\n\f]?|.)/g,
                nt = function (e, t) {
                var n = "0x" + t - 65536;return n !== n ? t : 0 > n ? String.fromCharCode(n + 65536) : String.fromCharCode(55296 | n >> 10, 56320 | 1023 & n);
            };try {
                H.apply(A = O.call(v.childNodes), v.childNodes), A[v.childNodes.length].nodeType;
            } catch (rt) {
                H = { apply: A.length ? function (e, t) {
                        q.apply(e, O.call(t));
                    } : function (e, t) {
                        var n = e.length,
                            r = 0;while (e[n++] = t[r++]);e.length = n - 1;
                    } };
            }function it(e) {
                return J.test(e + "");
            }function ot() {
                var e,
                    t = [];return e = function (n, i) {
                    return t.push(n += " ") > r.cacheLength && delete e[t.shift()], e[n] = i;
                };
            }function st(e) {
                return e[y] = !0, e;
            }function at(e) {
                var t = c.createElement("div");try {
                    return !!e(t);
                } catch (n) {
                    return !1;
                } finally {
                    t.parentNode && t.parentNode.removeChild(t), t = null;
                }
            }function ut(e, t, n, r) {
                var i, o, s, a, u, f, d, g, x, w;if ((t ? t.ownerDocument || t : v) !== c && l(t), t = t || c, n = n || [], !e || "string" != typeof e) return n;if (1 !== (a = t.nodeType) && 9 !== a) return [];if (p && !r) {
                    if (i = Q.exec(e)) if (s = i[1]) {
                        if (9 === a) {
                            if (o = t.getElementById(s), !o || !o.parentNode) return n;if (o.id === s) return n.push(o), n;
                        } else if (t.ownerDocument && (o = t.ownerDocument.getElementById(s)) && m(t, o) && o.id === s) return n.push(o), n;
                    } else {
                        if (i[2]) return H.apply(n, t.getElementsByTagName(e)), n;if ((s = i[3]) && b.getElementsByClassName && t.getElementsByClassName) return H.apply(n, t.getElementsByClassName(s)), n;
                    }if (b.qsa && (!h || !h.test(e))) {
                        if (g = d = y, x = t, w = 9 === a && e, 1 === a && "object" !== t.nodeName.toLowerCase()) {
                            f = gt(e), (d = t.getAttribute("id")) ? g = d.replace(et, "\\$&") : t.setAttribute("id", g), g = "[id='" + g + "'] ", u = f.length;while (u--) f[u] = g + mt(f[u]);x = X.test(e) && t.parentNode || t, w = f.join(",");
                        }if (w) try {
                            return H.apply(n, x.querySelectorAll(w)), n;
                        } catch (T) {} finally {
                            d || t.removeAttribute("id");
                        }
                    }
                }return kt(e.replace(I, "$1"), t, n, r);
            }o = ut.isXML = function (e) {
                var t = e && (e.ownerDocument || e).documentElement;return t ? "HTML" !== t.nodeName : !1;
            }, l = ut.setDocument = function (e) {
                var t = e ? e.ownerDocument || e : v;return t !== c && 9 === t.nodeType && t.documentElement ? (c = t, f = t.documentElement, p = !o(t), b.getElementsByTagName = at(function (e) {
                    return e.appendChild(t.createComment("")), !e.getElementsByTagName("*").length;
                }), b.attributes = at(function (e) {
                    return e.className = "i", !e.getAttribute("className");
                }), b.getElementsByClassName = at(function (e) {
                    return e.innerHTML = "<div class='a'></div><div class='a i'></div>", e.firstChild.className = "i", 2 === e.getElementsByClassName("i").length;
                }), b.sortDetached = at(function (e) {
                    return 1 & e.compareDocumentPosition(c.createElement("div"));
                }), b.getById = at(function (e) {
                    return f.appendChild(e).id = y, !t.getElementsByName || !t.getElementsByName(y).length;
                }), b.getById ? (r.find.ID = function (e, t) {
                    if (typeof t.getElementById !== j && p) {
                        var n = t.getElementById(e);return n && n.parentNode ? [n] : [];
                    }
                }, r.filter.ID = function (e) {
                    var t = e.replace(tt, nt);return function (e) {
                        return e.getAttribute("id") === t;
                    };
                }) : (r.find.ID = function (e, t) {
                    if (typeof t.getElementById !== j && p) {
                        var n = t.getElementById(e);return n ? n.id === e || typeof n.getAttributeNode !== j && n.getAttributeNode("id").value === e ? [n] : undefined : [];
                    }
                }, r.filter.ID = function (e) {
                    var t = e.replace(tt, nt);return function (e) {
                        var n = typeof e.getAttributeNode !== j && e.getAttributeNode("id");return n && n.value === t;
                    };
                }), r.find.TAG = b.getElementsByTagName ? function (e, t) {
                    return typeof t.getElementsByTagName !== j ? t.getElementsByTagName(e) : undefined;
                } : function (e, t) {
                    var n,
                        r = [],
                        i = 0,
                        o = t.getElementsByTagName(e);if ("*" === e) {
                        while (n = o[i++]) 1 === n.nodeType && r.push(n);return r;
                    }return o;
                }, r.find.CLASS = b.getElementsByClassName && function (e, t) {
                    return typeof t.getElementsByClassName !== j && p ? t.getElementsByClassName(e) : undefined;
                }, d = [], h = [], (b.qsa = it(t.querySelectorAll)) && (at(function (e) {
                    e.innerHTML = "<select><option selected=''></option></select>", e.querySelectorAll("[selected]").length || h.push("\\[" + R + "*(?:value|" + P + ")"), e.querySelectorAll(":checked").length || h.push(":checked");
                }), at(function (e) {
                    var t = c.createElement("input");t.setAttribute("type", "hidden"), e.appendChild(t).setAttribute("t", ""), e.querySelectorAll("[t^='']").length && h.push("[*^$]=" + R + "*(?:''|\"\")"), e.querySelectorAll(":enabled").length || h.push(":enabled", ":disabled"), e.querySelectorAll("*,:x"), h.push(",.*:");
                })), (b.matchesSelector = it(g = f.webkitMatchesSelector || f.mozMatchesSelector || f.oMatchesSelector || f.msMatchesSelector)) && at(function (e) {
                    b.disconnectedMatch = g.call(e, "div"), g.call(e, "[s!='']:x"), d.push("!=", B);
                }), h = h.length && RegExp(h.join("|")), d = d.length && RegExp(d.join("|")), m = it(f.contains) || f.compareDocumentPosition ? function (e, t) {
                    var n = 9 === e.nodeType ? e.documentElement : e,
                        r = t && t.parentNode;return e === r || !(!r || 1 !== r.nodeType || !(n.contains ? n.contains(r) : e.compareDocumentPosition && 16 & e.compareDocumentPosition(r)));
                } : function (e, t) {
                    if (t) while (t = t.parentNode) if (t === e) return !0;return !1;
                }, S = f.compareDocumentPosition ? function (e, n) {
                    if (e === n) return E = !0, 0;var r = n.compareDocumentPosition && e.compareDocumentPosition && e.compareDocumentPosition(n);return r ? 1 & r || !b.sortDetached && n.compareDocumentPosition(e) === r ? e === t || m(v, e) ? -1 : n === t || m(v, n) ? 1 : u ? F.call(u, e) - F.call(u, n) : 0 : 4 & r ? -1 : 1 : e.compareDocumentPosition ? -1 : 1;
                } : function (e, n) {
                    var r,
                        i = 0,
                        o = e.parentNode,
                        s = n.parentNode,
                        a = [e],
                        l = [n];if (e === n) return E = !0, 0;if (!o || !s) return e === t ? -1 : n === t ? 1 : o ? -1 : s ? 1 : u ? F.call(u, e) - F.call(u, n) : 0;if (o === s) return lt(e, n);r = e;while (r = r.parentNode) a.unshift(r);r = n;while (r = r.parentNode) l.unshift(r);while (a[i] === l[i]) i++;return i ? lt(a[i], l[i]) : a[i] === v ? -1 : l[i] === v ? 1 : 0;
                }, c) : c;
            }, ut.matches = function (e, t) {
                return ut(e, null, null, t);
            }, ut.matchesSelector = function (e, t) {
                if ((e.ownerDocument || e) !== c && l(e), t = t.replace(U, "='$1']"), !(!b.matchesSelector || !p || d && d.test(t) || h && h.test(t))) try {
                    var n = g.call(e, t);if (n || b.disconnectedMatch || e.document && 11 !== e.document.nodeType) return n;
                } catch (r) {}return ut(t, c, null, [e]).length > 0;
            }, ut.contains = function (e, t) {
                return (e.ownerDocument || e) !== c && l(e), m(e, t);
            }, ut.attr = function (e, t) {
                (e.ownerDocument || e) !== c && l(e);var n = r.attrHandle[t.toLowerCase()],
                    i = n && n(e, t, !p);return i === undefined ? b.attributes || !p ? e.getAttribute(t) : (i = e.getAttributeNode(t)) && i.specified ? i.value : null : i;
            }, ut.error = function (e) {
                throw Error("Syntax error, unrecognized expression: " + e);
            }, ut.uniqueSort = function (e) {
                var t,
                    n = [],
                    r = 0,
                    i = 0;if (E = !b.detectDuplicates, u = !b.sortStable && e.slice(0), e.sort(S), E) {
                    while (t = e[i++]) t === e[i] && (r = n.push(i));while (r--) e.splice(n[r], 1);
                }return e;
            };function lt(e, t) {
                var n = t && e,
                    r = n && (~t.sourceIndex || D) - (~e.sourceIndex || D);if (r) return r;if (n) while (n = n.nextSibling) if (n === t) return -1;return e ? 1 : -1;
            }function ct(e, t, n) {
                var r;return n ? undefined : (r = e.getAttributeNode(t)) && r.specified ? r.value : e[t] === !0 ? t.toLowerCase() : null;
            }function ft(e, t, n) {
                var r;return n ? undefined : r = e.getAttribute(t, "type" === t.toLowerCase() ? 1 : 2);
            }function pt(e) {
                return function (t) {
                    var n = t.nodeName.toLowerCase();return "input" === n && t.type === e;
                };
            }function ht(e) {
                return function (t) {
                    var n = t.nodeName.toLowerCase();return ("input" === n || "button" === n) && t.type === e;
                };
            }function dt(e) {
                return st(function (t) {
                    return t = +t, st(function (n, r) {
                        var i,
                            o = e([], n.length, t),
                            s = o.length;while (s--) n[i = o[s]] && (n[i] = !(r[i] = n[i]));
                    });
                });
            }i = ut.getText = function (e) {
                var t,
                    n = "",
                    r = 0,
                    o = e.nodeType;if (o) {
                    if (1 === o || 9 === o || 11 === o) {
                        if ("string" == typeof e.textContent) return e.textContent;for (e = e.firstChild; e; e = e.nextSibling) n += i(e);
                    } else if (3 === o || 4 === o) return e.nodeValue;
                } else for (; t = e[r]; r++) n += i(t);return n;
            }, r = ut.selectors = { cacheLength: 50, createPseudo: st, match: G, attrHandle: {}, find: {}, relative: { ">": { dir: "parentNode", first: !0 }, " ": { dir: "parentNode" }, "+": { dir: "previousSibling", first: !0 }, "~": { dir: "previousSibling" } }, preFilter: { ATTR: function (e) {
                        return e[1] = e[1].replace(tt, nt), e[3] = (e[4] || e[5] || "").replace(tt, nt), "~=" === e[2] && (e[3] = " " + e[3] + " "), e.slice(0, 4);
                    }, CHILD: function (e) {
                        return e[1] = e[1].toLowerCase(), "nth" === e[1].slice(0, 3) ? (e[3] || ut.error(e[0]), e[4] = +(e[4] ? e[5] + (e[6] || 1) : 2 * ("even" === e[3] || "odd" === e[3])), e[5] = +(e[7] + e[8] || "odd" === e[3])) : e[3] && ut.error(e[0]), e;
                    }, PSEUDO: function (e) {
                        var t,
                            n = !e[5] && e[2];return G.CHILD.test(e[0]) ? null : (e[4] ? e[2] = e[4] : n && Y.test(n) && (t = gt(n, !0)) && (t = n.indexOf(")", n.length - t) - n.length) && (e[0] = e[0].slice(0, t), e[2] = n.slice(0, t)), e.slice(0, 3));
                    } }, filter: { TAG: function (e) {
                        var t = e.replace(tt, nt).toLowerCase();return "*" === e ? function () {
                            return !0;
                        } : function (e) {
                            return e.nodeName && e.nodeName.toLowerCase() === t;
                        };
                    }, CLASS: function (e) {
                        var t = C[e + " "];return t || (t = RegExp("(^|" + R + ")" + e + "(" + R + "|$)")) && C(e, function (e) {
                            return t.test("string" == typeof e.className && e.className || typeof e.getAttribute !== j && e.getAttribute("class") || "");
                        });
                    }, ATTR: function (e, t, n) {
                        return function (r) {
                            var i = ut.attr(r, e);return null == i ? "!=" === t : t ? (i += "", "=" === t ? i === n : "!=" === t ? i !== n : "^=" === t ? n && 0 === i.indexOf(n) : "*=" === t ? n && i.indexOf(n) > -1 : "$=" === t ? n && i.slice(-n.length) === n : "~=" === t ? (" " + i + " ").indexOf(n) > -1 : "|=" === t ? i === n || i.slice(0, n.length + 1) === n + "-" : !1) : !0;
                        };
                    }, CHILD: function (e, t, n, r, i) {
                        var o = "nth" !== e.slice(0, 3),
                            s = "last" !== e.slice(-4),
                            a = "of-type" === t;return 1 === r && 0 === i ? function (e) {
                            return !!e.parentNode;
                        } : function (t, n, u) {
                            var l,
                                c,
                                f,
                                p,
                                h,
                                d,
                                g = o !== s ? "nextSibling" : "previousSibling",
                                m = t.parentNode,
                                v = a && t.nodeName.toLowerCase(),
                                x = !u && !a;if (m) {
                                if (o) {
                                    while (g) {
                                        f = t;while (f = f[g]) if (a ? f.nodeName.toLowerCase() === v : 1 === f.nodeType) return !1;d = g = "only" === e && !d && "nextSibling";
                                    }return !0;
                                }if (d = [s ? m.firstChild : m.lastChild], s && x) {
                                    c = m[y] || (m[y] = {}), l = c[e] || [], h = l[0] === w && l[1], p = l[0] === w && l[2], f = h && m.childNodes[h];while (f = ++h && f && f[g] || (p = h = 0) || d.pop()) if (1 === f.nodeType && ++p && f === t) {
                                        c[e] = [w, h, p];break;
                                    }
                                } else if (x && (l = (t[y] || (t[y] = {}))[e]) && l[0] === w) p = l[1];else while (f = ++h && f && f[g] || (p = h = 0) || d.pop()) if ((a ? f.nodeName.toLowerCase() === v : 1 === f.nodeType) && ++p && (x && ((f[y] || (f[y] = {}))[e] = [w, p]), f === t)) break;return p -= i, p === r || 0 === p % r && p / r >= 0;
                            }
                        };
                    }, PSEUDO: function (e, t) {
                        var n,
                            i = r.pseudos[e] || r.setFilters[e.toLowerCase()] || ut.error("unsupported pseudo: " + e);return i[y] ? i(t) : i.length > 1 ? (n = [e, e, "", t], r.setFilters.hasOwnProperty(e.toLowerCase()) ? st(function (e, n) {
                            var r,
                                o = i(e, t),
                                s = o.length;while (s--) r = F.call(e, o[s]), e[r] = !(n[r] = o[s]);
                        }) : function (e) {
                            return i(e, 0, n);
                        }) : i;
                    } }, pseudos: { not: st(function (e) {
                        var t = [],
                            n = [],
                            r = s(e.replace(I, "$1"));return r[y] ? st(function (e, t, n, i) {
                            var o,
                                s = r(e, null, i, []),
                                a = e.length;while (a--) (o = s[a]) && (e[a] = !(t[a] = o));
                        }) : function (e, i, o) {
                            return t[0] = e, r(t, null, o, n), !n.pop();
                        };
                    }), has: st(function (e) {
                        return function (t) {
                            return ut(e, t).length > 0;
                        };
                    }), contains: st(function (e) {
                        return function (t) {
                            return (t.textContent || t.innerText || i(t)).indexOf(e) > -1;
                        };
                    }), lang: st(function (e) {
                        return V.test(e || "") || ut.error("unsupported lang: " + e), e = e.replace(tt, nt).toLowerCase(), function (t) {
                            var n;do if (n = p ? t.lang : t.getAttribute("xml:lang") || t.getAttribute("lang")) return n = n.toLowerCase(), n === e || 0 === n.indexOf(e + "-"); while ((t = t.parentNode) && 1 === t.nodeType);return !1;
                        };
                    }), target: function (t) {
                        var n = e.location && e.location.hash;return n && n.slice(1) === t.id;
                    }, root: function (e) {
                        return e === f;
                    }, focus: function (e) {
                        return e === c.activeElement && (!c.hasFocus || c.hasFocus()) && !!(e.type || e.href || ~e.tabIndex);
                    }, enabled: function (e) {
                        return e.disabled === !1;
                    }, disabled: function (e) {
                        return e.disabled === !0;
                    }, checked: function (e) {
                        var t = e.nodeName.toLowerCase();return "input" === t && !!e.checked || "option" === t && !!e.selected;
                    }, selected: function (e) {
                        return e.parentNode && e.parentNode.selectedIndex, e.selected === !0;
                    }, empty: function (e) {
                        for (e = e.firstChild; e; e = e.nextSibling) if (e.nodeName > "@" || 3 === e.nodeType || 4 === e.nodeType) return !1;return !0;
                    }, parent: function (e) {
                        return !r.pseudos.empty(e);
                    }, header: function (e) {
                        return Z.test(e.nodeName);
                    }, input: function (e) {
                        return K.test(e.nodeName);
                    }, button: function (e) {
                        var t = e.nodeName.toLowerCase();return "input" === t && "button" === e.type || "button" === t;
                    }, text: function (e) {
                        var t;return "input" === e.nodeName.toLowerCase() && "text" === e.type && (null == (t = e.getAttribute("type")) || t.toLowerCase() === e.type);
                    }, first: dt(function () {
                        return [0];
                    }), last: dt(function (e, t) {
                        return [t - 1];
                    }), eq: dt(function (e, t, n) {
                        return [0 > n ? n + t : n];
                    }), even: dt(function (e, t) {
                        var n = 0;for (; t > n; n += 2) e.push(n);return e;
                    }), odd: dt(function (e, t) {
                        var n = 1;for (; t > n; n += 2) e.push(n);return e;
                    }), lt: dt(function (e, t, n) {
                        var r = 0 > n ? n + t : n;for (; --r >= 0;) e.push(r);return e;
                    }), gt: dt(function (e, t, n) {
                        var r = 0 > n ? n + t : n;for (; t > ++r;) e.push(r);return e;
                    }) } };for (t in { radio: !0, checkbox: !0, file: !0, password: !0, image: !0 }) r.pseudos[t] = pt(t);for (t in { submit: !0, reset: !0 }) r.pseudos[t] = ht(t);function gt(e, t) {
                var n,
                    i,
                    o,
                    s,
                    a,
                    u,
                    l,
                    c = k[e + " "];if (c) return t ? 0 : c.slice(0);a = e, u = [], l = r.preFilter;while (a) {
                    (!n || (i = z.exec(a))) && (i && (a = a.slice(i[0].length) || a), u.push(o = [])), n = !1, (i = _.exec(a)) && (n = i.shift(), o.push({ value: n, type: i[0].replace(I, " ") }), a = a.slice(n.length));for (s in r.filter) !(i = G[s].exec(a)) || l[s] && !(i = l[s](i)) || (n = i.shift(), o.push({ value: n, type: s, matches: i }), a = a.slice(n.length));if (!n) break;
                }return t ? a.length : a ? ut.error(e) : k(e, u).slice(0);
            }function mt(e) {
                var t = 0,
                    n = e.length,
                    r = "";for (; n > t; t++) r += e[t].value;return r;
            }function yt(e, t, r) {
                var i = t.dir,
                    o = r && "parentNode" === i,
                    s = T++;return t.first ? function (t, n, r) {
                    while (t = t[i]) if (1 === t.nodeType || o) return e(t, n, r);
                } : function (t, r, a) {
                    var u,
                        l,
                        c,
                        f = w + " " + s;if (a) {
                        while (t = t[i]) if ((1 === t.nodeType || o) && e(t, r, a)) return !0;
                    } else while (t = t[i]) if (1 === t.nodeType || o) if (c = t[y] || (t[y] = {}), (l = c[i]) && l[0] === f) {
                        if ((u = l[1]) === !0 || u === n) return u === !0;
                    } else if (l = c[i] = [f], l[1] = e(t, r, a) || n, l[1] === !0) return !0;
                };
            }function vt(e) {
                return e.length > 1 ? function (t, n, r) {
                    var i = e.length;while (i--) if (!e[i](t, n, r)) return !1;return !0;
                } : e[0];
            }function xt(e, t, n, r, i) {
                var o,
                    s = [],
                    a = 0,
                    u = e.length,
                    l = null != t;for (; u > a; a++) (o = e[a]) && (!n || n(o, r, i)) && (s.push(o), l && t.push(a));return s;
            }function bt(e, t, n, r, i, o) {
                return r && !r[y] && (r = bt(r)), i && !i[y] && (i = bt(i, o)), st(function (o, s, a, u) {
                    var l,
                        c,
                        f,
                        p = [],
                        h = [],
                        d = s.length,
                        g = o || Ct(t || "*", a.nodeType ? [a] : a, []),
                        m = !e || !o && t ? g : xt(g, p, e, a, u),
                        y = n ? i || (o ? e : d || r) ? [] : s : m;if (n && n(m, y, a, u), r) {
                        l = xt(y, h), r(l, [], a, u), c = l.length;while (c--) (f = l[c]) && (y[h[c]] = !(m[h[c]] = f));
                    }if (o) {
                        if (i || e) {
                            if (i) {
                                l = [], c = y.length;while (c--) (f = y[c]) && l.push(m[c] = f);i(null, y = [], l, u);
                            }c = y.length;while (c--) (f = y[c]) && (l = i ? F.call(o, f) : p[c]) > -1 && (o[l] = !(s[l] = f));
                        }
                    } else y = xt(y === s ? y.splice(d, y.length) : y), i ? i(null, s, y, u) : H.apply(s, y);
                });
            }function wt(e) {
                var t,
                    n,
                    i,
                    o = e.length,
                    s = r.relative[e[0].type],
                    u = s || r.relative[" "],
                    l = s ? 1 : 0,
                    c = yt(function (e) {
                    return e === t;
                }, u, !0),
                    f = yt(function (e) {
                    return F.call(t, e) > -1;
                }, u, !0),
                    p = [function (e, n, r) {
                    return !s && (r || n !== a) || ((t = n).nodeType ? c(e, n, r) : f(e, n, r));
                }];for (; o > l; l++) if (n = r.relative[e[l].type]) p = [yt(vt(p), n)];else {
                    if (n = r.filter[e[l].type].apply(null, e[l].matches), n[y]) {
                        for (i = ++l; o > i; i++) if (r.relative[e[i].type]) break;return bt(l > 1 && vt(p), l > 1 && mt(e.slice(0, l - 1)).replace(I, "$1"), n, i > l && wt(e.slice(l, i)), o > i && wt(e = e.slice(i)), o > i && mt(e));
                    }p.push(n);
                }return vt(p);
            }function Tt(e, t) {
                var i = 0,
                    o = t.length > 0,
                    s = e.length > 0,
                    u = function (u, l, f, p, h) {
                    var d,
                        g,
                        m,
                        y = [],
                        v = 0,
                        x = "0",
                        b = u && [],
                        T = null != h,
                        C = a,
                        k = u || s && r.find.TAG("*", h && l.parentNode || l),
                        N = w += null == C ? 1 : Math.random() || .1;for (T && (a = l !== c && l, n = i); null != (d = k[x]); x++) {
                        if (s && d) {
                            g = 0;while (m = e[g++]) if (m(d, l, f)) {
                                p.push(d);break;
                            }T && (w = N, n = ++i);
                        }o && ((d = !m && d) && v--, u && b.push(d));
                    }if (v += x, o && x !== v) {
                        g = 0;while (m = t[g++]) m(b, y, l, f);if (u) {
                            if (v > 0) while (x--) b[x] || y[x] || (y[x] = L.call(p));y = xt(y);
                        }H.apply(p, y), T && !u && y.length > 0 && v + t.length > 1 && ut.uniqueSort(p);
                    }return T && (w = N, a = C), b;
                };return o ? st(u) : u;
            }s = ut.compile = function (e, t) {
                var n,
                    r = [],
                    i = [],
                    o = N[e + " "];if (!o) {
                    t || (t = gt(e)), n = t.length;while (n--) o = wt(t[n]), o[y] ? r.push(o) : i.push(o);o = N(e, Tt(i, r));
                }return o;
            };function Ct(e, t, n) {
                var r = 0,
                    i = t.length;for (; i > r; r++) ut(e, t[r], n);return n;
            }function kt(e, t, n, i) {
                var o,
                    a,
                    u,
                    l,
                    c,
                    f = gt(e);if (!i && 1 === f.length) {
                    if (a = f[0] = f[0].slice(0), a.length > 2 && "ID" === (u = a[0]).type && 9 === t.nodeType && p && r.relative[a[1].type]) {
                        if (t = (r.find.ID(u.matches[0].replace(tt, nt), t) || [])[0], !t) return n;e = e.slice(a.shift().value.length);
                    }o = G.needsContext.test(e) ? 0 : a.length;while (o--) {
                        if (u = a[o], r.relative[l = u.type]) break;if ((c = r.find[l]) && (i = c(u.matches[0].replace(tt, nt), X.test(a[0].type) && t.parentNode || t))) {
                            if (a.splice(o, 1), e = i.length && mt(a), !e) return H.apply(n, i), n;break;
                        }
                    }
                }return s(e, f)(i, t, !p, n, X.test(e)), n;
            }r.pseudos.nth = r.pseudos.eq;function Nt() {}Nt.prototype = r.filters = r.pseudos, r.setFilters = new Nt(), b.sortStable = y.split("").sort(S).join("") === y, l(), [0, 0].sort(S), b.detectDuplicates = E, at(function (e) {
                if (e.innerHTML = "<a href='#'></a>", "#" !== e.firstChild.getAttribute("href")) {
                    var t = "type|href|height|width".split("|"),
                        n = t.length;while (n--) r.attrHandle[t[n]] = ft;
                }
            }), at(function (e) {
                if (null != e.getAttribute("disabled")) {
                    var t = P.split("|"),
                        n = t.length;while (n--) r.attrHandle[t[n]] = ct;
                }
            }), x.find = ut, x.expr = ut.selectors, x.expr[":"] = x.expr.pseudos, x.unique = ut.uniqueSort, x.text = ut.getText, x.isXMLDoc = ut.isXML, x.contains = ut.contains;
        }(e);var D = {};function A(e) {
            var t = D[e] = {};return x.each(e.match(w) || [], function (e, n) {
                t[n] = !0;
            }), t;
        }x.Callbacks = function (e) {
            e = "string" == typeof e ? D[e] || A(e) : x.extend({}, e);var t,
                n,
                r,
                i,
                o,
                s,
                a = [],
                u = !e.once && [],
                l = function (f) {
                for (t = e.memory && f, n = !0, s = i || 0, i = 0, o = a.length, r = !0; a && o > s; s++) if (a[s].apply(f[0], f[1]) === !1 && e.stopOnFalse) {
                    t = !1;break;
                }r = !1, a && (u ? u.length && l(u.shift()) : t ? a = [] : c.disable());
            },
                c = { add: function () {
                    if (a) {
                        var n = a.length;(function s(t) {
                            x.each(t, function (t, n) {
                                var r = x.type(n);"function" === r ? e.unique && c.has(n) || a.push(n) : n && n.length && "string" !== r && s(n);
                            });
                        })(arguments), r ? o = a.length : t && (i = n, l(t));
                    }return this;
                }, remove: function () {
                    return a && x.each(arguments, function (e, t) {
                        var n;while ((n = x.inArray(t, a, n)) > -1) a.splice(n, 1), r && (o >= n && o--, s >= n && s--);
                    }), this;
                }, has: function (e) {
                    return e ? x.inArray(e, a) > -1 : !(!a || !a.length);
                }, empty: function () {
                    return a = [], o = 0, this;
                }, disable: function () {
                    return a = u = t = undefined, this;
                }, disabled: function () {
                    return !a;
                }, lock: function () {
                    return u = undefined, t || c.disable(), this;
                }, locked: function () {
                    return !u;
                }, fireWith: function (e, t) {
                    return t = t || [], t = [e, t.slice ? t.slice() : t], !a || n && !u || (r ? u.push(t) : l(t)), this;
                }, fire: function () {
                    return c.fireWith(this, arguments), this;
                }, fired: function () {
                    return !!n;
                } };return c;
        }, x.extend({ Deferred: function (e) {
                var t = [["resolve", "done", x.Callbacks("once memory"), "resolved"], ["reject", "fail", x.Callbacks("once memory"), "rejected"], ["notify", "progress", x.Callbacks("memory")]],
                    n = "pending",
                    r = { state: function () {
                        return n;
                    }, always: function () {
                        return i.done(arguments).fail(arguments), this;
                    }, then: function () {
                        var e = arguments;return x.Deferred(function (n) {
                            x.each(t, function (t, o) {
                                var s = o[0],
                                    a = x.isFunction(e[t]) && e[t];i[o[1]](function () {
                                    var e = a && a.apply(this, arguments);e && x.isFunction(e.promise) ? e.promise().done(n.resolve).fail(n.reject).progress(n.notify) : n[s + "With"](this === r ? n.promise() : this, a ? [e] : arguments);
                                });
                            }), e = null;
                        }).promise();
                    }, promise: function (e) {
                        return null != e ? x.extend(e, r) : r;
                    } },
                    i = {};return r.pipe = r.then, x.each(t, function (e, o) {
                    var s = o[2],
                        a = o[3];r[o[1]] = s.add, a && s.add(function () {
                        n = a;
                    }, t[1 ^ e][2].disable, t[2][2].lock), i[o[0]] = function () {
                        return i[o[0] + "With"](this === i ? r : this, arguments), this;
                    }, i[o[0] + "With"] = s.fireWith;
                }), r.promise(i), e && e.call(i, i), i;
            }, when: function (e) {
                var t = 0,
                    n = d.call(arguments),
                    r = n.length,
                    i = 1 !== r || e && x.isFunction(e.promise) ? r : 0,
                    o = 1 === i ? e : x.Deferred(),
                    s = function (e, t, n) {
                    return function (r) {
                        t[e] = this, n[e] = arguments.length > 1 ? d.call(arguments) : r, n === a ? o.notifyWith(t, n) : --i || o.resolveWith(t, n);
                    };
                },
                    a,
                    u,
                    l;if (r > 1) for (a = Array(r), u = Array(r), l = Array(r); r > t; t++) n[t] && x.isFunction(n[t].promise) ? n[t].promise().done(s(t, l, n)).fail(o.reject).progress(s(t, u, a)) : --i;return i || o.resolveWith(l, n), o.promise();
            } }), x.support = function (t) {
            var n = o.createElement("input"),
                r = o.createDocumentFragment(),
                i = o.createElement("div"),
                s = o.createElement("select"),
                a = s.appendChild(o.createElement("option"));return n.type ? (n.type = "checkbox", t.checkOn = "" !== n.value, t.optSelected = a.selected, t.reliableMarginRight = !0, t.boxSizingReliable = !0, t.pixelPosition = !1, n.checked = !0, t.noCloneChecked = n.cloneNode(!0).checked, s.disabled = !0, t.optDisabled = !a.disabled, n = o.createElement("input"), n.value = "t", n.type = "radio", t.radioValue = "t" === n.value, n.setAttribute("checked", "t"), n.setAttribute("name", "t"), r.appendChild(n), t.checkClone = r.cloneNode(!0).cloneNode(!0).lastChild.checked, t.focusinBubbles = "onfocusin" in e, i.style.backgroundClip = "content-box", i.cloneNode(!0).style.backgroundClip = "", t.clearCloneStyle = "content-box" === i.style.backgroundClip, x(function () {
                var n,
                    r,
                    s = "padding:0;margin:0;border:0;display:block;-webkit-box-sizing:content-box;-moz-box-sizing:content-box;box-sizing:content-box",
                    a = o.getElementsByTagName("body")[0];a && (n = o.createElement("div"), n.style.cssText = "border:0;width:0;height:0;position:absolute;top:0;left:-9999px;margin-top:1px", a.appendChild(n).appendChild(i), i.innerHTML = "", i.style.cssText = "-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;padding:1px;border:1px;display:block;width:4px;margin-top:1%;position:absolute;top:1%", x.swap(a, null != a.style.zoom ? { zoom: 1 } : {}, function () {
                    t.boxSizing = 4 === i.offsetWidth;
                }), e.getComputedStyle && (t.pixelPosition = "1%" !== (e.getComputedStyle(i, null) || {}).top, t.boxSizingReliable = "4px" === (e.getComputedStyle(i, null) || { width: "4px" }).width, r = i.appendChild(o.createElement("div")), r.style.cssText = i.style.cssText = s, r.style.marginRight = r.style.width = "0", i.style.width = "1px", t.reliableMarginRight = !parseFloat((e.getComputedStyle(r, null) || {}).marginRight)), a.removeChild(n));
            }), t) : t;
        }({});var L,
            q,
            H = /(?:\{[\s\S]*\}|\[[\s\S]*\])$/,
            O = /([A-Z])/g;function F() {
            Object.defineProperty(this.cache = {}, 0, { get: function () {
                    return {};
                } }), this.expando = x.expando + Math.random();
        }F.uid = 1, F.accepts = function (e) {
            return e.nodeType ? 1 === e.nodeType || 9 === e.nodeType : !0;
        }, F.prototype = { key: function (e) {
                if (!F.accepts(e)) return 0;var t = {},
                    n = e[this.expando];if (!n) {
                    n = F.uid++;try {
                        t[this.expando] = { value: n }, Object.defineProperties(e, t);
                    } catch (r) {
                        t[this.expando] = n, x.extend(e, t);
                    }
                }return this.cache[n] || (this.cache[n] = {}), n;
            }, set: function (e, t, n) {
                var r,
                    i = this.key(e),
                    o = this.cache[i];if ("string" == typeof t) o[t] = n;else if (x.isEmptyObject(o)) this.cache[i] = t;else for (r in t) o[r] = t[r];
            }, get: function (e, t) {
                var n = this.cache[this.key(e)];return t === undefined ? n : n[t];
            }, access: function (e, t, n) {
                return t === undefined || t && "string" == typeof t && n === undefined ? this.get(e, t) : (this.set(e, t, n), n !== undefined ? n : t);
            }, remove: function (e, t) {
                var n,
                    r,
                    i = this.key(e),
                    o = this.cache[i];if (t === undefined) this.cache[i] = {};else {
                    x.isArray(t) ? r = t.concat(t.map(x.camelCase)) : t in o ? r = [t] : (r = x.camelCase(t), r = r in o ? [r] : r.match(w) || []), n = r.length;while (n--) delete o[r[n]];
                }
            }, hasData: function (e) {
                return !x.isEmptyObject(this.cache[e[this.expando]] || {});
            }, discard: function (e) {
                delete this.cache[this.key(e)];
            } }, L = new F(), q = new F(), x.extend({ acceptData: F.accepts, hasData: function (e) {
                return L.hasData(e) || q.hasData(e);
            }, data: function (e, t, n) {
                return L.access(e, t, n);
            }, removeData: function (e, t) {
                L.remove(e, t);
            }, _data: function (e, t, n) {
                return q.access(e, t, n);
            }, _removeData: function (e, t) {
                q.remove(e, t);
            } }), x.fn.extend({ data: function (e, t) {
                var n,
                    r,
                    i = this[0],
                    o = 0,
                    s = null;if (e === undefined) {
                    if (this.length && (s = L.get(i), 1 === i.nodeType && !q.get(i, "hasDataAttrs"))) {
                        for (n = i.attributes; n.length > o; o++) r = n[o].name, 0 === r.indexOf("data-") && (r = x.camelCase(r.substring(5)), P(i, r, s[r]));q.set(i, "hasDataAttrs", !0);
                    }return s;
                }return "object" == typeof e ? this.each(function () {
                    L.set(this, e);
                }) : x.access(this, function (t) {
                    var n,
                        r = x.camelCase(e);if (i && t === undefined) {
                        if (n = L.get(i, e), n !== undefined) return n;if (n = L.get(i, r), n !== undefined) return n;if (n = P(i, r, undefined), n !== undefined) return n;
                    } else this.each(function () {
                        var n = L.get(this, r);L.set(this, r, t), -1 !== e.indexOf("-") && n !== undefined && L.set(this, e, t);
                    });
                }, null, t, arguments.length > 1, null, !0);
            }, removeData: function (e) {
                return this.each(function () {
                    L.remove(this, e);
                });
            } });function P(e, t, n) {
            var r;if (n === undefined && 1 === e.nodeType) if (r = "data-" + t.replace(O, "-$1").toLowerCase(), n = e.getAttribute(r), "string" == typeof n) {
                try {
                    n = "true" === n ? !0 : "false" === n ? !1 : "null" === n ? null : +n + "" === n ? +n : H.test(n) ? JSON.parse(n) : n;
                } catch (i) {}L.set(e, t, n);
            } else n = undefined;return n;
        }x.extend({ queue: function (e, t, n) {
                var r;return e ? (t = (t || "fx") + "queue", r = q.get(e, t), n && (!r || x.isArray(n) ? r = q.access(e, t, x.makeArray(n)) : r.push(n)), r || []) : undefined;
            }, dequeue: function (e, t) {
                t = t || "fx";var n = x.queue(e, t),
                    r = n.length,
                    i = n.shift(),
                    o = x._queueHooks(e, t),
                    s = function () {
                    x.dequeue(e, t);
                };"inprogress" === i && (i = n.shift(), r--), o.cur = i, i && ("fx" === t && n.unshift("inprogress"), delete o.stop, i.call(e, s, o)), !r && o && o.empty.fire();
            }, _queueHooks: function (e, t) {
                var n = t + "queueHooks";return q.get(e, n) || q.access(e, n, { empty: x.Callbacks("once memory").add(function () {
                        q.remove(e, [t + "queue", n]);
                    }) });
            } }), x.fn.extend({ queue: function (e, t) {
                var n = 2;return "string" != typeof e && (t = e, e = "fx", n--), n > arguments.length ? x.queue(this[0], e) : t === undefined ? this : this.each(function () {
                    var n = x.queue(this, e, t);
                    x._queueHooks(this, e), "fx" === e && "inprogress" !== n[0] && x.dequeue(this, e);
                });
            }, dequeue: function (e) {
                return this.each(function () {
                    x.dequeue(this, e);
                });
            }, delay: function (e, t) {
                return e = x.fx ? x.fx.speeds[e] || e : e, t = t || "fx", this.queue(t, function (t, n) {
                    var r = setTimeout(t, e);n.stop = function () {
                        clearTimeout(r);
                    };
                });
            }, clearQueue: function (e) {
                return this.queue(e || "fx", []);
            }, promise: function (e, t) {
                var n,
                    r = 1,
                    i = x.Deferred(),
                    o = this,
                    s = this.length,
                    a = function () {
                    --r || i.resolveWith(o, [o]);
                };"string" != typeof e && (t = e, e = undefined), e = e || "fx";while (s--) n = q.get(o[s], e + "queueHooks"), n && n.empty && (r++, n.empty.add(a));return a(), i.promise(t);
            } });var R,
            M,
            W = /[\t\r\n]/g,
            $ = /\r/g,
            B = /^(?:input|select|textarea|button)$/i;x.fn.extend({ attr: function (e, t) {
                return x.access(this, x.attr, e, t, arguments.length > 1);
            }, removeAttr: function (e) {
                return this.each(function () {
                    x.removeAttr(this, e);
                });
            }, prop: function (e, t) {
                return x.access(this, x.prop, e, t, arguments.length > 1);
            }, removeProp: function (e) {
                return this.each(function () {
                    delete this[x.propFix[e] || e];
                });
            }, addClass: function (e) {
                var t,
                    n,
                    r,
                    i,
                    o,
                    s = 0,
                    a = this.length,
                    u = "string" == typeof e && e;if (x.isFunction(e)) return this.each(function (t) {
                    x(this).addClass(e.call(this, t, this.className));
                });if (u) for (t = (e || "").match(w) || []; a > s; s++) if (n = this[s], r = 1 === n.nodeType && (n.className ? (" " + n.className + " ").replace(W, " ") : " ")) {
                    o = 0;while (i = t[o++]) 0 > r.indexOf(" " + i + " ") && (r += i + " ");n.className = x.trim(r);
                }return this;
            }, removeClass: function (e) {
                var t,
                    n,
                    r,
                    i,
                    o,
                    s = 0,
                    a = this.length,
                    u = 0 === arguments.length || "string" == typeof e && e;if (x.isFunction(e)) return this.each(function (t) {
                    x(this).removeClass(e.call(this, t, this.className));
                });if (u) for (t = (e || "").match(w) || []; a > s; s++) if (n = this[s], r = 1 === n.nodeType && (n.className ? (" " + n.className + " ").replace(W, " ") : "")) {
                    o = 0;while (i = t[o++]) while (r.indexOf(" " + i + " ") >= 0) r = r.replace(" " + i + " ", " ");n.className = e ? x.trim(r) : "";
                }return this;
            }, toggleClass: function (e, t) {
                var n = typeof e,
                    i = "boolean" == typeof t;return x.isFunction(e) ? this.each(function (n) {
                    x(this).toggleClass(e.call(this, n, this.className, t), t);
                }) : this.each(function () {
                    if ("string" === n) {
                        var o,
                            s = 0,
                            a = x(this),
                            u = t,
                            l = e.match(w) || [];while (o = l[s++]) u = i ? u : !a.hasClass(o), a[u ? "addClass" : "removeClass"](o);
                    } else (n === r || "boolean" === n) && (this.className && q.set(this, "__className__", this.className), this.className = this.className || e === !1 ? "" : q.get(this, "__className__") || "");
                });
            }, hasClass: function (e) {
                var t = " " + e + " ",
                    n = 0,
                    r = this.length;for (; r > n; n++) if (1 === this[n].nodeType && (" " + this[n].className + " ").replace(W, " ").indexOf(t) >= 0) return !0;return !1;
            }, val: function (e) {
                var t,
                    n,
                    r,
                    i = this[0];{
                    if (arguments.length) return r = x.isFunction(e), this.each(function (n) {
                        var i,
                            o = x(this);1 === this.nodeType && (i = r ? e.call(this, n, o.val()) : e, null == i ? i = "" : "number" == typeof i ? i += "" : x.isArray(i) && (i = x.map(i, function (e) {
                            return null == e ? "" : e + "";
                        })), t = x.valHooks[this.type] || x.valHooks[this.nodeName.toLowerCase()], t && "set" in t && t.set(this, i, "value") !== undefined || (this.value = i));
                    });if (i) return t = x.valHooks[i.type] || x.valHooks[i.nodeName.toLowerCase()], t && "get" in t && (n = t.get(i, "value")) !== undefined ? n : (n = i.value, "string" == typeof n ? n.replace($, "") : null == n ? "" : n);
                }
            } }), x.extend({ valHooks: { option: { get: function (e) {
                        var t = e.attributes.value;return !t || t.specified ? e.value : e.text;
                    } }, select: { get: function (e) {
                        var t,
                            n,
                            r = e.options,
                            i = e.selectedIndex,
                            o = "select-one" === e.type || 0 > i,
                            s = o ? null : [],
                            a = o ? i + 1 : r.length,
                            u = 0 > i ? a : o ? i : 0;for (; a > u; u++) if (n = r[u], !(!n.selected && u !== i || (x.support.optDisabled ? n.disabled : null !== n.getAttribute("disabled")) || n.parentNode.disabled && x.nodeName(n.parentNode, "optgroup"))) {
                            if (t = x(n).val(), o) return t;s.push(t);
                        }return s;
                    }, set: function (e, t) {
                        var n,
                            r,
                            i = e.options,
                            o = x.makeArray(t),
                            s = i.length;while (s--) r = i[s], (r.selected = x.inArray(x(r).val(), o) >= 0) && (n = !0);return n || (e.selectedIndex = -1), o;
                    } } }, attr: function (e, t, n) {
                var i,
                    o,
                    s = e.nodeType;if (e && 3 !== s && 8 !== s && 2 !== s) return typeof e.getAttribute === r ? x.prop(e, t, n) : (1 === s && x.isXMLDoc(e) || (t = t.toLowerCase(), i = x.attrHooks[t] || (x.expr.match.boolean.test(t) ? M : R)), n === undefined ? i && "get" in i && null !== (o = i.get(e, t)) ? o : (o = x.find.attr(e, t), null == o ? undefined : o) : null !== n ? i && "set" in i && (o = i.set(e, n, t)) !== undefined ? o : (e.setAttribute(t, n + ""), n) : (x.removeAttr(e, t), undefined));
            }, removeAttr: function (e, t) {
                var n,
                    r,
                    i = 0,
                    o = t && t.match(w);if (o && 1 === e.nodeType) while (n = o[i++]) r = x.propFix[n] || n, x.expr.match.boolean.test(n) && (e[r] = !1), e.removeAttribute(n);
            }, attrHooks: { type: { set: function (e, t) {
                        if (!x.support.radioValue && "radio" === t && x.nodeName(e, "input")) {
                            var n = e.value;return e.setAttribute("type", t), n && (e.value = n), t;
                        }
                    } } }, propFix: { "for": "htmlFor", "class": "className" }, prop: function (e, t, n) {
                var r,
                    i,
                    o,
                    s = e.nodeType;if (e && 3 !== s && 8 !== s && 2 !== s) return o = 1 !== s || !x.isXMLDoc(e), o && (t = x.propFix[t] || t, i = x.propHooks[t]), n !== undefined ? i && "set" in i && (r = i.set(e, n, t)) !== undefined ? r : e[t] = n : i && "get" in i && null !== (r = i.get(e, t)) ? r : e[t];
            }, propHooks: { tabIndex: { get: function (e) {
                        return e.hasAttribute("tabindex") || B.test(e.nodeName) || e.href ? e.tabIndex : -1;
                    } } } }), M = { set: function (e, t, n) {
                return t === !1 ? x.removeAttr(e, n) : e.setAttribute(n, n), n;
            } }, x.each(x.expr.match.boolean.source.match(/\w+/g), function (e, t) {
            var n = x.expr.attrHandle[t] || x.find.attr;x.expr.attrHandle[t] = function (e, t, r) {
                var i = x.expr.attrHandle[t],
                    o = r ? undefined : (x.expr.attrHandle[t] = undefined) != n(e, t, r) ? t.toLowerCase() : null;return x.expr.attrHandle[t] = i, o;
            };
        }), x.support.optSelected || (x.propHooks.selected = { get: function (e) {
                var t = e.parentNode;return t && t.parentNode && t.parentNode.selectedIndex, null;
            } }), x.each(["tabIndex", "readOnly", "maxLength", "cellSpacing", "cellPadding", "rowSpan", "colSpan", "useMap", "frameBorder", "contentEditable"], function () {
            x.propFix[this.toLowerCase()] = this;
        }), x.each(["radio", "checkbox"], function () {
            x.valHooks[this] = { set: function (e, t) {
                    return x.isArray(t) ? e.checked = x.inArray(x(e).val(), t) >= 0 : undefined;
                } }, x.support.checkOn || (x.valHooks[this].get = function (e) {
                return null === e.getAttribute("value") ? "on" : e.value;
            });
        });var I = /^key/,
            z = /^(?:mouse|contextmenu)|click/,
            _ = /^(?:focusinfocus|focusoutblur)$/,
            X = /^([^.]*)(?:\.(.+)|)$/;function U() {
            return !0;
        }function Y() {
            return !1;
        }function V() {
            try {
                return o.activeElement;
            } catch (e) {}
        }x.event = { global: {}, add: function (e, t, n, i, o) {
                var s,
                    a,
                    u,
                    l,
                    c,
                    f,
                    p,
                    h,
                    d,
                    g,
                    m,
                    y = q.get(e);if (y) {
                    n.handler && (s = n, n = s.handler, o = s.selector), n.guid || (n.guid = x.guid++), (l = y.events) || (l = y.events = {}), (a = y.handle) || (a = y.handle = function (e) {
                        return typeof x === r || e && x.event.triggered === e.type ? undefined : x.event.dispatch.apply(a.elem, arguments);
                    }, a.elem = e), t = (t || "").match(w) || [""], c = t.length;while (c--) u = X.exec(t[c]) || [], d = m = u[1], g = (u[2] || "").split(".").sort(), d && (p = x.event.special[d] || {}, d = (o ? p.delegateType : p.bindType) || d, p = x.event.special[d] || {}, f = x.extend({ type: d, origType: m, data: i, handler: n, guid: n.guid, selector: o, needsContext: o && x.expr.match.needsContext.test(o), namespace: g.join(".") }, s), (h = l[d]) || (h = l[d] = [], h.delegateCount = 0, p.setup && p.setup.call(e, i, g, a) !== !1 || e.addEventListener && e.addEventListener(d, a, !1)), p.add && (p.add.call(e, f), f.handler.guid || (f.handler.guid = n.guid)), o ? h.splice(h.delegateCount++, 0, f) : h.push(f), x.event.global[d] = !0);e = null;
                }
            }, remove: function (e, t, n, r, i) {
                var o,
                    s,
                    a,
                    u,
                    l,
                    c,
                    f,
                    p,
                    h,
                    d,
                    g,
                    m = q.hasData(e) && q.get(e);if (m && (u = m.events)) {
                    t = (t || "").match(w) || [""], l = t.length;while (l--) if (a = X.exec(t[l]) || [], h = g = a[1], d = (a[2] || "").split(".").sort(), h) {
                        f = x.event.special[h] || {}, h = (r ? f.delegateType : f.bindType) || h, p = u[h] || [], a = a[2] && RegExp("(^|\\.)" + d.join("\\.(?:.*\\.|)") + "(\\.|$)"), s = o = p.length;while (o--) c = p[o], !i && g !== c.origType || n && n.guid !== c.guid || a && !a.test(c.namespace) || r && r !== c.selector && ("**" !== r || !c.selector) || (p.splice(o, 1), c.selector && p.delegateCount--, f.remove && f.remove.call(e, c));s && !p.length && (f.teardown && f.teardown.call(e, d, m.handle) !== !1 || x.removeEvent(e, h, m.handle), delete u[h]);
                    } else for (h in u) x.event.remove(e, h + t[l], n, r, !0);x.isEmptyObject(u) && (delete m.handle, q.remove(e, "events"));
                }
            }, trigger: function (t, n, r, i) {
                var s,
                    a,
                    u,
                    l,
                    c,
                    f,
                    p,
                    h = [r || o],
                    d = y.call(t, "type") ? t.type : t,
                    g = y.call(t, "namespace") ? t.namespace.split(".") : [];if (a = u = r = r || o, 3 !== r.nodeType && 8 !== r.nodeType && !_.test(d + x.event.triggered) && (d.indexOf(".") >= 0 && (g = d.split("."), d = g.shift(), g.sort()), c = 0 > d.indexOf(":") && "on" + d, t = t[x.expando] ? t : new x.Event(d, "object" == typeof t && t), t.isTrigger = i ? 2 : 3, t.namespace = g.join("."), t.namespace_re = t.namespace ? RegExp("(^|\\.)" + g.join("\\.(?:.*\\.|)") + "(\\.|$)") : null, t.result = undefined, t.target || (t.target = r), n = null == n ? [t] : x.makeArray(n, [t]), p = x.event.special[d] || {}, i || !p.trigger || p.trigger.apply(r, n) !== !1)) {
                    if (!i && !p.noBubble && !x.isWindow(r)) {
                        for (l = p.delegateType || d, _.test(l + d) || (a = a.parentNode); a; a = a.parentNode) h.push(a), u = a;u === (r.ownerDocument || o) && h.push(u.defaultView || u.parentWindow || e);
                    }s = 0;while ((a = h[s++]) && !t.isPropagationStopped()) t.type = s > 1 ? l : p.bindType || d, f = (q.get(a, "events") || {})[t.type] && q.get(a, "handle"), f && f.apply(a, n), f = c && a[c], f && x.acceptData(a) && f.apply && f.apply(a, n) === !1 && t.preventDefault();return t.type = d, i || t.isDefaultPrevented() || p._default && p._default.apply(h.pop(), n) !== !1 || !x.acceptData(r) || c && x.isFunction(r[d]) && !x.isWindow(r) && (u = r[c], u && (r[c] = null), x.event.triggered = d, r[d](), x.event.triggered = undefined, u && (r[c] = u)), t.result;
                }
            }, dispatch: function (e) {
                e = x.event.fix(e);var t,
                    n,
                    r,
                    i,
                    o,
                    s = [],
                    a = d.call(arguments),
                    u = (q.get(this, "events") || {})[e.type] || [],
                    l = x.event.special[e.type] || {};if (a[0] = e, e.delegateTarget = this, !l.preDispatch || l.preDispatch.call(this, e) !== !1) {
                    s = x.event.handlers.call(this, e, u), t = 0;while ((i = s[t++]) && !e.isPropagationStopped()) {
                        e.currentTarget = i.elem, n = 0;while ((o = i.handlers[n++]) && !e.isImmediatePropagationStopped()) (!e.namespace_re || e.namespace_re.test(o.namespace)) && (e.handleObj = o, e.data = o.data, r = ((x.event.special[o.origType] || {}).handle || o.handler).apply(i.elem, a), r !== undefined && (e.result = r) === !1 && (e.preventDefault(), e.stopPropagation()));
                    }return l.postDispatch && l.postDispatch.call(this, e), e.result;
                }
            }, handlers: function (e, t) {
                var n,
                    r,
                    i,
                    o,
                    s = [],
                    a = t.delegateCount,
                    u = e.target;if (a && u.nodeType && (!e.button || "click" !== e.type)) for (; u !== this; u = u.parentNode || this) if (u.disabled !== !0 || "click" !== e.type) {
                    for (r = [], n = 0; a > n; n++) o = t[n], i = o.selector + " ", r[i] === undefined && (r[i] = o.needsContext ? x(i, this).index(u) >= 0 : x.find(i, this, null, [u]).length), r[i] && r.push(o);r.length && s.push({ elem: u, handlers: r });
                }return t.length > a && s.push({ elem: this, handlers: t.slice(a) }), s;
            }, props: "altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "), fixHooks: {}, keyHooks: { props: "char charCode key keyCode".split(" "), filter: function (e, t) {
                    return null == e.which && (e.which = null != t.charCode ? t.charCode : t.keyCode), e;
                } }, mouseHooks: { props: "button buttons clientX clientY offsetX offsetY pageX pageY screenX screenY toElement".split(" "), filter: function (e, t) {
                    var n,
                        r,
                        i,
                        s = t.button;return null == e.pageX && null != t.clientX && (n = e.target.ownerDocument || o, r = n.documentElement, i = n.body, e.pageX = t.clientX + (r && r.scrollLeft || i && i.scrollLeft || 0) - (r && r.clientLeft || i && i.clientLeft || 0), e.pageY = t.clientY + (r && r.scrollTop || i && i.scrollTop || 0) - (r && r.clientTop || i && i.clientTop || 0)), e.which || s === undefined || (e.which = 1 & s ? 1 : 2 & s ? 3 : 4 & s ? 2 : 0), e;
                } }, fix: function (e) {
                if (e[x.expando]) return e;var t,
                    n,
                    r,
                    i = e.type,
                    o = e,
                    s = this.fixHooks[i];s || (this.fixHooks[i] = s = z.test(i) ? this.mouseHooks : I.test(i) ? this.keyHooks : {}), r = s.props ? this.props.concat(s.props) : this.props, e = new x.Event(o), t = r.length;while (t--) n = r[t], e[n] = o[n];return 3 === e.target.nodeType && (e.target = e.target.parentNode), s.filter ? s.filter(e, o) : e;
            }, special: { load: { noBubble: !0 }, focus: { trigger: function () {
                        return this !== V() && this.focus ? (this.focus(), !1) : undefined;
                    }, delegateType: "focusin" }, blur: { trigger: function () {
                        return this === V() && this.blur ? (this.blur(), !1) : undefined;
                    }, delegateType: "focusout" }, click: { trigger: function () {
                        return "checkbox" === this.type && this.click && x.nodeName(this, "input") ? (this.click(), !1) : undefined;
                    }, _default: function (e) {
                        return x.nodeName(e.target, "a");
                    } }, beforeunload: { postDispatch: function (e) {
                        e.result !== undefined && (e.originalEvent.returnValue = e.result);
                    } } }, simulate: function (e, t, n, r) {
                var i = x.extend(new x.Event(), n, { type: e, isSimulated: !0, originalEvent: {} });r ? x.event.trigger(i, null, t) : x.event.dispatch.call(t, i), i.isDefaultPrevented() && n.preventDefault();
            } }, x.removeEvent = function (e, t, n) {
            e.removeEventListener && e.removeEventListener(t, n, !1);
        }, x.Event = function (e, t) {
            return this instanceof x.Event ? (e && e.type ? (this.originalEvent = e, this.type = e.type, this.isDefaultPrevented = e.defaultPrevented || e.getPreventDefault && e.getPreventDefault() ? U : Y) : this.type = e, t && x.extend(this, t), this.timeStamp = e && e.timeStamp || x.now(), this[x.expando] = !0, undefined) : new x.Event(e, t);
        }, x.Event.prototype = { isDefaultPrevented: Y, isPropagationStopped: Y, isImmediatePropagationStopped: Y, preventDefault: function () {
                var e = this.originalEvent;this.isDefaultPrevented = U, e && e.preventDefault && e.preventDefault();
            }, stopPropagation: function () {
                var e = this.originalEvent;this.isPropagationStopped = U, e && e.stopPropagation && e.stopPropagation();
            }, stopImmediatePropagation: function () {
                this.isImmediatePropagationStopped = U, this.stopPropagation();
            } }, x.each({ mouseenter: "mouseover", mouseleave: "mouseout" }, function (e, t) {
            x.event.special[e] = { delegateType: t, bindType: t, handle: function (e) {
                    var n,
                        r = this,
                        i = e.relatedTarget,
                        o = e.handleObj;return (!i || i !== r && !x.contains(r, i)) && (e.type = o.origType, n = o.handler.apply(this, arguments), e.type = t), n;
                } };
        }), x.support.focusinBubbles || x.each({ focus: "focusin", blur: "focusout" }, function (e, t) {
            var n = 0,
                r = function (e) {
                x.event.simulate(t, e.target, x.event.fix(e), !0);
            };x.event.special[t] = { setup: function () {
                    0 === n++ && o.addEventListener(e, r, !0);
                }, teardown: function () {
                    0 === --n && o.removeEventListener(e, r, !0);
                } };
        }), x.fn.extend({ on: function (e, t, n, r, i) {
                var o, s;if ("object" == typeof e) {
                    "string" != typeof t && (n = n || t, t = undefined);for (s in e) this.on(s, t, n, e[s], i);return this;
                }if (null == n && null == r ? (r = t, n = t = undefined) : null == r && ("string" == typeof t ? (r = n, n = undefined) : (r = n, n = t, t = undefined)), r === !1) r = Y;else if (!r) return this;return 1 === i && (o = r, r = function (e) {
                    return x().off(e), o.apply(this, arguments);
                }, r.guid = o.guid || (o.guid = x.guid++)), this.each(function () {
                    x.event.add(this, e, r, n, t);
                });
            }, one: function (e, t, n, r) {
                return this.on(e, t, n, r, 1);
            }, off: function (e, t, n) {
                var r, i;if (e && e.preventDefault && e.handleObj) return r = e.handleObj, x(e.delegateTarget).off(r.namespace ? r.origType + "." + r.namespace : r.origType, r.selector, r.handler), this;if ("object" == typeof e) {
                    for (i in e) this.off(i, t, e[i]);return this;
                }return (t === !1 || "function" == typeof t) && (n = t, t = undefined), n === !1 && (n = Y), this.each(function () {
                    x.event.remove(this, e, n, t);
                });
            }, trigger: function (e, t) {
                return this.each(function () {
                    x.event.trigger(e, t, this);
                });
            }, triggerHandler: function (e, t) {
                var n = this[0];return n ? x.event.trigger(e, t, n, !0) : undefined;
            } });var G = /^.[^:#\[\.,]*$/,
            J = x.expr.match.needsContext,
            Q = { children: !0, contents: !0, next: !0, prev: !0 };x.fn.extend({ find: function (e) {
                var t,
                    n,
                    r,
                    i = this.length;if ("string" != typeof e) return t = this, this.pushStack(x(e).filter(function () {
                    for (r = 0; i > r; r++) if (x.contains(t[r], this)) return !0;
                }));for (n = [], r = 0; i > r; r++) x.find(e, this[r], n);return n = this.pushStack(i > 1 ? x.unique(n) : n), n.selector = (this.selector ? this.selector + " " : "") + e, n;
            }, has: function (e) {
                var t = x(e, this),
                    n = t.length;return this.filter(function () {
                    var e = 0;for (; n > e; e++) if (x.contains(this, t[e])) return !0;
                });
            }, not: function (e) {
                return this.pushStack(Z(this, e || [], !0));
            }, filter: function (e) {
                return this.pushStack(Z(this, e || [], !1));
            }, is: function (e) {
                return !!e && ("string" == typeof e ? J.test(e) ? x(e, this.context).index(this[0]) >= 0 : x.filter(e, this).length > 0 : this.filter(e).length > 0);
            }, closest: function (e, t) {
                var n,
                    r = 0,
                    i = this.length,
                    o = [],
                    s = J.test(e) || "string" != typeof e ? x(e, t || this.context) : 0;for (; i > r; r++) for (n = this[r]; n && n !== t; n = n.parentNode) if (11 > n.nodeType && (s ? s.index(n) > -1 : 1 === n.nodeType && x.find.matchesSelector(n, e))) {
                    n = o.push(n);break;
                }return this.pushStack(o.length > 1 ? x.unique(o) : o);
            }, index: function (e) {
                return e ? "string" == typeof e ? g.call(x(e), this[0]) : g.call(this, e.jquery ? e[0] : e) : this[0] && this[0].parentNode ? this.first().prevAll().length : -1;
            }, add: function (e, t) {
                var n = "string" == typeof e ? x(e, t) : x.makeArray(e && e.nodeType ? [e] : e),
                    r = x.merge(this.get(), n);return this.pushStack(x.unique(r));
            }, addBack: function (e) {
                return this.add(null == e ? this.prevObject : this.prevObject.filter(e));
            } });function K(e, t) {
            while ((e = e[t]) && 1 !== e.nodeType);return e;
        }x.each({ parent: function (e) {
                var t = e.parentNode;return t && 11 !== t.nodeType ? t : null;
            }, parents: function (e) {
                return x.dir(e, "parentNode");
            }, parentsUntil: function (e, t, n) {
                return x.dir(e, "parentNode", n);
            }, next: function (e) {
                return K(e, "nextSibling");
            }, prev: function (e) {
                return K(e, "previousSibling");
            }, nextAll: function (e) {
                return x.dir(e, "nextSibling");
            }, prevAll: function (e) {
                return x.dir(e, "previousSibling");
            }, nextUntil: function (e, t, n) {
                return x.dir(e, "nextSibling", n);
            }, prevUntil: function (e, t, n) {
                return x.dir(e, "previousSibling", n);
            }, siblings: function (e) {
                return x.sibling((e.parentNode || {}).firstChild, e);
            }, children: function (e) {
                return x.sibling(e.firstChild);
            }, contents: function (e) {
                return x.nodeName(e, "iframe") ? e.contentDocument || e.contentWindow.document : x.merge([], e.childNodes);
            } }, function (e, t) {
            x.fn[e] = function (n, r) {
                var i = x.map(this, t, n);return "Until" !== e.slice(-5) && (r = n), r && "string" == typeof r && (i = x.filter(r, i)), this.length > 1 && (Q[e] || x.unique(i), "p" === e[0] && i.reverse()), this.pushStack(i);
            };
        }), x.extend({ filter: function (e, t, n) {
                var r = t[0];return n && (e = ":not(" + e + ")"), 1 === t.length && 1 === r.nodeType ? x.find.matchesSelector(r, e) ? [r] : [] : x.find.matches(e, x.grep(t, function (e) {
                    return 1 === e.nodeType;
                }));
            }, dir: function (e, t, n) {
                var r = [],
                    i = n !== undefined;while ((e = e[t]) && 9 !== e.nodeType) if (1 === e.nodeType) {
                    if (i && x(e).is(n)) break;r.push(e);
                }return r;
            }, sibling: function (e, t) {
                var n = [];for (; e; e = e.nextSibling) 1 === e.nodeType && e !== t && n.push(e);return n;
            } });function Z(e, t, n) {
            if (x.isFunction(t)) return x.grep(e, function (e, r) {
                return !!t.call(e, r, e) !== n;
            });if (t.nodeType) return x.grep(e, function (e) {
                return e === t !== n;
            });if ("string" == typeof t) {
                if (G.test(t)) return x.filter(t, e, n);t = x.filter(t, e);
            }return x.grep(e, function (e) {
                return g.call(t, e) >= 0 !== n;
            });
        }var et = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,
            tt = /<([\w:]+)/,
            nt = /<|&#?\w+;/,
            rt = /<(?:script|style|link)/i,
            it = /^(?:checkbox|radio)$/i,
            ot = /checked\s*(?:[^=]|=\s*.checked.)/i,
            st = /^$|\/(?:java|ecma)script/i,
            at = /^true\/(.*)/,
            ut = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,
            lt = { option: [1, "<select multiple='multiple'>", "</select>"], thead: [1, "<table>", "</table>"], tr: [2, "<table><tbody>", "</tbody></table>"], td: [3, "<table><tbody><tr>", "</tr></tbody></table>"], _default: [0, "", ""] };lt.optgroup = lt.option, lt.tbody = lt.tfoot = lt.colgroup = lt.caption = lt.col = lt.thead, lt.th = lt.td, x.fn.extend({ text: function (e) {
                return x.access(this, function (e) {
                    return e === undefined ? x.text(this) : this.empty().append((this[0] && this[0].ownerDocument || o).createTextNode(e));
                }, null, e, arguments.length);
            }, append: function () {
                return this.domManip(arguments, function (e) {
                    if (1 === this.nodeType || 11 === this.nodeType || 9 === this.nodeType) {
                        var t = ct(this, e);t.appendChild(e);
                    }
                });
            }, prepend: function () {
                return this.domManip(arguments, function (e) {
                    if (1 === this.nodeType || 11 === this.nodeType || 9 === this.nodeType) {
                        var t = ct(this, e);t.insertBefore(e, t.firstChild);
                    }
                });
            }, before: function () {
                return this.domManip(arguments, function (e) {
                    this.parentNode && this.parentNode.insertBefore(e, this);
                });
            }, after: function () {
                return this.domManip(arguments, function (e) {
                    this.parentNode && this.parentNode.insertBefore(e, this.nextSibling);
                });
            }, remove: function (e, t) {
                var n,
                    r = e ? x.filter(e, this) : this,
                    i = 0;for (; null != (n = r[i]); i++) t || 1 !== n.nodeType || x.cleanData(gt(n)), n.parentNode && (t && x.contains(n.ownerDocument, n) && ht(gt(n, "script")), n.parentNode.removeChild(n));return this;
            }, empty: function () {
                var e,
                    t = 0;for (; null != (e = this[t]); t++) 1 === e.nodeType && (x.cleanData(gt(e, !1)), e.textContent = "");return this;
            }, clone: function (e, t) {
                return e = null == e ? !1 : e, t = null == t ? e : t, this.map(function () {
                    return x.clone(this, e, t);
                });
            }, html: function (e) {
                return x.access(this, function (e) {
                    var t = this[0] || {},
                        n = 0,
                        r = this.length;if (e === undefined && 1 === t.nodeType) return t.innerHTML;if ("string" == typeof e && !rt.test(e) && !lt[(tt.exec(e) || ["", ""])[1].toLowerCase()]) {
                        e = e.replace(et, "<$1></$2>");try {
                            for (; r > n; n++) t = this[n] || {}, 1 === t.nodeType && (x.cleanData(gt(t, !1)), t.innerHTML = e);t = 0;
                        } catch (i) {}
                    }t && this.empty().append(e);
                }, null, e, arguments.length);
            }, replaceWith: function () {
                var e = x.map(this, function (e) {
                    return [e.nextSibling, e.parentNode];
                }),
                    t = 0;return this.domManip(arguments, function (n) {
                    var r = e[t++],
                        i = e[t++];i && (x(this).remove(), i.insertBefore(n, r));
                }, !0), t ? this : this.remove();
            }, detach: function (e) {
                return this.remove(e, !0);
            }, domManip: function (e, t, n) {
                e = p.apply([], e);var r,
                    i,
                    o,
                    s,
                    a,
                    u,
                    l = 0,
                    c = this.length,
                    f = this,
                    h = c - 1,
                    d = e[0],
                    g = x.isFunction(d);if (g || !(1 >= c || "string" != typeof d || x.support.checkClone) && ot.test(d)) return this.each(function (r) {
                    var i = f.eq(r);g && (e[0] = d.call(this, r, i.html())), i.domManip(e, t, n);
                });if (c && (r = x.buildFragment(e, this[0].ownerDocument, !1, !n && this), i = r.firstChild, 1 === r.childNodes.length && (r = i), i)) {
                    for (o = x.map(gt(r, "script"), ft), s = o.length; c > l; l++) a = r, l !== h && (a = x.clone(a, !0, !0), s && x.merge(o, gt(a, "script"))), t.call(this[l], a, l);if (s) for (u = o[o.length - 1].ownerDocument, x.map(o, pt), l = 0; s > l; l++) a = o[l], st.test(a.type || "") && !q.access(a, "globalEval") && x.contains(u, a) && (a.src ? x._evalUrl(a.src) : x.globalEval(a.textContent.replace(ut, "")));
                }return this;
            } }), x.each({ appendTo: "append", prependTo: "prepend", insertBefore: "before", insertAfter: "after", replaceAll: "replaceWith" }, function (e, t) {
            x.fn[e] = function (e) {
                var n,
                    r = [],
                    i = x(e),
                    o = i.length - 1,
                    s = 0;for (; o >= s; s++) n = s === o ? this : this.clone(!0), x(i[s])[t](n), h.apply(r, n.get());return this.pushStack(r);
            };
        }), x.extend({ clone: function (e, t, n) {
                var r,
                    i,
                    o,
                    s,
                    a = e.cloneNode(!0),
                    u = x.contains(e.ownerDocument, e);if (!(x.support.noCloneChecked || 1 !== e.nodeType && 11 !== e.nodeType || x.isXMLDoc(e))) for (s = gt(a), o = gt(e), r = 0, i = o.length; i > r; r++) mt(o[r], s[r]);if (t) if (n) for (o = o || gt(e), s = s || gt(a), r = 0, i = o.length; i > r; r++) dt(o[r], s[r]);else dt(e, a);return s = gt(a, "script"), s.length > 0 && ht(s, !u && gt(e, "script")), a;
            }, buildFragment: function (e, t, n, r) {
                var i,
                    o,
                    s,
                    a,
                    u,
                    l,
                    c = 0,
                    f = e.length,
                    p = t.createDocumentFragment(),
                    h = [];for (; f > c; c++) if (i = e[c], i || 0 === i) if ("object" === x.type(i)) x.merge(h, i.nodeType ? [i] : i);else if (nt.test(i)) {
                    o = o || p.appendChild(t.createElement("div")), s = (tt.exec(i) || ["", ""])[1].toLowerCase(), a = lt[s] || lt._default, o.innerHTML = a[1] + i.replace(et, "<$1></$2>") + a[2], l = a[0];while (l--) o = o.firstChild;x.merge(h, o.childNodes), o = p.firstChild, o.textContent = "";
                } else h.push(t.createTextNode(i));p.textContent = "", c = 0;while (i = h[c++]) if ((!r || -1 === x.inArray(i, r)) && (u = x.contains(i.ownerDocument, i), o = gt(p.appendChild(i), "script"), u && ht(o), n)) {
                    l = 0;while (i = o[l++]) st.test(i.type || "") && n.push(i);
                }return p;
            }, cleanData: function (e) {
                var t,
                    n,
                    r,
                    i = e.length,
                    o = 0,
                    s = x.event.special;for (; i > o; o++) {
                    if (n = e[o], x.acceptData(n) && (t = q.access(n))) for (r in t.events) s[r] ? x.event.remove(n, r) : x.removeEvent(n, r, t.handle);L.discard(n), q.discard(n);
                }
            }, _evalUrl: function (e) {
                return x.ajax({ url: e, type: "GET", dataType: "text", async: !1, global: !1, success: x.globalEval });
            } });function ct(e, t) {
            return x.nodeName(e, "table") && x.nodeName(1 === t.nodeType ? t : t.firstChild, "tr") ? e.getElementsByTagName("tbody")[0] || e.appendChild(e.ownerDocument.createElement("tbody")) : e;
        }function ft(e) {
            return e.type = (null !== e.getAttribute("type")) + "/" + e.type, e;
        }function pt(e) {
            var t = at.exec(e.type);return t ? e.type = t[1] : e.removeAttribute("type"), e;
        }function ht(e, t) {
            var n = e.length,
                r = 0;for (; n > r; r++) q.set(e[r], "globalEval", !t || q.get(t[r], "globalEval"));
        }function dt(e, t) {
            var n, r, i, o, s, a, u, l;if (1 === t.nodeType) {
                if (q.hasData(e) && (o = q.access(e), s = x.extend({}, o), l = o.events, q.set(t, s), l)) {
                    delete s.handle, s.events = {};for (i in l) for (n = 0, r = l[i].length; r > n; n++) x.event.add(t, i, l[i][n]);
                }L.hasData(e) && (a = L.access(e), u = x.extend({}, a), L.set(t, u));
            }
        }function gt(e, t) {
            var n = e.getElementsByTagName ? e.getElementsByTagName(t || "*") : e.querySelectorAll ? e.querySelectorAll(t || "*") : [];return t === undefined || t && x.nodeName(e, t) ? x.merge([e], n) : n;
        }function mt(e, t) {
            var n = t.nodeName.toLowerCase();"input" === n && it.test(e.type) ? t.checked = e.checked : ("input" === n || "textarea" === n) && (t.defaultValue = e.defaultValue);
        }x.fn.extend({ wrapAll: function (e) {
                var t;return x.isFunction(e) ? this.each(function (t) {
                    x(this).wrapAll(e.call(this, t));
                }) : (this[0] && (t = x(e, this[0].ownerDocument).eq(0).clone(!0), this[0].parentNode && t.insertBefore(this[0]), t.map(function () {
                    var e = this;while (e.firstElementChild) e = e.firstElementChild;return e;
                }).append(this)), this);
            }, wrapInner: function (e) {
                return x.isFunction(e) ? this.each(function (t) {
                    x(this).wrapInner(e.call(this, t));
                }) : this.each(function () {
                    var t = x(this),
                        n = t.contents();n.length ? n.wrapAll(e) : t.append(e);
                });
            }, wrap: function (e) {
                var t = x.isFunction(e);return this.each(function (n) {
                    x(this).wrapAll(t ? e.call(this, n) : e);
                });
            }, unwrap: function () {
                return this.parent().each(function () {
                    x.nodeName(this, "body") || x(this).replaceWith(this.childNodes);
                }).end();
            } });var yt,
            vt,
            xt = /^(none|table(?!-c[ea]).+)/,
            bt = /^margin/,
            wt = RegExp("^(" + b + ")(.*)$", "i"),
            Tt = RegExp("^(" + b + ")(?!px)[a-z%]+$", "i"),
            Ct = RegExp("^([+-])=(" + b + ")", "i"),
            kt = { BODY: "block" },
            Nt = { position: "absolute", visibility: "hidden", display: "block" },
            Et = { letterSpacing: 0, fontWeight: 400 },
            St = ["Top", "Right", "Bottom", "Left"],
            jt = ["Webkit", "O", "Moz", "ms"];function Dt(e, t) {
            if (t in e) return t;var n = t.charAt(0).toUpperCase() + t.slice(1),
                r = t,
                i = jt.length;while (i--) if (t = jt[i] + n, t in e) return t;return r;
        }function At(e, t) {
            return e = t || e, "none" === x.css(e, "display") || !x.contains(e.ownerDocument, e);
        }function Lt(t) {
            return e.getComputedStyle(t, null);
        }function qt(e, t) {
            var n,
                r,
                i,
                o = [],
                s = 0,
                a = e.length;for (; a > s; s++) r = e[s], r.style && (o[s] = q.get(r, "olddisplay"), n = r.style.display, t ? (o[s] || "none" !== n || (r.style.display = ""), "" === r.style.display && At(r) && (o[s] = q.access(r, "olddisplay", Pt(r.nodeName)))) : o[s] || (i = At(r), (n && "none" !== n || !i) && q.set(r, "olddisplay", i ? n : x.css(r, "display"))));for (s = 0; a > s; s++) r = e[s], r.style && (t && "none" !== r.style.display && "" !== r.style.display || (r.style.display = t ? o[s] || "" : "none"));return e;
        }x.fn.extend({ css: function (e, t) {
                return x.access(this, function (e, t, n) {
                    var r,
                        i,
                        o = {},
                        s = 0;if (x.isArray(t)) {
                        for (r = Lt(e), i = t.length; i > s; s++) o[t[s]] = x.css(e, t[s], !1, r);return o;
                    }return n !== undefined ? x.style(e, t, n) : x.css(e, t);
                }, e, t, arguments.length > 1);
            }, show: function () {
                return qt(this, !0);
            }, hide: function () {
                return qt(this);
            }, toggle: function (e) {
                var t = "boolean" == typeof e;return this.each(function () {
                    (t ? e : At(this)) ? x(this).show() : x(this).hide();
                });
            } }), x.extend({ cssHooks: { opacity: { get: function (e, t) {
                        if (t) {
                            var n = yt(e, "opacity");return "" === n ? "1" : n;
                        }
                    } } }, cssNumber: { columnCount: !0, fillOpacity: !0, fontWeight: !0, lineHeight: !0, opacity: !0, orphans: !0, widows: !0, zIndex: !0, zoom: !0 }, cssProps: { "float": "cssFloat" }, style: function (e, t, n, r) {
                if (e && 3 !== e.nodeType && 8 !== e.nodeType && e.style) {
                    var i,
                        o,
                        s,
                        a = x.camelCase(t),
                        u = e.style;return t = x.cssProps[a] || (x.cssProps[a] = Dt(u, a)), s = x.cssHooks[t] || x.cssHooks[a], n === undefined ? s && "get" in s && (i = s.get(e, !1, r)) !== undefined ? i : u[t] : (o = typeof n, "string" === o && (i = Ct.exec(n)) && (n = (i[1] + 1) * i[2] + parseFloat(x.css(e, t)), o = "number"), null == n || "number" === o && isNaN(n) || ("number" !== o || x.cssNumber[a] || (n += "px"), x.support.clearCloneStyle || "" !== n || 0 !== t.indexOf("background") || (u[t] = "inherit"), s && "set" in s && (n = s.set(e, n, r)) === undefined || (u[t] = n)), undefined);
                }
            }, css: function (e, t, n, r) {
                var i,
                    o,
                    s,
                    a = x.camelCase(t);return t = x.cssProps[a] || (x.cssProps[a] = Dt(e.style, a)), s = x.cssHooks[t] || x.cssHooks[a], s && "get" in s && (i = s.get(e, !0, n)), i === undefined && (i = yt(e, t, r)), "normal" === i && t in Et && (i = Et[t]), "" === n || n ? (o = parseFloat(i), n === !0 || x.isNumeric(o) ? o || 0 : i) : i;
            } }), yt = function (e, t, n) {
            var r,
                i,
                o,
                s = n || Lt(e),
                a = s ? s.getPropertyValue(t) || s[t] : undefined,
                u = e.style;return s && ("" !== a || x.contains(e.ownerDocument, e) || (a = x.style(e, t)), Tt.test(a) && bt.test(t) && (r = u.width, i = u.minWidth, o = u.maxWidth, u.minWidth = u.maxWidth = u.width = a, a = s.width, u.width = r, u.minWidth = i, u.maxWidth = o)), a;
        };function Ht(e, t, n) {
            var r = wt.exec(t);return r ? Math.max(0, r[1] - (n || 0)) + (r[2] || "px") : t;
        }function Ot(e, t, n, r, i) {
            var o = n === (r ? "border" : "content") ? 4 : "width" === t ? 1 : 0,
                s = 0;for (; 4 > o; o += 2) "margin" === n && (s += x.css(e, n + St[o], !0, i)), r ? ("content" === n && (s -= x.css(e, "padding" + St[o], !0, i)), "margin" !== n && (s -= x.css(e, "border" + St[o] + "Width", !0, i))) : (s += x.css(e, "padding" + St[o], !0, i), "padding" !== n && (s += x.css(e, "border" + St[o] + "Width", !0, i)));return s;
        }function Ft(e, t, n) {
            var r = !0,
                i = "width" === t ? e.offsetWidth : e.offsetHeight,
                o = Lt(e),
                s = x.support.boxSizing && "border-box" === x.css(e, "boxSizing", !1, o);if (0 >= i || null == i) {
                if (i = yt(e, t, o), (0 > i || null == i) && (i = e.style[t]), Tt.test(i)) return i;r = s && (x.support.boxSizingReliable || i === e.style[t]), i = parseFloat(i) || 0;
            }return i + Ot(e, t, n || (s ? "border" : "content"), r, o) + "px";
        }function Pt(e) {
            var t = o,
                n = kt[e];return n || (n = Rt(e, t), "none" !== n && n || (vt = (vt || x("<iframe frameborder='0' width='0' height='0'/>").css("cssText", "display:block !important")).appendTo(t.documentElement), t = (vt[0].contentWindow || vt[0].contentDocument).document, t.write("<!doctype html><html><body>"), t.close(), n = Rt(e, t), vt.detach()), kt[e] = n), n;
        }function Rt(e, t) {
            var n = x(t.createElement(e)).appendTo(t.body),
                r = x.css(n[0], "display");return n.remove(), r;
        }x.each(["height", "width"], function (e, t) {
            x.cssHooks[t] = { get: function (e, n, r) {
                    return n ? 0 === e.offsetWidth && xt.test(x.css(e, "display")) ? x.swap(e, Nt, function () {
                        return Ft(e, t, r);
                    }) : Ft(e, t, r) : undefined;
                }, set: function (e, n, r) {
                    var i = r && Lt(e);return Ht(e, n, r ? Ot(e, t, r, x.support.boxSizing && "border-box" === x.css(e, "boxSizing", !1, i), i) : 0);
                } };
        }), x(function () {
            x.support.reliableMarginRight || (x.cssHooks.marginRight = { get: function (e, t) {
                    return t ? x.swap(e, { display: "inline-block" }, yt, [e, "marginRight"]) : undefined;
                } }), !x.support.pixelPosition && x.fn.position && x.each(["top", "left"], function (e, t) {
                x.cssHooks[t] = { get: function (e, n) {
                        return n ? (n = yt(e, t), Tt.test(n) ? x(e).position()[t] + "px" : n) : undefined;
                    } };
            });
        }), x.expr && x.expr.filters && (x.expr.filters.hidden = function (e) {
            return 0 >= e.offsetWidth && 0 >= e.offsetHeight;
        }, x.expr.filters.visible = function (e) {
            return !x.expr.filters.hidden(e);
        }), x.each({ margin: "", padding: "", border: "Width" }, function (e, t) {
            x.cssHooks[e + t] = { expand: function (n) {
                    var r = 0,
                        i = {},
                        o = "string" == typeof n ? n.split(" ") : [n];for (; 4 > r; r++) i[e + St[r] + t] = o[r] || o[r - 2] || o[0];return i;
                } }, bt.test(e) || (x.cssHooks[e + t].set = Ht);
        });var Mt = /%20/g,
            Wt = /\[\]$/,
            $t = /\r?\n/g,
            Bt = /^(?:submit|button|image|reset|file)$/i,
            It = /^(?:input|select|textarea|keygen)/i;x.fn.extend({ serialize: function () {
                return x.param(this.serializeArray());
            }, serializeArray: function () {
                return this.map(function () {
                    var e = x.prop(this, "elements");return e ? x.makeArray(e) : this;
                }).filter(function () {
                    var e = this.type;return this.name && !x(this).is(":disabled") && It.test(this.nodeName) && !Bt.test(e) && (this.checked || !it.test(e));
                }).map(function (e, t) {
                    var n = x(this).val();return null == n ? null : x.isArray(n) ? x.map(n, function (e) {
                        return { name: t.name, value: e.replace($t, "\r\n") };
                    }) : { name: t.name, value: n.replace($t, "\r\n") };
                }).get();
            } }), x.param = function (e, t) {
            var n,
                r = [],
                i = function (e, t) {
                t = x.isFunction(t) ? t() : null == t ? "" : t, r[r.length] = encodeURIComponent(e) + "=" + encodeURIComponent(t);
            };if (t === undefined && (t = x.ajaxSettings && x.ajaxSettings.traditional), x.isArray(e) || e.jquery && !x.isPlainObject(e)) x.each(e, function () {
                i(this.name, this.value);
            });else for (n in e) zt(n, e[n], t, i);return r.join("&").replace(Mt, "+");
        };function zt(e, t, n, r) {
            var i;if (x.isArray(t)) x.each(t, function (t, i) {
                n || Wt.test(e) ? r(e, i) : zt(e + "[" + ("object" == typeof i ? t : "") + "]", i, n, r);
            });else if (n || "object" !== x.type(t)) r(e, t);else for (i in t) zt(e + "[" + i + "]", t[i], n, r);
        }x.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "), function (e, t) {
            x.fn[t] = function (e, n) {
                return arguments.length > 0 ? this.on(t, null, e, n) : this.trigger(t);
            };
        }), x.fn.extend({ hover: function (e, t) {
                return this.mouseenter(e).mouseleave(t || e);
            }, bind: function (e, t, n) {
                return this.on(e, null, t, n);
            }, unbind: function (e, t) {
                return this.off(e, null, t);
            }, delegate: function (e, t, n, r) {
                return this.on(t, e, n, r);
            }, undelegate: function (e, t, n) {
                return 1 === arguments.length ? this.off(e, "**") : this.off(t, e || "**", n);
            } });var _t,
            Xt,
            Ut = x.now(),
            Yt = /\?/,
            Vt = /#.*$/,
            Gt = /([?&])_=[^&]*/,
            Jt = /^(.*?):[ \t]*([^\r\n]*)$/gm,
            Qt = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
            Kt = /^(?:GET|HEAD)$/,
            Zt = /^\/\//,
            en = /^([\w.+-]+:)(?:\/\/([^\/?#:]*)(?::(\d+)|)|)/,
            tn = x.fn.load,
            nn = {},
            rn = {},
            on = "*/".concat("*");try {
            Xt = i.href;
        } catch (sn) {
            Xt = o.createElement("a"), Xt.href = "", Xt = Xt.href;
        }_t = en.exec(Xt.toLowerCase()) || [];function an(e) {
            return function (t, n) {
                "string" != typeof t && (n = t, t = "*");var r,
                    i = 0,
                    o = t.toLowerCase().match(w) || [];
                if (x.isFunction(n)) while (r = o[i++]) "+" === r[0] ? (r = r.slice(1) || "*", (e[r] = e[r] || []).unshift(n)) : (e[r] = e[r] || []).push(n);
            };
        }function un(e, t, n, r) {
            var i = {},
                o = e === rn;function s(a) {
                var u;return i[a] = !0, x.each(e[a] || [], function (e, a) {
                    var l = a(t, n, r);return "string" != typeof l || o || i[l] ? o ? !(u = l) : undefined : (t.dataTypes.unshift(l), s(l), !1);
                }), u;
            }return s(t.dataTypes[0]) || !i["*"] && s("*");
        }function ln(e, t) {
            var n,
                r,
                i = x.ajaxSettings.flatOptions || {};for (n in t) t[n] !== undefined && ((i[n] ? e : r || (r = {}))[n] = t[n]);return r && x.extend(!0, e, r), e;
        }x.fn.load = function (e, t, n) {
            if ("string" != typeof e && tn) return tn.apply(this, arguments);var r,
                i,
                o,
                s = this,
                a = e.indexOf(" ");return a >= 0 && (r = e.slice(a), e = e.slice(0, a)), x.isFunction(t) ? (n = t, t = undefined) : t && "object" == typeof t && (i = "POST"), s.length > 0 && x.ajax({ url: e, type: i, dataType: "html", data: t }).done(function (e) {
                o = arguments, s.html(r ? x("<div>").append(x.parseHTML(e)).find(r) : e);
            }).complete(n && function (e, t) {
                s.each(n, o || [e.responseText, t, e]);
            }), this;
        }, x.each(["ajaxStart", "ajaxStop", "ajaxComplete", "ajaxError", "ajaxSuccess", "ajaxSend"], function (e, t) {
            x.fn[t] = function (e) {
                return this.on(t, e);
            };
        }), x.extend({ active: 0, lastModified: {}, etag: {}, ajaxSettings: { url: Xt, type: "GET", isLocal: Qt.test(_t[1]), global: !0, processData: !0, async: !0, contentType: "application/x-www-form-urlencoded; charset=UTF-8", accepts: { "*": on, text: "text/plain", html: "text/html", xml: "application/xml, text/xml", json: "application/json, text/javascript" }, contents: { xml: /xml/, html: /html/, json: /json/ }, responseFields: { xml: "responseXML", text: "responseText", json: "responseJSON" }, converters: { "* text": String, "text html": !0, "text json": x.parseJSON, "text xml": x.parseXML }, flatOptions: { url: !0, context: !0 } }, ajaxSetup: function (e, t) {
                return t ? ln(ln(e, x.ajaxSettings), t) : ln(x.ajaxSettings, e);
            }, ajaxPrefilter: an(nn), ajaxTransport: an(rn), ajax: function (e, t) {
                "object" == typeof e && (t = e, e = undefined), t = t || {};var n,
                    r,
                    i,
                    o,
                    s,
                    a,
                    u,
                    l,
                    c = x.ajaxSetup({}, t),
                    f = c.context || c,
                    p = c.context && (f.nodeType || f.jquery) ? x(f) : x.event,
                    h = x.Deferred(),
                    d = x.Callbacks("once memory"),
                    g = c.statusCode || {},
                    m = {},
                    y = {},
                    v = 0,
                    b = "canceled",
                    T = { readyState: 0, getResponseHeader: function (e) {
                        var t;if (2 === v) {
                            if (!o) {
                                o = {};while (t = Jt.exec(i)) o[t[1].toLowerCase()] = t[2];
                            }t = o[e.toLowerCase()];
                        }return null == t ? null : t;
                    }, getAllResponseHeaders: function () {
                        return 2 === v ? i : null;
                    }, setRequestHeader: function (e, t) {
                        var n = e.toLowerCase();return v || (e = y[n] = y[n] || e, m[e] = t), this;
                    }, overrideMimeType: function (e) {
                        return v || (c.mimeType = e), this;
                    }, statusCode: function (e) {
                        var t;if (e) if (2 > v) for (t in e) g[t] = [g[t], e[t]];else T.always(e[T.status]);return this;
                    }, abort: function (e) {
                        var t = e || b;return n && n.abort(t), k(0, t), this;
                    } };if (h.promise(T).complete = d.add, T.success = T.done, T.error = T.fail, c.url = ((e || c.url || Xt) + "").replace(Vt, "").replace(Zt, _t[1] + "//"), c.type = t.method || t.type || c.method || c.type, c.dataTypes = x.trim(c.dataType || "*").toLowerCase().match(w) || [""], null == c.crossDomain && (a = en.exec(c.url.toLowerCase()), c.crossDomain = !(!a || a[1] === _t[1] && a[2] === _t[2] && (a[3] || ("http:" === a[1] ? "80" : "443")) === (_t[3] || ("http:" === _t[1] ? "80" : "443")))), c.data && c.processData && "string" != typeof c.data && (c.data = x.param(c.data, c.traditional)), un(nn, c, t, T), 2 === v) return T;u = c.global, u && 0 === x.active++ && x.event.trigger("ajaxStart"), c.type = c.type.toUpperCase(), c.hasContent = !Kt.test(c.type), r = c.url, c.hasContent || (c.data && (r = c.url += (Yt.test(r) ? "&" : "?") + c.data, delete c.data), c.cache === !1 && (c.url = Gt.test(r) ? r.replace(Gt, "$1_=" + Ut++) : r + (Yt.test(r) ? "&" : "?") + "_=" + Ut++)), c.ifModified && (x.lastModified[r] && T.setRequestHeader("If-Modified-Since", x.lastModified[r]), x.etag[r] && T.setRequestHeader("If-None-Match", x.etag[r])), (c.data && c.hasContent && c.contentType !== !1 || t.contentType) && T.setRequestHeader("Content-Type", c.contentType), T.setRequestHeader("Accept", c.dataTypes[0] && c.accepts[c.dataTypes[0]] ? c.accepts[c.dataTypes[0]] + ("*" !== c.dataTypes[0] ? ", " + on + "; q=0.01" : "") : c.accepts["*"]);for (l in c.headers) T.setRequestHeader(l, c.headers[l]);if (c.beforeSend && (c.beforeSend.call(f, T, c) === !1 || 2 === v)) return T.abort();b = "abort";for (l in { success: 1, error: 1, complete: 1 }) T[l](c[l]);if (n = un(rn, c, t, T)) {
                    T.readyState = 1, u && p.trigger("ajaxSend", [T, c]), c.async && c.timeout > 0 && (s = setTimeout(function () {
                        T.abort("timeout");
                    }, c.timeout));try {
                        v = 1, n.send(m, k);
                    } catch (C) {
                        if (!(2 > v)) throw C;k(-1, C);
                    }
                } else k(-1, "No Transport");function k(e, t, o, a) {
                    var l,
                        m,
                        y,
                        b,
                        w,
                        C = t;2 !== v && (v = 2, s && clearTimeout(s), n = undefined, i = a || "", T.readyState = e > 0 ? 4 : 0, l = e >= 200 && 300 > e || 304 === e, o && (b = cn(c, T, o)), b = fn(c, b, T, l), l ? (c.ifModified && (w = T.getResponseHeader("Last-Modified"), w && (x.lastModified[r] = w), w = T.getResponseHeader("etag"), w && (x.etag[r] = w)), 204 === e ? C = "nocontent" : 304 === e ? C = "notmodified" : (C = b.state, m = b.data, y = b.error, l = !y)) : (y = C, (e || !C) && (C = "error", 0 > e && (e = 0))), T.status = e, T.statusText = (t || C) + "", l ? h.resolveWith(f, [m, C, T]) : h.rejectWith(f, [T, C, y]), T.statusCode(g), g = undefined, u && p.trigger(l ? "ajaxSuccess" : "ajaxError", [T, c, l ? m : y]), d.fireWith(f, [T, C]), u && (p.trigger("ajaxComplete", [T, c]), --x.active || x.event.trigger("ajaxStop")));
                }return T;
            }, getJSON: function (e, t, n) {
                return x.get(e, t, n, "json");
            }, getScript: function (e, t) {
                return x.get(e, undefined, t, "script");
            } }), x.each(["get", "post"], function (e, t) {
            x[t] = function (e, n, r, i) {
                return x.isFunction(n) && (i = i || r, r = n, n = undefined), x.ajax({ url: e, type: t, dataType: i, data: n, success: r });
            };
        });function cn(e, t, n) {
            var r,
                i,
                o,
                s,
                a = e.contents,
                u = e.dataTypes;while ("*" === u[0]) u.shift(), r === undefined && (r = e.mimeType || t.getResponseHeader("Content-Type"));if (r) for (i in a) if (a[i] && a[i].test(r)) {
                u.unshift(i);break;
            }if (u[0] in n) o = u[0];else {
                for (i in n) {
                    if (!u[0] || e.converters[i + " " + u[0]]) {
                        o = i;break;
                    }s || (s = i);
                }o = o || s;
            }return o ? (o !== u[0] && u.unshift(o), n[o]) : undefined;
        }function fn(e, t, n, r) {
            var i,
                o,
                s,
                a,
                u,
                l = {},
                c = e.dataTypes.slice();if (c[1]) for (s in e.converters) l[s.toLowerCase()] = e.converters[s];o = c.shift();while (o) if (e.responseFields[o] && (n[e.responseFields[o]] = t), !u && r && e.dataFilter && (t = e.dataFilter(t, e.dataType)), u = o, o = c.shift()) if ("*" === o) o = u;else if ("*" !== u && u !== o) {
                if (s = l[u + " " + o] || l["* " + o], !s) for (i in l) if (a = i.split(" "), a[1] === o && (s = l[u + " " + a[0]] || l["* " + a[0]])) {
                    s === !0 ? s = l[i] : l[i] !== !0 && (o = a[0], c.unshift(a[1]));break;
                }if (s !== !0) if (s && e["throws"]) t = s(t);else try {
                    t = s(t);
                } catch (f) {
                    return { state: "parsererror", error: s ? f : "No conversion from " + u + " to " + o };
                }
            }return { state: "success", data: t };
        }x.ajaxSetup({ accepts: { script: "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript" }, contents: { script: /(?:java|ecma)script/ }, converters: { "text script": function (e) {
                    return x.globalEval(e), e;
                } } }), x.ajaxPrefilter("script", function (e) {
            e.cache === undefined && (e.cache = !1), e.crossDomain && (e.type = "GET");
        }), x.ajaxTransport("script", function (e) {
            if (e.crossDomain) {
                var t, n;return { send: function (r, i) {
                        t = x("<script>").prop({ async: !0, charset: e.scriptCharset, src: e.url }).on("load error", n = function (e) {
                            t.remove(), n = null, e && i("error" === e.type ? 404 : 200, e.type);
                        }), o.head.appendChild(t[0]);
                    }, abort: function () {
                        n && n();
                    } };
            }
        });var pn = [],
            hn = /(=)\?(?=&|$)|\?\?/;x.ajaxSetup({ jsonp: "callback", jsonpCallback: function () {
                var e = pn.pop() || x.expando + "_" + Ut++;return this[e] = !0, e;
            } }), x.ajaxPrefilter("json jsonp", function (t, n, r) {
            var i,
                o,
                s,
                a = t.jsonp !== !1 && (hn.test(t.url) ? "url" : "string" == typeof t.data && !(t.contentType || "").indexOf("application/x-www-form-urlencoded") && hn.test(t.data) && "data");return a || "jsonp" === t.dataTypes[0] ? (i = t.jsonpCallback = x.isFunction(t.jsonpCallback) ? t.jsonpCallback() : t.jsonpCallback, a ? t[a] = t[a].replace(hn, "$1" + i) : t.jsonp !== !1 && (t.url += (Yt.test(t.url) ? "&" : "?") + t.jsonp + "=" + i), t.converters["script json"] = function () {
                return s || x.error(i + " was not called"), s[0];
            }, t.dataTypes[0] = "json", o = e[i], e[i] = function () {
                s = arguments;
            }, r.always(function () {
                e[i] = o, t[i] && (t.jsonpCallback = n.jsonpCallback, pn.push(i)), s && x.isFunction(o) && o(s[0]), s = o = undefined;
            }), "script") : undefined;
        }), x.ajaxSettings.xhr = function () {
            try {
                return new XMLHttpRequest();
            } catch (e) {}
        };var dn = x.ajaxSettings.xhr(),
            gn = { 0: 200, 1223: 204 },
            mn = 0,
            yn = {};e.ActiveXObject && x(e).on("unload", function () {
            for (var e in yn) yn[e]();yn = undefined;
        }), x.support.cors = !!dn && "withCredentials" in dn, x.support.ajax = dn = !!dn, x.ajaxTransport(function (e) {
            var t;return x.support.cors || dn && !e.crossDomain ? { send: function (n, r) {
                    var i,
                        o,
                        s = e.xhr();if (s.open(e.type, e.url, e.async, e.username, e.password), e.xhrFields) for (i in e.xhrFields) s[i] = e.xhrFields[i];e.mimeType && s.overrideMimeType && s.overrideMimeType(e.mimeType), e.crossDomain || n["X-Requested-With"] || (n["X-Requested-With"] = "XMLHttpRequest");for (i in n) s.setRequestHeader(i, n[i]);t = function (e) {
                        return function () {
                            t && (delete yn[o], t = s.onload = s.onerror = null, "abort" === e ? s.abort() : "error" === e ? r(s.status || 404, s.statusText) : r(gn[s.status] || s.status, s.statusText, "string" == typeof s.responseText ? { text: s.responseText } : undefined, s.getAllResponseHeaders()));
                        };
                    }, s.onload = t(), s.onerror = t("error"), t = yn[o = mn++] = t("abort"), s.send(e.hasContent && e.data || null);
                }, abort: function () {
                    t && t();
                } } : undefined;
        });var vn,
            xn,
            bn = /^(?:toggle|show|hide)$/,
            wn = RegExp("^(?:([+-])=|)(" + b + ")([a-z%]*)$", "i"),
            Tn = /queueHooks$/,
            Cn = [Dn],
            kn = { "*": [function (e, t) {
                var n,
                    r,
                    i = this.createTween(e, t),
                    o = wn.exec(t),
                    s = i.cur(),
                    a = +s || 0,
                    u = 1,
                    l = 20;if (o) {
                    if (n = +o[2], r = o[3] || (x.cssNumber[e] ? "" : "px"), "px" !== r && a) {
                        a = x.css(i.elem, e, !0) || n || 1;do u = u || ".5", a /= u, x.style(i.elem, e, a + r); while (u !== (u = i.cur() / s) && 1 !== u && --l);
                    }i.unit = r, i.start = a, i.end = o[1] ? a + (o[1] + 1) * n : n;
                }return i;
            }] };function Nn() {
            return setTimeout(function () {
                vn = undefined;
            }), vn = x.now();
        }function En(e, t) {
            x.each(t, function (t, n) {
                var r = (kn[t] || []).concat(kn["*"]),
                    i = 0,
                    o = r.length;for (; o > i; i++) if (r[i].call(e, t, n)) return;
            });
        }function Sn(e, t, n) {
            var r,
                i,
                o = 0,
                s = Cn.length,
                a = x.Deferred().always(function () {
                delete u.elem;
            }),
                u = function () {
                if (i) return !1;var t = vn || Nn(),
                    n = Math.max(0, l.startTime + l.duration - t),
                    r = n / l.duration || 0,
                    o = 1 - r,
                    s = 0,
                    u = l.tweens.length;for (; u > s; s++) l.tweens[s].run(o);return a.notifyWith(e, [l, o, n]), 1 > o && u ? n : (a.resolveWith(e, [l]), !1);
            },
                l = a.promise({ elem: e, props: x.extend({}, t), opts: x.extend(!0, { specialEasing: {} }, n), originalProperties: t, originalOptions: n, startTime: vn || Nn(), duration: n.duration, tweens: [], createTween: function (t, n) {
                    var r = x.Tween(e, l.opts, t, n, l.opts.specialEasing[t] || l.opts.easing);return l.tweens.push(r), r;
                }, stop: function (t) {
                    var n = 0,
                        r = t ? l.tweens.length : 0;if (i) return this;for (i = !0; r > n; n++) l.tweens[n].run(1);return t ? a.resolveWith(e, [l, t]) : a.rejectWith(e, [l, t]), this;
                } }),
                c = l.props;for (jn(c, l.opts.specialEasing); s > o; o++) if (r = Cn[o].call(l, e, c, l.opts)) return r;return En(l, c), x.isFunction(l.opts.start) && l.opts.start.call(e, l), x.fx.timer(x.extend(u, { elem: e, anim: l, queue: l.opts.queue })), l.progress(l.opts.progress).done(l.opts.done, l.opts.complete).fail(l.opts.fail).always(l.opts.always);
        }function jn(e, t) {
            var n, r, i, o, s;for (n in e) if (r = x.camelCase(n), i = t[r], o = e[n], x.isArray(o) && (i = o[1], o = e[n] = o[0]), n !== r && (e[r] = o, delete e[n]), s = x.cssHooks[r], s && "expand" in s) {
                o = s.expand(o), delete e[r];for (n in o) n in e || (e[n] = o[n], t[n] = i);
            } else t[r] = i;
        }x.Animation = x.extend(Sn, { tweener: function (e, t) {
                x.isFunction(e) ? (t = e, e = ["*"]) : e = e.split(" ");var n,
                    r = 0,
                    i = e.length;for (; i > r; r++) n = e[r], kn[n] = kn[n] || [], kn[n].unshift(t);
            }, prefilter: function (e, t) {
                t ? Cn.unshift(e) : Cn.push(e);
            } });function Dn(e, t, n) {
            var r,
                i,
                o,
                s,
                a,
                u,
                l,
                c,
                f,
                p = this,
                h = e.style,
                d = {},
                g = [],
                m = e.nodeType && At(e);n.queue || (c = x._queueHooks(e, "fx"), null == c.unqueued && (c.unqueued = 0, f = c.empty.fire, c.empty.fire = function () {
                c.unqueued || f();
            }), c.unqueued++, p.always(function () {
                p.always(function () {
                    c.unqueued--, x.queue(e, "fx").length || c.empty.fire();
                });
            })), 1 === e.nodeType && ("height" in t || "width" in t) && (n.overflow = [h.overflow, h.overflowX, h.overflowY], "inline" === x.css(e, "display") && "none" === x.css(e, "float") && (h.display = "inline-block")), n.overflow && (h.overflow = "hidden", p.always(function () {
                h.overflow = n.overflow[0], h.overflowX = n.overflow[1], h.overflowY = n.overflow[2];
            })), a = q.get(e, "fxshow");for (r in t) if (o = t[r], bn.exec(o)) {
                if (delete t[r], u = u || "toggle" === o, o === (m ? "hide" : "show")) {
                    if ("show" !== o || a === undefined || a[r] === undefined) continue;m = !0;
                }g.push(r);
            }if (s = g.length) {
                a = q.get(e, "fxshow") || q.access(e, "fxshow", {}), "hidden" in a && (m = a.hidden), u && (a.hidden = !m), m ? x(e).show() : p.done(function () {
                    x(e).hide();
                }), p.done(function () {
                    var t;q.remove(e, "fxshow");for (t in d) x.style(e, t, d[t]);
                });for (r = 0; s > r; r++) i = g[r], l = p.createTween(i, m ? a[i] : 0), d[i] = a[i] || x.style(e, i), i in a || (a[i] = l.start, m && (l.end = l.start, l.start = "width" === i || "height" === i ? 1 : 0));
            }
        }function An(e, t, n, r, i) {
            return new An.prototype.init(e, t, n, r, i);
        }x.Tween = An, An.prototype = { constructor: An, init: function (e, t, n, r, i, o) {
                this.elem = e, this.prop = n, this.easing = i || "swing", this.options = t, this.start = this.now = this.cur(), this.end = r, this.unit = o || (x.cssNumber[n] ? "" : "px");
            }, cur: function () {
                var e = An.propHooks[this.prop];return e && e.get ? e.get(this) : An.propHooks._default.get(this);
            }, run: function (e) {
                var t,
                    n = An.propHooks[this.prop];return this.pos = t = this.options.duration ? x.easing[this.easing](e, this.options.duration * e, 0, 1, this.options.duration) : e, this.now = (this.end - this.start) * t + this.start, this.options.step && this.options.step.call(this.elem, this.now, this), n && n.set ? n.set(this) : An.propHooks._default.set(this), this;
            } }, An.prototype.init.prototype = An.prototype, An.propHooks = { _default: { get: function (e) {
                    var t;return null == e.elem[e.prop] || e.elem.style && null != e.elem.style[e.prop] ? (t = x.css(e.elem, e.prop, ""), t && "auto" !== t ? t : 0) : e.elem[e.prop];
                }, set: function (e) {
                    x.fx.step[e.prop] ? x.fx.step[e.prop](e) : e.elem.style && (null != e.elem.style[x.cssProps[e.prop]] || x.cssHooks[e.prop]) ? x.style(e.elem, e.prop, e.now + e.unit) : e.elem[e.prop] = e.now;
                } } }, An.propHooks.scrollTop = An.propHooks.scrollLeft = { set: function (e) {
                e.elem.nodeType && e.elem.parentNode && (e.elem[e.prop] = e.now);
            } }, x.each(["toggle", "show", "hide"], function (e, t) {
            var n = x.fn[t];x.fn[t] = function (e, r, i) {
                return null == e || "boolean" == typeof e ? n.apply(this, arguments) : this.animate(Ln(t, !0), e, r, i);
            };
        }), x.fn.extend({ fadeTo: function (e, t, n, r) {
                return this.filter(At).css("opacity", 0).show().end().animate({ opacity: t }, e, n, r);
            }, animate: function (e, t, n, r) {
                var i = x.isEmptyObject(e),
                    o = x.speed(t, n, r),
                    s = function () {
                    var t = Sn(this, x.extend({}, e), o);s.finish = function () {
                        t.stop(!0);
                    }, (i || q.get(this, "finish")) && t.stop(!0);
                };return s.finish = s, i || o.queue === !1 ? this.each(s) : this.queue(o.queue, s);
            }, stop: function (e, t, n) {
                var r = function (e) {
                    var t = e.stop;delete e.stop, t(n);
                };return "string" != typeof e && (n = t, t = e, e = undefined), t && e !== !1 && this.queue(e || "fx", []), this.each(function () {
                    var t = !0,
                        i = null != e && e + "queueHooks",
                        o = x.timers,
                        s = q.get(this);if (i) s[i] && s[i].stop && r(s[i]);else for (i in s) s[i] && s[i].stop && Tn.test(i) && r(s[i]);for (i = o.length; i--;) o[i].elem !== this || null != e && o[i].queue !== e || (o[i].anim.stop(n), t = !1, o.splice(i, 1));(t || !n) && x.dequeue(this, e);
                });
            }, finish: function (e) {
                return e !== !1 && (e = e || "fx"), this.each(function () {
                    var t,
                        n = q.get(this),
                        r = n[e + "queue"],
                        i = n[e + "queueHooks"],
                        o = x.timers,
                        s = r ? r.length : 0;for (n.finish = !0, x.queue(this, e, []), i && i.cur && i.cur.finish && i.cur.finish.call(this), t = o.length; t--;) o[t].elem === this && o[t].queue === e && (o[t].anim.stop(!0), o.splice(t, 1));for (t = 0; s > t; t++) r[t] && r[t].finish && r[t].finish.call(this);delete n.finish;
                });
            } });function Ln(e, t) {
            var n,
                r = { height: e },
                i = 0;for (t = t ? 1 : 0; 4 > i; i += 2 - t) n = St[i], r["margin" + n] = r["padding" + n] = e;return t && (r.opacity = r.width = e), r;
        }x.each({ slideDown: Ln("show"), slideUp: Ln("hide"), slideToggle: Ln("toggle"), fadeIn: { opacity: "show" }, fadeOut: { opacity: "hide" }, fadeToggle: { opacity: "toggle" } }, function (e, t) {
            x.fn[e] = function (e, n, r) {
                return this.animate(t, e, n, r);
            };
        }), x.speed = function (e, t, n) {
            var r = e && "object" == typeof e ? x.extend({}, e) : { complete: n || !n && t || x.isFunction(e) && e, duration: e, easing: n && t || t && !x.isFunction(t) && t };return r.duration = x.fx.off ? 0 : "number" == typeof r.duration ? r.duration : r.duration in x.fx.speeds ? x.fx.speeds[r.duration] : x.fx.speeds._default, (null == r.queue || r.queue === !0) && (r.queue = "fx"), r.old = r.complete, r.complete = function () {
                x.isFunction(r.old) && r.old.call(this), r.queue && x.dequeue(this, r.queue);
            }, r;
        }, x.easing = { linear: function (e) {
                return e;
            }, swing: function (e) {
                return .5 - Math.cos(e * Math.PI) / 2;
            } }, x.timers = [], x.fx = An.prototype.init, x.fx.tick = function () {
            var e,
                t = x.timers,
                n = 0;for (vn = x.now(); t.length > n; n++) e = t[n], e() || t[n] !== e || t.splice(n--, 1);t.length || x.fx.stop(), vn = undefined;
        }, x.fx.timer = function (e) {
            e() && x.timers.push(e) && x.fx.start();
        }, x.fx.interval = 13, x.fx.start = function () {
            xn || (xn = setInterval(x.fx.tick, x.fx.interval));
        }, x.fx.stop = function () {
            clearInterval(xn), xn = null;
        }, x.fx.speeds = { slow: 600, fast: 200, _default: 400 }, x.fx.step = {}, x.expr && x.expr.filters && (x.expr.filters.animated = function (e) {
            return x.grep(x.timers, function (t) {
                return e === t.elem;
            }).length;
        }), x.fn.offset = function (e) {
            if (arguments.length) return e === undefined ? this : this.each(function (t) {
                x.offset.setOffset(this, e, t);
            });var t,
                n,
                i = this[0],
                o = { top: 0, left: 0 },
                s = i && i.ownerDocument;if (s) return t = s.documentElement, x.contains(t, i) ? (typeof i.getBoundingClientRect !== r && (o = i.getBoundingClientRect()), n = qn(s), { top: o.top + n.pageYOffset - t.clientTop, left: o.left + n.pageXOffset - t.clientLeft }) : o;
        }, x.offset = { setOffset: function (e, t, n) {
                var r,
                    i,
                    o,
                    s,
                    a,
                    u,
                    l,
                    c = x.css(e, "position"),
                    f = x(e),
                    p = {};"static" === c && (e.style.position = "relative"), a = f.offset(), o = x.css(e, "top"), u = x.css(e, "left"), l = ("absolute" === c || "fixed" === c) && (o + u).indexOf("auto") > -1, l ? (r = f.position(), s = r.top, i = r.left) : (s = parseFloat(o) || 0, i = parseFloat(u) || 0), x.isFunction(t) && (t = t.call(e, n, a)), null != t.top && (p.top = t.top - a.top + s), null != t.left && (p.left = t.left - a.left + i), "using" in t ? t.using.call(e, p) : f.css(p);
            } }, x.fn.extend({ position: function () {
                if (this[0]) {
                    var e,
                        t,
                        n = this[0],
                        r = { top: 0, left: 0 };return "fixed" === x.css(n, "position") ? t = n.getBoundingClientRect() : (e = this.offsetParent(), t = this.offset(), x.nodeName(e[0], "html") || (r = e.offset()), r.top += x.css(e[0], "borderTopWidth", !0), r.left += x.css(e[0], "borderLeftWidth", !0)), { top: t.top - r.top - x.css(n, "marginTop", !0), left: t.left - r.left - x.css(n, "marginLeft", !0) };
                }
            }, offsetParent: function () {
                return this.map(function () {
                    var e = this.offsetParent || s;while (e && !x.nodeName(e, "html") && "static" === x.css(e, "position")) e = e.offsetParent;return e || s;
                });
            } }), x.each({ scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function (t, n) {
            var r = "pageYOffset" === n;x.fn[t] = function (i) {
                return x.access(this, function (t, i, o) {
                    var s = qn(t);return o === undefined ? s ? s[n] : t[i] : (s ? s.scrollTo(r ? e.pageXOffset : o, r ? o : e.pageYOffset) : t[i] = o, undefined);
                }, t, i, arguments.length, null);
            };
        });function qn(e) {
            return x.isWindow(e) ? e : 9 === e.nodeType && e.defaultView;
        }x.each({ Height: "height", Width: "width" }, function (e, t) {
            x.each({ padding: "inner" + e, content: t, "": "outer" + e }, function (n, r) {
                x.fn[r] = function (r, i) {
                    var o = arguments.length && (n || "boolean" != typeof r),
                        s = n || (r === !0 || i === !0 ? "margin" : "border");return x.access(this, function (t, n, r) {
                        var i;return x.isWindow(t) ? t.document.documentElement["client" + e] : 9 === t.nodeType ? (i = t.documentElement, Math.max(t.body["scroll" + e], i["scroll" + e], t.body["offset" + e], i["offset" + e], i["client" + e])) : r === undefined ? x.css(t, n, s) : x.style(t, n, r, s);
                    }, t, o ? r : undefined, o, null);
                };
            });
        }), x.fn.size = function () {
            return this.length;
        }, x.fn.andSelf = x.fn.addBack, "object" == typeof module && "object" == typeof module.exports ? module.exports = x : "function" == typeof define && define.amd && define("jquery", [], function () {
            return x;
        }), "object" == typeof e && "object" == typeof e.document && (e.jQuery = e.$ = x);
    })(window);
    //     Underscore.js 1.5.2
    //     http://underscorejs.org
    //     (c) 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
    //     Underscore may be freely distributed under the MIT license.
    (function () {
        var n = this,
            t = n._,
            r = {},
            e = Array.prototype,
            u = Object.prototype,
            i = Function.prototype,
            a = e.push,
            o = e.slice,
            c = e.concat,
            l = u.toString,
            f = u.hasOwnProperty,
            s = e.forEach,
            p = e.map,
            h = e.reduce,
            v = e.reduceRight,
            g = e.filter,
            d = e.every,
            m = e.some,
            y = e.indexOf,
            b = e.lastIndexOf,
            x = Array.isArray,
            w = Object.keys,
            _ = i.bind,
            j = function (n) {
            return n instanceof j ? n : this instanceof j ? (this._wrapped = n, void 0) : new j(n);
        };"undefined" != typeof exports ? ("undefined" != typeof module && module.exports && (exports = module.exports = j), exports._ = j) : n._ = j, j.VERSION = "1.5.2";var A = j.each = j.forEach = function (n, t, e) {
            if (null != n) if (s && n.forEach === s) n.forEach(t, e);else if (n.length === +n.length) {
                for (var u = 0, i = n.length; i > u; u++) if (t.call(e, n[u], u, n) === r) return;
            } else for (var a = j.keys(n), u = 0, i = a.length; i > u; u++) if (t.call(e, n[a[u]], a[u], n) === r) return;
        };j.map = j.collect = function (n, t, r) {
            var e = [];return null == n ? e : p && n.map === p ? n.map(t, r) : (A(n, function (n, u, i) {
                e.push(t.call(r, n, u, i));
            }), e);
        };var E = "Reduce of empty array with no initial value";j.reduce = j.foldl = j.inject = function (n, t, r, e) {
            var u = arguments.length > 2;if (null == n && (n = []), h && n.reduce === h) return e && (t = j.bind(t, e)), u ? n.reduce(t, r) : n.reduce(t);if (A(n, function (n, i, a) {
                u ? r = t.call(e, r, n, i, a) : (r = n, u = !0);
            }), !u) throw new TypeError(E);return r;
        }, j.reduceRight = j.foldr = function (n, t, r, e) {
            var u = arguments.length > 2;if (null == n && (n = []), v && n.reduceRight === v) return e && (t = j.bind(t, e)), u ? n.reduceRight(t, r) : n.reduceRight(t);var i = n.length;if (i !== +i) {
                var a = j.keys(n);i = a.length;
            }if (A(n, function (o, c, l) {
                c = a ? a[--i] : --i, u ? r = t.call(e, r, n[c], c, l) : (r = n[c], u = !0);
            }), !u) throw new TypeError(E);return r;
        }, j.find = j.detect = function (n, t, r) {
            var e;return O(n, function (n, u, i) {
                return t.call(r, n, u, i) ? (e = n, !0) : void 0;
            }), e;
        }, j.filter = j.select = function (n, t, r) {
            var e = [];return null == n ? e : g && n.filter === g ? n.filter(t, r) : (A(n, function (n, u, i) {
                t.call(r, n, u, i) && e.push(n);
            }), e);
        }, j.reject = function (n, t, r) {
            return j.filter(n, function (n, e, u) {
                return !t.call(r, n, e, u);
            }, r);
        }, j.every = j.all = function (n, t, e) {
            t || (t = j.identity);var u = !0;return null == n ? u : d && n.every === d ? n.every(t, e) : (A(n, function (n, i, a) {
                return (u = u && t.call(e, n, i, a)) ? void 0 : r;
            }), !!u);
        };var O = j.some = j.any = function (n, t, e) {
            t || (t = j.identity);var u = !1;return null == n ? u : m && n.some === m ? n.some(t, e) : (A(n, function (n, i, a) {
                return u || (u = t.call(e, n, i, a)) ? r : void 0;
            }), !!u);
        };j.contains = j.include = function (n, t) {
            return null == n ? !1 : y && n.indexOf === y ? n.indexOf(t) != -1 : O(n, function (n) {
                return n === t;
            });
        }, j.invoke = function (n, t) {
            var r = o.call(arguments, 2),
                e = j.isFunction(t);return j.map(n, function (n) {
                return (e ? t : n[t]).apply(n, r);
            });
        }, j.pluck = function (n, t) {
            return j.map(n, function (n) {
                return n[t];
            });
        }, j.where = function (n, t, r) {
            return j.isEmpty(t) ? r ? void 0 : [] : j[r ? "find" : "filter"](n, function (n) {
                for (var r in t) if (t[r] !== n[r]) return !1;return !0;
            });
        }, j.findWhere = function (n, t) {
            return j.where(n, t, !0);
        }, j.max = function (n, t, r) {
            if (!t && j.isArray(n) && n[0] === +n[0] && n.length < 65535) return Math.max.apply(Math, n);if (!t && j.isEmpty(n)) return -1 / 0;var e = { computed: -1 / 0, value: -1 / 0 };return A(n, function (n, u, i) {
                var a = t ? t.call(r, n, u, i) : n;a > e.computed && (e = { value: n, computed: a });
            }), e.value;
        }, j.min = function (n, t, r) {
            if (!t && j.isArray(n) && n[0] === +n[0] && n.length < 65535) return Math.min.apply(Math, n);if (!t && j.isEmpty(n)) return 1 / 0;var e = { computed: 1 / 0, value: 1 / 0 };return A(n, function (n, u, i) {
                var a = t ? t.call(r, n, u, i) : n;a < e.computed && (e = { value: n, computed: a });
            }), e.value;
        }, j.shuffle = function (n) {
            var t,
                r = 0,
                e = [];return A(n, function (n) {
                t = j.random(r++), e[r - 1] = e[t], e[t] = n;
            }), e;
        }, j.sample = function (n, t, r) {
            return arguments.length < 2 || r ? n[j.random(n.length - 1)] : j.shuffle(n).slice(0, Math.max(0, t));
        };var k = function (n) {
            return j.isFunction(n) ? n : function (t) {
                return t[n];
            };
        };j.sortBy = function (n, t, r) {
            var e = k(t);return j.pluck(j.map(n, function (n, t, u) {
                return { value: n, index: t, criteria: e.call(r, n, t, u) };
            }).sort(function (n, t) {
                var r = n.criteria,
                    e = t.criteria;if (r !== e) {
                    if (r > e || r === void 0) return 1;if (e > r || e === void 0) return -1;
                }return n.index - t.index;
            }), "value");
        };var F = function (n) {
            return function (t, r, e) {
                var u = {},
                    i = null == r ? j.identity : k(r);return A(t, function (r, a) {
                    var o = i.call(e, r, a, t);n(u, o, r);
                }), u;
            };
        };j.groupBy = F(function (n, t, r) {
            (j.has(n, t) ? n[t] : n[t] = []).push(r);
        }), j.indexBy = F(function (n, t, r) {
            n[t] = r;
        }), j.countBy = F(function (n, t) {
            j.has(n, t) ? n[t]++ : n[t] = 1;
        }), j.sortedIndex = function (n, t, r, e) {
            r = null == r ? j.identity : k(r);for (var u = r.call(e, t), i = 0, a = n.length; a > i;) {
                var o = i + a >>> 1;r.call(e, n[o]) < u ? i = o + 1 : a = o;
            }return i;
        }, j.toArray = function (n) {
            return n ? j.isArray(n) ? o.call(n) : n.length === +n.length ? j.map(n, j.identity) : j.values(n) : [];
        }, j.size = function (n) {
            return null == n ? 0 : n.length === +n.length ? n.length : j.keys(n).length;
        }, j.first = j.head = j.take = function (n, t, r) {
            return null == n ? void 0 : null == t || r ? n[0] : o.call(n, 0, t);
        }, j.initial = function (n, t, r) {
            return o.call(n, 0, n.length - (null == t || r ? 1 : t));
        }, j.last = function (n, t, r) {
            return null == n ? void 0 : null == t || r ? n[n.length - 1] : o.call(n, Math.max(n.length - t, 0));
        }, j.rest = j.tail = j.drop = function (n, t, r) {
            return o.call(n, null == t || r ? 1 : t);
        }, j.compact = function (n) {
            return j.filter(n, j.identity);
        };var M = function (n, t, r) {
            return t && j.every(n, j.isArray) ? c.apply(r, n) : (A(n, function (n) {
                j.isArray(n) || j.isArguments(n) ? t ? a.apply(r, n) : M(n, t, r) : r.push(n);
            }), r);
        };j.flatten = function (n, t) {
            return M(n, t, []);
        }, j.without = function (n) {
            return j.difference(n, o.call(arguments, 1));
        }, j.uniq = j.unique = function (n, t, r, e) {
            j.isFunction(t) && (e = r, r = t, t = !1);var u = r ? j.map(n, r, e) : n,
                i = [],
                a = [];return A(u, function (r, e) {
                (t ? e && a[a.length - 1] === r : j.contains(a, r)) || (a.push(r), i.push(n[e]));
            }), i;
        }, j.union = function () {
            return j.uniq(j.flatten(arguments, !0));
        }, j.intersection = function (n) {
            var t = o.call(arguments, 1);return j.filter(j.uniq(n), function (n) {
                return j.every(t, function (t) {
                    return j.indexOf(t, n) >= 0;
                });
            });
        }, j.difference = function (n) {
            var t = c.apply(e, o.call(arguments, 1));return j.filter(n, function (n) {
                return !j.contains(t, n);
            });
        }, j.zip = function () {
            for (var n = j.max(j.pluck(arguments, "length").concat(0)), t = new Array(n), r = 0; n > r; r++) t[r] = j.pluck(arguments, "" + r);return t;
        }, j.object = function (n, t) {
            if (null == n) return {};for (var r = {}, e = 0, u = n.length; u > e; e++) t ? r[n[e]] = t[e] : r[n[e][0]] = n[e][1];return r;
        }, j.indexOf = function (n, t, r) {
            if (null == n) return -1;var e = 0,
                u = n.length;if (r) {
                if ("number" != typeof r) return e = j.sortedIndex(n, t), n[e] === t ? e : -1;e = 0 > r ? Math.max(0, u + r) : r;
            }if (y && n.indexOf === y) return n.indexOf(t, r);for (; u > e; e++) if (n[e] === t) return e;return -1;
        }, j.lastIndexOf = function (n, t, r) {
            if (null == n) return -1;var e = null != r;if (b && n.lastIndexOf === b) return e ? n.lastIndexOf(t, r) : n.lastIndexOf(t);for (var u = e ? r : n.length; u--;) if (n[u] === t) return u;return -1;
        }, j.range = function (n, t, r) {
            arguments.length <= 1 && (t = n || 0, n = 0), r = arguments[2] || 1;for (var e = Math.max(Math.ceil((t - n) / r), 0), u = 0, i = new Array(e); e > u;) i[u++] = n, n += r;return i;
        };var R = function () {};j.bind = function (n, t) {
            var r, e;if (_ && n.bind === _) return _.apply(n, o.call(arguments, 1));if (!j.isFunction(n)) throw new TypeError();return r = o.call(arguments, 2), e = function () {
                if (!(this instanceof e)) return n.apply(t, r.concat(o.call(arguments)));R.prototype = n.prototype;var u = new R();R.prototype = null;var i = n.apply(u, r.concat(o.call(arguments)));return Object(i) === i ? i : u;
            };
        }, j.partial = function (n) {
            var t = o.call(arguments, 1);return function () {
                return n.apply(this, t.concat(o.call(arguments)));
            };
        }, j.bindAll = function (n) {
            var t = o.call(arguments, 1);if (0 === t.length) throw new Error("bindAll must be passed function names");return A(t, function (t) {
                n[t] = j.bind(n[t], n);
            }), n;
        }, j.memoize = function (n, t) {
            var r = {};return t || (t = j.identity), function () {
                var e = t.apply(this, arguments);return j.has(r, e) ? r[e] : r[e] = n.apply(this, arguments);
            };
        }, j.delay = function (n, t) {
            var r = o.call(arguments, 2);return setTimeout(function () {
                return n.apply(null, r);
            }, t);
        }, j.defer = function (n) {
            return j.delay.apply(j, [n, 1].concat(o.call(arguments, 1)));
        }, j.throttle = function (n, t, r) {
            var e,
                u,
                i,
                a = null,
                o = 0;r || (r = {});var c = function () {
                o = r.leading === !1 ? 0 : new Date(), a = null, i = n.apply(e, u);
            };return function () {
                var l = new Date();o || r.leading !== !1 || (o = l);var f = t - (l - o);return e = this, u = arguments, 0 >= f ? (clearTimeout(a), a = null, o = l, i = n.apply(e, u)) : a || r.trailing === !1 || (a = setTimeout(c, f)), i;
            };
        }, j.debounce = function (n, t, r) {
            var e, u, i, a, o;return function () {
                i = this, u = arguments, a = new Date();var c = function () {
                    var l = new Date() - a;t > l ? e = setTimeout(c, t - l) : (e = null, r || (o = n.apply(i, u)));
                },
                    l = r && !e;return e || (e = setTimeout(c, t)), l && (o = n.apply(i, u)), o;
            };
        }, j.once = function (n) {
            var t,
                r = !1;return function () {
                return r ? t : (r = !0, t = n.apply(this, arguments), n = null, t);
            };
        }, j.wrap = function (n, t) {
            return function () {
                var r = [n];return a.apply(r, arguments), t.apply(this, r);
            };
        }, j.compose = function () {
            var n = arguments;return function () {
                for (var t = arguments, r = n.length - 1; r >= 0; r--) t = [n[r].apply(this, t)];return t[0];
            };
        }, j.after = function (n, t) {
            return function () {
                return --n < 1 ? t.apply(this, arguments) : void 0;
            };
        }, j.keys = w || function (n) {
            if (n !== Object(n)) throw new TypeError("Invalid object");var t = [];for (var r in n) j.has(n, r) && t.push(r);return t;
        }, j.values = function (n) {
            for (var t = j.keys(n), r = t.length, e = new Array(r), u = 0; r > u; u++) e[u] = n[t[u]];return e;
        }, j.pairs = function (n) {
            for (var t = j.keys(n), r = t.length, e = new Array(r), u = 0; r > u; u++) e[u] = [t[u], n[t[u]]];return e;
        }, j.invert = function (n) {
            for (var t = {}, r = j.keys(n), e = 0, u = r.length; u > e; e++) t[n[r[e]]] = r[e];return t;
        }, j.functions = j.methods = function (n) {
            var t = [];for (var r in n) j.isFunction(n[r]) && t.push(r);return t.sort();
        }, j.extend = function (n) {
            return A(o.call(arguments, 1), function (t) {
                if (t) for (var r in t) n[r] = t[r];
            }), n;
        }, j.pick = function (n) {
            var t = {},
                r = c.apply(e, o.call(arguments, 1));return A(r, function (r) {
                r in n && (t[r] = n[r]);
            }), t;
        }, j.omit = function (n) {
            var t = {},
                r = c.apply(e, o.call(arguments, 1));for (var u in n) j.contains(r, u) || (t[u] = n[u]);return t;
        }, j.defaults = function (n) {
            return A(o.call(arguments, 1), function (t) {
                if (t) for (var r in t) n[r] === void 0 && (n[r] = t[r]);
            }), n;
        }, j.clone = function (n) {
            return j.isObject(n) ? j.isArray(n) ? n.slice() : j.extend({}, n) : n;
        }, j.tap = function (n, t) {
            return t(n), n;
        };var S = function (n, t, r, e) {
            if (n === t) return 0 !== n || 1 / n == 1 / t;if (null == n || null == t) return n === t;n instanceof j && (n = n._wrapped), t instanceof j && (t = t._wrapped);var u = l.call(n);if (u != l.call(t)) return !1;switch (u) {case "[object String]":
                    return n == String(t);case "[object Number]":
                    return n != +n ? t != +t : 0 == n ? 1 / n == 1 / t : n == +t;case "[object Date]":case "[object Boolean]":
                    return +n == +t;case "[object RegExp]":
                    return n.source == t.source && n.global == t.global && n.multiline == t.multiline && n.ignoreCase == t.ignoreCase;}if ("object" != typeof n || "object" != typeof t) return !1;for (var i = r.length; i--;) if (r[i] == n) return e[i] == t;var a = n.constructor,
                o = t.constructor;if (a !== o && !(j.isFunction(a) && a instanceof a && j.isFunction(o) && o instanceof o)) return !1;r.push(n), e.push(t);var c = 0,
                f = !0;if ("[object Array]" == u) {
                if (c = n.length, f = c == t.length) for (; c-- && (f = S(n[c], t[c], r, e)););
            } else {
                for (var s in n) if (j.has(n, s) && (c++, !(f = j.has(t, s) && S(n[s], t[s], r, e)))) break;if (f) {
                    for (s in t) if (j.has(t, s) && !c--) break;f = !c;
                }
            }return r.pop(), e.pop(), f;
        };j.isEqual = function (n, t) {
            return S(n, t, [], []);
        }, j.isEmpty = function (n) {
            if (null == n) return !0;if (j.isArray(n) || j.isString(n)) return 0 === n.length;for (var t in n) if (j.has(n, t)) return !1;return !0;
        }, j.isElement = function (n) {
            return !(!n || 1 !== n.nodeType);
        }, j.isArray = x || function (n) {
            return "[object Array]" == l.call(n);
        }, j.isObject = function (n) {
            return n === Object(n);
        }, A(["Arguments", "Function", "String", "Number", "Date", "RegExp"], function (n) {
            j["is" + n] = function (t) {
                return l.call(t) == "[object " + n + "]";
            };
        }), j.isArguments(arguments) || (j.isArguments = function (n) {
            return !(!n || !j.has(n, "callee"));
        }), "function" != typeof /./ && (j.isFunction = function (n) {
            return "function" == typeof n;
        }), j.isFinite = function (n) {
            return isFinite(n) && !isNaN(parseFloat(n));
        }, j.isNaN = function (n) {
            return j.isNumber(n) && n != +n;
        }, j.isBoolean = function (n) {
            return n === !0 || n === !1 || "[object Boolean]" == l.call(n);
        }, j.isNull = function (n) {
            return null === n;
        }, j.isUndefined = function (n) {
            return n === void 0;
        }, j.has = function (n, t) {
            return f.call(n, t);
        }, j.noConflict = function () {
            return n._ = t, this;
        }, j.identity = function (n) {
            return n;
        }, j.times = function (n, t, r) {
            for (var e = Array(Math.max(0, n)), u = 0; n > u; u++) e[u] = t.call(r, u);return e;
        }, j.random = function (n, t) {
            return null == t && (t = n, n = 0), n + Math.floor(Math.random() * (t - n + 1));
        };var I = { escape: { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" } };I.unescape = j.invert(I.escape);var T = { escape: new RegExp("[" + j.keys(I.escape).join("") + "]", "g"), unescape: new RegExp("(" + j.keys(I.unescape).join("|") + ")", "g") };j.each(["escape", "unescape"], function (n) {
            j[n] = function (t) {
                return null == t ? "" : ("" + t).replace(T[n], function (t) {
                    return I[n][t];
                });
            };
        }), j.result = function (n, t) {
            if (null == n) return void 0;var r = n[t];return j.isFunction(r) ? r.call(n) : r;
        }, j.mixin = function (n) {
            A(j.functions(n), function (t) {
                var r = j[t] = n[t];j.prototype[t] = function () {
                    var n = [this._wrapped];return a.apply(n, arguments), z.call(this, r.apply(j, n));
                };
            });
        };var N = 0;j.uniqueId = function (n) {
            var t = ++N + "";return n ? n + t : t;
        }, j.templateSettings = { evaluate: /<%([\s\S]+?)%>/g, interpolate: /<%=([\s\S]+?)%>/g, escape: /<%-([\s\S]+?)%>/g };var q = /(.)^/,
            B = { "'": "'", "\\": "\\", "\r": "r", "\n": "n", "	": "t", "\u2028": "u2028", "\u2029": "u2029" },
            D = /\\|'|\r|\n|\t|\u2028|\u2029/g;j.template = function (n, t, r) {
            var e;r = j.defaults({}, r, j.templateSettings);var u = new RegExp([(r.escape || q).source, (r.interpolate || q).source, (r.evaluate || q).source].join("|") + "|$", "g"),
                i = 0,
                a = "__p+='";n.replace(u, function (t, r, e, u, o) {
                return a += n.slice(i, o).replace(D, function (n) {
                    return "\\" + B[n];
                }), r && (a += "'+\n((__t=(" + r + "))==null?'':_.escape(__t))+\n'"), e && (a += "'+\n((__t=(" + e + "))==null?'':__t)+\n'"), u && (a += "';\n" + u + "\n__p+='"), i = o + t.length, t;
            }), a += "';\n", r.variable || (a = "with(obj||{}){\n" + a + "}\n"), a = "var __t,__p='',__j=Array.prototype.join," + "print=function(){__p+=__j.call(arguments,'');};\n" + a + "return __p;\n";try {
                e = new Function(r.variable || "obj", "_", a);
            } catch (o) {
                throw o.source = a, o;
            }if (t) return e(t, j);var c = function (n) {
                return e.call(this, n, j);
            };return c.source = "function(" + (r.variable || "obj") + "){\n" + a + "}", c;
        }, j.chain = function (n) {
            return j(n).chain();
        };var z = function (n) {
            return this._chain ? j(n).chain() : n;
        };j.mixin(j), A(["pop", "push", "reverse", "shift", "sort", "splice", "unshift"], function (n) {
            var t = e[n];j.prototype[n] = function () {
                var r = this._wrapped;return t.apply(r, arguments), "shift" != n && "splice" != n || 0 !== r.length || delete r[0], z.call(this, r);
            };
        }), A(["concat", "join", "slice"], function (n) {
            var t = e[n];j.prototype[n] = function () {
                return z.call(this, t.apply(this._wrapped, arguments));
            };
        }), j.extend(j.prototype, { chain: function () {
                return this._chain = !0, this;
            }, value: function () {
                return this._wrapped;
            } });
    }).call(this);
    //# sourceMappingURL=underscore-min.map;
    define("underscore", function () {});

    /**!
    
     @license
     handlebars v4.0.10
    
    Copyright (C) 2011-2016 by Yehuda Katz
    
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
    
    */
    !function (a, b) {
        "object" == typeof exports && "object" == typeof module ? module.exports = b() : "function" == typeof define && define.amd ? define('Handlebars', [], b) : "object" == typeof exports ? exports.Handlebars = b() : a.Handlebars = b();
    }(this, function () {
        return function (a) {
            function b(d) {
                if (c[d]) return c[d].exports;var e = c[d] = { exports: {}, id: d, loaded: !1 };return a[d].call(e.exports, e, e.exports, b), e.loaded = !0, e.exports;
            }var c = {};return b.m = a, b.c = c, b.p = "", b(0);
        }([function (a, b, c) {
            "use strict";
            function d() {
                var a = r();return a.compile = function (b, c) {
                    return k.compile(b, c, a);
                }, a.precompile = function (b, c) {
                    return k.precompile(b, c, a);
                }, a.AST = i["default"], a.Compiler = k.Compiler, a.JavaScriptCompiler = m["default"], a.Parser = j.parser, a.parse = j.parse, a;
            }var e = c(1)["default"];b.__esModule = !0;var f = c(2),
                g = e(f),
                h = c(35),
                i = e(h),
                j = c(36),
                k = c(41),
                l = c(42),
                m = e(l),
                n = c(39),
                o = e(n),
                p = c(34),
                q = e(p),
                r = g["default"].create,
                s = d();s.create = d, q["default"](s), s.Visitor = o["default"], s["default"] = s, b["default"] = s, a.exports = b["default"];
        }, function (a, b) {
            "use strict";
            b["default"] = function (a) {
                return a && a.__esModule ? a : { "default": a };
            }, b.__esModule = !0;
        }, function (a, b, c) {
            "use strict";
            function d() {
                var a = new h.HandlebarsEnvironment();return n.extend(a, h), a.SafeString = j["default"], a.Exception = l["default"], a.Utils = n, a.escapeExpression = n.escapeExpression, a.VM = p, a.template = function (b) {
                    return p.template(b, a);
                }, a;
            }var e = c(3)["default"],
                f = c(1)["default"];b.__esModule = !0;var g = c(4),
                h = e(g),
                i = c(21),
                j = f(i),
                k = c(6),
                l = f(k),
                m = c(5),
                n = e(m),
                o = c(22),
                p = e(o),
                q = c(34),
                r = f(q),
                s = d();s.create = d, r["default"](s), s["default"] = s, b["default"] = s, a.exports = b["default"];
        }, function (a, b) {
            "use strict";
            b["default"] = function (a) {
                if (a && a.__esModule) return a;var b = {};if (null != a) for (var c in a) Object.prototype.hasOwnProperty.call(a, c) && (b[c] = a[c]);return b["default"] = a, b;
            }, b.__esModule = !0;
        }, function (a, b, c) {
            "use strict";
            function d(a, b, c) {
                this.helpers = a || {}, this.partials = b || {}, this.decorators = c || {}, i.registerDefaultHelpers(this), j.registerDefaultDecorators(this);
            }var e = c(1)["default"];b.__esModule = !0, b.HandlebarsEnvironment = d;var f = c(5),
                g = c(6),
                h = e(g),
                i = c(10),
                j = c(18),
                k = c(20),
                l = e(k),
                m = "4.0.10";b.VERSION = m;var n = 7;b.COMPILER_REVISION = n;var o = { 1: "<= 1.0.rc.2", 2: "== 1.0.0-rc.3", 3: "== 1.0.0-rc.4", 4: "== 1.x.x", 5: "== 2.0.0-alpha.x", 6: ">= 2.0.0-beta.1", 7: ">= 4.0.0" };b.REVISION_CHANGES = o;var p = "[object Object]";d.prototype = { constructor: d, logger: l["default"], log: l["default"].log, registerHelper: function (a, b) {
                    if (f.toString.call(a) === p) {
                        if (b) throw new h["default"]("Arg not supported with multiple helpers");f.extend(this.helpers, a);
                    } else this.helpers[a] = b;
                }, unregisterHelper: function (a) {
                    delete this.helpers[a];
                }, registerPartial: function (a, b) {
                    if (f.toString.call(a) === p) f.extend(this.partials, a);else {
                        if ("undefined" == typeof b) throw new h["default"]('Attempting to register a partial called "' + a + '" as undefined');this.partials[a] = b;
                    }
                }, unregisterPartial: function (a) {
                    delete this.partials[a];
                }, registerDecorator: function (a, b) {
                    if (f.toString.call(a) === p) {
                        if (b) throw new h["default"]("Arg not supported with multiple decorators");f.extend(this.decorators, a);
                    } else this.decorators[a] = b;
                }, unregisterDecorator: function (a) {
                    delete this.decorators[a];
                } };var q = l["default"].log;b.log = q, b.createFrame = f.createFrame, b.logger = l["default"];
        }, function (a, b) {
            "use strict";
            function c(a) {
                return k[a];
            }function d(a) {
                for (var b = 1; b < arguments.length; b++) for (var c in arguments[b]) Object.prototype.hasOwnProperty.call(arguments[b], c) && (a[c] = arguments[b][c]);return a;
            }function e(a, b) {
                for (var c = 0, d = a.length; c < d; c++) if (a[c] === b) return c;return -1;
            }function f(a) {
                if ("string" != typeof a) {
                    if (a && a.toHTML) return a.toHTML();if (null == a) return "";if (!a) return a + "";a = "" + a;
                }return m.test(a) ? a.replace(l, c) : a;
            }function g(a) {
                return !a && 0 !== a || !(!p(a) || 0 !== a.length);
            }function h(a) {
                var b = d({}, a);return b._parent = a, b;
            }function i(a, b) {
                return a.path = b, a;
            }function j(a, b) {
                return (a ? a + "." : "") + b;
            }b.__esModule = !0, b.extend = d, b.indexOf = e, b.escapeExpression = f, b.isEmpty = g, b.createFrame = h, b.blockParams = i, b.appendContextPath = j;var k = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;", "`": "&#x60;", "=": "&#x3D;" },
                l = /[&<>"'`=]/g,
                m = /[&<>"'`=]/,
                n = Object.prototype.toString;b.toString = n;var o = function (a) {
                return "function" == typeof a;
            };o(/x/) && (b.isFunction = o = function (a) {
                return "function" == typeof a && "[object Function]" === n.call(a);
            }), b.isFunction = o;var p = Array.isArray || function (a) {
                return !(!a || "object" != typeof a) && "[object Array]" === n.call(a);
            };b.isArray = p;
        }, function (a, b, c) {
            "use strict";
            function d(a, b) {
                var c = b && b.loc,
                    g = void 0,
                    h = void 0;c && (g = c.start.line, h = c.start.column, a += " - " + g + ":" + h);for (var i = Error.prototype.constructor.call(this, a), j = 0; j < f.length; j++) this[f[j]] = i[f[j]];Error.captureStackTrace && Error.captureStackTrace(this, d);try {
                    c && (this.lineNumber = g, e ? Object.defineProperty(this, "column", { value: h, enumerable: !0 }) : this.column = h);
                } catch (k) {}
            }var e = c(7)["default"];b.__esModule = !0;var f = ["description", "fileName", "lineNumber", "message", "name", "number", "stack"];d.prototype = new Error(), b["default"] = d, a.exports = b["default"];
        }, function (a, b, c) {
            a.exports = { "default": c(8), __esModule: !0 };
        }, function (a, b, c) {
            var d = c(9);a.exports = function (a, b, c) {
                return d.setDesc(a, b, c);
            };
        }, function (a, b) {
            var c = Object;a.exports = { create: c.create, getProto: c.getPrototypeOf, isEnum: {}.propertyIsEnumerable, getDesc: c.getOwnPropertyDescriptor, setDesc: c.defineProperty, setDescs: c.defineProperties, getKeys: c.keys, getNames: c.getOwnPropertyNames, getSymbols: c.getOwnPropertySymbols, each: [].forEach };
        }, function (a, b, c) {
            "use strict";
            function d(a) {
                g["default"](a), i["default"](a), k["default"](a), m["default"](a), o["default"](a), q["default"](a), s["default"](a);
            }var e = c(1)["default"];b.__esModule = !0, b.registerDefaultHelpers = d;var f = c(11),
                g = e(f),
                h = c(12),
                i = e(h),
                j = c(13),
                k = e(j),
                l = c(14),
                m = e(l),
                n = c(15),
                o = e(n),
                p = c(16),
                q = e(p),
                r = c(17),
                s = e(r);
        }, function (a, b, c) {
            "use strict";
            b.__esModule = !0;var d = c(5);b["default"] = function (a) {
                a.registerHelper("blockHelperMissing", function (b, c) {
                    var e = c.inverse,
                        f = c.fn;if (b === !0) return f(this);if (b === !1 || null == b) return e(this);if (d.isArray(b)) return b.length > 0 ? (c.ids && (c.ids = [c.name]), a.helpers.each(b, c)) : e(this);if (c.data && c.ids) {
                        var g = d.createFrame(c.data);g.contextPath = d.appendContextPath(c.data.contextPath, c.name), c = { data: g };
                    }return f(b, c);
                });
            }, a.exports = b["default"];
        }, function (a, b, c) {
            "use strict";
            var d = c(1)["default"];b.__esModule = !0;var e = c(5),
                f = c(6),
                g = d(f);b["default"] = function (a) {
                a.registerHelper("each", function (a, b) {
                    function c(b, c, f) {
                        j && (j.key = b, j.index = c, j.first = 0 === c, j.last = !!f, k && (j.contextPath = k + b)), i += d(a[b], { data: j, blockParams: e.blockParams([a[b], b], [k + b, null]) });
                    }if (!b) throw new g["default"]("Must pass iterator to #each");var d = b.fn,
                        f = b.inverse,
                        h = 0,
                        i = "",
                        j = void 0,
                        k = void 0;if (b.data && b.ids && (k = e.appendContextPath(b.data.contextPath, b.ids[0]) + "."), e.isFunction(a) && (a = a.call(this)), b.data && (j = e.createFrame(b.data)), a && "object" == typeof a) if (e.isArray(a)) for (var l = a.length; h < l; h++) h in a && c(h, h, h === a.length - 1);else {
                        var m = void 0;for (var n in a) a.hasOwnProperty(n) && (void 0 !== m && c(m, h - 1), m = n, h++);void 0 !== m && c(m, h - 1, !0);
                    }return 0 === h && (i = f(this)), i;
                });
            }, a.exports = b["default"];
        }, function (a, b, c) {
            "use strict";
            var d = c(1)["default"];b.__esModule = !0;var e = c(6),
                f = d(e);b["default"] = function (a) {
                a.registerHelper("helperMissing", function () {
                    if (1 !== arguments.length) throw new f["default"]('Missing helper: "' + arguments[arguments.length - 1].name + '"');
                });
            }, a.exports = b["default"];
        }, function (a, b, c) {
            "use strict";
            b.__esModule = !0;var d = c(5);b["default"] = function (a) {
                a.registerHelper("if", function (a, b) {
                    return d.isFunction(a) && (a = a.call(this)), !b.hash.includeZero && !a || d.isEmpty(a) ? b.inverse(this) : b.fn(this);
                }), a.registerHelper("unless", function (b, c) {
                    return a.helpers["if"].call(this, b, { fn: c.inverse, inverse: c.fn, hash: c.hash });
                });
            }, a.exports = b["default"];
        }, function (a, b) {
            "use strict";
            b.__esModule = !0, b["default"] = function (a) {
                a.registerHelper("log", function () {
                    for (var b = [void 0], c = arguments[arguments.length - 1], d = 0; d < arguments.length - 1; d++) b.push(arguments[d]);var e = 1;null != c.hash.level ? e = c.hash.level : c.data && null != c.data.level && (e = c.data.level), b[0] = e, a.log.apply(a, b);
                });
            }, a.exports = b["default"];
        }, function (a, b) {
            "use strict";
            b.__esModule = !0, b["default"] = function (a) {
                a.registerHelper("lookup", function (a, b) {
                    return a && a[b];
                });
            }, a.exports = b["default"];
        }, function (a, b, c) {
            "use strict";
            b.__esModule = !0;var d = c(5);b["default"] = function (a) {
                a.registerHelper("with", function (a, b) {
                    d.isFunction(a) && (a = a.call(this));var c = b.fn;if (d.isEmpty(a)) return b.inverse(this);var e = b.data;return b.data && b.ids && (e = d.createFrame(b.data), e.contextPath = d.appendContextPath(b.data.contextPath, b.ids[0])), c(a, { data: e, blockParams: d.blockParams([a], [e && e.contextPath]) });
                });
            }, a.exports = b["default"];
        }, function (a, b, c) {
            "use strict";
            function d(a) {
                g["default"](a);
            }var e = c(1)["default"];b.__esModule = !0, b.registerDefaultDecorators = d;var f = c(19),
                g = e(f);
        }, function (a, b, c) {
            "use strict";
            b.__esModule = !0;var d = c(5);b["default"] = function (a) {
                a.registerDecorator("inline", function (a, b, c, e) {
                    var f = a;return b.partials || (b.partials = {}, f = function (e, f) {
                        var g = c.partials;c.partials = d.extend({}, g, b.partials);var h = a(e, f);return c.partials = g, h;
                    }), b.partials[e.args[0]] = e.fn, f;
                });
            }, a.exports = b["default"];
        }, function (a, b, c) {
            "use strict";
            b.__esModule = !0;var d = c(5),
                e = { methodMap: ["debug", "info", "warn", "error"], level: "info", lookupLevel: function (a) {
                    if ("string" == typeof a) {
                        var b = d.indexOf(e.methodMap, a.toLowerCase());a = b >= 0 ? b : parseInt(a, 10);
                    }return a;
                }, log: function (a) {
                    if (a = e.lookupLevel(a), "undefined" != typeof console && e.lookupLevel(e.level) <= a) {
                        var b = e.methodMap[a];console[b] || (b = "log");for (var c = arguments.length, d = Array(c > 1 ? c - 1 : 0), f = 1; f < c; f++) d[f - 1] = arguments[f];console[b].apply(console, d);
                    }
                } };b["default"] = e, a.exports = b["default"];
        }, function (a, b) {
            "use strict";
            function c(a) {
                this.string = a;
            }b.__esModule = !0, c.prototype.toString = c.prototype.toHTML = function () {
                return "" + this.string;
            }, b["default"] = c, a.exports = b["default"];
        }, function (a, b, c) {
            "use strict";
            function d(a) {
                var b = a && a[0] || 1,
                    c = s.COMPILER_REVISION;if (b !== c) {
                    if (b < c) {
                        var d = s.REVISION_CHANGES[c],
                            e = s.REVISION_CHANGES[b];throw new r["default"]("Template was precompiled with an older version of Handlebars than the current runtime. Please update your precompiler to a newer version (" + d + ") or downgrade your runtime to an older version (" + e + ").");
                    }throw new r["default"]("Template was precompiled with a newer version of Handlebars than the current runtime. Please update your runtime to a newer version (" + a[1] + ").");
                }
            }function e(a, b) {
                function c(c, d, e) {
                    e.hash && (d = p.extend({}, d, e.hash), e.ids && (e.ids[0] = !0)), c = b.VM.resolvePartial.call(this, c, d, e);var f = b.VM.invokePartial.call(this, c, d, e);if (null == f && b.compile && (e.partials[e.name] = b.compile(c, a.compilerOptions, b), f = e.partials[e.name](d, e)), null != f) {
                        if (e.indent) {
                            for (var g = f.split("\n"), h = 0, i = g.length; h < i && (g[h] || h + 1 !== i); h++) g[h] = e.indent + g[h];f = g.join("\n");
                        }return f;
                    }throw new r["default"]("The partial " + e.name + " could not be compiled when running in runtime-only mode");
                }function d(b) {
                    function c(b) {
                        return "" + a.main(e, b, e.helpers, e.partials, g, i, h);
                    }var f = arguments.length <= 1 || void 0 === arguments[1] ? {} : arguments[1],
                        g = f.data;d._setup(f), !f.partial && a.useData && (g = j(b, g));var h = void 0,
                        i = a.useBlockParams ? [] : void 0;return a.useDepths && (h = f.depths ? b != f.depths[0] ? [b].concat(f.depths) : f.depths : [b]), (c = k(a.main, c, e, f.depths || [], g, i))(b, f);
                }if (!b) throw new r["default"]("No environment passed to template");if (!a || !a.main) throw new r["default"]("Unknown template object: " + typeof a);a.main.decorator = a.main_d, b.VM.checkRevision(a.compiler);var e = { strict: function (a, b) {
                        if (!(b in a)) throw new r["default"]('"' + b + '" not defined in ' + a);return a[b];
                    }, lookup: function (a, b) {
                        for (var c = a.length, d = 0; d < c; d++) if (a[d] && null != a[d][b]) return a[d][b];
                    }, lambda: function (a, b) {
                        return "function" == typeof a ? a.call(b) : a;
                    }, escapeExpression: p.escapeExpression, invokePartial: c, fn: function (b) {
                        var c = a[b];return c.decorator = a[b + "_d"], c;
                    }, programs: [], program: function (a, b, c, d, e) {
                        var g = this.programs[a],
                            h = this.fn(a);return b || e || d || c ? g = f(this, a, h, b, c, d, e) : g || (g = this.programs[a] = f(this, a, h)), g;
                    }, data: function (a, b) {
                        for (; a && b--;) a = a._parent;return a;
                    }, merge: function (a, b) {
                        var c = a || b;return a && b && a !== b && (c = p.extend({}, b, a)), c;
                    }, nullContext: l({}), noop: b.VM.noop, compilerInfo: a.compiler };return d.isTop = !0, d._setup = function (c) {
                    c.partial ? (e.helpers = c.helpers, e.partials = c.partials, e.decorators = c.decorators) : (e.helpers = e.merge(c.helpers, b.helpers), a.usePartial && (e.partials = e.merge(c.partials, b.partials)), (a.usePartial || a.useDecorators) && (e.decorators = e.merge(c.decorators, b.decorators)));
                }, d._child = function (b, c, d, g) {
                    if (a.useBlockParams && !d) throw new r["default"]("must pass block params");if (a.useDepths && !g) throw new r["default"]("must pass parent depths");return f(e, b, a[b], c, 0, d, g);
                }, d;
            }function f(a, b, c, d, e, f, g) {
                function h(b) {
                    var e = arguments.length <= 1 || void 0 === arguments[1] ? {} : arguments[1],
                        h = g;return !g || b == g[0] || b === a.nullContext && null === g[0] || (h = [b].concat(g)), c(a, b, a.helpers, a.partials, e.data || d, f && [e.blockParams].concat(f), h);
                }return h = k(c, h, a, g, d, f), h.program = b, h.depth = g ? g.length : 0, h.blockParams = e || 0, h;
            }function g(a, b, c) {
                return a ? a.call || c.name || (c.name = a, a = c.partials[a]) : a = "@partial-block" === c.name ? c.data["partial-block"] : c.partials[c.name], a;
            }function h(a, b, c) {
                var d = c.data && c.data["partial-block"];c.partial = !0, c.ids && (c.data.contextPath = c.ids[0] || c.data.contextPath);var e = void 0;if (c.fn && c.fn !== i && !function () {
                    c.data = s.createFrame(c.data);var a = c.fn;e = c.data["partial-block"] = function (b) {
                        var c = arguments.length <= 1 || void 0 === arguments[1] ? {} : arguments[1];return c.data = s.createFrame(c.data), c.data["partial-block"] = d, a(b, c);
                    }, a.partials && (c.partials = p.extend({}, c.partials, a.partials));
                }(), void 0 === a && e && (a = e), void 0 === a) throw new r["default"]("The partial " + c.name + " could not be found");if (a instanceof Function) return a(b, c);
            }function i() {
                return "";
            }function j(a, b) {
                return b && "root" in b || (b = b ? s.createFrame(b) : {}, b.root = a), b;
            }function k(a, b, c, d, e, f) {
                if (a.decorator) {
                    var g = {};b = a.decorator(b, g, c, d && d[0], e, f, d), p.extend(b, g);
                }return b;
            }var l = c(23)["default"],
                m = c(3)["default"],
                n = c(1)["default"];b.__esModule = !0, b.checkRevision = d, b.template = e, b.wrapProgram = f, b.resolvePartial = g, b.invokePartial = h, b.noop = i;var o = c(5),
                p = m(o),
                q = c(6),
                r = n(q),
                s = c(4);
        }, function (a, b, c) {
            a.exports = { "default": c(24), __esModule: !0 };
        }, function (a, b, c) {
            c(25), a.exports = c(30).Object.seal;
        }, function (a, b, c) {
            var d = c(26);c(27)("seal", function (a) {
                return function (b) {
                    return a && d(b) ? a(b) : b;
                };
            });
        }, function (a, b) {
            a.exports = function (a) {
                return "object" == typeof a ? null !== a : "function" == typeof a;
            };
        }, function (a, b, c) {
            var d = c(28),
                e = c(30),
                f = c(33);a.exports = function (a, b) {
                var c = (e.Object || {})[a] || Object[a],
                    g = {};g[a] = b(c), d(d.S + d.F * f(function () {
                    c(1);
                }), "Object", g);
            };
        }, function (a, b, c) {
            var d = c(29),
                e = c(30),
                f = c(31),
                g = "prototype",
                h = function (a, b, c) {
                var i,
                    j,
                    k,
                    l = a & h.F,
                    m = a & h.G,
                    n = a & h.S,
                    o = a & h.P,
                    p = a & h.B,
                    q = a & h.W,
                    r = m ? e : e[b] || (e[b] = {}),
                    s = m ? d : n ? d[b] : (d[b] || {})[g];m && (c = b);for (i in c) j = !l && s && i in s, j && i in r || (k = j ? s[i] : c[i], r[i] = m && "function" != typeof s[i] ? c[i] : p && j ? f(k, d) : q && s[i] == k ? function (a) {
                    var b = function (b) {
                        return this instanceof a ? new a(b) : a(b);
                    };return b[g] = a[g], b;
                }(k) : o && "function" == typeof k ? f(Function.call, k) : k, o && ((r[g] || (r[g] = {}))[i] = k));
            };h.F = 1, h.G = 2, h.S = 4, h.P = 8, h.B = 16, h.W = 32, a.exports = h;
        }, function (a, b) {
            var c = a.exports = "undefined" != typeof window && window.Math == Math ? window : "undefined" != typeof self && self.Math == Math ? self : Function("return this")();"number" == typeof __g && (__g = c);
        }, function (a, b) {
            var c = a.exports = { version: "1.2.6" };"number" == typeof __e && (__e = c);
        }, function (a, b, c) {
            var d = c(32);a.exports = function (a, b, c) {
                if (d(a), void 0 === b) return a;switch (c) {case 1:
                        return function (c) {
                            return a.call(b, c);
                        };case 2:
                        return function (c, d) {
                            return a.call(b, c, d);
                        };case 3:
                        return function (c, d, e) {
                            return a.call(b, c, d, e);
                        };}return function () {
                    return a.apply(b, arguments);
                };
            };
        }, function (a, b) {
            a.exports = function (a) {
                if ("function" != typeof a) throw TypeError(a + " is not a function!");return a;
            };
        }, function (a, b) {
            a.exports = function (a) {
                try {
                    return !!a();
                } catch (b) {
                    return !0;
                }
            };
        }, function (a, b) {
            (function (c) {
                "use strict";
                b.__esModule = !0, b["default"] = function (a) {
                    var b = "undefined" != typeof c ? c : window,
                        d = b.Handlebars;a.noConflict = function () {
                        return b.Handlebars === a && (b.Handlebars = d), a;
                    };
                }, a.exports = b["default"];
            }).call(b, function () {
                return this;
            }());
        }, function (a, b) {
            "use strict";
            b.__esModule = !0;var c = { helpers: { helperExpression: function (a) {
                        return "SubExpression" === a.type || ("MustacheStatement" === a.type || "BlockStatement" === a.type) && !!(a.params && a.params.length || a.hash);
                    }, scopedId: function (a) {
                        return (/^\.|this\b/.test(a.original)
                        );
                    }, simpleId: function (a) {
                        return 1 === a.parts.length && !c.helpers.scopedId(a) && !a.depth;
                    } } };b["default"] = c, a.exports = b["default"];
        }, function (a, b, c) {
            "use strict";
            function d(a, b) {
                if ("Program" === a.type) return a;h["default"].yy = n, n.locInfo = function (a) {
                    return new n.SourceLocation(b && b.srcName, a);
                };var c = new j["default"](b);return c.accept(h["default"].parse(a));
            }var e = c(1)["default"],
                f = c(3)["default"];b.__esModule = !0, b.parse = d;var g = c(37),
                h = e(g),
                i = c(38),
                j = e(i),
                k = c(40),
                l = f(k),
                m = c(5);b.parser = h["default"];var n = {};m.extend(n, l);
        }, function (a, b) {
            "use strict";
            b.__esModule = !0;var c = function () {
                function a() {
                    this.yy = {};
                }var b = { trace: function () {}, yy: {}, symbols_: { error: 2, root: 3, program: 4, EOF: 5, program_repetition0: 6, statement: 7, mustache: 8, block: 9, rawBlock: 10, partial: 11, partialBlock: 12, content: 13, COMMENT: 14, CONTENT: 15, openRawBlock: 16, rawBlock_repetition_plus0: 17, END_RAW_BLOCK: 18, OPEN_RAW_BLOCK: 19, helperName: 20, openRawBlock_repetition0: 21, openRawBlock_option0: 22, CLOSE_RAW_BLOCK: 23, openBlock: 24, block_option0: 25, closeBlock: 26, openInverse: 27, block_option1: 28, OPEN_BLOCK: 29, openBlock_repetition0: 30, openBlock_option0: 31, openBlock_option1: 32, CLOSE: 33, OPEN_INVERSE: 34, openInverse_repetition0: 35, openInverse_option0: 36, openInverse_option1: 37, openInverseChain: 38, OPEN_INVERSE_CHAIN: 39, openInverseChain_repetition0: 40, openInverseChain_option0: 41, openInverseChain_option1: 42, inverseAndProgram: 43, INVERSE: 44, inverseChain: 45, inverseChain_option0: 46, OPEN_ENDBLOCK: 47, OPEN: 48, mustache_repetition0: 49, mustache_option0: 50, OPEN_UNESCAPED: 51, mustache_repetition1: 52, mustache_option1: 53, CLOSE_UNESCAPED: 54, OPEN_PARTIAL: 55, partialName: 56, partial_repetition0: 57, partial_option0: 58, openPartialBlock: 59, OPEN_PARTIAL_BLOCK: 60, openPartialBlock_repetition0: 61, openPartialBlock_option0: 62, param: 63, sexpr: 64, OPEN_SEXPR: 65, sexpr_repetition0: 66, sexpr_option0: 67, CLOSE_SEXPR: 68, hash: 69, hash_repetition_plus0: 70, hashSegment: 71, ID: 72, EQUALS: 73, blockParams: 74, OPEN_BLOCK_PARAMS: 75, blockParams_repetition_plus0: 76, CLOSE_BLOCK_PARAMS: 77, path: 78, dataName: 79, STRING: 80, NUMBER: 81, BOOLEAN: 82, UNDEFINED: 83, NULL: 84, DATA: 85, pathSegments: 86, SEP: 87, $accept: 0, $end: 1 }, terminals_: { 2: "error", 5: "EOF", 14: "COMMENT", 15: "CONTENT", 18: "END_RAW_BLOCK", 19: "OPEN_RAW_BLOCK", 23: "CLOSE_RAW_BLOCK", 29: "OPEN_BLOCK", 33: "CLOSE", 34: "OPEN_INVERSE", 39: "OPEN_INVERSE_CHAIN", 44: "INVERSE", 47: "OPEN_ENDBLOCK", 48: "OPEN", 51: "OPEN_UNESCAPED", 54: "CLOSE_UNESCAPED", 55: "OPEN_PARTIAL", 60: "OPEN_PARTIAL_BLOCK", 65: "OPEN_SEXPR", 68: "CLOSE_SEXPR", 72: "ID", 73: "EQUALS", 75: "OPEN_BLOCK_PARAMS", 77: "CLOSE_BLOCK_PARAMS", 80: "STRING", 81: "NUMBER", 82: "BOOLEAN", 83: "UNDEFINED", 84: "NULL", 85: "DATA", 87: "SEP" }, productions_: [0, [3, 2], [4, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [13, 1], [10, 3], [16, 5], [9, 4], [9, 4], [24, 6], [27, 6], [38, 6], [43, 2], [45, 3], [45, 1], [26, 3], [8, 5], [8, 5], [11, 5], [12, 3], [59, 5], [63, 1], [63, 1], [64, 5], [69, 1], [71, 3], [74, 3], [20, 1], [20, 1], [20, 1], [20, 1], [20, 1], [20, 1], [20, 1], [56, 1], [56, 1], [79, 2], [78, 1], [86, 3], [86, 1], [6, 0], [6, 2], [17, 1], [17, 2], [21, 0], [21, 2], [22, 0], [22, 1], [25, 0], [25, 1], [28, 0], [28, 1], [30, 0], [30, 2], [31, 0], [31, 1], [32, 0], [32, 1], [35, 0], [35, 2], [36, 0], [36, 1], [37, 0], [37, 1], [40, 0], [40, 2], [41, 0], [41, 1], [42, 0], [42, 1], [46, 0], [46, 1], [49, 0], [49, 2], [50, 0], [50, 1], [52, 0], [52, 2], [53, 0], [53, 1], [57, 0], [57, 2], [58, 0], [58, 1], [61, 0], [61, 2], [62, 0], [62, 1], [66, 0], [66, 2], [67, 0], [67, 1], [70, 1], [70, 2], [76, 1], [76, 2]], performAction: function (a, b, c, d, e, f, g) {
                        var h = f.length - 1;switch (e) {case 1:
                                return f[h - 1];case 2:
                                this.$ = d.prepareProgram(f[h]);break;case 3:
                                this.$ = f[h];break;case 4:
                                this.$ = f[h];break;case 5:
                                this.$ = f[h];break;case 6:
                                this.$ = f[h];break;case 7:
                                this.$ = f[h];break;case 8:
                                this.$ = f[h];break;case 9:
                                this.$ = { type: "CommentStatement", value: d.stripComment(f[h]), strip: d.stripFlags(f[h], f[h]), loc: d.locInfo(this._$) };break;case 10:
                                this.$ = { type: "ContentStatement", original: f[h], value: f[h], loc: d.locInfo(this._$) };break;case 11:
                                this.$ = d.prepareRawBlock(f[h - 2], f[h - 1], f[h], this._$);break;case 12:
                                this.$ = { path: f[h - 3], params: f[h - 2], hash: f[h - 1] };break;case 13:
                                this.$ = d.prepareBlock(f[h - 3], f[h - 2], f[h - 1], f[h], !1, this._$);break;case 14:
                                this.$ = d.prepareBlock(f[h - 3], f[h - 2], f[h - 1], f[h], !0, this._$);break;case 15:
                                this.$ = { open: f[h - 5], path: f[h - 4], params: f[h - 3], hash: f[h - 2], blockParams: f[h - 1], strip: d.stripFlags(f[h - 5], f[h]) };break;case 16:
                                this.$ = { path: f[h - 4], params: f[h - 3], hash: f[h - 2], blockParams: f[h - 1], strip: d.stripFlags(f[h - 5], f[h]) };break;case 17:
                                this.$ = { path: f[h - 4], params: f[h - 3], hash: f[h - 2], blockParams: f[h - 1], strip: d.stripFlags(f[h - 5], f[h]) };break;case 18:
                                this.$ = { strip: d.stripFlags(f[h - 1], f[h - 1]), program: f[h] };break;case 19:
                                var i = d.prepareBlock(f[h - 2], f[h - 1], f[h], f[h], !1, this._$),
                                    j = d.prepareProgram([i], f[h - 1].loc);j.chained = !0, this.$ = { strip: f[h - 2].strip, program: j, chain: !0 };break;case 20:
                                this.$ = f[h];break;case 21:
                                this.$ = { path: f[h - 1], strip: d.stripFlags(f[h - 2], f[h]) };break;case 22:
                                this.$ = d.prepareMustache(f[h - 3], f[h - 2], f[h - 1], f[h - 4], d.stripFlags(f[h - 4], f[h]), this._$);break;case 23:
                                this.$ = d.prepareMustache(f[h - 3], f[h - 2], f[h - 1], f[h - 4], d.stripFlags(f[h - 4], f[h]), this._$);break;case 24:
                                this.$ = { type: "PartialStatement", name: f[h - 3], params: f[h - 2], hash: f[h - 1], indent: "", strip: d.stripFlags(f[h - 4], f[h]), loc: d.locInfo(this._$) };break;case 25:
                                this.$ = d.preparePartialBlock(f[h - 2], f[h - 1], f[h], this._$);break;case 26:
                                this.$ = { path: f[h - 3], params: f[h - 2], hash: f[h - 1], strip: d.stripFlags(f[h - 4], f[h]) };break;case 27:
                                this.$ = f[h];break;case 28:
                                this.$ = f[h];break;case 29:
                                this.$ = { type: "SubExpression", path: f[h - 3], params: f[h - 2], hash: f[h - 1], loc: d.locInfo(this._$) };break;case 30:
                                this.$ = { type: "Hash", pairs: f[h], loc: d.locInfo(this._$) };break;case 31:
                                this.$ = { type: "HashPair", key: d.id(f[h - 2]), value: f[h], loc: d.locInfo(this._$) };break;case 32:
                                this.$ = d.id(f[h - 1]);break;case 33:
                                this.$ = f[h];break;case 34:
                                this.$ = f[h];break;case 35:
                                this.$ = { type: "StringLiteral", value: f[h], original: f[h], loc: d.locInfo(this._$) };break;case 36:
                                this.$ = { type: "NumberLiteral", value: Number(f[h]), original: Number(f[h]), loc: d.locInfo(this._$) };break;case 37:
                                this.$ = { type: "BooleanLiteral", value: "true" === f[h], original: "true" === f[h], loc: d.locInfo(this._$) };break;case 38:
                                this.$ = { type: "UndefinedLiteral", original: void 0, value: void 0, loc: d.locInfo(this._$) };break;case 39:
                                this.$ = { type: "NullLiteral", original: null, value: null, loc: d.locInfo(this._$) };break;case 40:
                                this.$ = f[h];break;case 41:
                                this.$ = f[h];break;case 42:
                                this.$ = d.preparePath(!0, f[h], this._$);break;case 43:
                                this.$ = d.preparePath(!1, f[h], this._$);break;case 44:
                                f[h - 2].push({ part: d.id(f[h]), original: f[h], separator: f[h - 1] }), this.$ = f[h - 2];break;case 45:
                                this.$ = [{ part: d.id(f[h]), original: f[h] }];break;case 46:
                                this.$ = [];break;case 47:
                                f[h - 1].push(f[h]);break;case 48:
                                this.$ = [f[h]];break;case 49:
                                f[h - 1].push(f[h]);break;case 50:
                                this.$ = [];break;case 51:
                                f[h - 1].push(f[h]);break;case 58:
                                this.$ = [];break;case 59:
                                f[h - 1].push(f[h]);break;case 64:
                                this.$ = [];break;case 65:
                                f[h - 1].push(f[h]);break;case 70:
                                this.$ = [];break;case 71:
                                f[h - 1].push(f[h]);break;case 78:
                                this.$ = [];break;case 79:
                                f[h - 1].push(f[h]);break;case 82:
                                this.$ = [];break;case 83:
                                f[h - 1].push(f[h]);break;case 86:
                                this.$ = [];break;case 87:
                                f[h - 1].push(f[h]);break;case 90:
                                this.$ = [];break;case 91:
                                f[h - 1].push(f[h]);break;case 94:
                                this.$ = [];break;case 95:
                                f[h - 1].push(f[h]);break;case 98:
                                this.$ = [f[h]];break;case 99:
                                f[h - 1].push(f[h]);break;case 100:
                                this.$ = [f[h]];break;case 101:
                                f[h - 1].push(f[h]);}
                    }, table: [{ 3: 1, 4: 2, 5: [2, 46], 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 1: [3] }, { 5: [1, 4] }, { 5: [2, 2], 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 14: [1, 12], 15: [1, 20], 16: 17, 19: [1, 23], 24: 15, 27: 16, 29: [1, 21], 34: [1, 22], 39: [2, 2], 44: [2, 2], 47: [2, 2], 48: [1, 13], 51: [1, 14], 55: [1, 18], 59: 19, 60: [1, 24] }, { 1: [2, 1] }, { 5: [2, 47], 14: [2, 47], 15: [2, 47], 19: [2, 47], 29: [2, 47], 34: [2, 47], 39: [2, 47], 44: [2, 47], 47: [2, 47], 48: [2, 47], 51: [2, 47], 55: [2, 47], 60: [2, 47] }, { 5: [2, 3], 14: [2, 3], 15: [2, 3], 19: [2, 3], 29: [2, 3], 34: [2, 3], 39: [2, 3], 44: [2, 3], 47: [2, 3], 48: [2, 3], 51: [2, 3], 55: [2, 3], 60: [2, 3] }, { 5: [2, 4], 14: [2, 4], 15: [2, 4], 19: [2, 4], 29: [2, 4], 34: [2, 4], 39: [2, 4], 44: [2, 4], 47: [2, 4], 48: [2, 4], 51: [2, 4], 55: [2, 4], 60: [2, 4] }, { 5: [2, 5], 14: [2, 5], 15: [2, 5], 19: [2, 5], 29: [2, 5], 34: [2, 5], 39: [2, 5], 44: [2, 5], 47: [2, 5], 48: [2, 5], 51: [2, 5], 55: [2, 5], 60: [2, 5] }, { 5: [2, 6], 14: [2, 6], 15: [2, 6], 19: [2, 6], 29: [2, 6], 34: [2, 6], 39: [2, 6], 44: [2, 6], 47: [2, 6], 48: [2, 6], 51: [2, 6], 55: [2, 6], 60: [2, 6] }, { 5: [2, 7], 14: [2, 7], 15: [2, 7], 19: [2, 7], 29: [2, 7], 34: [2, 7], 39: [2, 7], 44: [2, 7], 47: [2, 7], 48: [2, 7], 51: [2, 7], 55: [2, 7], 60: [2, 7] }, { 5: [2, 8], 14: [2, 8], 15: [2, 8], 19: [2, 8], 29: [2, 8], 34: [2, 8], 39: [2, 8], 44: [2, 8], 47: [2, 8], 48: [2, 8], 51: [2, 8], 55: [2, 8], 60: [2, 8] }, { 5: [2, 9], 14: [2, 9], 15: [2, 9], 19: [2, 9], 29: [2, 9], 34: [2, 9], 39: [2, 9], 44: [2, 9], 47: [2, 9], 48: [2, 9], 51: [2, 9], 55: [2, 9], 60: [2, 9] }, { 20: 25, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 36, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 4: 37, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 39: [2, 46], 44: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 4: 38, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 44: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 13: 40, 15: [1, 20], 17: 39 }, { 20: 42, 56: 41, 64: 43, 65: [1, 44], 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 4: 45, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 5: [2, 10], 14: [2, 10], 15: [2, 10], 18: [2, 10], 19: [2, 10], 29: [2, 10], 34: [2, 10], 39: [2, 10], 44: [2, 10], 47: [2, 10], 48: [2, 10], 51: [2, 10], 55: [2, 10], 60: [2, 10] }, { 20: 46, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 47, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 48, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 42, 56: 49, 64: 43, 65: [1, 44], 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 33: [2, 78], 49: 50, 65: [2, 78], 72: [2, 78], 80: [2, 78], 81: [2, 78], 82: [2, 78], 83: [2, 78], 84: [2, 78], 85: [2, 78] }, { 23: [2, 33], 33: [2, 33], 54: [2, 33], 65: [2, 33], 68: [2, 33], 72: [2, 33], 75: [2, 33], 80: [2, 33], 81: [2, 33], 82: [2, 33], 83: [2, 33], 84: [2, 33], 85: [2, 33] }, { 23: [2, 34], 33: [2, 34], 54: [2, 34], 65: [2, 34], 68: [2, 34], 72: [2, 34], 75: [2, 34], 80: [2, 34], 81: [2, 34], 82: [2, 34], 83: [2, 34], 84: [2, 34], 85: [2, 34] }, { 23: [2, 35], 33: [2, 35], 54: [2, 35], 65: [2, 35], 68: [2, 35], 72: [2, 35], 75: [2, 35], 80: [2, 35], 81: [2, 35], 82: [2, 35], 83: [2, 35], 84: [2, 35], 85: [2, 35] }, { 23: [2, 36], 33: [2, 36], 54: [2, 36], 65: [2, 36], 68: [2, 36], 72: [2, 36], 75: [2, 36], 80: [2, 36], 81: [2, 36], 82: [2, 36], 83: [2, 36], 84: [2, 36], 85: [2, 36] }, { 23: [2, 37], 33: [2, 37], 54: [2, 37], 65: [2, 37], 68: [2, 37], 72: [2, 37], 75: [2, 37], 80: [2, 37], 81: [2, 37], 82: [2, 37], 83: [2, 37], 84: [2, 37], 85: [2, 37] }, { 23: [2, 38], 33: [2, 38], 54: [2, 38], 65: [2, 38], 68: [2, 38], 72: [2, 38], 75: [2, 38], 80: [2, 38], 81: [2, 38], 82: [2, 38], 83: [2, 38], 84: [2, 38], 85: [2, 38] }, { 23: [2, 39], 33: [2, 39], 54: [2, 39], 65: [2, 39], 68: [2, 39], 72: [2, 39], 75: [2, 39], 80: [2, 39], 81: [2, 39], 82: [2, 39], 83: [2, 39], 84: [2, 39], 85: [2, 39] }, { 23: [2, 43], 33: [2, 43], 54: [2, 43], 65: [2, 43], 68: [2, 43], 72: [2, 43], 75: [2, 43], 80: [2, 43], 81: [2, 43], 82: [2, 43], 83: [2, 43], 84: [2, 43], 85: [2, 43], 87: [1, 51] }, { 72: [1, 35], 86: 52 }, { 23: [2, 45], 33: [2, 45], 54: [2, 45], 65: [2, 45], 68: [2, 45], 72: [2, 45], 75: [2, 45], 80: [2, 45], 81: [2, 45], 82: [2, 45], 83: [2, 45], 84: [2, 45], 85: [2, 45], 87: [2, 45] }, { 52: 53, 54: [2, 82], 65: [2, 82], 72: [2, 82], 80: [2, 82], 81: [2, 82], 82: [2, 82], 83: [2, 82], 84: [2, 82], 85: [2, 82] }, { 25: 54, 38: 56, 39: [1, 58], 43: 57, 44: [1, 59], 45: 55, 47: [2, 54] }, { 28: 60, 43: 61, 44: [1, 59], 47: [2, 56] }, { 13: 63, 15: [1, 20], 18: [1, 62] }, { 15: [2, 48], 18: [2, 48] }, { 33: [2, 86], 57: 64, 65: [2, 86], 72: [2, 86], 80: [2, 86], 81: [2, 86], 82: [2, 86], 83: [2, 86], 84: [2, 86], 85: [2, 86] }, { 33: [2, 40], 65: [2, 40], 72: [2, 40], 80: [2, 40], 81: [2, 40], 82: [2, 40], 83: [2, 40], 84: [2, 40], 85: [2, 40] }, { 33: [2, 41], 65: [2, 41], 72: [2, 41], 80: [2, 41], 81: [2, 41], 82: [2, 41], 83: [2, 41], 84: [2, 41], 85: [2, 41] }, { 20: 65, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 26: 66, 47: [1, 67] }, { 30: 68, 33: [2, 58], 65: [2, 58], 72: [2, 58], 75: [2, 58], 80: [2, 58], 81: [2, 58], 82: [2, 58], 83: [2, 58], 84: [2, 58], 85: [2, 58] }, { 33: [2, 64], 35: 69, 65: [2, 64], 72: [2, 64], 75: [2, 64], 80: [2, 64], 81: [2, 64], 82: [2, 64], 83: [2, 64], 84: [2, 64], 85: [2, 64] }, { 21: 70, 23: [2, 50], 65: [2, 50], 72: [2, 50], 80: [2, 50], 81: [2, 50], 82: [2, 50], 83: [2, 50], 84: [2, 50], 85: [2, 50] }, { 33: [2, 90], 61: 71, 65: [2, 90], 72: [2, 90], 80: [2, 90], 81: [2, 90], 82: [2, 90], 83: [2, 90], 84: [2, 90], 85: [2, 90] }, { 20: 75, 33: [2, 80], 50: 72, 63: 73, 64: 76, 65: [1, 44], 69: 74, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 72: [1, 80] }, { 23: [2, 42], 33: [2, 42], 54: [2, 42], 65: [2, 42], 68: [2, 42], 72: [2, 42], 75: [2, 42], 80: [2, 42], 81: [2, 42], 82: [2, 42], 83: [2, 42], 84: [2, 42], 85: [2, 42], 87: [1, 51] }, { 20: 75, 53: 81, 54: [2, 84], 63: 82, 64: 76, 65: [1, 44], 69: 83, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 26: 84, 47: [1, 67] }, { 47: [2, 55] }, { 4: 85, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 39: [2, 46], 44: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 47: [2, 20] }, { 20: 86, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 4: 87, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 26: 88, 47: [1, 67] }, { 47: [2, 57] }, { 5: [2, 11], 14: [2, 11], 15: [2, 11], 19: [2, 11], 29: [2, 11], 34: [2, 11], 39: [2, 11], 44: [2, 11], 47: [2, 11], 48: [2, 11], 51: [2, 11], 55: [2, 11], 60: [2, 11] }, { 15: [2, 49], 18: [2, 49] }, { 20: 75, 33: [2, 88], 58: 89, 63: 90, 64: 76, 65: [1, 44], 69: 91, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 65: [2, 94], 66: 92, 68: [2, 94], 72: [2, 94], 80: [2, 94], 81: [2, 94], 82: [2, 94], 83: [2, 94], 84: [2, 94], 85: [2, 94] }, { 5: [2, 25], 14: [2, 25], 15: [2, 25], 19: [2, 25], 29: [2, 25], 34: [2, 25], 39: [2, 25], 44: [2, 25], 47: [2, 25], 48: [2, 25], 51: [2, 25], 55: [2, 25], 60: [2, 25] }, { 20: 93, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 31: 94, 33: [2, 60], 63: 95, 64: 76, 65: [1, 44], 69: 96, 70: 77, 71: 78, 72: [1, 79], 75: [2, 60], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 33: [2, 66], 36: 97, 63: 98, 64: 76, 65: [1, 44], 69: 99, 70: 77, 71: 78, 72: [1, 79], 75: [2, 66], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 22: 100, 23: [2, 52], 63: 101, 64: 76, 65: [1, 44], 69: 102, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 33: [2, 92], 62: 103, 63: 104, 64: 76, 65: [1, 44], 69: 105, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 33: [1, 106] }, { 33: [2, 79], 65: [2, 79], 72: [2, 79], 80: [2, 79], 81: [2, 79], 82: [2, 79], 83: [2, 79], 84: [2, 79], 85: [2, 79] }, { 33: [2, 81] }, { 23: [2, 27], 33: [2, 27], 54: [2, 27], 65: [2, 27], 68: [2, 27], 72: [2, 27], 75: [2, 27], 80: [2, 27], 81: [2, 27], 82: [2, 27], 83: [2, 27], 84: [2, 27], 85: [2, 27] }, { 23: [2, 28], 33: [2, 28], 54: [2, 28], 65: [2, 28], 68: [2, 28], 72: [2, 28], 75: [2, 28], 80: [2, 28], 81: [2, 28], 82: [2, 28], 83: [2, 28], 84: [2, 28], 85: [2, 28] }, { 23: [2, 30], 33: [2, 30], 54: [2, 30], 68: [2, 30], 71: 107, 72: [1, 108], 75: [2, 30] }, { 23: [2, 98], 33: [2, 98], 54: [2, 98], 68: [2, 98], 72: [2, 98], 75: [2, 98] }, { 23: [2, 45], 33: [2, 45], 54: [2, 45], 65: [2, 45], 68: [2, 45], 72: [2, 45], 73: [1, 109], 75: [2, 45], 80: [2, 45], 81: [2, 45], 82: [2, 45], 83: [2, 45], 84: [2, 45], 85: [2, 45], 87: [2, 45] }, { 23: [2, 44], 33: [2, 44], 54: [2, 44], 65: [2, 44], 68: [2, 44], 72: [2, 44], 75: [2, 44], 80: [2, 44], 81: [2, 44], 82: [2, 44], 83: [2, 44], 84: [2, 44], 85: [2, 44], 87: [2, 44] }, { 54: [1, 110] }, { 54: [2, 83], 65: [2, 83], 72: [2, 83], 80: [2, 83], 81: [2, 83], 82: [2, 83], 83: [2, 83], 84: [2, 83], 85: [2, 83] }, { 54: [2, 85] }, { 5: [2, 13], 14: [2, 13], 15: [2, 13], 19: [2, 13], 29: [2, 13], 34: [2, 13], 39: [2, 13], 44: [2, 13], 47: [2, 13], 48: [2, 13], 51: [2, 13], 55: [2, 13], 60: [2, 13] }, { 38: 56, 39: [1, 58], 43: 57, 44: [1, 59], 45: 112, 46: 111, 47: [2, 76] }, { 33: [2, 70], 40: 113, 65: [2, 70], 72: [2, 70], 75: [2, 70], 80: [2, 70], 81: [2, 70], 82: [2, 70], 83: [2, 70], 84: [2, 70], 85: [2, 70] }, { 47: [2, 18] }, { 5: [2, 14], 14: [2, 14], 15: [2, 14], 19: [2, 14], 29: [2, 14], 34: [2, 14], 39: [2, 14], 44: [2, 14], 47: [2, 14], 48: [2, 14], 51: [2, 14], 55: [2, 14], 60: [2, 14] }, { 33: [1, 114] }, { 33: [2, 87], 65: [2, 87], 72: [2, 87], 80: [2, 87], 81: [2, 87], 82: [2, 87], 83: [2, 87], 84: [2, 87],
                        85: [2, 87] }, { 33: [2, 89] }, { 20: 75, 63: 116, 64: 76, 65: [1, 44], 67: 115, 68: [2, 96], 69: 117, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 33: [1, 118] }, { 32: 119, 33: [2, 62], 74: 120, 75: [1, 121] }, { 33: [2, 59], 65: [2, 59], 72: [2, 59], 75: [2, 59], 80: [2, 59], 81: [2, 59], 82: [2, 59], 83: [2, 59], 84: [2, 59], 85: [2, 59] }, { 33: [2, 61], 75: [2, 61] }, { 33: [2, 68], 37: 122, 74: 123, 75: [1, 121] }, { 33: [2, 65], 65: [2, 65], 72: [2, 65], 75: [2, 65], 80: [2, 65], 81: [2, 65], 82: [2, 65], 83: [2, 65], 84: [2, 65], 85: [2, 65] }, { 33: [2, 67], 75: [2, 67] }, { 23: [1, 124] }, { 23: [2, 51], 65: [2, 51], 72: [2, 51], 80: [2, 51], 81: [2, 51], 82: [2, 51], 83: [2, 51], 84: [2, 51], 85: [2, 51] }, { 23: [2, 53] }, { 33: [1, 125] }, { 33: [2, 91], 65: [2, 91], 72: [2, 91], 80: [2, 91], 81: [2, 91], 82: [2, 91], 83: [2, 91], 84: [2, 91], 85: [2, 91] }, { 33: [2, 93] }, { 5: [2, 22], 14: [2, 22], 15: [2, 22], 19: [2, 22], 29: [2, 22], 34: [2, 22], 39: [2, 22], 44: [2, 22], 47: [2, 22], 48: [2, 22], 51: [2, 22], 55: [2, 22], 60: [2, 22] }, { 23: [2, 99], 33: [2, 99], 54: [2, 99], 68: [2, 99], 72: [2, 99], 75: [2, 99] }, { 73: [1, 109] }, { 20: 75, 63: 126, 64: 76, 65: [1, 44], 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 5: [2, 23], 14: [2, 23], 15: [2, 23], 19: [2, 23], 29: [2, 23], 34: [2, 23], 39: [2, 23], 44: [2, 23], 47: [2, 23], 48: [2, 23], 51: [2, 23], 55: [2, 23], 60: [2, 23] }, { 47: [2, 19] }, { 47: [2, 77] }, { 20: 75, 33: [2, 72], 41: 127, 63: 128, 64: 76, 65: [1, 44], 69: 129, 70: 77, 71: 78, 72: [1, 79], 75: [2, 72], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 5: [2, 24], 14: [2, 24], 15: [2, 24], 19: [2, 24], 29: [2, 24], 34: [2, 24], 39: [2, 24], 44: [2, 24], 47: [2, 24], 48: [2, 24], 51: [2, 24], 55: [2, 24], 60: [2, 24] }, { 68: [1, 130] }, { 65: [2, 95], 68: [2, 95], 72: [2, 95], 80: [2, 95], 81: [2, 95], 82: [2, 95], 83: [2, 95], 84: [2, 95], 85: [2, 95] }, { 68: [2, 97] }, { 5: [2, 21], 14: [2, 21], 15: [2, 21], 19: [2, 21], 29: [2, 21], 34: [2, 21], 39: [2, 21], 44: [2, 21], 47: [2, 21], 48: [2, 21], 51: [2, 21], 55: [2, 21], 60: [2, 21] }, { 33: [1, 131] }, { 33: [2, 63] }, { 72: [1, 133], 76: 132 }, { 33: [1, 134] }, { 33: [2, 69] }, { 15: [2, 12] }, { 14: [2, 26], 15: [2, 26], 19: [2, 26], 29: [2, 26], 34: [2, 26], 47: [2, 26], 48: [2, 26], 51: [2, 26], 55: [2, 26], 60: [2, 26] }, { 23: [2, 31], 33: [2, 31], 54: [2, 31], 68: [2, 31], 72: [2, 31], 75: [2, 31] }, { 33: [2, 74], 42: 135, 74: 136, 75: [1, 121] }, { 33: [2, 71], 65: [2, 71], 72: [2, 71], 75: [2, 71], 80: [2, 71], 81: [2, 71], 82: [2, 71], 83: [2, 71], 84: [2, 71], 85: [2, 71] }, { 33: [2, 73], 75: [2, 73] }, { 23: [2, 29], 33: [2, 29], 54: [2, 29], 65: [2, 29], 68: [2, 29], 72: [2, 29], 75: [2, 29], 80: [2, 29], 81: [2, 29], 82: [2, 29], 83: [2, 29], 84: [2, 29], 85: [2, 29] }, { 14: [2, 15], 15: [2, 15], 19: [2, 15], 29: [2, 15], 34: [2, 15], 39: [2, 15], 44: [2, 15], 47: [2, 15], 48: [2, 15], 51: [2, 15], 55: [2, 15], 60: [2, 15] }, { 72: [1, 138], 77: [1, 137] }, { 72: [2, 100], 77: [2, 100] }, { 14: [2, 16], 15: [2, 16], 19: [2, 16], 29: [2, 16], 34: [2, 16], 44: [2, 16], 47: [2, 16], 48: [2, 16], 51: [2, 16], 55: [2, 16], 60: [2, 16] }, { 33: [1, 139] }, { 33: [2, 75] }, { 33: [2, 32] }, { 72: [2, 101], 77: [2, 101] }, { 14: [2, 17], 15: [2, 17], 19: [2, 17], 29: [2, 17], 34: [2, 17], 39: [2, 17], 44: [2, 17], 47: [2, 17], 48: [2, 17], 51: [2, 17], 55: [2, 17], 60: [2, 17] }], defaultActions: { 4: [2, 1], 55: [2, 55], 57: [2, 20], 61: [2, 57], 74: [2, 81], 83: [2, 85], 87: [2, 18], 91: [2, 89], 102: [2, 53], 105: [2, 93], 111: [2, 19], 112: [2, 77], 117: [2, 97], 120: [2, 63], 123: [2, 69], 124: [2, 12], 136: [2, 75], 137: [2, 32] }, parseError: function (a, b) {
                        throw new Error(a);
                    }, parse: function (a) {
                        function b() {
                            var a;return a = c.lexer.lex() || 1, "number" != typeof a && (a = c.symbols_[a] || a), a;
                        }var c = this,
                            d = [0],
                            e = [null],
                            f = [],
                            g = this.table,
                            h = "",
                            i = 0,
                            j = 0,
                            k = 0;this.lexer.setInput(a), this.lexer.yy = this.yy, this.yy.lexer = this.lexer, this.yy.parser = this, "undefined" == typeof this.lexer.yylloc && (this.lexer.yylloc = {});var l = this.lexer.yylloc;f.push(l);var m = this.lexer.options && this.lexer.options.ranges;"function" == typeof this.yy.parseError && (this.parseError = this.yy.parseError);for (var n, o, p, q, r, s, t, u, v, w = {};;) {
                            if (p = d[d.length - 1], this.defaultActions[p] ? q = this.defaultActions[p] : (null !== n && "undefined" != typeof n || (n = b()), q = g[p] && g[p][n]), "undefined" == typeof q || !q.length || !q[0]) {
                                var x = "";if (!k) {
                                    v = [];for (s in g[p]) this.terminals_[s] && s > 2 && v.push("'" + this.terminals_[s] + "'");x = this.lexer.showPosition ? "Parse error on line " + (i + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + v.join(", ") + ", got '" + (this.terminals_[n] || n) + "'" : "Parse error on line " + (i + 1) + ": Unexpected " + (1 == n ? "end of input" : "'" + (this.terminals_[n] || n) + "'"), this.parseError(x, { text: this.lexer.match, token: this.terminals_[n] || n, line: this.lexer.yylineno, loc: l, expected: v });
                                }
                            }if (q[0] instanceof Array && q.length > 1) throw new Error("Parse Error: multiple actions possible at state: " + p + ", token: " + n);switch (q[0]) {case 1:
                                    d.push(n), e.push(this.lexer.yytext), f.push(this.lexer.yylloc), d.push(q[1]), n = null, o ? (n = o, o = null) : (j = this.lexer.yyleng, h = this.lexer.yytext, i = this.lexer.yylineno, l = this.lexer.yylloc, k > 0 && k--);break;case 2:
                                    if (t = this.productions_[q[1]][1], w.$ = e[e.length - t], w._$ = { first_line: f[f.length - (t || 1)].first_line, last_line: f[f.length - 1].last_line, first_column: f[f.length - (t || 1)].first_column, last_column: f[f.length - 1].last_column }, m && (w._$.range = [f[f.length - (t || 1)].range[0], f[f.length - 1].range[1]]), r = this.performAction.call(w, h, j, i, this.yy, q[1], e, f), "undefined" != typeof r) return r;t && (d = d.slice(0, -1 * t * 2), e = e.slice(0, -1 * t), f = f.slice(0, -1 * t)), d.push(this.productions_[q[1]][0]), e.push(w.$), f.push(w._$), u = g[d[d.length - 2]][d[d.length - 1]], d.push(u);break;case 3:
                                    return !0;}
                        }return !0;
                    } },
                    c = function () {
                    var a = { EOF: 1, parseError: function (a, b) {
                            if (!this.yy.parser) throw new Error(a);this.yy.parser.parseError(a, b);
                        }, setInput: function (a) {
                            return this._input = a, this._more = this._less = this.done = !1, this.yylineno = this.yyleng = 0, this.yytext = this.matched = this.match = "", this.conditionStack = ["INITIAL"], this.yylloc = { first_line: 1, first_column: 0, last_line: 1, last_column: 0 }, this.options.ranges && (this.yylloc.range = [0, 0]), this.offset = 0, this;
                        }, input: function () {
                            var a = this._input[0];this.yytext += a, this.yyleng++, this.offset++, this.match += a, this.matched += a;var b = a.match(/(?:\r\n?|\n).*/g);return b ? (this.yylineno++, this.yylloc.last_line++) : this.yylloc.last_column++, this.options.ranges && this.yylloc.range[1]++, this._input = this._input.slice(1), a;
                        }, unput: function (a) {
                            var b = a.length,
                                c = a.split(/(?:\r\n?|\n)/g);this._input = a + this._input, this.yytext = this.yytext.substr(0, this.yytext.length - b - 1), this.offset -= b;var d = this.match.split(/(?:\r\n?|\n)/g);this.match = this.match.substr(0, this.match.length - 1), this.matched = this.matched.substr(0, this.matched.length - 1), c.length - 1 && (this.yylineno -= c.length - 1);var e = this.yylloc.range;return this.yylloc = { first_line: this.yylloc.first_line, last_line: this.yylineno + 1, first_column: this.yylloc.first_column, last_column: c ? (c.length === d.length ? this.yylloc.first_column : 0) + d[d.length - c.length].length - c[0].length : this.yylloc.first_column - b }, this.options.ranges && (this.yylloc.range = [e[0], e[0] + this.yyleng - b]), this;
                        }, more: function () {
                            return this._more = !0, this;
                        }, less: function (a) {
                            this.unput(this.match.slice(a));
                        }, pastInput: function () {
                            var a = this.matched.substr(0, this.matched.length - this.match.length);return (a.length > 20 ? "..." : "") + a.substr(-20).replace(/\n/g, "");
                        }, upcomingInput: function () {
                            var a = this.match;return a.length < 20 && (a += this._input.substr(0, 20 - a.length)), (a.substr(0, 20) + (a.length > 20 ? "..." : "")).replace(/\n/g, "");
                        }, showPosition: function () {
                            var a = this.pastInput(),
                                b = new Array(a.length + 1).join("-");return a + this.upcomingInput() + "\n" + b + "^";
                        }, next: function () {
                            if (this.done) return this.EOF;this._input || (this.done = !0);var a, b, c, d, e;this._more || (this.yytext = "", this.match = "");for (var f = this._currentRules(), g = 0; g < f.length && (c = this._input.match(this.rules[f[g]]), !c || b && !(c[0].length > b[0].length) || (b = c, d = g, this.options.flex)); g++);return b ? (e = b[0].match(/(?:\r\n?|\n).*/g), e && (this.yylineno += e.length), this.yylloc = { first_line: this.yylloc.last_line, last_line: this.yylineno + 1, first_column: this.yylloc.last_column, last_column: e ? e[e.length - 1].length - e[e.length - 1].match(/\r?\n?/)[0].length : this.yylloc.last_column + b[0].length }, this.yytext += b[0], this.match += b[0], this.matches = b, this.yyleng = this.yytext.length, this.options.ranges && (this.yylloc.range = [this.offset, this.offset += this.yyleng]), this._more = !1, this._input = this._input.slice(b[0].length), this.matched += b[0], a = this.performAction.call(this, this.yy, this, f[d], this.conditionStack[this.conditionStack.length - 1]), this.done && this._input && (this.done = !1), a ? a : void 0) : "" === this._input ? this.EOF : this.parseError("Lexical error on line " + (this.yylineno + 1) + ". Unrecognized text.\n" + this.showPosition(), { text: "", token: null, line: this.yylineno });
                        }, lex: function () {
                            var a = this.next();return "undefined" != typeof a ? a : this.lex();
                        }, begin: function (a) {
                            this.conditionStack.push(a);
                        }, popState: function () {
                            return this.conditionStack.pop();
                        }, _currentRules: function () {
                            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
                        }, topState: function () {
                            return this.conditionStack[this.conditionStack.length - 2];
                        }, pushState: function (a) {
                            this.begin(a);
                        } };return a.options = {}, a.performAction = function (a, b, c, d) {
                        function e(a, c) {
                            return b.yytext = b.yytext.substr(a, b.yyleng - c);
                        }switch (c) {case 0:
                                if ("\\\\" === b.yytext.slice(-2) ? (e(0, 1), this.begin("mu")) : "\\" === b.yytext.slice(-1) ? (e(0, 1), this.begin("emu")) : this.begin("mu"), b.yytext) return 15;break;case 1:
                                return 15;case 2:
                                return this.popState(), 15;case 3:
                                return this.begin("raw"), 15;case 4:
                                return this.popState(), "raw" === this.conditionStack[this.conditionStack.length - 1] ? 15 : (b.yytext = b.yytext.substr(5, b.yyleng - 9), "END_RAW_BLOCK");case 5:
                                return 15;case 6:
                                return this.popState(), 14;case 7:
                                return 65;case 8:
                                return 68;case 9:
                                return 19;case 10:
                                return this.popState(), this.begin("raw"), 23;case 11:
                                return 55;case 12:
                                return 60;case 13:
                                return 29;case 14:
                                return 47;case 15:
                                return this.popState(), 44;case 16:
                                return this.popState(), 44;case 17:
                                return 34;case 18:
                                return 39;case 19:
                                return 51;case 20:
                                return 48;case 21:
                                this.unput(b.yytext), this.popState(), this.begin("com");break;case 22:
                                return this.popState(), 14;case 23:
                                return 48;case 24:
                                return 73;case 25:
                                return 72;case 26:
                                return 72;case 27:
                                return 87;case 28:
                                break;case 29:
                                return this.popState(), 54;case 30:
                                return this.popState(), 33;case 31:
                                return b.yytext = e(1, 2).replace(/\\"/g, '"'), 80;case 32:
                                return b.yytext = e(1, 2).replace(/\\'/g, "'"), 80;case 33:
                                return 85;case 34:
                                return 82;case 35:
                                return 82;case 36:
                                return 83;case 37:
                                return 84;case 38:
                                return 81;case 39:
                                return 75;case 40:
                                return 77;case 41:
                                return 72;case 42:
                                return b.yytext = b.yytext.replace(/\\([\\\]])/g, "$1"), 72;case 43:
                                return "INVALID";case 44:
                                return 5;}
                    }, a.rules = [/^(?:[^\x00]*?(?=(\{\{)))/, /^(?:[^\x00]+)/, /^(?:[^\x00]{2,}?(?=(\{\{|\\\{\{|\\\\\{\{|$)))/, /^(?:\{\{\{\{(?=[^\/]))/, /^(?:\{\{\{\{\/[^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=[=}\s\/.])\}\}\}\})/, /^(?:[^\x00]*?(?=(\{\{\{\{)))/, /^(?:[\s\S]*?--(~)?\}\})/, /^(?:\()/, /^(?:\))/, /^(?:\{\{\{\{)/, /^(?:\}\}\}\})/, /^(?:\{\{(~)?>)/, /^(?:\{\{(~)?#>)/, /^(?:\{\{(~)?#\*?)/, /^(?:\{\{(~)?\/)/, /^(?:\{\{(~)?\^\s*(~)?\}\})/, /^(?:\{\{(~)?\s*else\s*(~)?\}\})/, /^(?:\{\{(~)?\^)/, /^(?:\{\{(~)?\s*else\b)/, /^(?:\{\{(~)?\{)/, /^(?:\{\{(~)?&)/, /^(?:\{\{(~)?!--)/, /^(?:\{\{(~)?![\s\S]*?\}\})/, /^(?:\{\{(~)?\*?)/, /^(?:=)/, /^(?:\.\.)/, /^(?:\.(?=([=~}\s\/.)|])))/, /^(?:[\/.])/, /^(?:\s+)/, /^(?:\}(~)?\}\})/, /^(?:(~)?\}\})/, /^(?:"(\\["]|[^"])*")/, /^(?:'(\\[']|[^'])*')/, /^(?:@)/, /^(?:true(?=([~}\s)])))/, /^(?:false(?=([~}\s)])))/, /^(?:undefined(?=([~}\s)])))/, /^(?:null(?=([~}\s)])))/, /^(?:-?[0-9]+(?:\.[0-9]+)?(?=([~}\s)])))/, /^(?:as\s+\|)/, /^(?:\|)/, /^(?:([^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=([=~}\s\/.)|]))))/, /^(?:\[(\\\]|[^\]])*\])/, /^(?:.)/, /^(?:$)/], a.conditions = { mu: { rules: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44], inclusive: !1 }, emu: { rules: [2], inclusive: !1 }, com: { rules: [6], inclusive: !1 }, raw: { rules: [3, 4, 5], inclusive: !1 }, INITIAL: { rules: [0, 1, 44], inclusive: !0 } }, a;
                }();return b.lexer = c, a.prototype = b, b.Parser = a, new a();
            }();b["default"] = c, a.exports = b["default"];
        }, function (a, b, c) {
            "use strict";
            function d() {
                var a = arguments.length <= 0 || void 0 === arguments[0] ? {} : arguments[0];this.options = a;
            }function e(a, b, c) {
                void 0 === b && (b = a.length);var d = a[b - 1],
                    e = a[b - 2];return d ? "ContentStatement" === d.type ? (e || !c ? /\r?\n\s*?$/ : /(^|\r?\n)\s*?$/).test(d.original) : void 0 : c;
            }function f(a, b, c) {
                void 0 === b && (b = -1);var d = a[b + 1],
                    e = a[b + 2];return d ? "ContentStatement" === d.type ? (e || !c ? /^\s*?\r?\n/ : /^\s*?(\r?\n|$)/).test(d.original) : void 0 : c;
            }function g(a, b, c) {
                var d = a[null == b ? 0 : b + 1];if (d && "ContentStatement" === d.type && (c || !d.rightStripped)) {
                    var e = d.value;d.value = d.value.replace(c ? /^\s+/ : /^[ \t]*\r?\n?/, ""), d.rightStripped = d.value !== e;
                }
            }function h(a, b, c) {
                var d = a[null == b ? a.length - 1 : b - 1];if (d && "ContentStatement" === d.type && (c || !d.leftStripped)) {
                    var e = d.value;return d.value = d.value.replace(c ? /\s+$/ : /[ \t]+$/, ""), d.leftStripped = d.value !== e, d.leftStripped;
                }
            }var i = c(1)["default"];b.__esModule = !0;var j = c(39),
                k = i(j);d.prototype = new k["default"](), d.prototype.Program = function (a) {
                var b = !this.options.ignoreStandalone,
                    c = !this.isRootSeen;this.isRootSeen = !0;for (var d = a.body, i = 0, j = d.length; i < j; i++) {
                    var k = d[i],
                        l = this.accept(k);if (l) {
                        var m = e(d, i, c),
                            n = f(d, i, c),
                            o = l.openStandalone && m,
                            p = l.closeStandalone && n,
                            q = l.inlineStandalone && m && n;l.close && g(d, i, !0), l.open && h(d, i, !0), b && q && (g(d, i), h(d, i) && "PartialStatement" === k.type && (k.indent = /([ \t]+$)/.exec(d[i - 1].original)[1])), b && o && (g((k.program || k.inverse).body), h(d, i)), b && p && (g(d, i), h((k.inverse || k.program).body));
                    }
                }return a;
            }, d.prototype.BlockStatement = d.prototype.DecoratorBlock = d.prototype.PartialBlockStatement = function (a) {
                this.accept(a.program), this.accept(a.inverse);var b = a.program || a.inverse,
                    c = a.program && a.inverse,
                    d = c,
                    i = c;if (c && c.chained) for (d = c.body[0].program; i.chained;) i = i.body[i.body.length - 1].program;var j = { open: a.openStrip.open, close: a.closeStrip.close, openStandalone: f(b.body), closeStandalone: e((d || b).body) };if (a.openStrip.close && g(b.body, null, !0), c) {
                    var k = a.inverseStrip;k.open && h(b.body, null, !0), k.close && g(d.body, null, !0), a.closeStrip.open && h(i.body, null, !0), !this.options.ignoreStandalone && e(b.body) && f(d.body) && (h(b.body), g(d.body));
                } else a.closeStrip.open && h(b.body, null, !0);return j;
            }, d.prototype.Decorator = d.prototype.MustacheStatement = function (a) {
                return a.strip;
            }, d.prototype.PartialStatement = d.prototype.CommentStatement = function (a) {
                var b = a.strip || {};return { inlineStandalone: !0, open: b.open, close: b.close };
            }, b["default"] = d, a.exports = b["default"];
        }, function (a, b, c) {
            "use strict";
            function d() {
                this.parents = [];
            }function e(a) {
                this.acceptRequired(a, "path"), this.acceptArray(a.params), this.acceptKey(a, "hash");
            }function f(a) {
                e.call(this, a), this.acceptKey(a, "program"), this.acceptKey(a, "inverse");
            }function g(a) {
                this.acceptRequired(a, "name"), this.acceptArray(a.params), this.acceptKey(a, "hash");
            }var h = c(1)["default"];b.__esModule = !0;var i = c(6),
                j = h(i);d.prototype = { constructor: d, mutating: !1, acceptKey: function (a, b) {
                    var c = this.accept(a[b]);if (this.mutating) {
                        if (c && !d.prototype[c.type]) throw new j["default"]('Unexpected node type "' + c.type + '" found when accepting ' + b + " on " + a.type);a[b] = c;
                    }
                }, acceptRequired: function (a, b) {
                    if (this.acceptKey(a, b), !a[b]) throw new j["default"](a.type + " requires " + b);
                }, acceptArray: function (a) {
                    for (var b = 0, c = a.length; b < c; b++) this.acceptKey(a, b), a[b] || (a.splice(b, 1), b--, c--);
                }, accept: function (a) {
                    if (a) {
                        if (!this[a.type]) throw new j["default"]("Unknown type: " + a.type, a);this.current && this.parents.unshift(this.current), this.current = a;var b = this[a.type](a);return this.current = this.parents.shift(), !this.mutating || b ? b : b !== !1 ? a : void 0;
                    }
                }, Program: function (a) {
                    this.acceptArray(a.body);
                }, MustacheStatement: e, Decorator: e, BlockStatement: f, DecoratorBlock: f, PartialStatement: g, PartialBlockStatement: function (a) {
                    g.call(this, a), this.acceptKey(a, "program");
                }, ContentStatement: function () {}, CommentStatement: function () {}, SubExpression: e, PathExpression: function () {}, StringLiteral: function () {}, NumberLiteral: function () {}, BooleanLiteral: function () {}, UndefinedLiteral: function () {}, NullLiteral: function () {}, Hash: function (a) {
                    this.acceptArray(a.pairs);
                }, HashPair: function (a) {
                    this.acceptRequired(a, "value");
                } }, b["default"] = d, a.exports = b["default"];
        }, function (a, b, c) {
            "use strict";
            function d(a, b) {
                if (b = b.path ? b.path.original : b, a.path.original !== b) {
                    var c = { loc: a.path.loc };throw new q["default"](a.path.original + " doesn't match " + b, c);
                }
            }function e(a, b) {
                this.source = a, this.start = { line: b.first_line, column: b.first_column }, this.end = { line: b.last_line, column: b.last_column };
            }function f(a) {
                return (/^\[.*\]$/.test(a) ? a.substr(1, a.length - 2) : a
                );
            }function g(a, b) {
                return { open: "~" === a.charAt(2), close: "~" === b.charAt(b.length - 3) };
            }function h(a) {
                return a.replace(/^\{\{~?\!-?-?/, "").replace(/-?-?~?\}\}$/, "");
            }function i(a, b, c) {
                c = this.locInfo(c);for (var d = a ? "@" : "", e = [], f = 0, g = "", h = 0, i = b.length; h < i; h++) {
                    var j = b[h].part,
                        k = b[h].original !== j;if (d += (b[h].separator || "") + j, k || ".." !== j && "." !== j && "this" !== j) e.push(j);else {
                        if (e.length > 0) throw new q["default"]("Invalid path: " + d, { loc: c });".." === j && (f++, g += "../");
                    }
                }return { type: "PathExpression", data: a, depth: f, parts: e, original: d, loc: c };
            }function j(a, b, c, d, e, f) {
                var g = d.charAt(3) || d.charAt(2),
                    h = "{" !== g && "&" !== g,
                    i = /\*/.test(d);return { type: i ? "Decorator" : "MustacheStatement", path: a, params: b, hash: c, escaped: h, strip: e, loc: this.locInfo(f) };
            }function k(a, b, c, e) {
                d(a, c), e = this.locInfo(e);var f = { type: "Program", body: b, strip: {}, loc: e };return { type: "BlockStatement", path: a.path, params: a.params, hash: a.hash, program: f, openStrip: {}, inverseStrip: {}, closeStrip: {}, loc: e };
            }function l(a, b, c, e, f, g) {
                e && e.path && d(a, e);var h = /\*/.test(a.open);b.blockParams = a.blockParams;var i = void 0,
                    j = void 0;if (c) {
                    if (h) throw new q["default"]("Unexpected inverse block on decorator", c);c.chain && (c.program.body[0].closeStrip = e.strip), j = c.strip, i = c.program;
                }return f && (f = i, i = b, b = f), { type: h ? "DecoratorBlock" : "BlockStatement", path: a.path, params: a.params, hash: a.hash, program: b, inverse: i, openStrip: a.strip, inverseStrip: j, closeStrip: e && e.strip, loc: this.locInfo(g) };
            }function m(a, b) {
                if (!b && a.length) {
                    var c = a[0].loc,
                        d = a[a.length - 1].loc;c && d && (b = { source: c.source, start: { line: c.start.line, column: c.start.column }, end: { line: d.end.line, column: d.end.column } });
                }return { type: "Program", body: a, strip: {}, loc: b };
            }function n(a, b, c, e) {
                return d(a, c), { type: "PartialBlockStatement", name: a.path, params: a.params, hash: a.hash, program: b, openStrip: a.strip, closeStrip: c && c.strip, loc: this.locInfo(e) };
            }var o = c(1)["default"];b.__esModule = !0, b.SourceLocation = e, b.id = f, b.stripFlags = g, b.stripComment = h, b.preparePath = i, b.prepareMustache = j, b.prepareRawBlock = k, b.prepareBlock = l, b.prepareProgram = m, b.preparePartialBlock = n;var p = c(6),
                q = o(p);
        }, function (a, b, c) {
            "use strict";
            function d() {}function e(a, b, c) {
                if (null == a || "string" != typeof a && "Program" !== a.type) throw new k["default"]("You must pass a string or Handlebars AST to Handlebars.precompile. You passed " + a);b = b || {}, "data" in b || (b.data = !0), b.compat && (b.useDepths = !0);var d = c.parse(a, b),
                    e = new c.Compiler().compile(d, b);return new c.JavaScriptCompiler().compile(e, b);
            }function f(a, b, c) {
                function d() {
                    var d = c.parse(a, b),
                        e = new c.Compiler().compile(d, b),
                        f = new c.JavaScriptCompiler().compile(e, b, void 0, !0);return c.template(f);
                }function e(a, b) {
                    return f || (f = d()), f.call(this, a, b);
                }if (void 0 === b && (b = {}), null == a || "string" != typeof a && "Program" !== a.type) throw new k["default"]("You must pass a string or Handlebars AST to Handlebars.compile. You passed " + a);b = l.extend({}, b), "data" in b || (b.data = !0), b.compat && (b.useDepths = !0);var f = void 0;return e._setup = function (a) {
                    return f || (f = d()), f._setup(a);
                }, e._child = function (a, b, c, e) {
                    return f || (f = d()), f._child(a, b, c, e);
                }, e;
            }function g(a, b) {
                if (a === b) return !0;if (l.isArray(a) && l.isArray(b) && a.length === b.length) {
                    for (var c = 0; c < a.length; c++) if (!g(a[c], b[c])) return !1;return !0;
                }
            }function h(a) {
                if (!a.path.parts) {
                    var b = a.path;a.path = { type: "PathExpression", data: !1, depth: 0, parts: [b.original + ""], original: b.original + "", loc: b.loc };
                }
            }var i = c(1)["default"];b.__esModule = !0, b.Compiler = d, b.precompile = e, b.compile = f;var j = c(6),
                k = i(j),
                l = c(5),
                m = c(35),
                n = i(m),
                o = [].slice;d.prototype = { compiler: d, equals: function (a) {
                    var b = this.opcodes.length;if (a.opcodes.length !== b) return !1;for (var c = 0; c < b; c++) {
                        var d = this.opcodes[c],
                            e = a.opcodes[c];if (d.opcode !== e.opcode || !g(d.args, e.args)) return !1;
                    }b = this.children.length;for (var c = 0; c < b; c++) if (!this.children[c].equals(a.children[c])) return !1;return !0;
                }, guid: 0, compile: function (a, b) {
                    this.sourceNode = [], this.opcodes = [], this.children = [], this.options = b, this.stringParams = b.stringParams, this.trackIds = b.trackIds, b.blockParams = b.blockParams || [];var c = b.knownHelpers;if (b.knownHelpers = { helperMissing: !0, blockHelperMissing: !0, each: !0, "if": !0, unless: !0, "with": !0, log: !0, lookup: !0 }, c) for (var d in c) d in c && (this.options.knownHelpers[d] = c[d]);return this.accept(a);
                }, compileProgram: function (a) {
                    var b = new this.compiler(),
                        c = b.compile(a, this.options),
                        d = this.guid++;return this.usePartial = this.usePartial || c.usePartial, this.children[d] = c, this.useDepths = this.useDepths || c.useDepths, d;
                }, accept: function (a) {
                    if (!this[a.type]) throw new k["default"]("Unknown type: " + a.type, a);this.sourceNode.unshift(a);var b = this[a.type](a);return this.sourceNode.shift(), b;
                }, Program: function (a) {
                    this.options.blockParams.unshift(a.blockParams);for (var b = a.body, c = b.length, d = 0; d < c; d++) this.accept(b[d]);return this.options.blockParams.shift(), this.isSimple = 1 === c, this.blockParams = a.blockParams ? a.blockParams.length : 0, this;
                }, BlockStatement: function (a) {
                    h(a);var b = a.program,
                        c = a.inverse;b = b && this.compileProgram(b), c = c && this.compileProgram(c);var d = this.classifySexpr(a);"helper" === d ? this.helperSexpr(a, b, c) : "simple" === d ? (this.simpleSexpr(a), this.opcode("pushProgram", b), this.opcode("pushProgram", c), this.opcode("emptyHash"), this.opcode("blockValue", a.path.original)) : (this.ambiguousSexpr(a, b, c), this.opcode("pushProgram", b), this.opcode("pushProgram", c), this.opcode("emptyHash"), this.opcode("ambiguousBlockValue")), this.opcode("append");
                }, DecoratorBlock: function (a) {
                    var b = a.program && this.compileProgram(a.program),
                        c = this.setupFullMustacheParams(a, b, void 0),
                        d = a.path;this.useDecorators = !0, this.opcode("registerDecorator", c.length, d.original);
                }, PartialStatement: function (a) {
                    this.usePartial = !0;var b = a.program;b && (b = this.compileProgram(a.program));var c = a.params;if (c.length > 1) throw new k["default"]("Unsupported number of partial arguments: " + c.length, a);c.length || (this.options.explicitPartialContext ? this.opcode("pushLiteral", "undefined") : c.push({ type: "PathExpression", parts: [], depth: 0 }));var d = a.name.original,
                        e = "SubExpression" === a.name.type;e && this.accept(a.name), this.setupFullMustacheParams(a, b, void 0, !0);var f = a.indent || "";this.options.preventIndent && f && (this.opcode("appendContent", f), f = ""), this.opcode("invokePartial", e, d, f), this.opcode("append");
                }, PartialBlockStatement: function (a) {
                    this.PartialStatement(a);
                }, MustacheStatement: function (a) {
                    this.SubExpression(a), a.escaped && !this.options.noEscape ? this.opcode("appendEscaped") : this.opcode("append");
                }, Decorator: function (a) {
                    this.DecoratorBlock(a);
                }, ContentStatement: function (a) {
                    a.value && this.opcode("appendContent", a.value);
                }, CommentStatement: function () {}, SubExpression: function (a) {
                    h(a);var b = this.classifySexpr(a);"simple" === b ? this.simpleSexpr(a) : "helper" === b ? this.helperSexpr(a) : this.ambiguousSexpr(a);
                }, ambiguousSexpr: function (a, b, c) {
                    var d = a.path,
                        e = d.parts[0],
                        f = null != b || null != c;this.opcode("getContext", d.depth), this.opcode("pushProgram", b), this.opcode("pushProgram", c), d.strict = !0, this.accept(d), this.opcode("invokeAmbiguous", e, f);
                }, simpleSexpr: function (a) {
                    var b = a.path;b.strict = !0, this.accept(b), this.opcode("resolvePossibleLambda");
                }, helperSexpr: function (a, b, c) {
                    var d = this.setupFullMustacheParams(a, b, c),
                        e = a.path,
                        f = e.parts[0];if (this.options.knownHelpers[f]) this.opcode("invokeKnownHelper", d.length, f);else {
                        if (this.options.knownHelpersOnly) throw new k["default"]("You specified knownHelpersOnly, but used the unknown helper " + f, a);e.strict = !0, e.falsy = !0, this.accept(e), this.opcode("invokeHelper", d.length, e.original, n["default"].helpers.simpleId(e));
                    }
                }, PathExpression: function (a) {
                    this.addDepth(a.depth), this.opcode("getContext", a.depth);var b = a.parts[0],
                        c = n["default"].helpers.scopedId(a),
                        d = !a.depth && !c && this.blockParamIndex(b);d ? this.opcode("lookupBlockParam", d, a.parts) : b ? a.data ? (this.options.data = !0, this.opcode("lookupData", a.depth, a.parts, a.strict)) : this.opcode("lookupOnContext", a.parts, a.falsy, a.strict, c) : this.opcode("pushContext");
                }, StringLiteral: function (a) {
                    this.opcode("pushString", a.value);
                }, NumberLiteral: function (a) {
                    this.opcode("pushLiteral", a.value);
                }, BooleanLiteral: function (a) {
                    this.opcode("pushLiteral", a.value);
                }, UndefinedLiteral: function () {
                    this.opcode("pushLiteral", "undefined");
                }, NullLiteral: function () {
                    this.opcode("pushLiteral", "null");
                }, Hash: function (a) {
                    var b = a.pairs,
                        c = 0,
                        d = b.length;for (this.opcode("pushHash"); c < d; c++) this.pushParam(b[c].value);for (; c--;) this.opcode("assignToHash", b[c].key);this.opcode("popHash");
                }, opcode: function (a) {
                    this.opcodes.push({ opcode: a, args: o.call(arguments, 1), loc: this.sourceNode[0].loc });
                }, addDepth: function (a) {
                    a && (this.useDepths = !0);
                }, classifySexpr: function (a) {
                    var b = n["default"].helpers.simpleId(a.path),
                        c = b && !!this.blockParamIndex(a.path.parts[0]),
                        d = !c && n["default"].helpers.helperExpression(a),
                        e = !c && (d || b);if (e && !d) {
                        var f = a.path.parts[0],
                            g = this.options;g.knownHelpers[f] ? d = !0 : g.knownHelpersOnly && (e = !1);
                    }return d ? "helper" : e ? "ambiguous" : "simple";
                }, pushParams: function (a) {
                    for (var b = 0, c = a.length; b < c; b++) this.pushParam(a[b]);
                }, pushParam: function (a) {
                    var b = null != a.value ? a.value : a.original || "";if (this.stringParams) b.replace && (b = b.replace(/^(\.?\.\/)*/g, "").replace(/\//g, ".")), a.depth && this.addDepth(a.depth), this.opcode("getContext", a.depth || 0), this.opcode("pushStringParam", b, a.type), "SubExpression" === a.type && this.accept(a);else {
                        if (this.trackIds) {
                            var c = void 0;if (!a.parts || n["default"].helpers.scopedId(a) || a.depth || (c = this.blockParamIndex(a.parts[0])), c) {
                                var d = a.parts.slice(1).join(".");this.opcode("pushId", "BlockParam", c, d);
                            } else b = a.original || b, b.replace && (b = b.replace(/^this(?:\.|$)/, "").replace(/^\.\//, "").replace(/^\.$/, "")), this.opcode("pushId", a.type, b);
                        }this.accept(a);
                    }
                }, setupFullMustacheParams: function (a, b, c, d) {
                    var e = a.params;return this.pushParams(e), this.opcode("pushProgram", b), this.opcode("pushProgram", c), a.hash ? this.accept(a.hash) : this.opcode("emptyHash", d), e;
                }, blockParamIndex: function (a) {
                    for (var b = 0, c = this.options.blockParams.length; b < c; b++) {
                        var d = this.options.blockParams[b],
                            e = d && l.indexOf(d, a);if (d && e >= 0) return [b, e];
                    }
                } };
        }, function (a, b, c) {
            "use strict";
            function d(a) {
                this.value = a;
            }function e() {}function f(a, b, c, d) {
                var e = b.popStack(),
                    f = 0,
                    g = c.length;for (a && g--; f < g; f++) e = b.nameLookup(e, c[f], d);return a ? [b.aliasable("container.strict"), "(", e, ", ", b.quotedString(c[f]), ")"] : e;
            }var g = c(1)["default"];b.__esModule = !0;var h = c(4),
                i = c(6),
                j = g(i),
                k = c(5),
                l = c(43),
                m = g(l);e.prototype = { nameLookup: function (a, b) {
                    return e.isValidJavaScriptVariableName(b) ? [a, ".", b] : [a, "[", JSON.stringify(b), "]"];
                }, depthedLookup: function (a) {
                    return [this.aliasable("container.lookup"), '(depths, "', a, '")'];
                }, compilerInfo: function () {
                    var a = h.COMPILER_REVISION,
                        b = h.REVISION_CHANGES[a];return [a, b];
                }, appendToBuffer: function (a, b, c) {
                    return k.isArray(a) || (a = [a]), a = this.source.wrap(a, b), this.environment.isSimple ? ["return ", a, ";"] : c ? ["buffer += ", a, ";"] : (a.appendToBuffer = !0, a);
                }, initializeBuffer: function () {
                    return this.quotedString("");
                }, compile: function (a, b, c, d) {
                    this.environment = a, this.options = b, this.stringParams = this.options.stringParams, this.trackIds = this.options.trackIds, this.precompile = !d, this.name = this.environment.name, this.isChild = !!c, this.context = c || { decorators: [], programs: [], environments: [] }, this.preamble(), this.stackSlot = 0, this.stackVars = [], this.aliases = {}, this.registers = { list: [] }, this.hashes = [], this.compileStack = [], this.inlineStack = [], this.blockParams = [], this.compileChildren(a, b), this.useDepths = this.useDepths || a.useDepths || a.useDecorators || this.options.compat, this.useBlockParams = this.useBlockParams || a.useBlockParams;var e = a.opcodes,
                        f = void 0,
                        g = void 0,
                        h = void 0,
                        i = void 0;for (h = 0, i = e.length; h < i; h++) f = e[h], this.source.currentLocation = f.loc, g = g || f.loc, this[f.opcode].apply(this, f.args);if (this.source.currentLocation = g, this.pushSource(""), this.stackSlot || this.inlineStack.length || this.compileStack.length) throw new j["default"]("Compile completed with content left on stack");this.decorators.isEmpty() ? this.decorators = void 0 : (this.useDecorators = !0, this.decorators.prepend("var decorators = container.decorators;\n"), this.decorators.push("return fn;"), d ? this.decorators = Function.apply(this, ["fn", "props", "container", "depth0", "data", "blockParams", "depths", this.decorators.merge()]) : (this.decorators.prepend("function(fn, props, container, depth0, data, blockParams, depths) {\n"), this.decorators.push("}\n"), this.decorators = this.decorators.merge()));var k = this.createFunctionContext(d);if (this.isChild) return k;var l = { compiler: this.compilerInfo(), main: k };this.decorators && (l.main_d = this.decorators, l.useDecorators = !0);var m = this.context,
                        n = m.programs,
                        o = m.decorators;for (h = 0, i = n.length; h < i; h++) n[h] && (l[h] = n[h], o[h] && (l[h + "_d"] = o[h], l.useDecorators = !0));return this.environment.usePartial && (l.usePartial = !0), this.options.data && (l.useData = !0), this.useDepths && (l.useDepths = !0), this.useBlockParams && (l.useBlockParams = !0), this.options.compat && (l.compat = !0), d ? l.compilerOptions = this.options : (l.compiler = JSON.stringify(l.compiler), this.source.currentLocation = { start: { line: 1, column: 0 } }, l = this.objectLiteral(l), b.srcName ? (l = l.toStringWithSourceMap({ file: b.destName }), l.map = l.map && l.map.toString()) : l = l.toString()), l;
                }, preamble: function () {
                    this.lastContext = 0, this.source = new m["default"](this.options.srcName), this.decorators = new m["default"](this.options.srcName);
                }, createFunctionContext: function (a) {
                    var b = "",
                        c = this.stackVars.concat(this.registers.list);c.length > 0 && (b += ", " + c.join(", "));var d = 0;for (var e in this.aliases) {
                        var f = this.aliases[e];this.aliases.hasOwnProperty(e) && f.children && f.referenceCount > 1 && (b += ", alias" + ++d + "=" + e, f.children[0] = "alias" + d);
                    }var g = ["container", "depth0", "helpers", "partials", "data"];(this.useBlockParams || this.useDepths) && g.push("blockParams"), this.useDepths && g.push("depths");var h = this.mergeSource(b);return a ? (g.push(h), Function.apply(this, g)) : this.source.wrap(["function(", g.join(","), ") {\n  ", h, "}"]);
                }, mergeSource: function (a) {
                    var b = this.environment.isSimple,
                        c = !this.forceBuffer,
                        d = void 0,
                        e = void 0,
                        f = void 0,
                        g = void 0;return this.source.each(function (a) {
                        a.appendToBuffer ? (f ? a.prepend("  + ") : f = a, g = a) : (f && (e ? f.prepend("buffer += ") : d = !0, g.add(";"), f = g = void 0), e = !0, b || (c = !1));
                    }), c ? f ? (f.prepend("return "), g.add(";")) : e || this.source.push('return "";') : (a += ", buffer = " + (d ? "" : this.initializeBuffer()), f ? (f.prepend("return buffer + "), g.add(";")) : this.source.push("return buffer;")), a && this.source.prepend("var " + a.substring(2) + (d ? "" : ";\n")), this.source.merge();
                }, blockValue: function (a) {
                    var b = this.aliasable("helpers.blockHelperMissing"),
                        c = [this.contextName(0)];this.setupHelperArgs(a, 0, c);var d = this.popStack();c.splice(1, 0, d), this.push(this.source.functionCall(b, "call", c));
                }, ambiguousBlockValue: function () {
                    var a = this.aliasable("helpers.blockHelperMissing"),
                        b = [this.contextName(0)];this.setupHelperArgs("", 0, b, !0), this.flushInline();var c = this.topStack();b.splice(1, 0, c), this.pushSource(["if (!", this.lastHelper, ") { ", c, " = ", this.source.functionCall(a, "call", b), "}"]);
                }, appendContent: function (a) {
                    this.pendingContent ? a = this.pendingContent + a : this.pendingLocation = this.source.currentLocation, this.pendingContent = a;
                }, append: function () {
                    if (this.isInline()) this.replaceStack(function (a) {
                        return [" != null ? ", a, ' : ""'];
                    }), this.pushSource(this.appendToBuffer(this.popStack()));else {
                        var a = this.popStack();this.pushSource(["if (", a, " != null) { ", this.appendToBuffer(a, void 0, !0), " }"]), this.environment.isSimple && this.pushSource(["else { ", this.appendToBuffer("''", void 0, !0), " }"]);
                    }
                }, appendEscaped: function () {
                    this.pushSource(this.appendToBuffer([this.aliasable("container.escapeExpression"), "(", this.popStack(), ")"]));
                }, getContext: function (a) {
                    this.lastContext = a;
                }, pushContext: function () {
                    this.pushStackLiteral(this.contextName(this.lastContext));
                }, lookupOnContext: function (a, b, c, d) {
                    var e = 0;d || !this.options.compat || this.lastContext ? this.pushContext() : this.push(this.depthedLookup(a[e++])), this.resolvePath("context", a, e, b, c);
                }, lookupBlockParam: function (a, b) {
                    this.useBlockParams = !0, this.push(["blockParams[", a[0], "][", a[1], "]"]), this.resolvePath("context", b, 1);
                }, lookupData: function (a, b, c) {
                    a ? this.pushStackLiteral("container.data(data, " + a + ")") : this.pushStackLiteral("data"), this.resolvePath("data", b, 0, !0, c);
                }, resolvePath: function (a, b, c, d, e) {
                    var g = this;if (this.options.strict || this.options.assumeObjects) return void this.push(f(this.options.strict && e, this, b, a));for (var h = b.length; c < h; c++) this.replaceStack(function (e) {
                        var f = g.nameLookup(e, b[c], a);return d ? [" && ", f] : [" != null ? ", f, " : ", e];
                    });
                }, resolvePossibleLambda: function () {
                    this.push([this.aliasable("container.lambda"), "(", this.popStack(), ", ", this.contextName(0), ")"]);
                }, pushStringParam: function (a, b) {
                    this.pushContext(), this.pushString(b), "SubExpression" !== b && ("string" == typeof a ? this.pushString(a) : this.pushStackLiteral(a));
                }, emptyHash: function (a) {
                    this.trackIds && this.push("{}"), this.stringParams && (this.push("{}"), this.push("{}")), this.pushStackLiteral(a ? "undefined" : "{}");
                }, pushHash: function () {
                    this.hash && this.hashes.push(this.hash), this.hash = { values: [], types: [], contexts: [], ids: [] };
                }, popHash: function () {
                    var a = this.hash;this.hash = this.hashes.pop(), this.trackIds && this.push(this.objectLiteral(a.ids)), this.stringParams && (this.push(this.objectLiteral(a.contexts)), this.push(this.objectLiteral(a.types))), this.push(this.objectLiteral(a.values));
                }, pushString: function (a) {
                    this.pushStackLiteral(this.quotedString(a));
                }, pushLiteral: function (a) {
                    this.pushStackLiteral(a);
                }, pushProgram: function (a) {
                    null != a ? this.pushStackLiteral(this.programExpression(a)) : this.pushStackLiteral(null);
                }, registerDecorator: function (a, b) {
                    var c = this.nameLookup("decorators", b, "decorator"),
                        d = this.setupHelperArgs(b, a);this.decorators.push(["fn = ", this.decorators.functionCall(c, "", ["fn", "props", "container", d]), " || fn;"]);
                }, invokeHelper: function (a, b, c) {
                    var d = this.popStack(),
                        e = this.setupHelper(a, b),
                        f = c ? [e.name, " || "] : "",
                        g = ["("].concat(f, d);this.options.strict || g.push(" || ", this.aliasable("helpers.helperMissing")), g.push(")"), this.push(this.source.functionCall(g, "call", e.callParams));
                }, invokeKnownHelper: function (a, b) {
                    var c = this.setupHelper(a, b);this.push(this.source.functionCall(c.name, "call", c.callParams));
                }, invokeAmbiguous: function (a, b) {
                    this.useRegister("helper");var c = this.popStack();this.emptyHash();var d = this.setupHelper(0, a, b),
                        e = this.lastHelper = this.nameLookup("helpers", a, "helper"),
                        f = ["(", "(helper = ", e, " || ", c, ")"];this.options.strict || (f[0] = "(helper = ", f.push(" != null ? helper : ", this.aliasable("helpers.helperMissing"))), this.push(["(", f, d.paramsInit ? ["),(", d.paramsInit] : [], "),", "(typeof helper === ", this.aliasable('"function"'), " ? ", this.source.functionCall("helper", "call", d.callParams), " : helper))"]);
                }, invokePartial: function (a, b, c) {
                    var d = [],
                        e = this.setupParams(b, 1, d);a && (b = this.popStack(), delete e.name), c && (e.indent = JSON.stringify(c)), e.helpers = "helpers", e.partials = "partials", e.decorators = "container.decorators", a ? d.unshift(b) : d.unshift(this.nameLookup("partials", b, "partial")), this.options.compat && (e.depths = "depths"), e = this.objectLiteral(e), d.push(e), this.push(this.source.functionCall("container.invokePartial", "", d));
                }, assignToHash: function (a) {
                    var b = this.popStack(),
                        c = void 0,
                        d = void 0,
                        e = void 0;this.trackIds && (e = this.popStack()), this.stringParams && (d = this.popStack(), c = this.popStack());var f = this.hash;c && (f.contexts[a] = c), d && (f.types[a] = d), e && (f.ids[a] = e), f.values[a] = b;
                }, pushId: function (a, b, c) {
                    "BlockParam" === a ? this.pushStackLiteral("blockParams[" + b[0] + "].path[" + b[1] + "]" + (c ? " + " + JSON.stringify("." + c) : "")) : "PathExpression" === a ? this.pushString(b) : "SubExpression" === a ? this.pushStackLiteral("true") : this.pushStackLiteral("null");
                }, compiler: e, compileChildren: function (a, b) {
                    for (var c = a.children, d = void 0, e = void 0, f = 0, g = c.length; f < g; f++) {
                        d = c[f], e = new this.compiler();var h = this.matchExistingProgram(d);if (null == h) {
                            this.context.programs.push("");var i = this.context.programs.length;d.index = i, d.name = "program" + i, this.context.programs[i] = e.compile(d, b, this.context, !this.precompile), this.context.decorators[i] = e.decorators, this.context.environments[i] = d, this.useDepths = this.useDepths || e.useDepths, this.useBlockParams = this.useBlockParams || e.useBlockParams, d.useDepths = this.useDepths, d.useBlockParams = this.useBlockParams;
                        } else d.index = h.index, d.name = "program" + h.index, this.useDepths = this.useDepths || h.useDepths, this.useBlockParams = this.useBlockParams || h.useBlockParams;
                    }
                }, matchExistingProgram: function (a) {
                    for (var b = 0, c = this.context.environments.length; b < c; b++) {
                        var d = this.context.environments[b];if (d && d.equals(a)) return d;
                    }
                }, programExpression: function (a) {
                    var b = this.environment.children[a],
                        c = [b.index, "data", b.blockParams];return (this.useBlockParams || this.useDepths) && c.push("blockParams"), this.useDepths && c.push("depths"), "container.program(" + c.join(", ") + ")";
                }, useRegister: function (a) {
                    this.registers[a] || (this.registers[a] = !0, this.registers.list.push(a));
                }, push: function (a) {
                    return a instanceof d || (a = this.source.wrap(a)), this.inlineStack.push(a), a;
                }, pushStackLiteral: function (a) {
                    this.push(new d(a));
                }, pushSource: function (a) {
                    this.pendingContent && (this.source.push(this.appendToBuffer(this.source.quotedString(this.pendingContent), this.pendingLocation)), this.pendingContent = void 0), a && this.source.push(a);
                }, replaceStack: function (a) {
                    var b = ["("],
                        c = void 0,
                        e = void 0,
                        f = void 0;if (!this.isInline()) throw new j["default"]("replaceStack on non-inline");var g = this.popStack(!0);if (g instanceof d) c = [g.value], b = ["(", c], f = !0;else {
                        e = !0;var h = this.incrStack();b = ["((", this.push(h), " = ", g, ")"], c = this.topStack();
                    }var i = a.call(this, c);f || this.popStack(), e && this.stackSlot--, this.push(b.concat(i, ")"));
                }, incrStack: function () {
                    return this.stackSlot++, this.stackSlot > this.stackVars.length && this.stackVars.push("stack" + this.stackSlot), this.topStackName();
                }, topStackName: function () {
                    return "stack" + this.stackSlot;
                }, flushInline: function () {
                    var a = this.inlineStack;this.inlineStack = [];for (var b = 0, c = a.length; b < c; b++) {
                        var e = a[b];if (e instanceof d) this.compileStack.push(e);else {
                            var f = this.incrStack();this.pushSource([f, " = ", e, ";"]), this.compileStack.push(f);
                        }
                    }
                }, isInline: function () {
                    return this.inlineStack.length;
                }, popStack: function (a) {
                    var b = this.isInline(),
                        c = (b ? this.inlineStack : this.compileStack).pop();if (!a && c instanceof d) return c.value;if (!b) {
                        if (!this.stackSlot) throw new j["default"]("Invalid stack pop");this.stackSlot--;
                    }return c;
                }, topStack: function () {
                    var a = this.isInline() ? this.inlineStack : this.compileStack,
                        b = a[a.length - 1];return b instanceof d ? b.value : b;
                }, contextName: function (a) {
                    return this.useDepths && a ? "depths[" + a + "]" : "depth" + a;
                }, quotedString: function (a) {
                    return this.source.quotedString(a);
                }, objectLiteral: function (a) {
                    return this.source.objectLiteral(a);
                }, aliasable: function (a) {
                    var b = this.aliases[a];return b ? (b.referenceCount++, b) : (b = this.aliases[a] = this.source.wrap(a), b.aliasable = !0, b.referenceCount = 1, b);
                }, setupHelper: function (a, b, c) {
                    var d = [],
                        e = this.setupHelperArgs(b, a, d, c),
                        f = this.nameLookup("helpers", b, "helper"),
                        g = this.aliasable(this.contextName(0) + " != null ? " + this.contextName(0) + " : (container.nullContext || {})");return { params: d, paramsInit: e, name: f, callParams: [g].concat(d) };
                }, setupParams: function (a, b, c) {
                    var d = {},
                        e = [],
                        f = [],
                        g = [],
                        h = !c,
                        i = void 0;h && (c = []), d.name = this.quotedString(a), d.hash = this.popStack(), this.trackIds && (d.hashIds = this.popStack()), this.stringParams && (d.hashTypes = this.popStack(), d.hashContexts = this.popStack());var j = this.popStack(),
                        k = this.popStack();(k || j) && (d.fn = k || "container.noop", d.inverse = j || "container.noop");for (var l = b; l--;) i = this.popStack(), c[l] = i, this.trackIds && (g[l] = this.popStack()), this.stringParams && (f[l] = this.popStack(), e[l] = this.popStack());return h && (d.args = this.source.generateArray(c)), this.trackIds && (d.ids = this.source.generateArray(g)), this.stringParams && (d.types = this.source.generateArray(f), d.contexts = this.source.generateArray(e)), this.options.data && (d.data = "data"), this.useBlockParams && (d.blockParams = "blockParams"), d;
                }, setupHelperArgs: function (a, b, c, d) {
                    var e = this.setupParams(a, b, c);return e = this.objectLiteral(e), d ? (this.useRegister("options"), c.push("options"), ["options=", e]) : c ? (c.push(e), "") : e;
                } }, function () {
                for (var a = "break else new var case finally return void catch for switch while continue function this with default if throw delete in try do instanceof typeof abstract enum int short boolean export interface static byte extends long super char final native synchronized class float package throws const goto private transient debugger implements protected volatile double import public let yield await null true false".split(" "), b = e.RESERVED_WORDS = {}, c = 0, d = a.length; c < d; c++) b[a[c]] = !0;
            }(), e.isValidJavaScriptVariableName = function (a) {
                return !e.RESERVED_WORDS[a] && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(a);
            }, b["default"] = e, a.exports = b["default"];
        }, function (a, b, c) {
            "use strict";
            function d(a, b, c) {
                if (f.isArray(a)) {
                    for (var d = [], e = 0, g = a.length; e < g; e++) d.push(b.wrap(a[e], c));return d;
                }return "boolean" == typeof a || "number" == typeof a ? a + "" : a;
            }function e(a) {
                this.srcFile = a, this.source = [];
            }b.__esModule = !0;var f = c(5),
                g = void 0;try {} catch (h) {}g || (g = function (a, b, c, d) {
                this.src = "", d && this.add(d);
            }, g.prototype = { add: function (a) {
                    f.isArray(a) && (a = a.join("")), this.src += a;
                }, prepend: function (a) {
                    f.isArray(a) && (a = a.join("")), this.src = a + this.src;
                }, toStringWithSourceMap: function () {
                    return { code: this.toString() };
                }, toString: function () {
                    return this.src;
                } }), e.prototype = { isEmpty: function () {
                    return !this.source.length;
                }, prepend: function (a, b) {
                    this.source.unshift(this.wrap(a, b));
                }, push: function (a, b) {
                    this.source.push(this.wrap(a, b));
                }, merge: function () {
                    var a = this.empty();return this.each(function (b) {
                        a.add(["  ", b, "\n"]);
                    }), a;
                }, each: function (a) {
                    for (var b = 0, c = this.source.length; b < c; b++) a(this.source[b]);
                }, empty: function () {
                    var a = this.currentLocation || { start: {} };return new g(a.start.line, a.start.column, this.srcFile);
                }, wrap: function (a) {
                    var b = arguments.length <= 1 || void 0 === arguments[1] ? this.currentLocation || { start: {} } : arguments[1];return a instanceof g ? a : (a = d(a, this, b), new g(b.start.line, b.start.column, this.srcFile, a));
                }, functionCall: function (a, b, c) {
                    return c = this.generateList(c), this.wrap([a, b ? "." + b + "(" : "(", c, ")"]);
                }, quotedString: function (a) {
                    return '"' + (a + "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029") + '"';
                }, objectLiteral: function (a) {
                    var b = [];for (var c in a) if (a.hasOwnProperty(c)) {
                        var e = d(a[c], this);"undefined" !== e && b.push([this.quotedString(c), ":", e]);
                    }var f = this.generateList(b);return f.prepend("{"), f.add("}"), f;
                }, generateList: function (a) {
                    for (var b = this.empty(), c = 0, e = a.length; c < e; c++) c && b.add(","), b.add(d(a[c], this));return b;
                }, generateArray: function (a) {
                    var b = this.generateList(a);return b.prepend("["), b.add("]"), b;
                } }, b["default"] = e, a.exports = b["default"];
        }]);
    });
    //     Fiber.js 1.0.5
    //     @author: Kirollos Risk
    //
    //     Copyright (c) 2012 LinkedIn.
    //     All Rights Reserved. Apache Software License 2.0
    //     http://www.apache.org/licenses/LICENSE-2.0
    (function () {
        (function (a, b) {
            if (typeof exports === "object") {
                module.exports = b(this);
            } else {
                if (typeof define === "function" && define.amd) {
                    define('Fiber', [], function () {
                        return b(a);
                    });
                } else {
                    a.Fiber = b(a);
                }
            }
        })(this, function (c) {
            var b = false,
                a = Array.prototype,
                d = c.Fiber;function f(i, h) {
                var g;for (g in i) {
                    if (i.hasOwnProperty(g)) {
                        h[g] = i[g];
                    }
                }
            }function e() {}e.extend = function (i) {
                var h = this.prototype,
                    g = i(h),
                    j;function k() {
                    if (!b) {
                        this.init.apply(this, arguments);this.init = void 0;
                    }
                }b = true;j = k.prototype = new this();b = false;j.init = function () {
                    if (typeof h.init === "function") {
                        h.init.apply(this, arguments);
                    }
                };f(g, j);j.constructor = k;k.__base__ = h;k.extend = k.prototype.extend || e.extend;return k;
            };e.proxy = function (j, g) {
                var h,
                    k = {},
                    i;if (arguments.length === 1) {
                    g = j;j = g.constructor.__base__;
                }i = function (l) {
                    return function () {
                        return j[l].apply(g, arguments);
                    };
                };for (h in j) {
                    if (j.hasOwnProperty(h) && typeof j[h] === "function") {
                        k[h] = i(h);
                    }
                }return k;
            };e.decorate = function (h) {
                var k,
                    l = h.constructor.__base__,
                    j = a.slice.call(arguments, 1),
                    g = j.length;for (k = 0; k < g; k++) {
                    f(j[k].call(h, l), h);
                }
            };e.mixin = function (k) {
                var j,
                    l = k.__base__,
                    h = a.slice.call(arguments, 1),
                    g = h.length;for (j = 0; j < g; j++) {
                    f(h[j](l), k.prototype);
                }
            };e.noConflict = function () {
                c.Fiber = d;return e;
            };return e;
        });
    })();
    (function (global, factory) {
        typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() : typeof define === 'function' && define.amd ? define('dexie', factory) : global.Dexie = factory();
    })(this, function () {
        'use strict';

        /*
        * Dexie.js - a minimalistic wrapper for IndexedDB
        * ===============================================
        *
        * By David Fahlander, david.fahlander@gmail.com
        *
        * Version 1.5.1, Tue Nov 01 2016
        * www.dexie.com
        * Apache License Version 2.0, January 2004, http://www.apache.org/licenses/
        */

        var keys = Object.keys;
        var isArray = Array.isArray;
        var _global = typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : global;

        function extend(obj, extension) {
            if (typeof extension !== 'object') return obj;
            keys(extension).forEach(function (key) {
                obj[key] = extension[key];
            });
            return obj;
        }

        var getProto = Object.getPrototypeOf;
        var _hasOwn = {}.hasOwnProperty;
        function hasOwn(obj, prop) {
            return _hasOwn.call(obj, prop);
        }

        function props(proto, extension) {
            if (typeof extension === 'function') extension = extension(getProto(proto));
            keys(extension).forEach(function (key) {
                setProp(proto, key, extension[key]);
            });
        }

        function setProp(obj, prop, functionOrGetSet, options) {
            Object.defineProperty(obj, prop, extend(functionOrGetSet && hasOwn(functionOrGetSet, "get") && typeof functionOrGetSet.get === 'function' ? { get: functionOrGetSet.get, set: functionOrGetSet.set, configurable: true } : { value: functionOrGetSet, configurable: true, writable: true }, options));
        }

        function derive(Child) {
            return {
                from: function (Parent) {
                    Child.prototype = Object.create(Parent.prototype);
                    setProp(Child.prototype, "constructor", Child);
                    return {
                        extend: props.bind(null, Child.prototype)
                    };
                }
            };
        }

        var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

        function getPropertyDescriptor(obj, prop) {
            var pd = getOwnPropertyDescriptor(obj, prop),
                proto;
            return pd || (proto = getProto(obj)) && getPropertyDescriptor(proto, prop);
        }

        var _slice = [].slice;
        function slice(args, start, end) {
            return _slice.call(args, start, end);
        }

        function override(origFunc, overridedFactory) {
            return overridedFactory(origFunc);
        }

        function doFakeAutoComplete(fn) {
            var to = setTimeout(fn, 1000);
            clearTimeout(to);
        }

        function assert(b) {
            if (!b) throw new Error("Assertion Failed");
        }

        function asap(fn) {
            if (_global.setImmediate) setImmediate(fn);else setTimeout(fn, 0);
        }

        /** Generate an object (hash map) based on given array.
         * @param extractor Function taking an array item and its index and returning an array of 2 items ([key, value]) to
         *        instert on the resulting object for each item in the array. If this function returns a falsy value, the
         *        current item wont affect the resulting object.
         */
        function arrayToObject(array, extractor) {
            return array.reduce(function (result, item, i) {
                var nameAndValue = extractor(item, i);
                if (nameAndValue) result[nameAndValue[0]] = nameAndValue[1];
                return result;
            }, {});
        }

        function trycatcher(fn, reject) {
            return function () {
                try {
                    fn.apply(this, arguments);
                } catch (e) {
                    reject(e);
                }
            };
        }

        function tryCatch(fn, onerror, args) {
            try {
                fn.apply(null, args);
            } catch (ex) {
                onerror && onerror(ex);
            }
        }

        function getByKeyPath(obj, keyPath) {
            // http://www.w3.org/TR/IndexedDB/#steps-for-extracting-a-key-from-a-value-using-a-key-path
            if (hasOwn(obj, keyPath)) return obj[keyPath]; // This line is moved from last to first for optimization purpose.
            if (!keyPath) return obj;
            if (typeof keyPath !== 'string') {
                var rv = [];
                for (var i = 0, l = keyPath.length; i < l; ++i) {
                    var val = getByKeyPath(obj, keyPath[i]);
                    rv.push(val);
                }
                return rv;
            }
            var period = keyPath.indexOf('.');
            if (period !== -1) {
                var innerObj = obj[keyPath.substr(0, period)];
                return innerObj === undefined ? undefined : getByKeyPath(innerObj, keyPath.substr(period + 1));
            }
            return undefined;
        }

        function setByKeyPath(obj, keyPath, value) {
            if (!obj || keyPath === undefined) return;
            if ('isFrozen' in Object && Object.isFrozen(obj)) return;
            if (typeof keyPath !== 'string' && 'length' in keyPath) {
                assert(typeof value !== 'string' && 'length' in value);
                for (var i = 0, l = keyPath.length; i < l; ++i) {
                    setByKeyPath(obj, keyPath[i], value[i]);
                }
            } else {
                var period = keyPath.indexOf('.');
                if (period !== -1) {
                    var currentKeyPath = keyPath.substr(0, period);
                    var remainingKeyPath = keyPath.substr(period + 1);
                    if (remainingKeyPath === "") {
                        if (value === undefined) delete obj[currentKeyPath];else obj[currentKeyPath] = value;
                    } else {
                        var innerObj = obj[currentKeyPath];
                        if (!innerObj) innerObj = obj[currentKeyPath] = {};
                        setByKeyPath(innerObj, remainingKeyPath, value);
                    }
                } else {
                    if (value === undefined) delete obj[keyPath];else obj[keyPath] = value;
                }
            }
        }

        function delByKeyPath(obj, keyPath) {
            if (typeof keyPath === 'string') setByKeyPath(obj, keyPath, undefined);else if ('length' in keyPath) [].map.call(keyPath, function (kp) {
                setByKeyPath(obj, kp, undefined);
            });
        }

        function shallowClone(obj) {
            var rv = {};
            for (var m in obj) {
                if (hasOwn(obj, m)) rv[m] = obj[m];
            }
            return rv;
        }

        function deepClone(any) {
            if (!any || typeof any !== 'object') return any;
            var rv;
            if (isArray(any)) {
                rv = [];
                for (var i = 0, l = any.length; i < l; ++i) {
                    rv.push(deepClone(any[i]));
                }
            } else if (any instanceof Date) {
                rv = new Date();
                rv.setTime(any.getTime());
            } else {
                rv = any.constructor ? Object.create(any.constructor.prototype) : {};
                for (var prop in any) {
                    if (hasOwn(any, prop)) {
                        rv[prop] = deepClone(any[prop]);
                    }
                }
            }
            return rv;
        }

        function getObjectDiff(a, b, rv, prfx) {
            // Compares objects a and b and produces a diff object.
            rv = rv || {};
            prfx = prfx || '';
            keys(a).forEach(function (prop) {
                if (!hasOwn(b, prop)) rv[prfx + prop] = undefined; // Property removed
                else {
                        var ap = a[prop],
                            bp = b[prop];
                        if (typeof ap === 'object' && typeof bp === 'object' && ap && bp && ap.constructor === bp.constructor)
                            // Same type of object but its properties may have changed
                            getObjectDiff(ap, bp, rv, prfx + prop + ".");else if (ap !== bp) rv[prfx + prop] = b[prop]; // Primitive value changed
                    }
            });
            keys(b).forEach(function (prop) {
                if (!hasOwn(a, prop)) {
                    rv[prfx + prop] = b[prop]; // Property added
                }
            });
            return rv;
        }

        // If first argument is iterable or array-like, return it as an array
        var iteratorSymbol = typeof Symbol !== 'undefined' && Symbol.iterator;
        var getIteratorOf = iteratorSymbol ? function (x) {
            var i;
            return x != null && (i = x[iteratorSymbol]) && i.apply(x);
        } : function () {
            return null;
        };

        var NO_CHAR_ARRAY = {};
        // Takes one or several arguments and returns an array based on the following criteras:
        // * If several arguments provided, return arguments converted to an array in a way that
        //   still allows javascript engine to optimize the code.
        // * If single argument is an array, return a clone of it.
        // * If this-pointer equals NO_CHAR_ARRAY, don't accept strings as valid iterables as a special
        //   case to the two bullets below.
        // * If single argument is an iterable, convert it to an array and return the resulting array.
        // * If single argument is array-like (has length of type number), convert it to an array.
        function getArrayOf(arrayLike) {
            var i, a, x, it;
            if (arguments.length === 1) {
                if (isArray(arrayLike)) return arrayLike.slice();
                if (this === NO_CHAR_ARRAY && typeof arrayLike === 'string') return [arrayLike];
                if (it = getIteratorOf(arrayLike)) {
                    a = [];
                    while (x = it.next(), !x.done) {
                        a.push(x.value);
                    }return a;
                }
                if (arrayLike == null) return [arrayLike];
                i = arrayLike.length;
                if (typeof i === 'number') {
                    a = new Array(i);
                    while (i--) {
                        a[i] = arrayLike[i];
                    }return a;
                }
                return [arrayLike];
            }
            i = arguments.length;
            a = new Array(i);
            while (i--) {
                a[i] = arguments[i];
            }return a;
        }

        var concat = [].concat;
        function flatten(a) {
            return concat.apply([], a);
        }

        function nop() {}
        function mirror(val) {
            return val;
        }
        function pureFunctionChain(f1, f2) {
            // Enables chained events that takes ONE argument and returns it to the next function in chain.
            // This pattern is used in the hook("reading") event.
            if (f1 == null || f1 === mirror) return f2;
            return function (val) {
                return f2(f1(val));
            };
        }

        function callBoth(on1, on2) {
            return function () {
                on1.apply(this, arguments);
                on2.apply(this, arguments);
            };
        }

        function hookCreatingChain(f1, f2) {
            // Enables chained events that takes several arguments and may modify first argument by making a modification and then returning the same instance.
            // This pattern is used in the hook("creating") event.
            if (f1 === nop) return f2;
            return function () {
                var res = f1.apply(this, arguments);
                if (res !== undefined) arguments[0] = res;
                var onsuccess = this.onsuccess,

                // In case event listener has set this.onsuccess
                onerror = this.onerror; // In case event listener has set this.onerror
                this.onsuccess = null;
                this.onerror = null;
                var res2 = f2.apply(this, arguments);
                if (onsuccess) this.onsuccess = this.onsuccess ? callBoth(onsuccess, this.onsuccess) : onsuccess;
                if (onerror) this.onerror = this.onerror ? callBoth(onerror, this.onerror) : onerror;
                return res2 !== undefined ? res2 : res;
            };
        }

        function hookDeletingChain(f1, f2) {
            if (f1 === nop) return f2;
            return function () {
                f1.apply(this, arguments);
                var onsuccess = this.onsuccess,

                // In case event listener has set this.onsuccess
                onerror = this.onerror; // In case event listener has set this.onerror
                this.onsuccess = this.onerror = null;
                f2.apply(this, arguments);
                if (onsuccess) this.onsuccess = this.onsuccess ? callBoth(onsuccess, this.onsuccess) : onsuccess;
                if (onerror) this.onerror = this.onerror ? callBoth(onerror, this.onerror) : onerror;
            };
        }

        function hookUpdatingChain(f1, f2) {
            if (f1 === nop) return f2;
            return function (modifications) {
                var res = f1.apply(this, arguments);
                extend(modifications, res); // If f1 returns new modifications, extend caller's modifications with the result before calling next in chain.
                var onsuccess = this.onsuccess,

                // In case event listener has set this.onsuccess
                onerror = this.onerror; // In case event listener has set this.onerror
                this.onsuccess = null;
                this.onerror = null;
                var res2 = f2.apply(this, arguments);
                if (onsuccess) this.onsuccess = this.onsuccess ? callBoth(onsuccess, this.onsuccess) : onsuccess;
                if (onerror) this.onerror = this.onerror ? callBoth(onerror, this.onerror) : onerror;
                return res === undefined ? res2 === undefined ? undefined : res2 : extend(res, res2);
            };
        }

        function reverseStoppableEventChain(f1, f2) {
            if (f1 === nop) return f2;
            return function () {
                if (f2.apply(this, arguments) === false) return false;
                return f1.apply(this, arguments);
            };
        }

        function promisableChain(f1, f2) {
            if (f1 === nop) return f2;
            return function () {
                var res = f1.apply(this, arguments);
                if (res && typeof res.then === 'function') {
                    var thiz = this,
                        i = arguments.length,
                        args = new Array(i);
                    while (i--) {
                        args[i] = arguments[i];
                    }return res.then(function () {
                        return f2.apply(thiz, args);
                    });
                }
                return f2.apply(this, arguments);
            };
        }

        // By default, debug will be true only if platform is a web platform and its page is served from localhost.
        // When debug = true, error's stacks will contain asyncronic long stacks.
        var debug = typeof location !== 'undefined' &&
        // By default, use debug mode if served from localhost.
        /^(http|https):\/\/(localhost|127\.0\.0\.1)/.test(location.href);

        function setDebug(value, filter) {
            debug = value;
            libraryFilter = filter;
        }

        var libraryFilter = function () {
            return true;
        };

        var NEEDS_THROW_FOR_STACK = !new Error("").stack;

        function getErrorWithStack() {
            "use strict";

            if (NEEDS_THROW_FOR_STACK) try {
                // Doing something naughty in strict mode here to trigger a specific error
                // that can be explicitely ignored in debugger's exception settings.
                // If we'd just throw new Error() here, IE's debugger's exception settings
                // will just consider it as "exception thrown by javascript code" which is
                // something you wouldn't want it to ignore.
                getErrorWithStack.arguments;
                throw new Error(); // Fallback if above line don't throw.
            } catch (e) {
                return e;
            }
            return new Error();
        }

        function prettyStack(exception, numIgnoredFrames) {
            var stack = exception.stack;
            if (!stack) return "";
            numIgnoredFrames = numIgnoredFrames || 0;
            if (stack.indexOf(exception.name) === 0) numIgnoredFrames += (exception.name + exception.message).split('\n').length;
            return stack.split('\n').slice(numIgnoredFrames).filter(libraryFilter).map(function (frame) {
                return "\n" + frame;
            }).join('');
        }

        function deprecated(what, fn) {
            return function () {
                console.warn(what + " is deprecated. See https://github.com/dfahlander/Dexie.js/wiki/Deprecations. " + prettyStack(getErrorWithStack(), 1));
                return fn.apply(this, arguments);
            };
        }

        var dexieErrorNames = ['Modify', 'Bulk', 'OpenFailed', 'VersionChange', 'Schema', 'Upgrade', 'InvalidTable', 'MissingAPI', 'NoSuchDatabase', 'InvalidArgument', 'SubTransaction', 'Unsupported', 'Internal', 'DatabaseClosed', 'IncompatiblePromise'];

        var idbDomErrorNames = ['Unknown', 'Constraint', 'Data', 'TransactionInactive', 'ReadOnly', 'Version', 'NotFound', 'InvalidState', 'InvalidAccess', 'Abort', 'Timeout', 'QuotaExceeded', 'Syntax', 'DataClone'];

        var errorList = dexieErrorNames.concat(idbDomErrorNames);

        var defaultTexts = {
            VersionChanged: "Database version changed by other database connection",
            DatabaseClosed: "Database has been closed",
            Abort: "Transaction aborted",
            TransactionInactive: "Transaction has already completed or failed"
        };

        //
        // DexieError - base class of all out exceptions.
        //
        function DexieError(name, msg) {
            // Reason we don't use ES6 classes is because:
            // 1. It bloats transpiled code and increases size of minified code.
            // 2. It doesn't give us much in this case.
            // 3. It would require sub classes to call super(), which
            //    is not needed when deriving from Error.
            this._e = getErrorWithStack();
            this.name = name;
            this.message = msg;
        }

        derive(DexieError).from(Error).extend({
            stack: {
                get: function () {
                    return this._stack || (this._stack = this.name + ": " + this.message + prettyStack(this._e, 2));
                }
            },
            toString: function () {
                return this.name + ": " + this.message;
            }
        });

        function getMultiErrorMessage(msg, failures) {
            return msg + ". Errors: " + failures.map(function (f) {
                return f.toString();
            }).filter(function (v, i, s) {
                return s.indexOf(v) === i;
            }) // Only unique error strings
            .join('\n');
        }

        //
        // ModifyError - thrown in WriteableCollection.modify()
        // Specific constructor because it contains members failures and failedKeys.
        //
        function ModifyError(msg, failures, successCount, failedKeys) {
            this._e = getErrorWithStack();
            this.failures = failures;
            this.failedKeys = failedKeys;
            this.successCount = successCount;
        }
        derive(ModifyError).from(DexieError);

        function BulkError(msg, failures) {
            this._e = getErrorWithStack();
            this.name = "BulkError";
            this.failures = failures;
            this.message = getMultiErrorMessage(msg, failures);
        }
        derive(BulkError).from(DexieError);

        //
        //
        // Dynamically generate error names and exception classes based
        // on the names in errorList.
        //
        //

        // Map of {ErrorName -> ErrorName + "Error"}
        var errnames = errorList.reduce(function (obj, name) {
            return obj[name] = name + "Error", obj;
        }, {});

        // Need an alias for DexieError because we're gonna create subclasses with the same name.
        var BaseException = DexieError;
        // Map of {ErrorName -> exception constructor}
        var exceptions = errorList.reduce(function (obj, name) {
            // Let the name be "DexieError" because this name may
            // be shown in call stack and when debugging. DexieError is
            // the most true name because it derives from DexieError,
            // and we cannot change Function.name programatically without
            // dynamically create a Function object, which would be considered
            // 'eval-evil'.
            var fullName = name + "Error";
            function DexieError(msgOrInner, inner) {
                this._e = getErrorWithStack();
                this.name = fullName;
                if (!msgOrInner) {
                    this.message = defaultTexts[name] || fullName;
                    this.inner = null;
                } else if (typeof msgOrInner === 'string') {
                    this.message = msgOrInner;
                    this.inner = inner || null;
                } else if (typeof msgOrInner === 'object') {
                    this.message = msgOrInner.name + ' ' + msgOrInner.message;
                    this.inner = msgOrInner;
                }
            }
            derive(DexieError).from(BaseException);
            obj[name] = DexieError;
            return obj;
        }, {});

        // Use ECMASCRIPT standard exceptions where applicable:
        exceptions.Syntax = SyntaxError;
        exceptions.Type = TypeError;
        exceptions.Range = RangeError;

        var exceptionMap = idbDomErrorNames.reduce(function (obj, name) {
            obj[name + "Error"] = exceptions[name];
            return obj;
        }, {});

        function mapError(domError, message) {
            if (!domError || domError instanceof DexieError || domError instanceof TypeError || domError instanceof SyntaxError || !domError.name || !exceptionMap[domError.name]) return domError;
            var rv = new exceptionMap[domError.name](message || domError.message, domError);
            if ("stack" in domError) {
                // Derive stack from inner exception if it has a stack
                setProp(rv, "stack", { get: function () {
                        return this.inner.stack;
                    } });
            }
            return rv;
        }

        var fullNameExceptions = errorList.reduce(function (obj, name) {
            if (["Syntax", "Type", "Range"].indexOf(name) === -1) obj[name + "Error"] = exceptions[name];
            return obj;
        }, {});

        fullNameExceptions.ModifyError = ModifyError;
        fullNameExceptions.DexieError = DexieError;
        fullNameExceptions.BulkError = BulkError;

        function Events(ctx) {
            var evs = {};
            var rv = function (eventName, subscriber) {
                if (subscriber) {
                    // Subscribe. If additional arguments than just the subscriber was provided, forward them as well.
                    var i = arguments.length,
                        args = new Array(i - 1);
                    while (--i) {
                        args[i - 1] = arguments[i];
                    }evs[eventName].subscribe.apply(null, args);
                    return ctx;
                } else if (typeof eventName === 'string') {
                    // Return interface allowing to fire or unsubscribe from event
                    return evs[eventName];
                }
            };
            rv.addEventType = add;

            for (var i = 1, l = arguments.length; i < l; ++i) {
                add(arguments[i]);
            }

            return rv;

            function add(eventName, chainFunction, defaultFunction) {
                if (typeof eventName === 'object') return addConfiguredEvents(eventName);
                if (!chainFunction) chainFunction = reverseStoppableEventChain;
                if (!defaultFunction) defaultFunction = nop;

                var context = {
                    subscribers: [],
                    fire: defaultFunction,
                    subscribe: function (cb) {
                        if (context.subscribers.indexOf(cb) === -1) {
                            context.subscribers.push(cb);
                            context.fire = chainFunction(context.fire, cb);
                        }
                    },
                    unsubscribe: function (cb) {
                        context.subscribers = context.subscribers.filter(function (fn) {
                            return fn !== cb;
                        });
                        context.fire = context.subscribers.reduce(chainFunction, defaultFunction);
                    }
                };
                evs[eventName] = rv[eventName] = context;
                return context;
            }

            function addConfiguredEvents(cfg) {
                // events(this, {reading: [functionChain, nop]});
                keys(cfg).forEach(function (eventName) {
                    var args = cfg[eventName];
                    if (isArray(args)) {
                        add(eventName, cfg[eventName][0], cfg[eventName][1]);
                    } else if (args === 'asap') {
                        // Rather than approaching event subscription using a functional approach, we here do it in a for-loop where subscriber is executed in its own stack
                        // enabling that any exception that occur wont disturb the initiator and also not nescessary be catched and forgotten.
                        var context = add(eventName, mirror, function fire() {
                            // Optimazation-safe cloning of arguments into args.
                            var i = arguments.length,
                                args = new Array(i);
                            while (i--) {
                                args[i] = arguments[i];
                            } // All each subscriber:
                            context.subscribers.forEach(function (fn) {
                                asap(function fireEvent() {
                                    fn.apply(null, args);
                                });
                            });
                        });
                    } else throw new exceptions.InvalidArgument("Invalid event config");
                });
            }
        }

        //
        // Promise Class for Dexie library
        //
        // I started out writing this Promise class by copying promise-light (https://github.com/taylorhakes/promise-light) by
        // https://github.com/taylorhakes - an A+ and ECMASCRIPT 6 compliant Promise implementation.
        //
        // Modifications needed to be done to support indexedDB because it wont accept setTimeout()
        // (See discussion: https://github.com/promises-aplus/promises-spec/issues/45) .
        // This topic was also discussed in the following thread: https://github.com/promises-aplus/promises-spec/issues/45
        //
        // This implementation will not use setTimeout or setImmediate when it's not needed. The behavior is 100% Promise/A+ compliant since
        // the caller of new Promise() can be certain that the promise wont be triggered the lines after constructing the promise.
        //
        // In previous versions this was fixed by not calling setTimeout when knowing that the resolve() or reject() came from another
        // tick. In Dexie v1.4.0, I've rewritten the Promise class entirely. Just some fragments of promise-light is left. I use
        // another strategy now that simplifies everything a lot: to always execute callbacks in a new tick, but have an own microTick
        // engine that is used instead of setImmediate() or setTimeout().
        // Promise class has also been optimized a lot with inspiration from bluebird - to avoid closures as much as possible.
        // Also with inspiration from bluebird, asyncronic stacks in debug mode.
        //
        // Specific non-standard features of this Promise class:
        // * Async static context support (Promise.PSD)
        // * Promise.follow() method built upon PSD, that allows user to track all promises created from current stack frame
        //   and below + all promises that those promises creates or awaits.
        // * Detect any unhandled promise in a PSD-scope (PSD.onunhandled). 
        //
        // David Fahlander, https://github.com/dfahlander
        //

        // Just a pointer that only this module knows about.
        // Used in Promise constructor to emulate a private constructor.
        var INTERNAL = {};

        // Async stacks (long stacks) must not grow infinitely.
        var LONG_STACKS_CLIP_LIMIT = 100;
        var MAX_LONG_STACKS = 20;
        var stack_being_generated = false;

        /* The default "nextTick" function used only for the very first promise in a promise chain.
           As soon as then promise is resolved or rejected, all next tasks will be executed in micro ticks
           emulated in this module. For indexedDB compatibility, this means that every method needs to 
           execute at least one promise before doing an indexedDB operation. Dexie will always call 
           db.ready().then() for every operation to make sure the indexedDB event is started in an
           emulated micro tick.
        */
        var schedulePhysicalTick = _global.setImmediate ?
        // setImmediate supported. Those modern platforms also supports Function.bind().
        setImmediate.bind(null, physicalTick) : _global.MutationObserver ?
        // MutationObserver supported
        function () {
            var hiddenDiv = document.createElement("div");
            new MutationObserver(function () {
                physicalTick();
                hiddenDiv = null;
            }).observe(hiddenDiv, { attributes: true });
            hiddenDiv.setAttribute('i', '1');
        } :
        // No support for setImmediate or MutationObserver. No worry, setTimeout is only called
        // once time. Every tick that follows will be our emulated micro tick.
        // Could have uses setTimeout.bind(null, 0, physicalTick) if it wasnt for that FF13 and below has a bug 
        function () {
            setTimeout(physicalTick, 0);
        };

        // Confifurable through Promise.scheduler.
        // Don't export because it would be unsafe to let unknown
        // code call it unless they do try..catch within their callback.
        // This function can be retrieved through getter of Promise.scheduler though,
        // but users must not do Promise.scheduler (myFuncThatThrows exception)!
        var asap$1 = function (callback, args) {
            microtickQueue.push([callback, args]);
            if (needsNewPhysicalTick) {
                schedulePhysicalTick();
                needsNewPhysicalTick = false;
            }
        };

        var isOutsideMicroTick = true;
        var needsNewPhysicalTick = true;
        var unhandledErrors = [];
        var rejectingErrors = [];
        var currentFulfiller = null;
        var rejectionMapper = mirror; // Remove in next major when removing error mapping of DOMErrors and DOMExceptions

        var globalPSD = {
            global: true,
            ref: 0,
            unhandleds: [],
            onunhandled: globalError,
            //env: null, // Will be set whenever leaving a scope using wrappers.snapshot()
            finalize: function () {
                this.unhandleds.forEach(function (uh) {
                    try {
                        globalError(uh[0], uh[1]);
                    } catch (e) {}
                });
            }
        };

        var PSD = globalPSD;

        var microtickQueue = []; // Callbacks to call in this or next physical tick.
        var numScheduledCalls = 0; // Number of listener-calls left to do in this physical tick.
        var tickFinalizers = []; // Finalizers to call when there are no more async calls scheduled within current physical tick.

        // Wrappers are not being used yet. Their framework is functioning and can be used
        // to replace environment during a PSD scope (a.k.a. 'zone').
        /* **KEEP** export var wrappers = (() => {
            var wrappers = [];
        
            return {
                snapshot: () => {
                    var i = wrappers.length,
                        result = new Array(i);
                    while (i--) result[i] = wrappers[i].snapshot();
                    return result;
                },
                restore: values => {
                    var i = wrappers.length;
                    while (i--) wrappers[i].restore(values[i]);
                },
                wrap: () => wrappers.map(w => w.wrap()),
                add: wrapper => {
                    wrappers.push(wrapper);
                }
            };
        })();
        */

        function Promise(fn) {
            if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new');
            this._listeners = [];
            this.onuncatched = nop; // Deprecate in next major. Not needed. Better to use global error handler.

            // A library may set `promise._lib = true;` after promise is created to make resolve() or reject()
            // execute the microtask engine implicitely within the call to resolve() or reject().
            // To remain A+ compliant, a library must only set `_lib=true` if it can guarantee that the stack
            // only contains library code when calling resolve() or reject().
            // RULE OF THUMB: ONLY set _lib = true for promises explicitely resolving/rejecting directly from
            // global scope (event handler, timer etc)!
            this._lib = false;
            // Current async scope
            var psd = this._PSD = PSD;

            if (debug) {
                this._stackHolder = getErrorWithStack();
                this._prev = null;
                this._numPrev = 0; // Number of previous promises (for long stacks)
                linkToPreviousPromise(this, currentFulfiller);
            }

            if (typeof fn !== 'function') {
                if (fn !== INTERNAL) throw new TypeError('Not a function');
                // Private constructor (INTERNAL, state, value).
                // Used internally by Promise.resolve() and Promise.reject().
                this._state = arguments[1];
                this._value = arguments[2];
                if (this._state === false) handleRejection(this, this._value); // Map error, set stack and addPossiblyUnhandledError().
                return;
            }

            this._state = null; // null (=pending), false (=rejected) or true (=resolved)
            this._value = null; // error or result
            ++psd.ref; // Refcounting current scope
            executePromiseTask(this, fn);
        }

        props(Promise.prototype, {

            then: function (onFulfilled, onRejected) {
                var _this = this;

                var rv = new Promise(function (resolve, reject) {
                    propagateToListener(_this, new Listener(onFulfilled, onRejected, resolve, reject));
                });
                debug && (!this._prev || this._state === null) && linkToPreviousPromise(rv, this);
                return rv;
            },

            _then: function (onFulfilled, onRejected) {
                // A little tinier version of then() that don't have to create a resulting promise.
                propagateToListener(this, new Listener(null, null, onFulfilled, onRejected));
            },

            catch: function (onRejected) {
                if (arguments.length === 1) return this.then(null, onRejected);
                // First argument is the Error type to catch
                var type = arguments[0],
                    handler = arguments[1];
                return typeof type === 'function' ? this.then(null, function (err) {
                    return (
                        // Catching errors by its constructor type (similar to java / c++ / c#)
                        // Sample: promise.catch(TypeError, function (e) { ... });
                        err instanceof type ? handler(err) : PromiseReject(err)
                    );
                }) : this.then(null, function (err) {
                    return (
                        // Catching errors by the error.name property. Makes sense for indexedDB where error type
                        // is always DOMError but where e.name tells the actual error type.
                        // Sample: promise.catch('ConstraintError', function (e) { ... });
                        err && err.name === type ? handler(err) : PromiseReject(err)
                    );
                });
            },

            finally: function (onFinally) {
                return this.then(function (value) {
                    onFinally();
                    return value;
                }, function (err) {
                    onFinally();
                    return PromiseReject(err);
                });
            },

            // Deprecate in next major. Needed only for db.on.error.
            uncaught: function (uncaughtHandler) {
                var _this2 = this;

                // Be backward compatible and use "onuncatched" as the event name on this.
                // Handle multiple subscribers through reverseStoppableEventChain(). If a handler returns `false`, bubbling stops.
                this.onuncatched = reverseStoppableEventChain(this.onuncatched, uncaughtHandler);
                // In case caller does this on an already rejected promise, assume caller wants to point out the error to this promise and not
                // a previous promise. Reason: the prevous promise may lack onuncatched handler. 
                if (this._state === false && unhandledErrors.indexOf(this) === -1) {
                    // Replace unhandled error's destinaion promise with this one!
                    unhandledErrors.some(function (p, i, l) {
                        return p._value === _this2._value && (l[i] = _this2);
                    });
                    // Actually we do this shit because we need to support db.on.error() correctly during db.open(). If we deprecate db.on.error, we could
                    // take away this piece of code as well as the onuncatched and uncaught() method.
                }
                return this;
            },

            stack: {
                get: function () {
                    if (this._stack) return this._stack;
                    try {
                        stack_being_generated = true;
                        var stacks = getStack(this, [], MAX_LONG_STACKS);
                        var stack = stacks.join("\nFrom previous: ");
                        if (this._state !== null) this._stack = stack; // Stack may be updated on reject.
                        return stack;
                    } finally {
                        stack_being_generated = false;
                    }
                }
            }
        });

        function Listener(onFulfilled, onRejected, resolve, reject) {
            this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
            this.onRejected = typeof onRejected === 'function' ? onRejected : null;
            this.resolve = resolve;
            this.reject = reject;
            this.psd = PSD;
        }

        // Promise Static Properties
        props(Promise, {
            all: function () {
                var values = getArrayOf.apply(null, arguments); // Supports iterables, implicit arguments and array-like.
                return new Promise(function (resolve, reject) {
                    if (values.length === 0) resolve([]);
                    var remaining = values.length;
                    values.forEach(function (a, i) {
                        return Promise.resolve(a).then(function (x) {
                            values[i] = x;
                            if (! --remaining) resolve(values);
                        }, reject);
                    });
                });
            },

            resolve: function (value) {
                if (value instanceof Promise) return value;
                if (value && typeof value.then === 'function') return new Promise(function (resolve, reject) {
                    value.then(resolve, reject);
                });
                return new Promise(INTERNAL, true, value);
            },

            reject: PromiseReject,

            race: function () {
                var values = getArrayOf.apply(null, arguments);
                return new Promise(function (resolve, reject) {
                    values.map(function (value) {
                        return Promise.resolve(value).then(resolve, reject);
                    });
                });
            },

            PSD: {
                get: function () {
                    return PSD;
                },
                set: function (value) {
                    return PSD = value;
                }
            },

            newPSD: newScope,

            usePSD: usePSD,

            scheduler: {
                get: function () {
                    return asap$1;
                },
                set: function (value) {
                    asap$1 = value;
                }
            },

            rejectionMapper: {
                get: function () {
                    return rejectionMapper;
                },
                set: function (value) {
                    rejectionMapper = value;
                } // Map reject failures
            },

            follow: function (fn) {
                return new Promise(function (resolve, reject) {
                    return newScope(function (resolve, reject) {
                        var psd = PSD;
                        psd.unhandleds = []; // For unhandled standard- or 3rd party Promises. Checked at psd.finalize()
                        psd.onunhandled = reject; // Triggered directly on unhandled promises of this library.
                        psd.finalize = callBoth(function () {
                            var _this3 = this;

                            // Unhandled standard or 3rd part promises are put in PSD.unhandleds and
                            // examined upon scope completion while unhandled rejections in this Promise
                            // will trigger directly through psd.onunhandled
                            run_at_end_of_this_or_next_physical_tick(function () {
                                _this3.unhandleds.length === 0 ? resolve() : reject(_this3.unhandleds[0]);
                            });
                        }, psd.finalize);
                        fn();
                    }, resolve, reject);
                });
            },

            on: Events(null, { "error": [reverseStoppableEventChain, defaultErrorHandler] // Default to defaultErrorHandler
            })

        });

        var PromiseOnError = Promise.on.error;
        PromiseOnError.subscribe = deprecated("Promise.on('error')", PromiseOnError.subscribe);
        PromiseOnError.unsubscribe = deprecated("Promise.on('error').unsubscribe", PromiseOnError.unsubscribe);

        /**
        * Take a potentially misbehaving resolver function and make sure
        * onFulfilled and onRejected are only called once.
        *
        * Makes no guarantees about asynchrony.
        */
        function executePromiseTask(promise, fn) {
            // Promise Resolution Procedure:
            // https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
            try {
                fn(function (value) {
                    if (promise._state !== null) return;
                    if (value === promise) throw new TypeError('A promise cannot be resolved with itself.');
                    var shouldExecuteTick = promise._lib && beginMicroTickScope();
                    if (value && typeof value.then === 'function') {
                        executePromiseTask(promise, function (resolve, reject) {
                            value instanceof Promise ? value._then(resolve, reject) : value.then(resolve, reject);
                        });
                    } else {
                        promise._state = true;
                        promise._value = value;
                        propagateAllListeners(promise);
                    }
                    if (shouldExecuteTick) endMicroTickScope();
                }, handleRejection.bind(null, promise)); // If Function.bind is not supported. Exception is handled in catch below
            } catch (ex) {
                handleRejection(promise, ex);
            }
        }

        function handleRejection(promise, reason) {
            rejectingErrors.push(reason);
            if (promise._state !== null) return;
            var shouldExecuteTick = promise._lib && beginMicroTickScope();
            reason = rejectionMapper(reason);
            promise._state = false;
            promise._value = reason;
            debug && reason !== null && typeof reason === 'object' && !reason._promise && tryCatch(function () {
                var origProp = getPropertyDescriptor(reason, "stack");
                reason._promise = promise;
                setProp(reason, "stack", {
                    get: function () {
                        return stack_being_generated ? origProp && (origProp.get ? origProp.get.apply(reason) : origProp.value) : promise.stack;
                    }
                });
            });
            // Add the failure to a list of possibly uncaught errors
            addPossiblyUnhandledError(promise);
            propagateAllListeners(promise);
            if (shouldExecuteTick) endMicroTickScope();
        }

        function propagateAllListeners(promise) {
            //debug && linkToPreviousPromise(promise);
            var listeners = promise._listeners;
            promise._listeners = [];
            for (var i = 0, len = listeners.length; i < len; ++i) {
                propagateToListener(promise, listeners[i]);
            }
            var psd = promise._PSD;
            --psd.ref || psd.finalize(); // if psd.ref reaches zero, call psd.finalize();
            if (numScheduledCalls === 0) {
                // If numScheduledCalls is 0, it means that our stack is not in a callback of a scheduled call,
                // and that no deferreds where listening to this rejection or success.
                // Since there is a risk that our stack can contain application code that may
                // do stuff after this code is finished that may generate new calls, we cannot
                // call finalizers here.
                ++numScheduledCalls;
                asap$1(function () {
                    if (--numScheduledCalls === 0) finalizePhysicalTick(); // Will detect unhandled errors
                }, []);
            }
        }

        function propagateToListener(promise, listener) {
            if (promise._state === null) {
                promise._listeners.push(listener);
                return;
            }

            var cb = promise._state ? listener.onFulfilled : listener.onRejected;
            if (cb === null) {
                // This Listener doesnt have a listener for the event being triggered (onFulfilled or onReject) so lets forward the event to any eventual listeners on the Promise instance returned by then() or catch()
                return (promise._state ? listener.resolve : listener.reject)(promise._value);
            }
            var psd = listener.psd;
            ++psd.ref;
            ++numScheduledCalls;
            asap$1(callListener, [cb, promise, listener]);
        }

        function callListener(cb, promise, listener) {
            var outerScope = PSD;
            var psd = listener.psd;
            try {
                if (psd !== outerScope) {
                    // **KEEP** outerScope.env = wrappers.snapshot(); // Snapshot outerScope's environment.
                    PSD = psd;
                    // **KEEP** wrappers.restore(psd.env); // Restore PSD's environment.
                }

                // Set static variable currentFulfiller to the promise that is being fullfilled,
                // so that we connect the chain of promises (for long stacks support)
                currentFulfiller = promise;

                // Call callback and resolve our listener with it's return value.
                var value = promise._value,
                    ret;
                if (promise._state) {
                    ret = cb(value);
                } else {
                    if (rejectingErrors.length) rejectingErrors = [];
                    ret = cb(value);
                    if (rejectingErrors.indexOf(value) === -1) markErrorAsHandled(promise); // Callback didnt do Promise.reject(err) nor reject(err) onto another promise.
                }
                listener.resolve(ret);
            } catch (e) {
                // Exception thrown in callback. Reject our listener.
                listener.reject(e);
            } finally {
                // Restore PSD, env and currentFulfiller.
                if (psd !== outerScope) {
                    PSD = outerScope;
                    // **KEEP** wrappers.restore(outerScope.env); // Restore outerScope's environment
                }
                currentFulfiller = null;
                if (--numScheduledCalls === 0) finalizePhysicalTick();
                --psd.ref || psd.finalize();
            }
        }

        function getStack(promise, stacks, limit) {
            if (stacks.length === limit) return stacks;
            var stack = "";
            if (promise._state === false) {
                var failure = promise._value,
                    errorName,
                    message;

                if (failure != null) {
                    errorName = failure.name || "Error";
                    message = failure.message || failure;
                    stack = prettyStack(failure, 0);
                } else {
                    errorName = failure; // If error is undefined or null, show that.
                    message = "";
                }
                stacks.push(errorName + (message ? ": " + message : "") + stack);
            }
            if (debug) {
                stack = prettyStack(promise._stackHolder, 2);
                if (stack && stacks.indexOf(stack) === -1) stacks.push(stack);
                if (promise._prev) getStack(promise._prev, stacks, limit);
            }
            return stacks;
        }

        function linkToPreviousPromise(promise, prev) {
            // Support long stacks by linking to previous completed promise.
            var numPrev = prev ? prev._numPrev + 1 : 0;
            if (numPrev < LONG_STACKS_CLIP_LIMIT) {
                // Prohibit infinite Promise loops to get an infinite long memory consuming "tail".
                promise._prev = prev;
                promise._numPrev = numPrev;
            }
        }

        /* The callback to schedule with setImmediate() or setTimeout().
           It runs a virtual microtick and executes any callback registered in microtickQueue.
         */
        function physicalTick() {
            beginMicroTickScope() && endMicroTickScope();
        }

        function beginMicroTickScope() {
            var wasRootExec = isOutsideMicroTick;
            isOutsideMicroTick = false;
            needsNewPhysicalTick = false;
            return wasRootExec;
        }

        /* Executes micro-ticks without doing try..catch.
           This can be possible because we only use this internally and
           the registered functions are exception-safe (they do try..catch
           internally before calling any external method). If registering
           functions in the microtickQueue that are not exception-safe, this
           would destroy the framework and make it instable. So we don't export
           our asap method.
        */
        function endMicroTickScope() {
            var callbacks, i, l;
            do {
                while (microtickQueue.length > 0) {
                    callbacks = microtickQueue;
                    microtickQueue = [];
                    l = callbacks.length;
                    for (i = 0; i < l; ++i) {
                        var item = callbacks[i];
                        item[0].apply(null, item[1]);
                    }
                }
            } while (microtickQueue.length > 0);
            isOutsideMicroTick = true;
            needsNewPhysicalTick = true;
        }

        function finalizePhysicalTick() {
            var unhandledErrs = unhandledErrors;
            unhandledErrors = [];
            unhandledErrs.forEach(function (p) {
                p._PSD.onunhandled.call(null, p._value, p);
            });
            var finalizers = tickFinalizers.slice(0); // Clone first because finalizer may remove itself from list.
            var i = finalizers.length;
            while (i) {
                finalizers[--i]();
            }
        }

        function run_at_end_of_this_or_next_physical_tick(fn) {
            function finalizer() {
                fn();
                tickFinalizers.splice(tickFinalizers.indexOf(finalizer), 1);
            }
            tickFinalizers.push(finalizer);
            ++numScheduledCalls;
            asap$1(function () {
                if (--numScheduledCalls === 0) finalizePhysicalTick();
            }, []);
        }

        function addPossiblyUnhandledError(promise) {
            // Only add to unhandledErrors if not already there. The first one to add to this list
            // will be upon the first rejection so that the root cause (first promise in the
            // rejection chain) is the one listed.
            if (!unhandledErrors.some(function (p) {
                return p._value === promise._value;
            })) unhandledErrors.push(promise);
        }

        function markErrorAsHandled(promise) {
            // Called when a reject handled is actually being called.
            // Search in unhandledErrors for any promise whos _value is this promise_value (list
            // contains only rejected promises, and only one item per error)
            var i = unhandledErrors.length;
            while (i) {
                if (unhandledErrors[--i]._value === promise._value) {
                    // Found a promise that failed with this same error object pointer,
                    // Remove that since there is a listener that actually takes care of it.
                    unhandledErrors.splice(i, 1);
                    return;
                }
            }
        }

        // By default, log uncaught errors to the console
        function defaultErrorHandler(e) {
            console.warn('Unhandled rejection: ' + (e.stack || e));
        }

        function PromiseReject(reason) {
            return new Promise(INTERNAL, false, reason);
        }

        function wrap(fn, errorCatcher) {
            var psd = PSD;
            return function () {
                var wasRootExec = beginMicroTickScope(),
                    outerScope = PSD;

                try {
                    if (outerScope !== psd) {
                        // **KEEP** outerScope.env = wrappers.snapshot(); // Snapshot outerScope's environment
                        PSD = psd;
                        // **KEEP** wrappers.restore(psd.env); // Restore PSD's environment.
                    }
                    return fn.apply(this, arguments);
                } catch (e) {
                    errorCatcher && errorCatcher(e);
                } finally {
                    if (outerScope !== psd) {
                        PSD = outerScope;
                        // **KEEP** wrappers.restore(outerScope.env); // Restore outerScope's environment
                    }
                    if (wasRootExec) endMicroTickScope();
                }
            };
        }

        function newScope(fn, a1, a2, a3) {
            var parent = PSD,
                psd = Object.create(parent);
            psd.parent = parent;
            psd.ref = 0;
            psd.global = false;
            // **KEEP** psd.env = wrappers.wrap(psd);

            // unhandleds and onunhandled should not be specifically set here.
            // Leave them on parent prototype.
            // unhandleds.push(err) will push to parent's prototype
            // onunhandled() will call parents onunhandled (with this scope's this-pointer though!)
            ++parent.ref;
            psd.finalize = function () {
                --this.parent.ref || this.parent.finalize();
            };
            var rv = usePSD(psd, fn, a1, a2, a3);
            if (psd.ref === 0) psd.finalize();
            return rv;
        }

        function usePSD(psd, fn, a1, a2, a3) {
            var outerScope = PSD;
            try {
                if (psd !== outerScope) {
                    // **KEEP** outerScope.env = wrappers.snapshot(); // snapshot outerScope's environment.
                    PSD = psd;
                    // **KEEP** wrappers.restore(psd.env); // Restore PSD's environment.
                }
                return fn(a1, a2, a3);
            } finally {
                if (psd !== outerScope) {
                    PSD = outerScope;
                    // **KEEP** wrappers.restore(outerScope.env); // Restore outerScope's environment.
                }
            }
        }

        var UNHANDLEDREJECTION = "unhandledrejection";

        function globalError(err, promise) {
            var rv;
            try {
                rv = promise.onuncatched(err);
            } catch (e) {}
            if (rv !== false) try {
                var event,
                    eventData = { promise: promise, reason: err };
                if (_global.document && document.createEvent) {
                    event = document.createEvent('Event');
                    event.initEvent(UNHANDLEDREJECTION, true, true);
                    extend(event, eventData);
                } else if (_global.CustomEvent) {
                    event = new CustomEvent(UNHANDLEDREJECTION, { detail: eventData });
                    extend(event, eventData);
                }
                if (event && _global.dispatchEvent) {
                    dispatchEvent(event);
                    if (!_global.PromiseRejectionEvent && _global.onunhandledrejection)
                        // No native support for PromiseRejectionEvent but user has set window.onunhandledrejection. Manually call it.
                        try {
                            _global.onunhandledrejection(event);
                        } catch (_) {}
                }
                if (!event.defaultPrevented) {
                    // Backward compatibility: fire to events registered at Promise.on.error
                    Promise.on.error.fire(err, promise);
                }
            } catch (e) {}
        }

        /* **KEEP** 
        
        export function wrapPromise(PromiseClass) {
            var proto = PromiseClass.prototype;
            var origThen = proto.then;
            
            wrappers.add({
                snapshot: () => proto.then,
                restore: value => {proto.then = value;},
                wrap: () => patchedThen
            });
        
            function patchedThen (onFulfilled, onRejected) {
                var promise = this;
                var onFulfilledProxy = wrap(function(value){
                    var rv = value;
                    if (onFulfilled) {
                        rv = onFulfilled(rv);
                        if (rv && typeof rv.then === 'function') rv.then(); // Intercept that promise as well.
                    }
                    --PSD.ref || PSD.finalize();
                    return rv;
                });
                var onRejectedProxy = wrap(function(err){
                    promise._$err = err;
                    var unhandleds = PSD.unhandleds;
                    var idx = unhandleds.length,
                        rv;
                    while (idx--) if (unhandleds[idx]._$err === err) break;
                    if (onRejected) {
                        if (idx !== -1) unhandleds.splice(idx, 1); // Mark as handled.
                        rv = onRejected(err);
                        if (rv && typeof rv.then === 'function') rv.then(); // Intercept that promise as well.
                    } else {
                        if (idx === -1) unhandleds.push(promise);
                        rv = PromiseClass.reject(err);
                        rv._$nointercept = true; // Prohibit eternal loop.
                    }
                    --PSD.ref || PSD.finalize();
                    return rv;
                });
                
                if (this._$nointercept) return origThen.apply(this, arguments);
                ++PSD.ref;
                return origThen.call(this, onFulfilledProxy, onRejectedProxy);
            }
        }
        
        // Global Promise wrapper
        if (_global.Promise) wrapPromise(_global.Promise);
        
        */

        doFakeAutoComplete(function () {
            // Simplify the job for VS Intellisense. This piece of code is one of the keys to the new marvellous intellisense support in Dexie.
            asap$1 = function (fn, args) {
                setTimeout(function () {
                    fn.apply(null, args);
                }, 0);
            };
        });

        function rejection(err, uncaughtHandler) {
            // Get the call stack and return a rejected promise.
            var rv = Promise.reject(err);
            return uncaughtHandler ? rv.uncaught(uncaughtHandler) : rv;
        }

        /*
         * Dexie.js - a minimalistic wrapper for IndexedDB
         * ===============================================
         *
         * By David Fahlander, david.fahlander@gmail.com
         *
         * Version 1.5.1, Tue Nov 01 2016
         *
         * http://dexie.org
         *
         * Apache License Version 2.0, January 2004, http://www.apache.org/licenses/
         */

        var DEXIE_VERSION = '1.5.1';
        var maxString = String.fromCharCode(65535);
        var maxKey = function () {
            try {
                IDBKeyRange.only([[]]);return [[]];
            } catch (e) {
                return maxString;
            }
        }();
        var INVALID_KEY_ARGUMENT = "Invalid key provided. Keys must be of type string, number, Date or Array<string | number | Date>.";
        var STRING_EXPECTED = "String expected.";
        var connections = [];
        var isIEOrEdge = typeof navigator !== 'undefined' && /(MSIE|Trident|Edge)/.test(navigator.userAgent);
        var hasIEDeleteObjectStoreBug = isIEOrEdge;
        var hangsOnDeleteLargeKeyRange = isIEOrEdge;
        var dexieStackFrameFilter = function (frame) {
            return !/(dexie\.js|dexie\.min\.js)/.test(frame);
        };

        setDebug(debug, dexieStackFrameFilter);

        function Dexie(dbName, options) {
            /// <param name="options" type="Object" optional="true">Specify only if you wich to control which addons that should run on this instance</param>
            var deps = Dexie.dependencies;
            var opts = extend({
                // Default Options
                addons: Dexie.addons, // Pick statically registered addons by default
                autoOpen: true, // Don't require db.open() explicitely.
                indexedDB: deps.indexedDB, // Backend IndexedDB api. Default to IDBShim or browser env.
                IDBKeyRange: deps.IDBKeyRange // Backend IDBKeyRange api. Default to IDBShim or browser env.
            }, options);
            var addons = opts.addons,
                autoOpen = opts.autoOpen,
                indexedDB = opts.indexedDB,
                IDBKeyRange = opts.IDBKeyRange;

            var globalSchema = this._dbSchema = {};
            var versions = [];
            var dbStoreNames = [];
            var allTables = {};
            ///<var type="IDBDatabase" />
            var idbdb = null; // Instance of IDBDatabase
            var dbOpenError = null;
            var isBeingOpened = false;
            var openComplete = false;
            var READONLY = "readonly",
                READWRITE = "readwrite";
            var db = this;
            var dbReadyResolve,
                dbReadyPromise = new Promise(function (resolve) {
                dbReadyResolve = resolve;
            }),
                cancelOpen,
                openCanceller = new Promise(function (_, reject) {
                cancelOpen = reject;
            });
            var autoSchema = true;
            var hasNativeGetDatabaseNames = !!getNativeGetDatabaseNamesFn(indexedDB),
                hasGetAll;

            function init() {
                // Default subscribers to "versionchange" and "blocked".
                // Can be overridden by custom handlers. If custom handlers return false, these default
                // behaviours will be prevented.
                db.on("versionchange", function (ev) {
                    // Default behavior for versionchange event is to close database connection.
                    // Caller can override this behavior by doing db.on("versionchange", function(){ return false; });
                    // Let's not block the other window from making it's delete() or open() call.
                    // NOTE! This event is never fired in IE,Edge or Safari.
                    if (ev.newVersion > 0) console.warn('Another connection wants to upgrade database \'' + db.name + '\'. Closing db now to resume the upgrade.');else console.warn('Another connection wants to delete database \'' + db.name + '\'. Closing db now to resume the delete request.');
                    db.close();
                    // In many web applications, it would be recommended to force window.reload()
                    // when this event occurs. To do that, subscribe to the versionchange event
                    // and call window.location.reload(true) if ev.newVersion > 0 (not a deletion)
                    // The reason for this is that your current web app obviously has old schema code that needs
                    // to be updated. Another window got a newer version of the app and needs to upgrade DB but
                    // your window is blocking it unless we close it here.
                });
                db.on("blocked", function (ev) {
                    if (!ev.newVersion || ev.newVersion < ev.oldVersion) console.warn('Dexie.delete(\'' + db.name + '\') was blocked');else console.warn('Upgrade \'' + db.name + '\' blocked by other connection holding version ' + ev.oldVersion / 10);
                });
            }

            //
            //
            //
            // ------------------------- Versioning Framework---------------------------
            //
            //
            //

            this.version = function (versionNumber) {
                /// <param name="versionNumber" type="Number"></param>
                /// <returns type="Version"></returns>
                if (idbdb || isBeingOpened) throw new exceptions.Schema("Cannot add version when database is open");
                this.verno = Math.max(this.verno, versionNumber);
                var versionInstance = versions.filter(function (v) {
                    return v._cfg.version === versionNumber;
                })[0];
                if (versionInstance) return versionInstance;
                versionInstance = new Version(versionNumber);
                versions.push(versionInstance);
                versions.sort(lowerVersionFirst);
                return versionInstance;
            };

            function Version(versionNumber) {
                this._cfg = {
                    version: versionNumber,
                    storesSource: null,
                    dbschema: {},
                    tables: {},
                    contentUpgrade: null
                };
                this.stores({}); // Derive earlier schemas by default.
            }

            extend(Version.prototype, {
                stores: function (stores) {
                    /// <summary>
                    ///   Defines the schema for a particular version
                    /// </summary>
                    /// <param name="stores" type="Object">
                    /// Example: <br/>
                    ///   {users: "id++,first,last,&amp;username,*email", <br/>
                    ///   passwords: "id++,&amp;username"}<br/>
                    /// <br/>
                    /// Syntax: {Table: "[primaryKey][++],[&amp;][*]index1,[&amp;][*]index2,..."}<br/><br/>
                    /// Special characters:<br/>
                    ///  "&amp;"  means unique key, <br/>
                    ///  "*"  means value is multiEntry, <br/>
                    ///  "++" means auto-increment and only applicable for primary key <br/>
                    /// </param>
                    this._cfg.storesSource = this._cfg.storesSource ? extend(this._cfg.storesSource, stores) : stores;

                    // Derive stores from earlier versions if they are not explicitely specified as null or a new syntax.
                    var storesSpec = {};
                    versions.forEach(function (version) {
                        // 'versions' is always sorted by lowest version first.
                        extend(storesSpec, version._cfg.storesSource);
                    });

                    var dbschema = this._cfg.dbschema = {};
                    this._parseStoresSpec(storesSpec, dbschema);
                    // Update the latest schema to this version
                    // Update API
                    globalSchema = db._dbSchema = dbschema;
                    removeTablesApi([allTables, db, Transaction.prototype]);
                    setApiOnPlace([allTables, db, Transaction.prototype, this._cfg.tables], keys(dbschema), READWRITE, dbschema);
                    dbStoreNames = keys(dbschema);
                    return this;
                },
                upgrade: function (upgradeFunction) {
                    /// <param name="upgradeFunction" optional="true">Function that performs upgrading actions.</param>
                    var self = this;
                    fakeAutoComplete(function () {
                        upgradeFunction(db._createTransaction(READWRITE, keys(self._cfg.dbschema), self._cfg.dbschema)); // BUGBUG: No code completion for prev version's tables wont appear.
                    });
                    this._cfg.contentUpgrade = upgradeFunction;
                    return this;
                },
                _parseStoresSpec: function (stores, outSchema) {
                    keys(stores).forEach(function (tableName) {
                        if (stores[tableName] !== null) {
                            var instanceTemplate = {};
                            var indexes = parseIndexSyntax(stores[tableName]);
                            var primKey = indexes.shift();
                            if (primKey.multi) throw new exceptions.Schema("Primary key cannot be multi-valued");
                            if (primKey.keyPath) setByKeyPath(instanceTemplate, primKey.keyPath, primKey.auto ? 0 : primKey.keyPath);
                            indexes.forEach(function (idx) {
                                if (idx.auto) throw new exceptions.Schema("Only primary key can be marked as autoIncrement (++)");
                                if (!idx.keyPath) throw new exceptions.Schema("Index must have a name and cannot be an empty string");
                                setByKeyPath(instanceTemplate, idx.keyPath, idx.compound ? idx.keyPath.map(function () {
                                    return "";
                                }) : "");
                            });
                            outSchema[tableName] = new TableSchema(tableName, primKey, indexes, instanceTemplate);
                        }
                    });
                }
            });

            function runUpgraders(oldVersion, idbtrans, reject) {
                var trans = db._createTransaction(READWRITE, dbStoreNames, globalSchema);
                trans.create(idbtrans);
                trans._completion.catch(reject);
                var rejectTransaction = trans._reject.bind(trans);
                newScope(function () {
                    PSD.trans = trans;
                    if (oldVersion === 0) {
                        // Create tables:
                        keys(globalSchema).forEach(function (tableName) {
                            createTable(idbtrans, tableName, globalSchema[tableName].primKey, globalSchema[tableName].indexes);
                        });
                        Promise.follow(function () {
                            return db.on.populate.fire(trans);
                        }).catch(rejectTransaction);
                    } else updateTablesAndIndexes(oldVersion, trans, idbtrans).catch(rejectTransaction);
                });
            }

            function updateTablesAndIndexes(oldVersion, trans, idbtrans) {
                // Upgrade version to version, step-by-step from oldest to newest version.
                // Each transaction object will contain the table set that was current in that version (but also not-yet-deleted tables from its previous version)
                var queue = [];
                var oldVersionStruct = versions.filter(function (version) {
                    return version._cfg.version === oldVersion;
                })[0];
                if (!oldVersionStruct) throw new exceptions.Upgrade("Dexie specification of currently installed DB version is missing");
                globalSchema = db._dbSchema = oldVersionStruct._cfg.dbschema;
                var anyContentUpgraderHasRun = false;

                var versToRun = versions.filter(function (v) {
                    return v._cfg.version > oldVersion;
                });
                versToRun.forEach(function (version) {
                    /// <param name="version" type="Version"></param>
                    queue.push(function () {
                        var oldSchema = globalSchema;
                        var newSchema = version._cfg.dbschema;
                        adjustToExistingIndexNames(oldSchema, idbtrans);
                        adjustToExistingIndexNames(newSchema, idbtrans);
                        globalSchema = db._dbSchema = newSchema;
                        var diff = getSchemaDiff(oldSchema, newSchema);
                        // Add tables           
                        diff.add.forEach(function (tuple) {
                            createTable(idbtrans, tuple[0], tuple[1].primKey, tuple[1].indexes);
                        });
                        // Change tables
                        diff.change.forEach(function (change) {
                            if (change.recreate) {
                                throw new exceptions.Upgrade("Not yet support for changing primary key");
                            } else {
                                var store = idbtrans.objectStore(change.name);
                                // Add indexes
                                change.add.forEach(function (idx) {
                                    addIndex(store, idx);
                                });
                                // Update indexes
                                change.change.forEach(function (idx) {
                                    store.deleteIndex(idx.name);
                                    addIndex(store, idx);
                                });
                                // Delete indexes
                                change.del.forEach(function (idxName) {
                                    store.deleteIndex(idxName);
                                });
                            }
                        });
                        if (version._cfg.contentUpgrade) {
                            anyContentUpgraderHasRun = true;
                            return Promise.follow(function () {
                                version._cfg.contentUpgrade(trans);
                            });
                        }
                    });
                    queue.push(function (idbtrans) {
                        if (!anyContentUpgraderHasRun || !hasIEDeleteObjectStoreBug) {
                            // Dont delete old tables if ieBug is present and a content upgrader has run. Let tables be left in DB so far. This needs to be taken care of.
                            var newSchema = version._cfg.dbschema;
                            // Delete old tables
                            deleteRemovedTables(newSchema, idbtrans);
                        }
                    });
                });

                // Now, create a queue execution engine
                function runQueue() {
                    return queue.length ? Promise.resolve(queue.shift()(trans.idbtrans)).then(runQueue) : Promise.resolve();
                }

                return runQueue().then(function () {
                    createMissingTables(globalSchema, idbtrans); // At last, make sure to create any missing tables. (Needed by addons that add stores to DB without specifying version)
                });
            }

            function getSchemaDiff(oldSchema, newSchema) {
                var diff = {
                    del: [], // Array of table names
                    add: [], // Array of [tableName, newDefinition]
                    change: [] // Array of {name: tableName, recreate: newDefinition, del: delIndexNames, add: newIndexDefs, change: changedIndexDefs}
                };
                for (var table in oldSchema) {
                    if (!newSchema[table]) diff.del.push(table);
                }
                for (table in newSchema) {
                    var oldDef = oldSchema[table],
                        newDef = newSchema[table];
                    if (!oldDef) {
                        diff.add.push([table, newDef]);
                    } else {
                        var change = {
                            name: table,
                            def: newDef,
                            recreate: false,
                            del: [],
                            add: [],
                            change: []
                        };
                        if (oldDef.primKey.src !== newDef.primKey.src) {
                            // Primary key has changed. Remove and re-add table.
                            change.recreate = true;
                            diff.change.push(change);
                        } else {
                            // Same primary key. Just find out what differs:
                            var oldIndexes = oldDef.idxByName;
                            var newIndexes = newDef.idxByName;
                            for (var idxName in oldIndexes) {
                                if (!newIndexes[idxName]) change.del.push(idxName);
                            }
                            for (idxName in newIndexes) {
                                var oldIdx = oldIndexes[idxName],
                                    newIdx = newIndexes[idxName];
                                if (!oldIdx) change.add.push(newIdx);else if (oldIdx.src !== newIdx.src) change.change.push(newIdx);
                            }
                            if (change.del.length > 0 || change.add.length > 0 || change.change.length > 0) {
                                diff.change.push(change);
                            }
                        }
                    }
                }
                return diff;
            }

            function createTable(idbtrans, tableName, primKey, indexes) {
                /// <param name="idbtrans" type="IDBTransaction"></param>
                var store = idbtrans.db.createObjectStore(tableName, primKey.keyPath ? { keyPath: primKey.keyPath, autoIncrement: primKey.auto } : { autoIncrement: primKey.auto });
                indexes.forEach(function (idx) {
                    addIndex(store, idx);
                });
                return store;
            }

            function createMissingTables(newSchema, idbtrans) {
                keys(newSchema).forEach(function (tableName) {
                    if (!idbtrans.db.objectStoreNames.contains(tableName)) {
                        createTable(idbtrans, tableName, newSchema[tableName].primKey, newSchema[tableName].indexes);
                    }
                });
            }

            function deleteRemovedTables(newSchema, idbtrans) {
                for (var i = 0; i < idbtrans.db.objectStoreNames.length; ++i) {
                    var storeName = idbtrans.db.objectStoreNames[i];
                    if (newSchema[storeName] == null) {
                        idbtrans.db.deleteObjectStore(storeName);
                    }
                }
            }

            function addIndex(store, idx) {
                store.createIndex(idx.name, idx.keyPath, { unique: idx.unique, multiEntry: idx.multi });
            }

            function dbUncaught(err) {
                return db.on.error.fire(err);
            }

            //
            //
            //      Dexie Protected API
            //
            //

            this._allTables = allTables;

            this._tableFactory = function createTable(mode, tableSchema) {
                /// <param name="tableSchema" type="TableSchema"></param>
                if (mode === READONLY) return new Table(tableSchema.name, tableSchema, Collection);else return new WriteableTable(tableSchema.name, tableSchema);
            };

            this._createTransaction = function (mode, storeNames, dbschema, parentTransaction) {
                return new Transaction(mode, storeNames, dbschema, parentTransaction);
            };

            /* Generate a temporary transaction when db operations are done outside a transactino scope.
            */
            function tempTransaction(mode, storeNames, fn) {
                // Last argument is "writeLocked". But this doesnt apply to oneshot direct db operations, so we ignore it.
                if (!openComplete && !PSD.letThrough) {
                    if (!isBeingOpened) {
                        if (!autoOpen) return rejection(new exceptions.DatabaseClosed(), dbUncaught);
                        db.open().catch(nop); // Open in background. If if fails, it will be catched by the final promise anyway.
                    }
                    return dbReadyPromise.then(function () {
                        return tempTransaction(mode, storeNames, fn);
                    });
                } else {
                    var trans = db._createTransaction(mode, storeNames, globalSchema);
                    return trans._promise(mode, function (resolve, reject) {
                        newScope(function () {
                            // OPTIMIZATION POSSIBLE? newScope() not needed because it's already done in _promise.
                            PSD.trans = trans;
                            fn(resolve, reject, trans);
                        });
                    }).then(function (result) {
                        // Instead of resolving value directly, wait with resolving it until transaction has completed.
                        // Otherwise the data would not be in the DB if requesting it in the then() operation.
                        // Specifically, to ensure that the following expression will work:
                        //
                        //   db.friends.put({name: "Arne"}).then(function () {
                        //       db.friends.where("name").equals("Arne").count(function(count) {
                        //           assert (count === 1);
                        //       });
                        //   });
                        //
                        return trans._completion.then(function () {
                            return result;
                        });
                    }); /*.catch(err => { // Don't do this as of now. If would affect bulk- and modify methods in a way that could be more intuitive. But wait! Maybe change in next major.
                         trans._reject(err);
                         return rejection(err);
                        });*/
                }
            }

            this._whenReady = function (fn) {
                return new Promise(fake || openComplete || PSD.letThrough ? fn : function (resolve, reject) {
                    if (!isBeingOpened) {
                        if (!autoOpen) {
                            reject(new exceptions.DatabaseClosed());
                            return;
                        }
                        db.open().catch(nop); // Open in background. If if fails, it will be catched by the final promise anyway.
                    }
                    dbReadyPromise.then(function () {
                        fn(resolve, reject);
                    });
                }).uncaught(dbUncaught);
            };

            //
            //
            //
            //
            //      Dexie API
            //
            //
            //

            this.verno = 0;

            this.open = function () {
                if (isBeingOpened || idbdb) return dbReadyPromise.then(function () {
                    return dbOpenError ? rejection(dbOpenError, dbUncaught) : db;
                });
                debug && (openCanceller._stackHolder = getErrorWithStack()); // Let stacks point to when open() was called rather than where new Dexie() was called.
                isBeingOpened = true;
                dbOpenError = null;
                openComplete = false;

                // Function pointers to call when the core opening process completes.
                var resolveDbReady = dbReadyResolve,


                // upgradeTransaction to abort on failure.
                upgradeTransaction = null;

                return Promise.race([openCanceller, new Promise(function (resolve, reject) {
                    doFakeAutoComplete(function () {
                        return resolve();
                    });

                    // Make sure caller has specified at least one version
                    if (versions.length > 0) autoSchema = false;

                    // Multiply db.verno with 10 will be needed to workaround upgrading bug in IE:
                    // IE fails when deleting objectStore after reading from it.
                    // A future version of Dexie.js will stopover an intermediate version to workaround this.
                    // At that point, we want to be backward compatible. Could have been multiplied with 2, but by using 10, it is easier to map the number to the real version number.

                    // If no API, throw!
                    if (!indexedDB) throw new exceptions.MissingAPI("indexedDB API not found. If using IE10+, make sure to run your code on a server URL " + "(not locally). If using old Safari versions, make sure to include indexedDB polyfill.");

                    var req = autoSchema ? indexedDB.open(dbName) : indexedDB.open(dbName, Math.round(db.verno * 10));
                    if (!req) throw new exceptions.MissingAPI("IndexedDB API not available"); // May happen in Safari private mode, see https://github.com/dfahlander/Dexie.js/issues/134
                    req.onerror = wrap(eventRejectHandler(reject));
                    req.onblocked = wrap(fireOnBlocked);
                    req.onupgradeneeded = wrap(function (e) {
                        upgradeTransaction = req.transaction;
                        if (autoSchema && !db._allowEmptyDB) {
                            // Unless an addon has specified db._allowEmptyDB, lets make the call fail.
                            // Caller did not specify a version or schema. Doing that is only acceptable for opening alread existing databases.
                            // If onupgradeneeded is called it means database did not exist. Reject the open() promise and make sure that we
                            // do not create a new database by accident here.
                            req.onerror = preventDefault; // Prohibit onabort error from firing before we're done!
                            upgradeTransaction.abort(); // Abort transaction (would hope that this would make DB disappear but it doesnt.)
                            // Close database and delete it.
                            req.result.close();
                            var delreq = indexedDB.deleteDatabase(dbName); // The upgrade transaction is atomic, and javascript is single threaded - meaning that there is no risk that we delete someone elses database here!
                            delreq.onsuccess = delreq.onerror = wrap(function () {
                                reject(new exceptions.NoSuchDatabase('Database ' + dbName + ' doesnt exist'));
                            });
                        } else {
                            upgradeTransaction.onerror = wrap(eventRejectHandler(reject));
                            var oldVer = e.oldVersion > Math.pow(2, 62) ? 0 : e.oldVersion; // Safari 8 fix.
                            runUpgraders(oldVer / 10, upgradeTransaction, reject, req);
                        }
                    }, reject);

                    req.onsuccess = wrap(function () {
                        // Core opening procedure complete. Now let's just record some stuff.
                        upgradeTransaction = null;
                        idbdb = req.result;
                        connections.push(db); // Used for emulating versionchange event on IE/Edge/Safari.

                        if (autoSchema) readGlobalSchema();else if (idbdb.objectStoreNames.length > 0) {
                            try {
                                adjustToExistingIndexNames(globalSchema, idbdb.transaction(safariMultiStoreFix(idbdb.objectStoreNames), READONLY));
                            } catch (e) {
                                // Safari may bail out if > 1 store names. However, this shouldnt be a showstopper. Issue #120.
                            }
                        }

                        idbdb.onversionchange = wrap(function (ev) {
                            db._vcFired = true; // detect implementations that not support versionchange (IE/Edge/Safari)
                            db.on("versionchange").fire(ev);
                        });

                        if (!hasNativeGetDatabaseNames) {
                            // Update localStorage with list of database names
                            globalDatabaseList(function (databaseNames) {
                                if (databaseNames.indexOf(dbName) === -1) return databaseNames.push(dbName);
                            });
                        }

                        resolve();
                    }, reject);
                })]).then(function () {
                    // Before finally resolving the dbReadyPromise and this promise,
                    // call and await all on('ready') subscribers:
                    // Dexie.vip() makes subscribers able to use the database while being opened.
                    // This is a must since these subscribers take part of the opening procedure.
                    return Dexie.vip(db.on.ready.fire);
                }).then(function () {
                    // Resolve the db.open() with the db instance.
                    isBeingOpened = false;
                    return db;
                }).catch(function (err) {
                    try {
                        // Did we fail within onupgradeneeded? Make sure to abort the upgrade transaction so it doesnt commit.
                        upgradeTransaction && upgradeTransaction.abort();
                    } catch (e) {}
                    isBeingOpened = false; // Set before calling db.close() so that it doesnt reject openCanceller again (leads to unhandled rejection event).
                    db.close(); // Closes and resets idbdb, removes connections, resets dbReadyPromise and openCanceller so that a later db.open() is fresh.
                    // A call to db.close() may have made on-ready subscribers fail. Use dbOpenError if set, since err could be a follow-up error on that.
                    dbOpenError = err; // Record the error. It will be used to reject further promises of db operations.
                    return rejection(dbOpenError, dbUncaught); // dbUncaught will make sure any error that happened in any operation before will now bubble to db.on.error() thanks to the special handling in Promise.uncaught().
                }).finally(function () {
                    openComplete = true;
                    resolveDbReady(); // dbReadyPromise is resolved no matter if open() rejects or resolved. It's just to wake up waiters.
                });
            };

            this.close = function () {
                var idx = connections.indexOf(db);
                if (idx >= 0) connections.splice(idx, 1);
                if (idbdb) {
                    try {
                        idbdb.close();
                    } catch (e) {}
                    idbdb = null;
                }
                autoOpen = false;
                dbOpenError = new exceptions.DatabaseClosed();
                if (isBeingOpened) cancelOpen(dbOpenError);
                // Reset dbReadyPromise promise:
                dbReadyPromise = new Promise(function (resolve) {
                    dbReadyResolve = resolve;
                });
                openCanceller = new Promise(function (_, reject) {
                    cancelOpen = reject;
                });
            };

            this.delete = function () {
                var hasArguments = arguments.length > 0;
                return new Promise(function (resolve, reject) {
                    if (hasArguments) throw new exceptions.InvalidArgument("Arguments not allowed in db.delete()");
                    if (isBeingOpened) {
                        dbReadyPromise.then(doDelete);
                    } else {
                        doDelete();
                    }
                    function doDelete() {
                        db.close();
                        var req = indexedDB.deleteDatabase(dbName);
                        req.onsuccess = wrap(function () {
                            if (!hasNativeGetDatabaseNames) {
                                globalDatabaseList(function (databaseNames) {
                                    var pos = databaseNames.indexOf(dbName);
                                    if (pos >= 0) return databaseNames.splice(pos, 1);
                                });
                            }
                            resolve();
                        });
                        req.onerror = wrap(eventRejectHandler(reject));
                        req.onblocked = fireOnBlocked;
                    }
                }).uncaught(dbUncaught);
            };

            this.backendDB = function () {
                return idbdb;
            };

            this.isOpen = function () {
                return idbdb !== null;
            };
            this.hasFailed = function () {
                return dbOpenError !== null;
            };
            this.dynamicallyOpened = function () {
                return autoSchema;
            };

            //
            // Properties
            //
            this.name = dbName;

            // db.tables - an array of all Table instances.
            setProp(this, "tables", {
                get: function () {
                    /// <returns type="Array" elementType="WriteableTable" />
                    return keys(allTables).map(function (name) {
                        return allTables[name];
                    });
                }
            });

            //
            // Events
            //
            this.on = Events(this, "error", "populate", "blocked", "versionchange", { ready: [promisableChain, nop] });
            this.on.error.subscribe = deprecated("Dexie.on.error", this.on.error.subscribe);
            this.on.error.unsubscribe = deprecated("Dexie.on.error.unsubscribe", this.on.error.unsubscribe);

            this.on.ready.subscribe = override(this.on.ready.subscribe, function (subscribe) {
                return function (subscriber, bSticky) {
                    Dexie.vip(function () {
                        if (openComplete) {
                            // Database already open. Call subscriber asap.
                            if (!dbOpenError) Promise.resolve().then(subscriber);
                            // bSticky: Also subscribe to future open sucesses (after close / reopen) 
                            if (bSticky) subscribe(subscriber);
                        } else {
                            // Database not yet open. Subscribe to it.
                            subscribe(subscriber);
                            // If bSticky is falsy, make sure to unsubscribe subscriber when fired once.
                            if (!bSticky) subscribe(function unsubscribe() {
                                db.on.ready.unsubscribe(subscriber);
                                db.on.ready.unsubscribe(unsubscribe);
                            });
                        }
                    });
                };
            });

            fakeAutoComplete(function () {
                db.on("populate").fire(db._createTransaction(READWRITE, dbStoreNames, globalSchema));
                db.on("error").fire(new Error());
            });

            this.transaction = function (mode, tableInstances, scopeFunc) {
                /// <summary>
                ///
                /// </summary>
                /// <param name="mode" type="String">"r" for readonly, or "rw" for readwrite</param>
                /// <param name="tableInstances">Table instance, Array of Table instances, String or String Array of object stores to include in the transaction</param>
                /// <param name="scopeFunc" type="Function">Function to execute with transaction</param>

                // Let table arguments be all arguments between mode and last argument.
                var i = arguments.length;
                if (i < 2) throw new exceptions.InvalidArgument("Too few arguments");
                // Prevent optimzation killer (https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#32-leaking-arguments)
                // and clone arguments except the first one into local var 'args'.
                var args = new Array(i - 1);
                while (--i) {
                    args[i - 1] = arguments[i];
                } // Let scopeFunc be the last argument and pop it so that args now only contain the table arguments.
                scopeFunc = args.pop();
                var tables = flatten(args); // Support using array as middle argument, or a mix of arrays and non-arrays.
                var parentTransaction = PSD.trans;
                // Check if parent transactions is bound to this db instance, and if caller wants to reuse it
                if (!parentTransaction || parentTransaction.db !== db || mode.indexOf('!') !== -1) parentTransaction = null;
                var onlyIfCompatible = mode.indexOf('?') !== -1;
                mode = mode.replace('!', '').replace('?', ''); // Ok. Will change arguments[0] as well but we wont touch arguments henceforth.

                try {
                    //
                    // Get storeNames from arguments. Either through given table instances, or through given table names.
                    //
                    var storeNames = tables.map(function (table) {
                        var storeName = table instanceof Table ? table.name : table;
                        if (typeof storeName !== 'string') throw new TypeError("Invalid table argument to Dexie.transaction(). Only Table or String are allowed");
                        return storeName;
                    });

                    //
                    // Resolve mode. Allow shortcuts "r" and "rw".
                    //
                    if (mode == "r" || mode == READONLY) mode = READONLY;else if (mode == "rw" || mode == READWRITE) mode = READWRITE;else throw new exceptions.InvalidArgument("Invalid transaction mode: " + mode);

                    if (parentTransaction) {
                        // Basic checks
                        if (parentTransaction.mode === READONLY && mode === READWRITE) {
                            if (onlyIfCompatible) {
                                // Spawn new transaction instead.
                                parentTransaction = null;
                            } else throw new exceptions.SubTransaction("Cannot enter a sub-transaction with READWRITE mode when parent transaction is READONLY");
                        }
                        if (parentTransaction) {
                            storeNames.forEach(function (storeName) {
                                if (parentTransaction && parentTransaction.storeNames.indexOf(storeName) === -1) {
                                    if (onlyIfCompatible) {
                                        // Spawn new transaction instead.
                                        parentTransaction = null;
                                    } else throw new exceptions.SubTransaction("Table " + storeName + " not included in parent transaction.");
                                }
                            });
                        }
                    }
                } catch (e) {
                    return parentTransaction ? parentTransaction._promise(null, function (_, reject) {
                        reject(e);
                    }) : rejection(e, dbUncaught);
                }
                // If this is a sub-transaction, lock the parent and then launch the sub-transaction.
                return parentTransaction ? parentTransaction._promise(mode, enterTransactionScope, "lock") : db._whenReady(enterTransactionScope);

                function enterTransactionScope(resolve) {
                    var parentPSD = PSD;
                    resolve(Promise.resolve().then(function () {
                        return newScope(function () {
                            // Keep a pointer to last non-transactional PSD to use if someone calls Dexie.ignoreTransaction().
                            PSD.transless = PSD.transless || parentPSD;
                            // Our transaction.
                            //return new Promise((resolve, reject) => {
                            var trans = db._createTransaction(mode, storeNames, globalSchema, parentTransaction);
                            // Let the transaction instance be part of a Promise-specific data (PSD) value.
                            PSD.trans = trans;

                            if (parentTransaction) {
                                // Emulate transaction commit awareness for inner transaction (must 'commit' when the inner transaction has no more operations ongoing)
                                trans.idbtrans = parentTransaction.idbtrans;
                            } else {
                                trans.create(); // Create the backend transaction so that complete() or error() will trigger even if no operation is made upon it.
                            }

                            // Provide arguments to the scope function (for backward compatibility)
                            var tableArgs = storeNames.map(function (name) {
                                return allTables[name];
                            });
                            tableArgs.push(trans);

                            var returnValue;
                            return Promise.follow(function () {
                                // Finally, call the scope function with our table and transaction arguments.
                                returnValue = scopeFunc.apply(trans, tableArgs); // NOTE: returnValue is used in trans.on.complete() not as a returnValue to this func.
                                if (returnValue) {
                                    if (typeof returnValue.next === 'function' && typeof returnValue.throw === 'function') {
                                        // scopeFunc returned an iterator with throw-support. Handle yield as await.
                                        returnValue = awaitIterator(returnValue);
                                    } else if (typeof returnValue.then === 'function' && !hasOwn(returnValue, '_PSD')) {
                                        throw new exceptions.IncompatiblePromise("Incompatible Promise returned from transaction scope (read more at http://tinyurl.com/znyqjqc). Transaction scope: " + scopeFunc.toString());
                                    }
                                }
                            }).uncaught(dbUncaught).then(function () {
                                if (parentTransaction) trans._resolve(); // sub transactions don't react to idbtrans.oncomplete. We must trigger a acompletion.
                                return trans._completion; // Even if WE believe everything is fine. Await IDBTransaction's oncomplete or onerror as well.
                            }).then(function () {
                                return returnValue;
                            }).catch(function (e) {
                                //reject(e);
                                trans._reject(e); // Yes, above then-handler were maybe not called because of an unhandled rejection in scopeFunc!
                                return rejection(e);
                            });
                            //});
                        });
                    }));
                }
            };

            this.table = function (tableName) {
                /// <returns type="WriteableTable"></returns>
                if (fake && autoSchema) return new WriteableTable(tableName);
                if (!hasOwn(allTables, tableName)) {
                    throw new exceptions.InvalidTable('Table ' + tableName + ' does not exist');
                }
                return allTables[tableName];
            };

            //
            //
            //
            // Table Class
            //
            //
            //
            function Table(name, tableSchema, collClass) {
                /// <param name="name" type="String"></param>
                this.name = name;
                this.schema = tableSchema;
                this.hook = allTables[name] ? allTables[name].hook : Events(null, {
                    "creating": [hookCreatingChain, nop],
                    "reading": [pureFunctionChain, mirror],
                    "updating": [hookUpdatingChain, nop],
                    "deleting": [hookDeletingChain, nop]
                });
                this._collClass = collClass || Collection;
            }

            props(Table.prototype, {

                //
                // Table Protected Methods
                //

                _trans: function getTransaction(mode, fn, writeLocked) {
                    var trans = PSD.trans;
                    return trans && trans.db === db ? trans._promise(mode, fn, writeLocked) : tempTransaction(mode, [this.name], fn);
                },
                _idbstore: function getIDBObjectStore(mode, fn, writeLocked) {
                    if (fake) return new Promise(fn); // Simplify the work for Intellisense/Code completion.
                    var trans = PSD.trans,
                        tableName = this.name;
                    function supplyIdbStore(resolve, reject, trans) {
                        fn(resolve, reject, trans.idbtrans.objectStore(tableName), trans);
                    }
                    return trans && trans.db === db ? trans._promise(mode, supplyIdbStore, writeLocked) : tempTransaction(mode, [this.name], supplyIdbStore);
                },

                //
                // Table Public Methods
                //
                get: function (key, cb) {
                    var self = this;
                    return this._idbstore(READONLY, function (resolve, reject, idbstore) {
                        fake && resolve(self.schema.instanceTemplate);
                        var req = idbstore.get(key);
                        req.onerror = eventRejectHandler(reject);
                        req.onsuccess = wrap(function () {
                            resolve(self.hook.reading.fire(req.result));
                        }, reject);
                    }).then(cb);
                },
                where: function (indexName) {
                    return new WhereClause(this, indexName);
                },
                count: function (cb) {
                    return this.toCollection().count(cb);
                },
                offset: function (offset) {
                    return this.toCollection().offset(offset);
                },
                limit: function (numRows) {
                    return this.toCollection().limit(numRows);
                },
                reverse: function () {
                    return this.toCollection().reverse();
                },
                filter: function (filterFunction) {
                    return this.toCollection().and(filterFunction);
                },
                each: function (fn) {
                    return this.toCollection().each(fn);
                },
                toArray: function (cb) {
                    return this.toCollection().toArray(cb);
                },
                orderBy: function (index) {
                    return new this._collClass(new WhereClause(this, index));
                },

                toCollection: function () {
                    return new this._collClass(new WhereClause(this));
                },

                mapToClass: function (constructor, structure) {
                    /// <summary>
                    ///     Map table to a javascript constructor function. Objects returned from the database will be instances of this class, making
                    ///     it possible to the instanceOf operator as well as extending the class using constructor.prototype.method = function(){...}.
                    /// </summary>
                    /// <param name="constructor">Constructor function representing the class.</param>
                    /// <param name="structure" optional="true">Helps IDE code completion by knowing the members that objects contain and not just the indexes. Also
                    /// know what type each member has. Example: {name: String, emailAddresses: [String], password}</param>
                    this.schema.mappedClass = constructor;
                    var instanceTemplate = Object.create(constructor.prototype);
                    if (structure) {
                        // structure and instanceTemplate is for IDE code competion only while constructor.prototype is for actual inheritance.
                        applyStructure(instanceTemplate, structure);
                    }
                    this.schema.instanceTemplate = instanceTemplate;

                    // Now, subscribe to the when("reading") event to make all objects that come out from this table inherit from given class
                    // no matter which method to use for reading (Table.get() or Table.where(...)... )
                    var readHook = function (obj) {
                        if (!obj) return obj; // No valid object. (Value is null). Return as is.
                        // Create a new object that derives from constructor:
                        var res = Object.create(constructor.prototype);
                        // Clone members:
                        for (var m in obj) {
                            if (hasOwn(obj, m)) try {
                                res[m] = obj[m];
                            } catch (_) {}
                        }return res;
                    };

                    if (this.schema.readHook) {
                        this.hook.reading.unsubscribe(this.schema.readHook);
                    }
                    this.schema.readHook = readHook;
                    this.hook("reading", readHook);
                    return constructor;
                },
                defineClass: function (structure) {
                    /// <summary>
                    ///     Define all members of the class that represents the table. This will help code completion of when objects are read from the database
                    ///     as well as making it possible to extend the prototype of the returned constructor function.
                    /// </summary>
                    /// <param name="structure">Helps IDE code completion by knowing the members that objects contain and not just the indexes. Also
                    /// know what type each member has. Example: {name: String, emailAddresses: [String], properties: {shoeSize: Number}}</param>
                    return this.mapToClass(Dexie.defineClass(structure), structure);
                }
            });

            //
            //
            //
            // WriteableTable Class (extends Table)
            //
            //
            //
            function WriteableTable(name, tableSchema, collClass) {
                Table.call(this, name, tableSchema, collClass || WriteableCollection);
            }

            function BulkErrorHandlerCatchAll(errorList, done, supportHooks) {
                return (supportHooks ? hookedEventRejectHandler : eventRejectHandler)(function (e) {
                    errorList.push(e);
                    done && done();
                });
            }

            function bulkDelete(idbstore, trans, keysOrTuples, hasDeleteHook, deletingHook) {
                // If hasDeleteHook, keysOrTuples must be an array of tuples: [[key1, value2],[key2,value2],...],
                // else keysOrTuples must be just an array of keys: [key1, key2, ...].
                return new Promise(function (resolve, reject) {
                    var len = keysOrTuples.length,
                        lastItem = len - 1;
                    if (len === 0) return resolve();
                    if (!hasDeleteHook) {
                        for (var i = 0; i < len; ++i) {
                            var req = idbstore.delete(keysOrTuples[i]);
                            req.onerror = wrap(eventRejectHandler(reject));
                            if (i === lastItem) req.onsuccess = wrap(function () {
                                return resolve();
                            });
                        }
                    } else {
                        var hookCtx,
                            errorHandler = hookedEventRejectHandler(reject),
                            successHandler = hookedEventSuccessHandler(null);
                        tryCatch(function () {
                            for (var i = 0; i < len; ++i) {
                                hookCtx = { onsuccess: null, onerror: null };
                                var tuple = keysOrTuples[i];
                                deletingHook.call(hookCtx, tuple[0], tuple[1], trans);
                                var req = idbstore.delete(tuple[0]);
                                req._hookCtx = hookCtx;
                                req.onerror = errorHandler;
                                if (i === lastItem) req.onsuccess = hookedEventSuccessHandler(resolve);else req.onsuccess = successHandler;
                            }
                        }, function (err) {
                            hookCtx.onerror && hookCtx.onerror(err);
                            throw err;
                        });
                    }
                }).uncaught(dbUncaught);
            }

            derive(WriteableTable).from(Table).extend({
                bulkDelete: function (keys$$1) {
                    if (this.hook.deleting.fire === nop) {
                        return this._idbstore(READWRITE, function (resolve, reject, idbstore, trans) {
                            resolve(bulkDelete(idbstore, trans, keys$$1, false, nop));
                        });
                    } else {
                        return this.where(':id').anyOf(keys$$1).delete().then(function () {}); // Resolve with undefined.
                    }
                },
                bulkPut: function (objects, keys$$1) {
                    var _this = this;

                    return this._idbstore(READWRITE, function (resolve, reject, idbstore) {
                        if (!idbstore.keyPath && !_this.schema.primKey.auto && !keys$$1) throw new exceptions.InvalidArgument("bulkPut() with non-inbound keys requires keys array in second argument");
                        if (idbstore.keyPath && keys$$1) throw new exceptions.InvalidArgument("bulkPut(): keys argument invalid on tables with inbound keys");
                        if (keys$$1 && keys$$1.length !== objects.length) throw new exceptions.InvalidArgument("Arguments objects and keys must have the same length");
                        if (objects.length === 0) return resolve(); // Caller provided empty list.
                        var done = function (result) {
                            if (errorList.length === 0) resolve(result);else reject(new BulkError(_this.name + '.bulkPut(): ' + errorList.length + ' of ' + numObjs + ' operations failed', errorList));
                        };
                        var req,
                            errorList = [],
                            errorHandler,
                            numObjs = objects.length,
                            table = _this;
                        if (_this.hook.creating.fire === nop && _this.hook.updating.fire === nop) {
                            //
                            // Standard Bulk (no 'creating' or 'updating' hooks to care about)
                            //
                            errorHandler = BulkErrorHandlerCatchAll(errorList);
                            for (var i = 0, l = objects.length; i < l; ++i) {
                                req = keys$$1 ? idbstore.put(objects[i], keys$$1[i]) : idbstore.put(objects[i]);
                                req.onerror = errorHandler;
                            }
                            // Only need to catch success or error on the last operation
                            // according to the IDB spec.
                            req.onerror = BulkErrorHandlerCatchAll(errorList, done);
                            req.onsuccess = eventSuccessHandler(done);
                        } else {
                            var effectiveKeys = keys$$1 || idbstore.keyPath && objects.map(function (o) {
                                return getByKeyPath(o, idbstore.keyPath);
                            });
                            // Generate map of {[key]: object}
                            var objectLookup = effectiveKeys && arrayToObject(effectiveKeys, function (key, i) {
                                return key != null && [key, objects[i]];
                            });
                            var promise = !effectiveKeys ?

                            // Auto-incremented key-less objects only without any keys argument.
                            table.bulkAdd(objects) :

                            // Keys provided. Either as inbound in provided objects, or as a keys argument.
                            // Begin with updating those that exists in DB:
                            table.where(':id').anyOf(effectiveKeys.filter(function (key) {
                                return key != null;
                            })).modify(function () {
                                this.value = objectLookup[this.primKey];
                                objectLookup[this.primKey] = null; // Mark as "don't add this"
                            }).catch(ModifyError, function (e) {
                                errorList = e.failures; // No need to concat here. These are the first errors added.
                            }).then(function () {
                                // Now, let's examine which items didnt exist so we can add them:
                                var objsToAdd = [],
                                    keysToAdd = keys$$1 && [];
                                // Iterate backwards. Why? Because if same key was used twice, just add the last one.
                                for (var i = effectiveKeys.length - 1; i >= 0; --i) {
                                    var key = effectiveKeys[i];
                                    if (key == null || objectLookup[key]) {
                                        objsToAdd.push(objects[i]);
                                        keys$$1 && keysToAdd.push(key);
                                        if (key != null) objectLookup[key] = null; // Mark as "dont add again"
                                    }
                                }
                                // The items are in reverse order so reverse them before adding.
                                // Could be important in order to get auto-incremented keys the way the caller
                                // would expect. Could have used unshift instead of push()/reverse(),
                                // but: http://jsperf.com/unshift-vs-reverse
                                objsToAdd.reverse();
                                keys$$1 && keysToAdd.reverse();
                                return table.bulkAdd(objsToAdd, keysToAdd);
                            }).then(function (lastAddedKey) {
                                // Resolve with key of the last object in given arguments to bulkPut():
                                var lastEffectiveKey = effectiveKeys[effectiveKeys.length - 1]; // Key was provided.
                                return lastEffectiveKey != null ? lastEffectiveKey : lastAddedKey;
                            });

                            promise.then(done).catch(BulkError, function (e) {
                                // Concat failure from ModifyError and reject using our 'done' method.
                                errorList = errorList.concat(e.failures);
                                done();
                            }).catch(reject);
                        }
                    }, "locked"); // If called from transaction scope, lock transaction til all steps are done.
                },
                bulkAdd: function (objects, keys$$1) {
                    var self = this,
                        creatingHook = this.hook.creating.fire;
                    return this._idbstore(READWRITE, function (resolve, reject, idbstore, trans) {
                        if (!idbstore.keyPath && !self.schema.primKey.auto && !keys$$1) throw new exceptions.InvalidArgument("bulkAdd() with non-inbound keys requires keys array in second argument");
                        if (idbstore.keyPath && keys$$1) throw new exceptions.InvalidArgument("bulkAdd(): keys argument invalid on tables with inbound keys");
                        if (keys$$1 && keys$$1.length !== objects.length) throw new exceptions.InvalidArgument("Arguments objects and keys must have the same length");
                        if (objects.length === 0) return resolve(); // Caller provided empty list.
                        function done(result) {
                            if (errorList.length === 0) resolve(result);else reject(new BulkError(self.name + '.bulkAdd(): ' + errorList.length + ' of ' + numObjs + ' operations failed', errorList));
                        }
                        var req,
                            errorList = [],
                            errorHandler,
                            successHandler,
                            numObjs = objects.length;
                        if (creatingHook !== nop) {
                            //
                            // There are subscribers to hook('creating')
                            // Must behave as documented.
                            //
                            var keyPath = idbstore.keyPath,
                                hookCtx;
                            errorHandler = BulkErrorHandlerCatchAll(errorList, null, true);
                            successHandler = hookedEventSuccessHandler(null);

                            tryCatch(function () {
                                for (var i = 0, l = objects.length; i < l; ++i) {
                                    hookCtx = { onerror: null, onsuccess: null };
                                    var key = keys$$1 && keys$$1[i];
                                    var obj = objects[i],
                                        effectiveKey = keys$$1 ? key : keyPath ? getByKeyPath(obj, keyPath) : undefined,
                                        keyToUse = creatingHook.call(hookCtx, effectiveKey, obj, trans);
                                    if (effectiveKey == null && keyToUse != null) {
                                        if (keyPath) {
                                            obj = deepClone(obj);
                                            setByKeyPath(obj, keyPath, keyToUse);
                                        } else {
                                            key = keyToUse;
                                        }
                                    }
                                    req = key != null ? idbstore.add(obj, key) : idbstore.add(obj);
                                    req._hookCtx = hookCtx;
                                    if (i < l - 1) {
                                        req.onerror = errorHandler;
                                        if (hookCtx.onsuccess) req.onsuccess = successHandler;
                                    }
                                }
                            }, function (err) {
                                hookCtx.onerror && hookCtx.onerror(err);
                                throw err;
                            });

                            req.onerror = BulkErrorHandlerCatchAll(errorList, done, true);
                            req.onsuccess = hookedEventSuccessHandler(done);
                        } else {
                            //
                            // Standard Bulk (no 'creating' hook to care about)
                            //
                            errorHandler = BulkErrorHandlerCatchAll(errorList);
                            for (var i = 0, l = objects.length; i < l; ++i) {
                                req = keys$$1 ? idbstore.add(objects[i], keys$$1[i]) : idbstore.add(objects[i]);
                                req.onerror = errorHandler;
                            }
                            // Only need to catch success or error on the last operation
                            // according to the IDB spec.
                            req.onerror = BulkErrorHandlerCatchAll(errorList, done);
                            req.onsuccess = eventSuccessHandler(done);
                        }
                    });
                },
                add: function (obj, key) {
                    /// <summary>
                    ///   Add an object to the database. In case an object with same primary key already exists, the object will not be added.
                    /// </summary>
                    /// <param name="obj" type="Object">A javascript object to insert</param>
                    /// <param name="key" optional="true">Primary key</param>
                    var creatingHook = this.hook.creating.fire;
                    return this._idbstore(READWRITE, function (resolve, reject, idbstore, trans) {
                        var hookCtx = { onsuccess: null, onerror: null };
                        if (creatingHook !== nop) {
                            var effectiveKey = key != null ? key : idbstore.keyPath ? getByKeyPath(obj, idbstore.keyPath) : undefined;
                            var keyToUse = creatingHook.call(hookCtx, effectiveKey, obj, trans); // Allow subscribers to when("creating") to generate the key.
                            if (effectiveKey == null && keyToUse != null) {
                                // Using "==" and "!=" to check for either null or undefined!
                                if (idbstore.keyPath) setByKeyPath(obj, idbstore.keyPath, keyToUse);else key = keyToUse;
                            }
                        }
                        try {
                            var req = key != null ? idbstore.add(obj, key) : idbstore.add(obj);
                            req._hookCtx = hookCtx;
                            req.onerror = hookedEventRejectHandler(reject);
                            req.onsuccess = hookedEventSuccessHandler(function (result) {
                                // TODO: Remove these two lines in next major release (2.0?)
                                // It's no good practice to have side effects on provided parameters
                                var keyPath = idbstore.keyPath;
                                if (keyPath) setByKeyPath(obj, keyPath, result);
                                resolve(result);
                            });
                        } catch (e) {
                            if (hookCtx.onerror) hookCtx.onerror(e);
                            throw e;
                        }
                    });
                },

                put: function (obj, key) {
                    /// <summary>
                    ///   Add an object to the database but in case an object with same primary key alread exists, the existing one will get updated.
                    /// </summary>
                    /// <param name="obj" type="Object">A javascript object to insert or update</param>
                    /// <param name="key" optional="true">Primary key</param>
                    var self = this,
                        creatingHook = this.hook.creating.fire,
                        updatingHook = this.hook.updating.fire;
                    if (creatingHook !== nop || updatingHook !== nop) {
                        //
                        // People listens to when("creating") or when("updating") events!
                        // We must know whether the put operation results in an CREATE or UPDATE.
                        //
                        return this._trans(READWRITE, function (resolve, reject, trans) {
                            // Since key is optional, make sure we get it from obj if not provided
                            var effectiveKey = key !== undefined ? key : self.schema.primKey.keyPath && getByKeyPath(obj, self.schema.primKey.keyPath);
                            if (effectiveKey == null) {
                                // "== null" means checking for either null or undefined.
                                // No primary key. Must use add().
                                self.add(obj).then(resolve, reject);
                            } else {
                                // Primary key exist. Lock transaction and try modifying existing. If nothing modified, call add().
                                trans._lock(); // Needed because operation is splitted into modify() and add().
                                // clone obj before this async call. If caller modifies obj the line after put(), the IDB spec requires that it should not affect operation.
                                obj = deepClone(obj);
                                self.where(":id").equals(effectiveKey).modify(function () {
                                    // Replace extisting value with our object
                                    // CRUD event firing handled in WriteableCollection.modify()
                                    this.value = obj;
                                }).then(function (count) {
                                    if (count === 0) {
                                        // Object's key was not found. Add the object instead.
                                        // CRUD event firing will be done in add()
                                        return self.add(obj, key); // Resolving with another Promise. Returned Promise will then resolve with the new key.
                                    } else {
                                        return effectiveKey; // Resolve with the provided key.
                                    }
                                }).finally(function () {
                                    trans._unlock();
                                }).then(resolve, reject);
                            }
                        });
                    } else {
                        // Use the standard IDB put() method.
                        return this._idbstore(READWRITE, function (resolve, reject, idbstore) {
                            var req = key !== undefined ? idbstore.put(obj, key) : idbstore.put(obj);
                            req.onerror = eventRejectHandler(reject);
                            req.onsuccess = function (ev) {
                                var keyPath = idbstore.keyPath;
                                if (keyPath) setByKeyPath(obj, keyPath, ev.target.result);
                                resolve(req.result);
                            };
                        });
                    }
                },

                'delete': function (key) {
                    /// <param name="key">Primary key of the object to delete</param>
                    if (this.hook.deleting.subscribers.length) {
                        // People listens to when("deleting") event. Must implement delete using WriteableCollection.delete() that will
                        // call the CRUD event. Only WriteableCollection.delete() will know whether an object was actually deleted.
                        return this.where(":id").equals(key).delete();
                    } else {
                        // No one listens. Use standard IDB delete() method.
                        return this._idbstore(READWRITE, function (resolve, reject, idbstore) {
                            var req = idbstore.delete(key);
                            req.onerror = eventRejectHandler(reject);
                            req.onsuccess = function () {
                                resolve(req.result);
                            };
                        });
                    }
                },

                clear: function () {
                    if (this.hook.deleting.subscribers.length) {
                        // People listens to when("deleting") event. Must implement delete using WriteableCollection.delete() that will
                        // call the CRUD event. Only WriteableCollection.delete() will knows which objects that are actually deleted.
                        return this.toCollection().delete();
                    } else {
                        return this._idbstore(READWRITE, function (resolve, reject, idbstore) {
                            var req = idbstore.clear();
                            req.onerror = eventRejectHandler(reject);
                            req.onsuccess = function () {
                                resolve(req.result);
                            };
                        });
                    }
                },

                update: function (keyOrObject, modifications) {
                    if (typeof modifications !== 'object' || isArray(modifications)) throw new exceptions.InvalidArgument("Modifications must be an object.");
                    if (typeof keyOrObject === 'object' && !isArray(keyOrObject)) {
                        // object to modify. Also modify given object with the modifications:
                        keys(modifications).forEach(function (keyPath) {
                            setByKeyPath(keyOrObject, keyPath, modifications[keyPath]);
                        });
                        var key = getByKeyPath(keyOrObject, this.schema.primKey.keyPath);
                        if (key === undefined) return rejection(new exceptions.InvalidArgument("Given object does not contain its primary key"), dbUncaught);
                        return this.where(":id").equals(key).modify(modifications);
                    } else {
                        // key to modify
                        return this.where(":id").equals(keyOrObject).modify(modifications);
                    }
                }
            });

            //
            //
            //
            // Transaction Class
            //
            //
            //
            function Transaction(mode, storeNames, dbschema, parent) {
                var _this2 = this;

                /// <summary>
                ///    Transaction class. Represents a database transaction. All operations on db goes through a Transaction.
                /// </summary>
                /// <param name="mode" type="String">Any of "readwrite" or "readonly"</param>
                /// <param name="storeNames" type="Array">Array of table names to operate on</param>
                this.db = db;
                this.mode = mode;
                this.storeNames = storeNames;
                this.idbtrans = null;
                this.on = Events(this, "complete", "error", "abort");
                this.parent = parent || null;
                this.active = true;
                this._tables = null;
                this._reculock = 0;
                this._blockedFuncs = [];
                this._psd = null;
                this._dbschema = dbschema;
                this._resolve = null;
                this._reject = null;
                this._completion = new Promise(function (resolve, reject) {
                    _this2._resolve = resolve;
                    _this2._reject = reject;
                }).uncaught(dbUncaught);

                this._completion.then(function () {
                    _this2.on.complete.fire();
                }, function (e) {
                    _this2.on.error.fire(e);
                    _this2.parent ? _this2.parent._reject(e) : _this2.active && _this2.idbtrans && _this2.idbtrans.abort();
                    _this2.active = false;
                    return rejection(e); // Indicate we actually DO NOT catch this error.
                });
            }

            props(Transaction.prototype, {
                //
                // Transaction Protected Methods (not required by API users, but needed internally and eventually by dexie extensions)
                //
                _lock: function () {
                    assert(!PSD.global); // Locking and unlocking reuires to be within a PSD scope.
                    // Temporary set all requests into a pending queue if they are called before database is ready.
                    ++this._reculock; // Recursive read/write lock pattern using PSD (Promise Specific Data) instead of TLS (Thread Local Storage)
                    if (this._reculock === 1 && !PSD.global) PSD.lockOwnerFor = this;
                    return this;
                },
                _unlock: function () {
                    assert(!PSD.global); // Locking and unlocking reuires to be within a PSD scope.
                    if (--this._reculock === 0) {
                        if (!PSD.global) PSD.lockOwnerFor = null;
                        while (this._blockedFuncs.length > 0 && !this._locked()) {
                            var fnAndPSD = this._blockedFuncs.shift();
                            try {
                                usePSD(fnAndPSD[1], fnAndPSD[0]);
                            } catch (e) {}
                        }
                    }
                    return this;
                },
                _locked: function () {
                    // Checks if any write-lock is applied on this transaction.
                    // To simplify the Dexie API for extension implementations, we support recursive locks.
                    // This is accomplished by using "Promise Specific Data" (PSD).
                    // PSD data is bound to a Promise and any child Promise emitted through then() or resolve( new Promise() ).
                    // PSD is local to code executing on top of the call stacks of any of any code executed by Promise():
                    //         * callback given to the Promise() constructor  (function (resolve, reject){...})
                    //         * callbacks given to then()/catch()/finally() methods (function (value){...})
                    // If creating a new independant Promise instance from within a Promise call stack, the new Promise will derive the PSD from the call stack of the parent Promise.
                    // Derivation is done so that the inner PSD __proto__ points to the outer PSD.
                    // PSD.lockOwnerFor will point to current transaction object if the currently executing PSD scope owns the lock.
                    return this._reculock && PSD.lockOwnerFor !== this;
                },
                create: function (idbtrans) {
                    var _this3 = this;

                    assert(!this.idbtrans);
                    if (!idbtrans && !idbdb) {
                        switch (dbOpenError && dbOpenError.name) {
                            case "DatabaseClosedError":
                                // Errors where it is no difference whether it was caused by the user operation or an earlier call to db.open()
                                throw new exceptions.DatabaseClosed(dbOpenError);
                            case "MissingAPIError":
                                // Errors where it is no difference whether it was caused by the user operation or an earlier call to db.open()
                                throw new exceptions.MissingAPI(dbOpenError.message, dbOpenError);
                            default:
                                // Make it clear that the user operation was not what caused the error - the error had occurred earlier on db.open()!
                                throw new exceptions.OpenFailed(dbOpenError);
                        }
                    }
                    if (!this.active) throw new exceptions.TransactionInactive();
                    assert(this._completion._state === null);

                    idbtrans = this.idbtrans = idbtrans || idbdb.transaction(safariMultiStoreFix(this.storeNames), this.mode);
                    idbtrans.onerror = wrap(function (ev) {
                        preventDefault(ev); // Prohibit default bubbling to window.error
                        _this3._reject(idbtrans.error);
                    });
                    idbtrans.onabort = wrap(function (ev) {
                        preventDefault(ev);
                        _this3.active && _this3._reject(new exceptions.Abort());
                        _this3.active = false;
                        _this3.on("abort").fire(ev);
                    });
                    idbtrans.oncomplete = wrap(function () {
                        _this3.active = false;
                        _this3._resolve();
                    });
                    return this;
                },
                _promise: function (mode, fn, bWriteLock) {
                    var self = this;
                    var p = self._locked() ?
                    // Read lock always. Transaction is write-locked. Wait for mutex.
                    new Promise(function (resolve, reject) {
                        self._blockedFuncs.push([function () {
                            self._promise(mode, fn, bWriteLock).then(resolve, reject);
                        }, PSD]);
                    }) : newScope(function () {
                        var p_ = self.active ? new Promise(function (resolve, reject) {
                            if (mode === READWRITE && self.mode !== READWRITE) throw new exceptions.ReadOnly("Transaction is readonly");
                            if (!self.idbtrans && mode) self.create();
                            if (bWriteLock) self._lock(); // Write lock if write operation is requested
                            fn(resolve, reject, self);
                        }) : rejection(new exceptions.TransactionInactive());
                        if (self.active && bWriteLock) p_.finally(function () {
                            self._unlock();
                        });
                        return p_;
                    });

                    p._lib = true;
                    return p.uncaught(dbUncaught);
                },

                //
                // Transaction Public Properties and Methods
                //
                abort: function () {
                    this.active && this._reject(new exceptions.Abort());
                    this.active = false;
                },

                tables: {
                    get: deprecated("Transaction.tables", function () {
                        return arrayToObject(this.storeNames, function (name) {
                            return [name, allTables[name]];
                        });
                    }, "Use db.tables()")
                },

                complete: deprecated("Transaction.complete()", function (cb) {
                    return this.on("complete", cb);
                }),

                error: deprecated("Transaction.error()", function (cb) {
                    return this.on("error", cb);
                }),

                table: deprecated("Transaction.table()", function (name) {
                    if (this.storeNames.indexOf(name) === -1) throw new exceptions.InvalidTable("Table " + name + " not in transaction");
                    return allTables[name];
                })

            });

            //
            //
            //
            // WhereClause
            //
            //
            //
            function WhereClause(table, index, orCollection) {
                /// <param name="table" type="Table"></param>
                /// <param name="index" type="String" optional="true"></param>
                /// <param name="orCollection" type="Collection" optional="true"></param>
                this._ctx = {
                    table: table,
                    index: index === ":id" ? null : index,
                    collClass: table._collClass,
                    or: orCollection
                };
            }

            props(WhereClause.prototype, function () {

                // WhereClause private methods

                function fail(collectionOrWhereClause, err, T) {
                    var collection = collectionOrWhereClause instanceof WhereClause ? new collectionOrWhereClause._ctx.collClass(collectionOrWhereClause) : collectionOrWhereClause;

                    collection._ctx.error = T ? new T(err) : new TypeError(err);
                    return collection;
                }

                function emptyCollection(whereClause) {
                    return new whereClause._ctx.collClass(whereClause, function () {
                        return IDBKeyRange.only("");
                    }).limit(0);
                }

                function upperFactory(dir) {
                    return dir === "next" ? function (s) {
                        return s.toUpperCase();
                    } : function (s) {
                        return s.toLowerCase();
                    };
                }
                function lowerFactory(dir) {
                    return dir === "next" ? function (s) {
                        return s.toLowerCase();
                    } : function (s) {
                        return s.toUpperCase();
                    };
                }
                function nextCasing(key, lowerKey, upperNeedle, lowerNeedle, cmp, dir) {
                    var length = Math.min(key.length, lowerNeedle.length);
                    var llp = -1;
                    for (var i = 0; i < length; ++i) {
                        var lwrKeyChar = lowerKey[i];
                        if (lwrKeyChar !== lowerNeedle[i]) {
                            if (cmp(key[i], upperNeedle[i]) < 0) return key.substr(0, i) + upperNeedle[i] + upperNeedle.substr(i + 1);
                            if (cmp(key[i], lowerNeedle[i]) < 0) return key.substr(0, i) + lowerNeedle[i] + upperNeedle.substr(i + 1);
                            if (llp >= 0) return key.substr(0, llp) + lowerKey[llp] + upperNeedle.substr(llp + 1);
                            return null;
                        }
                        if (cmp(key[i], lwrKeyChar) < 0) llp = i;
                    }
                    if (length < lowerNeedle.length && dir === "next") return key + upperNeedle.substr(key.length);
                    if (length < key.length && dir === "prev") return key.substr(0, upperNeedle.length);
                    return llp < 0 ? null : key.substr(0, llp) + lowerNeedle[llp] + upperNeedle.substr(llp + 1);
                }

                function addIgnoreCaseAlgorithm(whereClause, match, needles, suffix) {
                    /// <param name="needles" type="Array" elementType="String"></param>
                    var upper,
                        lower,
                        compare,
                        upperNeedles,
                        lowerNeedles,
                        direction,
                        nextKeySuffix,
                        needlesLen = needles.length;
                    if (!needles.every(function (s) {
                        return typeof s === 'string';
                    })) {
                        return fail(whereClause, STRING_EXPECTED);
                    }
                    function initDirection(dir) {
                        upper = upperFactory(dir);
                        lower = lowerFactory(dir);
                        compare = dir === "next" ? simpleCompare : simpleCompareReverse;
                        var needleBounds = needles.map(function (needle) {
                            return { lower: lower(needle), upper: upper(needle) };
                        }).sort(function (a, b) {
                            return compare(a.lower, b.lower);
                        });
                        upperNeedles = needleBounds.map(function (nb) {
                            return nb.upper;
                        });
                        lowerNeedles = needleBounds.map(function (nb) {
                            return nb.lower;
                        });
                        direction = dir;
                        nextKeySuffix = dir === "next" ? "" : suffix;
                    }
                    initDirection("next");

                    var c = new whereClause._ctx.collClass(whereClause, function () {
                        return IDBKeyRange.bound(upperNeedles[0], lowerNeedles[needlesLen - 1] + suffix);
                    });

                    c._ondirectionchange = function (direction) {
                        // This event onlys occur before filter is called the first time.
                        initDirection(direction);
                    };

                    var firstPossibleNeedle = 0;

                    c._addAlgorithm(function (cursor, advance, resolve) {
                        /// <param name="cursor" type="IDBCursor"></param>
                        /// <param name="advance" type="Function"></param>
                        /// <param name="resolve" type="Function"></param>
                        var key = cursor.key;
                        if (typeof key !== 'string') return false;
                        var lowerKey = lower(key);
                        if (match(lowerKey, lowerNeedles, firstPossibleNeedle)) {
                            return true;
                        } else {
                            var lowestPossibleCasing = null;
                            for (var i = firstPossibleNeedle; i < needlesLen; ++i) {
                                var casing = nextCasing(key, lowerKey, upperNeedles[i], lowerNeedles[i], compare, direction);
                                if (casing === null && lowestPossibleCasing === null) firstPossibleNeedle = i + 1;else if (lowestPossibleCasing === null || compare(lowestPossibleCasing, casing) > 0) {
                                    lowestPossibleCasing = casing;
                                }
                            }
                            if (lowestPossibleCasing !== null) {
                                advance(function () {
                                    cursor.continue(lowestPossibleCasing + nextKeySuffix);
                                });
                            } else {
                                advance(resolve);
                            }
                            return false;
                        }
                    });
                    return c;
                }

                //
                // WhereClause public methods
                //
                return {
                    between: function (lower, upper, includeLower, includeUpper) {
                        /// <summary>
                        ///     Filter out records whose where-field lays between given lower and upper values. Applies to Strings, Numbers and Dates.
                        /// </summary>
                        /// <param name="lower"></param>
                        /// <param name="upper"></param>
                        /// <param name="includeLower" optional="true">Whether items that equals lower should be included. Default true.</param>
                        /// <param name="includeUpper" optional="true">Whether items that equals upper should be included. Default false.</param>
                        /// <returns type="Collection"></returns>
                        includeLower = includeLower !== false; // Default to true
                        includeUpper = includeUpper === true; // Default to false
                        try {
                            if (cmp(lower, upper) > 0 || cmp(lower, upper) === 0 && (includeLower || includeUpper) && !(includeLower && includeUpper)) return emptyCollection(this); // Workaround for idiotic W3C Specification that DataError must be thrown if lower > upper. The natural result would be to return an empty collection.
                            return new this._ctx.collClass(this, function () {
                                return IDBKeyRange.bound(lower, upper, !includeLower, !includeUpper);
                            });
                        } catch (e) {
                            return fail(this, INVALID_KEY_ARGUMENT);
                        }
                    },
                    equals: function (value) {
                        return new this._ctx.collClass(this, function () {
                            return IDBKeyRange.only(value);
                        });
                    },
                    above: function (value) {
                        return new this._ctx.collClass(this, function () {
                            return IDBKeyRange.lowerBound(value, true);
                        });
                    },
                    aboveOrEqual: function (value) {
                        return new this._ctx.collClass(this, function () {
                            return IDBKeyRange.lowerBound(value);
                        });
                    },
                    below: function (value) {
                        return new this._ctx.collClass(this, function () {
                            return IDBKeyRange.upperBound(value, true);
                        });
                    },
                    belowOrEqual: function (value) {
                        return new this._ctx.collClass(this, function () {
                            return IDBKeyRange.upperBound(value);
                        });
                    },
                    startsWith: function (str) {
                        /// <param name="str" type="String"></param>
                        if (typeof str !== 'string') return fail(this, STRING_EXPECTED);
                        return this.between(str, str + maxString, true, true);
                    },
                    startsWithIgnoreCase: function (str) {
                        /// <param name="str" type="String"></param>
                        if (str === "") return this.startsWith(str);
                        return addIgnoreCaseAlgorithm(this, function (x, a) {
                            return x.indexOf(a[0]) === 0;
                        }, [str], maxString);
                    },
                    equalsIgnoreCase: function (str) {
                        /// <param name="str" type="String"></param>
                        return addIgnoreCaseAlgorithm(this, function (x, a) {
                            return x === a[0];
                        }, [str], "");
                    },
                    anyOfIgnoreCase: function () {
                        var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
                        if (set.length === 0) return emptyCollection(this);
                        return addIgnoreCaseAlgorithm(this, function (x, a) {
                            return a.indexOf(x) !== -1;
                        }, set, "");
                    },
                    startsWithAnyOfIgnoreCase: function () {
                        var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
                        if (set.length === 0) return emptyCollection(this);
                        return addIgnoreCaseAlgorithm(this, function (x, a) {
                            return a.some(function (n) {
                                return x.indexOf(n) === 0;
                            });
                        }, set, maxString);
                    },
                    anyOf: function () {
                        var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
                        var compare = ascending;
                        try {
                            set.sort(compare);
                        } catch (e) {
                            return fail(this, INVALID_KEY_ARGUMENT);
                        }
                        if (set.length === 0) return emptyCollection(this);
                        var c = new this._ctx.collClass(this, function () {
                            return IDBKeyRange.bound(set[0], set[set.length - 1]);
                        });

                        c._ondirectionchange = function (direction) {
                            compare = direction === "next" ? ascending : descending;
                            set.sort(compare);
                        };
                        var i = 0;
                        c._addAlgorithm(function (cursor, advance, resolve) {
                            var key = cursor.key;
                            while (compare(key, set[i]) > 0) {
                                // The cursor has passed beyond this key. Check next.
                                ++i;
                                if (i === set.length) {
                                    // There is no next. Stop searching.
                                    advance(resolve);
                                    return false;
                                }
                            }
                            if (compare(key, set[i]) === 0) {
                                // The current cursor value should be included and we should continue a single step in case next item has the same key or possibly our next key in set.
                                return true;
                            } else {
                                // cursor.key not yet at set[i]. Forward cursor to the next key to hunt for.
                                advance(function () {
                                    cursor.continue(set[i]);
                                });
                                return false;
                            }
                        });
                        return c;
                    },

                    notEqual: function (value) {
                        return this.inAnyRange([[-Infinity, value], [value, maxKey]], { includeLowers: false, includeUppers: false });
                    },

                    noneOf: function () {
                        var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
                        if (set.length === 0) return new this._ctx.collClass(this); // Return entire collection.
                        try {
                            set.sort(ascending);
                        } catch (e) {
                            return fail(this, INVALID_KEY_ARGUMENT);
                        }
                        // Transform ["a","b","c"] to a set of ranges for between/above/below: [[-Infinity,"a"], ["a","b"], ["b","c"], ["c",maxKey]]
                        var ranges = set.reduce(function (res, val) {
                            return res ? res.concat([[res[res.length - 1][1], val]]) : [[-Infinity, val]];
                        }, null);
                        ranges.push([set[set.length - 1], maxKey]);
                        return this.inAnyRange(ranges, { includeLowers: false, includeUppers: false });
                    },

                    /** Filter out values withing given set of ranges.
                    * Example, give children and elders a rebate of 50%:
                    *
                    *   db.friends.where('age').inAnyRange([[0,18],[65,Infinity]]).modify({Rebate: 1/2});
                    *
                    * @param {(string|number|Date|Array)[][]} ranges
                    * @param {{includeLowers: boolean, includeUppers: boolean}} options
                    */
                    inAnyRange: function (ranges, options) {
                        var ctx = this._ctx;
                        if (ranges.length === 0) return emptyCollection(this);
                        if (!ranges.every(function (range) {
                            return range[0] !== undefined && range[1] !== undefined && ascending(range[0], range[1]) <= 0;
                        })) {
                            return fail(this, "First argument to inAnyRange() must be an Array of two-value Arrays [lower,upper] where upper must not be lower than lower", exceptions.InvalidArgument);
                        }
                        var includeLowers = !options || options.includeLowers !== false; // Default to true
                        var includeUppers = options && options.includeUppers === true; // Default to false

                        function addRange(ranges, newRange) {
                            for (var i = 0, l = ranges.length; i < l; ++i) {
                                var range = ranges[i];
                                if (cmp(newRange[0], range[1]) < 0 && cmp(newRange[1], range[0]) > 0) {
                                    range[0] = min(range[0], newRange[0]);
                                    range[1] = max(range[1], newRange[1]);
                                    break;
                                }
                            }
                            if (i === l) ranges.push(newRange);
                            return ranges;
                        }

                        var sortDirection = ascending;
                        function rangeSorter(a, b) {
                            return sortDirection(a[0], b[0]);
                        }

                        // Join overlapping ranges
                        var set;
                        try {
                            set = ranges.reduce(addRange, []);
                            set.sort(rangeSorter);
                        } catch (ex) {
                            return fail(this, INVALID_KEY_ARGUMENT);
                        }

                        var i = 0;
                        var keyIsBeyondCurrentEntry = includeUppers ? function (key) {
                            return ascending(key, set[i][1]) > 0;
                        } : function (key) {
                            return ascending(key, set[i][1]) >= 0;
                        };

                        var keyIsBeforeCurrentEntry = includeLowers ? function (key) {
                            return descending(key, set[i][0]) > 0;
                        } : function (key) {
                            return descending(key, set[i][0]) >= 0;
                        };

                        function keyWithinCurrentRange(key) {
                            return !keyIsBeyondCurrentEntry(key) && !keyIsBeforeCurrentEntry(key);
                        }

                        var checkKey = keyIsBeyondCurrentEntry;

                        var c = new ctx.collClass(this, function () {
                            return IDBKeyRange.bound(set[0][0], set[set.length - 1][1], !includeLowers, !includeUppers);
                        });

                        c._ondirectionchange = function (direction) {
                            if (direction === "next") {
                                checkKey = keyIsBeyondCurrentEntry;
                                sortDirection = ascending;
                            } else {
                                checkKey = keyIsBeforeCurrentEntry;
                                sortDirection = descending;
                            }
                            set.sort(rangeSorter);
                        };

                        c._addAlgorithm(function (cursor, advance, resolve) {
                            var key = cursor.key;
                            while (checkKey(key)) {
                                // The cursor has passed beyond this key. Check next.
                                ++i;
                                if (i === set.length) {
                                    // There is no next. Stop searching.
                                    advance(resolve);
                                    return false;
                                }
                            }
                            if (keyWithinCurrentRange(key)) {
                                // The current cursor value should be included and we should continue a single step in case next item has the same key or possibly our next key in set.
                                return true;
                            } else if (cmp(key, set[i][1]) === 0 || cmp(key, set[i][0]) === 0) {
                                // includeUpper or includeLower is false so keyWithinCurrentRange() returns false even though we are at range border.
                                // Continue to next key but don't include this one.
                                return false;
                            } else {
                                // cursor.key not yet at set[i]. Forward cursor to the next key to hunt for.
                                advance(function () {
                                    if (sortDirection === ascending) cursor.continue(set[i][0]);else cursor.continue(set[i][1]);
                                });
                                return false;
                            }
                        });
                        return c;
                    },
                    startsWithAnyOf: function () {
                        var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);

                        if (!set.every(function (s) {
                            return typeof s === 'string';
                        })) {
                            return fail(this, "startsWithAnyOf() only works with strings");
                        }
                        if (set.length === 0) return emptyCollection(this);

                        return this.inAnyRange(set.map(function (str) {
                            return [str, str + maxString];
                        }));
                    }
                };
            });

            //
            //
            //
            // Collection Class
            //
            //
            //
            function Collection(whereClause, keyRangeGenerator) {
                /// <summary>
                ///
                /// </summary>
                /// <param name="whereClause" type="WhereClause">Where clause instance</param>
                /// <param name="keyRangeGenerator" value="function(){ return IDBKeyRange.bound(0,1);}" optional="true"></param>
                var keyRange = null,
                    error = null;
                if (keyRangeGenerator) try {
                    keyRange = keyRangeGenerator();
                } catch (ex) {
                    error = ex;
                }

                var whereCtx = whereClause._ctx,
                    table = whereCtx.table;
                this._ctx = {
                    table: table,
                    index: whereCtx.index,
                    isPrimKey: !whereCtx.index || table.schema.primKey.keyPath && whereCtx.index === table.schema.primKey.name,
                    range: keyRange,
                    keysOnly: false,
                    dir: "next",
                    unique: "",
                    algorithm: null,
                    filter: null,
                    replayFilter: null,
                    justLimit: true, // True if a replayFilter is just a filter that performs a "limit" operation (or none at all)
                    isMatch: null,
                    offset: 0,
                    limit: Infinity,
                    error: error, // If set, any promise must be rejected with this error
                    or: whereCtx.or,
                    valueMapper: table.hook.reading.fire
                };
            }

            function isPlainKeyRange(ctx, ignoreLimitFilter) {
                return !(ctx.filter || ctx.algorithm || ctx.or) && (ignoreLimitFilter ? ctx.justLimit : !ctx.replayFilter);
            }

            props(Collection.prototype, function () {

                //
                // Collection Private Functions
                //

                function addFilter(ctx, fn) {
                    ctx.filter = combine(ctx.filter, fn);
                }

                function addReplayFilter(ctx, factory, isLimitFilter) {
                    var curr = ctx.replayFilter;
                    ctx.replayFilter = curr ? function () {
                        return combine(curr(), factory());
                    } : factory;
                    ctx.justLimit = isLimitFilter && !curr;
                }

                function addMatchFilter(ctx, fn) {
                    ctx.isMatch = combine(ctx.isMatch, fn);
                }

                /** @param ctx {
                 *      isPrimKey: boolean,
                 *      table: Table,
                 *      index: string
                 * }
                 * @param store IDBObjectStore
                 **/
                function getIndexOrStore(ctx, store) {
                    if (ctx.isPrimKey) return store;
                    var indexSpec = ctx.table.schema.idxByName[ctx.index];
                    if (!indexSpec) throw new exceptions.Schema("KeyPath " + ctx.index + " on object store " + store.name + " is not indexed");
                    return store.index(indexSpec.name);
                }

                /** @param ctx {
                 *      isPrimKey: boolean,
                 *      table: Table,
                 *      index: string,
                 *      keysOnly: boolean,
                 *      range?: IDBKeyRange,
                 *      dir: "next" | "prev"
                 * }
                 */
                function openCursor(ctx, store) {
                    var idxOrStore = getIndexOrStore(ctx, store);
                    return ctx.keysOnly && 'openKeyCursor' in idxOrStore ? idxOrStore.openKeyCursor(ctx.range || null, ctx.dir + ctx.unique) : idxOrStore.openCursor(ctx.range || null, ctx.dir + ctx.unique);
                }

                function iter(ctx, fn, resolve, reject, idbstore) {
                    var filter = ctx.replayFilter ? combine(ctx.filter, ctx.replayFilter()) : ctx.filter;
                    if (!ctx.or) {
                        iterate(openCursor(ctx, idbstore), combine(ctx.algorithm, filter), fn, resolve, reject, !ctx.keysOnly && ctx.valueMapper);
                    } else (function () {
                        var set = {};
                        var resolved = 0;

                        function resolveboth() {
                            if (++resolved === 2) resolve(); // Seems like we just support or btwn max 2 expressions, but there are no limit because we do recursion.
                        }

                        function union(item, cursor, advance) {
                            if (!filter || filter(cursor, advance, resolveboth, reject)) {
                                var key = cursor.primaryKey.toString(); // Converts any Date to String, String to String, Number to String and Array to comma-separated string
                                if (!hasOwn(set, key)) {
                                    set[key] = true;
                                    fn(item, cursor, advance);
                                }
                            }
                        }

                        ctx.or._iterate(union, resolveboth, reject, idbstore);
                        iterate(openCursor(ctx, idbstore), ctx.algorithm, union, resolveboth, reject, !ctx.keysOnly && ctx.valueMapper);
                    })();
                }
                function getInstanceTemplate(ctx) {
                    return ctx.table.schema.instanceTemplate;
                }

                return {

                    //
                    // Collection Protected Functions
                    //

                    _read: function (fn, cb) {
                        var ctx = this._ctx;
                        if (ctx.error) return ctx.table._trans(null, function rejector(resolve, reject) {
                            reject(ctx.error);
                        });else return ctx.table._idbstore(READONLY, fn).then(cb);
                    },
                    _write: function (fn) {
                        var ctx = this._ctx;
                        if (ctx.error) return ctx.table._trans(null, function rejector(resolve, reject) {
                            reject(ctx.error);
                        });else return ctx.table._idbstore(READWRITE, fn, "locked"); // When doing write operations on collections, always lock the operation so that upcoming operations gets queued.
                    },
                    _addAlgorithm: function (fn) {
                        var ctx = this._ctx;
                        ctx.algorithm = combine(ctx.algorithm, fn);
                    },

                    _iterate: function (fn, resolve, reject, idbstore) {
                        return iter(this._ctx, fn, resolve, reject, idbstore);
                    },

                    clone: function (props$$1) {
                        var rv = Object.create(this.constructor.prototype),
                            ctx = Object.create(this._ctx);
                        if (props$$1) extend(ctx, props$$1);
                        rv._ctx = ctx;
                        return rv;
                    },

                    raw: function () {
                        this._ctx.valueMapper = null;
                        return this;
                    },

                    //
                    // Collection Public methods
                    //

                    each: function (fn) {
                        var ctx = this._ctx;

                        if (fake) {
                            var item = getInstanceTemplate(ctx),
                                primKeyPath = ctx.table.schema.primKey.keyPath,
                                key = getByKeyPath(item, ctx.index ? ctx.table.schema.idxByName[ctx.index].keyPath : primKeyPath),
                                primaryKey = getByKeyPath(item, primKeyPath);
                            fn(item, { key: key, primaryKey: primaryKey });
                        }

                        return this._read(function (resolve, reject, idbstore) {
                            iter(ctx, fn, resolve, reject, idbstore);
                        });
                    },

                    count: function (cb) {
                        if (fake) return Promise.resolve(0).then(cb);
                        var ctx = this._ctx;

                        if (isPlainKeyRange(ctx, true)) {
                            // This is a plain key range. We can use the count() method if the index.
                            return this._read(function (resolve, reject, idbstore) {
                                var idx = getIndexOrStore(ctx, idbstore);
                                var req = ctx.range ? idx.count(ctx.range) : idx.count();
                                req.onerror = eventRejectHandler(reject);
                                req.onsuccess = function (e) {
                                    resolve(Math.min(e.target.result, ctx.limit));
                                };
                            }, cb);
                        } else {
                            // Algorithms, filters or expressions are applied. Need to count manually.
                            var count = 0;
                            return this._read(function (resolve, reject, idbstore) {
                                iter(ctx, function () {
                                    ++count;return false;
                                }, function () {
                                    resolve(count);
                                }, reject, idbstore);
                            }, cb);
                        }
                    },

                    sortBy: function (keyPath, cb) {
                        /// <param name="keyPath" type="String"></param>
                        var parts = keyPath.split('.').reverse(),
                            lastPart = parts[0],
                            lastIndex = parts.length - 1;
                        function getval(obj, i) {
                            if (i) return getval(obj[parts[i]], i - 1);
                            return obj[lastPart];
                        }
                        var order = this._ctx.dir === "next" ? 1 : -1;

                        function sorter(a, b) {
                            var aVal = getval(a, lastIndex),
                                bVal = getval(b, lastIndex);
                            return aVal < bVal ? -order : aVal > bVal ? order : 0;
                        }
                        return this.toArray(function (a) {
                            return a.sort(sorter);
                        }).then(cb);
                    },

                    toArray: function (cb) {
                        var ctx = this._ctx;
                        return this._read(function (resolve, reject, idbstore) {
                            fake && resolve([getInstanceTemplate(ctx)]);
                            if (hasGetAll && ctx.dir === 'next' && isPlainKeyRange(ctx, true) && ctx.limit > 0) {
                                // Special optimation if we could use IDBObjectStore.getAll() or
                                // IDBKeyRange.getAll():
                                var readingHook = ctx.table.hook.reading.fire;
                                var idxOrStore = getIndexOrStore(ctx, idbstore);
                                var req = ctx.limit < Infinity ? idxOrStore.getAll(ctx.range, ctx.limit) : idxOrStore.getAll(ctx.range);
                                req.onerror = eventRejectHandler(reject);
                                req.onsuccess = readingHook === mirror ? eventSuccessHandler(resolve) : wrap(eventSuccessHandler(function (res) {
                                    try {
                                        resolve(res.map(readingHook));
                                    } catch (e) {
                                        reject(e);
                                    }
                                }));
                            } else {
                                // Getting array through a cursor.
                                var a = [];
                                iter(ctx, function (item) {
                                    a.push(item);
                                }, function arrayComplete() {
                                    resolve(a);
                                }, reject, idbstore);
                            }
                        }, cb);
                    },

                    offset: function (offset) {
                        var ctx = this._ctx;
                        if (offset <= 0) return this;
                        ctx.offset += offset; // For count()
                        if (isPlainKeyRange(ctx)) {
                            addReplayFilter(ctx, function () {
                                var offsetLeft = offset;
                                return function (cursor, advance) {
                                    if (offsetLeft === 0) return true;
                                    if (offsetLeft === 1) {
                                        --offsetLeft;return false;
                                    }
                                    advance(function () {
                                        cursor.advance(offsetLeft);
                                        offsetLeft = 0;
                                    });
                                    return false;
                                };
                            });
                        } else {
                            addReplayFilter(ctx, function () {
                                var offsetLeft = offset;
                                return function () {
                                    return --offsetLeft < 0;
                                };
                            });
                        }
                        return this;
                    },

                    limit: function (numRows) {
                        this._ctx.limit = Math.min(this._ctx.limit, numRows); // For count()
                        addReplayFilter(this._ctx, function () {
                            var rowsLeft = numRows;
                            return function (cursor, advance, resolve) {
                                if (--rowsLeft <= 0) advance(resolve); // Stop after this item has been included
                                return rowsLeft >= 0; // If numRows is already below 0, return false because then 0 was passed to numRows initially. Otherwise we wouldnt come here.
                            };
                        }, true);
                        return this;
                    },

                    until: function (filterFunction, bIncludeStopEntry) {
                        var ctx = this._ctx;
                        fake && filterFunction(getInstanceTemplate(ctx));
                        addFilter(this._ctx, function (cursor, advance, resolve) {
                            if (filterFunction(cursor.value)) {
                                advance(resolve);
                                return bIncludeStopEntry;
                            } else {
                                return true;
                            }
                        });
                        return this;
                    },

                    first: function (cb) {
                        return this.limit(1).toArray(function (a) {
                            return a[0];
                        }).then(cb);
                    },

                    last: function (cb) {
                        return this.reverse().first(cb);
                    },

                    filter: function (filterFunction) {
                        /// <param name="jsFunctionFilter" type="Function">function(val){return true/false}</param>
                        fake && filterFunction(getInstanceTemplate(this._ctx));
                        addFilter(this._ctx, function (cursor) {
                            return filterFunction(cursor.value);
                        });
                        // match filters not used in Dexie.js but can be used by 3rd part libraries to test a
                        // collection for a match without querying DB. Used by Dexie.Observable.
                        addMatchFilter(this._ctx, filterFunction);
                        return this;
                    },

                    and: function (filterFunction) {
                        return this.filter(filterFunction);
                    },

                    or: function (indexName) {
                        return new WhereClause(this._ctx.table, indexName, this);
                    },

                    reverse: function () {
                        this._ctx.dir = this._ctx.dir === "prev" ? "next" : "prev";
                        if (this._ondirectionchange) this._ondirectionchange(this._ctx.dir);
                        return this;
                    },

                    desc: function () {
                        return this.reverse();
                    },

                    eachKey: function (cb) {
                        var ctx = this._ctx;
                        ctx.keysOnly = !ctx.isMatch;
                        return this.each(function (val, cursor) {
                            cb(cursor.key, cursor);
                        });
                    },

                    eachUniqueKey: function (cb) {
                        this._ctx.unique = "unique";
                        return this.eachKey(cb);
                    },

                    eachPrimaryKey: function (cb) {
                        var ctx = this._ctx;
                        ctx.keysOnly = !ctx.isMatch;
                        return this.each(function (val, cursor) {
                            cb(cursor.primaryKey, cursor);
                        });
                    },

                    keys: function (cb) {
                        var ctx = this._ctx;
                        ctx.keysOnly = !ctx.isMatch;
                        var a = [];
                        return this.each(function (item, cursor) {
                            a.push(cursor.key);
                        }).then(function () {
                            return a;
                        }).then(cb);
                    },

                    primaryKeys: function (cb) {
                        var ctx = this._ctx;
                        if (hasGetAll && ctx.dir === 'next' && isPlainKeyRange(ctx, true) && ctx.limit > 0) {
                            // Special optimation if we could use IDBObjectStore.getAllKeys() or
                            // IDBKeyRange.getAllKeys():
                            return this._read(function (resolve, reject, idbstore) {
                                var idxOrStore = getIndexOrStore(ctx, idbstore);
                                var req = ctx.limit < Infinity ? idxOrStore.getAllKeys(ctx.range, ctx.limit) : idxOrStore.getAllKeys(ctx.range);
                                req.onerror = eventRejectHandler(reject);
                                req.onsuccess = eventSuccessHandler(resolve);
                            }).then(cb);
                        }
                        ctx.keysOnly = !ctx.isMatch;
                        var a = [];
                        return this.each(function (item, cursor) {
                            a.push(cursor.primaryKey);
                        }).then(function () {
                            return a;
                        }).then(cb);
                    },

                    uniqueKeys: function (cb) {
                        this._ctx.unique = "unique";
                        return this.keys(cb);
                    },

                    firstKey: function (cb) {
                        return this.limit(1).keys(function (a) {
                            return a[0];
                        }).then(cb);
                    },

                    lastKey: function (cb) {
                        return this.reverse().firstKey(cb);
                    },

                    distinct: function () {
                        var ctx = this._ctx,
                            idx = ctx.index && ctx.table.schema.idxByName[ctx.index];
                        if (!idx || !idx.multi) return this; // distinct() only makes differencies on multiEntry indexes.
                        var set = {};
                        addFilter(this._ctx, function (cursor) {
                            var strKey = cursor.primaryKey.toString(); // Converts any Date to String, String to String, Number to String and Array to comma-separated string
                            var found = hasOwn(set, strKey);
                            set[strKey] = true;
                            return !found;
                        });
                        return this;
                    }
                };
            });

            //
            //
            // WriteableCollection Class
            //
            //
            function WriteableCollection() {
                Collection.apply(this, arguments);
            }

            derive(WriteableCollection).from(Collection).extend({

                //
                // WriteableCollection Public Methods
                //

                modify: function (changes) {
                    var self = this,
                        ctx = this._ctx,
                        hook = ctx.table.hook,
                        updatingHook = hook.updating.fire,
                        deletingHook = hook.deleting.fire;

                    fake && typeof changes === 'function' && changes.call({ value: ctx.table.schema.instanceTemplate }, ctx.table.schema.instanceTemplate);

                    return this._write(function (resolve, reject, idbstore, trans) {
                        var modifyer;
                        if (typeof changes === 'function') {
                            // Changes is a function that may update, add or delete propterties or even require a deletion the object itself (delete this.item)
                            if (updatingHook === nop && deletingHook === nop) {
                                // Noone cares about what is being changed. Just let the modifier function be the given argument as is.
                                modifyer = changes;
                            } else {
                                // People want to know exactly what is being modified or deleted.
                                // Let modifyer be a proxy function that finds out what changes the caller is actually doing
                                // and call the hooks accordingly!
                                modifyer = function (item) {
                                    var origItem = deepClone(item); // Clone the item first so we can compare laters.
                                    if (changes.call(this, item, this) === false) return false; // Call the real modifyer function (If it returns false explicitely, it means it dont want to modify anyting on this object)
                                    if (!hasOwn(this, "value")) {
                                        // The real modifyer function requests a deletion of the object. Inform the deletingHook that a deletion is taking place.
                                        deletingHook.call(this, this.primKey, item, trans);
                                    } else {
                                        // No deletion. Check what was changed
                                        var objectDiff = getObjectDiff(origItem, this.value);
                                        var additionalChanges = updatingHook.call(this, objectDiff, this.primKey, origItem, trans);
                                        if (additionalChanges) {
                                            // Hook want to apply additional modifications. Make sure to fullfill the will of the hook.
                                            item = this.value;
                                            keys(additionalChanges).forEach(function (keyPath) {
                                                setByKeyPath(item, keyPath, additionalChanges[keyPath]); // Adding {keyPath: undefined} means that the keyPath should be deleted. Handled by setByKeyPath
                                            });
                                        }
                                    }
                                };
                            }
                        } else if (updatingHook === nop) {
                            // changes is a set of {keyPath: value} and no one is listening to the updating hook.
                            var keyPaths = keys(changes);
                            var numKeys = keyPaths.length;
                            modifyer = function (item) {
                                var anythingModified = false;
                                for (var i = 0; i < numKeys; ++i) {
                                    var keyPath = keyPaths[i],
                                        val = changes[keyPath];
                                    if (getByKeyPath(item, keyPath) !== val) {
                                        setByKeyPath(item, keyPath, val); // Adding {keyPath: undefined} means that the keyPath should be deleted. Handled by setByKeyPath
                                        anythingModified = true;
                                    }
                                }
                                return anythingModified;
                            };
                        } else {
                            // changes is a set of {keyPath: value} and people are listening to the updating hook so we need to call it and
                            // allow it to add additional modifications to make.
                            var origChanges = changes;
                            changes = shallowClone(origChanges); // Let's work with a clone of the changes keyPath/value set so that we can restore it in case a hook extends it.
                            modifyer = function (item) {
                                var anythingModified = false;
                                var additionalChanges = updatingHook.call(this, changes, this.primKey, deepClone(item), trans);
                                if (additionalChanges) extend(changes, additionalChanges);
                                keys(changes).forEach(function (keyPath) {
                                    var val = changes[keyPath];
                                    if (getByKeyPath(item, keyPath) !== val) {
                                        setByKeyPath(item, keyPath, val);
                                        anythingModified = true;
                                    }
                                });
                                if (additionalChanges) changes = shallowClone(origChanges); // Restore original changes for next iteration
                                return anythingModified;
                            };
                        }

                        var count = 0;
                        var successCount = 0;
                        var iterationComplete = false;
                        var failures = [];
                        var failKeys = [];
                        var currentKey = null;

                        function modifyItem(item, cursor) {
                            currentKey = cursor.primaryKey;
                            var thisContext = {
                                primKey: cursor.primaryKey,
                                value: item,
                                onsuccess: null,
                                onerror: null
                            };

                            function onerror(e) {
                                failures.push(e);
                                failKeys.push(thisContext.primKey);
                                checkFinished();
                                return true; // Catch these errors and let a final rejection decide whether or not to abort entire transaction
                            }

                            if (modifyer.call(thisContext, item, thisContext) !== false) {
                                // If a callback explicitely returns false, do not perform the update!
                                var bDelete = !hasOwn(thisContext, "value");
                                ++count;
                                tryCatch(function () {
                                    var req = bDelete ? cursor.delete() : cursor.update(thisContext.value);
                                    req._hookCtx = thisContext;
                                    req.onerror = hookedEventRejectHandler(onerror);
                                    req.onsuccess = hookedEventSuccessHandler(function () {
                                        ++successCount;
                                        checkFinished();
                                    });
                                }, onerror);
                            } else if (thisContext.onsuccess) {
                                // Hook will expect either onerror or onsuccess to always be called!
                                thisContext.onsuccess(thisContext.value);
                            }
                        }

                        function doReject(e) {
                            if (e) {
                                failures.push(e);
                                failKeys.push(currentKey);
                            }
                            return reject(new ModifyError("Error modifying one or more objects", failures, successCount, failKeys));
                        }

                        function checkFinished() {
                            if (iterationComplete && successCount + failures.length === count) {
                                if (failures.length > 0) doReject();else resolve(successCount);
                            }
                        }
                        self.clone().raw()._iterate(modifyItem, function () {
                            iterationComplete = true;
                            checkFinished();
                        }, doReject, idbstore);
                    });
                },

                'delete': function () {
                    var _this4 = this;

                    var ctx = this._ctx,
                        range = ctx.range,
                        deletingHook = ctx.table.hook.deleting.fire,
                        hasDeleteHook = deletingHook !== nop;
                    if (!hasDeleteHook && isPlainKeyRange(ctx) && (ctx.isPrimKey && !hangsOnDeleteLargeKeyRange || !range)) // if no range, we'll use clear().
                        {
                            // May use IDBObjectStore.delete(IDBKeyRange) in this case (Issue #208)
                            // For chromium, this is the way most optimized version.
                            // For IE/Edge, this could hang the indexedDB engine and make operating system instable
                            // (https://gist.github.com/dfahlander/5a39328f029de18222cf2125d56c38f7)
                            return this._write(function (resolve, reject, idbstore) {
                                // Our API contract is to return a count of deleted items, so we have to count() before delete().
                                var onerror = eventRejectHandler(reject),
                                    countReq = range ? idbstore.count(range) : idbstore.count();
                                countReq.onerror = onerror;
                                countReq.onsuccess = function () {
                                    var count = countReq.result;
                                    tryCatch(function () {
                                        var delReq = range ? idbstore.delete(range) : idbstore.clear();
                                        delReq.onerror = onerror;
                                        delReq.onsuccess = function () {
                                            return resolve(count);
                                        };
                                    }, function (err) {
                                        return reject(err);
                                    });
                                };
                            });
                        }

                    // Default version to use when collection is not a vanilla IDBKeyRange on the primary key.
                    // Divide into chunks to not starve RAM.
                    // If has delete hook, we will have to collect not just keys but also objects, so it will use
                    // more memory and need lower chunk size.
                    var CHUNKSIZE = hasDeleteHook ? 2000 : 10000;

                    return this._write(function (resolve, reject, idbstore, trans) {
                        var totalCount = 0;
                        // Clone collection and change its table and set a limit of CHUNKSIZE on the cloned Collection instance.
                        var collection = _this4.clone({
                            keysOnly: !ctx.isMatch && !hasDeleteHook }) // load just keys (unless filter() or and() or deleteHook has subscribers)
                        .distinct() // In case multiEntry is used, never delete same key twice because resulting count
                        // would become larger than actual delete count.
                        .limit(CHUNKSIZE).raw(); // Don't filter through reading-hooks (like mapped classes etc)

                        var keysOrTuples = [];

                        // We're gonna do things on as many chunks that are needed.
                        // Use recursion of nextChunk function:
                        var nextChunk = function () {
                            return collection.each(hasDeleteHook ? function (val, cursor) {
                                // Somebody subscribes to hook('deleting'). Collect all primary keys and their values,
                                // so that the hook can be called with its values in bulkDelete().
                                keysOrTuples.push([cursor.primaryKey, cursor.value]);
                            } : function (val, cursor) {
                                // No one subscribes to hook('deleting'). Collect only primary keys:
                                keysOrTuples.push(cursor.primaryKey);
                            }).then(function () {
                                // Chromium deletes faster when doing it in sort order.
                                hasDeleteHook ? keysOrTuples.sort(function (a, b) {
                                    return ascending(a[0], b[0]);
                                }) : keysOrTuples.sort(ascending);
                                return bulkDelete(idbstore, trans, keysOrTuples, hasDeleteHook, deletingHook);
                            }).then(function () {
                                var count = keysOrTuples.length;
                                totalCount += count;
                                keysOrTuples = [];
                                return count < CHUNKSIZE ? totalCount : nextChunk();
                            });
                        };

                        resolve(nextChunk());
                    });
                }
            });

            //
            //
            //
            // ------------------------- Help functions ---------------------------
            //
            //
            //

            function lowerVersionFirst(a, b) {
                return a._cfg.version - b._cfg.version;
            }

            function setApiOnPlace(objs, tableNames, mode, dbschema) {
                tableNames.forEach(function (tableName) {
                    var tableInstance = db._tableFactory(mode, dbschema[tableName]);
                    objs.forEach(function (obj) {
                        tableName in obj || (obj[tableName] = tableInstance);
                    });
                });
            }

            function removeTablesApi(objs) {
                objs.forEach(function (obj) {
                    for (var key in obj) {
                        if (obj[key] instanceof Table) delete obj[key];
                    }
                });
            }

            function iterate(req, filter, fn, resolve, reject, valueMapper) {

                // Apply valueMapper (hook('reading') or mappped class)
                var mappedFn = valueMapper ? function (x, c, a) {
                    return fn(valueMapper(x), c, a);
                } : fn;
                // Wrap fn with PSD and microtick stuff from Promise.
                var wrappedFn = wrap(mappedFn, reject);

                if (!req.onerror) req.onerror = eventRejectHandler(reject);
                if (filter) {
                    req.onsuccess = trycatcher(function filter_record() {
                        var cursor = req.result;
                        if (cursor) {
                            var c = function () {
                                cursor.continue();
                            };
                            if (filter(cursor, function (advancer) {
                                c = advancer;
                            }, resolve, reject)) wrappedFn(cursor.value, cursor, function (advancer) {
                                c = advancer;
                            });
                            c();
                        } else {
                            resolve();
                        }
                    }, reject);
                } else {
                    req.onsuccess = trycatcher(function filter_record() {
                        var cursor = req.result;
                        if (cursor) {
                            var c = function () {
                                cursor.continue();
                            };
                            wrappedFn(cursor.value, cursor, function (advancer) {
                                c = advancer;
                            });
                            c();
                        } else {
                            resolve();
                        }
                    }, reject);
                }
            }

            function parseIndexSyntax(indexes) {
                /// <param name="indexes" type="String"></param>
                /// <returns type="Array" elementType="IndexSpec"></returns>
                var rv = [];
                indexes.split(',').forEach(function (index) {
                    index = index.trim();
                    var name = index.replace(/([&*]|\+\+)/g, ""); // Remove "&", "++" and "*"
                    // Let keyPath of "[a+b]" be ["a","b"]:
                    var keyPath = /^\[/.test(name) ? name.match(/^\[(.*)\]$/)[1].split('+') : name;

                    rv.push(new IndexSpec(name, keyPath || null, /\&/.test(index), /\*/.test(index), /\+\+/.test(index), isArray(keyPath), /\./.test(index)));
                });
                return rv;
            }

            function cmp(key1, key2) {
                return indexedDB.cmp(key1, key2);
            }

            function min(a, b) {
                return cmp(a, b) < 0 ? a : b;
            }

            function max(a, b) {
                return cmp(a, b) > 0 ? a : b;
            }

            function ascending(a, b) {
                return indexedDB.cmp(a, b);
            }

            function descending(a, b) {
                return indexedDB.cmp(b, a);
            }

            function simpleCompare(a, b) {
                return a < b ? -1 : a === b ? 0 : 1;
            }

            function simpleCompareReverse(a, b) {
                return a > b ? -1 : a === b ? 0 : 1;
            }

            function combine(filter1, filter2) {
                return filter1 ? filter2 ? function () {
                    return filter1.apply(this, arguments) && filter2.apply(this, arguments);
                } : filter1 : filter2;
            }

            function readGlobalSchema() {
                db.verno = idbdb.version / 10;
                db._dbSchema = globalSchema = {};
                dbStoreNames = slice(idbdb.objectStoreNames, 0);
                if (dbStoreNames.length === 0) return; // Database contains no stores.
                var trans = idbdb.transaction(safariMultiStoreFix(dbStoreNames), 'readonly');
                dbStoreNames.forEach(function (storeName) {
                    var store = trans.objectStore(storeName),
                        keyPath = store.keyPath,
                        dotted = keyPath && typeof keyPath === 'string' && keyPath.indexOf('.') !== -1;
                    var primKey = new IndexSpec(keyPath, keyPath || "", false, false, !!store.autoIncrement, keyPath && typeof keyPath !== 'string', dotted);
                    var indexes = [];
                    for (var j = 0; j < store.indexNames.length; ++j) {
                        var idbindex = store.index(store.indexNames[j]);
                        keyPath = idbindex.keyPath;
                        dotted = keyPath && typeof keyPath === 'string' && keyPath.indexOf('.') !== -1;
                        var index = new IndexSpec(idbindex.name, keyPath, !!idbindex.unique, !!idbindex.multiEntry, false, keyPath && typeof keyPath !== 'string', dotted);
                        indexes.push(index);
                    }
                    globalSchema[storeName] = new TableSchema(storeName, primKey, indexes, {});
                });
                setApiOnPlace([allTables, Transaction.prototype], keys(globalSchema), READWRITE, globalSchema);
            }

            function adjustToExistingIndexNames(schema, idbtrans) {
                /// <summary>
                /// Issue #30 Problem with existing db - adjust to existing index names when migrating from non-dexie db
                /// </summary>
                /// <param name="schema" type="Object">Map between name and TableSchema</param>
                /// <param name="idbtrans" type="IDBTransaction"></param>
                var storeNames = idbtrans.db.objectStoreNames;
                for (var i = 0; i < storeNames.length; ++i) {
                    var storeName = storeNames[i];
                    var store = idbtrans.objectStore(storeName);
                    hasGetAll = 'getAll' in store;
                    for (var j = 0; j < store.indexNames.length; ++j) {
                        var indexName = store.indexNames[j];
                        var keyPath = store.index(indexName).keyPath;
                        var dexieName = typeof keyPath === 'string' ? keyPath : "[" + slice(keyPath).join('+') + "]";
                        if (schema[storeName]) {
                            var indexSpec = schema[storeName].idxByName[dexieName];
                            if (indexSpec) indexSpec.name = indexName;
                        }
                    }
                }
            }

            function fireOnBlocked(ev) {
                db.on("blocked").fire(ev);
                // Workaround (not fully*) for missing "versionchange" event in IE,Edge and Safari:
                connections.filter(function (c) {
                    return c.name === db.name && c !== db && !c._vcFired;
                }).map(function (c) {
                    return c.on("versionchange").fire(ev);
                });
            }

            extend(this, {
                Collection: Collection,
                Table: Table,
                Transaction: Transaction,
                Version: Version,
                WhereClause: WhereClause,
                WriteableCollection: WriteableCollection,
                WriteableTable: WriteableTable
            });

            init();

            addons.forEach(function (fn) {
                fn(db);
            });
        }

        var fakeAutoComplete = function () {}; // Will never be changed. We just fake for the IDE that we change it (see doFakeAutoComplete())
        var fake = false; // Will never be changed. We just fake for the IDE that we change it (see doFakeAutoComplete())

        function parseType(type) {
            if (typeof type === 'function') {
                return new type();
            } else if (isArray(type)) {
                return [parseType(type[0])];
            } else if (type && typeof type === 'object') {
                var rv = {};
                applyStructure(rv, type);
                return rv;
            } else {
                return type;
            }
        }

        function applyStructure(obj, structure) {
            keys(structure).forEach(function (member) {
                var value = parseType(structure[member]);
                obj[member] = value;
            });
            return obj;
        }

        function eventSuccessHandler(done) {
            return function (ev) {
                done(ev.target.result);
            };
        }

        function hookedEventSuccessHandler(resolve) {
            // wrap() is needed when calling hooks because the rare scenario of:
            //  * hook does a db operation that fails immediately (IDB throws exception)
            //    For calling db operations on correct transaction, wrap makes sure to set PSD correctly.
            //    wrap() will also execute in a virtual tick.
            //  * If not wrapped in a virtual tick, direct exception will launch a new physical tick.
            //  * If this was the last event in the bulk, the promise will resolve after a physical tick
            //    and the transaction will have committed already.
            // If no hook, the virtual tick will be executed in the reject()/resolve of the final promise,
            // because it is always marked with _lib = true when created using Transaction._promise().
            return wrap(function (event) {
                var req = event.target,
                    result = req.result,
                    ctx = req._hookCtx,

                // Contains the hook error handler. Put here instead of closure to boost performance.
                hookSuccessHandler = ctx && ctx.onsuccess;
                hookSuccessHandler && hookSuccessHandler(result);
                resolve && resolve(result);
            }, resolve);
        }

        function eventRejectHandler(reject) {
            return function (event) {
                preventDefault(event);
                reject(event.target.error);
                return false;
            };
        }

        function hookedEventRejectHandler(reject) {
            return wrap(function (event) {
                // See comment on hookedEventSuccessHandler() why wrap() is needed only when supporting hooks.

                var req = event.target,
                    err = req.error,
                    ctx = req._hookCtx,

                // Contains the hook error handler. Put here instead of closure to boost performance.
                hookErrorHandler = ctx && ctx.onerror;
                hookErrorHandler && hookErrorHandler(err);
                preventDefault(event);
                reject(err);
                return false;
            });
        }

        function preventDefault(event) {
            if (event.stopPropagation) // IndexedDBShim doesnt support this on Safari 8 and below.
                event.stopPropagation();
            if (event.preventDefault) // IndexedDBShim doesnt support this on Safari 8 and below.
                event.preventDefault();
        }

        function globalDatabaseList(cb) {
            var val,
                localStorage = Dexie.dependencies.localStorage;
            if (!localStorage) return cb([]); // Envs without localStorage support
            try {
                val = JSON.parse(localStorage.getItem('Dexie.DatabaseNames') || "[]");
            } catch (e) {
                val = [];
            }
            if (cb(val)) {
                localStorage.setItem('Dexie.DatabaseNames', JSON.stringify(val));
            }
        }

        function awaitIterator(iterator) {
            var callNext = function (result) {
                return iterator.next(result);
            },
                doThrow = function (error) {
                return iterator.throw(error);
            },
                onSuccess = step(callNext),
                onError = step(doThrow);

            function step(getNext) {
                return function (val) {
                    var next = getNext(val),
                        value = next.value;

                    return next.done ? value : !value || typeof value.then !== 'function' ? isArray(value) ? Promise.all(value).then(onSuccess, onError) : onSuccess(value) : value.then(onSuccess, onError);
                };
            }

            return step(callNext)();
        }

        //
        // IndexSpec struct
        //
        function IndexSpec(name, keyPath, unique, multi, auto, compound, dotted) {
            /// <param name="name" type="String"></param>
            /// <param name="keyPath" type="String"></param>
            /// <param name="unique" type="Boolean"></param>
            /// <param name="multi" type="Boolean"></param>
            /// <param name="auto" type="Boolean"></param>
            /// <param name="compound" type="Boolean"></param>
            /// <param name="dotted" type="Boolean"></param>
            this.name = name;
            this.keyPath = keyPath;
            this.unique = unique;
            this.multi = multi;
            this.auto = auto;
            this.compound = compound;
            this.dotted = dotted;
            var keyPathSrc = typeof keyPath === 'string' ? keyPath : keyPath && '[' + [].join.call(keyPath, '+') + ']';
            this.src = (unique ? '&' : '') + (multi ? '*' : '') + (auto ? "++" : "") + keyPathSrc;
        }

        //
        // TableSchema struct
        //
        function TableSchema(name, primKey, indexes, instanceTemplate) {
            /// <param name="name" type="String"></param>
            /// <param name="primKey" type="IndexSpec"></param>
            /// <param name="indexes" type="Array" elementType="IndexSpec"></param>
            /// <param name="instanceTemplate" type="Object"></param>
            this.name = name;
            this.primKey = primKey || new IndexSpec();
            this.indexes = indexes || [new IndexSpec()];
            this.instanceTemplate = instanceTemplate;
            this.mappedClass = null;
            this.idxByName = arrayToObject(indexes, function (index) {
                return [index.name, index];
            });
        }

        // Used in when defining dependencies later...
        // (If IndexedDBShim is loaded, prefer it before standard indexedDB)
        var idbshim = _global.idbModules && _global.idbModules.shimIndexedDB ? _global.idbModules : {};

        function safariMultiStoreFix(storeNames) {
            return storeNames.length === 1 ? storeNames[0] : storeNames;
        }

        function getNativeGetDatabaseNamesFn(indexedDB) {
            var fn = indexedDB && (indexedDB.getDatabaseNames || indexedDB.webkitGetDatabaseNames);
            return fn && fn.bind(indexedDB);
        }

        // Export Error classes
        props(Dexie, fullNameExceptions); // Dexie.XXXError = class XXXError {...};

        //
        // Static methods and properties
        // 
        props(Dexie, {

            //
            // Static delete() method.
            //
            delete: function (databaseName) {
                var db = new Dexie(databaseName),
                    promise = db.delete();
                promise.onblocked = function (fn) {
                    db.on("blocked", fn);
                    return this;
                };
                return promise;
            },

            //
            // Static exists() method.
            //
            exists: function (name) {
                return new Dexie(name).open().then(function (db) {
                    db.close();
                    return true;
                }).catch(Dexie.NoSuchDatabaseError, function () {
                    return false;
                });
            },

            //
            // Static method for retrieving a list of all existing databases at current host.
            //
            getDatabaseNames: function (cb) {
                return new Promise(function (resolve, reject) {
                    var getDatabaseNames = getNativeGetDatabaseNamesFn(indexedDB);
                    if (getDatabaseNames) {
                        // In case getDatabaseNames() becomes standard, let's prepare to support it:
                        var req = getDatabaseNames();
                        req.onsuccess = function (event) {
                            resolve(slice(event.target.result, 0)); // Converst DOMStringList to Array<String>
                        };
                        req.onerror = eventRejectHandler(reject);
                    } else {
                        globalDatabaseList(function (val) {
                            resolve(val);
                            return false;
                        });
                    }
                }).then(cb);
            },

            defineClass: function (structure) {
                /// <summary>
                ///     Create a javascript constructor based on given template for which properties to expect in the class.
                ///     Any property that is a constructor function will act as a type. So {name: String} will be equal to {name: new String()}.
                /// </summary>
                /// <param name="structure">Helps IDE code completion by knowing the members that objects contain and not just the indexes. Also
                /// know what type each member has. Example: {name: String, emailAddresses: [String], properties: {shoeSize: Number}}</param>

                // Default constructor able to copy given properties into this object.
                function Class(properties) {
                    /// <param name="properties" type="Object" optional="true">Properties to initialize object with.
                    /// </param>
                    properties ? extend(this, properties) : fake && applyStructure(this, structure);
                }
                return Class;
            },

            applyStructure: applyStructure,

            ignoreTransaction: function (scopeFunc) {
                // In case caller is within a transaction but needs to create a separate transaction.
                // Example of usage:
                //
                // Let's say we have a logger function in our app. Other application-logic should be unaware of the
                // logger function and not need to include the 'logentries' table in all transaction it performs.
                // The logging should always be done in a separate transaction and not be dependant on the current
                // running transaction context. Then you could use Dexie.ignoreTransaction() to run code that starts a new transaction.
                //
                //     Dexie.ignoreTransaction(function() {
                //         db.logentries.add(newLogEntry);
                //     });
                //
                // Unless using Dexie.ignoreTransaction(), the above example would try to reuse the current transaction
                // in current Promise-scope.
                //
                // An alternative to Dexie.ignoreTransaction() would be setImmediate() or setTimeout(). The reason we still provide an
                // API for this because
                //  1) The intention of writing the statement could be unclear if using setImmediate() or setTimeout().
                //  2) setTimeout() would wait unnescessary until firing. This is however not the case with setImmediate().
                //  3) setImmediate() is not supported in the ES standard.
                //  4) You might want to keep other PSD state that was set in a parent PSD, such as PSD.letThrough.
                return PSD.trans ? usePSD(PSD.transless, scopeFunc) : // Use the closest parent that was non-transactional.
                scopeFunc(); // No need to change scope because there is no ongoing transaction.
            },

            vip: function (fn) {
                // To be used by subscribers to the on('ready') event.
                // This will let caller through to access DB even when it is blocked while the db.ready() subscribers are firing.
                // This would have worked automatically if we were certain that the Provider was using Dexie.Promise for all asyncronic operations. The promise PSD
                // from the provider.connect() call would then be derived all the way to when provider would call localDatabase.applyChanges(). But since
                // the provider more likely is using non-promise async APIs or other thenable implementations, we cannot assume that.
                // Note that this method is only useful for on('ready') subscribers that is returning a Promise from the event. If not using vip()
                // the database could deadlock since it wont open until the returned Promise is resolved, and any non-VIPed operation started by
                // the caller will not resolve until database is opened.
                return newScope(function () {
                    PSD.letThrough = true; // Make sure we are let through if still blocking db due to onready is firing.
                    return fn();
                });
            },

            async: function (generatorFn) {
                return function () {
                    try {
                        var rv = awaitIterator(generatorFn.apply(this, arguments));
                        if (!rv || typeof rv.then !== 'function') return Promise.resolve(rv);
                        return rv;
                    } catch (e) {
                        return rejection(e);
                    }
                };
            },

            spawn: function (generatorFn, args, thiz) {
                try {
                    var rv = awaitIterator(generatorFn.apply(thiz, args || []));
                    if (!rv || typeof rv.then !== 'function') return Promise.resolve(rv);
                    return rv;
                } catch (e) {
                    return rejection(e);
                }
            },

            // Dexie.currentTransaction property
            currentTransaction: {
                get: function () {
                    return PSD.trans || null;
                }
            },

            // Export our Promise implementation since it can be handy as a standalone Promise implementation
            Promise: Promise,

            // Dexie.debug proptery:
            // Dexie.debug = false
            // Dexie.debug = true
            // Dexie.debug = "dexie" - don't hide dexie's stack frames.
            debug: {
                get: function () {
                    return debug;
                },
                set: function (value) {
                    setDebug(value, value === 'dexie' ? function () {
                        return true;
                    } : dexieStackFrameFilter);
                }
            },

            // Export our derive/extend/override methodology
            derive: derive,
            extend: extend,
            props: props,
            override: override,
            // Export our Events() function - can be handy as a toolkit
            Events: Events,
            events: { get: deprecated(function () {
                    return Events;
                }) }, // Backward compatible lowercase version.
            // Utilities
            getByKeyPath: getByKeyPath,
            setByKeyPath: setByKeyPath,
            delByKeyPath: delByKeyPath,
            shallowClone: shallowClone,
            deepClone: deepClone,
            getObjectDiff: getObjectDiff,
            asap: asap,
            maxKey: maxKey,
            // Addon registry
            addons: [],
            // Global DB connection list
            connections: connections,

            MultiModifyError: exceptions.Modify, // Backward compatibility 0.9.8. Deprecate.
            errnames: errnames,

            // Export other static classes
            IndexSpec: IndexSpec,
            TableSchema: TableSchema,

            //
            // Dependencies
            //
            // These will automatically work in browsers with indexedDB support, or where an indexedDB polyfill has been included.
            //
            // In node.js, however, these properties must be set "manually" before instansiating a new Dexie().
            // For node.js, you need to require indexeddb-js or similar and then set these deps.
            //
            dependencies: {
                // Required:
                indexedDB: idbshim.shimIndexedDB || _global.indexedDB || _global.mozIndexedDB || _global.webkitIndexedDB || _global.msIndexedDB,
                IDBKeyRange: idbshim.IDBKeyRange || _global.IDBKeyRange || _global.webkitIDBKeyRange
            },

            // API Version Number: Type Number, make sure to always set a version number that can be comparable correctly. Example: 0.9, 0.91, 0.92, 1.0, 1.01, 1.1, 1.2, 1.21, etc.
            semVer: DEXIE_VERSION,
            version: DEXIE_VERSION.split('.').map(function (n) {
                return parseInt(n);
            }).reduce(function (p, c, i) {
                return p + c / Math.pow(10, i * 2);
            }),
            fakeAutoComplete: fakeAutoComplete,

            // https://github.com/dfahlander/Dexie.js/issues/186
            // typescript compiler tsc in mode ts-->es5 & commonJS, will expect require() to return
            // x.default. Workaround: Set Dexie.default = Dexie.
            default: Dexie
        });

        tryCatch(function () {
            // Optional dependencies
            // localStorage
            Dexie.dependencies.localStorage = (typeof chrome !== "undefined" && chrome !== null ? chrome.storage : void 0) != null ? null : _global.localStorage;
        });

        // Map DOMErrors and DOMExceptions to corresponding Dexie errors. May change in Dexie v2.0.
        Promise.rejectionMapper = mapError;

        // Fool IDE to improve autocomplete. Tested with Visual Studio 2013 and 2015.
        doFakeAutoComplete(function () {
            Dexie.fakeAutoComplete = fakeAutoComplete = doFakeAutoComplete;
            Dexie.fake = fake = true;
        });

        return Dexie;
    });
    //# sourceMappingURL=dexie.js.map
    ;
    (function (f) {
        if (typeof exports === "object" && typeof module !== "undefined") {
            module.exports = f();
        } else if (typeof define === "function" && define.amd) {
            define('himalaya', [], f);
        } else {
            var g;if (typeof window !== "undefined") {
                g = window;
            } else if (typeof global !== "undefined") {
                g = global;
            } else if (typeof self !== "undefined") {
                g = self;
            } else {
                g = this;
            }g.himalaya = f();
        }
    })(function () {
        var define, module, exports;return function e(t, n, r) {
            function s(o, u) {
                if (!n[o]) {
                    if (!t[o]) {
                        var a = typeof require == "function" && require;if (!u && a) return a(o, !0);if (i) return i(o, !0);var f = new Error("Cannot find module '" + o + "'");throw f.code = "MODULE_NOT_FOUND", f;
                    }var l = n[o] = { exports: {} };t[o][0].call(l.exports, function (e) {
                        var n = t[o][1][e];return s(n ? n : e);
                    }, l, l.exports, e, t, n, r);
                }return n[o].exports;
            }var i = typeof require == "function" && require;for (var o = 0; o < r.length; o++) s(r[o]);return s;
        }({ 1: [function (require, module, exports) {
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });
                exports.startsWith = startsWith;
                exports.endsWith = endsWith;
                exports.stringIncludes = stringIncludes;
                exports.isRealNaN = isRealNaN;
                exports.arrayIncludes = arrayIncludes;
                /*
                  We don't want to include babel-polyfill in our project.
                    - Library authors should be using babel-runtime for non-global polyfilling
                    - Adding babel-polyfill/-runtime increases bundle size significantly
                
                  We will include our polyfill instance methods as regular functions.
                */

                function startsWith(str, searchString, position) {
                    return str.substr(position || 0, searchString.length) === searchString;
                }

                function endsWith(str, searchString, position) {
                    var index = (position || str.length) - searchString.length;
                    var lastIndex = str.lastIndexOf(searchString, index);
                    return lastIndex !== -1 && lastIndex === index;
                }

                function stringIncludes(str, searchString, position) {
                    return str.indexOf(searchString, position || 0) !== -1;
                }

                function isRealNaN(x) {
                    return typeof x === 'number' && isNaN(x);
                }

                function arrayIncludes(array, searchElement, position) {
                    var len = array.length;
                    if (len === 0) return false;

                    var lookupIndex = position | 0;
                    var isNaNElement = isRealNaN(searchElement);
                    var searchIndex = lookupIndex >= 0 ? lookupIndex : len + lookupIndex;
                    while (searchIndex < len) {
                        var element = array[searchIndex++];
                        if (element === searchElement) return true;
                        if (isNaNElement && isRealNaN(element)) return true;
                    }

                    return false;
                }
            }, {}], 2: [function (require, module, exports) {
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });

                var _slicedToArray = function () {
                    function sliceIterator(arr, i) {
                        var _arr = [];var _n = true;var _d = false;var _e = undefined;try {
                            for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
                                _arr.push(_s.value);if (i && _arr.length === i) break;
                            }
                        } catch (err) {
                            _d = true;_e = err;
                        } finally {
                            try {
                                if (!_n && _i["return"]) _i["return"]();
                            } finally {
                                if (_d) throw _e;
                            }
                        }return _arr;
                    }return function (arr, i) {
                        if (Array.isArray(arr)) {
                            return arr;
                        } else if (Symbol.iterator in Object(arr)) {
                            return sliceIterator(arr, i);
                        } else {
                            throw new TypeError("Invalid attempt to destructure non-iterable instance");
                        }
                    };
                }(); /*
                       This format adheres to the v0 ASP spec.
                     */

                exports.default = format;
                exports.capitalize = capitalize;
                exports.camelCase = camelCase;
                exports.castValue = castValue;
                exports.unquote = unquote;
                exports.splitHead = splitHead;
                exports.formatAttributes = formatAttributes;
                exports.formatStyles = formatStyles;

                var _compat = require('../compat');

                function format(nodes) {
                    return nodes.map(function (node) {
                        var type = capitalize(node.type);
                        if (type === 'Element') {
                            var tagName = node.tagName.toLowerCase();
                            var attributes = formatAttributes(node.attributes);
                            var children = format(node.children);
                            return { type: type, tagName: tagName, attributes: attributes, children: children };
                        }

                        return { type: type, content: node.content };
                    });
                }

                function capitalize(str) {
                    return str.charAt(0).toUpperCase() + str.slice(1);
                }

                function camelCase(str) {
                    return str.split('-').reduce(function (str, word) {
                        return str + word.charAt(0).toUpperCase() + word.slice(1);
                    });
                }

                function castValue(str) {
                    if (typeof str !== 'string') return str;
                    if (str === '') return str;
                    var num = +str;
                    if (!isNaN(num)) return num;
                    return str;
                }

                function unquote(str) {
                    var car = str.charAt(0);
                    var end = str.length - 1;
                    var isQuoteStart = car === '"' || car === "'";
                    if (isQuoteStart && car === str.charAt(end)) {
                        return str.slice(1, end);
                    }
                    return str;
                }

                function splitHead(str, sep) {
                    var idx = str.indexOf(sep);
                    if (idx === -1) return [str];
                    return [str.slice(0, idx), str.slice(idx + sep.length)];
                }

                function formatAttributes(attributes) {
                    return attributes.reduce(function (attrs, pair) {
                        var _splitHead = splitHead(pair.trim(), '='),
                            _splitHead2 = _slicedToArray(_splitHead, 2),
                            key = _splitHead2[0],
                            value = _splitHead2[1];

                        value = value ? unquote(value) : key;
                        if (key === 'class') {
                            attrs.className = value.split(' ');
                        } else if (key === 'style') {
                            attrs.style = formatStyles(value);
                        } else if ((0, _compat.startsWith)(key, 'data-')) {
                            attrs.dataset = attrs.dataset || {};
                            var prop = camelCase(key.slice(5));
                            attrs.dataset[prop] = castValue(value);
                        } else {
                            attrs[camelCase(key)] = castValue(value);
                        }
                        return attrs;
                    }, {});
                }

                function formatStyles(str) {
                    return str.trim().split(';').map(function (rule) {
                        return rule.trim().split(':');
                    }).reduce(function (styles, keyValue) {
                        var _keyValue = _slicedToArray(keyValue, 2),
                            rawKey = _keyValue[0],
                            rawValue = _keyValue[1];

                        if (rawValue) {
                            var key = camelCase(rawKey.trim());
                            var value = castValue(rawValue.trim());
                            styles[key] = value;
                        }
                        return styles;
                    }, {});
                }
            }, { "../compat": 1 }], 3: [function (require, module, exports) {
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });
                exports.parseDefaults = undefined;
                exports.parse = parse;

                var _lexer = require('./lexer');

                var _lexer2 = _interopRequireDefault(_lexer);

                var _parser = require('./parser');

                var _parser2 = _interopRequireDefault(_parser);

                var _v = require('./formats/v0');

                var _v2 = _interopRequireDefault(_v);

                function _interopRequireDefault(obj) {
                    return obj && obj.__esModule ? obj : { default: obj };
                }

                /*
                  Tags which contain arbitrary non-parsed content
                  For example: <script> JavaScript should not be parsed
                */
                var childlessTags = ['style', 'script', 'template'];

                /*
                  Tags which auto-close because they cannot be nested
                  For example: <p>Outer<p>Inner is <p>Outer</p><p>Inner</p>
                */
                var closingTags = ['html', 'head', 'body', 'p', 'dt', 'dd', 'li', 'option', 'thead', 'th', 'tbody', 'tr', 'td', 'tfoot', 'colgroup'];

                /*
                  Closing tags which have ancestor tags which
                  may exist within them which prevent the
                  closing tag from auto-closing.
                  For example: in <li><ul><li></ul></li>,
                  the top-level <li> should not auto-close.
                */
                var closingTagAncestorBreakers = {
                    li: ['ul', 'ol', 'menu'],
                    dt: ['dl'],
                    dd: ['dl']
                };

                /*
                  Tags which do not need the closing tag
                  For example: <img> does not need </img>
                */
                var voidTags = ['!doctype', 'area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

                var parseDefaults = exports.parseDefaults = {
                    voidTags: voidTags,
                    closingTags: closingTags,
                    closingTagAncestorBreakers: closingTagAncestorBreakers,
                    childlessTags: childlessTags,
                    format: _v2.default // transform for v0 spec
                };

                function parse(str) {
                    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : parseDefaults;

                    var tokens = (0, _lexer2.default)(str, options);
                    var nodes = (0, _parser2.default)(tokens, options);
                    return (0, _v2.default)(nodes, options);
                }

                exports.default = { parse: parse, parseDefaults: parseDefaults };
            }, { "./formats/v0": 2, "./lexer": 4, "./parser": 5 }], 4: [function (require, module, exports) {
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });
                exports.default = lexer;
                exports.lex = lex;
                exports.lexText = lexText;
                exports.lexComment = lexComment;
                exports.lexTag = lexTag;
                exports.isWhitespaceChar = isWhitespaceChar;
                exports.lexTagName = lexTagName;
                exports.lexTagAttributes = lexTagAttributes;
                exports.lexSkipTag = lexSkipTag;

                var _compat = require('./compat');

                function _toConsumableArray(arr) {
                    if (Array.isArray(arr)) {
                        for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
                            arr2[i] = arr[i];
                        }return arr2;
                    } else {
                        return Array.from(arr);
                    }
                }

                function lexer(str, options) {
                    var state = { str: str, options: options, cursor: 0, tokens: [] };
                    lex(state);
                    return state.tokens;
                }

                function lex(state) {
                    var str = state.str;

                    var len = str.length;
                    while (state.cursor < len) {
                        var isText = str.charAt(state.cursor) !== '<';
                        if (isText) {
                            lexText(state);
                            continue;
                        }

                        var isComment = (0, _compat.startsWith)(str, '!--', state.cursor + 1);
                        if (isComment) {
                            lexComment(state);
                            continue;
                        }

                        var tagName = lexTag(state);
                        if (tagName) {
                            var safeTag = tagName.toLowerCase();
                            var childlessTags = state.options.childlessTags;

                            if ((0, _compat.arrayIncludes)(childlessTags, safeTag)) {
                                lexSkipTag(tagName, state);
                            }
                        }
                    }
                }

                function lexText(state) {
                    var str = state.str,
                        cursor = state.cursor;

                    var textEnd = str.indexOf('<', cursor);
                    var type = 'text';
                    if (textEnd === -1) {
                        // there is only text left
                        var _content = str.slice(cursor);
                        state.cursor = str.length;
                        state.tokens.push({ type: type, content: _content });
                        return;
                    }

                    if (textEnd === cursor) return;

                    var content = str.slice(cursor, textEnd);
                    state.cursor = textEnd;
                    state.tokens.push({ type: type, content: content });
                }

                function lexComment(state) {
                    state.cursor += 4; // "<!--".length
                    var str = state.str,
                        cursor = state.cursor;

                    var commentEnd = str.indexOf('-->', cursor);
                    var type = 'comment';
                    if (commentEnd === -1) {
                        // there is only the comment left
                        var _content2 = str.slice(cursor);
                        state.cursor = str.length;
                        state.tokens.push({ type: type, content: _content2 });
                        return;
                    }

                    var content = str.slice(cursor, commentEnd);
                    state.cursor = commentEnd + 3; // "-->".length
                    state.tokens.push({ type: type, content: content });
                }

                function lexTag(state) {
                    var str = state.str;

                    {
                        var secondChar = str.charAt(state.cursor + 1);
                        var close = secondChar === '/';
                        state.tokens.push({ type: 'tag-start', close: close });
                        state.cursor += close ? 2 : 1;
                    }
                    var tagName = lexTagName(state);
                    lexTagAttributes(state);
                    {
                        var firstChar = str.charAt(state.cursor);
                        var _close = firstChar === '/';
                        state.tokens.push({ type: 'tag-end', close: _close });
                        state.cursor += _close ? 2 : 1;
                    }
                    return tagName;
                }

                // There is one regex for whitespace.
                // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#special-white-space
                var whitespace = /\s/;
                function isWhitespaceChar(char) {
                    return whitespace.test(char);
                }

                function lexTagName(state) {
                    var str = state.str,
                        cursor = state.cursor;

                    var len = str.length;
                    var start = cursor;
                    while (start < len) {
                        var char = str.charAt(start);
                        var isTagChar = !(isWhitespaceChar(char) || char === '/' || char === '>');
                        if (isTagChar) break;
                        start++;
                    }

                    var end = start + 1;
                    while (end < len) {
                        var _char = str.charAt(end);
                        var _isTagChar = !(isWhitespaceChar(_char) || _char === '/' || _char === '>');
                        if (!_isTagChar) break;
                        end++;
                    }

                    state.cursor = end;
                    var tagName = str.slice(start, end);
                    state.tokens.push({ type: 'tag', content: tagName });
                    return tagName;
                }

                function lexTagAttributes(state) {
                    var str = state.str,
                        tokens = state.tokens;

                    var cursor = state.cursor;
                    var quote = null; // null, single-, or double-quote
                    var wordBegin = cursor; // index of word start
                    var words = []; // "key", "key=value", "key='value'", etc
                    var len = str.length;
                    while (cursor < len) {
                        var char = str.charAt(cursor);
                        if (quote) {
                            var isQuoteEnd = char === quote;
                            if (isQuoteEnd) {
                                quote = null;
                            }
                            cursor++;
                            continue;
                        }

                        var isTagEnd = char === '/' || char === '>';
                        if (isTagEnd) {
                            if (cursor !== wordBegin) {
                                words.push(str.slice(wordBegin, cursor));
                            }
                            break;
                        }

                        var isWordEnd = isWhitespaceChar(char);
                        if (isWordEnd) {
                            if (cursor !== wordBegin) {
                                words.push(str.slice(wordBegin, cursor));
                            }
                            wordBegin = cursor + 1;
                            cursor++;
                            continue;
                        }

                        var isQuoteStart = char === '\'' || char === '"';
                        if (isQuoteStart) {
                            quote = char;
                            cursor++;
                            continue;
                        }

                        cursor++;
                    }
                    state.cursor = cursor;

                    var wLen = words.length;
                    var type = 'attribute';
                    for (var i = 0; i < wLen; i++) {
                        var word = words[i];
                        if (!(word && word.length)) continue;
                        var isNotPair = word.indexOf('=') === -1;
                        if (isNotPair) {
                            var secondWord = words[i + 1];
                            if (secondWord && (0, _compat.startsWith)(secondWord, '=')) {
                                if (secondWord.length > 1) {
                                    var newWord = word + secondWord;
                                    tokens.push({ type: type, content: newWord });
                                    i += 1;
                                    continue;
                                }
                                var thirdWord = words[i + 2];
                                i += 1;
                                if (thirdWord) {
                                    var _newWord = word + '=' + thirdWord;
                                    tokens.push({ type: type, content: _newWord });
                                    i += 1;
                                    continue;
                                }
                            }
                        }
                        if ((0, _compat.endsWith)(word, '=')) {
                            var _secondWord = words[i + 1];
                            if (_secondWord && !(0, _compat.stringIncludes)(_secondWord, '=')) {
                                var _newWord3 = word + _secondWord;
                                tokens.push({ type: type, content: _newWord3 });
                                i += 1;
                                continue;
                            }

                            var _newWord2 = word.slice(0, -1);
                            tokens.push({ type: type, content: _newWord2 });
                            continue;
                        }

                        tokens.push({ type: type, content: word });
                    }
                }

                function lexSkipTag(tagName, state) {
                    var str = state.str,
                        cursor = state.cursor,
                        tokens = state.tokens;

                    var len = str.length;
                    var index = cursor;
                    while (index < len) {
                        var nextTag = str.indexOf('</', index);
                        if (nextTag === -1) {
                            lexText(state);
                            break;
                        }

                        var tagState = { str: str, cursor: nextTag + 2, tokens: [] };
                        var name = lexTagName(tagState);
                        var safeTagName = tagName.toLowerCase();
                        if (safeTagName !== name.toLowerCase()) {
                            index = tagState.cursor;
                            continue;
                        }

                        var content = str.slice(cursor, nextTag);
                        tokens.push({ type: 'text', content: content });
                        var openTag = { type: 'tag-start', close: true };
                        var closeTag = { type: 'tag-end', close: false };
                        lexTagAttributes(tagState);
                        tokens.push.apply(tokens, [openTag].concat(_toConsumableArray(tagState.tokens), [closeTag]));
                        state.cursor = tagState.cursor + 1;
                        break;
                    }
                }
            }, { "./compat": 1 }], 5: [function (require, module, exports) {
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });
                exports.default = parser;
                exports.hasTerminalParent = hasTerminalParent;
                exports.parse = parse;

                var _compat = require('./compat');

                function parser(tokens, options) {
                    var root = { tagName: null, children: [] };
                    var state = { tokens: tokens, options: options, cursor: 0, stack: [root] };
                    parse(state);
                    return root.children;
                }

                function hasTerminalParent(tagName, stack, terminals) {
                    var tagParents = terminals[tagName];
                    if (tagParents) {
                        var currentIndex = stack.length - 1;
                        while (currentIndex >= 0) {
                            var parentTagName = stack[currentIndex].tagName;
                            if (parentTagName === tagName) {
                                break;
                            }
                            if ((0, _compat.arrayIncludes)(tagParents, parentTagName)) {
                                return true;
                            }
                            currentIndex--;
                        }
                    }
                    return false;
                }

                function parse(state) {
                    var tokens = state.tokens,
                        options = state.options;
                    var stack = state.stack;

                    var nodes = stack[stack.length - 1].children;
                    var len = tokens.length;
                    var cursor = state.cursor;

                    while (cursor < len) {
                        var token = tokens[cursor];
                        if (token.type !== 'tag-start') {
                            nodes.push(token);
                            cursor++;
                            continue;
                        }

                        var tagToken = tokens[++cursor];
                        cursor++;
                        var tagName = tagToken.content.toLowerCase();
                        if (token.close) {
                            var item = void 0;
                            while (item = stack.pop()) {
                                if (tagName === item.tagName) break;
                            }
                            while (cursor < len) {
                                var endToken = tokens[cursor];
                                if (endToken.type !== 'tag-end') break;
                                cursor++;
                            }
                            break;
                        }

                        var isClosingTag = (0, _compat.arrayIncludes)(options.closingTags, tagName);
                        var shouldRewindToAutoClose = isClosingTag;
                        if (shouldRewindToAutoClose) {
                            var terminals = options.closingTagAncestorBreakers;

                            shouldRewindToAutoClose = !hasTerminalParent(tagName, stack, terminals);
                        }

                        if (shouldRewindToAutoClose) {
                            // rewind the stack to just above the previous
                            // closing tag of the same name
                            var currentIndex = stack.length - 1;
                            while (currentIndex > 0) {
                                if (tagName === stack[currentIndex].tagName) {
                                    stack = stack.slice(0, currentIndex);
                                    var previousIndex = currentIndex - 1;
                                    nodes = stack[previousIndex].children;
                                    break;
                                }
                                currentIndex = currentIndex - 1;
                            }
                        }

                        var attributes = [];
                        var attrToken = void 0;
                        while (cursor < len) {
                            attrToken = tokens[cursor];
                            if (attrToken.type === 'tag-end') break;
                            attributes.push(attrToken.content);
                            cursor++;
                        }

                        cursor++;
                        var children = [];
                        nodes.push({
                            type: 'element',
                            tagName: tagToken.content,
                            attributes: attributes,
                            children: children
                        });

                        var hasChildren = !(attrToken.close || (0, _compat.arrayIncludes)(options.voidTags, tagName));
                        if (hasChildren) {
                            stack.push({ tagName: tagName, children: children });
                            var innerState = { tokens: tokens, options: options, cursor: cursor, stack: stack };
                            parse(innerState);
                            cursor = innerState.cursor;
                        }
                    }
                    state.cursor = cursor;
                }
            }, { "./compat": 1 }] }, {}, [3])(3);
    });
    //# sourceMappingURL=himalaya.js.map
    ;

    /*
    * base module
    */
    define('LBase', ["Fiber"], function (Fiber) {

        var LBase = Fiber.extend(function (base) {
            return {
                // The `init` method serves as the constructor.
                init: function (params) {}

            };
        });

        return LBase;
    });
    define('viewUtils', ["Handlebars"], function (Handlebars) {

        return {

            /*
            * 
            */
            renderDomElement: function ($containerSelector, html, renderType, callback, forceImmediateRender) {
                renderType = renderType || 'replace';
                callback = callback || null;
                forceImmediateRender = forceImmediateRender || false;

                //if !currentphatomPage --> make phatntom page, modify, set timeout to put it back into page
                //else add change to currnet phantom page
                //thus, sync changes line up in a queue!

                //problem if container is page??

                //needs to take a callback so that can be sure to happen after dom update

                switch (renderType) {
                    case 'replace':
                        if (_.isObject($containerSelector)) {
                            //jquery obj passed in
                            $containerSelector.html(html);
                        } else {
                            $(containerSelector).html(html);
                        }

                        break;
                }
            }

        };
    });
    define('LLibrary', ["Fiber"], function (Fiber) {

        return Fiber.extend(function (base) {
            return {
                // The `init` method serves as the constructor.
                init: function (params) {
                    this.storage = {}; //in order for this to be an instance var and not on the class, MUST be declared in init!!
                },

                getItem: function (key) {
                    return this.storage[key] || null;
                },

                addMultipleItems: function (itemsMap, overwriteItems) {
                    overwriteItems = overwriteItems || false;

                    _.each(itemsMap, function (item, key) {
                        this.addItem(key, item, overwriteItems);
                    }, this);
                },

                addItem: function (id, item, overwriteItem) {
                    overwriteItem = overwriteItem || false;

                    if (!overwriteItem && this.getItem(id)) {
                        console.error('attempted to register dupe component without overwriteItem=true with id:', id);
                        return;
                    } else if (overwriteItem && this.storage[id] && this.storage[id].destroy) {
                        this.storage[id].destroy();
                    }

                    this.storage[id] = item;
                },

                deleteItem: function (id, itemDestroyAlreadyCalled) {
                    if (!this.storage[id]) {
                        console.warn('attempted to delete non-existent item with id', id);
                        return;
                    }

                    itemDestroyAlreadyCalled = itemDestroyAlreadyCalled || false;

                    if (this.storage[id].destroy && !this.storage[id].isDestroyed && !itemDestroyAlreadyCalled) {
                        this.storage[id].destroy();
                    }

                    delete this.storage[id];
                }

            };
        });
    });
    define('componentInstanceLibrary', ["LLibrary"], function (LLibrary) {

        //makes the component library singleton avaible to the global window.L, or via require
        return {

            ComponentInstanceLibrary: null,

            initializeComponentInstanceLibrary: function () {
                if (this.ComponentInstanceLibrary !== null) {
                    console.warn('ComponentInstanceLibrary singleton already initialized');
                    return;
                }

                this.ComponentInstanceLibrary = new LLibrary();
            },

            getLibrary: function () {
                return this.ComponentInstanceLibrary;
            },

            getComponentInstanceById: function (id) {
                return this.getLibrary() ? this.getLibrary().storage[id] : null;
            },

            registerComponent: function (component, overwriteInstance) {
                var id = component.id;
                overwriteInstance = overwriteInstance || false;

                if (!id) {
                    console.error('attempted to register component without id!');
                    return;
                }

                if (!overwriteInstance && this.ComponentInstanceLibrary.getItem(id)) {
                    console.error('attempted to register dupe component with id:', id);
                    return;
                }

                console.log('***registered component', component);

                this.getLibrary().addItem(id, component, overwriteInstance);
            }

        };
    });
    define('dataSourceLibrary', ["LLibrary"], function (LLibrary) {

        //makes the singleton avaible to the global window.L, or via require
        return {

            DataSourceLibrary: null,

            initializeDataSourceLibrary: function (dataSources) {
                dataSources = dataSources || null;
                if (this.DataSourceLibrary !== null) {
                    console.warn('DataSourceLibrary singleton already initialized');
                    return;
                }

                this.DataSourceLibrary = new LLibrary();

                if (dataSources) {
                    this.getLibrary().addMultipleItems(dataSources, true);
                }
            },

            getLibrary: function () {
                return this.DataSourceLibrary;
            },

            getDataSourceByName: function (name) {
                return this.getLibrary() ? this.getLibrary().storage[name] : null;
            }

        };
    });
    define('objectUtils', [], function () {

        return {

            getDataFromObjectByPath: function (object, path) {
                var nameArray = path.split('.');
                var currentObject = object;

                for (var i = 0; i < nameArray.length; i++) {
                    if (_.isUndefined(currentObject[nameArray[i]])) {
                        currentObject = null;
                        break;
                    } else {
                        currentObject = currentObject[nameArray[i]];
                    }
                }

                return currentObject;
            },

            setDataToObjectByPath: function (object, path, dataToSet) {
                var nameArray = path.split('.');
                var currentObject = object;

                for (var i = 0; i < nameArray.length; i++) {
                    if (i === nameArray.length - 1) {
                        currentObject[nameArray[i]] = dataToSet; //will it work???
                        return;
                    }

                    if (_.isUndefined(currentObject[nameArray[i]])) {
                        currentObject[nameArray[i]] = {};
                    }

                    currentObject = currentObject[nameArray[i]];
                }
            }

        };
    });
    define('uiStringsLibrary', ["LLibrary", "objectUtils"], function (LLibrary, objectUtils) {

        //makes the singleton avaible to the global window.L, or via require
        return {

            UIStringsLibrary: null,

            initializeUIStringsLibrary: function (uiStrings) {
                uiStrings = uiStrings || null;
                if (this.UIStringsLibrary !== null) {
                    console.warn('UIStringsLibrary singleton already initialized');
                    return;
                }

                this.UIStringsLibrary = new LLibrary();

                if (uiStrings) {
                    this.getLibrary().addItem('allUiStrings', uiStrings, true);
                }
            },

            getLibrary: function () {
                return this.UIStringsLibrary;
            },

            getUIStringByKey: function (key) {
                return this.getLibrary() && this.getLibrary().storage.allUiStrings ? objectUtils.getDataFromObjectByPath(this.getLibrary().storage.allUiStrings, key) : null;
            }

        };
    });
    define('templateUtils', ["Handlebars", "uiStringsLibrary", "himalaya"], function (Handlebars, uiStringsLibrary, himalaya) {

        return {

            /*
            * in json object, replace "[[[my.keyname]]]" with the key
            */
            replaceUIStringKeys: function (data) {
                parseIfNeeded(data);
                return data;

                function parseIfNeeded(item, key, curDataObj) {
                    if (_.isString(item)) {
                        if (item.indexOf('[[[') === 0) {
                            //TOOD: make [[[ ]]] a changable constant
                            var parsedVal = parseStringKey(item);

                            if (curDataObj) {
                                curDataObj[key] = parsedVal;
                            } else {
                                //simple string case
                                item = parsedVal;
                            }
                        }
                    } else if (_.isArray(item) || _.isObject(item)) {
                        _.each(item, function (dataItem, key) {
                            parseIfNeeded(dataItem, key, data);
                        });
                    }
                }

                function parseStringKey(str) {
                    return uiStringsLibrary.getUIStringByKey(str.substr(3, str.length - 6));
                }
            },

            compileTemplate: function (templateSource) {
                //clean up "bad" characters from template literals
                templateSource = templateSource.replace(/\t/g, '');
                templateSource = templateSource.replace(/\n/g, '');
                templateSource = templateSource.trim();

                var $templateSource = $('<div>' + templateSource + '</div>');

                _.each($templateSource.find('[data-ui_string]'), function (node) {
                    var $node = $(node);
                    var subValue = uiStringsLibrary.getUIStringByKey($node.data('ui_string'));
                    if (subValue) {
                        $node.text(subValue);
                    }
                });

                var parsedTemplateSource = $templateSource.html();

                return Handlebars.compile(parsedTemplateSource);
            },

            lookUpStringKey: function (key) {
                return uiStringsLibrary.getUIStringByKey(key);
            }

        };
    });
    define('connectorUtils', ["objectUtils", "templateUtils"], function (objectUtils, templateUtils) {

        return {

            processData: function (rawDataFromServer, connector) {
                var objectMap = connector.objectMap;
                var dataFromServer = connector.srcPath ? objectUtils.getDataFromObjectByPath(rawDataFromServer, connector.srcPath) : rawDataFromServer;

                switch (objectMap.dataType) {
                    case 'array':
                        var finalArray = [];

                        for (var i = 0; i < dataFromServer.length; i++) {
                            finalArray.push(this.processDataItem(dataFromServer[i], objectMap.eachChildDefinition));
                        }

                        return finalArray;
                        break;
                    case 'object':
                        //TODO: untested
                        _.each(dataFromServer, function (dataItem) {
                            this.processDataItem(dataItem, objectMap.eachChildDefinition);
                        }, this);

                        return dataFromServer;
                        break;
                    default:
                        console.error('objectmap must have valid dataType. Got:', objectMap.dataType);
                        break;
                }
            },

            processDataItem: function (dataItem, mapDefinition) {
                //null = direct copy
                var data = !mapDefinition || mapDefinition.srcPath === null ? dataItem : objectUtils.getDataFromObjectByPath(dataItem, mapDefinition.srcPath);

                //replace i18n string keys in format "[[[i18n.my.key]]]" as needed
                return templateUtils.replaceUIStringKeys(data);
                //TOOD: deep copy
            }

        };
    });
    define('ajaxRequester', ["jquery", "underscore", "dataSourceLibrary", "connectorUtils", "templateUtils"], function ($, _, dataSourceLibrary, connectorUtils, templateUtils) {

        return {

            createAjaxCallPromise: function (dataSourceName, promiseId, connector, optionsObj) {
                optionsObj = optionsObj || null;
                //look up datasource from library and get options to create the promise
                var dataSourceDefinition = optionsObj ? optionsObj : dataSourceLibrary.getDataSourceByName(dataSourceName);
                promiseId = promiseId || 'unknown'; //TODO: random
                connector = connector || null;

                if (!dataSourceDefinition) {
                    console.error("Cannot make AJAX request; can't find datasource with name:", dataSourceName);
                    return;
                }

                var options = dataSourceDefinition;

                var method = options.method || 'GET';
                var url = options.url;
                var dataTypeReturned = options.dataTypeReturned || 'json';
                var successHandler = options.successHandler || null;
                var afterSuccessCallback = options.afterSuccessCallback || null;
                var doneCallback = options.doneCallback || null;
                var errorHandler = options.errorHandler || $.noop; //N.defaultAjaxErrorHandler;
                var requestParams = options.requestParams || {};
                var jsonToHtmlHandlers = options.jsonToHtmlHandlers || null; //array of classes
                var dataAgreements = options.dataAgreements || null;

                var deferred = $.Deferred();

                $.ajax({
                    type: method,
                    url: url,
                    dataType: dataTypeReturned,
                    data: requestParams
                }).success(function (rawData) {
                    //if we have one or more agreements about what data was expected from the server,
                    //check to see that they have been met
                    // if (dataAgreements && dataAgreements.length) { 
                    //  var failedAgreements = [];

                    //  _.each(dataAgreements, function(dataAgreement) {
                    //    var agreementResult = N.Agreements.testAgreement(dataAgreement, data).doesAgreementPass;

                    //    if (!agreementResult) {
                    //      failedAgreements.push(dataAgreement.name);
                    //    }
                    //  });

                    //  if (failedAgreements.length) {
                    //    console.error('Agreements failed on JSON call!');
                    //    deferred.reject();
                    //    return;
                    //  }
                    //  else {
                    //    console.log('All agreements passed!');
                    //  }
                    // }

                    // if (afterSuccessCallback) {
                    //  afterSuccessCallback(data);
                    // }
                    var processedData = rawData;

                    if (connector) {
                        processedData = connectorUtils.processData(rawData, connector);
                    } else {
                        processedData = templateUtils.replaceUIStringKeys(processedData);
                    }

                    //return the data the server gave us, along with meta-info like the name we gave the promise
                    var returnObj = {
                        promiseId: promiseId,
                        returnedData: processedData,
                        destinationPath: connector ? connector.destinationPath : null
                    };

                    deferred.resolve(returnObj);
                }).error(function () {
                    // errorHandler();
                    deferred.reject();
                });

                return deferred.promise();
            }

        };
    });

    define('connectorLibrary', ["LLibrary"], function (LLibrary) {

        //makes the singleton avaible to the global window.L, or via require
        return {

            ConnectorLibrary: null,

            initializeConnectorLibrary: function (connectors) {
                connectors = connectors || null;
                if (this.ConnectorLibrary !== null) {
                    console.warn('ConnectorLibrary singleton already initialized');
                    return;
                }

                this.ConnectorLibrary = new LLibrary();

                if (connectors) {
                    this.getLibrary().addMultipleItems(connectors, true);
                }
            },

            getLibrary: function () {
                return this.ConnectorLibrary;
            },

            getConnectorByName: function (name) {
                return this.getLibrary() ? this.getLibrary().storage[name] : null;
            }

        };
    });
    /*
    * Root class for LComponents and Lpages
    */
    define('LModule', ["Handlebars", "LBase", "viewUtils", "componentInstanceLibrary", "ajaxRequester", "connectorLibrary", "connectorUtils", "objectUtils", "templateUtils"], function (Handlebars, LBase, viewUtils, componentInstanceLibrary, ajaxRequester, connectorLibrary, connectorUtils, objectUtils, templateUtils) {

        return LBase.extend(function (base) {

            var module = {

                self: this,
                Handlebars: Handlebars,

                // The `init` method serves as the constructor.
                init: function (params) {

                    base.init(params);

                    var template = params.template ? params.template : '\n            <div>\n              <span>DO NOT USE ME</span>\n            </div>\n          ';

                    this.viewParams = params.viewParams || {}; //passed in template inputs

                    this.dataContracts = []; //specifies remote data source(s) and specific ways they should be loaded into this module 

                    //**** TODO: proper model with getters and setters
                    //**** TODO: each one should be associated with passable render method
                    this.data = {//after connector does its work, data is deposited here with predictible names for every instance of a given component 

                    };

                    this.compiledTemplate = templateUtils.compileTemplate(template); //TODO: cache standard templates in a libary
                },

                //Handlebars template
                //overridable via the JSON config of any given instance of the component


                // compiledTemplate: null,

                setData: function (targetPath, data) {
                    //TODO: deep set with dot path
                    this.data[targetPath] = data;
                    this.announceDataChange(targetPath);
                },

                getData: function (targetPath) {
                    //TODO: deep get with dot path
                    // return this.data[targetPath];
                    return objectUtils.getDataFromObjectByPath(this.data, targetPath);
                },

                announceDataChange: function (targetPath) {
                    //TODO: event emitter for data bindings
                },

                /*
                * entry point from scanner.js (or called directly)
                * get any necessary data and do anything else needed before rendering the view to the DOM
                *
                * We cannot use "Phantom DOM" here b/c every component load is async!
                */
                loadComponent: function (targetSelector) {
                    var self = this;

                    /*
                    * Component instantiator gave us one or more data contracts
                    * We must fulfill them before we can render the view
                    * at the end, data will be added to this.processedData
                    * for view data, name will map to 1-N data-data_source_name's in html template
                    */

                    var allPromises = []; //if no promises it resolves immediately

                    for (var i = 0; i < this.dataContracts.length; i++) {
                        var thisContract = this.dataContracts[i];
                        var connector = connectorLibrary.getConnectorByName(thisContract.connector);
                        var promiseId = this.id + '_loadComponent_' + i;
                        var promise = ajaxRequester.createAjaxCallPromise(thisContract.dataSource, promiseId, connector);
                        allPromises.push(promise);
                    }

                    $.when.all(allPromises).then(function (schemas) {
                        //untested assumption: when.all returns schemas in matching order
                        for (var j = 0; j < schemas.length; j++) {
                            self.setData(schemas[j].destinationPath, schemas[j].returnedData);
                        }

                        self.renderView(targetSelector);
                    }, function (e) {
                        console.log("My ajax failed");
                    });
                },

                /*
                *
                */
                renderView: function (targetSelector) {
                    var html = this.compiledTemplate(this.viewParams);

                    viewUtils.renderDomElement(targetSelector, html);
                    this.renderDataIntoBindings();
                },

                renderDataIntoBindings: function () {
                    var $dataBindings = this.$parentSelector.find('[data-data_binding]');

                    _.each($dataBindings, function (dataBinding) {
                        var $dataBindingDOMElement = $(dataBinding);
                        var dataToBeBoundName = $dataBindingDOMElement.data('data_binding');
                        var data = this.getData(dataToBeBoundName);
                        var templateName = $dataBindingDOMElement.data('template_binding');

                        if (!_.isFunction(this[templateName])) {
                            console.error('Template name given is not a valid compiled template function:', templateName);
                            return;
                        }

                        var template = this[templateName];
                        var html = '';

                        if (_.isArray(data)) {
                            for (var i = 0; i < data.length; i++) {
                                html += template(data[i]);
                            }
                        } else {
                            html = template(data);
                        }

                        viewUtils.renderDomElement($dataBindingDOMElement, html);
                    }, this);
                },

                destroy: function () {
                    if (this.$parentSelector) {
                        this.$parentSelector.html('');
                        this.$parentSelector = null; //remove coupling to DOM
                    }

                    this.isDestroyed = true;
                    componentInstanceLibrary.getLibrary().deleteItem(this.id, true);
                }
            };

            return module;
        });
    });

    define('scanner', ["componentInstanceLibrary"], function (componentInstanceLibrary) {

        return {
            scan: function ($target) {
                console.log('SCANNING:', $target);
                var $components = $target.find('[data-lagomorph-component], [data-lc]');

                _.each($components, function (component) {
                    var $component = $(component);

                    //definition must provide at minimum a type and id in the json
                    var compData = $component.data('lagomorph-component'); //jquery converts to object for free


                    if (!_.isObject(compData)) {
                        console.warn('Invalid data JSON for component:', component);
                        return;
                    }

                    var compViewData = compData.viewParams;
                    // var compDataSources = compData.dataSources;

                    var moduleClass = L.componentDefinitions[compViewData.type]; //todo: bad name -- component
                    compViewData.$parentSelector = $component; //todo: bad name -- componentWrapper
                    var moduleInstance = new moduleClass(compData);

                    moduleInstance.loadComponent($component);
                }, this);
            }

        };
    });
    /*
    */
    define('LComponent', ["Handlebars", "LModule", "viewUtils", "componentInstanceLibrary", "ajaxRequester", "connectorLibrary", "connectorUtils", "objectUtils", "templateUtils"], function (Handlebars, LModule, viewUtils, componentInstanceLibrary, ajaxRequester, connectorLibrary, connectorUtils, objectUtils, templateUtils) {

        return LModule.extend(function (base) {

            return {

                init: function (params) {
                    params = params || {};
                    // if (params.template) { //override template per instance when desired!
                    //   this.template = params.template;
                    // }

                    base.init(params);

                    // this.viewData = params.viewData || {};//why???
                    // var compViewData = this.viewData || {};
                    var compDataContracts = params.dataContracts || [];

                    //TODO: add default attrs like unique id, class name etc
                    var id = this.viewParams.id;
                    var type = this.viewParams.type;
                    var $parentSelector = this.viewParams.$parentSelector;

                    if (!id) {
                        console.error('attempted to created component without id!');
                        return;
                    }
                    if (!type) {
                        console.error('attempted to created component without type!');
                        return;
                    }

                    this.id = id;
                    this.type = type;
                    this.$parentSelector = $parentSelector;
                    this.dataContracts = compDataContracts;
                    // this.viewData = compViewData;

                    componentInstanceLibrary.registerComponent(this);
                }

            };
        });
    });

    define('L_List', ["Handlebars", "underscore", "LComponent", "viewUtils", "templateUtils"], function (Handlebars, _, LComponent, viewUtils, templateUtils) {

        return LComponent.extend(function (base) {
            return {
                // The `init` method serves as the constructor.
                init: function (params) {
                    params = params || {};
                    base.init(params);

                    this.template = params.template || '\n            <span data-ui_string="i18n.key1">\n              loading...\n            </span>\n            <ul data-data_binding="listItems" data-template_binding="compiledListItemTemplate">        \n            </ul>\n          ';

                    this.listItemTemplate = params.listItemTemplate || '\n            <li>\n              {{caption}}\n            </li>\n          ';

                    this.data = {
                        listItems: null //expect []
                    };

                    //give it its own template not that of the superclass!!
                    this.compiledTemplate = templateUtils.compileTemplate(this.template); //this.Handlebars.compile(this.template);
                    this.compiledListItemTemplate = templateUtils.compileTemplate(this.listItemTemplate); //this.Handlebars.compile(this.listItemTemplate);
                }

            };
        });
    });
    define('agreementsTester', ["underscore"], function (_) {

        return {

            testAgreement: function (agreement, ajaxResult) {
                var failureMessages = [];

                //see if the main data object is where and what it should be
                var rootObject = this.findObjectAttributeByName(ajaxResult, agreement.objectRoot.path);
                var isRootObjectCorrectType = this.testDataType(rootObject, agreement.objectRoot.dataType);

                if (_.isUndefined(rootObject) || !isRootObjectCorrectType) {
                    failureMessages.push('Root object not found at path' + agreement.objectRoot.path + 'or wrong data type');

                    return {
                        doesAgreementPass: !failureMessages.length,
                        failureMessages: failureMessages
                    };
                }

                if (agreement.objectRoot.dataType === 'array' || agreement.objectRoot.dataType === 'object') {
                    var i = 0;

                    _.each(rootObject, function (rootObjectItem) {
                        //test each one of the data set
                        testObjectStructure(rootObjectItem, agreement.objectRoot.dataItemStructure, i);
                        i++;
                    });
                }
                //TODO: is else case even necessary???

                console.log('failures:', failureMessages);

                return {
                    doesAgreementPass: !failureMessages.length,
                    failureMessages: failureMessages

                    //subfunction - called recursively if object
                    //TODO: test inside of arrays using mock-sub-objects
                };function testObjectStructure(objectToTest, structureToMatch, indexOfItemTested) {
                    _.each(structureToMatch, function (dataTypeToMatchOrSubobject, name) {
                        if (_.isObject(dataTypeToMatchOrSubobject)) {
                            //an actual object, not the name of a data type like others!
                            if (!objectToTest[name]) {
                                //check if subobject exists
                                failureMessages.push('Bad structure: cant find subobject ' + name);
                                return;
                            }

                            testObjectStructure(objectToTest[name], dataTypeToMatchOrSubobject, indexOfItemTested); //will this work on nested objs? maybe
                        } else {
                            var result = this.testDataType(objectToTest[name], dataTypeToMatchOrSubobject);

                            if (!result) {
                                failureMessages.push('Bad structure: ' + objectToTest[name] + ' was expected to be: ' + dataTypeToMatchOrSubobject + ' in tested item ' + indexOfItemTested);
                            }
                        }
                    });
                }
            },

            testDataType: function (dataToTest, dataTypeToMatch) {
                switch (dataTypeToMatch) {
                    case 'string':
                        return _.isString(dataToTest);
                        break;
                    case 'array':
                        return _.isArray(dataToTest);
                        break;
                    case 'object':
                        return _.isObject(dataToTest);
                        break;
                    case 'number':
                        return _.isNumber(dataToTest);
                        break;
                    case 'boolean':
                        return _.isBoolean(dataToTest);
                        break;
                }
            },

            findObjectAttributeByName: function (objToParse, nameString) {
                var nameArray = nameString.split('.');
                var currentObject = objToParse;

                for (var i = 0; i < nameArray.length; i++) {

                    if (typeof currentObject[nameArray[i]] == 'undefined') {
                        currentObject = null;
                        break;
                    } else {
                        currentObject = currentObject[nameArray[i]];
                    }
                }

                return currentObject;
            }

        };
    });

    define('pageClassLibrary', ["LLibrary"], function (LLibrary) {

        //makes the singleton avaible to the global window.L, or via require
        return {

            PageClassLibrary: null,

            initializePageClassLibrary: function () {
                if (this.PageClassLibrary !== null) {
                    console.warn('PageClassLibrary singleton already initialized');
                    return;
                }

                this.PageClassLibrary = new LLibrary();
            },

            getLibrary: function () {
                return this.PageClassLibrary;
            },

            getPageByRoute: function (route) {
                return this.getLibrary() ? this.getLibrary().getItem(route) : null;
            }

        };
    });

    //
    // Generated on Tue Dec 16 2014 12:13:47 GMT+0100 (CET) by Charlie Robbins, Paolo Fragomeni & the Contributors (Using Codesurgeon).
    // Version 1.2.6
    //
    (function (a) {
        function k(a, b, c, d) {
            var e = 0,
                f = 0,
                g = 0,
                c = (c || "(").toString(),
                d = (d || ")").toString(),
                h;for (h = 0; h < a.length; h++) {
                var i = a[h];if (i.indexOf(c, e) > i.indexOf(d, e) || ~i.indexOf(c, e) && !~i.indexOf(d, e) || !~i.indexOf(c, e) && ~i.indexOf(d, e)) {
                    f = i.indexOf(c, e), g = i.indexOf(d, e);if (~f && !~g || !~f && ~g) {
                        var j = a.slice(0, (h || 1) + 1).join(b);a = [j].concat(a.slice((h || 1) + 1));
                    }e = (g > f ? g : f) + 1, h = 0;
                } else e = 0;
            }return a;
        }function j(a, b) {
            var c,
                d = 0,
                e = "";while (c = a.substr(d).match(/[^\w\d\- %@&]*\*[^\w\d\- %@&]*/)) d = c.index + c[0].length, c[0] = c[0].replace(/^\*/, "([_.()!\\ %@&a-zA-Z0-9-]+)"), e += a.substr(0, c.index) + c[0];a = e += a.substr(d);var f = a.match(/:([^\/]+)/ig),
                g,
                h;if (f) {
                h = f.length;for (var j = 0; j < h; j++) g = f[j], g.slice(0, 2) === "::" ? a = g.slice(1) : a = a.replace(g, i(g, b));
            }return a;
        }function i(a, b, c) {
            c = a;for (var d in b) if (b.hasOwnProperty(d)) {
                c = b[d](a);if (c !== a) break;
            }return c === a ? "([._a-zA-Z0-9-%()]+)" : c;
        }function h(a, b, c) {
            if (!a.length) return c();var d = 0;(function e() {
                b(a[d], function (b) {
                    b || b === !1 ? (c(b), c = function () {}) : (d += 1, d === a.length ? c() : e());
                });
            })();
        }function g(a) {
            var b = [];for (var c = 0, d = a.length; c < d; c++) b = b.concat(a[c]);return b;
        }function f(a, b) {
            for (var c = 0; c < a.length; c += 1) if (b(a[c], c, a) === !1) return;
        }function c() {
            return b.hash === "" || b.hash === "#";
        }var b = document.location,
            d = { mode: "modern", hash: b.hash, history: !1, check: function () {
                var a = b.hash;a != this.hash && (this.hash = a, this.onHashChanged());
            }, fire: function () {
                this.mode === "modern" ? this.history === !0 ? window.onpopstate() : window.onhashchange() : this.onHashChanged();
            }, init: function (a, b) {
                function d(a) {
                    for (var b = 0, c = e.listeners.length; b < c; b++) e.listeners[b](a);
                }var c = this;this.history = b, e.listeners || (e.listeners = []);if ("onhashchange" in window && (document.documentMode === undefined || document.documentMode > 7)) this.history === !0 ? setTimeout(function () {
                    window.onpopstate = d;
                }, 500) : window.onhashchange = d, this.mode = "modern";else {
                    var f = document.createElement("iframe");f.id = "state-frame", f.style.display = "none", document.body.appendChild(f), this.writeFrame(""), "onpropertychange" in document && "attachEvent" in document && document.attachEvent("onpropertychange", function () {
                        event.propertyName === "location" && c.check();
                    }), window.setInterval(function () {
                        c.check();
                    }, 50), this.onHashChanged = d, this.mode = "legacy";
                }e.listeners.push(a);return this.mode;
            }, destroy: function (a) {
                if (!!e && !!e.listeners) {
                    var b = e.listeners;for (var c = b.length - 1; c >= 0; c--) b[c] === a && b.splice(c, 1);
                }
            }, setHash: function (a) {
                this.mode === "legacy" && this.writeFrame(a), this.history === !0 ? (window.history.pushState({}, document.title, a), this.fire()) : b.hash = a[0] === "/" ? a : "/" + a;return this;
            }, writeFrame: function (a) {
                var b = document.getElementById("state-frame"),
                    c = b.contentDocument || b.contentWindow.document;c.open(), c.write("<script>_hash = '" + a + "'; onload = parent.listener.syncHash;<script>"), c.close();
            }, syncHash: function () {
                var a = this._hash;a != b.hash && (b.hash = a);return this;
            }, onHashChanged: function () {} },
            e = a.Router = function (a) {
            if (this instanceof e) this.params = {}, this.routes = {}, this.methods = ["on", "once", "after", "before"], this.scope = [], this._methods = {}, this._insert = this.insert, this.insert = this.insertEx, this.historySupport = (window.history != null ? window.history.pushState : null) != null, this.configure(), this.mount(a || {});else return new e(a);
        };e.prototype.init = function (a) {
            var e = this,
                f;this.handler = function (a) {
                var b = a && a.newURL || window.location.hash,
                    c = e.history === !0 ? e.getPath() : b.replace(/.*#/, "");e.dispatch("on", c.charAt(0) === "/" ? c : "/" + c);
            }, d.init(this.handler, this.history), this.history === !1 ? c() && a ? b.hash = a : c() || e.dispatch("on", "/" + b.hash.replace(/^(#\/|#|\/)/, "")) : (this.convert_hash_in_init ? (f = c() && a ? a : c() ? null : b.hash.replace(/^#/, ""), f && window.history.replaceState({}, document.title, f)) : f = this.getPath(), (f || this.run_in_init === !0) && this.handler());return this;
        }, e.prototype.explode = function () {
            var a = this.history === !0 ? this.getPath() : b.hash;a.charAt(1) === "/" && (a = a.slice(1));return a.slice(1, a.length).split("/");
        }, e.prototype.setRoute = function (a, b, c) {
            var e = this.explode();typeof a == "number" && typeof b == "string" ? e[a] = b : typeof c == "string" ? e.splice(a, b, s) : e = [a], d.setHash(e.join("/"));return e;
        }, e.prototype.insertEx = function (a, b, c, d) {
            a === "once" && (a = "on", c = function (a) {
                var b = !1;return function () {
                    if (!b) {
                        b = !0;return a.apply(this, arguments);
                    }
                };
            }(c));return this._insert(a, b, c, d);
        }, e.prototype.getRoute = function (a) {
            var b = a;if (typeof a == "number") b = this.explode()[a];else if (typeof a == "string") {
                var c = this.explode();b = c.indexOf(a);
            } else b = this.explode();return b;
        }, e.prototype.destroy = function () {
            d.destroy(this.handler);return this;
        }, e.prototype.getPath = function () {
            var a = window.location.pathname;a.substr(0, 1) !== "/" && (a = "/" + a);return a;
        };var l = /\?.*/;e.prototype.configure = function (a) {
            a = a || {};for (var b = 0; b < this.methods.length; b++) this._methods[this.methods[b]] = !0;this.recurse = a.recurse || this.recurse || !1, this.async = a.async || !1, this.delimiter = a.delimiter || "/", this.strict = typeof a.strict == "undefined" ? !0 : a.strict, this.notfound = a.notfound, this.resource = a.resource, this.history = a.html5history && this.historySupport || !1, this.run_in_init = this.history === !0 && a.run_handler_in_init !== !1, this.convert_hash_in_init = this.history === !0 && a.convert_hash_in_init !== !1, this.every = { after: a.after || null, before: a.before || null, on: a.on || null };return this;
        }, e.prototype.param = function (a, b) {
            a[0] !== ":" && (a = ":" + a);var c = new RegExp(a, "g");this.params[a] = function (a) {
                return a.replace(c, b.source || b);
            };return this;
        }, e.prototype.on = e.prototype.route = function (a, b, c) {
            var d = this;!c && typeof b == "function" && (c = b, b = a, a = "on");if (Array.isArray(b)) return b.forEach(function (b) {
                d.on(a, b, c);
            });b.source && (b = b.source.replace(/\\\//ig, "/"));if (Array.isArray(a)) return a.forEach(function (a) {
                d.on(a.toLowerCase(), b, c);
            });b = b.split(new RegExp(this.delimiter)), b = k(b, this.delimiter), this.insert(a, this.scope.concat(b), c);
        }, e.prototype.path = function (a, b) {
            var c = this,
                d = this.scope.length;a.source && (a = a.source.replace(/\\\//ig, "/")), a = a.split(new RegExp(this.delimiter)), a = k(a, this.delimiter), this.scope = this.scope.concat(a), b.call(this, this), this.scope.splice(d, a.length);
        }, e.prototype.dispatch = function (a, b, c) {
            function h() {
                d.last = e.after, d.invoke(d.runlist(e), d, c);
            }var d = this,
                e = this.traverse(a, b.replace(l, ""), this.routes, ""),
                f = this._invoked,
                g;this._invoked = !0;if (!e || e.length === 0) {
                this.last = [], typeof this.notfound == "function" && this.invoke([this.notfound], { method: a, path: b }, c);return !1;
            }this.recurse === "forward" && (e = e.reverse()), g = this.every && this.every.after ? [this.every.after].concat(this.last) : [this.last];if (g && g.length > 0 && f) {
                this.async ? this.invoke(g, this, h) : (this.invoke(g, this), h());return !0;
            }h();return !0;
        }, e.prototype.invoke = function (a, b, c) {
            var d = this,
                e;this.async ? (e = function (c, d) {
                if (Array.isArray(c)) return h(c, e, d);typeof c == "function" && c.apply(b, (a.captures || []).concat(d));
            }, h(a, e, function () {
                c && c.apply(b, arguments);
            })) : (e = function (c) {
                if (Array.isArray(c)) return f(c, e);if (typeof c == "function") return c.apply(b, a.captures || []);typeof c == "string" && d.resource && d.resource[c].apply(b, a.captures || []);
            }, f(a, e));
        }, e.prototype.traverse = function (a, b, c, d, e) {
            function l(a) {
                function c(a) {
                    for (var b = a.length - 1; b >= 0; b--) Array.isArray(a[b]) ? (c(a[b]), a[b].length === 0 && a.splice(b, 1)) : e(a[b]) || a.splice(b, 1);
                }function b(a) {
                    var c = [];for (var d = 0; d < a.length; d++) c[d] = Array.isArray(a[d]) ? b(a[d]) : a[d];return c;
                }if (!e) return a;var d = b(a);d.matched = a.matched, d.captures = a.captures, d.after = a.after.filter(e), c(d);return d;
            }var f = [],
                g,
                h,
                i,
                j,
                k;if (b === this.delimiter && c[a]) {
                j = [[c.before, c[a]].filter(Boolean)], j.after = [c.after].filter(Boolean), j.matched = !0, j.captures = [];return l(j);
            }for (var m in c) if (c.hasOwnProperty(m) && (!this._methods[m] || this._methods[m] && typeof c[m] == "object" && !Array.isArray(c[m]))) {
                g = h = d + this.delimiter + m, this.strict || (h += "[" + this.delimiter + "]?"), i = b.match(new RegExp("^" + h));if (!i) continue;if (i[0] && i[0] == b && c[m][a]) {
                    j = [[c[m].before, c[m][a]].filter(Boolean)], j.after = [c[m].after].filter(Boolean), j.matched = !0, j.captures = i.slice(1), this.recurse && c === this.routes && (j.push([c.before, c.on].filter(Boolean)), j.after = j.after.concat([c.after].filter(Boolean)));return l(j);
                }j = this.traverse(a, b, c[m], g);if (j.matched) {
                    j.length > 0 && (f = f.concat(j)), this.recurse && (f.push([c[m].before, c[m].on].filter(Boolean)), j.after = j.after.concat([c[m].after].filter(Boolean)), c === this.routes && (f.push([c.before, c.on].filter(Boolean)), j.after = j.after.concat([c.after].filter(Boolean)))), f.matched = !0, f.captures = j.captures, f.after = j.after;return l(f);
                }
            }return !1;
        }, e.prototype.insert = function (a, b, c, d) {
            var e, f, g, h, i;b = b.filter(function (a) {
                return a && a.length > 0;
            }), d = d || this.routes, i = b.shift(), /\:|\*/.test(i) && !/\\d|\\w/.test(i) && (i = j(i, this.params));if (b.length > 0) {
                d[i] = d[i] || {};return this.insert(a, b, c, d[i]);
            }{
                if (!!i || !!b.length || d !== this.routes) {
                    f = typeof d[i], g = Array.isArray(d[i]);if (d[i] && !g && f == "object") {
                        e = typeof d[i][a];switch (e) {case "function":
                                d[i][a] = [d[i][a], c];return;case "object":
                                d[i][a].push(c);return;case "undefined":
                                d[i][a] = c;return;}
                    } else if (f == "undefined") {
                        h = {}, h[a] = c, d[i] = h;return;
                    }throw new Error("Invalid route context: " + f);
                }e = typeof d[a];switch (e) {case "function":
                        d[a] = [d[a], c];return;case "object":
                        d[a].push(c);return;case "undefined":
                        d[a] = c;return;}
            }
        }, e.prototype.extend = function (a) {
            function e(a) {
                b._methods[a] = !0, b[a] = function () {
                    var c = arguments.length === 1 ? [a, ""] : [a];b.on.apply(b, c.concat(Array.prototype.slice.call(arguments)));
                };
            }var b = this,
                c = a.length,
                d;for (d = 0; d < c; d++) e(a[d]);
        }, e.prototype.runlist = function (a) {
            var b = this.every && this.every.before ? [this.every.before].concat(g(a)) : g(a);this.every && this.every.on && b.push(this.every.on), b.captures = a.captures, b.source = a.source;return b;
        }, e.prototype.mount = function (a, b) {
            function d(b, d) {
                var e = b,
                    f = b.split(c.delimiter),
                    g = typeof a[b],
                    h = f[0] === "" || !c._methods[f[0]],
                    i = h ? "on" : e;h && (e = e.slice((e.match(new RegExp("^" + c.delimiter)) || [""])[0].length), f.shift());h && g === "object" && !Array.isArray(a[b]) ? (d = d.concat(f), c.mount(a[b], d)) : (h && (d = d.concat(e.split(c.delimiter)), d = k(d, c.delimiter)), c.insert(i, d, a[b]));
            }if (!!a && typeof a == "object" && !Array.isArray(a)) {
                var c = this;b = b || [], Array.isArray(b) || (b = b.split(c.delimiter));for (var e in a) a.hasOwnProperty(e) && d(e, b.slice(0));
            }
        };
    })(typeof exports == "object" ? exports : window);
    define("director", function () {});

    /*
    */
    define('LPage', ["Handlebars", "LModule", "viewUtils", "componentInstanceLibrary", "ajaxRequester", "connectorLibrary", "connectorUtils", "objectUtils", "templateUtils", "scanner"], function (Handlebars, LModule, viewUtils, componentInstanceLibrary, ajaxRequester, connectorLibrary, connectorUtils, objectUtils, templateUtils, scanner) {

        return LModule.extend(function (base) {

            return {

                init: function (params) {
                    params = params || {};
                    base.init(params);

                    // if (params.template) { //override template per instance when desired!
                    //   this.template = params.template;
                    // }
                    this.data = params.data || {};

                    this.id = 'page_' + params.id;
                    this.useCachedData = params.useCachedData || false;
                },

                renderPage: function (pageWrapperSelector) {
                    //TODO: optional data caching
                    var $pageWrapperSelector = $(pageWrapperSelector);
                    this.$parentSelector = $pageWrapperSelector; //??/

                    this.loadComponent($pageWrapperSelector);
                    scanner.scan($pageWrapperSelector, this.useCachedData);

                    //TODO: register as current page somewhere global!!
                }

                // "pages": {
                //   "/home": {
                //     "template": "<div>homepage<button data-navlink={'route': '/testpage'}>Navigate</button></div>",
                //     "useCachedData": false
                //   }
                // }


            };
        });
    });

    define('LRouter', ["pageClassLibrary", "LPage"], function (pageClassLibrary, LPage) {

        return {

            pageDefinitions: null, //json

            startRouter: function (pages, homepageName, pageWrapperSelector) {
                this.pageDefinitions = pages;
                this.pageWrapperSelector = pageWrapperSelector;
                this.pageClassLibrary = pageClassLibrary; //needed when this is passed via apply
                this.LPage = LPage;

                var routes = {};
                var self = this;

                _.each(pages, function (pageDef, key) {
                    routes[key] = function () {
                        self.renderPage(key);
                    };
                }, this);

                var router = Router(routes);

                // router.configure({
                //   on: this.renderPage.apply(this)
                // });

                router.init();

                if (!window.location.hash || window.location.hash.length <= 1) {
                    this.navigateToPage(homepageName);
                }
            },

            navigateToPage: function (pageName) {
                var uri = window.location.href.split("#")[0];
                window.location.href = uri + '#' + pageName;
            },

            /*
            * FEATURE: literally zero wait time to load initial html
            * html -> data -> component -> data -> html etc, always bubbles down
            */
            renderPage: function (key) {
                //TODO: if page not found, go back to last one in the history! ??????
                // _.defer(function() { //wait out uri change
                //   debugger;
                var pageKey = key; //window.location.hash.slice(1);
                var pageClass = this.pageClassLibrary.getPageByRoute(pageKey);

                // if (!pageClass) { //TODO: would be nice to re-use classes but won;'t work!!'
                console.log('creating class for page:', pageKey);
                pageClass = new LPage(this.pageDefinitions[pageKey]);

                this.pageClassLibrary.getLibrary().addItem(pageKey, pageClass, true);
                // }

                pageClass.renderPage(this.pageWrapperSelector);
                // });
            }

        };
    });

    // var routes = {
    //         '/author': showAuthorInfo,
    //         '/books': listBooks
    //       };


    /*
    * 
    */
    define('LModel', ["LBase", "objectUtils"], function (LBase, objectUtils) {

        return LBase.extend(function (base) {
            return {
                // The `init` method serves as the constructor.
                init: function (params) {
                    params = params || {};

                    base.init(params);
                    this.values = params.values || {};
                },

                get: function (path) {
                    objectUtils.getDataFromObjectByPath(this.values, path);
                },

                set: function (path, data) {
                    objectUtils.setDataToObjectByPath(this.values, path, data);
                }

            };
        });
    });
    define('DOMModel', ["LModel"], function (LModel) {

        //makes the singleton avaible to the global window.L, or via require
        return {

            DOMModel: null,

            initializeDOMModel: function () {
                if (this.DOMModel !== null) {
                    console.warn('DOMModel singleton already initialized');
                    return;
                }

                this.DOMModel = new LModel();
            },

            getDOMModel: function () {
                return this.DOMModel;
            }

        };
    });
    define('lagomorph', ["jquery", "underscore", "Handlebars", "Fiber", "dexie", "himalaya", "LBase", "LModule", "scanner", "L_List", "componentInstanceLibrary", "viewUtils", "ajaxRequester", "agreementsTester", "dataSourceLibrary", "connectorLibrary", "connectorUtils", "objectUtils", "uiStringsLibrary", "templateUtils", "pageClassLibrary", "director", "LRouter", "LModel", "DOMModel"], function ($, _, Handlebars, Fiber, dexie, himalaya, LBase, LModule, scanner, L_List, componentInstanceLibrary, viewUtils, ajaxRequester, agreementsTester, dataSourceLibrary, connectorLibrary, connectorUtils, objectUtils, uiStringsLibrary, templateUtils, pageClassLibrary, director, LRouter, LModel, DOMModel) {

        var framework = { //anything we want to expose on the window for the end user needs to be added here
            scanner: scanner,
            ajaxRequester: ajaxRequester,
            LBase: LBase,
            LModule: LModule,
            dexie: dexie, //api for indexedDB local storage DB -> http://dexie.org/docs/ 
            himalaya: himalaya, //html to json parser -> https://github.com/andrejewski/himalaya
            $: $,
            _: _,
            Handlebars: Handlebars,
            componentDefinitions: { //all available component classes that come standard with the framework
                L_List: L_List
            }, //todo: move to model
            componentInstanceLibrary: componentInstanceLibrary, //look up instances of components created on the current page/app
            dataSourceLibrary: dataSourceLibrary,
            connectorLibrary: connectorLibrary,
            uiStringsLibrary: uiStringsLibrary,
            connectorUtils: connectorUtils,
            objectUtils: objectUtils,
            pageClassLibrary: pageClassLibrary,
            LRouter: LRouter,
            LModel: LModel,
            DOMModel: DOMModel,

            initialize: function (params) {
                var self = this;

                if (!params.service) {
                    console.error('L.initialize needs a service to set up the app!');
                    return;
                }

                var initPromise = ajaxRequester.createAjaxCallPromise(null, "init", null, params.service);

                $.when(initPromise).done(function (result) {
                    console.log('initializing app with params', result.returnedData);
                    self.start(result.returnedData);
                });
            },

            /*
            * componentConfig = json to instantiate components, in lieu of or addition to that in the html itself
            * dataSources = json config of endpoints, including data contracts of what to expect from the server
            * these could literally be generated into json from an api doc!
            *
            * data from dataSources may be further transformed from the expected server return by a map on the individual componentConfig
            * thus, one endpoint can be used by different components with varying data structures
            *
            * userComponents = custom Lagomorph component classes created by end user (??)
            * i18nDataSource = user-passed internationalization data for use in a "noneolith"
            *
            **/
            start: function (params) {

                var self = this;
                params = params || {};

                if (!params.pageWrapperSelector) {
                    console.warn('Lagomorph started with no pageWrapperSelector');
                }
                if (!params.pages) {
                    console.warn('Lagomorph started with no pages');
                }

                if (!params.initialRoute) {
                    console.warn('Lagomorph started with no initialRoute');
                }
                // if (!params.routeConfig) {
                //   console.warn('Lagomorph started with no routeConfig');
                // }
                if (!params.componentConfig) {
                    console.log('Lagomorph started with no component config');
                }
                if (!params.dataSources) {
                    console.log('Lagomorph started with no dataSources config');
                }
                if (!params.stringData) {
                    console.log('Lagomorph started with no string/i18nDataSource config');
                }

                this.DOMModel.initializeDOMModel();

                this.componentInstanceLibrary.initializeComponentInstanceLibrary(); //model that holds all instances of created components for lookup

                //data source library (server data lookuos)
                this.dataSourceLibrary.initializeDataSourceLibrary(params.dataSources);

                //connector library
                this.connectorLibrary.initializeConnectorLibrary(params.connectors);

                this.pageClassLibrary.initializePageClassLibrary();

                //user-defined components library (class definitions, not instances)
                //created instances are in componentInstanceLibrary


                //string (i18n) library (usually i18n, but could be any lookup for arbitrary text to be displayed in UI)
                this.uiStringsLibrary.initializeUIStringsLibrary(params.stringData);

                var allPromises = []; //add anything that is needed before the initial scan/app start

                if (params.pages && params.pages.dataSourceName) {
                    var connector = this.connectorLibrary.getConnectorByName(params.pages.connectorName);
                    var pagesPromise = ajaxRequester.createAjaxCallPromise(params.pages.dataSourceName, "pages", connector);

                    allPromises.push(pagesPromise);
                }

                //***** Determine which promises need to be resolved before we can actually start the app
                $.when.all(allPromises).then(function (schemas) {
                    for (var i = 0; i < schemas.length; i++) {
                        var promiseId = schemas[i].promiseId;

                        switch (promiseId) {
                            case 'pages':
                                var routerInfo = schemas[i].returnedData;
                                // self.pageLibrary.initializePageLibrary( pageDefinitions );
                                self.LRouter.startRouter(routerInfo.pages, routerInfo.homepage, params.pageWrapperSelector);
                                break;
                        }
                    }

                    //*******when processing is done, load initial page into the pageWrapperSelector
                    //page then users the scanner to scan itself


                    // self.scanner.scan($(params.pageWrapperSelector));
                }, function (e) {
                    console.log("App start failed");
                });

                //       pages: { //just json, can be hardcoded or via endpoint
                //   dataSourceName: "lPages",
                //   pageDefinitions: {}
                // },

            }
        };

        if ($ && $.when.all === undefined) {
            $.when.all = function (deferreds) {
                var deferred = new $.Deferred();
                $.when.apply($, deferreds).then(function () {
                    deferred.resolve(Array.prototype.slice.call(arguments));
                }, function () {
                    deferred.fail(Array.prototype.slice.call(arguments));
                });

                return deferred;
            };
        }

        if (window) {
            window.L = framework; //expose global so require.js is not needed by end user
        }

        return framework;
    });
    //The modules for your project will be inlined above
    //this snippet. Ask almond to synchronously require the
    //module value for 'main' here and return it as the
    //value to use for the public API for the built file.
    return require('lagomorph');
});
