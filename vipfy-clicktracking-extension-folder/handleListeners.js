// This script does the following:
// For each relevant element manage a list of attached, click-related event handlers.
// This list is accessed by the tracking content script to determine
// whether an element should be considered sth "clickable"

// console.log("Handling listeners..");

const relevantTags = ['DIV', 'IMG', 'SPAN'];
const relevantTypes = ['click', 'mousedown', 'dragstart'];

Element.prototype._addEventListener = Element.prototype.addEventListener;
Element.prototype.addEventListener = function (type, listener, useCapture) {
	// console.log('Adding listener to ' + this.tagName);
	this._addEventListener(type, listener, useCapture);
	// console.log('\n');
	// console.log(this.tagName);
	// console.log(type);
	// console.log(relevantTags.includes(this.tagName) && relevantTypes.includes(type));
	if (relevantTags.includes(this.tagName) && relevantTypes.includes(type)) {
		// console.log(this.tagName);
		// console.log(type);
		useCapture = thirdArgToBool(useCapture);
		var eventListenersStr = this.getAttribute('vipfy-clicktracker-eventlisteners');
		var eventListeners;
		if (eventListenersStr) {
			eventListeners = JSON.parse(eventListenersStr);
		}
		else {
			eventListeners = {list: []} // , addedList : [], removeList: []} // For debugging
		}
		// Duplicates will get added, but all of them will be removed when removeEventListener is called
		// eventListeners.addedList.push({type: type, listener: listener.toString(), hash: strToHash(listener.toString()), useCapture: useCapture}); // For debugging
		eventListeners.list.push({type: type, hash: strToHash(listener.toString()), useCapture: useCapture});
		this.setAttribute('vipfy-clicktracker-eventlisteners', JSON.stringify(eventListeners));
	}
};

Element.prototype._removeEventListener = Element.prototype.removeEventListener;
Element.prototype.removeEventListener = function (type, listener, useCapture) {
	// console.log('Removing listener from ' + this.tagName);
	this._removeEventListener(type, listener, useCapture);
	if (relevantTags.includes(this.tagName) && relevantTypes.includes(type)) {
		useCapture = thirdArgToBool(useCapture);
		var eventListenersStr = this.getAttribute('vipfy-clicktracker-eventlisteners');
		var eventListeners;
		if (eventListenersStr) {
			eventListeners = JSON.parse(eventListenersStr);
		}
		else {
			eventListeners = {list: []} // , addedList : [], removelist: []}; // for debugging
		}
		// Look for matching listeners in the list and remove all of them
		var listeners = eventListeners.list;
		var index;
		do {
			index = listeners.findIndex((currListener) => 
				currListener.type === type 
				&& currListener.hash === strToHash(listener.toString())
				&& currListener.useCapture === useCapture);	
			if (index !== -1)
				listeners.splice(index, 1);
		}
		while (index !== -1);
		// eventListeners.removeList.push({type: type, listener: listener.toString(), hash: strToHash(listener.toString()), useCapture: useCapture}); // for debugging
		this.setAttribute('vipfy-clicktracker-eventlisteners', JSON.stringify(eventListeners));
	}
};

function thirdArgToBool(arg) {
	switch(typeof arg) { // Handle different types of third arg
	case "undefined":
		return false;
	case "boolean":
		return arg;
	case "object":
		if (typeof arg.capture === 'boolean')
			return arg.capture;
		else
			return false;
		break;
	}
	return false;
}

function strToHash(str) {
	var hash = 0, i, chr;
    for (i = 0; i < str.length; i++) {
      chr   = str.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
}