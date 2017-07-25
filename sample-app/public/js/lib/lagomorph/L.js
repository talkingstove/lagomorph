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
    define("handlebars/utils", ["exports"], function (a) {
        "use strict";
        function b(a) {
            return j[a];
        }function c(a) {
            for (var b = 1; b < arguments.length; b++) for (var c in arguments[b]) Object.prototype.hasOwnProperty.call(arguments[b], c) && (a[c] = arguments[b][c]);return a;
        }function d(a, b) {
            for (var c = 0, d = a.length; c < d; c++) if (a[c] === b) return c;return -1;
        }function e(a) {
            if ("string" != typeof a) {
                if (a && a.toHTML) return a.toHTML();if (null == a) return "";if (!a) return a + "";a = "" + a;
            }return l.test(a) ? a.replace(k, b) : a;
        }function f(a) {
            return !a && 0 !== a || !(!o(a) || 0 !== a.length);
        }function g(a) {
            var b = c({}, a);return b._parent = a, b;
        }function h(a, b) {
            return a.path = b, a;
        }function i(a, b) {
            return (a ? a + "." : "") + b;
        }a.__esModule = !0, a.extend = c, a.indexOf = d, a.escapeExpression = e, a.isEmpty = f, a.createFrame = g, a.blockParams = h, a.appendContextPath = i;var j = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;", "`": "&#x60;", "=": "&#x3D;" },
            k = /[&<>"'`=]/g,
            l = /[&<>"'`=]/,
            m = Object.prototype.toString;a.toString = m;var n = function (a) {
            return "function" == typeof a;
        };n(/x/) && (a.isFunction = n = function (a) {
            return "function" == typeof a && "[object Function]" === m.call(a);
        }), a.isFunction = n;var o = Array.isArray || function (a) {
            return !(!a || "object" != typeof a) && "[object Array]" === m.call(a);
        };a.isArray = o;
    }), define("handlebars/exception", ["exports", "module"], function (a, b) {
        "use strict";
        function c(a, b) {
            var e = b && b.loc,
                f = void 0,
                g = void 0;e && (f = e.start.line, g = e.start.column, a += " - " + f + ":" + g);for (var h = Error.prototype.constructor.call(this, a), i = 0; i < d.length; i++) this[d[i]] = h[d[i]];Error.captureStackTrace && Error.captureStackTrace(this, c);try {
                e && (this.lineNumber = f, Object.defineProperty ? Object.defineProperty(this, "column", { value: g, enumerable: !0 }) : this.column = g);
            } catch (j) {}
        }var d = ["description", "fileName", "lineNumber", "message", "name", "number", "stack"];c.prototype = new Error(), b.exports = c;
    }), define("handlebars/helpers/block-helper-missing", ["exports", "module", "../utils"], function (a, b, c) {
        "use strict";
        b.exports = function (a) {
            a.registerHelper("blockHelperMissing", function (b, d) {
                var e = d.inverse,
                    f = d.fn;if (b === !0) return f(this);if (b === !1 || null == b) return e(this);if (c.isArray(b)) return b.length > 0 ? (d.ids && (d.ids = [d.name]), a.helpers.each(b, d)) : e(this);if (d.data && d.ids) {
                    var g = c.createFrame(d.data);g.contextPath = c.appendContextPath(d.data.contextPath, d.name), d = { data: g };
                }return f(b, d);
            });
        };
    }), define("handlebars/helpers/each", ["exports", "module", "../utils", "../exception"], function (a, b, c, d) {
        "use strict";
        function e(a) {
            return a && a.__esModule ? a : { "default": a };
        }var f = e(d);b.exports = function (a) {
            a.registerHelper("each", function (a, b) {
                function d(b, d, f) {
                    j && (j.key = b, j.index = d, j.first = 0 === d, j.last = !!f, k && (j.contextPath = k + b)), i += e(a[b], { data: j, blockParams: c.blockParams([a[b], b], [k + b, null]) });
                }if (!b) throw new f["default"]("Must pass iterator to #each");var e = b.fn,
                    g = b.inverse,
                    h = 0,
                    i = "",
                    j = void 0,
                    k = void 0;if (b.data && b.ids && (k = c.appendContextPath(b.data.contextPath, b.ids[0]) + "."), c.isFunction(a) && (a = a.call(this)), b.data && (j = c.createFrame(b.data)), a && "object" == typeof a) if (c.isArray(a)) for (var l = a.length; h < l; h++) h in a && d(h, h, h === a.length - 1);else {
                    var m = void 0;for (var n in a) a.hasOwnProperty(n) && (void 0 !== m && d(m, h - 1), m = n, h++);void 0 !== m && d(m, h - 1, !0);
                }return 0 === h && (i = g(this)), i;
            });
        };
    }), define("handlebars/helpers/helper-missing", ["exports", "module", "../exception"], function (a, b, c) {
        "use strict";
        function d(a) {
            return a && a.__esModule ? a : { "default": a };
        }var e = d(c);b.exports = function (a) {
            a.registerHelper("helperMissing", function () {
                if (1 !== arguments.length) throw new e["default"]('Missing helper: "' + arguments[arguments.length - 1].name + '"');
            });
        };
    }), define("handlebars/helpers/if", ["exports", "module", "../utils"], function (a, b, c) {
        "use strict";
        b.exports = function (a) {
            a.registerHelper("if", function (a, b) {
                return c.isFunction(a) && (a = a.call(this)), !b.hash.includeZero && !a || c.isEmpty(a) ? b.inverse(this) : b.fn(this);
            }), a.registerHelper("unless", function (b, c) {
                return a.helpers["if"].call(this, b, { fn: c.inverse, inverse: c.fn, hash: c.hash });
            });
        };
    }), define("handlebars/helpers/log", ["exports", "module"], function (a, b) {
        "use strict";
        b.exports = function (a) {
            a.registerHelper("log", function () {
                for (var b = [void 0], c = arguments[arguments.length - 1], d = 0; d < arguments.length - 1; d++) b.push(arguments[d]);var e = 1;null != c.hash.level ? e = c.hash.level : c.data && null != c.data.level && (e = c.data.level), b[0] = e, a.log.apply(a, b);
            });
        };
    }), define("handlebars/helpers/lookup", ["exports", "module"], function (a, b) {
        "use strict";
        b.exports = function (a) {
            a.registerHelper("lookup", function (a, b) {
                return a && a[b];
            });
        };
    }), define("handlebars/helpers/with", ["exports", "module", "../utils"], function (a, b, c) {
        "use strict";
        b.exports = function (a) {
            a.registerHelper("with", function (a, b) {
                c.isFunction(a) && (a = a.call(this));var d = b.fn;if (c.isEmpty(a)) return b.inverse(this);var e = b.data;return b.data && b.ids && (e = c.createFrame(b.data), e.contextPath = c.appendContextPath(b.data.contextPath, b.ids[0])), d(a, { data: e, blockParams: c.blockParams([a], [e && e.contextPath]) });
            });
        };
    }), define("handlebars/helpers", ["exports", "./helpers/block-helper-missing", "./helpers/each", "./helpers/helper-missing", "./helpers/if", "./helpers/log", "./helpers/lookup", "./helpers/with"], function (a, b, c, d, e, f, g, h) {
        "use strict";
        function i(a) {
            return a && a.__esModule ? a : { "default": a };
        }function j(a) {
            k["default"](a), l["default"](a), m["default"](a), n["default"](a), o["default"](a), p["default"](a), q["default"](a);
        }a.__esModule = !0, a.registerDefaultHelpers = j;var k = i(b),
            l = i(c),
            m = i(d),
            n = i(e),
            o = i(f),
            p = i(g),
            q = i(h);
    }), define("handlebars/decorators/inline", ["exports", "module", "../utils"], function (a, b, c) {
        "use strict";
        b.exports = function (a) {
            a.registerDecorator("inline", function (a, b, d, e) {
                var f = a;return b.partials || (b.partials = {}, f = function (e, f) {
                    var g = d.partials;d.partials = c.extend({}, g, b.partials);var h = a(e, f);return d.partials = g, h;
                }), b.partials[e.args[0]] = e.fn, f;
            });
        };
    }), define("handlebars/decorators", ["exports", "./decorators/inline"], function (a, b) {
        "use strict";
        function c(a) {
            return a && a.__esModule ? a : { "default": a };
        }function d(a) {
            e["default"](a);
        }a.__esModule = !0, a.registerDefaultDecorators = d;var e = c(b);
    }), define("handlebars/logger", ["exports", "module", "./utils"], function (a, b, c) {
        "use strict";
        var d = { methodMap: ["debug", "info", "warn", "error"], level: "info", lookupLevel: function (a) {
                if ("string" == typeof a) {
                    var b = c.indexOf(d.methodMap, a.toLowerCase());a = b >= 0 ? b : parseInt(a, 10);
                }return a;
            }, log: function (a) {
                if (a = d.lookupLevel(a), "undefined" != typeof console && d.lookupLevel(d.level) <= a) {
                    var b = d.methodMap[a];console[b] || (b = "log");for (var c = arguments.length, e = Array(c > 1 ? c - 1 : 0), f = 1; f < c; f++) e[f - 1] = arguments[f];console[b].apply(console, e);
                }
            } };b.exports = d;
    }), define("handlebars/base", ["exports", "./utils", "./exception", "./helpers", "./decorators", "./logger"], function (a, b, c, d, e, f) {
        "use strict";
        function g(a) {
            return a && a.__esModule ? a : { "default": a };
        }function h(a, b, c) {
            this.helpers = a || {}, this.partials = b || {}, this.decorators = c || {}, d.registerDefaultHelpers(this), e.registerDefaultDecorators(this);
        }a.__esModule = !0, a.HandlebarsEnvironment = h;var i = g(c),
            j = g(f),
            k = "4.0.10";a.VERSION = k;var l = 7;a.COMPILER_REVISION = l;var m = { 1: "<= 1.0.rc.2", 2: "== 1.0.0-rc.3", 3: "== 1.0.0-rc.4", 4: "== 1.x.x", 5: "== 2.0.0-alpha.x", 6: ">= 2.0.0-beta.1", 7: ">= 4.0.0" };a.REVISION_CHANGES = m;var n = "[object Object]";h.prototype = { constructor: h, logger: j["default"], log: j["default"].log, registerHelper: function (a, c) {
                if (b.toString.call(a) === n) {
                    if (c) throw new i["default"]("Arg not supported with multiple helpers");b.extend(this.helpers, a);
                } else this.helpers[a] = c;
            }, unregisterHelper: function (a) {
                delete this.helpers[a];
            }, registerPartial: function (a, c) {
                if (b.toString.call(a) === n) b.extend(this.partials, a);else {
                    if ("undefined" == typeof c) throw new i["default"]('Attempting to register a partial called "' + a + '" as undefined');this.partials[a] = c;
                }
            }, unregisterPartial: function (a) {
                delete this.partials[a];
            }, registerDecorator: function (a, c) {
                if (b.toString.call(a) === n) {
                    if (c) throw new i["default"]("Arg not supported with multiple decorators");b.extend(this.decorators, a);
                } else this.decorators[a] = c;
            }, unregisterDecorator: function (a) {
                delete this.decorators[a];
            } };var o = j["default"].log;a.log = o, a.createFrame = b.createFrame, a.logger = j["default"];
    }), define("handlebars/safe-string", ["exports", "module"], function (a, b) {
        "use strict";
        function c(a) {
            this.string = a;
        }c.prototype.toString = c.prototype.toHTML = function () {
            return "" + this.string;
        }, b.exports = c;
    }), define("handlebars/runtime", ["exports", "./utils", "./exception", "./base"], function (a, b, c, d) {
        "use strict";
        function e(a) {
            return a && a.__esModule ? a : { "default": a };
        }function f(a) {
            var b = a && a[0] || 1,
                c = d.COMPILER_REVISION;if (b !== c) {
                if (b < c) {
                    var e = d.REVISION_CHANGES[c],
                        f = d.REVISION_CHANGES[b];throw new n["default"]("Template was precompiled with an older version of Handlebars than the current runtime. Please update your precompiler to a newer version (" + e + ") or downgrade your runtime to an older version (" + f + ").");
                }throw new n["default"]("Template was precompiled with a newer version of Handlebars than the current runtime. Please update your runtime to a newer version (" + a[1] + ").");
            }
        }function g(a, c) {
            function d(d, e, f) {
                f.hash && (e = b.extend({}, e, f.hash), f.ids && (f.ids[0] = !0)), d = c.VM.resolvePartial.call(this, d, e, f);var g = c.VM.invokePartial.call(this, d, e, f);if (null == g && c.compile && (f.partials[f.name] = c.compile(d, a.compilerOptions, c), g = f.partials[f.name](e, f)), null != g) {
                    if (f.indent) {
                        for (var h = g.split("\n"), i = 0, j = h.length; i < j && (h[i] || i + 1 !== j); i++) h[i] = f.indent + h[i];g = h.join("\n");
                    }return g;
                }throw new n["default"]("The partial " + f.name + " could not be compiled when running in runtime-only mode");
            }function e(b) {
                function c(b) {
                    return "" + a.main(f, b, f.helpers, f.partials, g, i, h);
                }var d = arguments.length <= 1 || void 0 === arguments[1] ? {} : arguments[1],
                    g = d.data;e._setup(d), !d.partial && a.useData && (g = l(b, g));var h = void 0,
                    i = a.useBlockParams ? [] : void 0;return a.useDepths && (h = d.depths ? b != d.depths[0] ? [b].concat(d.depths) : d.depths : [b]), (c = m(a.main, c, f, d.depths || [], g, i))(b, d);
            }if (!c) throw new n["default"]("No environment passed to template");if (!a || !a.main) throw new n["default"]("Unknown template object: " + typeof a);a.main.decorator = a.main_d, c.VM.checkRevision(a.compiler);var f = { strict: function (a, b) {
                    if (!(b in a)) throw new n["default"]('"' + b + '" not defined in ' + a);return a[b];
                }, lookup: function (a, b) {
                    for (var c = a.length, d = 0; d < c; d++) if (a[d] && null != a[d][b]) return a[d][b];
                }, lambda: function (a, b) {
                    return "function" == typeof a ? a.call(b) : a;
                }, escapeExpression: b.escapeExpression, invokePartial: d, fn: function (b) {
                    var c = a[b];return c.decorator = a[b + "_d"], c;
                }, programs: [], program: function (a, b, c, d, e) {
                    var f = this.programs[a],
                        g = this.fn(a);return b || e || d || c ? f = h(this, a, g, b, c, d, e) : f || (f = this.programs[a] = h(this, a, g)), f;
                }, data: function (a, b) {
                    for (; a && b--;) a = a._parent;return a;
                }, merge: function (a, c) {
                    var d = a || c;return a && c && a !== c && (d = b.extend({}, c, a)), d;
                }, nullContext: Object.seal({}), noop: c.VM.noop, compilerInfo: a.compiler };return e.isTop = !0, e._setup = function (b) {
                b.partial ? (f.helpers = b.helpers, f.partials = b.partials, f.decorators = b.decorators) : (f.helpers = f.merge(b.helpers, c.helpers), a.usePartial && (f.partials = f.merge(b.partials, c.partials)), (a.usePartial || a.useDecorators) && (f.decorators = f.merge(b.decorators, c.decorators)));
            }, e._child = function (b, c, d, e) {
                if (a.useBlockParams && !d) throw new n["default"]("must pass block params");if (a.useDepths && !e) throw new n["default"]("must pass parent depths");return h(f, b, a[b], c, 0, d, e);
            }, e;
        }function h(a, b, c, d, e, f, g) {
            function h(b) {
                var e = arguments.length <= 1 || void 0 === arguments[1] ? {} : arguments[1],
                    h = g;return !g || b == g[0] || b === a.nullContext && null === g[0] || (h = [b].concat(g)), c(a, b, a.helpers, a.partials, e.data || d, f && [e.blockParams].concat(f), h);
            }return h = m(c, h, a, g, d, f), h.program = b, h.depth = g ? g.length : 0, h.blockParams = e || 0, h;
        }function i(a, b, c) {
            return a ? a.call || c.name || (c.name = a, a = c.partials[a]) : a = "@partial-block" === c.name ? c.data["partial-block"] : c.partials[c.name], a;
        }function j(a, c, e) {
            var f = e.data && e.data["partial-block"];e.partial = !0, e.ids && (e.data.contextPath = e.ids[0] || e.data.contextPath);var g = void 0;if (e.fn && e.fn !== k && !function () {
                e.data = d.createFrame(e.data);var a = e.fn;g = e.data["partial-block"] = function (b) {
                    var c = arguments.length <= 1 || void 0 === arguments[1] ? {} : arguments[1];return c.data = d.createFrame(c.data), c.data["partial-block"] = f, a(b, c);
                }, a.partials && (e.partials = b.extend({}, e.partials, a.partials));
            }(), void 0 === a && g && (a = g), void 0 === a) throw new n["default"]("The partial " + e.name + " could not be found");if (a instanceof Function) return a(c, e);
        }function k() {
            return "";
        }function l(a, b) {
            return b && "root" in b || (b = b ? d.createFrame(b) : {}, b.root = a), b;
        }function m(a, c, d, e, f, g) {
            if (a.decorator) {
                var h = {};c = a.decorator(c, h, d, e && e[0], f, g, e), b.extend(c, h);
            }return c;
        }a.__esModule = !0, a.checkRevision = f, a.template = g, a.wrapProgram = h, a.resolvePartial = i, a.invokePartial = j, a.noop = k;var n = e(c);
    }), define("handlebars/no-conflict", ["exports", "module"], function (a, b) {
        "use strict";
        b.exports = function (a) {
            var b = "undefined" != typeof global ? global : window,
                c = b.Handlebars;a.noConflict = function () {
                return b.Handlebars === a && (b.Handlebars = c), a;
            };
        };
    }), define("handlebars.runtime", ["exports", "module", "./handlebars/base", "./handlebars/safe-string", "./handlebars/exception", "./handlebars/utils", "./handlebars/runtime", "./handlebars/no-conflict"], function (a, b, c, d, e, f, g, h) {
        "use strict";
        function i(a) {
            return a && a.__esModule ? a : { "default": a };
        }function j() {
            var a = new c.HandlebarsEnvironment();return f.extend(a, c), a.SafeString = k["default"], a.Exception = l["default"], a.Utils = f, a.escapeExpression = f.escapeExpression, a.VM = g, a.template = function (b) {
                return g.template(b, a);
            }, a;
        }var k = i(d),
            l = i(e),
            m = i(h),
            n = j();n.create = j, m["default"](n), n["default"] = n, b.exports = n;
    }), define("handlebars/compiler/ast", ["exports", "module"], function (a, b) {
        "use strict";
        var c = { helpers: { helperExpression: function (a) {
                    return "SubExpression" === a.type || ("MustacheStatement" === a.type || "BlockStatement" === a.type) && !!(a.params && a.params.length || a.hash);
                }, scopedId: function (a) {
                    return (/^\.|this\b/.test(a.original)
                    );
                }, simpleId: function (a) {
                    return 1 === a.parts.length && !c.helpers.scopedId(a) && !a.depth;
                } } };b.exports = c;
    }), define("handlebars/compiler/parser", ["exports", "module"], function (a, b) {
        "use strict";
        var c = function () {
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
                }, table: [{ 3: 1, 4: 2, 5: [2, 46], 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 1: [3] }, { 5: [1, 4] }, { 5: [2, 2], 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 14: [1, 12], 15: [1, 20], 16: 17, 19: [1, 23], 24: 15, 27: 16, 29: [1, 21], 34: [1, 22], 39: [2, 2], 44: [2, 2], 47: [2, 2], 48: [1, 13], 51: [1, 14], 55: [1, 18], 59: 19, 60: [1, 24] }, { 1: [2, 1] }, { 5: [2, 47], 14: [2, 47], 15: [2, 47], 19: [2, 47], 29: [2, 47], 34: [2, 47], 39: [2, 47], 44: [2, 47], 47: [2, 47], 48: [2, 47], 51: [2, 47], 55: [2, 47], 60: [2, 47] }, { 5: [2, 3], 14: [2, 3], 15: [2, 3], 19: [2, 3], 29: [2, 3], 34: [2, 3], 39: [2, 3], 44: [2, 3], 47: [2, 3], 48: [2, 3], 51: [2, 3], 55: [2, 3], 60: [2, 3] }, { 5: [2, 4], 14: [2, 4], 15: [2, 4], 19: [2, 4], 29: [2, 4], 34: [2, 4], 39: [2, 4], 44: [2, 4], 47: [2, 4], 48: [2, 4], 51: [2, 4], 55: [2, 4], 60: [2, 4] }, { 5: [2, 5], 14: [2, 5], 15: [2, 5], 19: [2, 5], 29: [2, 5], 34: [2, 5], 39: [2, 5], 44: [2, 5], 47: [2, 5], 48: [2, 5], 51: [2, 5], 55: [2, 5], 60: [2, 5] }, { 5: [2, 6], 14: [2, 6], 15: [2, 6], 19: [2, 6], 29: [2, 6], 34: [2, 6], 39: [2, 6], 44: [2, 6], 47: [2, 6], 48: [2, 6], 51: [2, 6], 55: [2, 6], 60: [2, 6] }, { 5: [2, 7], 14: [2, 7], 15: [2, 7], 19: [2, 7], 29: [2, 7], 34: [2, 7], 39: [2, 7], 44: [2, 7], 47: [2, 7], 48: [2, 7], 51: [2, 7], 55: [2, 7], 60: [2, 7] }, { 5: [2, 8], 14: [2, 8], 15: [2, 8], 19: [2, 8], 29: [2, 8], 34: [2, 8], 39: [2, 8], 44: [2, 8], 47: [2, 8], 48: [2, 8], 51: [2, 8], 55: [2, 8], 60: [2, 8] }, { 5: [2, 9], 14: [2, 9], 15: [2, 9], 19: [2, 9], 29: [2, 9], 34: [2, 9], 39: [2, 9], 44: [2, 9], 47: [2, 9], 48: [2, 9], 51: [2, 9], 55: [2, 9], 60: [2, 9] }, { 20: 25, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 36, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 4: 37, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 39: [2, 46], 44: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 4: 38, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 44: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 13: 40, 15: [1, 20], 17: 39 }, { 20: 42, 56: 41, 64: 43, 65: [1, 44], 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 4: 45, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 5: [2, 10], 14: [2, 10], 15: [2, 10], 18: [2, 10], 19: [2, 10], 29: [2, 10], 34: [2, 10], 39: [2, 10], 44: [2, 10], 47: [2, 10], 48: [2, 10], 51: [2, 10], 55: [2, 10], 60: [2, 10] }, { 20: 46, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 47, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 48, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 42, 56: 49, 64: 43, 65: [1, 44], 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 33: [2, 78], 49: 50, 65: [2, 78], 72: [2, 78], 80: [2, 78], 81: [2, 78], 82: [2, 78], 83: [2, 78], 84: [2, 78], 85: [2, 78] }, { 23: [2, 33], 33: [2, 33], 54: [2, 33], 65: [2, 33], 68: [2, 33], 72: [2, 33], 75: [2, 33], 80: [2, 33], 81: [2, 33], 82: [2, 33], 83: [2, 33], 84: [2, 33], 85: [2, 33] }, { 23: [2, 34], 33: [2, 34], 54: [2, 34], 65: [2, 34], 68: [2, 34], 72: [2, 34], 75: [2, 34], 80: [2, 34], 81: [2, 34], 82: [2, 34], 83: [2, 34], 84: [2, 34], 85: [2, 34] }, { 23: [2, 35], 33: [2, 35], 54: [2, 35], 65: [2, 35], 68: [2, 35], 72: [2, 35], 75: [2, 35], 80: [2, 35], 81: [2, 35], 82: [2, 35], 83: [2, 35], 84: [2, 35], 85: [2, 35] }, { 23: [2, 36], 33: [2, 36], 54: [2, 36], 65: [2, 36], 68: [2, 36], 72: [2, 36], 75: [2, 36], 80: [2, 36], 81: [2, 36], 82: [2, 36], 83: [2, 36], 84: [2, 36], 85: [2, 36] }, { 23: [2, 37], 33: [2, 37], 54: [2, 37], 65: [2, 37], 68: [2, 37], 72: [2, 37], 75: [2, 37], 80: [2, 37], 81: [2, 37], 82: [2, 37], 83: [2, 37], 84: [2, 37], 85: [2, 37] }, { 23: [2, 38], 33: [2, 38], 54: [2, 38], 65: [2, 38], 68: [2, 38], 72: [2, 38], 75: [2, 38], 80: [2, 38], 81: [2, 38], 82: [2, 38], 83: [2, 38], 84: [2, 38], 85: [2, 38] }, { 23: [2, 39], 33: [2, 39], 54: [2, 39], 65: [2, 39], 68: [2, 39], 72: [2, 39], 75: [2, 39], 80: [2, 39], 81: [2, 39], 82: [2, 39], 83: [2, 39], 84: [2, 39], 85: [2, 39] }, { 23: [2, 43], 33: [2, 43], 54: [2, 43], 65: [2, 43], 68: [2, 43], 72: [2, 43], 75: [2, 43], 80: [2, 43], 81: [2, 43], 82: [2, 43], 83: [2, 43], 84: [2, 43], 85: [2, 43], 87: [1, 51] }, { 72: [1, 35], 86: 52 }, { 23: [2, 45], 33: [2, 45], 54: [2, 45], 65: [2, 45], 68: [2, 45], 72: [2, 45], 75: [2, 45], 80: [2, 45], 81: [2, 45], 82: [2, 45], 83: [2, 45], 84: [2, 45], 85: [2, 45], 87: [2, 45] }, { 52: 53, 54: [2, 82], 65: [2, 82], 72: [2, 82], 80: [2, 82], 81: [2, 82], 82: [2, 82], 83: [2, 82], 84: [2, 82], 85: [2, 82] }, { 25: 54, 38: 56, 39: [1, 58], 43: 57, 44: [1, 59], 45: 55, 47: [2, 54] }, { 28: 60, 43: 61, 44: [1, 59], 47: [2, 56] }, { 13: 63, 15: [1, 20], 18: [1, 62] }, { 15: [2, 48], 18: [2, 48] }, { 33: [2, 86], 57: 64, 65: [2, 86], 72: [2, 86], 80: [2, 86], 81: [2, 86], 82: [2, 86], 83: [2, 86], 84: [2, 86], 85: [2, 86] }, { 33: [2, 40], 65: [2, 40], 72: [2, 40], 80: [2, 40], 81: [2, 40], 82: [2, 40], 83: [2, 40], 84: [2, 40], 85: [2, 40] }, { 33: [2, 41], 65: [2, 41], 72: [2, 41], 80: [2, 41], 81: [2, 41], 82: [2, 41], 83: [2, 41], 84: [2, 41], 85: [2, 41] }, { 20: 65, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 26: 66, 47: [1, 67] }, { 30: 68, 33: [2, 58], 65: [2, 58], 72: [2, 58], 75: [2, 58], 80: [2, 58], 81: [2, 58], 82: [2, 58], 83: [2, 58], 84: [2, 58], 85: [2, 58] }, { 33: [2, 64], 35: 69, 65: [2, 64], 72: [2, 64], 75: [2, 64], 80: [2, 64], 81: [2, 64], 82: [2, 64], 83: [2, 64], 84: [2, 64], 85: [2, 64] }, { 21: 70, 23: [2, 50], 65: [2, 50], 72: [2, 50], 80: [2, 50], 81: [2, 50], 82: [2, 50], 83: [2, 50], 84: [2, 50], 85: [2, 50] }, { 33: [2, 90], 61: 71, 65: [2, 90], 72: [2, 90], 80: [2, 90], 81: [2, 90], 82: [2, 90], 83: [2, 90], 84: [2, 90], 85: [2, 90] }, { 20: 75, 33: [2, 80], 50: 72, 63: 73, 64: 76, 65: [1, 44], 69: 74, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 72: [1, 80] }, { 23: [2, 42], 33: [2, 42], 54: [2, 42], 65: [2, 42], 68: [2, 42], 72: [2, 42], 75: [2, 42], 80: [2, 42], 81: [2, 42], 82: [2, 42], 83: [2, 42], 84: [2, 42], 85: [2, 42], 87: [1, 51] }, { 20: 75, 53: 81, 54: [2, 84], 63: 82, 64: 76, 65: [1, 44], 69: 83, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 26: 84, 47: [1, 67] }, { 47: [2, 55] }, { 4: 85, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 39: [2, 46], 44: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 47: [2, 20] }, { 20: 86, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 4: 87, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 26: 88, 47: [1, 67] }, { 47: [2, 57] }, { 5: [2, 11], 14: [2, 11], 15: [2, 11], 19: [2, 11], 29: [2, 11], 34: [2, 11], 39: [2, 11], 44: [2, 11], 47: [2, 11], 48: [2, 11], 51: [2, 11], 55: [2, 11], 60: [2, 11] }, { 15: [2, 49], 18: [2, 49] }, { 20: 75, 33: [2, 88], 58: 89, 63: 90, 64: 76, 65: [1, 44], 69: 91, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 65: [2, 94], 66: 92, 68: [2, 94], 72: [2, 94], 80: [2, 94], 81: [2, 94], 82: [2, 94], 83: [2, 94], 84: [2, 94], 85: [2, 94] }, { 5: [2, 25], 14: [2, 25], 15: [2, 25], 19: [2, 25], 29: [2, 25], 34: [2, 25], 39: [2, 25], 44: [2, 25], 47: [2, 25], 48: [2, 25], 51: [2, 25], 55: [2, 25], 60: [2, 25] }, { 20: 93, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 31: 94, 33: [2, 60], 63: 95, 64: 76, 65: [1, 44], 69: 96, 70: 77, 71: 78, 72: [1, 79], 75: [2, 60], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 33: [2, 66], 36: 97, 63: 98, 64: 76, 65: [1, 44], 69: 99, 70: 77, 71: 78, 72: [1, 79], 75: [2, 66], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 22: 100, 23: [2, 52], 63: 101, 64: 76, 65: [1, 44], 69: 102, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 33: [2, 92], 62: 103, 63: 104, 64: 76, 65: [1, 44], 69: 105, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 33: [1, 106] }, { 33: [2, 79], 65: [2, 79], 72: [2, 79], 80: [2, 79], 81: [2, 79], 82: [2, 79], 83: [2, 79], 84: [2, 79], 85: [2, 79] }, { 33: [2, 81] }, { 23: [2, 27], 33: [2, 27], 54: [2, 27], 65: [2, 27], 68: [2, 27], 72: [2, 27], 75: [2, 27], 80: [2, 27], 81: [2, 27], 82: [2, 27], 83: [2, 27], 84: [2, 27], 85: [2, 27] }, { 23: [2, 28], 33: [2, 28], 54: [2, 28], 65: [2, 28], 68: [2, 28], 72: [2, 28], 75: [2, 28], 80: [2, 28], 81: [2, 28], 82: [2, 28], 83: [2, 28], 84: [2, 28], 85: [2, 28] }, { 23: [2, 30], 33: [2, 30], 54: [2, 30], 68: [2, 30], 71: 107, 72: [1, 108], 75: [2, 30] }, { 23: [2, 98], 33: [2, 98], 54: [2, 98], 68: [2, 98], 72: [2, 98], 75: [2, 98] }, { 23: [2, 45], 33: [2, 45], 54: [2, 45], 65: [2, 45], 68: [2, 45], 72: [2, 45], 73: [1, 109], 75: [2, 45], 80: [2, 45], 81: [2, 45], 82: [2, 45], 83: [2, 45], 84: [2, 45], 85: [2, 45], 87: [2, 45] }, { 23: [2, 44], 33: [2, 44], 54: [2, 44], 65: [2, 44], 68: [2, 44], 72: [2, 44], 75: [2, 44], 80: [2, 44], 81: [2, 44], 82: [2, 44], 83: [2, 44], 84: [2, 44], 85: [2, 44], 87: [2, 44] }, { 54: [1, 110] }, { 54: [2, 83], 65: [2, 83], 72: [2, 83], 80: [2, 83], 81: [2, 83], 82: [2, 83], 83: [2, 83], 84: [2, 83], 85: [2, 83] }, { 54: [2, 85] }, { 5: [2, 13], 14: [2, 13], 15: [2, 13], 19: [2, 13], 29: [2, 13], 34: [2, 13], 39: [2, 13], 44: [2, 13], 47: [2, 13], 48: [2, 13], 51: [2, 13], 55: [2, 13], 60: [2, 13] }, { 38: 56, 39: [1, 58], 43: 57, 44: [1, 59], 45: 112, 46: 111, 47: [2, 76] }, { 33: [2, 70], 40: 113, 65: [2, 70], 72: [2, 70], 75: [2, 70], 80: [2, 70], 81: [2, 70], 82: [2, 70], 83: [2, 70], 84: [2, 70], 85: [2, 70] }, { 47: [2, 18] }, { 5: [2, 14], 14: [2, 14], 15: [2, 14], 19: [2, 14], 29: [2, 14], 34: [2, 14], 39: [2, 14], 44: [2, 14], 47: [2, 14], 48: [2, 14], 51: [2, 14], 55: [2, 14], 60: [2, 14] }, { 33: [1, 114] }, { 33: [2, 87], 65: [2, 87], 72: [2, 87], 80: [2, 87], 81: [2, 87], 82: [2, 87], 83: [2, 87], 84: [2, 87], 85: [2, 87] }, { 33: [2, 89] }, { 20: 75, 63: 116, 64: 76, 65: [1, 44], 67: 115, 68: [2, 96], 69: 117, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 33: [1, 118] }, { 32: 119, 33: [2, 62], 74: 120, 75: [1, 121] }, { 33: [2, 59], 65: [2, 59], 72: [2, 59], 75: [2, 59], 80: [2, 59], 81: [2, 59], 82: [2, 59], 83: [2, 59], 84: [2, 59], 85: [2, 59] }, { 33: [2, 61], 75: [2, 61] }, { 33: [2, 68], 37: 122, 74: 123, 75: [1, 121] }, { 33: [2, 65], 65: [2, 65], 72: [2, 65], 75: [2, 65], 80: [2, 65], 81: [2, 65], 82: [2, 65], 83: [2, 65], 84: [2, 65], 85: [2, 65] }, { 33: [2, 67], 75: [2, 67] }, { 23: [1, 124] }, { 23: [2, 51], 65: [2, 51], 72: [2, 51], 80: [2, 51], 81: [2, 51], 82: [2, 51], 83: [2, 51], 84: [2, 51], 85: [2, 51] }, { 23: [2, 53] }, { 33: [1, 125] }, { 33: [2, 91], 65: [2, 91], 72: [2, 91], 80: [2, 91], 81: [2, 91], 82: [2, 91], 83: [2, 91], 84: [2, 91], 85: [2, 91] }, { 33: [2, 93] }, { 5: [2, 22], 14: [2, 22], 15: [2, 22], 19: [2, 22], 29: [2, 22], 34: [2, 22], 39: [2, 22], 44: [2, 22], 47: [2, 22], 48: [2, 22], 51: [2, 22], 55: [2, 22], 60: [2, 22] }, { 23: [2, 99], 33: [2, 99], 54: [2, 99], 68: [2, 99], 72: [2, 99], 75: [2, 99] }, { 73: [1, 109] }, { 20: 75, 63: 126, 64: 76, 65: [1, 44], 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 5: [2, 23], 14: [2, 23], 15: [2, 23], 19: [2, 23], 29: [2, 23], 34: [2, 23], 39: [2, 23], 44: [2, 23], 47: [2, 23], 48: [2, 23], 51: [2, 23], 55: [2, 23], 60: [2, 23] }, { 47: [2, 19] }, { 47: [2, 77] }, { 20: 75, 33: [2, 72], 41: 127, 63: 128, 64: 76, 65: [1, 44], 69: 129, 70: 77, 71: 78, 72: [1, 79], 75: [2, 72], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 5: [2, 24], 14: [2, 24], 15: [2, 24], 19: [2, 24], 29: [2, 24], 34: [2, 24], 39: [2, 24], 44: [2, 24], 47: [2, 24], 48: [2, 24], 51: [2, 24], 55: [2, 24], 60: [2, 24] }, { 68: [1, 130] }, { 65: [2, 95], 68: [2, 95], 72: [2, 95], 80: [2, 95], 81: [2, 95], 82: [2, 95], 83: [2, 95], 84: [2, 95], 85: [2, 95] }, { 68: [2, 97] }, { 5: [2, 21], 14: [2, 21], 15: [2, 21], 19: [2, 21], 29: [2, 21], 34: [2, 21], 39: [2, 21], 44: [2, 21], 47: [2, 21], 48: [2, 21], 51: [2, 21], 55: [2, 21], 60: [2, 21] }, { 33: [1, 131] }, { 33: [2, 63] }, { 72: [1, 133], 76: 132 }, { 33: [1, 134] }, { 33: [2, 69] }, { 15: [2, 12] }, { 14: [2, 26], 15: [2, 26], 19: [2, 26], 29: [2, 26], 34: [2, 26], 47: [2, 26], 48: [2, 26], 51: [2, 26], 55: [2, 26], 60: [2, 26] }, { 23: [2, 31], 33: [2, 31], 54: [2, 31], 68: [2, 31], 72: [2, 31], 75: [2, 31] }, { 33: [2, 74], 42: 135, 74: 136, 75: [1, 121] }, { 33: [2, 71], 65: [2, 71], 72: [2, 71], 75: [2, 71], 80: [2, 71], 81: [2, 71], 82: [2, 71], 83: [2, 71], 84: [2, 71], 85: [2, 71] }, { 33: [2, 73], 75: [2, 73] }, { 23: [2, 29], 33: [2, 29], 54: [2, 29], 65: [2, 29], 68: [2, 29], 72: [2, 29], 75: [2, 29], 80: [2, 29], 81: [2, 29], 82: [2, 29], 83: [2, 29], 84: [2, 29], 85: [2, 29] }, { 14: [2, 15], 15: [2, 15], 19: [2, 15], 29: [2, 15], 34: [2, 15], 39: [2, 15], 44: [2, 15], 47: [2, 15], 48: [2, 15], 51: [2, 15], 55: [2, 15], 60: [2, 15] }, { 72: [1, 138], 77: [1, 137] }, { 72: [2, 100], 77: [2, 100] }, { 14: [2, 16], 15: [2, 16], 19: [2, 16], 29: [2, 16], 34: [2, 16], 44: [2, 16], 47: [2, 16], 48: [2, 16], 51: [2, 16], 55: [2, 16], 60: [2, 16] }, { 33: [1, 139] }, { 33: [2, 75] }, { 33: [2, 32] }, { 72: [2, 101], 77: [2, 101] }, { 14: [2, 17], 15: [2, 17], 19: [2, 17], 29: [2, 17], 34: [2, 17], 39: [2, 17], 44: [2, 17], 47: [2, 17], 48: [2, 17], 51: [2, 17], 55: [2, 17], 60: [2, 17] }], defaultActions: { 4: [2, 1], 55: [2, 55], 57: [2, 20], 61: [2, 57], 74: [2, 81], 83: [2, 85], 87: [2, 18], 91: [2, 89], 102: [2, 53], 105: [2, 93], 111: [2, 19], 112: [2, 77], 117: [2, 97], 120: [2, 63], 123: [2, 69], 124: [2, 12], 136: [2, 75], 137: [2, 32] }, parseError: function (a, b) {
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
        }();b.exports = c;
    }), define("handlebars/compiler/visitor", ["exports", "module", "../exception"], function (a, b, c) {
        "use strict";
        function d(a) {
            return a && a.__esModule ? a : { "default": a };
        }function e() {
            this.parents = [];
        }function f(a) {
            this.acceptRequired(a, "path"), this.acceptArray(a.params), this.acceptKey(a, "hash");
        }function g(a) {
            f.call(this, a), this.acceptKey(a, "program"), this.acceptKey(a, "inverse");
        }function h(a) {
            this.acceptRequired(a, "name"), this.acceptArray(a.params), this.acceptKey(a, "hash");
        }var i = d(c);e.prototype = { constructor: e, mutating: !1, acceptKey: function (a, b) {
                var c = this.accept(a[b]);if (this.mutating) {
                    if (c && !e.prototype[c.type]) throw new i["default"]('Unexpected node type "' + c.type + '" found when accepting ' + b + " on " + a.type);a[b] = c;
                }
            }, acceptRequired: function (a, b) {
                if (this.acceptKey(a, b), !a[b]) throw new i["default"](a.type + " requires " + b);
            }, acceptArray: function (a) {
                for (var b = 0, c = a.length; b < c; b++) this.acceptKey(a, b), a[b] || (a.splice(b, 1), b--, c--);
            }, accept: function (a) {
                if (a) {
                    if (!this[a.type]) throw new i["default"]("Unknown type: " + a.type, a);this.current && this.parents.unshift(this.current), this.current = a;var b = this[a.type](a);return this.current = this.parents.shift(), !this.mutating || b ? b : b !== !1 ? a : void 0;
                }
            }, Program: function (a) {
                this.acceptArray(a.body);
            }, MustacheStatement: f, Decorator: f, BlockStatement: g, DecoratorBlock: g, PartialStatement: h, PartialBlockStatement: function (a) {
                h.call(this, a), this.acceptKey(a, "program");
            }, ContentStatement: function () {}, CommentStatement: function () {}, SubExpression: f, PathExpression: function () {}, StringLiteral: function () {}, NumberLiteral: function () {}, BooleanLiteral: function () {}, UndefinedLiteral: function () {}, NullLiteral: function () {}, Hash: function (a) {
                this.acceptArray(a.pairs);
            }, HashPair: function (a) {
                this.acceptRequired(a, "value");
            } }, b.exports = e;
    }), define("handlebars/compiler/whitespace-control", ["exports", "module", "./visitor"], function (a, b, c) {
        "use strict";
        function d(a) {
            return a && a.__esModule ? a : { "default": a };
        }function e() {
            var a = arguments.length <= 0 || void 0 === arguments[0] ? {} : arguments[0];this.options = a;
        }function f(a, b, c) {
            void 0 === b && (b = a.length);var d = a[b - 1],
                e = a[b - 2];return d ? "ContentStatement" === d.type ? (e || !c ? /\r?\n\s*?$/ : /(^|\r?\n)\s*?$/).test(d.original) : void 0 : c;
        }function g(a, b, c) {
            void 0 === b && (b = -1);var d = a[b + 1],
                e = a[b + 2];return d ? "ContentStatement" === d.type ? (e || !c ? /^\s*?\r?\n/ : /^\s*?(\r?\n|$)/).test(d.original) : void 0 : c;
        }function h(a, b, c) {
            var d = a[null == b ? 0 : b + 1];if (d && "ContentStatement" === d.type && (c || !d.rightStripped)) {
                var e = d.value;d.value = d.value.replace(c ? /^\s+/ : /^[ \t]*\r?\n?/, ""), d.rightStripped = d.value !== e;
            }
        }function i(a, b, c) {
            var d = a[null == b ? a.length - 1 : b - 1];if (d && "ContentStatement" === d.type && (c || !d.leftStripped)) {
                var e = d.value;return d.value = d.value.replace(c ? /\s+$/ : /[ \t]+$/, ""), d.leftStripped = d.value !== e, d.leftStripped;
            }
        }var j = d(c);e.prototype = new j["default"](), e.prototype.Program = function (a) {
            var b = !this.options.ignoreStandalone,
                c = !this.isRootSeen;this.isRootSeen = !0;for (var d = a.body, e = 0, j = d.length; e < j; e++) {
                var k = d[e],
                    l = this.accept(k);if (l) {
                    var m = f(d, e, c),
                        n = g(d, e, c),
                        o = l.openStandalone && m,
                        p = l.closeStandalone && n,
                        q = l.inlineStandalone && m && n;l.close && h(d, e, !0), l.open && i(d, e, !0), b && q && (h(d, e), i(d, e) && "PartialStatement" === k.type && (k.indent = /([ \t]+$)/.exec(d[e - 1].original)[1])), b && o && (h((k.program || k.inverse).body), i(d, e)), b && p && (h(d, e), i((k.inverse || k.program).body));
                }
            }return a;
        }, e.prototype.BlockStatement = e.prototype.DecoratorBlock = e.prototype.PartialBlockStatement = function (a) {
            this.accept(a.program), this.accept(a.inverse);var b = a.program || a.inverse,
                c = a.program && a.inverse,
                d = c,
                e = c;if (c && c.chained) for (d = c.body[0].program; e.chained;) e = e.body[e.body.length - 1].program;var j = { open: a.openStrip.open, close: a.closeStrip.close, openStandalone: g(b.body), closeStandalone: f((d || b).body) };if (a.openStrip.close && h(b.body, null, !0), c) {
                var k = a.inverseStrip;k.open && i(b.body, null, !0), k.close && h(d.body, null, !0), a.closeStrip.open && i(e.body, null, !0), !this.options.ignoreStandalone && f(b.body) && g(d.body) && (i(b.body), h(d.body));
            } else a.closeStrip.open && i(b.body, null, !0);return j;
        }, e.prototype.Decorator = e.prototype.MustacheStatement = function (a) {
            return a.strip;
        }, e.prototype.PartialStatement = e.prototype.CommentStatement = function (a) {
            var b = a.strip || {};return { inlineStandalone: !0, open: b.open, close: b.close };
        }, b.exports = e;
    }), define("handlebars/compiler/helpers", ["exports", "../exception"], function (a, b) {
        "use strict";
        function c(a) {
            return a && a.__esModule ? a : { "default": a };
        }function d(a, b) {
            if (b = b.path ? b.path.original : b, a.path.original !== b) {
                var c = { loc: a.path.loc };throw new o["default"](a.path.original + " doesn't match " + b, c);
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
                    if (e.length > 0) throw new o["default"]("Invalid path: " + d, { loc: c });".." === j && (f++, g += "../");
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
                if (h) throw new o["default"]("Unexpected inverse block on decorator", c);c.chain && (c.program.body[0].closeStrip = e.strip), j = c.strip, i = c.program;
            }return f && (f = i, i = b, b = f), { type: h ? "DecoratorBlock" : "BlockStatement", path: a.path, params: a.params, hash: a.hash, program: b, inverse: i, openStrip: a.strip, inverseStrip: j, closeStrip: e && e.strip, loc: this.locInfo(g) };
        }function m(a, b) {
            if (!b && a.length) {
                var c = a[0].loc,
                    d = a[a.length - 1].loc;c && d && (b = { source: c.source, start: { line: c.start.line, column: c.start.column }, end: { line: d.end.line, column: d.end.column } });
            }return { type: "Program", body: a, strip: {}, loc: b };
        }function n(a, b, c, e) {
            return d(a, c), { type: "PartialBlockStatement", name: a.path, params: a.params, hash: a.hash, program: b, openStrip: a.strip, closeStrip: c && c.strip, loc: this.locInfo(e) };
        }a.__esModule = !0, a.SourceLocation = e, a.id = f, a.stripFlags = g, a.stripComment = h, a.preparePath = i, a.prepareMustache = j, a.prepareRawBlock = k, a.prepareBlock = l, a.prepareProgram = m, a.preparePartialBlock = n;var o = c(b);
    }), define("handlebars/compiler/base", ["exports", "./parser", "./whitespace-control", "./helpers", "../utils"], function (a, b, c, d, e) {
        "use strict";
        function f(a) {
            return a && a.__esModule ? a : { "default": a };
        }function g(a, b) {
            if ("Program" === a.type) return a;h["default"].yy = j, j.locInfo = function (a) {
                return new j.SourceLocation(b && b.srcName, a);
            };var c = new i["default"](b);return c.accept(h["default"].parse(a));
        }a.__esModule = !0, a.parse = g;var h = f(b),
            i = f(c);a.parser = h["default"];var j = {};e.extend(j, d);
    }), define("handlebars/compiler/compiler", ["exports", "../exception", "../utils", "./ast"], function (a, b, c, d) {
        "use strict";
        function e(a) {
            return a && a.__esModule ? a : { "default": a };
        }function f() {}function g(a, b, c) {
            if (null == a || "string" != typeof a && "Program" !== a.type) throw new k["default"]("You must pass a string or Handlebars AST to Handlebars.precompile. You passed " + a);b = b || {}, "data" in b || (b.data = !0), b.compat && (b.useDepths = !0);var d = c.parse(a, b),
                e = new c.Compiler().compile(d, b);return new c.JavaScriptCompiler().compile(e, b);
        }function h(a, b, d) {
            function e() {
                var c = d.parse(a, b),
                    e = new d.Compiler().compile(c, b),
                    f = new d.JavaScriptCompiler().compile(e, b, void 0, !0);return d.template(f);
            }function f(a, b) {
                return g || (g = e()), g.call(this, a, b);
            }if (void 0 === b && (b = {}), null == a || "string" != typeof a && "Program" !== a.type) throw new k["default"]("You must pass a string or Handlebars AST to Handlebars.compile. You passed " + a);b = c.extend({}, b), "data" in b || (b.data = !0), b.compat && (b.useDepths = !0);var g = void 0;return f._setup = function (a) {
                return g || (g = e()), g._setup(a);
            }, f._child = function (a, b, c, d) {
                return g || (g = e()), g._child(a, b, c, d);
            }, f;
        }function i(a, b) {
            if (a === b) return !0;if (c.isArray(a) && c.isArray(b) && a.length === b.length) {
                for (var d = 0; d < a.length; d++) if (!i(a[d], b[d])) return !1;return !0;
            }
        }function j(a) {
            if (!a.path.parts) {
                var b = a.path;a.path = { type: "PathExpression", data: !1, depth: 0, parts: [b.original + ""], original: b.original + "", loc: b.loc };
            }
        }a.__esModule = !0, a.Compiler = f, a.precompile = g, a.compile = h;var k = e(b),
            l = e(d),
            m = [].slice;f.prototype = { compiler: f, equals: function (a) {
                var b = this.opcodes.length;if (a.opcodes.length !== b) return !1;for (var c = 0; c < b; c++) {
                    var d = this.opcodes[c],
                        e = a.opcodes[c];if (d.opcode !== e.opcode || !i(d.args, e.args)) return !1;
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
                j(a);var b = a.program,
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
                j(a);var b = this.classifySexpr(a);"simple" === b ? this.simpleSexpr(a) : "helper" === b ? this.helperSexpr(a) : this.ambiguousSexpr(a);
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
                    if (this.options.knownHelpersOnly) throw new k["default"]("You specified knownHelpersOnly, but used the unknown helper " + f, a);e.strict = !0, e.falsy = !0, this.accept(e), this.opcode("invokeHelper", d.length, e.original, l["default"].helpers.simpleId(e));
                }
            }, PathExpression: function (a) {
                this.addDepth(a.depth), this.opcode("getContext", a.depth);var b = a.parts[0],
                    c = l["default"].helpers.scopedId(a),
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
                this.opcodes.push({ opcode: a, args: m.call(arguments, 1), loc: this.sourceNode[0].loc });
            }, addDepth: function (a) {
                a && (this.useDepths = !0);
            }, classifySexpr: function (a) {
                var b = l["default"].helpers.simpleId(a.path),
                    c = b && !!this.blockParamIndex(a.path.parts[0]),
                    d = !c && l["default"].helpers.helperExpression(a),
                    e = !c && (d || b);if (e && !d) {
                    var f = a.path.parts[0],
                        g = this.options;g.knownHelpers[f] ? d = !0 : g.knownHelpersOnly && (e = !1);
                }return d ? "helper" : e ? "ambiguous" : "simple";
            }, pushParams: function (a) {
                for (var b = 0, c = a.length; b < c; b++) this.pushParam(a[b]);
            }, pushParam: function (a) {
                var b = null != a.value ? a.value : a.original || "";if (this.stringParams) b.replace && (b = b.replace(/^(\.?\.\/)*/g, "").replace(/\//g, ".")), a.depth && this.addDepth(a.depth), this.opcode("getContext", a.depth || 0), this.opcode("pushStringParam", b, a.type), "SubExpression" === a.type && this.accept(a);else {
                    if (this.trackIds) {
                        var c = void 0;if (!a.parts || l["default"].helpers.scopedId(a) || a.depth || (c = this.blockParamIndex(a.parts[0])), c) {
                            var d = a.parts.slice(1).join(".");this.opcode("pushId", "BlockParam", c, d);
                        } else b = a.original || b, b.replace && (b = b.replace(/^this(?:\.|$)/, "").replace(/^\.\//, "").replace(/^\.$/, "")), this.opcode("pushId", a.type, b);
                    }this.accept(a);
                }
            }, setupFullMustacheParams: function (a, b, c, d) {
                var e = a.params;return this.pushParams(e), this.opcode("pushProgram", b), this.opcode("pushProgram", c), a.hash ? this.accept(a.hash) : this.opcode("emptyHash", d), e;
            }, blockParamIndex: function (a) {
                for (var b = 0, d = this.options.blockParams.length; b < d; b++) {
                    var e = this.options.blockParams[b],
                        f = e && c.indexOf(e, a);if (e && f >= 0) return [b, f];
                }
            } };
    }), define("handlebars/compiler/code-gen", ["exports", "module", "../utils"], function (a, b, c) {
        "use strict";
        function d(a, b, d) {
            if (c.isArray(a)) {
                for (var e = [], f = 0, g = a.length; f < g; f++) e.push(b.wrap(a[f], d));return e;
            }return "boolean" == typeof a || "number" == typeof a ? a + "" : a;
        }function e(a) {
            this.srcFile = a, this.source = [];
        }var f = void 0;try {
            if ("function" != typeof define || !define.amd) {
                var g = require("source-map");f = g.SourceNode;
            }
        } catch (h) {}f || (f = function (a, b, c, d) {
            this.src = "", d && this.add(d);
        }, f.prototype = { add: function (a) {
                c.isArray(a) && (a = a.join("")), this.src += a;
            }, prepend: function (a) {
                c.isArray(a) && (a = a.join("")), this.src = a + this.src;
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
                var a = this.currentLocation || { start: {} };return new f(a.start.line, a.start.column, this.srcFile);
            }, wrap: function (a) {
                var b = arguments.length <= 1 || void 0 === arguments[1] ? this.currentLocation || { start: {} } : arguments[1];return a instanceof f ? a : (a = d(a, this, b), new f(b.start.line, b.start.column, this.srcFile, a));
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
            } }, b.exports = e;
    }), define("handlebars/compiler/javascript-compiler", ["exports", "module", "../base", "../exception", "../utils", "./code-gen"], function (a, b, c, d, e, f) {
        "use strict";
        function g(a) {
            return a && a.__esModule ? a : { "default": a };
        }function h(a) {
            this.value = a;
        }function i() {}function j(a, b, c, d) {
            var e = b.popStack(),
                f = 0,
                g = c.length;for (a && g--; f < g; f++) e = b.nameLookup(e, c[f], d);return a ? [b.aliasable("container.strict"), "(", e, ", ", b.quotedString(c[f]), ")"] : e;
        }var k = g(d),
            l = g(f);i.prototype = { nameLookup: function (a, b) {
                return i.isValidJavaScriptVariableName(b) ? [a, ".", b] : [a, "[", JSON.stringify(b), "]"];
            }, depthedLookup: function (a) {
                return [this.aliasable("container.lookup"), '(depths, "', a, '")'];
            }, compilerInfo: function () {
                var a = c.COMPILER_REVISION,
                    b = c.REVISION_CHANGES[a];return [a, b];
            }, appendToBuffer: function (a, b, c) {
                return e.isArray(a) || (a = [a]), a = this.source.wrap(a, b), this.environment.isSimple ? ["return ", a, ";"] : c ? ["buffer += ", a, ";"] : (a.appendToBuffer = !0, a);
            }, initializeBuffer: function () {
                return this.quotedString("");
            }, compile: function (a, b, c, d) {
                this.environment = a, this.options = b, this.stringParams = this.options.stringParams, this.trackIds = this.options.trackIds, this.precompile = !d, this.name = this.environment.name, this.isChild = !!c, this.context = c || { decorators: [], programs: [], environments: [] }, this.preamble(), this.stackSlot = 0, this.stackVars = [], this.aliases = {}, this.registers = { list: [] }, this.hashes = [], this.compileStack = [], this.inlineStack = [], this.blockParams = [], this.compileChildren(a, b), this.useDepths = this.useDepths || a.useDepths || a.useDecorators || this.options.compat, this.useBlockParams = this.useBlockParams || a.useBlockParams;var e = a.opcodes,
                    f = void 0,
                    g = void 0,
                    h = void 0,
                    i = void 0;for (h = 0, i = e.length; h < i; h++) f = e[h], this.source.currentLocation = f.loc, g = g || f.loc, this[f.opcode].apply(this, f.args);if (this.source.currentLocation = g, this.pushSource(""), this.stackSlot || this.inlineStack.length || this.compileStack.length) throw new k["default"]("Compile completed with content left on stack");this.decorators.isEmpty() ? this.decorators = void 0 : (this.useDecorators = !0, this.decorators.prepend("var decorators = container.decorators;\n"), this.decorators.push("return fn;"), d ? this.decorators = Function.apply(this, ["fn", "props", "container", "depth0", "data", "blockParams", "depths", this.decorators.merge()]) : (this.decorators.prepend("function(fn, props, container, depth0, data, blockParams, depths) {\n"), this.decorators.push("}\n"), this.decorators = this.decorators.merge()));var j = this.createFunctionContext(d);if (this.isChild) return j;var l = { compiler: this.compilerInfo(), main: j };this.decorators && (l.main_d = this.decorators, l.useDecorators = !0);var m = this.context,
                    n = m.programs,
                    o = m.decorators;for (h = 0, i = n.length; h < i; h++) n[h] && (l[h] = n[h], o[h] && (l[h + "_d"] = o[h], l.useDecorators = !0));return this.environment.usePartial && (l.usePartial = !0), this.options.data && (l.useData = !0), this.useDepths && (l.useDepths = !0), this.useBlockParams && (l.useBlockParams = !0), this.options.compat && (l.compat = !0), d ? l.compilerOptions = this.options : (l.compiler = JSON.stringify(l.compiler), this.source.currentLocation = { start: { line: 1, column: 0 } }, l = this.objectLiteral(l), b.srcName ? (l = l.toStringWithSourceMap({ file: b.destName }), l.map = l.map && l.map.toString()) : l = l.toString()), l;
            }, preamble: function () {
                this.lastContext = 0, this.source = new l["default"](this.options.srcName), this.decorators = new l["default"](this.options.srcName);
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
                var f = this;if (this.options.strict || this.options.assumeObjects) return void this.push(j(this.options.strict && e, this, b, a));for (var g = b.length; c < g; c++) this.replaceStack(function (e) {
                    var g = f.nameLookup(e, b[c], a);return d ? [" && ", g] : [" != null ? ", g, " : ", e];
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
            }, compiler: i, compileChildren: function (a, b) {
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
                return a instanceof h || (a = this.source.wrap(a)), this.inlineStack.push(a), a;
            }, pushStackLiteral: function (a) {
                this.push(new h(a));
            }, pushSource: function (a) {
                this.pendingContent && (this.source.push(this.appendToBuffer(this.source.quotedString(this.pendingContent), this.pendingLocation)), this.pendingContent = void 0), a && this.source.push(a);
            }, replaceStack: function (a) {
                var b = ["("],
                    c = void 0,
                    d = void 0,
                    e = void 0;if (!this.isInline()) throw new k["default"]("replaceStack on non-inline");var f = this.popStack(!0);if (f instanceof h) c = [f.value], b = ["(", c], e = !0;else {
                    d = !0;var g = this.incrStack();b = ["((", this.push(g), " = ", f, ")"], c = this.topStack();
                }var i = a.call(this, c);e || this.popStack(), d && this.stackSlot--, this.push(b.concat(i, ")"));
            }, incrStack: function () {
                return this.stackSlot++, this.stackSlot > this.stackVars.length && this.stackVars.push("stack" + this.stackSlot), this.topStackName();
            }, topStackName: function () {
                return "stack" + this.stackSlot;
            }, flushInline: function () {
                var a = this.inlineStack;this.inlineStack = [];for (var b = 0, c = a.length; b < c; b++) {
                    var d = a[b];if (d instanceof h) this.compileStack.push(d);else {
                        var e = this.incrStack();this.pushSource([e, " = ", d, ";"]), this.compileStack.push(e);
                    }
                }
            }, isInline: function () {
                return this.inlineStack.length;
            }, popStack: function (a) {
                var b = this.isInline(),
                    c = (b ? this.inlineStack : this.compileStack).pop();if (!a && c instanceof h) return c.value;if (!b) {
                    if (!this.stackSlot) throw new k["default"]("Invalid stack pop");this.stackSlot--;
                }return c;
            }, topStack: function () {
                var a = this.isInline() ? this.inlineStack : this.compileStack,
                    b = a[a.length - 1];return b instanceof h ? b.value : b;
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
            for (var a = "break else new var case finally return void catch for switch while continue function this with default if throw delete in try do instanceof typeof abstract enum int short boolean export interface static byte extends long super char final native synchronized class float package throws const goto private transient debugger implements protected volatile double import public let yield await null true false".split(" "), b = i.RESERVED_WORDS = {}, c = 0, d = a.length; c < d; c++) b[a[c]] = !0;
        }(), i.isValidJavaScriptVariableName = function (a) {
            return !i.RESERVED_WORDS[a] && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(a);
        }, b.exports = i;
    }), define("handlebars", ["exports", "module", "./handlebars.runtime", "./handlebars/compiler/ast", "./handlebars/compiler/base", "./handlebars/compiler/compiler", "./handlebars/compiler/javascript-compiler", "./handlebars/compiler/visitor", "./handlebars/no-conflict"], function (a, b, c, d, e, f, g, h, i) {
        "use strict";
        function j(a) {
            return a && a.__esModule ? a : { "default": a };
        }function k() {
            var a = q();return a.compile = function (b, c) {
                return f.compile(b, c, a);
            }, a.precompile = function (b, c) {
                return f.precompile(b, c, a);
            }, a.AST = m["default"], a.Compiler = f.Compiler, a.JavaScriptCompiler = n["default"], a.Parser = e.parser, a.parse = e.parse, a;
        }var l = j(c),
            m = j(d),
            n = j(g),
            o = j(h),
            p = j(i),
            q = l["default"].create,
            r = k();r.create = k, p["default"](r), r.Visitor = o["default"], r["default"] = r, b.exports = r;
    });
    define("Handlebars", function () {});

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
    define('LBase', ["Fiber"], function (Fiber) {

        var LBase = Fiber.extend(function (base) {
            return {
                // The `init` method serves as the constructor.
                init: function (params) {
                    // Insert private functions here
                    console.log('Lbase with params:', params);

                    //TODO: add default attrs like unique id, class name etc
                },
                log: function (str) {
                    console.log(str);
                }

            };
        });

        return LBase;
    });
    define('LModule', ["LBase"], function (LBase) {

        return LBase.extend(function (base) {
            return {
                // The `init` method serves as the constructor.
                init: function (params) {
                    // Insert private functions here
                    console.log('L Module with params:', params);
                },

                //Handlebars template
                //overridable via the JSON config of any given instance of the component
                template: '\n\t\t\t\t\t  <div>\n\t\t\t\t\t    <span>Some HTML here</span>\n\t\t\t\t\t  </div>\n\t\t\t\t\t',

                renderView: function (params) {}

            };
        });
    });
    define('scanner', [], function () {

        return {
            scan: function () {
                console.log('SCANNING...');

                //find Lagomorph blocks that may contain components
                var $blocks = $('.lagomorph-block');

                _.each($blocks, function (block) {
                    var $block = $(block);
                    var $components = $block.find('[data-lagomorph-component], [data-lc]');
                }, this);
            }

        };
    });
    define('lagomorph', ["jquery", "underscore", "Handlebars", "Fiber", "LBase", "LModule", "scanner"], function ($, _, Handlebars, Fiber, LBase, LModule, scanner) {

        var framework = {
            scanner: scanner,
            LBase: LBase,
            LModule: LModule,
            $: $,
            _: _,
            Handlebars: Handlebars,

            start: function () {

                this.scanner.scan();
            },

            createApp: function () {
                //initiate a full single-page app with router, etc if desired
            }
        };

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
