function getHumanReadableQuota (kbytes) {
  var quota;
  if(kbytes >= 100 * 1024){
    quota = Math.floor(kbytes / 1024 / 1024) + 'GB';
  } else if(kbytes >= 1024){
    quota = Math.floor(kbytes / 1024) + 'MB';
  } else {
    quota = kbytes + 'KB';
  }
  return quota;
}

function getParsedData(text){
  var parsed;
  try{
    parsed = JSON.parse(text);
    if(parsed.response.status == 200){
      return {
        quota: parsed.data.quota,
        used: parsed.data.used,
        diff: parsed.data. quota - parsed.data.used
      };
    }else{
      throw "Response not ok";
    }
  }catch(err){
    addError(err);
  }
}

function getQuotaBadgeText(quota){
  return quota.substr(0, 4);
}

function addError(){
}

function setBadgeText(quota){
  chrome.browserAction.setBadgeText({
    text: quota
  });
}

function updateInterface(parsed){
  var readable = getHumanReadableQuota(parsed.diff),
      badgeText = getQuotaBadgeText(readable);
  setBadgeText(badgeText);
}

function getQuota(callback){
  var req = new XMLHttpRequest();
  req.onreadystatechange = function(){
    var parsed;
    if(req.readyState == 4){
      parsed = getParsedData(req.responseText);
      callback(parsed);
    }
  };
  req.open('GET', 'https://care.ngi.it/ws/ws.asp?a=get.quota', true);
  req.send();
}

function scheduleUpdates(){
  chrome.alarms.create('getQuota', {
    delayInMinutes: 7200,
    periodInMinutes: 7200
  });
}

function handleAlarm(){
  chrome.alarms.onAlarm.addListener(function(alarm){
    if(alarm.name == "getQuota"){
      getQuota(dispatchUpdateInterface);
    }
  });
}

function dispatchUpdateInterface(data){
  updateInterface(data);
  chrome.runtime.sendMessage({type: 'updateQuota', data: data});
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
  if(request.type == 'requestUpdateQuota'){
    getQuota(function(data){
      updateInterface(data);
      sendResponse(data);
    });
  }
});

function answerToPopupMessages(data){
  updateInterface(data);
  
}

scheduleUpdates();
handleAlarm();
getQuota(dispatchUpdateInterface);

