chrome.runtime.sendMessage({type: 'requestUpdateQuota'}, function(response){
  updatePopup(response.diff);
});
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
  if(request.type == 'updateQuota'){
    updatePopup(request.data.diff);
    sendResponse({});
  }
});

function updatePopup(quota){
  document.getElementById('quota').innerHTML = JSON.stringify(quota);
}
