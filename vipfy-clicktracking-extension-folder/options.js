
let enterTokenDiv = document.getElementById('enterTokenDiv');
let pauseDiv = document.getElementById('pauseDiv');
let pauseBtn = document.getElementById('pauseBtn');
let durationInput = document.getElementById('durationInput');
let unpauseDiv = document.getElementById('unpauseDiv');
let status = document.getElementById('status');
let tokenInput = document.getElementById('tokenInput');
let saveBtn = document.getElementById('saveBtn');
let editToken = document.getElementById('editToken');
let clearBtn = document.getElementById('clearBtn');
let daysLeft = document.getElementById('daysLeft');
let cats = document.getElementById('cats');
let catpic = document.getElementById('catpic');

chrome.storage.local.get('vipfyClicktrackerToken', function(data) {
	if (!data.vipfyClicktrackerToken) {
		console.log('No token');
		enterTokenDiv.style.display = 'block';
	}
	else {
		console.log('Token');
		chrome.storage.local.get('tokenInvalid', function(data) {
			if (data.tokenInvalid) {
				status.style.color = "#FFA500";
				status.innerHTML = "INVALID TOKEN <br /> <br />" + 
					"Please check if the entered token is correct. If it is, please contact studien@vipfy.store.";
				editToken.style.display = 'block';
			}
			else {
				chrome.storage.local.get('hasToUseUntil', function(result) {
					const hasToUseUntil = result.hasToUseUntil;
					if (hasToUseUntil) {
						if (hasToUseUntil - Date.now() > 0) {
							daysLeft.style.display = 'block';
							// var timeLeft = "" + calcMinsLeft(hasToUseUntil); // DEBUG
							var timeLeft = "" + calcDaysLeft(hasToUseUntil);
							if (timeLeft == "0")
								timeLeft = "less than a day";
							else if (timeLeft == "1")
								timeLeft = "1 day";
							else
								timeLeft += " days";
							daysLeft.innerHTML = "You will receive your <br> " +
										"Amazon voucher in " + timeLeft;
						}
						else {
							// const day = Math.round(Date.now()/1000); 
							const day = Math.round(Date.now()/1000/60/60/24);
							console.log(day);
							catpic.setAttribute("src", "https://cataas.com/cat/gif?" + day);
							cats.style.display = 'block';
						}

						enterTokenDiv.style.display = 'none';
						status.style.color = "#34b3a4";
						status.innerHTML = "CURRENTLY RUNNING";
						editToken.style.display = 'block';

						/*enterTokenDiv.style.display = 'none';
						chrome.storage.local.get('pause', function(data) {
								if (!data.pause) { // => pause is undefined or false
									status.style.color = "#34b3a4";
									status.innerHTML = "CURRENTLY RUNNING";
									pauseDiv.style.display = 'block';
								}
								else {
									status.style.color = "#eb345e";
									var resumeIn = ((data.pause.resumeTime - Date.now()) / 60) / 1000;
									resumeIn = Math.round(resumeIn);
									status.innerHTML = "TRACKING PAUSED FOR " + resumeIn + " MIN";
									unpauseDiv.style.display = 'block';
								}
						});
						editToken.style.display = 'block';*/
					}
				});
			}
		});
	}
});

function calcDaysLeft(hasToUseUntil) {
	var timeLeft = hasToUseUntil - Date.now();
	return Math.round(timeLeft/1000/60/60/24);
}

function calcMinsLeft(hasToUseUntil) {
	var timeLeft = hasToUseUntil - Date.now();
	return Math.round(timeLeft/1000/60);
}

editToken.onclick = function () {
	chrome.storage.local.get('vipfyClicktrackerToken', function(data) {
		if (data.vipfyClicktrackerToken) {
			tokenInput.value = data.vipfyClicktrackerToken;
			editToken.style.display = 'none';
			enterTokenDiv.style.display = 'block';
		}
	});
}

clearBtn.onclick = function () {
	chrome.storage.local.clear();
	location.reload();
};

pauseBtn.onclick = function () {
	// Save time to resume in ms
	const resumeTime = Date.now() + parseInt(durationInput.value)*60*1000; 
	chrome.storage.local.set({pause: {resumeTime: resumeTime,
										id: generateUuid()}},
							() => {
		console.log('Paused');
		location.reload();
	});
};

unpauseBtn.onclick = function() {
	chrome.storage.local.set({pause: false}, () => {
		console.log('Unpaused');
		location.reload();
	});
};

saveBtn.onclick = function() {
	console.log(tokenInput.value);
	chrome.storage.local.get('vipfyClicktrackerToken', function(data) {
		if (tokenInput.value !== data.vipfyClicktrackerToken)
			chrome.storage.local.set({vipfyClicktrackerToken: tokenInput.value}, () => {
				console.log('Token updated');
				enterTokenDiv.style.display = 'none';
				status.style.color = "#808080";
				status.innerHTML = "TESTING TOKEN..";
			});
		else {
			console.log('Same token saved');
			location.reload();
		}
	});
};

// Update page when token has been tested
chrome.storage.onChanged.addListener(function (changes, areaName) {
	if (changes.tokenInvalid) {
		location.reload();
	}
});

function generateUuid() { // Source: https://stackoverflow.com/a/2117523
  return (`${1e7}-${1e3}-${4e3}-${8e3}-${1e11}`).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}


