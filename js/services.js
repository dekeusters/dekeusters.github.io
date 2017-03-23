/*
	global app, Stripe, firebase, cloudinary, gapi
*/

app.factory('Stripe', function($q, $http, $mdDialog, Auth, config){
	Stripe.setPublishableKey(config.whois.settings.stripe);
	return {
		checkout: function(cart, event){
			//cart: {title:'', description:'', amount:''}
			var deferred = $q.defer();
			var options = {
				controller: 'StripeCtrl',
				templateUrl: '/component/stripe.html',
				clickOutsideToClose: true,
				locals: {
					view: 'checkout',
					cart: cart
				}
			}
			if(event)
				options.targetEvent = event;
				
			$mdDialog.show(options).then(function(r){
				deferred.resolve(r);
			})
			return deferred.promise;
		},
		manage: function(event){
			var deferred = $q.defer();
			var options = {
				controller: 'StripeCtrl',
				templateUrl: '/component/stripe.html',
				clickOutsideToClose: true,
				locals: {
					view: 'manage'
				}
			}
			if(event)
				options.targetEvent = event;
				
			$mdDialog.show(options).then(function(r){
				deferred.resolve(r);
			})
			return deferred.promise;
		},
		cancel: function(subscription){
			var deferred = $q.defer();
			if(confirm('This will terminate your subscription immediatly.  Are you sure you want to cancel?')){
				var postUrl = 'https://the.atfiliate.com/cloud/stripe?action=cancel';
				firebase.auth().currentUser.getToken(true).then(function(jwt) {
					$http.post(postUrl, {jwt:jwt, params:{
						subscription:	subscription.id
					}}).success(function(r){
						deferred.resolve(r);
					}).error(function(e){
						deferred.reject(e);
					})
				})
			}
		}
	}
})
app.factory('Auth', function($q, $firebaseAuth, $firebaseObject){
	var signin = $q.defer();
	$firebaseAuth().$onAuthStateChanged(function(user){
		if(user){
			var ref = firebase.database().ref().child('site/public/roles').child(user.uid);
			var obj = $firebaseObject(ref);
			obj.$loaded().then(function(){
				user.roles = obj || {};
				user.is = function(role){
					if(role == 'any' || !role)
						return true
					else
						return !!user.roles[role]
				}
				user.jwt = function(){
					return firebase.auth().currentUser.getToken(true)
				}
				signin.resolve(user)
			});
		}
	})
	
	return function(){
		return signin.promise;
	}
})
app.factory('Google', function($q, $http, config){
	var G = this;
		G.scopes = [];
		G.credentials = null;

	var tools = {
		auth: function(scopes){
			var google = $q.defer()
			function client(){
				var deferred = $q.defer()
				if(gapi.client){
					gapi.client.setApiKey(config.firebase.apiKey)
					deferred.resolve(gapi)
				}else{
					gapi.load('client', function(){
						gapi.client.setApiKey(config.firebase.apiKey)
						deferred.resolve(gapi)
					})
				}
				return deferred.promise;
			}
			function scopeUpdate(scopes){
				var change = false;
				if(typeof(scopes) == 'string')
					scopes = [scopes]
				else
					scopes = scopes || [];
				scopes.forEach(function(scope){
					if(G.scopes.indexOf(scope) == -1){
						G.scopes.push(scope)
						change = true;
					}
				})
				return change;
			}
			
			if(scopeUpdate(scopes) || !G.credentials){
				
				$q.all([client()]).then(function(){
					gapi.auth.authorize({
						client_id: config.client_id,
						scope: G.scopes.join(' ')
					}).then(function(r){
						G.credentials = r;
						$http.defaults.headers.common.Authorization = 'Bearer '+G.credentials.access_token;
						$http.defaults.headers.common['GData-Version'] = '3.0';
						google.resolve(G.credentials)
					})
				})
			}else{
				google.resolve(G.credentials)
			}
			return google.promise;
		},
		credentials: function(){
			return G.credentials
		},
		request: function(method, url, params){
			var deferred = $q.defer()
			tools.auth('https://www.googleapis.com/auth/drive').then(function(auth){
				$http({
					method: 	method,
					url:		url,
					params: 	params
				}).success(function(r){
					deferred.resolve(r)
				});
			})
			return deferred.promise;
		},
		drive: {
			listDocs: function(google){
				var deferred = $q.defer()
				tools.auth('https://www.googleapis.com/auth/drive').then(function(auth){
					$http.get('https://www.googleapis.com/drive/v3/files').success(function(r){
						deferred.resolve(r)
					});
				})
				return deferred.promise;
			}
		}
	}
	return tools;
});
app.factory('Cloudinary', function($timeout, $q, config){
	var tools = {
		upload: function(parent, attr){
			var deferred = $q.defer();
			attr = attr || 'images'
			if(config.whois && config.whois.settings && config.whois.settings.cloudinary){
				cloudinary.openUploadWidget({
					cloud_name: config.whois.settings.cloudinary.name,
					upload_preset: config.whois.settings.cloudinary.preset,
					theme: 'white',
					multiple: true,
				},
				function(error, result) {
					if(result)
						if(parent)
							$timeout(function(){
								parent[attr] = result;
							})
					if(error)
						deferred.reject(error)
					else
						deferred.resolve(result)
				});
			}else{
				alert('Document storage has not been setup yet.')
				console.log('Visit: atfiliate.com to setup document storage.')
				deferred.reject('Document Storage is not setup.')
			}
			return deferred.promise;
		}
	}
	return tools;
});