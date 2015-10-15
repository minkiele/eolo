var EoloQuota, Messenger, Request, RequestType, Responder, Timer;

EoloQuota = (function() {
  function EoloQuota() {}

  EoloQuota.prototype.parseResetDate = function(str) {
    return moment(cloned.data.nextReset, 'YYYY-MM-DD HH:mm:ss').toDate();
  };

  EoloQuota.prototype.getQuota = function() {
    return this.getCachedQuota().then(null, (function(_this) {
      return function() {
        return _this.getAjaxQuota().done(function(quota) {
          return _this.setCachedQuota(quota);
        });
      };
    })(this));
  };

  EoloQuota.prototype.getAjaxQuota = function() {
    return jQuery.get('https://care.ngi.it/ws/ws.asp', {
      a: 'get.quota'
    }, 'json').promise();
  };

  EoloQuota.prototype.getCachedQuota = function() {
    return this.getCacheExpiration().then((function(_this) {
      return function(expiration) {
        return jQuery.Deferred(function(self) {
          return chrome.storage.local.get('quota', function(item) {
            if (chrome.runtime.lastError != null) {
              return self.rejectWith(_this, [chrome.runtime.lastError]);
            } else if (item.quota != null) {
              return self.resolveWith(_this, [item.quota]);
            } else {
              return self.rejectWith(_this, ['Missing item']);
            }
          });
        }).promise();
      };
    })(this));
  };

  EoloQuota.prototype.getCacheExpiration = function() {
    return jQuery.Deferred((function(_this) {
      return function(self) {
        return chrome.storage.local.get('expiration', function(item) {
          var expiration;
          if (chrome.runtime.lastError != null) {
            return self.rejectWith(_this, [chrome.runtime.lastError]);
          } else if (item.expiration == null) {
            return self.rejectWith(_this, ['Expiration not set']);
          } else {
            expiration = moment(item.expiration);
            if (expiration.isAfter()) {
              return self.resolveWith(_this, [expiration]);
            } else {
              return self.rejectWith(_this, ['Cache Expired']);
            }
          }
        });
      };
    })(this)).promise();
  };

  EoloQuota.prototype.setCacheExpiration = function() {
    return jQuery.Deferred((function(_this) {
      return function(self) {
        var now;
        now = moment().add(2, 'h');
        return chrome.storage.local.set({
          'expiration': now.valueOf()
        }, function() {
          if (chrome.runtime.lastError != null) {
            return self.rejectWith(_this, [chrome.runtime.lastError]);
          } else {
            return self.resolveWith(_this, [now]);
          }
        });
      };
    })(this)).promise();
  };

  EoloQuota.prototype.setCachedQuota = function(quota) {
    return this.setCacheExpiration().then((function(_this) {
      return function(expiration) {
        return jQuery.Deferred(function(self) {
          return chrome.storage.local.set({
            'quota': quota
          }, function() {
            if (chrome.runtime.lastError != null) {
              return self.rejectWith(_this, [chrome.runtime.lastError]);
            } else {
              return self.resolveWith(_this, [quota]);
            }
          });
        }).promise();
      };
    })(this));
  };

  return EoloQuota;

})();

Request = (function() {
  function Request(type, params1) {
    this.type = type;
    this.params = params1 != null ? params1 : {};
  }

  return Request;

})();

Responder = (function() {
  function Responder(type, respond1) {
    this.type = type;
    this.respond = respond1;
  }

  return Responder;

})();

Messenger = (function() {
  var responders;

  function Messenger() {}

  responders = {};

  chrome.runtime.onMessage.addListener(function(request, sender, sendBack) {
    var promise, responder, responderType;
    for (responderType in responders) {
      responder = responders[responderType];
      if (responderType === request.type) {
        promise = jQuery.when(responder.respond(request.params));
        promise.always(function(response) {
          return sendBack(response);
        });
        break;
      }
    }
    return true;
  });

  Messenger.send = function(request) {
    return jQuery.Deferred((function(_this) {
      return function(self) {
        return chrome.runtime.sendMessage(request, function(response) {
          if (chrome.runtime.lastError != null) {
            return self.rejectWith(_this, [chrome.runtime.lastError]);
          } else {
            return self.resolveWith(_this, [response]);
          }
        });
      };
    })(this)).promise();
  };

  Messenger.addResponder = function(responder) {
    return responders[responder.type] = responder;
  };

  return Messenger;

})();

Timer = (function() {
  var addSubscriber, subscribers;

  subscribers = {};

  addSubscriber = function(name, respond) {
    return subscribers[name] = respond;
  };

  chrome.alarms.onAlarm.addListener(function(alarm) {
    if (subscribers[alarm.name] != null) {
      return subscribers[alarm.name](alarm);
    }
  });

  function Timer(name1, timeout, periodic, respond1) {
    var params;
    this.name = name1;
    this.timeout = timeout;
    this.periodic = periodic != null ? periodic : true;
    this.respond = respond1 != null ? respond1 : jQuery.noop;
    params = {
      when: Date.now() + this.timeout
    };
    if (this.periodic) {
      params.periodInMinutes = Math.ceil(this.timeout / 60000);
    }
    chrome.alarms.create(this.name, params);
    addSubscriber(this.name, (function(_this) {
      return function(alarm) {
        return _this.respond(alarm);
      };
    })(this));
  }

  Timer.prototype.clear = function() {
    return chrome.alarm.clear(this.name, (function(_this) {
      return function(cleared) {
        return jQuery.Deferred(function(self) {
          if (cleared) {
            return self.resolveWith(_this);
          } else {
            return self.rejectWith(_this);
          }
        }).promise();
      };
    })(this));
  };

  return Timer;

})();

RequestType = {
  GET_QUOTA: 'getQuota'
};

Messenger.addResponder(new Responder(RequestType.GET_QUOTA, function() {
  return new EoloQuota().getQuota();
}));

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

function getParsedData (text) {
  var parsed;
  try{
    parsed = JSON.parse(text);
    if(parsed.response.status == 200){
      return {
        quota: parsed.data.quota,
        used: parsed.data.used,
        diff: parsed.data.quota - parsed.data.used
      };
    }else{
      throw "Response not ok";
    }
  }catch(err){
    addError(err);
  }
}

function getQuotaBadgeText (quota) {
  return quota.substr(0, 4);
}

function addError(){
}

function setBadgeText (quota) {
  chrome.browserAction.setBadgeText({
    text: quota
  });
}

function updateInterface (parsed) {
  var readable = getHumanReadableQuota(parsed.diff),
      badgeText = getQuotaBadgeText(readable);
  
  if(parsed.quota > 0){
    setBadgeText(badgeText);
  }
}

function getQuota (callback) {
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

function scheduleUpdates () {
  chrome.alarms.create('getQuota', {
    delayInMinutes: 7200,
    periodInMinutes: 7200
  });
}

function handleAlarm () {
  chrome.alarms.onAlarm.addListener(function(alarm){
    if(alarm.name == "getQuota"){
      getQuota(dispatchUpdateInterface);
    }
  });
}

function dispatchUpdateInterface (data) {
  updateInterface(data);
  chrome.runtime.sendMessage({type: 'updateQuota', data: data});
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
  if(request.type == 'requestUpdateQuota'){
    getQuota(function(data){
      updateInterface(data);
      sendResponse(data);
    });
    
    return true;
    
  }
});

function answerToPopupMessages (data) {
  updateInterface(data);
}

scheduleUpdates();
handleAlarm();
getQuota(dispatchUpdateInterface);

