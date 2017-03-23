/*global angular, app, firebase, Mousetrap, moment*/

app.lazy.controller('PageCtrl', function PageCtrl($scope, $firebaseObject, $firebaseArray, $mdMedia, $mdDialog, $mdSidenav, $mdBottomSheet, $mdToast, $routeParams, $http, $q, Auth, Cloudinary, Stripe, config){
	$scope.cloudinary	= Cloudinary;
	$scope.moment		= moment;
	$scope.temp = {};
	$scope.data = {};
	var route = $routeParams.view || 'default';
	var pageRef = firebase.database().ref().child("site/public/pages").child(route);
	var templateRef = firebase.database().ref().child("site/public/pageTemplates");
	var page = $firebaseObject(pageRef);
		page.$bindTo($scope, "page");
	
		
	Mousetrap.bind('ctrl+e', function(e){
		e.preventDefault();
		tools.edit();
	})
	Mousetrap.bind('ctrl+s', function(e){
		e.preventDefault();
		tools.save();
	})
		
	var tools = $scope.tools = {
		init: function(){
			page.$loaded(function(page){
				tools.render(page)
			})
		},
		edit: function(){
			$scope.temp.page = angular.copy($scope.page);
			if(!$scope.temp.page.js)
				$scope.temp.page.js = 'js = {init: function(){}}'
			if(!$scope.temp.page.html)
				$scope.temp.page.html = '<h1>New Page</h1>'
			tools.dialog()
		},
		save: function(){
			if($scope.jsEditor)
				$scope.temp.page.js = $scope.jsEditor.getValue();
			if($scope.htmlEditor)
				$scope.temp.page.html = $scope.htmlEditor.getValue();
			$scope.page = angular.copy($scope.temp.page)
			tools.render($scope.page)
			$mdDialog.hide()
		},
		cancel: function(){
			$scope.temp.page = angular.copy($scope.page)
			$mdDialog.hide()
		},
		remove: function(){
			if(confirm('Are you sure you want to completly delete this page?')){
				page.$remove()
				$mdDialog.hide()
			}
		},
		data: function(key){
			if(key){
				delete $scope.temp.page.data[key];
			}else{
				$scope.temp.page.data = $scope.temp.page.data || {};
				$scope.temp.page.data[$scope.temp.data.alias] = angular.copy($scope.temp.data)
				$scope.temp.data = {};
			}
		},
		dialog: function(){
			$mdDialog.show({
				scope: $scope,
				preserveScope: true,
				templateUrl: 'modules/page/partials/editDialog.html',
				parent: angular.element(document.body),
				clickOutsideToClose: true,
				fullscreen: true
			});
		},
		render: function(page){
			var promises = [];
			if(page.data)
				promises = Object.keys(page.data).map(function(key){
					var ref = page.data[key];
					var deferred = $q.defer();
					var refPath = ref.path
					if($scope.user){
						refPath = refPath.replace('{{uid}}', $scope.user.uid);
						refPath = refPath.replace('{{email}}', $scope.user.email);
					}
					refPath = refPath.replace('{{id}}', $scope.params.id);

					var dataRef = firebase.database().ref().child(refPath);
					if(ref.array)
						$scope.data[ref.alias] = $firebaseArray(dataRef);
					else
						$scope.data[ref.alias] = $firebaseObject(dataRef);
					$scope.data[ref.alias].$loaded(function(obj){
						deferred.resolve(obj)
					}, function(e){
						deferred.resolve(e)
					})
					return deferred.promise;
				})
			if(page.js)
				$q.all(promises).then(function(r){
					var js;
					eval('js = $scope.js = '+page.js)
					if(js.init)
						$scope.data = js.init($scope.data) || $scope.data;
				})
		},
		template: {
			init: function(){
				var page = $firebaseObject(pageRef);
					page.$bindTo($scope, "page");
				$scope.templates = $firebaseArray(templateRef);
			},
			add: function(){
				$scope.temp.page.title = prompt('Enter Template Name')
				$scope.templates.$add($scope.temp.page);
			},
			set: function(template){
				$scope.temp.page = template;
				if($scope.htmlEditor)
					$scope.htmlEditor.setValue($scope.temp.page.html);
				if($scope.jsEditor)
					$scope.jsEditor.setValue($scope.temp.page.js);
			},
			save: function(template){
				if(confirm('This will over write the template content with the current page content.  Are you sure you want to continue?')){
					template.html = $scope.temp.page.html || null;
					template.data = $scope.temp.page.data || null;
					template.js = $scope.temp.page.js || null;
					$scope.templates.$save(template);
				}
			},
			remove: function(template){
				if(confirm('Are you sure you want to completly remove this template?'))
					$scope.templates.$remove(template);
			}
		},
		ace: {
			focus: function(editor){
				$scope[editor] = ace.edit(editor);
				$scope[editor].setTheme("ace/theme/monokai");
				$scope[editor].setOption('useSoftTabs', false);
				if(editor == 'htmlEditor'){
					$scope[editor].getSession().setMode("ace/mode/html");
					$scope[editor].setValue($scope.temp.page.html);
				}else if(editor == 'jsEditor'){
					$scope[editor].getSession().setMode("ace/mode/javascript");
					$scope[editor].setValue($scope.temp.page.js);
				}
			}
		}
	}
	tools.init();
	
	it.PageCtrl = $scope;
});