(function(window, location, history) {
	"use strict";

	var slice = Function.prototype.call.bind(Array.prototype.slice);

	var prototype = {

		// .on(regex, fn)
		// Bind a fn to be called whenever regex matches the route. Callback fn
		// is called with 'this' set to the router, and the arguments
		// fn(unmatched, capture1, capture2, ...)

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
		// Call all routes whose regex matches path, passing the remainder
		// of the path after the match and the result of any capturing groups

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

		create: function create(regex) {
			var router = Object.create(prototype, properties);

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
		
		navigate: function navigate(path, state) {
			var rootPath = this.path + path;

			history.pushState(state, '', rootPath);

			// A pushState call does not send a popstate event,
			// so we must manually trigger the route change.
			setTimeout(this.trigger.bind(this, rootPath), 0);
			return this;
		},

		redirect: function redirect(path, state) {
			var rootPath = this.path + path;

			history.replaceState(state, '', rootPath);

			// A pushState call does not send a popstate event,
			// so we must manually trigger the route change.
			setTimeout(this.trigger.bind(this, rootPath), 0);
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
		path: { value: '', enumerable: false, writable: true },
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

	function call(fn) {
		fn.call(this);
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

	function Router() {
		var router = Object.create(prototype, properties);

		function listen() {
			router.trigger(location.pathname);
		}

		window.addEventListener('popstate', listen);
		
		router.destroy = function() {
			window.addEventListener('popstate', listen);
			prototype.destroy.apply(this);
		};

		//window.addEventListener('load', chooseRoutes);
		router.trigger(location.pathname);

		return router;
	}

	window.Router = Router;

})(window, window.location, window.history);