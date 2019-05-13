
import Router from './router.js';

var DEBUG  = window.DEBUG !== false;


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


// Hijack links and route accordingly

document.addEventListener('click', function click(e) {
	var node = getLinkNode(e);
	if (!node) { return; }

	// On successful routing, and where there are no hashes to jump to,
	// prevent the click
	if (Router.navigate(node.pathname) && node.hash === location.hash) {
		e.preventDefault();
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
