(function(window, location, history) {
	"use strict";

	var debug = true;

	var Fn = window.Fn;
	var dom = window.dom;

	var slice = Function.prototype.call.bind(Array.prototype.slice);

	var rslash = /^\//;

	var blank = {};

	var classOf = Fn.classOf;

	var location = window.location;

	var catchersSymbol = Symbol('catchers');

	var prototype = {

		// .on(regex, fn)
		// Bind a fn to be called whenever regex matches the route. Callback fn
		// is called with 'this' set to the router and the result of regex
		// capturing groups as arguments.

		on: function on(regex, fn) {
			this.routes.push(slice(arguments));
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
			array.routes.push(fn);
			return this;
		},

		// .trigger(path)
		// Call all routes whose regex matches path, passing the result of any
		// capturing groups to the handler. Data about the current path is
		// stored on the regex object. It is used internally by .create().

		trigger: function trigger(path) {
			var n = -1;
			var l = this.routes.length;
			var count = 0;
			var route, args;
console.log('>>>', path)
			while (++n < l) {
				route = this.routes[n];
				args  = route[0].exec(path);

				if (args) {
					route[0].lastString = path;
					route[0].lastMatch = args[0];
					route[1].apply(null, slice(args, 1));
					count++;
				}
			}

			if (count === 0) {
				var catchers = getCatchers(this);
				n = -1;
				l = catchers.length;

				while (++n < l) {
					catchers[n].call(this, path);
					count++;
				}
			}

			return !!count;
		},

		// .create(regex)
		// Create a new router whose root is this router.

		create: function create(regex) {
			var router = Object.create(prototype, properties);

			router.root = this.root || this;

			this.on(regex, function() {
				// Set the current root path for the router
				router.base = '/' + regex.lastMatch;

				// Trigger the router with the unmatched remainder of the path
				router.trigger(regex.lastString.replace(regex, ''));
			});

			return router;
		},

		destroy: function destroy() {
			this.off();
			return this;
		},

		navigate: function navigate(path) {
			if (this.path === undefined) { return this; }

			// Where path has a leading '/' send it to root.navigate
			// without prepending the local path. In other words, treat
			// as a sort of absolute URL.
			path = rslash.test(path) ? path : (this.path + path);
			this.root.navigate(path);
			return this;
		}
	};

	var properties = {
		root: { value: undefined, enumerable: false, writable: true }
	};

	function getCatchers(object) {
		return object[catchersSymbol] || (object[catchersSymbol] = []);
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
		var pathname = location.pathname;

		function listen() {
			// Hash changes fire popstate. We don't want to
			// change the route unless the pathname has changed.
			if (location.pathname === pathname) { return; }

			// Trigger route
			router.route();
		}

		function click(e) {
			// Already handled
			if (e.defaultPrevented) { return; }

			// Not primary button
			if (!dom.isPrimaryButton(e)) { return; }

			var node = dom.closest('a[href]', e.target);

			// Not in a link
			if (!node) { return; }

			// A download
			if (dom.attribute('download', node)) { return; }

			// Another window or frame
			if (node.target && node.target !== '_self') { return; }

			// An external site
			if (location.hostname !== node.hostname) { return; }

			// Only the hash changed
			if (node.href !== location.href && node.href.split('#')[0] === location.href.split('#')) { return; }

			// From: https://github.com/riot/route/blob/master/src/index.js :: click()
			//    || base[0] !== '#' && getPathFromRoot(el.href).indexOf(base) !== 0 // outside of base
			//    || base[0] === '#' && el.href.split(base)[0] !== loc.href.split(base)[0] // outside of #base
			//    || !go(getPathFromBase(el.href), el.title || doc.title) // route not found

			var routed = router.route(node.pathname);

			// If route is accepted, prevent default browser navigation
			if (routed) { e.preventDefault(); }
		}

		router.root   = router;
		router.base   = base || '';
		router.routes = [];

		Object.defineProperty(router, 'path', {
			get: function() { return pathname; }
		});

		window.addEventListener('popstate', listen);
		document.addEventListener('click', click);

		router.destroy = function() {
			window.removeEventListener('popstate', listen);
			document.removeEventListener('click', click);
			prototype.destroy.apply(this);
		};

		router.route = function(path, stack) {
			// No checking that path ends in '/'?
			var rpath = RegExp('^' + router.base);

			// Where no path is given do not update the history state
			if (arguments.length) {
				if (stack === false) {
					history.replaceState(blank, '', path);
				}
				else {
					history.pushState(blank, '', path);
				}
			}

			pathname = location.pathname;

			// Check the path matches the router's path.
			if (!rpath.test(pathname)) { return; }
			if (debug) { console.log('Router: route()', pathname); }

			// Trigger the route change
			return router.trigger(pathname.replace(rpath, ''));
		};

		router.navigate = function(path) {
			return this.route(path) || (location.pathname = path);
		};

		return router;
	}

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
	window.Router = Router;

})(window, window.location, window.history);
