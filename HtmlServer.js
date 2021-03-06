/* HtmlServer is a static class that will manage HTTP requests.
 * This class is not nearly finished.
 */
function HtmlServer(){
	HtmlServer.port=22179;
	HtmlServer.dialogVisible=false;
	HtmlServer.logHttp=false;
}
HtmlServer.encodeHtml=function(message){
	if(message==""){
		return "%20"; //Empty strings can't be used in the URL.
	}
	var eVal;
	if (!encodeURIComponent) {
		eVal = escape(message);
		eVal = eVal.replace(/@/g, "%40");
		eVal = eVal.replace(/\//g, "%2F");
		eVal = eVal.replace(/\+/g, "%2B");
		eVal = eVal.replace(/'/g, "%60");
		eVal = eVal.replace(/"/g, "%22");
		eVal = eVal.replace(/`/g, "%27");
		eVal = eVal.replace(/&/g, "%26");
	} else {
		eVal = encodeURIComponent(message);
		eVal = eVal.replace(/~/g, "%7E");
		eVal = eVal.replace(/!/g, "%21");
		eVal = eVal.replace(/\(/g, "%28");
		eVal = eVal.replace(/\)/g, "%29");
		eVal = eVal.replace(/'/g, "%27");
		eVal = eVal.replace(/"/g, "%22");
		eVal = eVal.replace(/`/g, "%27");
		eVal = eVal.replace(/&/g, "%26");
	}
	return eVal; //.replace(/\%20/g, "+");
}
HtmlServer.sendRequestWithCallback=function(request,callbackFn,callbackErr,isPost,postData){
	if(isPost == null) {
		isPost=false;
	}
	var requestType="GET";
	if(isPost){
		requestType="POST";
	}
	try {
		var xhttp = new XMLHttpRequest();
		xhttp.onreadystatechange = function () {
			if (xhttp.readyState == 4) {
				if (xhttp.status == 200) {
					if(callbackFn!=null){
						callbackFn(xhttp.responseText);
					}
				}
				else {
					if(callbackErr!=null){
						callbackErr();
					}
					//GuiElements.alert("HTML error: "+xhttp.status);
				}
			}
		};
		xhttp.open(requestType, HtmlServer.getUrlForRequest(request), true); //Get the names
		if(isPost){
			xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
			xhttp.send("data="+HtmlServer.encodeHtml(postData));
		}
		else{
			xhttp.send(); //Make the request
		}
		if(HtmlServer.logHttp&&request.indexOf("totalStatus")<0&&
			request.indexOf("discover")<0&&request.indexOf("status")<0) {
			GuiElements.alert(HtmlServer.getUrlForRequest(request));
		}
	}
	catch(err){
		if(callbackErr!=null){
			callbackErr();
		}
	}
};
HtmlServer.sendHBRequest=function(hBIndex,request,requestStatus){
	if(HummingbirdManager.connectedHBs.length>hBIndex) {
		HtmlServer.sendRequest(HtmlServer.getHBRequest(hBIndex,request), requestStatus);
	}
	else{
		if(requestStatus!=null) {
			requestStatus.finished = true;
			requestStatus.error = true;
		}
	}
};
HtmlServer.sendRequest=function(request,requestStatus){
	if(requestStatus!=null){
		requestStatus.error=false;
		var callbackFn=function(response){
			callbackFn.requestStatus.finished=true;
			callbackFn.requestStatus.result=response;
		}
		callbackFn.requestStatus=requestStatus;
		var callbackErr=function(){
			callbackErr.requestStatus.finished=true;
			callbackErr.requestStatus.error=true;
		}
		callbackErr.requestStatus=requestStatus;
		HtmlServer.sendRequestWithCallback(request,callbackFn,callbackErr);
	}
	else{
		HtmlServer.sendRequestWithCallback(request);
	}
}
HtmlServer.getHBRequest=function(hBIndex,request){
	return "hummingbird/"+HtmlServer.encodeHtml(HummingbirdManager.connectedHBs[hBIndex].name)+"/"+request;
}
HtmlServer.getUrlForRequest=function(request){
	return "http://localhost:"+HtmlServer.port+"/"+request;
}
HtmlServer.showDialog=function(title,question,hint,callbackFn,callbackErr){
	TouchReceiver.touchInterrupt();
	HtmlServer.dialogVisible=true;
	if(TouchReceiver.mouse){ //Kept for debugging on a PC
		var newText=prompt(question);
		HtmlServer.dialogVisible=false;
		callbackFn(newText==null,newText);
	}
	else{
		var HS=HtmlServer;
		var request = "iPad/dialog/"+HS.encodeHtml(title);
		request+="/"+HS.encodeHtml(question);
		request+="/"+HS.encodeHtml(hint);
		var onDialogPresented=function(result){
			HS.getDialogResponse(onDialogPresented.callbackFn,onDialogPresented.callbackErr);
		}
		onDialogPresented.callbackFn=callbackFn;
		onDialogPresented.callbackErr=callbackErr;
		var onDialogFail=function(){
			HtmlServer.dialogVisible=false;
			if(onDialogFail.callbackErr!=null) {
				onDialogFail.callbackErr();
			}
		}
		onDialogFail.callbackErr=callbackErr;
		HS.sendRequestWithCallback(request,onDialogPresented,onDialogFail);
	}
}
HtmlServer.getDialogResponse=function(callbackFn,callbackErr){
	var HS=HtmlServer;
	var request = "iPad/dialog_response";
	var onResponseReceived=function(response){
		if(response=="No Response"){
			HtmlServer.getDialogResponse(onResponseReceived.callbackFn,onResponseReceived.callbackErr);
		}
		else if(response=="Cancelled"){
			HtmlServer.dialogVisible=false;
			onResponseReceived.callbackFn(true);
		}
		else{
			HtmlServer.dialogVisible=false;
			var trimmed=response.substring(1,response.length-1);
			onResponseReceived.callbackFn(false,trimmed);
		}
	}
	onResponseReceived.callbackFn=callbackFn;
	onResponseReceived.callbackErr=callbackErr;
	HS.sendRequestWithCallback(request,onResponseReceived,callbackErr);
}
HtmlServer.getFileName=function(callbackFn,callbackErr){
	var HS=HtmlServer;
	var onResponseReceived=function(response){
		if(response=="File has no name."){
			HtmlServer.getFileName(onResponseReceived.callbackFn,onResponseReceived.callbackErr);
		}
		else{
			onResponseReceived.callbackFn(response);
		}
	};
	onResponseReceived.callbackFn=callbackFn;
	onResponseReceived.callbackErr=callbackErr;
	HS.sendRequestWithCallback("filename",onResponseReceived,callbackErr);
};
HtmlServer.showChoiceDialog=function(title,question,option1,option2,firstIsCancel,callbackFn,callbackErr){
	TouchReceiver.touchInterrupt();
	HtmlServer.dialogVisible=true;
	if(TouchReceiver.mouse){ //Kept for debugging on a PC
		var result=confirm(question);
		HtmlServer.dialogVisible=false;
		if(firstIsCancel){
			result=!result;
		}
		if(result){
			callbackFn("1");
		}
		else{
			callbackFn("2");
		}
	}
	else {
		var HS = HtmlServer;
		var request = "iPad/choice/" + HS.encodeHtml(title);
		request += "/" + HS.encodeHtml(question);
		request += "/" + HS.encodeHtml(option1);
		request += "/" + HS.encodeHtml(option2);
		var onDialogPresented = function (result) {
			HS.getChoiceDialogResponse(onDialogPresented.callbackFn, onDialogPresented.callbackErr);
		};
		onDialogPresented.callbackFn = callbackFn;
		onDialogPresented.callbackErr = callbackErr;
		var onDialogFail = function () {
			HtmlServer.dialogVisible = false;
			if (onDialogFail.callbackErr != null) {
				onDialogFail.callbackErr();
			}
		};
		onDialogFail.callbackErr = callbackErr;
		HS.sendRequestWithCallback(request, onDialogPresented, onDialogFail);
	}
};
HtmlServer.getChoiceDialogResponse=function(callbackFn,callbackErr){
	var HS=HtmlServer;
	var request = "iPad/choice_response";
	var onResponseReceived=function(response){
		if(response=="0"){
			HtmlServer.getChoiceDialogResponse(onResponseReceived.callbackFn,onResponseReceived.callbackErr);
		}
		else{
			HtmlServer.dialogVisible=false;
			onResponseReceived.callbackFn(response);
		}
	};
	onResponseReceived.callbackFn=callbackFn;
	onResponseReceived.callbackErr=callbackErr;
	HS.sendRequestWithCallback(request,onResponseReceived,callbackErr);
};
HtmlServer.getSetting=function(key,callbackFn,callbackErr){
	HtmlServer.sendRequestWithCallback("settings/get/"+HtmlServer.encodeHtml(key),callbackFn,callbackErr);
};
HtmlServer.setSetting=function(key,value){
	HtmlServer.sendRequestWithCallback("settings/set/"+HtmlServer.encodeHtml(key)+"/"+HtmlServer.encodeHtml(value));
};