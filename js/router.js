(function(window, location, history) {
	"use strict";

	var debug = false;//true;

	var slice = Function.prototype.call.bind(Array.prototype.slice);

	var rslash = /^\//;

	var blank = {};

	var prototype = {

		// .on(regex, fn)
		// Bind a fn to be called whenever regex matches the route. Callback fn
		// is called with 'this' set to the router and the result of regex
		// capturing groups as arguments.

		on: function on(regex, fn) {
			this.push(slice(arguments));
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

			var test = classOf(regex) === 'function' ? testFn :
			    	!fn ? testRegex :
			    	testBoth ;

			while (n--) {
				if (test(this[n], regex, fn)) {
					this.splice(n, 1);
				}
			}

			return this;
		},

		catch: function catchUnmatched(fn) {
			var array = getCatchers(this);
			array.push(fn);
			return this;
		},

		// .trigger(path)
		// Call all routes whose regex matches path, passing the result of any
		// capturing groups to the handler. Data about the current path is
		// stored on the regex object. It is used internally by .create().

		trigger: function trigger(path) {
			var n = -1;
			var l = this.length;
			var count = 0;
			var route, args;

			while (++n < l) {
				route = this[n];
				args = route[0].exec(path);

				if (args) {
					route[0].lastString = path;
					route[0].lastMatch = args[0];
					route[1].apply(this, slice(args, 1));
					count++;
				}
			}

			if (count === 0) {
				var catchers = getCatchers(this);
				n = -1;
				l = catchers.length;
				
				while (++n < l) {
					catchers[n].call(this, path);
				}
			}

			return this;
		},

		// .create(regex)
		// Create a new router whose root is this router.

		create: function create(regex) {
			var router = Object.create(prototype, properties);

			router.root = this.root || this;

			this.on(regex, function() {
				// Set the current root path for the router
				router.path = this.path + regex.lastMatch;
				
				// Trigger the router with the unmatched remainder of the path
				router.trigger(regex.lastString.replace(regex, ''));
			});

			return router;
		},

		destroy: function destroy() {
			this.off();
			return this;
		},

		navigate: function navigate(path, options) {
			if (this.path === undefined) { return this; }

			// Where path has a leading '/' send it to root.navigate
			// without prepending the local path. In other words, treat
			// as a sort of absolute URL.
			path = rslash.test(path) ? path : (this.path + path);
			this.root.navigate(path, options);
			return this;
		},

		// A router is an array-like object. Give it some
		// array methods.

		map: Array.prototype.map,
		push: Array.prototype.push,
		splice: Array.prototype.splice,
		forEach: Array.prototype.forEach
	};

	var properties = {
		root: { value: undefined, enumerable: false, writable: true },
		path: { value: undefined, enumerable: false, writable: true },
		length: { value: 0, enumerable: false, writable: true }
	};

	function getCatchers(object) {
		if (!object.catchers) {
			Object.defineProperty(object, 'catchers', {
				value: []
			});
		}

		return object.catchers;
	}

	function classOf(object) {
		return Object.prototype.toString.apply(object).slice(8, -1).toLowerCase();
	}

	function testRegex(route, regex) {
		return route[0].toString() === regex.toString();
	}

	function testFn(route, fn) {
		return route[1] === fn;
	}

	function testBoth(route, regex, fn) {
		return testRegex(route, regex) && testFn(route, fn);
	}

	function Router(base) {
		var router = Object.create(prototype, properties);
		var rpath;
		var pathname = location.pathname;

		function listen() {
			// Hash changes fire popstate. We don't want to
			// change the route unless the pathname has changed.
			if (location.pathname === pathname) { return; }
			pathname = location.pathname;

			// Check the path matches the router's path.
			if (!rpath.test(pathname)) { return; }

			if (debug) { console.log('window:popstate', location.pathname); }

			router.trigger(location.pathname.replace(rpath, ''));
		}

		router.root = router;
		router.path = '/';
		router.base = base || '';
		rpath = RegExp('^' + router.base + router.path);

		window.addEventListener('popstate', listen);

		router.destroy = function() {
			window.removeEventListener('popstate', listen);
			prototype.destroy.apply(this);
		};

		router.navigate = function(path, options) {
			if (debug) { console.log('router.navigate()', path); }

			path = router.base + (rslash.test(path) ? path : (router.path + path));

			if (options && options.history === false) {
				history.replaceState(blank, '', path);
			}
			else {
				history.pushState(blank, '', path);
			}

			// A pushState call does not send a popstate event,
			// so we must manually trigger the route change.
			// We could trigger a false popstate event instead,
			// definitely worth considering.
			this.trigger(location.pathname.replace(rpath, ''));
			return this;
		};

		return router;
	}

	window.Router = Router;

})(window, window.location, window.history);