(function(window) {
	"use strict";

	var debug = true;

	var Fn       = window.Fn;
	var dom      = window.dom;
	var location = window.location;
	var history  = window.history;

	var assign   = Object.assign;
	var entries  = Object.entries;
	var classOf  = Fn.classOf;
	var noop     = Fn.noop;
	var slice    = Function.prototype.call.bind(Array.prototype.slice);

	var blank    = {};
	var rslash   = /^\//;

	var catchersSymbol = Symbol('catchers');

	//var properties = {
	//	root: { value: undefined, enumerable: false, writable: true }
	//};

	function getCatchers(object) {
		return object[catchersSymbol] || (object[catchersSymbol] = []);
	}

	function getLinkNode(e) {
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

		return node;
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

	// .trigger(path)
	// Call all routes whose regex matches path, passing the result of any
	// capturing groups to the handler. Data about the current path is
	// stored on the regex object. It is used internally by .create().

	function trigger(router, path) {
		var n = -1;
		var l = router.routes.length;
		//var count = 0;
		var route, args, stop;
		//console.log('>>>', path);
		while (++n < l) {
			route = router.routes[n];
			args  = route[0].exec(path);

			if (args) {
				route[0].lastString = path;
				route[0].lastMatch = args[0];
				stop = route[1].apply(null, slice(args, 1)) || noop;
				//count++;

				// Use this to call first matching route only
				break;
			}
		}

		var catchers;

		//if (count === 0) {
		if (!stop) {
			catchers = getCatchers(router);
			n = -1;
			l = catchers.length;

			while (++n < l) {
				catchers[n].call(this, path);
				//count++;
			}
		}

		return stop;
	}

	function updateHistory(path, replace) {
		// Where no path is given do not update the history state
		if (path !== undefined) {
			if (replace) {
				history.replaceState(blank, '', path);
			}
			else {
				history.pushState(blank, '', path);
			}
		}
	}

	function toRegexKey(entry) {
		entry[0] = RegExp(entry[0]);
		return entry;
	}

	function Router(path, routes) {
		if (!Router.prototype.isPrototypeOf(this)) {
			return new Router(path, routes);
		}

		var router   = this;
		var pathname = location.pathname;
		var stop;

		function route() {
			var rpath = RegExp('^' + router.base + '/');
			pathname = location.pathname;

			// Check the path matches the router's path.
			if (!rpath.test(pathname)) {
				console.warn('Router: non matching path??', rpath, pathname)
				//location.pathname = path;
				return;
			}

			if (debug) { console.log('Router: navigate to ', pathname); }

			// Trigger the route change
			stop && stop();
			stop = trigger(router, pathname.replace(rpath, ''));

			return !!stop;
		}

		function popstate() {
			// Hash changes fire popstate. We don't want to
			// change the route unless the pathname has changed.
			if (location.pathname === pathname) { return; }

			// Trigger route
			route();
		}

		function click(e) {
			var node = getLinkNode(e);
			if (!node) { return; }

			// We don't want to change the route unless the pathname will change.
			if (node.pathname === pathname) {
				e.preventDefault();
				return;
			}

			var routed = router.navigate(node.pathname);
			if (routed) {
				e.preventDefault();
			}
		}

		router.base   = path || '';
		router.routes = routes ?
			entries(routes).map(toRegexKey) :
			[] ;

		Object.defineProperty(router, 'path', {
			get: function() { return pathname; }
		});

		window.addEventListener('popstate', popstate);
		document.addEventListener('click', click);

		router.destroy = function() {
			window.removeEventListener('popstate', popstate);
			document.removeEventListener('click', click);
			this.off();
			return this;
			//prototype.destroy.apply(this);
		};

		this.navigate = function navigate(path, replace) {
			var absPath = rslash.test(path) ? path : (router.base + '/' + path);
			updateHistory(absPath, replace);
			return route();
		};
	}

	assign(Router.prototype, {
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

			var test = classOf(regex) === 'function' ? testFn
				: !fn ? testRegex
				: testBoth ;

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

		create: function create(regex, routes) {
			return new SubRouter(this, this, regex, routes);
		}
	});

	function SubRouter(root, router, regex, routes) {
		var sub = this;

		this.routes = routes ?
			entries(routes).map(toRegexKey) :
			[] ;

		this.navigate = function navigate(path) {
			if (this.path === undefined) { return this; }

			// Where path has a leading '/' send it to root.navigate.
			// In other words, treat it as an absolute URL.
			path = rslash.test(path) ? path : (this.path + '/' + path);
			root.navigate(path);
			return this;
		};

		this.create = function create(regex, routes) {
			return new SubRouter(root, this, regex, routes);
		};

		router.on(regex, function() {
			// Set the current root path for the router
			sub.base = regex.lastMatch;

			// Trigger the router with the unmatched remainder of the path
			trigger(sub, regex.lastString.replace(regex, '').replace(rslash, ''));
		});
	}

	assign(SubRouter.prototype, Router.prototype);


	// Export

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

})(this);
