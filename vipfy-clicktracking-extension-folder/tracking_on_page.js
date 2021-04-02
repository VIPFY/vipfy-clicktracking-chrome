
// Inject script for keeping track of event listeners
const injectedScript = document.createElement('script');
injectedScript.src = chrome.extension.getURL('handleListeners.js');
(document.head || document.documentElement).appendChild(injectedScript);

// Connection to Background page:
var eventPipe = chrome.runtime.connect({name: "eventPipe"});

// Listeners for mouse tracking

document.onmousemove = function(e) {
    // console.log(e);
    // console.log(e.clientX + "/" + e.clientY);
    const event = {eventType: "mm", mouseX : e.clientX, mouseY: e.clientY, 
                    time: roundTime(e.timeStamp)};
    // console.log(event);
    eventPipe.postMessage({eventStr: JSON.stringify(event)});
};

document.onmousedown = function(e) {
    // console.log(e);
    var eInfo = checkForClickable(e);
    const event = {eventType: "md", mouseX : e.clientX, mouseY: e.clientY, 
                    time: roundTime(e.timeStamp), mouseButton: e.button, 
                    elementX: eInfo.elementX, elementY: eInfo.elementY, elementH: eInfo.elementH, elementW: eInfo.elementW, 
                    isClickable: eInfo.isClickable};
    var docWidth = document.documentElement.clientWidth || document.body.clientWidth;
    var docHeight = document.documentElement.clientHeight || document.body.clientHeight;
    if (e.clientX >= docWidth)
        event.isVerticalSB = true;
    if (e.clientY >= docHeight)
        event.isHorizontalSB = true;
    // console.log(event);
    eventPipe.postMessage({eventStr: JSON.stringify(event)});
};

document.onmouseup = function(e) {
    // console.log(e);
    var eInfo = checkForClickable(e);
    const event = {eventType: "mu", mouseX : e.clientX, mouseY: e.clientY, 
                    time: roundTime(e.timeStamp), mouseButton: e.button, 
                    elementX: eInfo.elementX, elementY: eInfo.elementY, elementH: eInfo.elementH, elementW: eInfo.elementW, 
                    isClickable: eInfo.isClickable};
    var docWidth = document.documentElement.clientWidth || document.body.clientWidth;
    var docHeight = document.documentElement.clientHeight || document.body.clientHeight;
    if (e.clientX >= docWidth)
        event.isVerticalSB = true;
    if (e.clientY >= docHeight)
        event.isHorizontalSB = true;              
    // console.log(event);                    
    eventPipe.postMessage({eventStr: JSON.stringify(event)});
};

function roundTime(time) {
    return Math.round(time * 100) / 100;
}

function roundPx(numPixels) {
    return Math.round(numPixels * 100) / 100;
}

// Check if the target element or a parent of the target element is something "clickable", e.g. a button,
// and if so return position and size of the element
function checkForClickable(e) {
    // console.log('\n');
    const MAXLVL = 4; // Determines how many lvls are being climbed up to look for sth clickable
    var lvl = 0;
    var target = e.target;
    var isClickable = true;
    // Search for sth clickable by iterating through the parent elements
    while (target && !elemIsClickable(target) && target.parentElement != null) {
        target = target.parentElement;
        lvl++;
        if (lvl > MAXLVL) {
        	// console.log('Reached max climbing lvl');
        	break;
        }
    }
    if (lvl > MAXLVL || !target || target.parentElement == null) {
        // Nothing clickable found
        target = e.target;
        isClickable = false;
    }
    var elementX, elementY, elementW, elementH;
    if (target) {
        // console.log('Clicked on ' + target.tagName);
        const elementRect = target.getBoundingClientRect();
        elementX = roundPx(elementRect.left);
        elementY = roundPx(elementRect.top);
        elementW = roundPx(elementRect.width);
        elementH = roundPx(elementRect.height);
    }
    return {isClickable: isClickable, elementX: elementX, elementY: elementY,
            elementW: elementW, elementH: elementH};
}

// Determines if the given element should be considered sth clickable 
// vs being the background or an inner element of the clickable element
function elemIsClickable(elem) {
    if (!elem) {
        // console.log("Not an element");
        return false;
    }
    // console.log("Checking if elem is clickable: " + elem.tagName);
    if (elem.tagName == "svg") {
        // console.log("Is SVG");
        return false;
    }
    if (elem.tagName == "BODY" || elem.tagName == "MAIN" || elem.tagName == "HTML" || elem.tagName == "NAV") { // Sometimes a click listener is attached to these elements
        // console.log("Reached: " + elem.tagName);
        return false;
    }
    if (elem.tagName == "BUTTON" || elem.tagName == "INPUT" || elem.tagName == "A" || elem.tagName == "LABEL") {
        // console.log("Has special tag");
        return true;
    }
    if (hasEventHandler(elem, "click") ||
        hasEventHandler(elem, "mousedown") ||
        hasEventHandler(elem, "dragstart")) {
        // console.log("Has relevant event handler");
        return true;
    }
    // console.log("Elem is nothing clickable");
    return false;
}

// Checks if the given element has a click-related event listener
function hasEventHandler(elem, type) {
    // console.log("hasEventHandler?");
    if (elem["on" + type]) { // Does not seem to work
        // console.log("has property: on" + type);
        return true;
    }
    if (elem.getAttribute("on" + type)) { // Does not seem to work
        // console.log("has attribute: on" + type);
        return true;
    }
    // Search for listener of the given type in the custom attribute for storing the listeners
    // console.log('Retrieving event listeners list');
    var eventListenersStr = elem.getAttribute('vipfy-clicktracker-eventlisteners');
    if (eventListenersStr) {
        // console.log(eventListenersStr);
        var eventListeners = JSON.parse(eventListenersStr);
        for (const listener of eventListeners.list) {
            if (listener.type === type) {
                // console.log("Found event in event handler list");
                return true;
            }
        }
    }
    return false;
}

