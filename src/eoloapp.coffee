class EoloQuota

  parseResetDate: (str) ->
    moment(cloned.data.nextReset, 'YYYY-MM-DD HH:mm:ss').toDate()

  getQuota: ->
    @getCachedQuota().then null,
      => @getAjaxQuota().done (quota) =>
        @setCachedQuota quota

  getAjaxQuota: ->
    jQuery.get 'https://care.ngi.it/ws/ws.asp', {a: 'get.quota'}, 'json'
      .promise()

  getCachedQuota: ->
    @getCacheExpiration().then (expiration) =>
      jQuery.Deferred (self) =>
        chrome.storage.local.get 'quota', (item) =>
          if chrome.runtime.lastError?
            self.rejectWith @, [chrome.runtime.lastError]
          else if item.quota?
            self.resolveWith @, [item.quota]
          else
            self.rejectWith @, ['Missing item']
      .promise()

  getCacheExpiration: ->
    jQuery.Deferred (self) =>
      chrome.storage.local.get 'expiration', (item) =>
        if chrome.runtime.lastError?
          self.rejectWith @, [chrome.runtime.lastError]
        else if not item.expiration?
          self.rejectWith @, ['Expiration not set']
        else
          expiration = moment(item.expiration)
          if expiration.isAfter()
            self.resolveWith @, [expiration]
          else
            self.rejectWith @, ['Cache Expired']
    .promise()

  setCacheExpiration: () ->
    jQuery.Deferred (self) =>
      now = moment().add 2, 'h'
      chrome.storage.local.set
        'expiration': now.valueOf(),
        =>
          if chrome.runtime.lastError?
            self.rejectWith @, [chrome.runtime.lastError]
          else
            self.resolveWith @, [now]
    .promise()

  setCachedQuota: (quota) ->
    @setCacheExpiration().then (expiration) =>
      jQuery.Deferred (self) =>
        chrome.storage.local.set
          'quota': quota,
          =>
            if chrome.runtime.lastError?
              self.rejectWith @, [chrome.runtime.lastError]
            else
              self.resolveWith @, [quota]
      .promise()

class Request
  constructor: (@type, @params = {}) ->

class Responder
  constructor: (@type, @respond) ->

class Messenger

  responders = {}

  chrome.runtime.onMessage.addListener (request, sender, sendBack) =>
    for responderType, responder of responders
      if responderType is request.type
        promise = jQuery.when responder.respond request.params
        promise.always (response) ->
          sendBack response
        break
    yes

  @send: (request) ->
    jQuery.Deferred (self) =>
      chrome.runtime.sendMessage request, (response) =>
        if chrome.runtime.lastError?
          self.rejectWith @, [chrome.runtime.lastError]
        else
          self.resolveWith @, [response]
    .promise()

  @addResponder: (responder) ->
    responders[responder.type] = responder

class Timer

  subscribers = {}

  addSubscriber = (name, respond) ->
    subscribers[name] = respond

  chrome.alarms.onAlarm.addListener (alarm) ->
    if subscribers[alarm.name]?
      subscribers[alarm.name](alarm)

  constructor: (@name, @timeout, @periodic = yes, @respond = jQuery.noop) ->
    params =
      when: Date.now() + @timeout
    if @periodic
      params.periodInMinutes = Math.ceil @timeout / 60000
    chrome.alarms.create @name, params

    addSubscriber @name, (alarm) =>
      @respond alarm

  clear: ->
    chrome.alarm.clear @name, (cleared) =>
      jQuery.Deferred (self) =>
        if cleared then self.resolveWith @
        else self.rejectWith @
      .promise()

RequestType =
  GET_QUOTA: 'getQuota'

Messenger.addResponder new Responder RequestType.GET_QUOTA, ->
  new EoloQuota().getQuota()
