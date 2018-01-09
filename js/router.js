(function(window) {
	"use strict";

	var DEBUG    = window.DEBUG !== false;

	var location = window.location;
	var history  = window.history;

	var assign   = Object.assign;
	var entries  = Object.entries;
	var slice    = Function.prototype.call.bind(Array.prototype.slice);

	var blank    = {};
	var rslash   = /^\//;
	var routers  = [];


	function noop() {}

	function isPrimaryButton(e) {
		// Ignore mousedowns on any button other than the left (or primary)
		// mouse button, or when a modifier key is pressed.
		return (e.which === 1 && !e.ctrlKey && !e.altKey && !e.shiftKey);
	}

	function matches(selector, node) {
		return node.matches ? node.matches(selector) :
			node.matchesSelector ? node.matchesSelector(selector) :
			node.webkitMatchesSelector ? node.webkitMatchesSelector(selector) :
			node.mozMatchesSelector ? node.mozMatchesSelector(selector) :
			node.msMatchesSelector ? node.msMatchesSelector(selector) :
			node.oMatchesSelector ? node.oMatchesSelector(selector) :
			noop ;
	}

	function closest(selector, node) {
		if (!node || node === document || node.nodeType === 11) { return; }

		// SVG <use> elements store their DOM reference in
		// .correspondingUseElement.
		node = node.correspondingUseElement || node ;

		return matches(selector, node) ?
			 node :
			 closest(selector, node.parentNode) ;
	}

	function getLinkNode(e) {
		// Already handled
		if (e.defaultPrevented) { return; }

		// Not primary button
		if (!isPrimaryButton(e)) { return; }

		var node = closest('a[href]', e.target);

		// Not in a link
		if (!node) { return; }

		// A download
		if (node.getAttribute('download')) { return; }

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

	function updateHistory(pathname) {
		var replace;

		// Only update history where pathname is not the current location
		if (pathname === location.pathname) { return; }

		//if (DEBUG) { console.log('Router: update history', pathname); }

		if (replace) {
			history.replaceState(blank, '', pathname);
		}
		else {
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
		var route, args;

		while (++n < l) {
			route = router.routes[n];
			args  = route[0].exec(path);

			if (args) {
				route[0].lastString = path;
				route[0].lastMatch = args[0];

				// Call first matching route only
				return route[1].apply(null, slice(args, 1)) || noop;
			}
		}
	}

	function Router(base, routes) {
		if (!Router.prototype.isPrototypeOf(this)) {
			return new Router(path, routes);
		}

		var router = this;
		var path, stop;

		router.base = base || '';

		router.routes = routes ?
			entries(routes).map(toRegexKey) :
			[] ;

		router.route = function(pathname) {
			if (rslash.test(pathname)) {
				if (!pathname.startsWith(router.base)) {
					if (DEBUG) { console.warn('Router:route() path does not match router.base', path, router.base); }
					stop && stop();
					return false;
				}

				pathname = pathname.replace(router.base + '/', '');
			}

			// If this is the current path return true to indicate that
			// this router does handle this path.
			if (pathname === path) {
				return true;
			}

			stop && stop();

			// If routing is successful update path and rturn true to indicate
			// that this router handled the path.
			if (stop = route(router, pathname)) {
				path = pathname;
				return true;
			}

			path = undefined;
			return false;
		};

		router.navigate = function(path) {
			var pathname = rslash.test(path) ? path : (router.base + '/' + path);
			return Router.navigate(pathname);
		};

		router.destroy = function() {
			this.off();
			var i = routers.indexOf(router);
			if (i > -1) { routers.splice(i, 1); }
			return router;
		};

		// Register router and launch current route
		routers.push(this);
		router.route(location.pathname);
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
		navigate: function(pathname) {
			if (Router.route(pathname)) {
				updateHistory(pathname);
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
			.map(function(router) { return router.route(pathname); })
			.indexOf(true) > -1 ;
		}
	});


	// Hijack links and route accordingly

	document.addEventListener('click', function click(e) {
		var node = getLinkNode(e);
		if (!node) { return; }

		// On successful routing prevent the click
		if (Router.navigate(node.pathname)) {
			e.preventDefault();
			//pathname = location.pathname;
		}
	});


	// Listen to back/forward state changes and act accordingly

	window.addEventListener('popstate', function popstate(e) {
		if (DEBUG) { console.log('Router: popstate', e.state); }

		// Trigger route
		if (Router.route(location.pathname)) {
			//pathname = location.pathname;
		}
	});


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
