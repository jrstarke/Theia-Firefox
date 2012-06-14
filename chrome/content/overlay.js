var serverDomain = ""
var serverBase = "https://" + serverDomain + "/collector"

var storage;
var doc;
var view;
var prefs;
//var submitInterval = 1*1000*60*60*24;
var submitInterval = 1*1000*60 * 30; // Submit half hourly
var $j = jQuery.noConflict();

//Defines the group id for this group
var gid = 5;

var debug = true;
function l(msg){ 
	if(debug) { try {Firebug.Console.log("Logger: " + msg);} finally {} } 
}

function newTab( url ) {
	var tabBrowser = top.getBrowser();
	if (tabBrowser)
	{
		var tab = tabBrowser.loadOneTab(url, null, null, null, false, false);
		window.focus();
	}
}

function timeCheck(){
	l("Time Checking");
	try {
		if (prefs.getCharPref("blacklist") == "")
			logger.initBlacklist();
		if(prefs.getCharPref("pid") != "0"){
			var cTimestamp = new Date().getTime();
			var lTimestamp = prefs.getCharPref("lastSubmit");
			if(lTimestamp == "") prefs.setCharPref("lastSubmit", cTimestamp + "");
			lTimestamp = parseInt(lTimestamp);
			if(cTimestamp - lTimestamp > submitInterval)
				logger.submitData();
		} else {
			newTab(serverBase + "/init.php");
		}
	} catch (e)
	{
		logger.submitErrorReport("During timeCheck",e);
	}
}

var logger = {  
		onLoad: function() {

			/* Initilization of storage preferences */
			prefs = Components.classes["@mozilla.org/preferences-service;1"].
			getService(Components.interfaces.nsIPrefService);	
			prefs = prefs.getBranch("extensions.logger.");
			this.initialized = true;

			/* Injects the script in the current page */
			var appcontent = document.getElementById("appcontent");   // browser  
			if(appcontent)  
				appcontent.addEventListener("DOMContentLoaded", logger.onPageLoad, true); 

			setTimeout("timeCheck()", 3000);		
			setInterval("timeCheck()", submitInterval);		
		},

		onPageLoad: function(e) {
			function getParam(param){
				var hash;
				var hashes = doc.location.href.slice(doc.location.href.indexOf('?') + 1).split('&');
				for(var i = 0; i < hashes.length; i++)
				{
					hash = hashes[i].split('=');
					if(hash[0] == param) return hash[1];
				}
				return null;
			}
			function initBinds(){
				l("Initializing logger");
				try {

					/* Monitor Sites */
					if(doc.domain == "google.com") googleScript();
					else if(doc.domain == "google.ca") googleScript();
					else if(doc.domain == "www.google.com") googleScript();
					else if(doc.domain == "www.google.ca") googleScript();
					else if(doc.domain == "encrypted.google.com") googleScript();
					else if(doc.domain == "encrypted.google.ca") googleScript();

					/* Data Submission pages */
					else if(doc.domain == serverDomain) subScript();

					else
						otherScript();

				} catch (e) {
					logger.submitErrorReport("In initBinds()", e);
				}
				return;
			}

			function subScript(){
				l("We are in the site collection. Populating fields ...");

				if(doc.location.href == serverBase + "/init.php"){
					$j("#gid", view).html(gid);
					var pollForPid = function (){
						setTimeout(function(){
							var pid = $j('#pid',view).html();
							if (pid)
							{
								prefs.setCharPref("pid",pid);
								gBrowser.removeCurrentTab();
								//window.close();
							}
							else
							{
								pollForPid();
							}
						},500);
					};
					pollForPid();
				}
			}
			function zeroPad(num){
				return String('00'+num).slice(-2);
			}
			function formatTime(timestamp){
				var dt = new Date(parseInt(timestamp));
				var datestr = zeroPad(dt.getDate()) + "/" + zeroPad(dt.getMonth()) + "/" + dt.getFullYear();
				datestr += " " + zeroPad(dt.getHours()) + ":" + zeroPad(dt.getMinutes()) + ":" + zeroPad(dt.getSeconds());
				return datestr;
			}

			function googleScript(){
				l("Installing Google specific monitor");

				l("Disabling Google instant (if present)");
				if((doc.location.href.match("/search?") || doc.location.href.match("/webhp?")) && !doc.location.href.match("complete"))
					return (doc.location.href = doc.location.href + "&complete=0");

				if(doc.location.href == "http://google.com/" || doc.location.href == "http://google.ca/")
					return (doc.location.href = doc.location.href + "webhp?complete=0");

				if(doc.location.href == "http://www.google.com/" || doc.location.href == "http://www.google.ca/")
					return (doc.location.href = doc.location.href + "webhp?complete=0");

				var query = getParam("q");
				var page = getParam("start");
				page = (page)?(page/10)+1:1;

				if(query) logQuery("Google", query, page);

				$j("a.l", view).click(function(e){
					e.preventDefault();
					var url = "";
					if ((this.href.indexOf("google.com/url" != -1) || this.href.indexOf("google.ca/url") != -1)) url = getParameterByName("url",this.href);
					if (url.length == 0) url = this.href; 
					logger.logClick("Google", query, $j(this).text(), url, page);
					return false;
				});

				var url = doc.location.href;
				var title = document.title;
				var referrer = document.referrer;

				logger.logNavigation(url,title,referrer);
			}

			function otherScript() {
				l("Logging Navigation");
				if (!logger.checkBlacklist(doc.domain)) {

					var url = doc.location.href;
					var title = doc.title;
					var referrer = doc.referrer;

					logger.logNavigation(url,title,referrer);
				}
			}

			function scholarScript(){
				l("Installing a Google Scholar specific monitor");

				var query = getParam("q");
				var page = getParam("start");
				if(query) logQuery("Google Scholar", query, (page)?(page/10)+1:1);

				$j(".gs_rt>h3>a", view).click(function(e){
					e.preventDefault();
					logger.logClick("Google Scholar", query, $j(this).text(), this.href);
					return false;
				});
			}

			function logQuery(site, query, page){
				if(prefs.getCharPref("pid") == "0") return;
				if(query == "") return;
				l("Logging query: " + query);

				var timestamp = new Date().getTime();		
				var queries = prefs.getCharPref("queries");

				if(queries != ""){
					queries = JSON.parse(queries);
					queries.push({timestamp: timestamp+'', site: site, query: query, page: page});
				}
				else queries = [{timestamp: timestamp+'', site: site, query: query, page: page}];

				prefs.setCharPref("queries", JSON.stringify(queries));	

				l("Query logged.");
				return;
			}

			// Firefox loves to blast tons of events, only deal with the ones
			// when they're for the page you're actually looking at
			if ((e.originalTarget.nodeName == "#document") &&
					(e.originalTarget.defaultView.location.href == gBrowser.currentURI.spec))
			{
				this.doc = doc = e.originalTarget;
				view = window._content.document;

				initBinds();
			}

		},

		logClick: function(site, query, title, url, page){
			if(prefs.getCharPref("pid") == "0") return;
			title = logger.replaceWithBasic(title);
			l("Logging click: " + query + "," + title + "," + url + "," + page);

			var timestamp = new Date().getTime();

			var clicks = prefs.getCharPref("clicks");
			if(clicks != ""){
				clicks = JSON.parse(clicks);
				clicks.push({timestamp: timestamp+'', site: site, query: query, title: title, url: url, page: page});
			}
			else clicks = [{timestamp: timestamp+'', site: site, query: query, title: title, url: url, page: page}];

			prefs.setCharPref("clicks", JSON.stringify(clicks));	

			l("Click logged. Directing to url...");
			doc.location.href = url;

			return true;	
		},

		logNavigation: function (url,title,referrer) {
			title = logger.replaceWithBasic(title);
			l("Logging navigation: " + title + ", " + url + ", " + referrer);

			var timestamp = new Date().getTime();
			var navigations = prefs.getCharPref("navigations");

			if (navigations != "") {
				navigations = JSON.parse(navigations);
				navigations.push({
					timestamp : timestamp + '',
					title : title,
					url : url,
					referrer : referrer
				});
			} else
				navigations = [{ 
					timestamp : timestamp + '',
					title : title,
					url : url,
					referrer : referrer
				}];
			prefs.setCharPref("navigations", JSON.stringify(navigations));

		},

		initBlacklist: function() {
			l("Initializing blacklist");
			$j.post(serverBase + '/blacklist.php', {
				gid : gid
			}, function (blacklist) {
				if (blacklist) {
					prefs.setCharPref("blacklist", blacklist);
				}
			});
		},

		checkBlacklist: function(url) {
			l("Checking blacklist on url: " + url);
			blacklist = prefs.getCharPref("blacklist");
			if (blacklist)
			{
				blacklist = JSON.parse(blacklist);
				for (var i = 0; i < blacklist.length; i++) {
					if (url)
						if (url.match(blacklist[i]))
							return true;
				}
			}
			return false;
		},

		// Fires the data across the line to the server over https
		submitData: function () {
			var queries = prefs.getCharPref("queries");
			var clicks = prefs.getCharPref("clicks");
			var navigations = prefs.getCharPref("navigations");
			var pid = prefs.getCharPref("pid");

			// See if we actually have enough data to submit, if not wait.
			if (queries.length > 0 || clicks.length > 0 || navigations.length > 0)
			{
				l("submitting to server: queries: " + queries + "  clicks: " + clicks + "  navigations: " + navigations + "  pid: " + pid + "  gid: " + gid);
				$j.post(serverBase + "/collect-json.php", {
					queries: queries,
					clicks: clicks,
					navigations: navigations,
					pid: pid,
					gid: gid
				},
				function (data) {
					l("submitted to server: response: " + data);
					data = JSON.parse(data);
					// Get the latest queries and create a new list without those we stored
					if (data.storedQueries)
						logger.removeElementsFromStoredList("queries",
								data.storedQueries);

					// Get the latest clicks and create a new list without those we stored
					if (data.storedClicks)
						logger.removeElementsFromStoredList("clicks",
								data.storedClicks);

					// Get the latest clicks and create a new list without those we stored
					if (data.storedNavigations)
						logger.removeElementsFromStoredList("navigations",
								data.storedNavigations);

					// Update the blacklist
					if (data.blacklist)
						prefs.setCharPref("blacklist", JSON.stringify(data.blacklist));

					var timestamp = new Date().getTime();
					prefs.setCharPref("lastSubmit", timestamp + "");
				});
			}
		},

		// Takes the name of a list that is stored, removes the given elements
		// and stores it again
		removeElementsFromStoredList: function (listName, elements) {
			l("removeElementsFromStoredList: " + listName + " " + elements);

			var list = prefs.getCharPref(listName);
			l("removeElementsFromStoredList: got List " + listName + ": " + list);
			var jsonList = JSON.parse(list);

			jsonList = logger.listFromListWithoutElements(jsonList, elements);
			if (jsonList.length > 0) {
				list = JSON.stringify(jsonList);
				l("storing shortened list: " + listName + ": "+ list);
				perfs.setCharPref(listName, list);
			} else
				l("emptying list: " + listName);
			prefs.setCharPref(listName,"");
		},

		replaceWithBasic: function (text)
		{
			var before = text;
			text = text.replace(/[^a-zA-Z0-9\s\-=+\|!@#$%^&*()~;:,<.>\/?]+/g,'_');
			if (!before == text)
				l("replaceWithBasic: before: '" + before + "' After: '" + text + "'");
			return text;
		},

		// Takes a list and a set of element ids, and creates a new liwt without
		// those elements
		listFromListWithoutElements: function (list, elementIDs) {
			l("listFromListWithoutElements: " + list + " " + elementIDs);
			elementIDs.sort();

			var pointer = 0;
			var newList = new Array();
			l("listFromListWithoutElements: new array");
			for ( var i = 0; i < list.length; i++) {
				if (pointer < elementIDs.length && list[i] < elementIDs[pointer])
					newList.push(list[i]);
				else
					pointer++;
			}
			return newList;
		},

		submitErrorReport: function (context, exception) {
			var pid = prefs.getCharPref("pid");
			// var gid = just use the global one
			var site = doc.location.href;
			// var context is the one above
			var message = exception.name + " " + exception.message;
			var stack = exception.stack;

			l("Error Context: " + context + " Exception: " + message + ". Stack: " + exception.stack);
			context = "Firefox: " + context;
			$j.post(serverBase + "/error-json.php", {
				pid: pid,
				gid: gid,
				site: site,
				context: context,
				message: message,
				stack: stack
			}, function(response)
			{
				l("Error sent. Response: " + response);
			});
		}
};


var Url = {

		// public method for url encoding
		encode : function (string) {
			return escape(this._utf8_encode(string));
		},

		// public method for url decoding
		decode : function (string) {
			return this._utf8_decode(unescape(string));
		},

		// private method for UTF-8 encoding
		_utf8_encode : function (string) {
			string = string.replace(/\r\n/g,"\n");
			var utftext = "";

			for (var n = 0; n < string.length; n++) {

				var c = string.charCodeAt(n);

				if (c < 128) {
					utftext += String.fromCharCode(c);
				}
				else if((c > 127) && (c < 2048)) {
					utftext += String.fromCharCode((c >> 6) | 192);
					utftext += String.fromCharCode((c & 63) | 128);
				}
				else {
					utftext += String.fromCharCode((c >> 12) | 224);
					utftext += String.fromCharCode(((c >> 6) & 63) | 128);
					utftext += String.fromCharCode((c & 63) | 128);
				}

			}

			return utftext;
		},

		// private method for UTF-8 decoding
		_utf8_decode : function (utftext) {
			var string = "";
			var i = 0;
			var c = c1 = c2 = 0;

			while ( i < utftext.length ) {

				c = utftext.charCodeAt(i);

				if (c < 128) {
					string += String.fromCharCode(c);
					i++;
				}
				else if((c > 191) && (c < 224)) {
					c2 = utftext.charCodeAt(i+1);
					string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
					i += 2;
				}
				else {
					c2 = utftext.charCodeAt(i+1);
					c3 = utftext.charCodeAt(i+2);
					string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
					i += 3;
				}

			}

			return string;
		}

};

function getParameterByName( name, url )
{
	name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
	var regexS = "[\\?&]"+name+"=([^&#]*)";
	var regex = new RegExp( regexS );
	var results = regex.exec( url );
	if( results == null )
		return "";
	else
		return decodeURIComponent(results[1].replace(/\+/g, " "));
}

window.addEventListener("load", logger.onLoad, false);
