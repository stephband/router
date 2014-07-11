(function(window, location, history) {
	"use strict";

	var slice = Function.prototype.call.bind(Array.prototype.slice);

	var prototype = {
		// .on(regex, fn)
		// Bind a fn to be called whenever regex matches the route. Callback fn
		// is called with 'this' set to the router, and the arguments
		// fn(unmatched, capture1, capture2, ...)

		on: function on(regex, fn) {
			var routes = getArray(this, 'routes');
			routes.push(slice(arguments));
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
			var routes = getArray(this, 'routes');
			var n = routes.length;

			if (arguments.length === 0) {
				routes.length = 0;
				return this;
			}

			var test = classOf(regex) === 'function' ? testFn :
			    	!fn ? testRegex :
			    	testBoth ;

			while (n--) {
				if (test(routes[n], regex, fn)) {
					routes.splice(n, 1);
				}
			}

			return this;
		},

		catch: function(fn) {
			var array = getArray(this, 'catchers');
			array.push(fn);
			return this;
		},

		// .trigger(path)
		// Call all routes whose regex matches path, passing the remainder
		// of the path after the match and the result of any capturing groups

		trigger: function trigger(path) {
			var routes = getArray(this, 'routes');
			var n = -1;
			var l = routes.length;
			var route, args;
			var count = 0;
			var array;

			this.path = path;

			while (++n < l) {
				route = routes[n];
				args = route[0].exec(path);
				
				if (args) {
					// Make the first argument the remainder of the string left
					// after the match.
					args[0] = path.replace(route[0], '');
					route[1].apply(this, args);
					count++;
				}
			}

			if (count === 0) {
				array = getArray(this, 'catchers');
				array.forEach(call, this);
			}

			return this;
		},

		create: function create(regex) {
			var router = Object.create(prototype, properties);

			this.on(regex, router.trigger.bind(router));

			return router;
		},
		
		destroy: function destroy() {
			this.off();
			return this;
		},
		
		navigate: function navigate(path, state) {
			history.pushState(state, '', path);
			
			// A pushState call does not send a popstate event,
			// so we must manually trigger the route change.
			setTimeout(this.trigger.bind(this, path), 0);
			return this;
		},

		redirect: function redirect(path, state) {
			history.replaceState(state, '', path);
			
			// A pushState call does not send a popstate event,
			// so we must manually trigger the route change.
			setTimeout(this.trigger.bind(this, path), 0);
			return this;
		}
	};

	var properties = {
		path: { value: '', enumerable: true, writable: true }
	};


	function getArray(object, property) {
		if (!object[property]) {
			Object.defineProperty(object, property, {
				value: []
			});
		}

		return object[property];
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