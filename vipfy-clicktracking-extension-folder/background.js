// Maintains a list of events related to mouse movement
// Regularly sends events to the server
// Handles Pause/Resume functionality

// Initializing
var events = []
var lastPort = null; // the port from which the last event was received
var lastAbsTime; // Last known absolute time in the current section
var lastAbsX; // Last known absolute X in the current section
var lastAbsY; // Last known absolute Y in the current section
var sessionId = generateUuid();
var isPaused = false;
pushFileStartEvent();
chrome.storage.local.get('pause', function(data) {
	if (!data.pause) { // => pause is undefined or false
		// console.log('Initially not paused');
	}
	else {
		// console.log('Initially paused');
		if (data.pause.resumeTime - Date.now() <= 0) {
			// console.log('Initially: Pause is over');
			chrome.storage.local.set({pause: false});
		}
		else {
			// console.log('Initially: Pause not over');
			isPaused = true;
			const e = {eventType: "ps", resumeIn: data.pause.resumeTime - Date.now(), pauseAfterRestart: true, extLifeTime: roundTime(performance.now())}; // Pause event
			events.push(e);
			console.log(JSON.stringify(events[events.length - 1]));
			setTimeout(function() { // Resume after the specified time has passed
				tryResume(data.pause.id);
			}, data.pause.resumeTime - Date.now());
		}
	}
	// console.log(sessionId);
	setInterval(function () { // Send the events every 5 mins
		var data = events;
		prepareAndSendData(data);
		events = [];
		pushFileStartEvent();
		// console.log('Starting tracking?');
	}, 300000);
});

chrome.storage.onChanged.addListener(function (changes, areaName) {
	if (changes.unsendFiles) {
		console.log('Unsend files got updated: ');
		console.log(changes.unsendFiles);
	}
	// Try sending data when token has been updated to check for validity
	if (changes.vipfyClicktrackerToken) { 
		var data = events;
		prepareAndSendData(data);
		events = [];
		pushFileStartEvent();
	}
	// Handle pause/unpause
	if (changes.pause) { 
		// console.log('Pause newVal: ' + changes.pause.newValue);
		const newVal = changes.pause.newValue;
		if (!newVal) { // Unpause initiated
			isPaused = false;
			const e = {eventType: "ups", extLifeTime: roundTime(performance.now())}; // Unpause event
			events.push(e);
			console.log(JSON.stringify(events[events.length - 1]));	
			resetLastAbs();
		}
		else { // Pause initiated
			isPaused = true;
			const e = {eventType: "ps", resumeIn: newVal.resumeTime - Date.now(), extLifeTime: roundTime(performance.now())}; // Pause event
			events.push(e);
			console.log(JSON.stringify(events[events.length - 1]));
			setTimeout(function() { // Resume after the specified time has passed
				tryResume(newVal.id);
			}, newVal.resumeTime - Date.now());
		}
	}
});

// Checks if given pauseId is the current pauseId
// If and only if so, resume by setting pause to false
// Reason: Manual resume or even starting a new timer might have taken place in the meantime
function tryResume(pauseId) {
	// console.log('Trying resume');
	chrome.storage.local.get('pause', function(data) {
		if (data.pause && data.pause.id === pauseId) {
			// console.log('Pause id matching');
			chrome.storage.local.set({pause: false}); // Unpause logic handled by onChanged Listener
		}
		else {
			// console.log('Pause id NOT matching');
		}
	});
}

function prepareAndSendData(data) {
	// console.log('Preparing data..');
	// console.log(eventsToString(data));
	//console.log(eventsToString(data));
	updateFsAndSendEvents(data);
}

function pushFileStartEvent() {
	const e = {eventType: "fs", session: sessionId, extLifeTime: roundTime(performance.now()), 
		version: chrome.runtime.getManifest().version } // Time relative to start of extension
	events.push(e);
	console.log(JSON.stringify(events[events.length - 1]));
	resetLastAbs();
}

// Update Fs-Event with token, age, gender
// & Compress
// & Send events
function updateFsAndSendEvents(data) {
	data = eventsToString(data);
	console.log('\nTrying to send the following data: \n' + data + '\n');

	chrome.storage.local.get('vipfyClicktrackerToken', function(result) {
        const token = result.vipfyClicktrackerToken;
        if (!token) {
        	console.log('No token found');
        	chrome.storage.local.set({tokenInvalid: {time: performance.now()}},
				        		 () => {}); // time is added so that storage.onchanged fires everytime
        	// Save data for later, when token is available
    	    LZMA.compress(data, 6, result => {
		    	console.log('\nCompressed data:\n' + result + '\n\n');
		    	const compressedData = result;
	        	console.log('Saving file for later..');
        		addFileToStorage(sessionId, compressedData);
		    });
        } 
        else {
        	console.log('Token found');
        	var updatedData = updateFsEvent(data, token);

	        LZMA.compress(updatedData, 6, result => {
		    	console.log('\nCompressed data:\n' + result + '\n\n');
		    	const compressedData = result;
				var formData = new FormData();
				formData.append("session", sessionId);
				var blob = new Blob([Uint8Array.from(compressedData).buffer], {type: "application/x-lzma"});
				formData.append("mousedata", blob);
		    	
		    	var xhr = new XMLHttpRequest();
				xhr.open("POST", 'https://api.studies.vipfy.store/upload', true);
				xhr.setRequestHeader("Authorization", "Bearer " + token);
				console.log('Trying to send compressed data..');
				xhr.onreadystatechange = function() {
				    if (this.readyState === XMLHttpRequest.DONE) {
				    	// Update tokenInvalid value in storage depending on response
				        if (this.response.includes('Unauthentificated') ||
				        	this.response === 'Invalid authentification format' ||
				        	this.response === 'Invalid token') {
				        	chrome.storage.local.set({tokenInvalid: {time: performance.now()}},
				        		 () => {}); // time is added so that storage.onchanged fires everytime
				        }
				        else {
				        	chrome.storage.local.remove('tokenInvalid', () => {
				        		chrome.storage.local.set({tokenInvalid: false}, () => {});
				        	});
				        }
				        if (this.status !== 200) { // Sending was not successful, save data for later
				        	console.log('Sending current file NOT  successful. Saving file for later..');
				        	addFileToStorage(sessionId, compressedData);
				    	}
				    	else { // Sending was successful, try sending the undsend data
				    		console.log('Sending current file successful. Trying to send unsend ones..');
				    		sendUnsendFiles(token);
				    	}
				    }
				}
				xhr.send(formData);
			});        	
        }
    });
}

// Update Fs-Event in data-string by
// updating user id, gender, age if they exist
// or adding them, if they do not exist
function updateFsEvent(data, token) {
	var newLine = data.indexOf('\n');
	var fsEvent = data.slice(0, newLine);
	var restData = data.slice(newLine);
	fsEvent = JSON.parse(fsEvent);

	try {
		var payload = parseJwtPayload(token);
		fsEvent.user = payload.user;
		fsEvent.age = payload.age;
		fsEvent.gender = payload.gender;	
	}
	catch (e) {
	}

	fsEvent = JSON.stringify(fsEvent);
	var updatedData = fsEvent + restData;
	console.log('\nFs-Updated data: \n' + updatedData + '\n');
	return updatedData;
}

// Compress and send events // DEPRECATED
function sendEvents(data) {
	data = eventsToString(data);
	console.log('\nTrying to send the following data: \n' + data + '\n');
    LZMA.compress(data, 6, result => {
    	console.log('\nCompressed data:\n' + result + '\n\n');
    	const compressedData = result;
		var formData = new FormData();
		formData.append("session", sessionId);
		var blob = new Blob([Uint8Array.from(compressedData).buffer], {type: "application/x-lzma"});
		formData.append("mousedata", blob);
    	chrome.storage.local.get('vipfyClicktrackerToken', function(result) {
	        const token = result.vipfyClicktrackerToken;
	        if (!token) {
	        	console.log('No token found');
	        	chrome.storage.local.set({tokenInvalid: {time: performance.now()}},
					        		 () => {}); // time is added so that storage.onchanged fires everytime
	        	// Save data for later, when token is available
	        	console.log('Saving file for later..')
	        	addFileToStorage(sessionId, compressedData);
	        } 
	        else {
	        	console.log('Token found');
	        	var xhr = new XMLHttpRequest();
				xhr.open("POST", 'https://api.studies.vipfy.store/upload', true);
				xhr.setRequestHeader("Authorization", "Bearer " + token);
				console.log('Trying to send compressed data..');
				xhr.onreadystatechange = function() {
				    if (this.readyState === XMLHttpRequest.DONE) {
				    	// Update tokenInvalid value in storage depending on response
				        if (this.response.includes('Unauthentificated') ||
				        	this.response === 'Invalid authentification format' ||
				        	this.response === 'Invalid token') {
				        	chrome.storage.local.set({tokenInvalid: {time: performance.now()}},
				        		 () => {}); // time is added so that storage.onchanged fires everytime
				        }
				        else {
				        	chrome.storage.local.remove('tokenInvalid', () => {
				        		chrome.storage.local.set({tokenInvalid: false}, () => {});
				        	});
				        }
				        if (this.status !== 200) { // Sending was not successful, save data for later
				        	console.log('Sending current file NOT  successful. Saving file for later..');
				        	addFileToStorage(sessionId, compressedData);
				    	}
				    	else { // Sending was successful, try sending the undsend data
				    		console.log('Sending current file successful. Trying to send unsend ones..');
				    		sendUnsendFiles(token);
				    	}
				    }
				}
				xhr.send(formData);
	        }
	    });
	});
}

// Add file to the list of unsend files in the storage
function addFileToStorage(sessionId, compressedData) {
	chrome.storage.local.getBytesInUse(null, function(bytesInUse) {
		console.log('Storage bytes used: ' + (bytesInUse/chrome.storage.local.QUOTA_BYTES)*100 + '%');
		if ((bytesInUse / chrome.storage.local.QUOTA_BYTES) < 0.9) {
			chrome.storage.local.get('unsendFiles', function(result) {
				var unsendFiles = result.unsendFiles;
				if (!unsendFiles)
					unsendFiles = [];
				unsendFiles.push({sessionId: sessionId, compressedData: compressedData}); 
				chrome.storage.local.set({unsendFiles: unsendFiles}, () => {});
			});
		}
		else {
			console.log('Storage limit reached. Not adding anymore files.');
		}
	});
}

// Send unsend files, one after another, until sending is unsuccessful or list is empty
function sendUnsendFiles(token) {
	var xhr = new XMLHttpRequest();
	xhr.open("POST", 'https://api.studies.vipfy.store/upload', true);
	xhr.setRequestHeader("Authorization", "Bearer " + token);
	console.log('Trying to send unsend file..');
	chrome.storage.local.get('unsendFiles', function(result) {
		const unsendFiles = result.unsendFiles;
		if (unsendFiles && unsendFiles.length > 0) {
			console.log('Got unsend files to send');
			const file = unsendFiles.pop();

			xhr.onreadystatechange = function() {
			    if (this.readyState === XMLHttpRequest.DONE) {
			    	if (this.status === 200) {
			    		console.log('Sending unsend file successful');
			    		chrome.storage.local.set({unsendFiles: unsendFiles}, () => {
			    			setTimeout(function() { 
			    				sendUnsendFiles(token);
			    			}, 1000);
			    		});
			    	}
			    	else {
			    		console.log('Sending unsend file NOT successful');
			    	}
			    }
			}

			console.log('Decompressing unsend file..');
			LZMA.decompress(file.compressedData, result => {
		    	uncompressedData = result;
	        	uncompressedData = updateFsEvent(uncompressedData, token);
	        	console.log('Compressing updated unsend file..');
	        	LZMA.compress(uncompressedData, 6, result => {
			    	const compressedData = result;
    				var formData = new FormData();
					formData.append("session", file.sessionId);
					var blob = new Blob([Uint8Array.from(compressedData).buffer], {type: "application/x-lzma"});
					formData.append("mousedata", blob);
					xhr.send(formData);
			    });
		    });			
		}
		else {
			console.log('No unsend files to send');
		}
	});
}

// Listeners

chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason == "install") {
        chrome.storage.local.set({hasToUseUntil: Date.now() + 1000*60*60*24*30}, 
				() => {
					chrome.runtime.openOptionsPage();
				}
		); // 30 days
			// chrome.storage.local.set({hasToUseUntil: Date.now() + 1000*60*3}, 
			// 	() => {}); // 3 min DEBUG	
			// chrome.storage.local.set({hasToUseUntil: Date.now()}, 
			// 	() => {}); // Instantly DEBUG	
    }
});

// Listen for events send from the content scripts
chrome.runtime.onConnect.addListener(function(port) {
  console.assert(port.name == "eventPipe");
  // console.log("New port added");
  port.onMessage.addListener(function(msg) {
  	if (!isPaused) {
	  	if (port != lastPort) {
	  		const event = {eventType: "pc", extLifeTime: roundTime(performance.now())} // page change event
	  		events.push(event);
	  		console.log(JSON.stringify(events[events.length - 1]));
	  		resetLastAbs();
	  	}
	  	// console.log('\n');
	  	// console.log('time: ' + lastAbsTime + ', x: ' + lastAbsX + ', y: ' + lastAbsY);
	  	// console.log(msg.eventStr); // DEBUG

	  	var event = JSON.parse(msg.eventStr);

	  	// Logic for deciding whether events are relative or absolute
	  	// and if they should be relative adjusting them
	  	// Making values relative leads to more compact data
	  	var tempTime, tempX, tempY;
	  	if (event.mouseX != undefined && event.mouseY != undefined) {
	  		// console.log('Has x/y');
	  		// Mouse position and time have to be considered
	  		tempTime = event.time;
	  		tempX = event.mouseX;
	  		tempY = event.mouseY;
	  		if (lastAbsTime != undefined && lastAbsX != undefined && lastAbsY != undefined) {
	  			// console.log('Has abs time, x, y');
	  			event.relative = true;
	  			// Build difference to last known values
	  			event.time -= lastAbsTime;
	  			event.time = roundTime(event.time);
	  			event.mouseX -= lastAbsX;
	  			event.mouseY -= lastAbsY;
	  		}
	  		else {
	  			// console.log('Has NOT abs time, x,y');
	  			event.relative = false;
	  		}
	  		// console.log('Right before updating last abs');
	  		lastAbsTime = tempTime;
	  		lastAbsX = tempX;
			lastAbsY = tempY;
			// console.log('Updated lasts: ' + 'time: ' + lastAbsTime + ', x: ' + lastAbsX + ', y: ' + lastAbsY);
	  	}
	  	else {
	  		// console.log('Has no x/y');
	  		// Only time has to be considered
	  		tempTime = event.time;
	  		if (lastAbsTime != undefined) {
	  			event.relative = true;
	  			// Build difference to last known value
	  			event.time -= lastAbsTime;
	  			event.time = roundTime(event.time);
	  		}
	  		else {
	  			event.relative = false;
	  		}
	  		lastAbsTime = tempTime;
	  	}

	  	events.push(event);
		console.log(JSON.stringify(events[events.length - 1]));
		lastPort = port;
  	}
  });
});

// Small util functions

// Reset last absolute values if new section starts
function resetLastAbs() {
	// console.log('Reset last abs');
	lastAbsTime = undefined;
	lastAbsX = undefined;
	lastAbsY = undefined;
}

function roundTime(time) {
	return Math.round(time * 100) / 100;
}

function parseJwtPayload(token) { // Source: https://stackoverflow.com/questions/38552003
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
};

function generateUuid() { // Source: https://stackoverflow.com/a/2117523
  return (`${1e7}-${1e3}-${4e3}-${8e3}-${1e11}`).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function eventsToString(events) {
	var str = "";
	events.forEach(event => {
		str = str.concat(JSON.stringify(event), '\n') 
	});
	return str;
}