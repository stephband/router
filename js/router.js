(function(window) {
	"use strict";

	var DEBUG    = window.DEBUG !== false;

	var location = window.location;
	var history  = window.history;

	var A        = Array.prototype;
	var define   = Object.defineProperties;
	var assign   = Object.assign;
	var entries  = Object.entries;

	var blank    = {};
	var rslash   = /^\//;
	var routers  = [];


	function noop() {}

	function id(value) { return value; }

	function testRegex(route, regex) {
		return route[0].toString() === regex.toString();
	}

	function testFn(route, fn) {
		return route[1] === fn;
	}

	function testBoth(route, regex, fn) {
		return testRegex(route, regex) && testFn(route, fn);
	}

	function updateHistory(pathname) {
		var replace;

		// Only update history where pathname is not the current location
		if (pathname === location.pathname) { return; }

		if (replace) {
			history.replaceState(blank, '', pathname);
		}
		else {
			if (DEBUG) { console.log('Router: history push', pathname); }
			history.pushState(blank, '', pathname);
		}
	}

	function toRegexKey(entry) {
		entry[0] = RegExp(entry[0]);
		return entry;
	}

	function route(router, path) {
		// Call first route whose regex matches path, passing the result of any
		// capturing groups to the handler. Data about the current path is
		// stored on the regex object. It is used internally by .create().

		var n = -1;
		var l = router.routes.length;
		var route, args, value;

		while (++n < l) {
			route = router.routes[n];

			// For convenience dont require the regexes to match the leading
			// slash in path, a la Django
			args  = route[0].exec(path.slice(1));

			if (args) {
				route[0].lastString = path;
				route[0].lastMatch  = args[0];

				// Call first matching route only
				value = route[1].apply(router, A.slice.call(args, 1));
				if (value !== false) { return value; }
			}
		}

		return false;
	}

	function Router(base, routes) {
		if (!Router.prototype.isPrototypeOf(this)) {
			return new Router(base, routes);
		}

		var router = this;
		var parent = arguments[2] || Router;
		var stop   = noop;
		var path;

		router.base = base;

		router.routes = routes ?
			entries(routes).map(toRegexKey) :
			[] ;

		router.route = function(pathname) {
			if (!rslash.test(pathname)) {
				console.warn('Router: paths must start with "/"');
				return false;
			}

			// If this is the current path return true to indicate that
			// this router does handle this path.
			if (pathname === path) {
				return true;
			}

			stop();

			// Try the route
			var value = route(router, pathname);

			// If value is false routing was unsuccessful
			if (value === false) {
				path = undefined;
				stop = noop;
				return false;
			}

			// Otherwise, success! Where value is a function use it as stop(),
			// update path and return true
			stop = typeof value === 'function' ? value : noop ;
			path = pathname;
			return true;
		};

		router.navigate = function(path) {
			if (!rslash.test(path)) {
				console.warn('Router: paths must start with "/"', path);
				return false;
			}

			return parent.navigate(router.base + path);
		};

		router.absolutePath = function(path) {
			return parent.absolutePath(router.base + path);
		};

		router.relativePath = function(absolutePath) {
			var path = parent.relativePath(absolutePath);
			return path && path.startsWith(router.base) ?
				path.slice(router.base.length) :
				undefined ;
		};

		router.stop = function stop() {
			this.off();
			var i = routers.indexOf(router);
			if (i > -1) { routers.splice(i, 1); }
			return router;
		};

		define(router, {
			path: {
				get: function() { return path; }
			}
		});

		// Register router and launch current route
		routers.push(this);
		router.route(router.relativePath(location.pathname));
	}

	assign(Router.prototype, {
		base: '',

		// .on(regex, fn)
		// Bind a fn to be called whenever regex matches the route. Callback fn
		// is called with 'this' set to the router and the result of regex
		// capturing groups as arguments.

		on: function on(regex, fn) {
			this.routes.push(A.slice.apply(arguments));
			return this;
		},

		// .off()
		// Remove all routes

		// .off(regex)
		// Remove all routes that have regex

		// .off(fn)
		// Remove all routes that have function fn

		// .off(regex, fn)
		// Remove routes with regex and fn

		off: function off(regex, fn) {
			var n = this.length;

			if (arguments.length === 0) {
				while (this.length--) {
					delete this[this.length];
				}
				return this;
			}

			var test = typeof regex === 'function' ? testFn
				: !fn ? testRegex
				: testBoth ;

			while (n--) {
				if (test(this[n], regex, fn)) {
					this.splice(n, 1);
				}
			}

			return this;
		}
	});

	assign(Router, {
		navigate: function(path) {
			if (Router.route(path)) {
				updateHistory(path);
				return true;
			}
		},

		route: function(pathname) {
			if (!rslash.test(pathname)) {
				if (DEBUG) {
					console.warn('Router.route() must be passed a full path starting with a slash', pathname);
				}

				return false;
			}

			return routers
			.map(function(router) {
				return pathname.startsWith(router.base) ?
					router.route(pathname.slice(router.base.length)) :
					false ;
			})
			.indexOf(true) > -1 ;
		},

		relativePath: id,
		absolutePath: id
	});

	Object.defineProperties(Router, {
		// When routes change should the browser scroll the page?
		scrolling: {
			set: function(bool) {
				if ('scrollRestoration' in history) {
					history.scrollRestoration = bool ? 'auto' : 'manual' ;
				}
				else {
					// TODO: Support scroll override in IE and Safari and
					// anything else that dont have no scrollRestoration.
				}
			},

			get: function() {
				return history.scrollRestoration === 'manual';
			}
		},
	});

	Router.scrolling = false;


	// Export

	window.Router = Router;

})(this);
