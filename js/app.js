/*
	global app, angular, firebase, gapi, $script, whois
*/

var it = {};
// (function() {
// 	'use strict';
// 	if ('serviceWorker' in navigator) {
// 		navigator.serviceWorker
// 		.register('service-worker.js')
// 		.then(function() {
// 			console.log('Service Worker Registered');
// 		});
// 	}
// })();


var app = angular.module('app', ['ngMaterial','firebase','ngRoute','pascalprecht.translate']);
app.config(function($routeProvider, $locationProvider, $controllerProvider, $provide, $mdThemingProvider, $translateProvider) {
	app.lazy = {
		controller: $controllerProvider.register,
		factory: 	$provide.factory,
		service: 	$provide.service,
		theme:		$mdThemingProvider
	};
	var dep =  {
		deps: function($q, config){
			var scripts = $q.defer();
			var module = window.location.hash.split('/')[1];
			var dependencies = [
				'modules/'+module+'/ctrl.js',
			];
	
			$script(dependencies, function() {
				scripts.resolve('scripts loaded');
			});
			
			return scripts.promise;
		},
		settings: function(config){
			return config.promise;
		}
	}
	$routeProvider
		.when('/:module', {
			templateUrl: function($routeParams){
				return 'modules/'+$routeParams.module+'/index.html'
			},
			controller: "SiteCtrl",
			resolve: dep
		})
		.when('/:module/:view', {
			templateUrl: function($routeParams){
				return 'modules/'+$routeParams.module+'/index.html'
			},
			controller: "SiteCtrl",
			resolve: dep
		})
		.when('/:module/:view/:id', {
			templateUrl: function($routeParams){
				return 'modules/'+$routeParams.module+'/index.html'
			},
			controller: "SiteCtrl",
			resolve: dep
		})
		.otherwise({
			redirectTo: '/page/main'
		});
	$mdThemingProvider.theme('default')
		.primaryPalette('blue')
		.accentPalette('light-green');
	$mdThemingProvider.theme('forest')
		.primaryPalette('brown')
		.accentPalette('green');
	$translateProvider.useStaticFilesLoader({
		prefix: 'language/',
		suffix: '.json'
	});
	$translateProvider.preferredLanguage('en');
})

app.controller('SiteCtrl', function SiteCtrl($rootScope, $firebaseAuth, $firebaseObject, $routeParams, $translate, $mdDialog, $mdMedia, $mdSidenav, settings, Auth){
	$rootScope.params = $routeParams;
	$rootScope.settings = settings;
	
	$rootScope.$mdMedia = $mdMedia;
	$rootScope.auth = $firebaseAuth();
	$firebaseAuth().$onAuthStateChanged(function(user) {
		if(user){
			$rootScope.user = user;
			tools.profile.init(user);
			tools.profile.gapi(user);
		}
	});
	var siteRef = firebase.database().ref().child("site/public/settings");
	$rootScope.site = $firebaseObject(siteRef);
	
	var tools = $rootScope.rootTools = $rootScope.tools = {
		init: function(){},
		component: function(name){
			return 'component/'+name+'.html'
		},
		login: function(method){
			$firebaseAuth().$signInWithPopup("google");
		},
		profile: {
			init: function(user){
				var profileRef = firebase.database().ref().child("account/public").child(user.uid);
				$rootScope.profile = $firebaseObject(profileRef);
				$rootScope.profile.$loaded(function(profile) {
					if(!profile.displayName)
						tools.profile.setup();
				}, function(e){
					console.log('no profile')
				})
			},
			gapi: function(user){
				console.log('GAPI: '+settings.clientId)
				gapi.load('client', function(){
					gapi.client.init({
						apiKey: 	settings.firebase.apiKey,
						clientId:	settings.clientId
					}).then(function(r){
						console.log(settings.clientId)
						gapi.auth.authorize({
							'client_id': settings.clientId,
							'scope': ['profile'],
							'immediate': true
						});
					})
				});
			},
			setup: function(){
				if($rootScope.user){
					//needed to improve people search.
					$rootScope.profile.displayName = $rootScope.user.displayName.toLowerCase();
					$rootScope.profile.photoURL = $rootScope.user.photoURL;
					$rootScope.profile.$save()
				}
			}
		},
		sidebar: function(action){
			if(action)
				if(action == 'open')
					$mdSidenav('left').open()
				else
					$mdSidenav('left').close()
			else
				$mdSidenav('left').toggle()
		},
		feedback: function(event){
			$mdDialog.show({
				controller: 'FeedbackCtrl',
				templateUrl: tools.component('feedback'),
				parent: angular.element(document.body),
				targetEvent: event,
				clickOutsideToClose: true
			})
		}
	}
	tools.init();

	it.SiteCtrl = $rootScope;
});



		
		
		
app.controller('FeedbackCtrl', function FeedbackCtrl($rootScope, $scope, $mdDialog, $mdToast, $firebaseArray){
	var feedbackRef = firebase.database().ref().child("feedback");

	$scope.send = function(){
		feedbackRef.push({
			user: {
				uid:	$rootScope.user.uid,
				email:	$rootScope.user.email,
				name:	$rootScope.user.displayName
			},
			location:	window.location.href,
			message:	$scope.feedback
		}).then(function(r){
			console.log(r)
			$mdToast.show($mdToast.simple().textContent('Thanks!'))
			$mdDialog.hide(r);
		}, function(e){
			console.error(e)
			$mdDialog.cancel(e);
		})
	}
})
app.controller('StripeCtrl', function StripeCtrl($scope, $mdDialog, Auth, $firebaseObject, $http, cart, view){
	$scope.cart = cart;
	$scope.view = view;
	$scope.error = {};
	$scope.card = {metadata:{}};
	
	$scope.tools = {
		init: function(){
			Auth().then(function(user){
				$scope.user = user;
				var customerRef = firebase.database().ref().child('stripe/customers').child(user.uid);
				$scope.customer = $firebaseObject(customerRef);
				// $scope.customer.$loaded().then(function(){
				// 	if($scope.customer.sources)
				// 		$scope.methods = $scope.customer.sources.data;
				// 	else //If there is no record for this user....
				// 		$scope.view = 'manage';
				// })
			})
		},
		checkout: {
			pay: function(card){
				var postUrl = cart.url || 'https://the.atfiliate.com/cloud/stripe?action=checkout';
				firebase.auth().currentUser.getToken(true).then(function(jwt) {
					$http.post(postUrl, {jwt:jwt, params:{
						amount: 		cart.amount * 100,
						currency:		'usd',
						customer:		$scope.customer.id,
						source: 		card,
						description:	cart.description,
						interval:		cart.interval,
						interval_count: cart.interval_count,
						metadata:		cart.metadata
					}}).success(function(r){
						$mdDialog.hide(r);
					}).error(function(e){
						$scope.error = e;
					})
				})
			}
		},
		manage: {
			add: function(){
				$scope.view = 'manage';
			},
			save: function(){
				//validate information
				var card = angular.copy($scope.card)
					card.exp_month = Number(card.exp.split('/')[0])
					card.exp_year = Number(card.exp.split('/')[1])
				function validate(card){
					var valid = true;
					if(!Stripe.validateCardNumber(card.number)){
						valid = false;
						$scope.error.number = 'The cc number you entered is not valid.'
					}
					if(!Stripe.validateExpiry(card.exp_month, card.exp_year)){
						valid = false;
						$scope.error.number = 'The expiration you entered is not valid.'
					}
					if(!Stripe.validateCVC(card.cvc)){
						valid = false;
						$scope.error.number = 'The cvc you entered is not valid.'
					}
					return valid;
				}
					
				if(validate(card)){
					card.metadata.user = $scope.user.uid;
					Stripe.card.createToken(card, function(status, obj){
						$scope.newCard = obj;
						firebase.auth().currentUser.getToken(true).then(function(jwt) {
							$http.post('https://the.atfiliate.com/cloud/stripe?action=customer', {jwt:jwt, params:{
								action: 		'add',
								customer:		$scope.customer.id,
								name:			$scope.user.displayName,
								email:			$scope.user.email,
								source: 		obj.id,
								title:			card.title
							}}).success(function(r){
								if($scope.cart){
									$scope.view = 'checkout';
								}else{
									$mdDialog.hide(r);
								}
							}).error(function(e){
								$scope.error.manage = e;
							})
						})
					})
				}
			},
			cancel: function(){
				$scope.view = 'checkout';
			}
		}
	}
	$scope.tools.init();
	it.StripeCtrl = $scope;
})