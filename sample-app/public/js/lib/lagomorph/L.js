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

    /*! jQuery v3.2.1 | (c) JS Foundation and other contributors | jquery.org/license */
    !function (a, b) {
        "use strict";
        "object" == typeof module && "object" == typeof module.exports ? module.exports = a.document ? b(a, !0) : function (a) {
            if (!a.document) throw new Error("jQuery requires a window with a document");return b(a);
        } : b(a);
    }("undefined" != typeof window ? window : this, function (a, b) {
        "use strict";
        var c = [],
            d = a.document,
            e = Object.getPrototypeOf,
            f = c.slice,
            g = c.concat,
            h = c.push,
            i = c.indexOf,
            j = {},
            k = j.toString,
            l = j.hasOwnProperty,
            m = l.toString,
            n = m.call(Object),
            o = {};function p(a, b) {
            b = b || d;var c = b.createElement("script");c.text = a, b.head.appendChild(c).parentNode.removeChild(c);
        }var q = "3.2.1",
            r = function (a, b) {
            return new r.fn.init(a, b);
        },
            s = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,
            t = /^-ms-/,
            u = /-([a-z])/g,
            v = function (a, b) {
            return b.toUpperCase();
        };r.fn = r.prototype = { jquery: q, constructor: r, length: 0, toArray: function () {
                return f.call(this);
            }, get: function (a) {
                return null == a ? f.call(this) : a < 0 ? this[a + this.length] : this[a];
            }, pushStack: function (a) {
                var b = r.merge(this.constructor(), a);return b.prevObject = this, b;
            }, each: function (a) {
                return r.each(this, a);
            }, map: function (a) {
                return this.pushStack(r.map(this, function (b, c) {
                    return a.call(b, c, b);
                }));
            }, slice: function () {
                return this.pushStack(f.apply(this, arguments));
            }, first: function () {
                return this.eq(0);
            }, last: function () {
                return this.eq(-1);
            }, eq: function (a) {
                var b = this.length,
                    c = +a + (a < 0 ? b : 0);return this.pushStack(c >= 0 && c < b ? [this[c]] : []);
            }, end: function () {
                return this.prevObject || this.constructor();
            }, push: h, sort: c.sort, splice: c.splice }, r.extend = r.fn.extend = function () {
            var a,
                b,
                c,
                d,
                e,
                f,
                g = arguments[0] || {},
                h = 1,
                i = arguments.length,
                j = !1;for ("boolean" == typeof g && (j = g, g = arguments[h] || {}, h++), "object" == typeof g || r.isFunction(g) || (g = {}), h === i && (g = this, h--); h < i; h++) if (null != (a = arguments[h])) for (b in a) c = g[b], d = a[b], g !== d && (j && d && (r.isPlainObject(d) || (e = Array.isArray(d))) ? (e ? (e = !1, f = c && Array.isArray(c) ? c : []) : f = c && r.isPlainObject(c) ? c : {}, g[b] = r.extend(j, f, d)) : void 0 !== d && (g[b] = d));return g;
        }, r.extend({ expando: "jQuery" + (q + Math.random()).replace(/\D/g, ""), isReady: !0, error: function (a) {
                throw new Error(a);
            }, noop: function () {}, isFunction: function (a) {
                return "function" === r.type(a);
            }, isWindow: function (a) {
                return null != a && a === a.window;
            }, isNumeric: function (a) {
                var b = r.type(a);return ("number" === b || "string" === b) && !isNaN(a - parseFloat(a));
            }, isPlainObject: function (a) {
                var b, c;return !(!a || "[object Object]" !== k.call(a)) && (!(b = e(a)) || (c = l.call(b, "constructor") && b.constructor, "function" == typeof c && m.call(c) === n));
            }, isEmptyObject: function (a) {
                var b;for (b in a) return !1;return !0;
            }, type: function (a) {
                return null == a ? a + "" : "object" == typeof a || "function" == typeof a ? j[k.call(a)] || "object" : typeof a;
            }, globalEval: function (a) {
                p(a);
            }, camelCase: function (a) {
                return a.replace(t, "ms-").replace(u, v);
            }, each: function (a, b) {
                var c,
                    d = 0;if (w(a)) {
                    for (c = a.length; d < c; d++) if (b.call(a[d], d, a[d]) === !1) break;
                } else for (d in a) if (b.call(a[d], d, a[d]) === !1) break;return a;
            }, trim: function (a) {
                return null == a ? "" : (a + "").replace(s, "");
            }, makeArray: function (a, b) {
                var c = b || [];return null != a && (w(Object(a)) ? r.merge(c, "string" == typeof a ? [a] : a) : h.call(c, a)), c;
            }, inArray: function (a, b, c) {
                return null == b ? -1 : i.call(b, a, c);
            }, merge: function (a, b) {
                for (var c = +b.length, d = 0, e = a.length; d < c; d++) a[e++] = b[d];return a.length = e, a;
            }, grep: function (a, b, c) {
                for (var d, e = [], f = 0, g = a.length, h = !c; f < g; f++) d = !b(a[f], f), d !== h && e.push(a[f]);return e;
            }, map: function (a, b, c) {
                var d,
                    e,
                    f = 0,
                    h = [];if (w(a)) for (d = a.length; f < d; f++) e = b(a[f], f, c), null != e && h.push(e);else for (f in a) e = b(a[f], f, c), null != e && h.push(e);return g.apply([], h);
            }, guid: 1, proxy: function (a, b) {
                var c, d, e;if ("string" == typeof b && (c = a[b], b = a, a = c), r.isFunction(a)) return d = f.call(arguments, 2), e = function () {
                    return a.apply(b || this, d.concat(f.call(arguments)));
                }, e.guid = a.guid = a.guid || r.guid++, e;
            }, now: Date.now, support: o }), "function" == typeof Symbol && (r.fn[Symbol.iterator] = c[Symbol.iterator]), r.each("Boolean Number String Function Array Date RegExp Object Error Symbol".split(" "), function (a, b) {
            j["[object " + b + "]"] = b.toLowerCase();
        });function w(a) {
            var b = !!a && "length" in a && a.length,
                c = r.type(a);return "function" !== c && !r.isWindow(a) && ("array" === c || 0 === b || "number" == typeof b && b > 0 && b - 1 in a);
        }var x = function (a) {
            var b,
                c,
                d,
                e,
                f,
                g,
                h,
                i,
                j,
                k,
                l,
                m,
                n,
                o,
                p,
                q,
                r,
                s,
                t,
                u = "sizzle" + 1 * new Date(),
                v = a.document,
                w = 0,
                x = 0,
                y = ha(),
                z = ha(),
                A = ha(),
                B = function (a, b) {
                return a === b && (l = !0), 0;
            },
                C = {}.hasOwnProperty,
                D = [],
                E = D.pop,
                F = D.push,
                G = D.push,
                H = D.slice,
                I = function (a, b) {
                for (var c = 0, d = a.length; c < d; c++) if (a[c] === b) return c;return -1;
            },
                J = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",
                K = "[\\x20\\t\\r\\n\\f]",
                L = "(?:\\\\.|[\\w-]|[^\0-\\xa0])+",
                M = "\\[" + K + "*(" + L + ")(?:" + K + "*([*^$|!~]?=)" + K + "*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + L + "))|)" + K + "*\\]",
                N = ":(" + L + ")(?:\\((('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|((?:\\\\.|[^\\\\()[\\]]|" + M + ")*)|.*)\\)|)",
                O = new RegExp(K + "+", "g"),
                P = new RegExp("^" + K + "+|((?:^|[^\\\\])(?:\\\\.)*)" + K + "+$", "g"),
                Q = new RegExp("^" + K + "*," + K + "*"),
                R = new RegExp("^" + K + "*([>+~]|" + K + ")" + K + "*"),
                S = new RegExp("=" + K + "*([^\\]'\"]*?)" + K + "*\\]", "g"),
                T = new RegExp(N),
                U = new RegExp("^" + L + "$"),
                V = { ID: new RegExp("^#(" + L + ")"), CLASS: new RegExp("^\\.(" + L + ")"), TAG: new RegExp("^(" + L + "|[*])"), ATTR: new RegExp("^" + M), PSEUDO: new RegExp("^" + N), CHILD: new RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + K + "*(even|odd|(([+-]|)(\\d*)n|)" + K + "*(?:([+-]|)" + K + "*(\\d+)|))" + K + "*\\)|)", "i"), bool: new RegExp("^(?:" + J + ")$", "i"), needsContext: new RegExp("^" + K + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" + K + "*((?:-\\d)?\\d*)" + K + "*\\)|)(?=[^-]|$)", "i") },
                W = /^(?:input|select|textarea|button)$/i,
                X = /^h\d$/i,
                Y = /^[^{]+\{\s*\[native \w/,
                Z = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,
                $ = /[+~]/,
                _ = new RegExp("\\\\([\\da-f]{1,6}" + K + "?|(" + K + ")|.)", "ig"),
                aa = function (a, b, c) {
                var d = "0x" + b - 65536;return d !== d || c ? b : d < 0 ? String.fromCharCode(d + 65536) : String.fromCharCode(d >> 10 | 55296, 1023 & d | 56320);
            },
                ba = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\0-\x1f\x7f-\uFFFF\w-]/g,
                ca = function (a, b) {
                return b ? "\0" === a ? "\ufffd" : a.slice(0, -1) + "\\" + a.charCodeAt(a.length - 1).toString(16) + " " : "\\" + a;
            },
                da = function () {
                m();
            },
                ea = ta(function (a) {
                return a.disabled === !0 && ("form" in a || "label" in a);
            }, { dir: "parentNode", next: "legend" });try {
                G.apply(D = H.call(v.childNodes), v.childNodes), D[v.childNodes.length].nodeType;
            } catch (fa) {
                G = { apply: D.length ? function (a, b) {
                        F.apply(a, H.call(b));
                    } : function (a, b) {
                        var c = a.length,
                            d = 0;while (a[c++] = b[d++]);a.length = c - 1;
                    } };
            }function ga(a, b, d, e) {
                var f,
                    h,
                    j,
                    k,
                    l,
                    o,
                    r,
                    s = b && b.ownerDocument,
                    w = b ? b.nodeType : 9;if (d = d || [], "string" != typeof a || !a || 1 !== w && 9 !== w && 11 !== w) return d;if (!e && ((b ? b.ownerDocument || b : v) !== n && m(b), b = b || n, p)) {
                    if (11 !== w && (l = Z.exec(a))) if (f = l[1]) {
                        if (9 === w) {
                            if (!(j = b.getElementById(f))) return d;if (j.id === f) return d.push(j), d;
                        } else if (s && (j = s.getElementById(f)) && t(b, j) && j.id === f) return d.push(j), d;
                    } else {
                        if (l[2]) return G.apply(d, b.getElementsByTagName(a)), d;if ((f = l[3]) && c.getElementsByClassName && b.getElementsByClassName) return G.apply(d, b.getElementsByClassName(f)), d;
                    }if (c.qsa && !A[a + " "] && (!q || !q.test(a))) {
                        if (1 !== w) s = b, r = a;else if ("object" !== b.nodeName.toLowerCase()) {
                            (k = b.getAttribute("id")) ? k = k.replace(ba, ca) : b.setAttribute("id", k = u), o = g(a), h = o.length;while (h--) o[h] = "#" + k + " " + sa(o[h]);r = o.join(","), s = $.test(a) && qa(b.parentNode) || b;
                        }if (r) try {
                            return G.apply(d, s.querySelectorAll(r)), d;
                        } catch (x) {} finally {
                            k === u && b.removeAttribute("id");
                        }
                    }
                }return i(a.replace(P, "$1"), b, d, e);
            }function ha() {
                var a = [];function b(c, e) {
                    return a.push(c + " ") > d.cacheLength && delete b[a.shift()], b[c + " "] = e;
                }return b;
            }function ia(a) {
                return a[u] = !0, a;
            }function ja(a) {
                var b = n.createElement("fieldset");try {
                    return !!a(b);
                } catch (c) {
                    return !1;
                } finally {
                    b.parentNode && b.parentNode.removeChild(b), b = null;
                }
            }function ka(a, b) {
                var c = a.split("|"),
                    e = c.length;while (e--) d.attrHandle[c[e]] = b;
            }function la(a, b) {
                var c = b && a,
                    d = c && 1 === a.nodeType && 1 === b.nodeType && a.sourceIndex - b.sourceIndex;if (d) return d;if (c) while (c = c.nextSibling) if (c === b) return -1;return a ? 1 : -1;
            }function ma(a) {
                return function (b) {
                    var c = b.nodeName.toLowerCase();return "input" === c && b.type === a;
                };
            }function na(a) {
                return function (b) {
                    var c = b.nodeName.toLowerCase();return ("input" === c || "button" === c) && b.type === a;
                };
            }function oa(a) {
                return function (b) {
                    return "form" in b ? b.parentNode && b.disabled === !1 ? "label" in b ? "label" in b.parentNode ? b.parentNode.disabled === a : b.disabled === a : b.isDisabled === a || b.isDisabled !== !a && ea(b) === a : b.disabled === a : "label" in b && b.disabled === a;
                };
            }function pa(a) {
                return ia(function (b) {
                    return b = +b, ia(function (c, d) {
                        var e,
                            f = a([], c.length, b),
                            g = f.length;while (g--) c[e = f[g]] && (c[e] = !(d[e] = c[e]));
                    });
                });
            }function qa(a) {
                return a && "undefined" != typeof a.getElementsByTagName && a;
            }c = ga.support = {}, f = ga.isXML = function (a) {
                var b = a && (a.ownerDocument || a).documentElement;return !!b && "HTML" !== b.nodeName;
            }, m = ga.setDocument = function (a) {
                var b,
                    e,
                    g = a ? a.ownerDocument || a : v;return g !== n && 9 === g.nodeType && g.documentElement ? (n = g, o = n.documentElement, p = !f(n), v !== n && (e = n.defaultView) && e.top !== e && (e.addEventListener ? e.addEventListener("unload", da, !1) : e.attachEvent && e.attachEvent("onunload", da)), c.attributes = ja(function (a) {
                    return a.className = "i", !a.getAttribute("className");
                }), c.getElementsByTagName = ja(function (a) {
                    return a.appendChild(n.createComment("")), !a.getElementsByTagName("*").length;
                }), c.getElementsByClassName = Y.test(n.getElementsByClassName), c.getById = ja(function (a) {
                    return o.appendChild(a).id = u, !n.getElementsByName || !n.getElementsByName(u).length;
                }), c.getById ? (d.filter.ID = function (a) {
                    var b = a.replace(_, aa);return function (a) {
                        return a.getAttribute("id") === b;
                    };
                }, d.find.ID = function (a, b) {
                    if ("undefined" != typeof b.getElementById && p) {
                        var c = b.getElementById(a);return c ? [c] : [];
                    }
                }) : (d.filter.ID = function (a) {
                    var b = a.replace(_, aa);return function (a) {
                        var c = "undefined" != typeof a.getAttributeNode && a.getAttributeNode("id");return c && c.value === b;
                    };
                }, d.find.ID = function (a, b) {
                    if ("undefined" != typeof b.getElementById && p) {
                        var c,
                            d,
                            e,
                            f = b.getElementById(a);if (f) {
                            if (c = f.getAttributeNode("id"), c && c.value === a) return [f];e = b.getElementsByName(a), d = 0;while (f = e[d++]) if (c = f.getAttributeNode("id"), c && c.value === a) return [f];
                        }return [];
                    }
                }), d.find.TAG = c.getElementsByTagName ? function (a, b) {
                    return "undefined" != typeof b.getElementsByTagName ? b.getElementsByTagName(a) : c.qsa ? b.querySelectorAll(a) : void 0;
                } : function (a, b) {
                    var c,
                        d = [],
                        e = 0,
                        f = b.getElementsByTagName(a);if ("*" === a) {
                        while (c = f[e++]) 1 === c.nodeType && d.push(c);return d;
                    }return f;
                }, d.find.CLASS = c.getElementsByClassName && function (a, b) {
                    if ("undefined" != typeof b.getElementsByClassName && p) return b.getElementsByClassName(a);
                }, r = [], q = [], (c.qsa = Y.test(n.querySelectorAll)) && (ja(function (a) {
                    o.appendChild(a).innerHTML = "<a id='" + u + "'></a><select id='" + u + "-\r\\' msallowcapture=''><option selected=''></option></select>", a.querySelectorAll("[msallowcapture^='']").length && q.push("[*^$]=" + K + "*(?:''|\"\")"), a.querySelectorAll("[selected]").length || q.push("\\[" + K + "*(?:value|" + J + ")"), a.querySelectorAll("[id~=" + u + "-]").length || q.push("~="), a.querySelectorAll(":checked").length || q.push(":checked"), a.querySelectorAll("a#" + u + "+*").length || q.push(".#.+[+~]");
                }), ja(function (a) {
                    a.innerHTML = "<a href='' disabled='disabled'></a><select disabled='disabled'><option/></select>";var b = n.createElement("input");b.setAttribute("type", "hidden"), a.appendChild(b).setAttribute("name", "D"), a.querySelectorAll("[name=d]").length && q.push("name" + K + "*[*^$|!~]?="), 2 !== a.querySelectorAll(":enabled").length && q.push(":enabled", ":disabled"), o.appendChild(a).disabled = !0, 2 !== a.querySelectorAll(":disabled").length && q.push(":enabled", ":disabled"), a.querySelectorAll("*,:x"), q.push(",.*:");
                })), (c.matchesSelector = Y.test(s = o.matches || o.webkitMatchesSelector || o.mozMatchesSelector || o.oMatchesSelector || o.msMatchesSelector)) && ja(function (a) {
                    c.disconnectedMatch = s.call(a, "*"), s.call(a, "[s!='']:x"), r.push("!=", N);
                }), q = q.length && new RegExp(q.join("|")), r = r.length && new RegExp(r.join("|")), b = Y.test(o.compareDocumentPosition), t = b || Y.test(o.contains) ? function (a, b) {
                    var c = 9 === a.nodeType ? a.documentElement : a,
                        d = b && b.parentNode;return a === d || !(!d || 1 !== d.nodeType || !(c.contains ? c.contains(d) : a.compareDocumentPosition && 16 & a.compareDocumentPosition(d)));
                } : function (a, b) {
                    if (b) while (b = b.parentNode) if (b === a) return !0;return !1;
                }, B = b ? function (a, b) {
                    if (a === b) return l = !0, 0;var d = !a.compareDocumentPosition - !b.compareDocumentPosition;return d ? d : (d = (a.ownerDocument || a) === (b.ownerDocument || b) ? a.compareDocumentPosition(b) : 1, 1 & d || !c.sortDetached && b.compareDocumentPosition(a) === d ? a === n || a.ownerDocument === v && t(v, a) ? -1 : b === n || b.ownerDocument === v && t(v, b) ? 1 : k ? I(k, a) - I(k, b) : 0 : 4 & d ? -1 : 1);
                } : function (a, b) {
                    if (a === b) return l = !0, 0;var c,
                        d = 0,
                        e = a.parentNode,
                        f = b.parentNode,
                        g = [a],
                        h = [b];if (!e || !f) return a === n ? -1 : b === n ? 1 : e ? -1 : f ? 1 : k ? I(k, a) - I(k, b) : 0;if (e === f) return la(a, b);c = a;while (c = c.parentNode) g.unshift(c);c = b;while (c = c.parentNode) h.unshift(c);while (g[d] === h[d]) d++;return d ? la(g[d], h[d]) : g[d] === v ? -1 : h[d] === v ? 1 : 0;
                }, n) : n;
            }, ga.matches = function (a, b) {
                return ga(a, null, null, b);
            }, ga.matchesSelector = function (a, b) {
                if ((a.ownerDocument || a) !== n && m(a), b = b.replace(S, "='$1']"), c.matchesSelector && p && !A[b + " "] && (!r || !r.test(b)) && (!q || !q.test(b))) try {
                    var d = s.call(a, b);if (d || c.disconnectedMatch || a.document && 11 !== a.document.nodeType) return d;
                } catch (e) {}return ga(b, n, null, [a]).length > 0;
            }, ga.contains = function (a, b) {
                return (a.ownerDocument || a) !== n && m(a), t(a, b);
            }, ga.attr = function (a, b) {
                (a.ownerDocument || a) !== n && m(a);var e = d.attrHandle[b.toLowerCase()],
                    f = e && C.call(d.attrHandle, b.toLowerCase()) ? e(a, b, !p) : void 0;return void 0 !== f ? f : c.attributes || !p ? a.getAttribute(b) : (f = a.getAttributeNode(b)) && f.specified ? f.value : null;
            }, ga.escape = function (a) {
                return (a + "").replace(ba, ca);
            }, ga.error = function (a) {
                throw new Error("Syntax error, unrecognized expression: " + a);
            }, ga.uniqueSort = function (a) {
                var b,
                    d = [],
                    e = 0,
                    f = 0;if (l = !c.detectDuplicates, k = !c.sortStable && a.slice(0), a.sort(B), l) {
                    while (b = a[f++]) b === a[f] && (e = d.push(f));while (e--) a.splice(d[e], 1);
                }return k = null, a;
            }, e = ga.getText = function (a) {
                var b,
                    c = "",
                    d = 0,
                    f = a.nodeType;if (f) {
                    if (1 === f || 9 === f || 11 === f) {
                        if ("string" == typeof a.textContent) return a.textContent;for (a = a.firstChild; a; a = a.nextSibling) c += e(a);
                    } else if (3 === f || 4 === f) return a.nodeValue;
                } else while (b = a[d++]) c += e(b);return c;
            }, d = ga.selectors = { cacheLength: 50, createPseudo: ia, match: V, attrHandle: {}, find: {}, relative: { ">": { dir: "parentNode", first: !0 }, " ": { dir: "parentNode" }, "+": { dir: "previousSibling", first: !0 }, "~": { dir: "previousSibling" } }, preFilter: { ATTR: function (a) {
                        return a[1] = a[1].replace(_, aa), a[3] = (a[3] || a[4] || a[5] || "").replace(_, aa), "~=" === a[2] && (a[3] = " " + a[3] + " "), a.slice(0, 4);
                    }, CHILD: function (a) {
                        return a[1] = a[1].toLowerCase(), "nth" === a[1].slice(0, 3) ? (a[3] || ga.error(a[0]), a[4] = +(a[4] ? a[5] + (a[6] || 1) : 2 * ("even" === a[3] || "odd" === a[3])), a[5] = +(a[7] + a[8] || "odd" === a[3])) : a[3] && ga.error(a[0]), a;
                    }, PSEUDO: function (a) {
                        var b,
                            c = !a[6] && a[2];return V.CHILD.test(a[0]) ? null : (a[3] ? a[2] = a[4] || a[5] || "" : c && T.test(c) && (b = g(c, !0)) && (b = c.indexOf(")", c.length - b) - c.length) && (a[0] = a[0].slice(0, b), a[2] = c.slice(0, b)), a.slice(0, 3));
                    } }, filter: { TAG: function (a) {
                        var b = a.replace(_, aa).toLowerCase();return "*" === a ? function () {
                            return !0;
                        } : function (a) {
                            return a.nodeName && a.nodeName.toLowerCase() === b;
                        };
                    }, CLASS: function (a) {
                        var b = y[a + " "];return b || (b = new RegExp("(^|" + K + ")" + a + "(" + K + "|$)")) && y(a, function (a) {
                            return b.test("string" == typeof a.className && a.className || "undefined" != typeof a.getAttribute && a.getAttribute("class") || "");
                        });
                    }, ATTR: function (a, b, c) {
                        return function (d) {
                            var e = ga.attr(d, a);return null == e ? "!=" === b : !b || (e += "", "=" === b ? e === c : "!=" === b ? e !== c : "^=" === b ? c && 0 === e.indexOf(c) : "*=" === b ? c && e.indexOf(c) > -1 : "$=" === b ? c && e.slice(-c.length) === c : "~=" === b ? (" " + e.replace(O, " ") + " ").indexOf(c) > -1 : "|=" === b && (e === c || e.slice(0, c.length + 1) === c + "-"));
                        };
                    }, CHILD: function (a, b, c, d, e) {
                        var f = "nth" !== a.slice(0, 3),
                            g = "last" !== a.slice(-4),
                            h = "of-type" === b;return 1 === d && 0 === e ? function (a) {
                            return !!a.parentNode;
                        } : function (b, c, i) {
                            var j,
                                k,
                                l,
                                m,
                                n,
                                o,
                                p = f !== g ? "nextSibling" : "previousSibling",
                                q = b.parentNode,
                                r = h && b.nodeName.toLowerCase(),
                                s = !i && !h,
                                t = !1;if (q) {
                                if (f) {
                                    while (p) {
                                        m = b;while (m = m[p]) if (h ? m.nodeName.toLowerCase() === r : 1 === m.nodeType) return !1;o = p = "only" === a && !o && "nextSibling";
                                    }return !0;
                                }if (o = [g ? q.firstChild : q.lastChild], g && s) {
                                    m = q, l = m[u] || (m[u] = {}), k = l[m.uniqueID] || (l[m.uniqueID] = {}), j = k[a] || [], n = j[0] === w && j[1], t = n && j[2], m = n && q.childNodes[n];while (m = ++n && m && m[p] || (t = n = 0) || o.pop()) if (1 === m.nodeType && ++t && m === b) {
                                        k[a] = [w, n, t];break;
                                    }
                                } else if (s && (m = b, l = m[u] || (m[u] = {}), k = l[m.uniqueID] || (l[m.uniqueID] = {}), j = k[a] || [], n = j[0] === w && j[1], t = n), t === !1) while (m = ++n && m && m[p] || (t = n = 0) || o.pop()) if ((h ? m.nodeName.toLowerCase() === r : 1 === m.nodeType) && ++t && (s && (l = m[u] || (m[u] = {}), k = l[m.uniqueID] || (l[m.uniqueID] = {}), k[a] = [w, t]), m === b)) break;return t -= e, t === d || t % d === 0 && t / d >= 0;
                            }
                        };
                    }, PSEUDO: function (a, b) {
                        var c,
                            e = d.pseudos[a] || d.setFilters[a.toLowerCase()] || ga.error("unsupported pseudo: " + a);return e[u] ? e(b) : e.length > 1 ? (c = [a, a, "", b], d.setFilters.hasOwnProperty(a.toLowerCase()) ? ia(function (a, c) {
                            var d,
                                f = e(a, b),
                                g = f.length;while (g--) d = I(a, f[g]), a[d] = !(c[d] = f[g]);
                        }) : function (a) {
                            return e(a, 0, c);
                        }) : e;
                    } }, pseudos: { not: ia(function (a) {
                        var b = [],
                            c = [],
                            d = h(a.replace(P, "$1"));return d[u] ? ia(function (a, b, c, e) {
                            var f,
                                g = d(a, null, e, []),
                                h = a.length;while (h--) (f = g[h]) && (a[h] = !(b[h] = f));
                        }) : function (a, e, f) {
                            return b[0] = a, d(b, null, f, c), b[0] = null, !c.pop();
                        };
                    }), has: ia(function (a) {
                        return function (b) {
                            return ga(a, b).length > 0;
                        };
                    }), contains: ia(function (a) {
                        return a = a.replace(_, aa), function (b) {
                            return (b.textContent || b.innerText || e(b)).indexOf(a) > -1;
                        };
                    }), lang: ia(function (a) {
                        return U.test(a || "") || ga.error("unsupported lang: " + a), a = a.replace(_, aa).toLowerCase(), function (b) {
                            var c;do if (c = p ? b.lang : b.getAttribute("xml:lang") || b.getAttribute("lang")) return c = c.toLowerCase(), c === a || 0 === c.indexOf(a + "-"); while ((b = b.parentNode) && 1 === b.nodeType);return !1;
                        };
                    }), target: function (b) {
                        var c = a.location && a.location.hash;return c && c.slice(1) === b.id;
                    }, root: function (a) {
                        return a === o;
                    }, focus: function (a) {
                        return a === n.activeElement && (!n.hasFocus || n.hasFocus()) && !!(a.type || a.href || ~a.tabIndex);
                    }, enabled: oa(!1), disabled: oa(!0), checked: function (a) {
                        var b = a.nodeName.toLowerCase();return "input" === b && !!a.checked || "option" === b && !!a.selected;
                    }, selected: function (a) {
                        return a.parentNode && a.parentNode.selectedIndex, a.selected === !0;
                    }, empty: function (a) {
                        for (a = a.firstChild; a; a = a.nextSibling) if (a.nodeType < 6) return !1;return !0;
                    }, parent: function (a) {
                        return !d.pseudos.empty(a);
                    }, header: function (a) {
                        return X.test(a.nodeName);
                    }, input: function (a) {
                        return W.test(a.nodeName);
                    }, button: function (a) {
                        var b = a.nodeName.toLowerCase();return "input" === b && "button" === a.type || "button" === b;
                    }, text: function (a) {
                        var b;return "input" === a.nodeName.toLowerCase() && "text" === a.type && (null == (b = a.getAttribute("type")) || "text" === b.toLowerCase());
                    }, first: pa(function () {
                        return [0];
                    }), last: pa(function (a, b) {
                        return [b - 1];
                    }), eq: pa(function (a, b, c) {
                        return [c < 0 ? c + b : c];
                    }), even: pa(function (a, b) {
                        for (var c = 0; c < b; c += 2) a.push(c);return a;
                    }), odd: pa(function (a, b) {
                        for (var c = 1; c < b; c += 2) a.push(c);return a;
                    }), lt: pa(function (a, b, c) {
                        for (var d = c < 0 ? c + b : c; --d >= 0;) a.push(d);return a;
                    }), gt: pa(function (a, b, c) {
                        for (var d = c < 0 ? c + b : c; ++d < b;) a.push(d);return a;
                    }) } }, d.pseudos.nth = d.pseudos.eq;for (b in { radio: !0, checkbox: !0, file: !0, password: !0, image: !0 }) d.pseudos[b] = ma(b);for (b in { submit: !0, reset: !0 }) d.pseudos[b] = na(b);function ra() {}ra.prototype = d.filters = d.pseudos, d.setFilters = new ra(), g = ga.tokenize = function (a, b) {
                var c,
                    e,
                    f,
                    g,
                    h,
                    i,
                    j,
                    k = z[a + " "];if (k) return b ? 0 : k.slice(0);h = a, i = [], j = d.preFilter;while (h) {
                    c && !(e = Q.exec(h)) || (e && (h = h.slice(e[0].length) || h), i.push(f = [])), c = !1, (e = R.exec(h)) && (c = e.shift(), f.push({ value: c, type: e[0].replace(P, " ") }), h = h.slice(c.length));for (g in d.filter) !(e = V[g].exec(h)) || j[g] && !(e = j[g](e)) || (c = e.shift(), f.push({ value: c, type: g, matches: e }), h = h.slice(c.length));if (!c) break;
                }return b ? h.length : h ? ga.error(a) : z(a, i).slice(0);
            };function sa(a) {
                for (var b = 0, c = a.length, d = ""; b < c; b++) d += a[b].value;return d;
            }function ta(a, b, c) {
                var d = b.dir,
                    e = b.next,
                    f = e || d,
                    g = c && "parentNode" === f,
                    h = x++;return b.first ? function (b, c, e) {
                    while (b = b[d]) if (1 === b.nodeType || g) return a(b, c, e);return !1;
                } : function (b, c, i) {
                    var j,
                        k,
                        l,
                        m = [w, h];if (i) {
                        while (b = b[d]) if ((1 === b.nodeType || g) && a(b, c, i)) return !0;
                    } else while (b = b[d]) if (1 === b.nodeType || g) if (l = b[u] || (b[u] = {}), k = l[b.uniqueID] || (l[b.uniqueID] = {}), e && e === b.nodeName.toLowerCase()) b = b[d] || b;else {
                        if ((j = k[f]) && j[0] === w && j[1] === h) return m[2] = j[2];if (k[f] = m, m[2] = a(b, c, i)) return !0;
                    }return !1;
                };
            }function ua(a) {
                return a.length > 1 ? function (b, c, d) {
                    var e = a.length;while (e--) if (!a[e](b, c, d)) return !1;return !0;
                } : a[0];
            }function va(a, b, c) {
                for (var d = 0, e = b.length; d < e; d++) ga(a, b[d], c);return c;
            }function wa(a, b, c, d, e) {
                for (var f, g = [], h = 0, i = a.length, j = null != b; h < i; h++) (f = a[h]) && (c && !c(f, d, e) || (g.push(f), j && b.push(h)));return g;
            }function xa(a, b, c, d, e, f) {
                return d && !d[u] && (d = xa(d)), e && !e[u] && (e = xa(e, f)), ia(function (f, g, h, i) {
                    var j,
                        k,
                        l,
                        m = [],
                        n = [],
                        o = g.length,
                        p = f || va(b || "*", h.nodeType ? [h] : h, []),
                        q = !a || !f && b ? p : wa(p, m, a, h, i),
                        r = c ? e || (f ? a : o || d) ? [] : g : q;if (c && c(q, r, h, i), d) {
                        j = wa(r, n), d(j, [], h, i), k = j.length;while (k--) (l = j[k]) && (r[n[k]] = !(q[n[k]] = l));
                    }if (f) {
                        if (e || a) {
                            if (e) {
                                j = [], k = r.length;while (k--) (l = r[k]) && j.push(q[k] = l);e(null, r = [], j, i);
                            }k = r.length;while (k--) (l = r[k]) && (j = e ? I(f, l) : m[k]) > -1 && (f[j] = !(g[j] = l));
                        }
                    } else r = wa(r === g ? r.splice(o, r.length) : r), e ? e(null, g, r, i) : G.apply(g, r);
                });
            }function ya(a) {
                for (var b, c, e, f = a.length, g = d.relative[a[0].type], h = g || d.relative[" "], i = g ? 1 : 0, k = ta(function (a) {
                    return a === b;
                }, h, !0), l = ta(function (a) {
                    return I(b, a) > -1;
                }, h, !0), m = [function (a, c, d) {
                    var e = !g && (d || c !== j) || ((b = c).nodeType ? k(a, c, d) : l(a, c, d));return b = null, e;
                }]; i < f; i++) if (c = d.relative[a[i].type]) m = [ta(ua(m), c)];else {
                    if (c = d.filter[a[i].type].apply(null, a[i].matches), c[u]) {
                        for (e = ++i; e < f; e++) if (d.relative[a[e].type]) break;return xa(i > 1 && ua(m), i > 1 && sa(a.slice(0, i - 1).concat({ value: " " === a[i - 2].type ? "*" : "" })).replace(P, "$1"), c, i < e && ya(a.slice(i, e)), e < f && ya(a = a.slice(e)), e < f && sa(a));
                    }m.push(c);
                }return ua(m);
            }function za(a, b) {
                var c = b.length > 0,
                    e = a.length > 0,
                    f = function (f, g, h, i, k) {
                    var l,
                        o,
                        q,
                        r = 0,
                        s = "0",
                        t = f && [],
                        u = [],
                        v = j,
                        x = f || e && d.find.TAG("*", k),
                        y = w += null == v ? 1 : Math.random() || .1,
                        z = x.length;for (k && (j = g === n || g || k); s !== z && null != (l = x[s]); s++) {
                        if (e && l) {
                            o = 0, g || l.ownerDocument === n || (m(l), h = !p);while (q = a[o++]) if (q(l, g || n, h)) {
                                i.push(l);break;
                            }k && (w = y);
                        }c && ((l = !q && l) && r--, f && t.push(l));
                    }if (r += s, c && s !== r) {
                        o = 0;while (q = b[o++]) q(t, u, g, h);if (f) {
                            if (r > 0) while (s--) t[s] || u[s] || (u[s] = E.call(i));u = wa(u);
                        }G.apply(i, u), k && !f && u.length > 0 && r + b.length > 1 && ga.uniqueSort(i);
                    }return k && (w = y, j = v), t;
                };return c ? ia(f) : f;
            }return h = ga.compile = function (a, b) {
                var c,
                    d = [],
                    e = [],
                    f = A[a + " "];if (!f) {
                    b || (b = g(a)), c = b.length;while (c--) f = ya(b[c]), f[u] ? d.push(f) : e.push(f);f = A(a, za(e, d)), f.selector = a;
                }return f;
            }, i = ga.select = function (a, b, c, e) {
                var f,
                    i,
                    j,
                    k,
                    l,
                    m = "function" == typeof a && a,
                    n = !e && g(a = m.selector || a);if (c = c || [], 1 === n.length) {
                    if (i = n[0] = n[0].slice(0), i.length > 2 && "ID" === (j = i[0]).type && 9 === b.nodeType && p && d.relative[i[1].type]) {
                        if (b = (d.find.ID(j.matches[0].replace(_, aa), b) || [])[0], !b) return c;m && (b = b.parentNode), a = a.slice(i.shift().value.length);
                    }f = V.needsContext.test(a) ? 0 : i.length;while (f--) {
                        if (j = i[f], d.relative[k = j.type]) break;if ((l = d.find[k]) && (e = l(j.matches[0].replace(_, aa), $.test(i[0].type) && qa(b.parentNode) || b))) {
                            if (i.splice(f, 1), a = e.length && sa(i), !a) return G.apply(c, e), c;break;
                        }
                    }
                }return (m || h(a, n))(e, b, !p, c, !b || $.test(a) && qa(b.parentNode) || b), c;
            }, c.sortStable = u.split("").sort(B).join("") === u, c.detectDuplicates = !!l, m(), c.sortDetached = ja(function (a) {
                return 1 & a.compareDocumentPosition(n.createElement("fieldset"));
            }), ja(function (a) {
                return a.innerHTML = "<a href='#'></a>", "#" === a.firstChild.getAttribute("href");
            }) || ka("type|href|height|width", function (a, b, c) {
                if (!c) return a.getAttribute(b, "type" === b.toLowerCase() ? 1 : 2);
            }), c.attributes && ja(function (a) {
                return a.innerHTML = "<input/>", a.firstChild.setAttribute("value", ""), "" === a.firstChild.getAttribute("value");
            }) || ka("value", function (a, b, c) {
                if (!c && "input" === a.nodeName.toLowerCase()) return a.defaultValue;
            }), ja(function (a) {
                return null == a.getAttribute("disabled");
            }) || ka(J, function (a, b, c) {
                var d;if (!c) return a[b] === !0 ? b.toLowerCase() : (d = a.getAttributeNode(b)) && d.specified ? d.value : null;
            }), ga;
        }(a);r.find = x, r.expr = x.selectors, r.expr[":"] = r.expr.pseudos, r.uniqueSort = r.unique = x.uniqueSort, r.text = x.getText, r.isXMLDoc = x.isXML, r.contains = x.contains, r.escapeSelector = x.escape;var y = function (a, b, c) {
            var d = [],
                e = void 0 !== c;while ((a = a[b]) && 9 !== a.nodeType) if (1 === a.nodeType) {
                if (e && r(a).is(c)) break;d.push(a);
            }return d;
        },
            z = function (a, b) {
            for (var c = []; a; a = a.nextSibling) 1 === a.nodeType && a !== b && c.push(a);return c;
        },
            A = r.expr.match.needsContext;function B(a, b) {
            return a.nodeName && a.nodeName.toLowerCase() === b.toLowerCase();
        }var C = /^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i,
            D = /^.[^:#\[\.,]*$/;function E(a, b, c) {
            return r.isFunction(b) ? r.grep(a, function (a, d) {
                return !!b.call(a, d, a) !== c;
            }) : b.nodeType ? r.grep(a, function (a) {
                return a === b !== c;
            }) : "string" != typeof b ? r.grep(a, function (a) {
                return i.call(b, a) > -1 !== c;
            }) : D.test(b) ? r.filter(b, a, c) : (b = r.filter(b, a), r.grep(a, function (a) {
                return i.call(b, a) > -1 !== c && 1 === a.nodeType;
            }));
        }r.filter = function (a, b, c) {
            var d = b[0];return c && (a = ":not(" + a + ")"), 1 === b.length && 1 === d.nodeType ? r.find.matchesSelector(d, a) ? [d] : [] : r.find.matches(a, r.grep(b, function (a) {
                return 1 === a.nodeType;
            }));
        }, r.fn.extend({ find: function (a) {
                var b,
                    c,
                    d = this.length,
                    e = this;if ("string" != typeof a) return this.pushStack(r(a).filter(function () {
                    for (b = 0; b < d; b++) if (r.contains(e[b], this)) return !0;
                }));for (c = this.pushStack([]), b = 0; b < d; b++) r.find(a, e[b], c);return d > 1 ? r.uniqueSort(c) : c;
            }, filter: function (a) {
                return this.pushStack(E(this, a || [], !1));
            }, not: function (a) {
                return this.pushStack(E(this, a || [], !0));
            }, is: function (a) {
                return !!E(this, "string" == typeof a && A.test(a) ? r(a) : a || [], !1).length;
            } });var F,
            G = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/,
            H = r.fn.init = function (a, b, c) {
            var e, f;if (!a) return this;if (c = c || F, "string" == typeof a) {
                if (e = "<" === a[0] && ">" === a[a.length - 1] && a.length >= 3 ? [null, a, null] : G.exec(a), !e || !e[1] && b) return !b || b.jquery ? (b || c).find(a) : this.constructor(b).find(a);if (e[1]) {
                    if (b = b instanceof r ? b[0] : b, r.merge(this, r.parseHTML(e[1], b && b.nodeType ? b.ownerDocument || b : d, !0)), C.test(e[1]) && r.isPlainObject(b)) for (e in b) r.isFunction(this[e]) ? this[e](b[e]) : this.attr(e, b[e]);return this;
                }return f = d.getElementById(e[2]), f && (this[0] = f, this.length = 1), this;
            }return a.nodeType ? (this[0] = a, this.length = 1, this) : r.isFunction(a) ? void 0 !== c.ready ? c.ready(a) : a(r) : r.makeArray(a, this);
        };H.prototype = r.fn, F = r(d);var I = /^(?:parents|prev(?:Until|All))/,
            J = { children: !0, contents: !0, next: !0, prev: !0 };r.fn.extend({ has: function (a) {
                var b = r(a, this),
                    c = b.length;return this.filter(function () {
                    for (var a = 0; a < c; a++) if (r.contains(this, b[a])) return !0;
                });
            }, closest: function (a, b) {
                var c,
                    d = 0,
                    e = this.length,
                    f = [],
                    g = "string" != typeof a && r(a);if (!A.test(a)) for (; d < e; d++) for (c = this[d]; c && c !== b; c = c.parentNode) if (c.nodeType < 11 && (g ? g.index(c) > -1 : 1 === c.nodeType && r.find.matchesSelector(c, a))) {
                    f.push(c);break;
                }return this.pushStack(f.length > 1 ? r.uniqueSort(f) : f);
            }, index: function (a) {
                return a ? "string" == typeof a ? i.call(r(a), this[0]) : i.call(this, a.jquery ? a[0] : a) : this[0] && this[0].parentNode ? this.first().prevAll().length : -1;
            }, add: function (a, b) {
                return this.pushStack(r.uniqueSort(r.merge(this.get(), r(a, b))));
            }, addBack: function (a) {
                return this.add(null == a ? this.prevObject : this.prevObject.filter(a));
            } });function K(a, b) {
            while ((a = a[b]) && 1 !== a.nodeType);return a;
        }r.each({ parent: function (a) {
                var b = a.parentNode;return b && 11 !== b.nodeType ? b : null;
            }, parents: function (a) {
                return y(a, "parentNode");
            }, parentsUntil: function (a, b, c) {
                return y(a, "parentNode", c);
            }, next: function (a) {
                return K(a, "nextSibling");
            }, prev: function (a) {
                return K(a, "previousSibling");
            }, nextAll: function (a) {
                return y(a, "nextSibling");
            }, prevAll: function (a) {
                return y(a, "previousSibling");
            }, nextUntil: function (a, b, c) {
                return y(a, "nextSibling", c);
            }, prevUntil: function (a, b, c) {
                return y(a, "previousSibling", c);
            }, siblings: function (a) {
                return z((a.parentNode || {}).firstChild, a);
            }, children: function (a) {
                return z(a.firstChild);
            }, contents: function (a) {
                return B(a, "iframe") ? a.contentDocument : (B(a, "template") && (a = a.content || a), r.merge([], a.childNodes));
            } }, function (a, b) {
            r.fn[a] = function (c, d) {
                var e = r.map(this, b, c);return "Until" !== a.slice(-5) && (d = c), d && "string" == typeof d && (e = r.filter(d, e)), this.length > 1 && (J[a] || r.uniqueSort(e), I.test(a) && e.reverse()), this.pushStack(e);
            };
        });var L = /[^\x20\t\r\n\f]+/g;function M(a) {
            var b = {};return r.each(a.match(L) || [], function (a, c) {
                b[c] = !0;
            }), b;
        }r.Callbacks = function (a) {
            a = "string" == typeof a ? M(a) : r.extend({}, a);var b,
                c,
                d,
                e,
                f = [],
                g = [],
                h = -1,
                i = function () {
                for (e = e || a.once, d = b = !0; g.length; h = -1) {
                    c = g.shift();while (++h < f.length) f[h].apply(c[0], c[1]) === !1 && a.stopOnFalse && (h = f.length, c = !1);
                }a.memory || (c = !1), b = !1, e && (f = c ? [] : "");
            },
                j = { add: function () {
                    return f && (c && !b && (h = f.length - 1, g.push(c)), function d(b) {
                        r.each(b, function (b, c) {
                            r.isFunction(c) ? a.unique && j.has(c) || f.push(c) : c && c.length && "string" !== r.type(c) && d(c);
                        });
                    }(arguments), c && !b && i()), this;
                }, remove: function () {
                    return r.each(arguments, function (a, b) {
                        var c;while ((c = r.inArray(b, f, c)) > -1) f.splice(c, 1), c <= h && h--;
                    }), this;
                }, has: function (a) {
                    return a ? r.inArray(a, f) > -1 : f.length > 0;
                }, empty: function () {
                    return f && (f = []), this;
                }, disable: function () {
                    return e = g = [], f = c = "", this;
                }, disabled: function () {
                    return !f;
                }, lock: function () {
                    return e = g = [], c || b || (f = c = ""), this;
                }, locked: function () {
                    return !!e;
                }, fireWith: function (a, c) {
                    return e || (c = c || [], c = [a, c.slice ? c.slice() : c], g.push(c), b || i()), this;
                }, fire: function () {
                    return j.fireWith(this, arguments), this;
                }, fired: function () {
                    return !!d;
                } };return j;
        };function N(a) {
            return a;
        }function O(a) {
            throw a;
        }function P(a, b, c, d) {
            var e;try {
                a && r.isFunction(e = a.promise) ? e.call(a).done(b).fail(c) : a && r.isFunction(e = a.then) ? e.call(a, b, c) : b.apply(void 0, [a].slice(d));
            } catch (a) {
                c.apply(void 0, [a]);
            }
        }r.extend({ Deferred: function (b) {
                var c = [["notify", "progress", r.Callbacks("memory"), r.Callbacks("memory"), 2], ["resolve", "done", r.Callbacks("once memory"), r.Callbacks("once memory"), 0, "resolved"], ["reject", "fail", r.Callbacks("once memory"), r.Callbacks("once memory"), 1, "rejected"]],
                    d = "pending",
                    e = { state: function () {
                        return d;
                    }, always: function () {
                        return f.done(arguments).fail(arguments), this;
                    }, "catch": function (a) {
                        return e.then(null, a);
                    }, pipe: function () {
                        var a = arguments;return r.Deferred(function (b) {
                            r.each(c, function (c, d) {
                                var e = r.isFunction(a[d[4]]) && a[d[4]];f[d[1]](function () {
                                    var a = e && e.apply(this, arguments);a && r.isFunction(a.promise) ? a.promise().progress(b.notify).done(b.resolve).fail(b.reject) : b[d[0] + "With"](this, e ? [a] : arguments);
                                });
                            }), a = null;
                        }).promise();
                    }, then: function (b, d, e) {
                        var f = 0;function g(b, c, d, e) {
                            return function () {
                                var h = this,
                                    i = arguments,
                                    j = function () {
                                    var a, j;if (!(b < f)) {
                                        if (a = d.apply(h, i), a === c.promise()) throw new TypeError("Thenable self-resolution");j = a && ("object" == typeof a || "function" == typeof a) && a.then, r.isFunction(j) ? e ? j.call(a, g(f, c, N, e), g(f, c, O, e)) : (f++, j.call(a, g(f, c, N, e), g(f, c, O, e), g(f, c, N, c.notifyWith))) : (d !== N && (h = void 0, i = [a]), (e || c.resolveWith)(h, i));
                                    }
                                },
                                    k = e ? j : function () {
                                    try {
                                        j();
                                    } catch (a) {
                                        r.Deferred.exceptionHook && r.Deferred.exceptionHook(a, k.stackTrace), b + 1 >= f && (d !== O && (h = void 0, i = [a]), c.rejectWith(h, i));
                                    }
                                };b ? k() : (r.Deferred.getStackHook && (k.stackTrace = r.Deferred.getStackHook()), a.setTimeout(k));
                            };
                        }return r.Deferred(function (a) {
                            c[0][3].add(g(0, a, r.isFunction(e) ? e : N, a.notifyWith)), c[1][3].add(g(0, a, r.isFunction(b) ? b : N)), c[2][3].add(g(0, a, r.isFunction(d) ? d : O));
                        }).promise();
                    }, promise: function (a) {
                        return null != a ? r.extend(a, e) : e;
                    } },
                    f = {};return r.each(c, function (a, b) {
                    var g = b[2],
                        h = b[5];e[b[1]] = g.add, h && g.add(function () {
                        d = h;
                    }, c[3 - a][2].disable, c[0][2].lock), g.add(b[3].fire), f[b[0]] = function () {
                        return f[b[0] + "With"](this === f ? void 0 : this, arguments), this;
                    }, f[b[0] + "With"] = g.fireWith;
                }), e.promise(f), b && b.call(f, f), f;
            }, when: function (a) {
                var b = arguments.length,
                    c = b,
                    d = Array(c),
                    e = f.call(arguments),
                    g = r.Deferred(),
                    h = function (a) {
                    return function (c) {
                        d[a] = this, e[a] = arguments.length > 1 ? f.call(arguments) : c, --b || g.resolveWith(d, e);
                    };
                };if (b <= 1 && (P(a, g.done(h(c)).resolve, g.reject, !b), "pending" === g.state() || r.isFunction(e[c] && e[c].then))) return g.then();while (c--) P(e[c], h(c), g.reject);return g.promise();
            } });var Q = /^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;r.Deferred.exceptionHook = function (b, c) {
            a.console && a.console.warn && b && Q.test(b.name) && a.console.warn("jQuery.Deferred exception: " + b.message, b.stack, c);
        }, r.readyException = function (b) {
            a.setTimeout(function () {
                throw b;
            });
        };var R = r.Deferred();r.fn.ready = function (a) {
            return R.then(a)["catch"](function (a) {
                r.readyException(a);
            }), this;
        }, r.extend({ isReady: !1, readyWait: 1, ready: function (a) {
                (a === !0 ? --r.readyWait : r.isReady) || (r.isReady = !0, a !== !0 && --r.readyWait > 0 || R.resolveWith(d, [r]));
            } }), r.ready.then = R.then;function S() {
            d.removeEventListener("DOMContentLoaded", S), a.removeEventListener("load", S), r.ready();
        }"complete" === d.readyState || "loading" !== d.readyState && !d.documentElement.doScroll ? a.setTimeout(r.ready) : (d.addEventListener("DOMContentLoaded", S), a.addEventListener("load", S));var T = function (a, b, c, d, e, f, g) {
            var h = 0,
                i = a.length,
                j = null == c;if ("object" === r.type(c)) {
                e = !0;for (h in c) T(a, b, h, c[h], !0, f, g);
            } else if (void 0 !== d && (e = !0, r.isFunction(d) || (g = !0), j && (g ? (b.call(a, d), b = null) : (j = b, b = function (a, b, c) {
                return j.call(r(a), c);
            })), b)) for (; h < i; h++) b(a[h], c, g ? d : d.call(a[h], h, b(a[h], c)));return e ? a : j ? b.call(a) : i ? b(a[0], c) : f;
        },
            U = function (a) {
            return 1 === a.nodeType || 9 === a.nodeType || !+a.nodeType;
        };function V() {
            this.expando = r.expando + V.uid++;
        }V.uid = 1, V.prototype = { cache: function (a) {
                var b = a[this.expando];return b || (b = {}, U(a) && (a.nodeType ? a[this.expando] = b : Object.defineProperty(a, this.expando, { value: b, configurable: !0 }))), b;
            }, set: function (a, b, c) {
                var d,
                    e = this.cache(a);if ("string" == typeof b) e[r.camelCase(b)] = c;else for (d in b) e[r.camelCase(d)] = b[d];return e;
            }, get: function (a, b) {
                return void 0 === b ? this.cache(a) : a[this.expando] && a[this.expando][r.camelCase(b)];
            }, access: function (a, b, c) {
                return void 0 === b || b && "string" == typeof b && void 0 === c ? this.get(a, b) : (this.set(a, b, c), void 0 !== c ? c : b);
            }, remove: function (a, b) {
                var c,
                    d = a[this.expando];if (void 0 !== d) {
                    if (void 0 !== b) {
                        Array.isArray(b) ? b = b.map(r.camelCase) : (b = r.camelCase(b), b = b in d ? [b] : b.match(L) || []), c = b.length;while (c--) delete d[b[c]];
                    }(void 0 === b || r.isEmptyObject(d)) && (a.nodeType ? a[this.expando] = void 0 : delete a[this.expando]);
                }
            }, hasData: function (a) {
                var b = a[this.expando];return void 0 !== b && !r.isEmptyObject(b);
            } };var W = new V(),
            X = new V(),
            Y = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
            Z = /[A-Z]/g;function $(a) {
            return "true" === a || "false" !== a && ("null" === a ? null : a === +a + "" ? +a : Y.test(a) ? JSON.parse(a) : a);
        }function _(a, b, c) {
            var d;if (void 0 === c && 1 === a.nodeType) if (d = "data-" + b.replace(Z, "-$&").toLowerCase(), c = a.getAttribute(d), "string" == typeof c) {
                try {
                    c = $(c);
                } catch (e) {}X.set(a, b, c);
            } else c = void 0;return c;
        }r.extend({ hasData: function (a) {
                return X.hasData(a) || W.hasData(a);
            }, data: function (a, b, c) {
                return X.access(a, b, c);
            }, removeData: function (a, b) {
                X.remove(a, b);
            }, _data: function (a, b, c) {
                return W.access(a, b, c);
            }, _removeData: function (a, b) {
                W.remove(a, b);
            } }), r.fn.extend({ data: function (a, b) {
                var c,
                    d,
                    e,
                    f = this[0],
                    g = f && f.attributes;if (void 0 === a) {
                    if (this.length && (e = X.get(f), 1 === f.nodeType && !W.get(f, "hasDataAttrs"))) {
                        c = g.length;while (c--) g[c] && (d = g[c].name, 0 === d.indexOf("data-") && (d = r.camelCase(d.slice(5)), _(f, d, e[d])));W.set(f, "hasDataAttrs", !0);
                    }return e;
                }return "object" == typeof a ? this.each(function () {
                    X.set(this, a);
                }) : T(this, function (b) {
                    var c;if (f && void 0 === b) {
                        if (c = X.get(f, a), void 0 !== c) return c;if (c = _(f, a), void 0 !== c) return c;
                    } else this.each(function () {
                        X.set(this, a, b);
                    });
                }, null, b, arguments.length > 1, null, !0);
            }, removeData: function (a) {
                return this.each(function () {
                    X.remove(this, a);
                });
            } }), r.extend({ queue: function (a, b, c) {
                var d;if (a) return b = (b || "fx") + "queue", d = W.get(a, b), c && (!d || Array.isArray(c) ? d = W.access(a, b, r.makeArray(c)) : d.push(c)), d || [];
            }, dequeue: function (a, b) {
                b = b || "fx";var c = r.queue(a, b),
                    d = c.length,
                    e = c.shift(),
                    f = r._queueHooks(a, b),
                    g = function () {
                    r.dequeue(a, b);
                };"inprogress" === e && (e = c.shift(), d--), e && ("fx" === b && c.unshift("inprogress"), delete f.stop, e.call(a, g, f)), !d && f && f.empty.fire();
            }, _queueHooks: function (a, b) {
                var c = b + "queueHooks";return W.get(a, c) || W.access(a, c, { empty: r.Callbacks("once memory").add(function () {
                        W.remove(a, [b + "queue", c]);
                    }) });
            } }), r.fn.extend({ queue: function (a, b) {
                var c = 2;return "string" != typeof a && (b = a, a = "fx", c--), arguments.length < c ? r.queue(this[0], a) : void 0 === b ? this : this.each(function () {
                    var c = r.queue(this, a, b);r._queueHooks(this, a), "fx" === a && "inprogress" !== c[0] && r.dequeue(this, a);
                });
            }, dequeue: function (a) {
                return this.each(function () {
                    r.dequeue(this, a);
                });
            }, clearQueue: function (a) {
                return this.queue(a || "fx", []);
            }, promise: function (a, b) {
                var c,
                    d = 1,
                    e = r.Deferred(),
                    f = this,
                    g = this.length,
                    h = function () {
                    --d || e.resolveWith(f, [f]);
                };"string" != typeof a && (b = a, a = void 0), a = a || "fx";while (g--) c = W.get(f[g], a + "queueHooks"), c && c.empty && (d++, c.empty.add(h));return h(), e.promise(b);
            } });var aa = /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,
            ba = new RegExp("^(?:([+-])=|)(" + aa + ")([a-z%]*)$", "i"),
            ca = ["Top", "Right", "Bottom", "Left"],
            da = function (a, b) {
            return a = b || a, "none" === a.style.display || "" === a.style.display && r.contains(a.ownerDocument, a) && "none" === r.css(a, "display");
        },
            ea = function (a, b, c, d) {
            var e,
                f,
                g = {};for (f in b) g[f] = a.style[f], a.style[f] = b[f];e = c.apply(a, d || []);for (f in b) a.style[f] = g[f];return e;
        };function fa(a, b, c, d) {
            var e,
                f = 1,
                g = 20,
                h = d ? function () {
                return d.cur();
            } : function () {
                return r.css(a, b, "");
            },
                i = h(),
                j = c && c[3] || (r.cssNumber[b] ? "" : "px"),
                k = (r.cssNumber[b] || "px" !== j && +i) && ba.exec(r.css(a, b));if (k && k[3] !== j) {
                j = j || k[3], c = c || [], k = +i || 1;do f = f || ".5", k /= f, r.style(a, b, k + j); while (f !== (f = h() / i) && 1 !== f && --g);
            }return c && (k = +k || +i || 0, e = c[1] ? k + (c[1] + 1) * c[2] : +c[2], d && (d.unit = j, d.start = k, d.end = e)), e;
        }var ga = {};function ha(a) {
            var b,
                c = a.ownerDocument,
                d = a.nodeName,
                e = ga[d];return e ? e : (b = c.body.appendChild(c.createElement(d)), e = r.css(b, "display"), b.parentNode.removeChild(b), "none" === e && (e = "block"), ga[d] = e, e);
        }function ia(a, b) {
            for (var c, d, e = [], f = 0, g = a.length; f < g; f++) d = a[f], d.style && (c = d.style.display, b ? ("none" === c && (e[f] = W.get(d, "display") || null, e[f] || (d.style.display = "")), "" === d.style.display && da(d) && (e[f] = ha(d))) : "none" !== c && (e[f] = "none", W.set(d, "display", c)));for (f = 0; f < g; f++) null != e[f] && (a[f].style.display = e[f]);return a;
        }r.fn.extend({ show: function () {
                return ia(this, !0);
            }, hide: function () {
                return ia(this);
            }, toggle: function (a) {
                return "boolean" == typeof a ? a ? this.show() : this.hide() : this.each(function () {
                    da(this) ? r(this).show() : r(this).hide();
                });
            } });var ja = /^(?:checkbox|radio)$/i,
            ka = /<([a-z][^\/\0>\x20\t\r\n\f]+)/i,
            la = /^$|\/(?:java|ecma)script/i,
            ma = { option: [1, "<select multiple='multiple'>", "</select>"], thead: [1, "<table>", "</table>"], col: [2, "<table><colgroup>", "</colgroup></table>"], tr: [2, "<table><tbody>", "</tbody></table>"], td: [3, "<table><tbody><tr>", "</tr></tbody></table>"], _default: [0, "", ""] };ma.optgroup = ma.option, ma.tbody = ma.tfoot = ma.colgroup = ma.caption = ma.thead, ma.th = ma.td;function na(a, b) {
            var c;return c = "undefined" != typeof a.getElementsByTagName ? a.getElementsByTagName(b || "*") : "undefined" != typeof a.querySelectorAll ? a.querySelectorAll(b || "*") : [], void 0 === b || b && B(a, b) ? r.merge([a], c) : c;
        }function oa(a, b) {
            for (var c = 0, d = a.length; c < d; c++) W.set(a[c], "globalEval", !b || W.get(b[c], "globalEval"));
        }var pa = /<|&#?\w+;/;function qa(a, b, c, d, e) {
            for (var f, g, h, i, j, k, l = b.createDocumentFragment(), m = [], n = 0, o = a.length; n < o; n++) if (f = a[n], f || 0 === f) if ("object" === r.type(f)) r.merge(m, f.nodeType ? [f] : f);else if (pa.test(f)) {
                g = g || l.appendChild(b.createElement("div")), h = (ka.exec(f) || ["", ""])[1].toLowerCase(), i = ma[h] || ma._default, g.innerHTML = i[1] + r.htmlPrefilter(f) + i[2], k = i[0];while (k--) g = g.lastChild;r.merge(m, g.childNodes), g = l.firstChild, g.textContent = "";
            } else m.push(b.createTextNode(f));l.textContent = "", n = 0;while (f = m[n++]) if (d && r.inArray(f, d) > -1) e && e.push(f);else if (j = r.contains(f.ownerDocument, f), g = na(l.appendChild(f), "script"), j && oa(g), c) {
                k = 0;while (f = g[k++]) la.test(f.type || "") && c.push(f);
            }return l;
        }!function () {
            var a = d.createDocumentFragment(),
                b = a.appendChild(d.createElement("div")),
                c = d.createElement("input");c.setAttribute("type", "radio"), c.setAttribute("checked", "checked"), c.setAttribute("name", "t"), b.appendChild(c), o.checkClone = b.cloneNode(!0).cloneNode(!0).lastChild.checked, b.innerHTML = "<textarea>x</textarea>", o.noCloneChecked = !!b.cloneNode(!0).lastChild.defaultValue;
        }();var ra = d.documentElement,
            sa = /^key/,
            ta = /^(?:mouse|pointer|contextmenu|drag|drop)|click/,
            ua = /^([^.]*)(?:\.(.+)|)/;function va() {
            return !0;
        }function wa() {
            return !1;
        }function xa() {
            try {
                return d.activeElement;
            } catch (a) {}
        }function ya(a, b, c, d, e, f) {
            var g, h;if ("object" == typeof b) {
                "string" != typeof c && (d = d || c, c = void 0);for (h in b) ya(a, h, c, d, b[h], f);return a;
            }if (null == d && null == e ? (e = c, d = c = void 0) : null == e && ("string" == typeof c ? (e = d, d = void 0) : (e = d, d = c, c = void 0)), e === !1) e = wa;else if (!e) return a;return 1 === f && (g = e, e = function (a) {
                return r().off(a), g.apply(this, arguments);
            }, e.guid = g.guid || (g.guid = r.guid++)), a.each(function () {
                r.event.add(this, b, e, d, c);
            });
        }r.event = { global: {}, add: function (a, b, c, d, e) {
                var f,
                    g,
                    h,
                    i,
                    j,
                    k,
                    l,
                    m,
                    n,
                    o,
                    p,
                    q = W.get(a);if (q) {
                    c.handler && (f = c, c = f.handler, e = f.selector), e && r.find.matchesSelector(ra, e), c.guid || (c.guid = r.guid++), (i = q.events) || (i = q.events = {}), (g = q.handle) || (g = q.handle = function (b) {
                        return "undefined" != typeof r && r.event.triggered !== b.type ? r.event.dispatch.apply(a, arguments) : void 0;
                    }), b = (b || "").match(L) || [""], j = b.length;while (j--) h = ua.exec(b[j]) || [], n = p = h[1], o = (h[2] || "").split(".").sort(), n && (l = r.event.special[n] || {}, n = (e ? l.delegateType : l.bindType) || n, l = r.event.special[n] || {}, k = r.extend({ type: n, origType: p, data: d, handler: c, guid: c.guid, selector: e, needsContext: e && r.expr.match.needsContext.test(e), namespace: o.join(".") }, f), (m = i[n]) || (m = i[n] = [], m.delegateCount = 0, l.setup && l.setup.call(a, d, o, g) !== !1 || a.addEventListener && a.addEventListener(n, g)), l.add && (l.add.call(a, k), k.handler.guid || (k.handler.guid = c.guid)), e ? m.splice(m.delegateCount++, 0, k) : m.push(k), r.event.global[n] = !0);
                }
            }, remove: function (a, b, c, d, e) {
                var f,
                    g,
                    h,
                    i,
                    j,
                    k,
                    l,
                    m,
                    n,
                    o,
                    p,
                    q = W.hasData(a) && W.get(a);if (q && (i = q.events)) {
                    b = (b || "").match(L) || [""], j = b.length;while (j--) if (h = ua.exec(b[j]) || [], n = p = h[1], o = (h[2] || "").split(".").sort(), n) {
                        l = r.event.special[n] || {}, n = (d ? l.delegateType : l.bindType) || n, m = i[n] || [], h = h[2] && new RegExp("(^|\\.)" + o.join("\\.(?:.*\\.|)") + "(\\.|$)"), g = f = m.length;while (f--) k = m[f], !e && p !== k.origType || c && c.guid !== k.guid || h && !h.test(k.namespace) || d && d !== k.selector && ("**" !== d || !k.selector) || (m.splice(f, 1), k.selector && m.delegateCount--, l.remove && l.remove.call(a, k));g && !m.length && (l.teardown && l.teardown.call(a, o, q.handle) !== !1 || r.removeEvent(a, n, q.handle), delete i[n]);
                    } else for (n in i) r.event.remove(a, n + b[j], c, d, !0);r.isEmptyObject(i) && W.remove(a, "handle events");
                }
            }, dispatch: function (a) {
                var b = r.event.fix(a),
                    c,
                    d,
                    e,
                    f,
                    g,
                    h,
                    i = new Array(arguments.length),
                    j = (W.get(this, "events") || {})[b.type] || [],
                    k = r.event.special[b.type] || {};for (i[0] = b, c = 1; c < arguments.length; c++) i[c] = arguments[c];if (b.delegateTarget = this, !k.preDispatch || k.preDispatch.call(this, b) !== !1) {
                    h = r.event.handlers.call(this, b, j), c = 0;while ((f = h[c++]) && !b.isPropagationStopped()) {
                        b.currentTarget = f.elem, d = 0;while ((g = f.handlers[d++]) && !b.isImmediatePropagationStopped()) b.rnamespace && !b.rnamespace.test(g.namespace) || (b.handleObj = g, b.data = g.data, e = ((r.event.special[g.origType] || {}).handle || g.handler).apply(f.elem, i), void 0 !== e && (b.result = e) === !1 && (b.preventDefault(), b.stopPropagation()));
                    }return k.postDispatch && k.postDispatch.call(this, b), b.result;
                }
            }, handlers: function (a, b) {
                var c,
                    d,
                    e,
                    f,
                    g,
                    h = [],
                    i = b.delegateCount,
                    j = a.target;if (i && j.nodeType && !("click" === a.type && a.button >= 1)) for (; j !== this; j = j.parentNode || this) if (1 === j.nodeType && ("click" !== a.type || j.disabled !== !0)) {
                    for (f = [], g = {}, c = 0; c < i; c++) d = b[c], e = d.selector + " ", void 0 === g[e] && (g[e] = d.needsContext ? r(e, this).index(j) > -1 : r.find(e, this, null, [j]).length), g[e] && f.push(d);f.length && h.push({ elem: j, handlers: f });
                }return j = this, i < b.length && h.push({ elem: j, handlers: b.slice(i) }), h;
            }, addProp: function (a, b) {
                Object.defineProperty(r.Event.prototype, a, { enumerable: !0, configurable: !0, get: r.isFunction(b) ? function () {
                        if (this.originalEvent) return b(this.originalEvent);
                    } : function () {
                        if (this.originalEvent) return this.originalEvent[a];
                    }, set: function (b) {
                        Object.defineProperty(this, a, { enumerable: !0, configurable: !0, writable: !0, value: b });
                    } });
            }, fix: function (a) {
                return a[r.expando] ? a : new r.Event(a);
            }, special: { load: { noBubble: !0 }, focus: { trigger: function () {
                        if (this !== xa() && this.focus) return this.focus(), !1;
                    }, delegateType: "focusin" }, blur: { trigger: function () {
                        if (this === xa() && this.blur) return this.blur(), !1;
                    }, delegateType: "focusout" }, click: { trigger: function () {
                        if ("checkbox" === this.type && this.click && B(this, "input")) return this.click(), !1;
                    }, _default: function (a) {
                        return B(a.target, "a");
                    } }, beforeunload: { postDispatch: function (a) {
                        void 0 !== a.result && a.originalEvent && (a.originalEvent.returnValue = a.result);
                    } } } }, r.removeEvent = function (a, b, c) {
            a.removeEventListener && a.removeEventListener(b, c);
        }, r.Event = function (a, b) {
            return this instanceof r.Event ? (a && a.type ? (this.originalEvent = a, this.type = a.type, this.isDefaultPrevented = a.defaultPrevented || void 0 === a.defaultPrevented && a.returnValue === !1 ? va : wa, this.target = a.target && 3 === a.target.nodeType ? a.target.parentNode : a.target, this.currentTarget = a.currentTarget, this.relatedTarget = a.relatedTarget) : this.type = a, b && r.extend(this, b), this.timeStamp = a && a.timeStamp || r.now(), void (this[r.expando] = !0)) : new r.Event(a, b);
        }, r.Event.prototype = { constructor: r.Event, isDefaultPrevented: wa, isPropagationStopped: wa, isImmediatePropagationStopped: wa, isSimulated: !1, preventDefault: function () {
                var a = this.originalEvent;this.isDefaultPrevented = va, a && !this.isSimulated && a.preventDefault();
            }, stopPropagation: function () {
                var a = this.originalEvent;this.isPropagationStopped = va, a && !this.isSimulated && a.stopPropagation();
            }, stopImmediatePropagation: function () {
                var a = this.originalEvent;this.isImmediatePropagationStopped = va, a && !this.isSimulated && a.stopImmediatePropagation(), this.stopPropagation();
            } }, r.each({ altKey: !0, bubbles: !0, cancelable: !0, changedTouches: !0, ctrlKey: !0, detail: !0, eventPhase: !0, metaKey: !0, pageX: !0, pageY: !0, shiftKey: !0, view: !0, "char": !0, charCode: !0, key: !0, keyCode: !0, button: !0, buttons: !0, clientX: !0, clientY: !0, offsetX: !0, offsetY: !0, pointerId: !0, pointerType: !0, screenX: !0, screenY: !0, targetTouches: !0, toElement: !0, touches: !0, which: function (a) {
                var b = a.button;return null == a.which && sa.test(a.type) ? null != a.charCode ? a.charCode : a.keyCode : !a.which && void 0 !== b && ta.test(a.type) ? 1 & b ? 1 : 2 & b ? 3 : 4 & b ? 2 : 0 : a.which;
            } }, r.event.addProp), r.each({ mouseenter: "mouseover", mouseleave: "mouseout", pointerenter: "pointerover", pointerleave: "pointerout" }, function (a, b) {
            r.event.special[a] = { delegateType: b, bindType: b, handle: function (a) {
                    var c,
                        d = this,
                        e = a.relatedTarget,
                        f = a.handleObj;return e && (e === d || r.contains(d, e)) || (a.type = f.origType, c = f.handler.apply(this, arguments), a.type = b), c;
                } };
        }), r.fn.extend({ on: function (a, b, c, d) {
                return ya(this, a, b, c, d);
            }, one: function (a, b, c, d) {
                return ya(this, a, b, c, d, 1);
            }, off: function (a, b, c) {
                var d, e;if (a && a.preventDefault && a.handleObj) return d = a.handleObj, r(a.delegateTarget).off(d.namespace ? d.origType + "." + d.namespace : d.origType, d.selector, d.handler), this;if ("object" == typeof a) {
                    for (e in a) this.off(e, b, a[e]);return this;
                }return b !== !1 && "function" != typeof b || (c = b, b = void 0), c === !1 && (c = wa), this.each(function () {
                    r.event.remove(this, a, c, b);
                });
            } });var za = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([a-z][^\/\0>\x20\t\r\n\f]*)[^>]*)\/>/gi,
            Aa = /<script|<style|<link/i,
            Ba = /checked\s*(?:[^=]|=\s*.checked.)/i,
            Ca = /^true\/(.*)/,
            Da = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g;function Ea(a, b) {
            return B(a, "table") && B(11 !== b.nodeType ? b : b.firstChild, "tr") ? r(">tbody", a)[0] || a : a;
        }function Fa(a) {
            return a.type = (null !== a.getAttribute("type")) + "/" + a.type, a;
        }function Ga(a) {
            var b = Ca.exec(a.type);return b ? a.type = b[1] : a.removeAttribute("type"), a;
        }function Ha(a, b) {
            var c, d, e, f, g, h, i, j;if (1 === b.nodeType) {
                if (W.hasData(a) && (f = W.access(a), g = W.set(b, f), j = f.events)) {
                    delete g.handle, g.events = {};for (e in j) for (c = 0, d = j[e].length; c < d; c++) r.event.add(b, e, j[e][c]);
                }X.hasData(a) && (h = X.access(a), i = r.extend({}, h), X.set(b, i));
            }
        }function Ia(a, b) {
            var c = b.nodeName.toLowerCase();"input" === c && ja.test(a.type) ? b.checked = a.checked : "input" !== c && "textarea" !== c || (b.defaultValue = a.defaultValue);
        }function Ja(a, b, c, d) {
            b = g.apply([], b);var e,
                f,
                h,
                i,
                j,
                k,
                l = 0,
                m = a.length,
                n = m - 1,
                q = b[0],
                s = r.isFunction(q);if (s || m > 1 && "string" == typeof q && !o.checkClone && Ba.test(q)) return a.each(function (e) {
                var f = a.eq(e);s && (b[0] = q.call(this, e, f.html())), Ja(f, b, c, d);
            });if (m && (e = qa(b, a[0].ownerDocument, !1, a, d), f = e.firstChild, 1 === e.childNodes.length && (e = f), f || d)) {
                for (h = r.map(na(e, "script"), Fa), i = h.length; l < m; l++) j = e, l !== n && (j = r.clone(j, !0, !0), i && r.merge(h, na(j, "script"))), c.call(a[l], j, l);if (i) for (k = h[h.length - 1].ownerDocument, r.map(h, Ga), l = 0; l < i; l++) j = h[l], la.test(j.type || "") && !W.access(j, "globalEval") && r.contains(k, j) && (j.src ? r._evalUrl && r._evalUrl(j.src) : p(j.textContent.replace(Da, ""), k));
            }return a;
        }function Ka(a, b, c) {
            for (var d, e = b ? r.filter(b, a) : a, f = 0; null != (d = e[f]); f++) c || 1 !== d.nodeType || r.cleanData(na(d)), d.parentNode && (c && r.contains(d.ownerDocument, d) && oa(na(d, "script")), d.parentNode.removeChild(d));return a;
        }r.extend({ htmlPrefilter: function (a) {
                return a.replace(za, "<$1></$2>");
            }, clone: function (a, b, c) {
                var d,
                    e,
                    f,
                    g,
                    h = a.cloneNode(!0),
                    i = r.contains(a.ownerDocument, a);if (!(o.noCloneChecked || 1 !== a.nodeType && 11 !== a.nodeType || r.isXMLDoc(a))) for (g = na(h), f = na(a), d = 0, e = f.length; d < e; d++) Ia(f[d], g[d]);if (b) if (c) for (f = f || na(a), g = g || na(h), d = 0, e = f.length; d < e; d++) Ha(f[d], g[d]);else Ha(a, h);return g = na(h, "script"), g.length > 0 && oa(g, !i && na(a, "script")), h;
            }, cleanData: function (a) {
                for (var b, c, d, e = r.event.special, f = 0; void 0 !== (c = a[f]); f++) if (U(c)) {
                    if (b = c[W.expando]) {
                        if (b.events) for (d in b.events) e[d] ? r.event.remove(c, d) : r.removeEvent(c, d, b.handle);c[W.expando] = void 0;
                    }c[X.expando] && (c[X.expando] = void 0);
                }
            } }), r.fn.extend({ detach: function (a) {
                return Ka(this, a, !0);
            }, remove: function (a) {
                return Ka(this, a);
            }, text: function (a) {
                return T(this, function (a) {
                    return void 0 === a ? r.text(this) : this.empty().each(function () {
                        1 !== this.nodeType && 11 !== this.nodeType && 9 !== this.nodeType || (this.textContent = a);
                    });
                }, null, a, arguments.length);
            }, append: function () {
                return Ja(this, arguments, function (a) {
                    if (1 === this.nodeType || 11 === this.nodeType || 9 === this.nodeType) {
                        var b = Ea(this, a);b.appendChild(a);
                    }
                });
            }, prepend: function () {
                return Ja(this, arguments, function (a) {
                    if (1 === this.nodeType || 11 === this.nodeType || 9 === this.nodeType) {
                        var b = Ea(this, a);b.insertBefore(a, b.firstChild);
                    }
                });
            }, before: function () {
                return Ja(this, arguments, function (a) {
                    this.parentNode && this.parentNode.insertBefore(a, this);
                });
            }, after: function () {
                return Ja(this, arguments, function (a) {
                    this.parentNode && this.parentNode.insertBefore(a, this.nextSibling);
                });
            }, empty: function () {
                for (var a, b = 0; null != (a = this[b]); b++) 1 === a.nodeType && (r.cleanData(na(a, !1)), a.textContent = "");return this;
            }, clone: function (a, b) {
                return a = null != a && a, b = null == b ? a : b, this.map(function () {
                    return r.clone(this, a, b);
                });
            }, html: function (a) {
                return T(this, function (a) {
                    var b = this[0] || {},
                        c = 0,
                        d = this.length;if (void 0 === a && 1 === b.nodeType) return b.innerHTML;if ("string" == typeof a && !Aa.test(a) && !ma[(ka.exec(a) || ["", ""])[1].toLowerCase()]) {
                        a = r.htmlPrefilter(a);try {
                            for (; c < d; c++) b = this[c] || {}, 1 === b.nodeType && (r.cleanData(na(b, !1)), b.innerHTML = a);b = 0;
                        } catch (e) {}
                    }b && this.empty().append(a);
                }, null, a, arguments.length);
            }, replaceWith: function () {
                var a = [];return Ja(this, arguments, function (b) {
                    var c = this.parentNode;r.inArray(this, a) < 0 && (r.cleanData(na(this)), c && c.replaceChild(b, this));
                }, a);
            } }), r.each({ appendTo: "append", prependTo: "prepend", insertBefore: "before", insertAfter: "after", replaceAll: "replaceWith" }, function (a, b) {
            r.fn[a] = function (a) {
                for (var c, d = [], e = r(a), f = e.length - 1, g = 0; g <= f; g++) c = g === f ? this : this.clone(!0), r(e[g])[b](c), h.apply(d, c.get());return this.pushStack(d);
            };
        });var La = /^margin/,
            Ma = new RegExp("^(" + aa + ")(?!px)[a-z%]+$", "i"),
            Na = function (b) {
            var c = b.ownerDocument.defaultView;return c && c.opener || (c = a), c.getComputedStyle(b);
        };!function () {
            function b() {
                if (i) {
                    i.style.cssText = "box-sizing:border-box;position:relative;display:block;margin:auto;border:1px;padding:1px;top:1%;width:50%", i.innerHTML = "", ra.appendChild(h);var b = a.getComputedStyle(i);c = "1%" !== b.top, g = "2px" === b.marginLeft, e = "4px" === b.width, i.style.marginRight = "50%", f = "4px" === b.marginRight, ra.removeChild(h), i = null;
                }
            }var c,
                e,
                f,
                g,
                h = d.createElement("div"),
                i = d.createElement("div");i.style && (i.style.backgroundClip = "content-box", i.cloneNode(!0).style.backgroundClip = "", o.clearCloneStyle = "content-box" === i.style.backgroundClip, h.style.cssText = "border:0;width:8px;height:0;top:0;left:-9999px;padding:0;margin-top:1px;position:absolute", h.appendChild(i), r.extend(o, { pixelPosition: function () {
                    return b(), c;
                }, boxSizingReliable: function () {
                    return b(), e;
                }, pixelMarginRight: function () {
                    return b(), f;
                }, reliableMarginLeft: function () {
                    return b(), g;
                } }));
        }();function Oa(a, b, c) {
            var d,
                e,
                f,
                g,
                h = a.style;return c = c || Na(a), c && (g = c.getPropertyValue(b) || c[b], "" !== g || r.contains(a.ownerDocument, a) || (g = r.style(a, b)), !o.pixelMarginRight() && Ma.test(g) && La.test(b) && (d = h.width, e = h.minWidth, f = h.maxWidth, h.minWidth = h.maxWidth = h.width = g, g = c.width, h.width = d, h.minWidth = e, h.maxWidth = f)), void 0 !== g ? g + "" : g;
        }function Pa(a, b) {
            return { get: function () {
                    return a() ? void delete this.get : (this.get = b).apply(this, arguments);
                } };
        }var Qa = /^(none|table(?!-c[ea]).+)/,
            Ra = /^--/,
            Sa = { position: "absolute", visibility: "hidden", display: "block" },
            Ta = { letterSpacing: "0", fontWeight: "400" },
            Ua = ["Webkit", "Moz", "ms"],
            Va = d.createElement("div").style;function Wa(a) {
            if (a in Va) return a;var b = a[0].toUpperCase() + a.slice(1),
                c = Ua.length;while (c--) if (a = Ua[c] + b, a in Va) return a;
        }function Xa(a) {
            var b = r.cssProps[a];return b || (b = r.cssProps[a] = Wa(a) || a), b;
        }function Ya(a, b, c) {
            var d = ba.exec(b);return d ? Math.max(0, d[2] - (c || 0)) + (d[3] || "px") : b;
        }function Za(a, b, c, d, e) {
            var f,
                g = 0;for (f = c === (d ? "border" : "content") ? 4 : "width" === b ? 1 : 0; f < 4; f += 2) "margin" === c && (g += r.css(a, c + ca[f], !0, e)), d ? ("content" === c && (g -= r.css(a, "padding" + ca[f], !0, e)), "margin" !== c && (g -= r.css(a, "border" + ca[f] + "Width", !0, e))) : (g += r.css(a, "padding" + ca[f], !0, e), "padding" !== c && (g += r.css(a, "border" + ca[f] + "Width", !0, e)));return g;
        }function $a(a, b, c) {
            var d,
                e = Na(a),
                f = Oa(a, b, e),
                g = "border-box" === r.css(a, "boxSizing", !1, e);return Ma.test(f) ? f : (d = g && (o.boxSizingReliable() || f === a.style[b]), "auto" === f && (f = a["offset" + b[0].toUpperCase() + b.slice(1)]), f = parseFloat(f) || 0, f + Za(a, b, c || (g ? "border" : "content"), d, e) + "px");
        }r.extend({ cssHooks: { opacity: { get: function (a, b) {
                        if (b) {
                            var c = Oa(a, "opacity");return "" === c ? "1" : c;
                        }
                    } } }, cssNumber: { animationIterationCount: !0, columnCount: !0, fillOpacity: !0, flexGrow: !0, flexShrink: !0, fontWeight: !0, lineHeight: !0, opacity: !0, order: !0, orphans: !0, widows: !0, zIndex: !0, zoom: !0 }, cssProps: { "float": "cssFloat" }, style: function (a, b, c, d) {
                if (a && 3 !== a.nodeType && 8 !== a.nodeType && a.style) {
                    var e,
                        f,
                        g,
                        h = r.camelCase(b),
                        i = Ra.test(b),
                        j = a.style;return i || (b = Xa(h)), g = r.cssHooks[b] || r.cssHooks[h], void 0 === c ? g && "get" in g && void 0 !== (e = g.get(a, !1, d)) ? e : j[b] : (f = typeof c, "string" === f && (e = ba.exec(c)) && e[1] && (c = fa(a, b, e), f = "number"), null != c && c === c && ("number" === f && (c += e && e[3] || (r.cssNumber[h] ? "" : "px")), o.clearCloneStyle || "" !== c || 0 !== b.indexOf("background") || (j[b] = "inherit"), g && "set" in g && void 0 === (c = g.set(a, c, d)) || (i ? j.setProperty(b, c) : j[b] = c)), void 0);
                }
            }, css: function (a, b, c, d) {
                var e,
                    f,
                    g,
                    h = r.camelCase(b),
                    i = Ra.test(b);return i || (b = Xa(h)), g = r.cssHooks[b] || r.cssHooks[h], g && "get" in g && (e = g.get(a, !0, c)), void 0 === e && (e = Oa(a, b, d)), "normal" === e && b in Ta && (e = Ta[b]), "" === c || c ? (f = parseFloat(e), c === !0 || isFinite(f) ? f || 0 : e) : e;
            } }), r.each(["height", "width"], function (a, b) {
            r.cssHooks[b] = { get: function (a, c, d) {
                    if (c) return !Qa.test(r.css(a, "display")) || a.getClientRects().length && a.getBoundingClientRect().width ? $a(a, b, d) : ea(a, Sa, function () {
                        return $a(a, b, d);
                    });
                }, set: function (a, c, d) {
                    var e,
                        f = d && Na(a),
                        g = d && Za(a, b, d, "border-box" === r.css(a, "boxSizing", !1, f), f);return g && (e = ba.exec(c)) && "px" !== (e[3] || "px") && (a.style[b] = c, c = r.css(a, b)), Ya(a, c, g);
                } };
        }), r.cssHooks.marginLeft = Pa(o.reliableMarginLeft, function (a, b) {
            if (b) return (parseFloat(Oa(a, "marginLeft")) || a.getBoundingClientRect().left - ea(a, { marginLeft: 0 }, function () {
                return a.getBoundingClientRect().left;
            })) + "px";
        }), r.each({ margin: "", padding: "", border: "Width" }, function (a, b) {
            r.cssHooks[a + b] = { expand: function (c) {
                    for (var d = 0, e = {}, f = "string" == typeof c ? c.split(" ") : [c]; d < 4; d++) e[a + ca[d] + b] = f[d] || f[d - 2] || f[0];return e;
                } }, La.test(a) || (r.cssHooks[a + b].set = Ya);
        }), r.fn.extend({ css: function (a, b) {
                return T(this, function (a, b, c) {
                    var d,
                        e,
                        f = {},
                        g = 0;if (Array.isArray(b)) {
                        for (d = Na(a), e = b.length; g < e; g++) f[b[g]] = r.css(a, b[g], !1, d);return f;
                    }return void 0 !== c ? r.style(a, b, c) : r.css(a, b);
                }, a, b, arguments.length > 1);
            } });function _a(a, b, c, d, e) {
            return new _a.prototype.init(a, b, c, d, e);
        }r.Tween = _a, _a.prototype = { constructor: _a, init: function (a, b, c, d, e, f) {
                this.elem = a, this.prop = c, this.easing = e || r.easing._default, this.options = b, this.start = this.now = this.cur(), this.end = d, this.unit = f || (r.cssNumber[c] ? "" : "px");
            }, cur: function () {
                var a = _a.propHooks[this.prop];return a && a.get ? a.get(this) : _a.propHooks._default.get(this);
            }, run: function (a) {
                var b,
                    c = _a.propHooks[this.prop];return this.options.duration ? this.pos = b = r.easing[this.easing](a, this.options.duration * a, 0, 1, this.options.duration) : this.pos = b = a, this.now = (this.end - this.start) * b + this.start, this.options.step && this.options.step.call(this.elem, this.now, this), c && c.set ? c.set(this) : _a.propHooks._default.set(this), this;
            } }, _a.prototype.init.prototype = _a.prototype, _a.propHooks = { _default: { get: function (a) {
                    var b;return 1 !== a.elem.nodeType || null != a.elem[a.prop] && null == a.elem.style[a.prop] ? a.elem[a.prop] : (b = r.css(a.elem, a.prop, ""), b && "auto" !== b ? b : 0);
                }, set: function (a) {
                    r.fx.step[a.prop] ? r.fx.step[a.prop](a) : 1 !== a.elem.nodeType || null == a.elem.style[r.cssProps[a.prop]] && !r.cssHooks[a.prop] ? a.elem[a.prop] = a.now : r.style(a.elem, a.prop, a.now + a.unit);
                } } }, _a.propHooks.scrollTop = _a.propHooks.scrollLeft = { set: function (a) {
                a.elem.nodeType && a.elem.parentNode && (a.elem[a.prop] = a.now);
            } }, r.easing = { linear: function (a) {
                return a;
            }, swing: function (a) {
                return .5 - Math.cos(a * Math.PI) / 2;
            }, _default: "swing" }, r.fx = _a.prototype.init, r.fx.step = {};var ab,
            bb,
            cb = /^(?:toggle|show|hide)$/,
            db = /queueHooks$/;function eb() {
            bb && (d.hidden === !1 && a.requestAnimationFrame ? a.requestAnimationFrame(eb) : a.setTimeout(eb, r.fx.interval), r.fx.tick());
        }function fb() {
            return a.setTimeout(function () {
                ab = void 0;
            }), ab = r.now();
        }function gb(a, b) {
            var c,
                d = 0,
                e = { height: a };for (b = b ? 1 : 0; d < 4; d += 2 - b) c = ca[d], e["margin" + c] = e["padding" + c] = a;return b && (e.opacity = e.width = a), e;
        }function hb(a, b, c) {
            for (var d, e = (kb.tweeners[b] || []).concat(kb.tweeners["*"]), f = 0, g = e.length; f < g; f++) if (d = e[f].call(c, b, a)) return d;
        }function ib(a, b, c) {
            var d,
                e,
                f,
                g,
                h,
                i,
                j,
                k,
                l = "width" in b || "height" in b,
                m = this,
                n = {},
                o = a.style,
                p = a.nodeType && da(a),
                q = W.get(a, "fxshow");c.queue || (g = r._queueHooks(a, "fx"), null == g.unqueued && (g.unqueued = 0, h = g.empty.fire, g.empty.fire = function () {
                g.unqueued || h();
            }), g.unqueued++, m.always(function () {
                m.always(function () {
                    g.unqueued--, r.queue(a, "fx").length || g.empty.fire();
                });
            }));for (d in b) if (e = b[d], cb.test(e)) {
                if (delete b[d], f = f || "toggle" === e, e === (p ? "hide" : "show")) {
                    if ("show" !== e || !q || void 0 === q[d]) continue;p = !0;
                }n[d] = q && q[d] || r.style(a, d);
            }if (i = !r.isEmptyObject(b), i || !r.isEmptyObject(n)) {
                l && 1 === a.nodeType && (c.overflow = [o.overflow, o.overflowX, o.overflowY], j = q && q.display, null == j && (j = W.get(a, "display")), k = r.css(a, "display"), "none" === k && (j ? k = j : (ia([a], !0), j = a.style.display || j, k = r.css(a, "display"), ia([a]))), ("inline" === k || "inline-block" === k && null != j) && "none" === r.css(a, "float") && (i || (m.done(function () {
                    o.display = j;
                }), null == j && (k = o.display, j = "none" === k ? "" : k)), o.display = "inline-block")), c.overflow && (o.overflow = "hidden", m.always(function () {
                    o.overflow = c.overflow[0], o.overflowX = c.overflow[1], o.overflowY = c.overflow[2];
                })), i = !1;for (d in n) i || (q ? "hidden" in q && (p = q.hidden) : q = W.access(a, "fxshow", { display: j }), f && (q.hidden = !p), p && ia([a], !0), m.done(function () {
                    p || ia([a]), W.remove(a, "fxshow");for (d in n) r.style(a, d, n[d]);
                })), i = hb(p ? q[d] : 0, d, m), d in q || (q[d] = i.start, p && (i.end = i.start, i.start = 0));
            }
        }function jb(a, b) {
            var c, d, e, f, g;for (c in a) if (d = r.camelCase(c), e = b[d], f = a[c], Array.isArray(f) && (e = f[1], f = a[c] = f[0]), c !== d && (a[d] = f, delete a[c]), g = r.cssHooks[d], g && "expand" in g) {
                f = g.expand(f), delete a[d];for (c in f) c in a || (a[c] = f[c], b[c] = e);
            } else b[d] = e;
        }function kb(a, b, c) {
            var d,
                e,
                f = 0,
                g = kb.prefilters.length,
                h = r.Deferred().always(function () {
                delete i.elem;
            }),
                i = function () {
                if (e) return !1;for (var b = ab || fb(), c = Math.max(0, j.startTime + j.duration - b), d = c / j.duration || 0, f = 1 - d, g = 0, i = j.tweens.length; g < i; g++) j.tweens[g].run(f);return h.notifyWith(a, [j, f, c]), f < 1 && i ? c : (i || h.notifyWith(a, [j, 1, 0]), h.resolveWith(a, [j]), !1);
            },
                j = h.promise({ elem: a, props: r.extend({}, b), opts: r.extend(!0, { specialEasing: {}, easing: r.easing._default }, c), originalProperties: b, originalOptions: c, startTime: ab || fb(), duration: c.duration, tweens: [], createTween: function (b, c) {
                    var d = r.Tween(a, j.opts, b, c, j.opts.specialEasing[b] || j.opts.easing);return j.tweens.push(d), d;
                }, stop: function (b) {
                    var c = 0,
                        d = b ? j.tweens.length : 0;if (e) return this;for (e = !0; c < d; c++) j.tweens[c].run(1);return b ? (h.notifyWith(a, [j, 1, 0]), h.resolveWith(a, [j, b])) : h.rejectWith(a, [j, b]), this;
                } }),
                k = j.props;for (jb(k, j.opts.specialEasing); f < g; f++) if (d = kb.prefilters[f].call(j, a, k, j.opts)) return r.isFunction(d.stop) && (r._queueHooks(j.elem, j.opts.queue).stop = r.proxy(d.stop, d)), d;return r.map(k, hb, j), r.isFunction(j.opts.start) && j.opts.start.call(a, j), j.progress(j.opts.progress).done(j.opts.done, j.opts.complete).fail(j.opts.fail).always(j.opts.always), r.fx.timer(r.extend(i, { elem: a, anim: j, queue: j.opts.queue })), j;
        }r.Animation = r.extend(kb, { tweeners: { "*": [function (a, b) {
                    var c = this.createTween(a, b);return fa(c.elem, a, ba.exec(b), c), c;
                }] }, tweener: function (a, b) {
                r.isFunction(a) ? (b = a, a = ["*"]) : a = a.match(L);for (var c, d = 0, e = a.length; d < e; d++) c = a[d], kb.tweeners[c] = kb.tweeners[c] || [], kb.tweeners[c].unshift(b);
            }, prefilters: [ib], prefilter: function (a, b) {
                b ? kb.prefilters.unshift(a) : kb.prefilters.push(a);
            } }), r.speed = function (a, b, c) {
            var d = a && "object" == typeof a ? r.extend({}, a) : { complete: c || !c && b || r.isFunction(a) && a, duration: a, easing: c && b || b && !r.isFunction(b) && b };return r.fx.off ? d.duration = 0 : "number" != typeof d.duration && (d.duration in r.fx.speeds ? d.duration = r.fx.speeds[d.duration] : d.duration = r.fx.speeds._default), null != d.queue && d.queue !== !0 || (d.queue = "fx"), d.old = d.complete, d.complete = function () {
                r.isFunction(d.old) && d.old.call(this), d.queue && r.dequeue(this, d.queue);
            }, d;
        }, r.fn.extend({ fadeTo: function (a, b, c, d) {
                return this.filter(da).css("opacity", 0).show().end().animate({ opacity: b }, a, c, d);
            }, animate: function (a, b, c, d) {
                var e = r.isEmptyObject(a),
                    f = r.speed(b, c, d),
                    g = function () {
                    var b = kb(this, r.extend({}, a), f);(e || W.get(this, "finish")) && b.stop(!0);
                };return g.finish = g, e || f.queue === !1 ? this.each(g) : this.queue(f.queue, g);
            }, stop: function (a, b, c) {
                var d = function (a) {
                    var b = a.stop;delete a.stop, b(c);
                };return "string" != typeof a && (c = b, b = a, a = void 0), b && a !== !1 && this.queue(a || "fx", []), this.each(function () {
                    var b = !0,
                        e = null != a && a + "queueHooks",
                        f = r.timers,
                        g = W.get(this);if (e) g[e] && g[e].stop && d(g[e]);else for (e in g) g[e] && g[e].stop && db.test(e) && d(g[e]);for (e = f.length; e--;) f[e].elem !== this || null != a && f[e].queue !== a || (f[e].anim.stop(c), b = !1, f.splice(e, 1));!b && c || r.dequeue(this, a);
                });
            }, finish: function (a) {
                return a !== !1 && (a = a || "fx"), this.each(function () {
                    var b,
                        c = W.get(this),
                        d = c[a + "queue"],
                        e = c[a + "queueHooks"],
                        f = r.timers,
                        g = d ? d.length : 0;for (c.finish = !0, r.queue(this, a, []), e && e.stop && e.stop.call(this, !0), b = f.length; b--;) f[b].elem === this && f[b].queue === a && (f[b].anim.stop(!0), f.splice(b, 1));for (b = 0; b < g; b++) d[b] && d[b].finish && d[b].finish.call(this);delete c.finish;
                });
            } }), r.each(["toggle", "show", "hide"], function (a, b) {
            var c = r.fn[b];r.fn[b] = function (a, d, e) {
                return null == a || "boolean" == typeof a ? c.apply(this, arguments) : this.animate(gb(b, !0), a, d, e);
            };
        }), r.each({ slideDown: gb("show"), slideUp: gb("hide"), slideToggle: gb("toggle"), fadeIn: { opacity: "show" }, fadeOut: { opacity: "hide" }, fadeToggle: { opacity: "toggle" } }, function (a, b) {
            r.fn[a] = function (a, c, d) {
                return this.animate(b, a, c, d);
            };
        }), r.timers = [], r.fx.tick = function () {
            var a,
                b = 0,
                c = r.timers;for (ab = r.now(); b < c.length; b++) a = c[b], a() || c[b] !== a || c.splice(b--, 1);c.length || r.fx.stop(), ab = void 0;
        }, r.fx.timer = function (a) {
            r.timers.push(a), r.fx.start();
        }, r.fx.interval = 13, r.fx.start = function () {
            bb || (bb = !0, eb());
        }, r.fx.stop = function () {
            bb = null;
        }, r.fx.speeds = { slow: 600, fast: 200, _default: 400 }, r.fn.delay = function (b, c) {
            return b = r.fx ? r.fx.speeds[b] || b : b, c = c || "fx", this.queue(c, function (c, d) {
                var e = a.setTimeout(c, b);d.stop = function () {
                    a.clearTimeout(e);
                };
            });
        }, function () {
            var a = d.createElement("input"),
                b = d.createElement("select"),
                c = b.appendChild(d.createElement("option"));a.type = "checkbox", o.checkOn = "" !== a.value, o.optSelected = c.selected, a = d.createElement("input"), a.value = "t", a.type = "radio", o.radioValue = "t" === a.value;
        }();var lb,
            mb = r.expr.attrHandle;r.fn.extend({ attr: function (a, b) {
                return T(this, r.attr, a, b, arguments.length > 1);
            }, removeAttr: function (a) {
                return this.each(function () {
                    r.removeAttr(this, a);
                });
            } }), r.extend({ attr: function (a, b, c) {
                var d,
                    e,
                    f = a.nodeType;if (3 !== f && 8 !== f && 2 !== f) return "undefined" == typeof a.getAttribute ? r.prop(a, b, c) : (1 === f && r.isXMLDoc(a) || (e = r.attrHooks[b.toLowerCase()] || (r.expr.match.bool.test(b) ? lb : void 0)), void 0 !== c ? null === c ? void r.removeAttr(a, b) : e && "set" in e && void 0 !== (d = e.set(a, c, b)) ? d : (a.setAttribute(b, c + ""), c) : e && "get" in e && null !== (d = e.get(a, b)) ? d : (d = r.find.attr(a, b), null == d ? void 0 : d));
            }, attrHooks: { type: { set: function (a, b) {
                        if (!o.radioValue && "radio" === b && B(a, "input")) {
                            var c = a.value;return a.setAttribute("type", b), c && (a.value = c), b;
                        }
                    } } }, removeAttr: function (a, b) {
                var c,
                    d = 0,
                    e = b && b.match(L);if (e && 1 === a.nodeType) while (c = e[d++]) a.removeAttribute(c);
            } }), lb = { set: function (a, b, c) {
                return b === !1 ? r.removeAttr(a, c) : a.setAttribute(c, c), c;
            } }, r.each(r.expr.match.bool.source.match(/\w+/g), function (a, b) {
            var c = mb[b] || r.find.attr;mb[b] = function (a, b, d) {
                var e,
                    f,
                    g = b.toLowerCase();return d || (f = mb[g], mb[g] = e, e = null != c(a, b, d) ? g : null, mb[g] = f), e;
            };
        });var nb = /^(?:input|select|textarea|button)$/i,
            ob = /^(?:a|area)$/i;r.fn.extend({ prop: function (a, b) {
                return T(this, r.prop, a, b, arguments.length > 1);
            }, removeProp: function (a) {
                return this.each(function () {
                    delete this[r.propFix[a] || a];
                });
            } }), r.extend({ prop: function (a, b, c) {
                var d,
                    e,
                    f = a.nodeType;if (3 !== f && 8 !== f && 2 !== f) return 1 === f && r.isXMLDoc(a) || (b = r.propFix[b] || b, e = r.propHooks[b]), void 0 !== c ? e && "set" in e && void 0 !== (d = e.set(a, c, b)) ? d : a[b] = c : e && "get" in e && null !== (d = e.get(a, b)) ? d : a[b];
            }, propHooks: { tabIndex: { get: function (a) {
                        var b = r.find.attr(a, "tabindex");return b ? parseInt(b, 10) : nb.test(a.nodeName) || ob.test(a.nodeName) && a.href ? 0 : -1;
                    } } }, propFix: { "for": "htmlFor", "class": "className" } }), o.optSelected || (r.propHooks.selected = { get: function (a) {
                var b = a.parentNode;return b && b.parentNode && b.parentNode.selectedIndex, null;
            }, set: function (a) {
                var b = a.parentNode;b && (b.selectedIndex, b.parentNode && b.parentNode.selectedIndex);
            } }), r.each(["tabIndex", "readOnly", "maxLength", "cellSpacing", "cellPadding", "rowSpan", "colSpan", "useMap", "frameBorder", "contentEditable"], function () {
            r.propFix[this.toLowerCase()] = this;
        });function pb(a) {
            var b = a.match(L) || [];return b.join(" ");
        }function qb(a) {
            return a.getAttribute && a.getAttribute("class") || "";
        }r.fn.extend({ addClass: function (a) {
                var b,
                    c,
                    d,
                    e,
                    f,
                    g,
                    h,
                    i = 0;if (r.isFunction(a)) return this.each(function (b) {
                    r(this).addClass(a.call(this, b, qb(this)));
                });if ("string" == typeof a && a) {
                    b = a.match(L) || [];while (c = this[i++]) if (e = qb(c), d = 1 === c.nodeType && " " + pb(e) + " ") {
                        g = 0;while (f = b[g++]) d.indexOf(" " + f + " ") < 0 && (d += f + " ");h = pb(d), e !== h && c.setAttribute("class", h);
                    }
                }return this;
            }, removeClass: function (a) {
                var b,
                    c,
                    d,
                    e,
                    f,
                    g,
                    h,
                    i = 0;if (r.isFunction(a)) return this.each(function (b) {
                    r(this).removeClass(a.call(this, b, qb(this)));
                });if (!arguments.length) return this.attr("class", "");if ("string" == typeof a && a) {
                    b = a.match(L) || [];while (c = this[i++]) if (e = qb(c), d = 1 === c.nodeType && " " + pb(e) + " ") {
                        g = 0;while (f = b[g++]) while (d.indexOf(" " + f + " ") > -1) d = d.replace(" " + f + " ", " ");h = pb(d), e !== h && c.setAttribute("class", h);
                    }
                }return this;
            }, toggleClass: function (a, b) {
                var c = typeof a;return "boolean" == typeof b && "string" === c ? b ? this.addClass(a) : this.removeClass(a) : r.isFunction(a) ? this.each(function (c) {
                    r(this).toggleClass(a.call(this, c, qb(this), b), b);
                }) : this.each(function () {
                    var b, d, e, f;if ("string" === c) {
                        d = 0, e = r(this), f = a.match(L) || [];while (b = f[d++]) e.hasClass(b) ? e.removeClass(b) : e.addClass(b);
                    } else void 0 !== a && "boolean" !== c || (b = qb(this), b && W.set(this, "__className__", b), this.setAttribute && this.setAttribute("class", b || a === !1 ? "" : W.get(this, "__className__") || ""));
                });
            }, hasClass: function (a) {
                var b,
                    c,
                    d = 0;b = " " + a + " ";while (c = this[d++]) if (1 === c.nodeType && (" " + pb(qb(c)) + " ").indexOf(b) > -1) return !0;return !1;
            } });var rb = /\r/g;r.fn.extend({ val: function (a) {
                var b,
                    c,
                    d,
                    e = this[0];{
                    if (arguments.length) return d = r.isFunction(a), this.each(function (c) {
                        var e;1 === this.nodeType && (e = d ? a.call(this, c, r(this).val()) : a, null == e ? e = "" : "number" == typeof e ? e += "" : Array.isArray(e) && (e = r.map(e, function (a) {
                            return null == a ? "" : a + "";
                        })), b = r.valHooks[this.type] || r.valHooks[this.nodeName.toLowerCase()], b && "set" in b && void 0 !== b.set(this, e, "value") || (this.value = e));
                    });if (e) return b = r.valHooks[e.type] || r.valHooks[e.nodeName.toLowerCase()], b && "get" in b && void 0 !== (c = b.get(e, "value")) ? c : (c = e.value, "string" == typeof c ? c.replace(rb, "") : null == c ? "" : c);
                }
            } }), r.extend({ valHooks: { option: { get: function (a) {
                        var b = r.find.attr(a, "value");return null != b ? b : pb(r.text(a));
                    } }, select: { get: function (a) {
                        var b,
                            c,
                            d,
                            e = a.options,
                            f = a.selectedIndex,
                            g = "select-one" === a.type,
                            h = g ? null : [],
                            i = g ? f + 1 : e.length;for (d = f < 0 ? i : g ? f : 0; d < i; d++) if (c = e[d], (c.selected || d === f) && !c.disabled && (!c.parentNode.disabled || !B(c.parentNode, "optgroup"))) {
                            if (b = r(c).val(), g) return b;h.push(b);
                        }return h;
                    }, set: function (a, b) {
                        var c,
                            d,
                            e = a.options,
                            f = r.makeArray(b),
                            g = e.length;while (g--) d = e[g], (d.selected = r.inArray(r.valHooks.option.get(d), f) > -1) && (c = !0);return c || (a.selectedIndex = -1), f;
                    } } } }), r.each(["radio", "checkbox"], function () {
            r.valHooks[this] = { set: function (a, b) {
                    if (Array.isArray(b)) return a.checked = r.inArray(r(a).val(), b) > -1;
                } }, o.checkOn || (r.valHooks[this].get = function (a) {
                return null === a.getAttribute("value") ? "on" : a.value;
            });
        });var sb = /^(?:focusinfocus|focusoutblur)$/;r.extend(r.event, { trigger: function (b, c, e, f) {
                var g,
                    h,
                    i,
                    j,
                    k,
                    m,
                    n,
                    o = [e || d],
                    p = l.call(b, "type") ? b.type : b,
                    q = l.call(b, "namespace") ? b.namespace.split(".") : [];if (h = i = e = e || d, 3 !== e.nodeType && 8 !== e.nodeType && !sb.test(p + r.event.triggered) && (p.indexOf(".") > -1 && (q = p.split("."), p = q.shift(), q.sort()), k = p.indexOf(":") < 0 && "on" + p, b = b[r.expando] ? b : new r.Event(p, "object" == typeof b && b), b.isTrigger = f ? 2 : 3, b.namespace = q.join("."), b.rnamespace = b.namespace ? new RegExp("(^|\\.)" + q.join("\\.(?:.*\\.|)") + "(\\.|$)") : null, b.result = void 0, b.target || (b.target = e), c = null == c ? [b] : r.makeArray(c, [b]), n = r.event.special[p] || {}, f || !n.trigger || n.trigger.apply(e, c) !== !1)) {
                    if (!f && !n.noBubble && !r.isWindow(e)) {
                        for (j = n.delegateType || p, sb.test(j + p) || (h = h.parentNode); h; h = h.parentNode) o.push(h), i = h;i === (e.ownerDocument || d) && o.push(i.defaultView || i.parentWindow || a);
                    }g = 0;while ((h = o[g++]) && !b.isPropagationStopped()) b.type = g > 1 ? j : n.bindType || p, m = (W.get(h, "events") || {})[b.type] && W.get(h, "handle"), m && m.apply(h, c), m = k && h[k], m && m.apply && U(h) && (b.result = m.apply(h, c), b.result === !1 && b.preventDefault());return b.type = p, f || b.isDefaultPrevented() || n._default && n._default.apply(o.pop(), c) !== !1 || !U(e) || k && r.isFunction(e[p]) && !r.isWindow(e) && (i = e[k], i && (e[k] = null), r.event.triggered = p, e[p](), r.event.triggered = void 0, i && (e[k] = i)), b.result;
                }
            }, simulate: function (a, b, c) {
                var d = r.extend(new r.Event(), c, { type: a, isSimulated: !0 });r.event.trigger(d, null, b);
            } }), r.fn.extend({ trigger: function (a, b) {
                return this.each(function () {
                    r.event.trigger(a, b, this);
                });
            }, triggerHandler: function (a, b) {
                var c = this[0];if (c) return r.event.trigger(a, b, c, !0);
            } }), r.each("blur focus focusin focusout resize scroll click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup contextmenu".split(" "), function (a, b) {
            r.fn[b] = function (a, c) {
                return arguments.length > 0 ? this.on(b, null, a, c) : this.trigger(b);
            };
        }), r.fn.extend({ hover: function (a, b) {
                return this.mouseenter(a).mouseleave(b || a);
            } }), o.focusin = "onfocusin" in a, o.focusin || r.each({ focus: "focusin", blur: "focusout" }, function (a, b) {
            var c = function (a) {
                r.event.simulate(b, a.target, r.event.fix(a));
            };r.event.special[b] = { setup: function () {
                    var d = this.ownerDocument || this,
                        e = W.access(d, b);e || d.addEventListener(a, c, !0), W.access(d, b, (e || 0) + 1);
                }, teardown: function () {
                    var d = this.ownerDocument || this,
                        e = W.access(d, b) - 1;e ? W.access(d, b, e) : (d.removeEventListener(a, c, !0), W.remove(d, b));
                } };
        });var tb = a.location,
            ub = r.now(),
            vb = /\?/;r.parseXML = function (b) {
            var c;if (!b || "string" != typeof b) return null;try {
                c = new a.DOMParser().parseFromString(b, "text/xml");
            } catch (d) {
                c = void 0;
            }return c && !c.getElementsByTagName("parsererror").length || r.error("Invalid XML: " + b), c;
        };var wb = /\[\]$/,
            xb = /\r?\n/g,
            yb = /^(?:submit|button|image|reset|file)$/i,
            zb = /^(?:input|select|textarea|keygen)/i;function Ab(a, b, c, d) {
            var e;if (Array.isArray(b)) r.each(b, function (b, e) {
                c || wb.test(a) ? d(a, e) : Ab(a + "[" + ("object" == typeof e && null != e ? b : "") + "]", e, c, d);
            });else if (c || "object" !== r.type(b)) d(a, b);else for (e in b) Ab(a + "[" + e + "]", b[e], c, d);
        }r.param = function (a, b) {
            var c,
                d = [],
                e = function (a, b) {
                var c = r.isFunction(b) ? b() : b;d[d.length] = encodeURIComponent(a) + "=" + encodeURIComponent(null == c ? "" : c);
            };if (Array.isArray(a) || a.jquery && !r.isPlainObject(a)) r.each(a, function () {
                e(this.name, this.value);
            });else for (c in a) Ab(c, a[c], b, e);return d.join("&");
        }, r.fn.extend({ serialize: function () {
                return r.param(this.serializeArray());
            }, serializeArray: function () {
                return this.map(function () {
                    var a = r.prop(this, "elements");return a ? r.makeArray(a) : this;
                }).filter(function () {
                    var a = this.type;return this.name && !r(this).is(":disabled") && zb.test(this.nodeName) && !yb.test(a) && (this.checked || !ja.test(a));
                }).map(function (a, b) {
                    var c = r(this).val();return null == c ? null : Array.isArray(c) ? r.map(c, function (a) {
                        return { name: b.name, value: a.replace(xb, "\r\n") };
                    }) : { name: b.name, value: c.replace(xb, "\r\n") };
                }).get();
            } });var Bb = /%20/g,
            Cb = /#.*$/,
            Db = /([?&])_=[^&]*/,
            Eb = /^(.*?):[ \t]*([^\r\n]*)$/gm,
            Fb = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
            Gb = /^(?:GET|HEAD)$/,
            Hb = /^\/\//,
            Ib = {},
            Jb = {},
            Kb = "*/".concat("*"),
            Lb = d.createElement("a");Lb.href = tb.href;function Mb(a) {
            return function (b, c) {
                "string" != typeof b && (c = b, b = "*");var d,
                    e = 0,
                    f = b.toLowerCase().match(L) || [];if (r.isFunction(c)) while (d = f[e++]) "+" === d[0] ? (d = d.slice(1) || "*", (a[d] = a[d] || []).unshift(c)) : (a[d] = a[d] || []).push(c);
            };
        }function Nb(a, b, c, d) {
            var e = {},
                f = a === Jb;function g(h) {
                var i;return e[h] = !0, r.each(a[h] || [], function (a, h) {
                    var j = h(b, c, d);return "string" != typeof j || f || e[j] ? f ? !(i = j) : void 0 : (b.dataTypes.unshift(j), g(j), !1);
                }), i;
            }return g(b.dataTypes[0]) || !e["*"] && g("*");
        }function Ob(a, b) {
            var c,
                d,
                e = r.ajaxSettings.flatOptions || {};for (c in b) void 0 !== b[c] && ((e[c] ? a : d || (d = {}))[c] = b[c]);return d && r.extend(!0, a, d), a;
        }function Pb(a, b, c) {
            var d,
                e,
                f,
                g,
                h = a.contents,
                i = a.dataTypes;while ("*" === i[0]) i.shift(), void 0 === d && (d = a.mimeType || b.getResponseHeader("Content-Type"));if (d) for (e in h) if (h[e] && h[e].test(d)) {
                i.unshift(e);break;
            }if (i[0] in c) f = i[0];else {
                for (e in c) {
                    if (!i[0] || a.converters[e + " " + i[0]]) {
                        f = e;break;
                    }g || (g = e);
                }f = f || g;
            }if (f) return f !== i[0] && i.unshift(f), c[f];
        }function Qb(a, b, c, d) {
            var e,
                f,
                g,
                h,
                i,
                j = {},
                k = a.dataTypes.slice();if (k[1]) for (g in a.converters) j[g.toLowerCase()] = a.converters[g];f = k.shift();while (f) if (a.responseFields[f] && (c[a.responseFields[f]] = b), !i && d && a.dataFilter && (b = a.dataFilter(b, a.dataType)), i = f, f = k.shift()) if ("*" === f) f = i;else if ("*" !== i && i !== f) {
                if (g = j[i + " " + f] || j["* " + f], !g) for (e in j) if (h = e.split(" "), h[1] === f && (g = j[i + " " + h[0]] || j["* " + h[0]])) {
                    g === !0 ? g = j[e] : j[e] !== !0 && (f = h[0], k.unshift(h[1]));break;
                }if (g !== !0) if (g && a["throws"]) b = g(b);else try {
                    b = g(b);
                } catch (l) {
                    return { state: "parsererror", error: g ? l : "No conversion from " + i + " to " + f };
                }
            }return { state: "success", data: b };
        }r.extend({ active: 0, lastModified: {}, etag: {}, ajaxSettings: { url: tb.href, type: "GET", isLocal: Fb.test(tb.protocol), global: !0, processData: !0, async: !0, contentType: "application/x-www-form-urlencoded; charset=UTF-8", accepts: { "*": Kb, text: "text/plain", html: "text/html", xml: "application/xml, text/xml", json: "application/json, text/javascript" }, contents: { xml: /\bxml\b/, html: /\bhtml/, json: /\bjson\b/ }, responseFields: { xml: "responseXML", text: "responseText", json: "responseJSON" }, converters: { "* text": String, "text html": !0, "text json": JSON.parse, "text xml": r.parseXML }, flatOptions: { url: !0, context: !0 } }, ajaxSetup: function (a, b) {
                return b ? Ob(Ob(a, r.ajaxSettings), b) : Ob(r.ajaxSettings, a);
            }, ajaxPrefilter: Mb(Ib), ajaxTransport: Mb(Jb), ajax: function (b, c) {
                "object" == typeof b && (c = b, b = void 0), c = c || {};var e,
                    f,
                    g,
                    h,
                    i,
                    j,
                    k,
                    l,
                    m,
                    n,
                    o = r.ajaxSetup({}, c),
                    p = o.context || o,
                    q = o.context && (p.nodeType || p.jquery) ? r(p) : r.event,
                    s = r.Deferred(),
                    t = r.Callbacks("once memory"),
                    u = o.statusCode || {},
                    v = {},
                    w = {},
                    x = "canceled",
                    y = { readyState: 0, getResponseHeader: function (a) {
                        var b;if (k) {
                            if (!h) {
                                h = {};while (b = Eb.exec(g)) h[b[1].toLowerCase()] = b[2];
                            }b = h[a.toLowerCase()];
                        }return null == b ? null : b;
                    }, getAllResponseHeaders: function () {
                        return k ? g : null;
                    }, setRequestHeader: function (a, b) {
                        return null == k && (a = w[a.toLowerCase()] = w[a.toLowerCase()] || a, v[a] = b), this;
                    }, overrideMimeType: function (a) {
                        return null == k && (o.mimeType = a), this;
                    }, statusCode: function (a) {
                        var b;if (a) if (k) y.always(a[y.status]);else for (b in a) u[b] = [u[b], a[b]];return this;
                    }, abort: function (a) {
                        var b = a || x;return e && e.abort(b), A(0, b), this;
                    } };if (s.promise(y), o.url = ((b || o.url || tb.href) + "").replace(Hb, tb.protocol + "//"), o.type = c.method || c.type || o.method || o.type, o.dataTypes = (o.dataType || "*").toLowerCase().match(L) || [""], null == o.crossDomain) {
                    j = d.createElement("a");try {
                        j.href = o.url, j.href = j.href, o.crossDomain = Lb.protocol + "//" + Lb.host != j.protocol + "//" + j.host;
                    } catch (z) {
                        o.crossDomain = !0;
                    }
                }if (o.data && o.processData && "string" != typeof o.data && (o.data = r.param(o.data, o.traditional)), Nb(Ib, o, c, y), k) return y;l = r.event && o.global, l && 0 === r.active++ && r.event.trigger("ajaxStart"), o.type = o.type.toUpperCase(), o.hasContent = !Gb.test(o.type), f = o.url.replace(Cb, ""), o.hasContent ? o.data && o.processData && 0 === (o.contentType || "").indexOf("application/x-www-form-urlencoded") && (o.data = o.data.replace(Bb, "+")) : (n = o.url.slice(f.length), o.data && (f += (vb.test(f) ? "&" : "?") + o.data, delete o.data), o.cache === !1 && (f = f.replace(Db, "$1"), n = (vb.test(f) ? "&" : "?") + "_=" + ub++ + n), o.url = f + n), o.ifModified && (r.lastModified[f] && y.setRequestHeader("If-Modified-Since", r.lastModified[f]), r.etag[f] && y.setRequestHeader("If-None-Match", r.etag[f])), (o.data && o.hasContent && o.contentType !== !1 || c.contentType) && y.setRequestHeader("Content-Type", o.contentType), y.setRequestHeader("Accept", o.dataTypes[0] && o.accepts[o.dataTypes[0]] ? o.accepts[o.dataTypes[0]] + ("*" !== o.dataTypes[0] ? ", " + Kb + "; q=0.01" : "") : o.accepts["*"]);for (m in o.headers) y.setRequestHeader(m, o.headers[m]);if (o.beforeSend && (o.beforeSend.call(p, y, o) === !1 || k)) return y.abort();if (x = "abort", t.add(o.complete), y.done(o.success), y.fail(o.error), e = Nb(Jb, o, c, y)) {
                    if (y.readyState = 1, l && q.trigger("ajaxSend", [y, o]), k) return y;o.async && o.timeout > 0 && (i = a.setTimeout(function () {
                        y.abort("timeout");
                    }, o.timeout));try {
                        k = !1, e.send(v, A);
                    } catch (z) {
                        if (k) throw z;A(-1, z);
                    }
                } else A(-1, "No Transport");function A(b, c, d, h) {
                    var j,
                        m,
                        n,
                        v,
                        w,
                        x = c;k || (k = !0, i && a.clearTimeout(i), e = void 0, g = h || "", y.readyState = b > 0 ? 4 : 0, j = b >= 200 && b < 300 || 304 === b, d && (v = Pb(o, y, d)), v = Qb(o, v, y, j), j ? (o.ifModified && (w = y.getResponseHeader("Last-Modified"), w && (r.lastModified[f] = w), w = y.getResponseHeader("etag"), w && (r.etag[f] = w)), 204 === b || "HEAD" === o.type ? x = "nocontent" : 304 === b ? x = "notmodified" : (x = v.state, m = v.data, n = v.error, j = !n)) : (n = x, !b && x || (x = "error", b < 0 && (b = 0))), y.status = b, y.statusText = (c || x) + "", j ? s.resolveWith(p, [m, x, y]) : s.rejectWith(p, [y, x, n]), y.statusCode(u), u = void 0, l && q.trigger(j ? "ajaxSuccess" : "ajaxError", [y, o, j ? m : n]), t.fireWith(p, [y, x]), l && (q.trigger("ajaxComplete", [y, o]), --r.active || r.event.trigger("ajaxStop")));
                }return y;
            }, getJSON: function (a, b, c) {
                return r.get(a, b, c, "json");
            }, getScript: function (a, b) {
                return r.get(a, void 0, b, "script");
            } }), r.each(["get", "post"], function (a, b) {
            r[b] = function (a, c, d, e) {
                return r.isFunction(c) && (e = e || d, d = c, c = void 0), r.ajax(r.extend({ url: a, type: b, dataType: e, data: c, success: d }, r.isPlainObject(a) && a));
            };
        }), r._evalUrl = function (a) {
            return r.ajax({ url: a, type: "GET", dataType: "script", cache: !0, async: !1, global: !1, "throws": !0 });
        }, r.fn.extend({ wrapAll: function (a) {
                var b;return this[0] && (r.isFunction(a) && (a = a.call(this[0])), b = r(a, this[0].ownerDocument).eq(0).clone(!0), this[0].parentNode && b.insertBefore(this[0]), b.map(function () {
                    var a = this;while (a.firstElementChild) a = a.firstElementChild;return a;
                }).append(this)), this;
            }, wrapInner: function (a) {
                return r.isFunction(a) ? this.each(function (b) {
                    r(this).wrapInner(a.call(this, b));
                }) : this.each(function () {
                    var b = r(this),
                        c = b.contents();c.length ? c.wrapAll(a) : b.append(a);
                });
            }, wrap: function (a) {
                var b = r.isFunction(a);return this.each(function (c) {
                    r(this).wrapAll(b ? a.call(this, c) : a);
                });
            }, unwrap: function (a) {
                return this.parent(a).not("body").each(function () {
                    r(this).replaceWith(this.childNodes);
                }), this;
            } }), r.expr.pseudos.hidden = function (a) {
            return !r.expr.pseudos.visible(a);
        }, r.expr.pseudos.visible = function (a) {
            return !!(a.offsetWidth || a.offsetHeight || a.getClientRects().length);
        }, r.ajaxSettings.xhr = function () {
            try {
                return new a.XMLHttpRequest();
            } catch (b) {}
        };var Rb = { 0: 200, 1223: 204 },
            Sb = r.ajaxSettings.xhr();o.cors = !!Sb && "withCredentials" in Sb, o.ajax = Sb = !!Sb, r.ajaxTransport(function (b) {
            var c, d;if (o.cors || Sb && !b.crossDomain) return { send: function (e, f) {
                    var g,
                        h = b.xhr();if (h.open(b.type, b.url, b.async, b.username, b.password), b.xhrFields) for (g in b.xhrFields) h[g] = b.xhrFields[g];b.mimeType && h.overrideMimeType && h.overrideMimeType(b.mimeType), b.crossDomain || e["X-Requested-With"] || (e["X-Requested-With"] = "XMLHttpRequest");for (g in e) h.setRequestHeader(g, e[g]);c = function (a) {
                        return function () {
                            c && (c = d = h.onload = h.onerror = h.onabort = h.onreadystatechange = null, "abort" === a ? h.abort() : "error" === a ? "number" != typeof h.status ? f(0, "error") : f(h.status, h.statusText) : f(Rb[h.status] || h.status, h.statusText, "text" !== (h.responseType || "text") || "string" != typeof h.responseText ? { binary: h.response } : { text: h.responseText }, h.getAllResponseHeaders()));
                        };
                    }, h.onload = c(), d = h.onerror = c("error"), void 0 !== h.onabort ? h.onabort = d : h.onreadystatechange = function () {
                        4 === h.readyState && a.setTimeout(function () {
                            c && d();
                        });
                    }, c = c("abort");try {
                        h.send(b.hasContent && b.data || null);
                    } catch (i) {
                        if (c) throw i;
                    }
                }, abort: function () {
                    c && c();
                } };
        }), r.ajaxPrefilter(function (a) {
            a.crossDomain && (a.contents.script = !1);
        }), r.ajaxSetup({ accepts: { script: "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript" }, contents: { script: /\b(?:java|ecma)script\b/ }, converters: { "text script": function (a) {
                    return r.globalEval(a), a;
                } } }), r.ajaxPrefilter("script", function (a) {
            void 0 === a.cache && (a.cache = !1), a.crossDomain && (a.type = "GET");
        }), r.ajaxTransport("script", function (a) {
            if (a.crossDomain) {
                var b, c;return { send: function (e, f) {
                        b = r("<script>").prop({ charset: a.scriptCharset, src: a.url }).on("load error", c = function (a) {
                            b.remove(), c = null, a && f("error" === a.type ? 404 : 200, a.type);
                        }), d.head.appendChild(b[0]);
                    }, abort: function () {
                        c && c();
                    } };
            }
        });var Tb = [],
            Ub = /(=)\?(?=&|$)|\?\?/;r.ajaxSetup({ jsonp: "callback", jsonpCallback: function () {
                var a = Tb.pop() || r.expando + "_" + ub++;return this[a] = !0, a;
            } }), r.ajaxPrefilter("json jsonp", function (b, c, d) {
            var e,
                f,
                g,
                h = b.jsonp !== !1 && (Ub.test(b.url) ? "url" : "string" == typeof b.data && 0 === (b.contentType || "").indexOf("application/x-www-form-urlencoded") && Ub.test(b.data) && "data");if (h || "jsonp" === b.dataTypes[0]) return e = b.jsonpCallback = r.isFunction(b.jsonpCallback) ? b.jsonpCallback() : b.jsonpCallback, h ? b[h] = b[h].replace(Ub, "$1" + e) : b.jsonp !== !1 && (b.url += (vb.test(b.url) ? "&" : "?") + b.jsonp + "=" + e), b.converters["script json"] = function () {
                return g || r.error(e + " was not called"), g[0];
            }, b.dataTypes[0] = "json", f = a[e], a[e] = function () {
                g = arguments;
            }, d.always(function () {
                void 0 === f ? r(a).removeProp(e) : a[e] = f, b[e] && (b.jsonpCallback = c.jsonpCallback, Tb.push(e)), g && r.isFunction(f) && f(g[0]), g = f = void 0;
            }), "script";
        }), o.createHTMLDocument = function () {
            var a = d.implementation.createHTMLDocument("").body;return a.innerHTML = "<form></form><form></form>", 2 === a.childNodes.length;
        }(), r.parseHTML = function (a, b, c) {
            if ("string" != typeof a) return [];"boolean" == typeof b && (c = b, b = !1);var e, f, g;return b || (o.createHTMLDocument ? (b = d.implementation.createHTMLDocument(""), e = b.createElement("base"), e.href = d.location.href, b.head.appendChild(e)) : b = d), f = C.exec(a), g = !c && [], f ? [b.createElement(f[1])] : (f = qa([a], b, g), g && g.length && r(g).remove(), r.merge([], f.childNodes));
        }, r.fn.load = function (a, b, c) {
            var d,
                e,
                f,
                g = this,
                h = a.indexOf(" ");return h > -1 && (d = pb(a.slice(h)), a = a.slice(0, h)), r.isFunction(b) ? (c = b, b = void 0) : b && "object" == typeof b && (e = "POST"), g.length > 0 && r.ajax({ url: a, type: e || "GET", dataType: "html", data: b }).done(function (a) {
                f = arguments, g.html(d ? r("<div>").append(r.parseHTML(a)).find(d) : a);
            }).always(c && function (a, b) {
                g.each(function () {
                    c.apply(this, f || [a.responseText, b, a]);
                });
            }), this;
        }, r.each(["ajaxStart", "ajaxStop", "ajaxComplete", "ajaxError", "ajaxSuccess", "ajaxSend"], function (a, b) {
            r.fn[b] = function (a) {
                return this.on(b, a);
            };
        }), r.expr.pseudos.animated = function (a) {
            return r.grep(r.timers, function (b) {
                return a === b.elem;
            }).length;
        }, r.offset = { setOffset: function (a, b, c) {
                var d,
                    e,
                    f,
                    g,
                    h,
                    i,
                    j,
                    k = r.css(a, "position"),
                    l = r(a),
                    m = {};"static" === k && (a.style.position = "relative"), h = l.offset(), f = r.css(a, "top"), i = r.css(a, "left"), j = ("absolute" === k || "fixed" === k) && (f + i).indexOf("auto") > -1, j ? (d = l.position(), g = d.top, e = d.left) : (g = parseFloat(f) || 0, e = parseFloat(i) || 0), r.isFunction(b) && (b = b.call(a, c, r.extend({}, h))), null != b.top && (m.top = b.top - h.top + g), null != b.left && (m.left = b.left - h.left + e), "using" in b ? b.using.call(a, m) : l.css(m);
            } }, r.fn.extend({ offset: function (a) {
                if (arguments.length) return void 0 === a ? this : this.each(function (b) {
                    r.offset.setOffset(this, a, b);
                });var b,
                    c,
                    d,
                    e,
                    f = this[0];if (f) return f.getClientRects().length ? (d = f.getBoundingClientRect(), b = f.ownerDocument, c = b.documentElement, e = b.defaultView, { top: d.top + e.pageYOffset - c.clientTop, left: d.left + e.pageXOffset - c.clientLeft }) : { top: 0, left: 0 };
            }, position: function () {
                if (this[0]) {
                    var a,
                        b,
                        c = this[0],
                        d = { top: 0, left: 0 };return "fixed" === r.css(c, "position") ? b = c.getBoundingClientRect() : (a = this.offsetParent(), b = this.offset(), B(a[0], "html") || (d = a.offset()), d = { top: d.top + r.css(a[0], "borderTopWidth", !0), left: d.left + r.css(a[0], "borderLeftWidth", !0) }), { top: b.top - d.top - r.css(c, "marginTop", !0), left: b.left - d.left - r.css(c, "marginLeft", !0) };
                }
            }, offsetParent: function () {
                return this.map(function () {
                    var a = this.offsetParent;while (a && "static" === r.css(a, "position")) a = a.offsetParent;return a || ra;
                });
            } }), r.each({ scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function (a, b) {
            var c = "pageYOffset" === b;r.fn[a] = function (d) {
                return T(this, function (a, d, e) {
                    var f;return r.isWindow(a) ? f = a : 9 === a.nodeType && (f = a.defaultView), void 0 === e ? f ? f[b] : a[d] : void (f ? f.scrollTo(c ? f.pageXOffset : e, c ? e : f.pageYOffset) : a[d] = e);
                }, a, d, arguments.length);
            };
        }), r.each(["top", "left"], function (a, b) {
            r.cssHooks[b] = Pa(o.pixelPosition, function (a, c) {
                if (c) return c = Oa(a, b), Ma.test(c) ? r(a).position()[b] + "px" : c;
            });
        }), r.each({ Height: "height", Width: "width" }, function (a, b) {
            r.each({ padding: "inner" + a, content: b, "": "outer" + a }, function (c, d) {
                r.fn[d] = function (e, f) {
                    var g = arguments.length && (c || "boolean" != typeof e),
                        h = c || (e === !0 || f === !0 ? "margin" : "border");return T(this, function (b, c, e) {
                        var f;return r.isWindow(b) ? 0 === d.indexOf("outer") ? b["inner" + a] : b.document.documentElement["client" + a] : 9 === b.nodeType ? (f = b.documentElement, Math.max(b.body["scroll" + a], f["scroll" + a], b.body["offset" + a], f["offset" + a], f["client" + a])) : void 0 === e ? r.css(b, c, h) : r.style(b, c, e, h);
                    }, b, g ? e : void 0, g);
                };
            });
        }), r.fn.extend({ bind: function (a, b, c) {
                return this.on(a, null, b, c);
            }, unbind: function (a, b) {
                return this.off(a, null, b);
            }, delegate: function (a, b, c, d) {
                return this.on(b, a, c, d);
            }, undelegate: function (a, b, c) {
                return 1 === arguments.length ? this.off(a, "**") : this.off(b, a || "**", c);
            } }), r.holdReady = function (a) {
            a ? r.readyWait++ : r.ready(!0);
        }, r.isArray = Array.isArray, r.parseJSON = JSON.parse, r.nodeName = B, "function" == typeof define && define.amd && define("jquery", [], function () {
            return r;
        });var Vb = a.jQuery,
            Wb = a.$;return r.noConflict = function (b) {
            return a.$ === r && (a.$ = Wb), b && a.jQuery === r && (a.jQuery = Vb), r;
        }, b || (a.jQuery = a.$ = r), r;
    });
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
                    return objectUtils.getDataFromObjectByPath(this.values, path);
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
                this.getDOMModel().set('currentShadowDOM', null);
            },

            getDOMModel: function () {
                return this.DOMModel;
            },

            registerCurrentPage: function (pageClass) {
                this.getDOMModel().set('currentPageClass', pageClass);
            },

            getCurrentPage: function () {
                return this.getDOMModel().get('currentPageClass');
            },

            getCurrentShadowDOM: function () {
                return this.getDOMModel().get('currentShadowDOM');
            },

            setCurrentShadowDOM: function ($shadowDOM) {
                return this.getDOMModel().set('currentShadowDOM', $shadowDOM);
            },

            getCurrentPageDOMSelector: function () {
                return this.getDOMModel().get('currentPageClass') ? this.getDOMModel().get('currentPageClass').getDOMElement() : null;
            },

            alterShadowDOM: function ($containerSelector, html, renderType) {
                if (!this.getCurrentShadowDOM()) {
                    console.warn('attempted to alter non-existent shadow DOM');
                    return;
                };

                var $shadowDOM = this.getCurrentShadowDOM();

                if (!_.isObject($containerSelector)) {
                    $containerSelector = $($containerSelector);
                }

                var $shadowEl;
                //***TODO: resolve problem of classless elements
                //TODO: address parent issue
                //https://stackoverflow.com/questions/9382028/get-the-current-jquery-selector-string
                if ($containerSelector.is('#page-wrapper')) {
                    $shadowEl = $shadowDOM;
                } else {
                    if (!$containerSelector.attr('class')) {
                        console.error('Cant use shadowDOM on el with no Class:', $containerSelector);
                        return;
                    }

                    $shadowEl = $shadowDOM.find('.' + $containerSelector.attr('class').split(" ").join('.')).length ? $shadowDOM.find('.' + $containerSelector.attr('class').split(" ").join('.')) : null;
                }

                console.log('$containerSelector', $containerSelector);
                console.log('$shadowEl', $shadowEl);

                switch (renderType) {
                    case 'replace':
                        $shadowEl.html(html);

                        break;
                }
            },

            writeShadowDOMToBrowser: function () {
                console.log('rendering shadow DOM to page');
                this.getCurrentPageDOMSelector().html(this.getCurrentShadowDOM().html());
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
    define('scanner', ["componentInstanceLibrary"], function (componentInstanceLibrary) {

        return {
            scan: function ($target) {
                console.log('SCANNING:', $target);
                var $components = $target.find('[data-lagomorph-component], [data-lc]').not('[data-rendered]');

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

                    var moduleClass = L.componentDefinitions[compViewData.type];
                    compViewData.$parentSelector = $component; //todo: bad name -- componentWrapper
                    var moduleInstance = new moduleClass(compData);

                    //****IMPORTANT!!! mark as rendered or it will re-render in an infinite loop on subsequent scans!!
                    $component.attr('data-rendered', true);
                    $component.addClass('rendered');

                    moduleInstance.loadComponent($component);
                }, this);
            }

        };
    });
    define('viewUtils', ["Handlebars", "DOMModel", "scanner"], function (Handlebars, DOMModel, scanner) {

        return {

            /*
            * 
            */
            renderDomElement: function ($containerSelector, html, renderType, callback, forceImmediateRender) {
                renderType = renderType || 'replace';
                callback = callback || null;
                forceImmediateRender = forceImmediateRender || false;

                DOMModel.callbacks = DOMModel.callbacks || [];
                if (callback) {
                    DOMModel.callbacks.push(callback);
                }

                if (forceImmediateRender) {
                    $containerSelector.html(html);
                    return;
                }

                //if !currentphatomPage --> make phatntom page, modify, set timeout to put it back into page
                //else add change to currnet phantom page
                //thus, sync changes line up in a queue!

                var $shadowDOM = DOMModel.getCurrentShadowDOM();

                // if (!$shadowDOM) {
                //   debugger;
                if (!$shadowDOM) {
                    DOMModel.setCurrentShadowDOM(DOMModel.getCurrentPageDOMSelector().clone());
                }

                DOMModel.alterShadowDOM($containerSelector, html, renderType);
                scanner.scan(DOMModel.getCurrentShadowDOM());

                if (!DOMModel.renderinProgress) {
                    //block multiple simaltaneous shadow DOM renders
                    DOMModel.renderinProgress = true;

                    _.defer(function () {

                        _.each(DOMModel.callbacks, function (callback) {
                            callback();
                        });

                        DOMModel.writeShadowDOMToBrowser(); //make all enqueued changes
                        DOMModel.renderinProgress = false;
                        DOMModel.callbacks = [];
                        DOMModel.setCurrentShadowDOM(null);
                    });
                }

                // }


                // getCurrentPageDOMSelector

                //problem if container is page??

                //needs to take a callback so that can be sure to happen after dom update

                // switch(renderType) {
                //   case 'replace':
                //     if ( _.isObject($containerSelector) ) { //jquery obj passed in
                //       $containerSelector.html(html);
                //     }
                //     else {
                //       $(containerSelector).html(html);
                //     }

                //   break;
                // }
            }

        };
    });
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

            createAjaxCallPromise: function (dataSourceName, promiseId, connector, optionsObj, hardcodedDataSource) {
                optionsObj = optionsObj || null;
                //look up datasource from library and get options to create the promise
                var dataSourceDefinition = optionsObj ? optionsObj : dataSourceLibrary.getDataSourceByName(dataSourceName);
                promiseId = promiseId || 'unknown'; //TODO: random
                connector = connector || null;
                hardcodedDataSource = hardcodedDataSource || null;

                if (!dataSourceDefinition && !hardcodedDataSource) {
                    console.error("Cannot make AJAX request; need a valid datasource or hardcodedDataSource");
                    return;
                }

                var options = dataSourceDefinition || hardcodedDataSource;

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
                }).done(function (rawData) {
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

                        //TODO: possibly don't resolve until chained indexedDB promises do!!
                    };deferred.resolve(returnObj);
                }).fail(function () {
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
    define('LModule', ["Handlebars", "LBase", "viewUtils", "componentInstanceLibrary", "ajaxRequester", "connectorLibrary", "connectorUtils", "objectUtils", "templateUtils", "DOMModel"], function (Handlebars, LBase, viewUtils, componentInstanceLibrary, ajaxRequester, connectorLibrary, connectorUtils, objectUtils, templateUtils, DOMModel) {

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
                    this.elClassIterator = 0;
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
                loadComponent: function (targetSelector, directRender) {
                    var self = this;

                    /*
                    * Component instantiator gave us one or more data contracts
                    * We must fulfill them before we can render the view
                    * at the end, data will be added to this.processedData
                    * for view data, name will map to 1-N data-data_source_name's in html template
                    */
                    $(targetSelector).addClass(this.id + "_el" + this.elClassIterator);
                    this.elClassIterator++;

                    //maybe better to do at compile time??
                    //make sure everything has a css class, otherwise DOMModel will have a problem finding things in shadowDOM
                    //TODO: doesn't seem to work right! targetSelector is off
                    var $allEls = $(targetSelector).find('*'); //todo: possible bad performance on v large comps
                    _.each($allEls, function (el) {
                        $(el).addClass(this.id + "_el" + this.elClassIterator);
                        this.elClassIterator++;
                    }, this);

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

                        self.renderView(targetSelector, directRender);
                    }, function (e) {
                        console.log("My ajax failed");
                    });
                },

                /*
                *
                */
                renderView: function (targetSelector, directRender) {
                    var html = this.compiledTemplate(this.viewParams);

                    //TODO#$$$$$$ callback not needed if we always operate on shadow??????????

                    // $containerSelector, html, renderType, callback, forceImmediateRender


                    //TODO: pass in parent name and do the adding of classes in here, before creating shadow
                    viewUtils.renderDomElement(targetSelector, html, 'replace', $.proxy(this.renderDataIntoBindings, this), directRender);
                    // this.renderDataIntoBindings();
                },

                renderDataIntoBindings: function () {
                    console.log('BINDINGS!!');
                    var $selector = DOMModel.getCurrentShadowDOM(); // || this.$parentSelector; //?????
                    var $dataBindings = $selector.find('[data-data_binding]');

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

                        $dataBindingDOMElement.addClass(this.id + "_el" + this.elClassIterator);
                        this.elClassIterator++;
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
    define('LPage', ["LModule", "scanner", "DOMModel"], function (LModule, scanner, DOMModel) {

        return LModule.extend(function (base) {

            return {

                init: function (params) {
                    params = params || {};
                    base.init(params);

                    this.data = params.data || {};

                    this.id = 'page_' + params.id;
                    this.useCachedData = params.useCachedData || false;
                },

                renderPage: function (pageWrapperSelector) {
                    var self = this;
                    //TODO: optional data caching
                    var $pageWrapperSelector = $(pageWrapperSelector);
                    this.$parentSelector = $pageWrapperSelector; //??/

                    this.loadComponent($pageWrapperSelector);
                    var $selector = $pageWrapperSelector;

                    // setTimeout(function() { //wait for phantom dom TODO: nad
                    //  scanner.scan($selector, self.useCachedData);
                    // }, 2);

                },

                getDOMElement: function () {
                    return this.$parentSelector;
                }

            };
        });
    });

    define('LRouter', ["pageClassLibrary", "LPage", "DOMModel"], function (pageClassLibrary, LPage, DOMModel) {

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

                var pageKey = key; //window.location.hash.slice(1);
                var pageClass = this.pageClassLibrary.getPageByRoute(pageKey);

                // if (!pageClass) { //TODO: would be nice to re-use classes but won;'t work!!'
                console.log('creating class for page:', pageKey);
                pageClass = new LPage(this.pageDefinitions[pageKey]);

                this.pageClassLibrary.getLibrary().addItem(pageKey, pageClass, true);
                // }

                //register current page with DOMModel
                DOMModel.registerCurrentPage(pageClass);

                pageClass.renderPage(this.pageWrapperSelector);
            }

        };
    });

    // var routes = {
    //         '/author': showAuthorInfo,
    //         '/books': listBooks
    //       };

    define('userDefinedComponentDefinitionLibrary', ["LLibrary"], function (LLibrary) {

        //makes the singleton avaible to the global window.L, or via require
        return {

            UserDefinedComponentDefinitionLibrary: null,

            initializeUserDefinedComponentDefinitionLibrary: function (userDefinedComponents) {
                userDefinedComponents = userDefinedComponents || null;
                if (this.UserDefinedComponentDefinitionLibrary !== null) {
                    console.warn('UserDefinedComponentDefinitionLibrary singleton already initialized');
                    return;
                }

                this.UserDefinedComponentDefinitionLibrary = new LLibrary();

                if (userDefinedComponents) {
                    this.getLibrary().addMultipleItems(userDefinedComponents, true);
                }
            },

            getLibrary: function () {
                return this.UserDefinedComponentDefinitionLibrary;
            },

            getUserDefinedComponentDefinitionLibraryByName: function (name) {
                return this.getLibrary() ? this.getLibrary().storage[name] : null;
            }

        };
    });
    define('lagomorph', ["jquery", "Handlebars", "Fiber", "dexie", "himalaya", "LBase", "LModule", "scanner", "L_List", "componentInstanceLibrary", "viewUtils", "ajaxRequester", "agreementsTester", "dataSourceLibrary", "connectorLibrary", "connectorUtils", "objectUtils", "uiStringsLibrary", "templateUtils", "pageClassLibrary", "director", "LRouter", "LModel", "DOMModel", "LComponent", "userDefinedComponentDefinitionLibrary"], function ($, Handlebars, Fiber, dexie, himalaya, LBase, LModule, scanner, L_List, componentInstanceLibrary, viewUtils, ajaxRequester, agreementsTester, dataSourceLibrary, connectorLibrary, connectorUtils, objectUtils, uiStringsLibrary, templateUtils, pageClassLibrary, director, LRouter, LModel, DOMModel, LComponent, userDefinedComponentDefinitionLibrary) {

        var framework = { //anything we want to expose on the window for the end user needs to be added here
            scanner: scanner,
            ajaxRequester: ajaxRequester,
            LBase: LBase,
            LModule: LModule,
            dexie: dexie, //api for indexedDB local storage DB -> http://dexie.org/docs/ 
            himalaya: himalaya, //html to json parser -> https://github.com/andrejewski/himalaya
            $: $,
            Handlebars: Handlebars,
            componentDefinitions: { //all available component classes that come standard with the framework + user defined
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
            LComponent: LComponent,
            DOMModel: DOMModel,
            userDefinedComponentDefinitionLibrary: userDefinedComponentDefinitionLibrary,
            templateUtils: templateUtils,

            initialize: function (params) {
                var self = this;
                params = params || {};
                var userDefinedComponents = params.userDefinedComponents || null;
                var initializeCallback = params.callback || null;
                params.stringData = params.stringData || {};

                if (userDefinedComponents) {
                    this.componentDefinitions = _.extend(this.componentDefinitions, userDefinedComponents);
                }

                if (!params.services) {
                    console.error('L.initialize needs at least one service to set up the app!');
                    return;
                }

                this.DOMModel.initializeDOMModel();

                this.componentInstanceLibrary.initializeComponentInstanceLibrary(); //model that holds all instances of created components for lookup

                //data source library (server data lookups)
                this.dataSourceLibrary.initializeDataSourceLibrary();
                this.connectorLibrary.initializeConnectorLibrary();
                this.pageClassLibrary.initializePageClassLibrary();
                this.uiStringsLibrary.initializeUIStringsLibrary();

                //user-defined components library (class definitions, not instances)
                //purpose: reference of what components were imported, what they do, and make sure they're valid
                //make sure they get added to L.componentDefinitions for usage
                this.userDefinedComponentDefinitionLibrary.initializeUserDefinedComponentDefinitionLibrary(userDefinedComponents);

                var allAppStartData = {}; //extend with each service result until all needed data is compiled
                var allPromises = [];

                for (var i = 0; i < params.services.length; i++) {
                    var promise = ajaxRequester.createAjaxCallPromise(null, null, null, null, params.services[i]);
                    allPromises.push(promise);
                }

                $.when.all(allPromises).then(function (returnedDataObjects) {
                    for (var i = 0; i < returnedDataObjects.length; i++) {
                        var thisData = returnedDataObjects[i].returnedData;
                        allAppStartData = _.extend(allAppStartData, thisData);
                    }

                    console.log('after all promises, starting app with data:', allAppStartData);

                    //if found, put setup data into the appropriate libraries
                    if (allAppStartData.stringData) {
                        self.uiStringsLibrary.getLibrary().addItem('allUiStrings', allAppStartData.stringData, true);
                    }
                    if (allAppStartData.dataSources) {
                        self.dataSourceLibrary.getLibrary().addMultipleItems(allAppStartData.dataSources);
                    }
                    if (allAppStartData.dataSources) {
                        self.connectorLibrary.getLibrary().addMultipleItems(allAppStartData.connectors);
                    }

                    var startFunc = function () {
                        self.start(allAppStartData, userDefinedComponents);
                    };

                    if (initializeCallback) {
                        initializeCallback(returnedDataObjects, startFunc);
                    } else {
                        startFunc();
                    }
                }, function (e) {
                    console.log("App start failed");
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
            start: function (params, userDefinedComponents) {

                var self = this;
                params = params || {};
                var userDefinedComponents = params.userDefinedComponents || null;

                if (!params.pageWrapperSelector) {
                    console.warn('Lagomorph started with no pageWrapperSelector');
                }
                if (!params.pages) {
                    console.warn('Lagomorph started with no pages');
                }

                if (!params.initialRoute) {
                    console.warn('Lagomorph started with no initialRoute');
                }

                var allPromises = []; //add anything that is needed before the initial scan/app start
                //typically this would be getting the pages so the router can start
                //initialize already made sure all libraries are ready with data sources, connectors, i18n, etc

                if (params.pages && params.pages.dataSourceName) {
                    var connector = this.connectorLibrary.getConnectorByName(params.pages.connectorName);
                    var pagesPromise = ajaxRequester.createAjaxCallPromise(params.pages.dataSourceName, "pages", connector);

                    allPromises.push(pagesPromise);
                }

                var routerInfo = null;

                $.when.all(allPromises).then(function (schemas) {
                    for (var i = 0; i < schemas.length; i++) {
                        var promiseId = schemas[i].promiseId;

                        switch (promiseId) {
                            case 'pages':
                                routerInfo = schemas[i].returnedData;
                                break;
                        }
                    }

                    if (routerInfo) {
                        self.LRouter.startRouter(routerInfo.pages, routerInfo.homepage, params.pageWrapperSelector);
                    }
                }, function (e) {
                    console.log("App start failed");
                });
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
