/*
	global app, firebase
*/
var whois = {};
app.factory('config', function($q){
	var deferred = $q.defer();
	var config = {
		promise: deferred.promise,
		firebase: {
			apiKey: "AIzaSyD_3nGYh1GA2Ucds20nm8ad8HsuHFXRxbg",
			authDomain: "atfiliate.firebaseapp.com",
			databaseURL: "https://atfiliate.firebaseio.com",
			storageBucket: "atfiliate.appspot.com",
			messagingSenderId: "126442541687"
		}
	}
	
	whois.firebase = firebase.initializeApp(config.firebase, 'whois');
	whois.host = window.location.host.split('.').join('*');
	var settingsRef = whois.firebase.database().ref('whois/public').child(whois.host);
	settingsRef.once('value', function(data){
		whois.settings = data.val();
		document.title = whois.settings.title;
		config.whois = whois;
		if(whois.settings){
			firebase.initializeApp(whois.settings.firebase);
			deferred.resolve(whois.settings);
		}else{
			deferred.resolve('No Whois');
			//setup a temporary, and provide an interface to setup the project...
		}
	})
	
	return config;
})