/*global app*/

app.directive("contenteditable", function() {
	return {
		restrict: "A",
		require: "ngModel",
		link: function(scope, element, attrs, ngModel) {
			it.a = attrs;
			var read;
			if(!ngModel)
				return;
			
			ngModel.$render = function() {
				return element.text(ngModel.$viewValue || attrs.placeholder);
			};
			element.bind('blur', function() {
				if (ngModel.$viewValue !== $.trim(element.text())) {
					return scope.$apply(read);
				}
			});
			return read = function() {
				var newVal = $.trim(element.text())
				if(!newVal && attrs.placeholder){
					newVal = attrs.placeholder;
					element.text(newVal);
				}
				return ngModel.$setViewValue(newVal);
			};
		}
	};
});

//Cloudinary Transformations to Images
app.directive('clSrc', function($timeout) {
	return {
		restrict: 'A',
		scope: { clSrc: '@'},
		link: function(scope, ele, attrs) {
			scope.attrs = attrs;
			it.clAttrs = attrs;
			console.log('update')
			var tsrc, src;
			function transform(attrs){
				var clKeys = Object.keys(attrs)
				clKeys = clKeys.filter(function(key){
					return key.indexOf('transform') == 0
				})
				var transform = ''
				clKeys.forEach(function(key, i){
					var val = attrs[key];
					transform += key.replace('transform','').toLowerCase() + '_' + val
					if(i != clKeys.length - 1)
						transform += ','
				})
				if(clKeys.length && !attrs['transformC'])
					transform += ',c_fill'
				if(attrs['auto']){
					if(clKeys.length)
						transform += ','
					transform += 'g_auto,q_auto,f_auto'
				}
				return transform;
			}
			scope.$watch('clSrc', function(val) {
				if(val){
					tsrc = val.split('upload')
					src = tsrc[0]+'upload/'+transform(attrs)+tsrc[1]
					$(ele).attr("src", src);
				}
			})
			scope.$watch('attrs', function(newVal, oldVal) {
				console.log('changed');
				if(tsrc){
					src = tsrc[0]+'upload/'+transform(newVal)+tsrc[1]
					$(ele).attr("src", src);
				}
			}, true);
		}
	};
});

app.directive('compile', function($compile) {
	return {
		restrict: 'A',
		link: function(scope, element, attr) {
			scope.$watch(function() {return element.attr('compile'); }, function(newValue){
				element.html($compile(newValue)(scope));
				it.e = element;
			});
		}
	}
})

-//HTML: <img zoom-src="{{doc.image.secure_url}}" zoom="myVar" crop="true">
-//myVar will be assigned to the $scope ($scope.myVar)
-//myVar will receive a few tools for interacting with the directive:		
-//myVar.get(), myVar.set(obj), myVar.reset(), myVar.undo()
app.directive('zoom', function($interval, $timeout, $q){
	return {
		restrict: 'A',
		replace: true,
		template: '<div class="zoom"><div class="zoom-container"><img class="zoom-image"></div><div class="zoom-crop" style="text-align:center; padding:15px;">^ Crop ^</div></div>',
		link: function(scope, element, attrs){
			var project = {}
				project.defer = $q.defer()
				project.promise = function(){return project.defer.promise}

			var p = project.p = {id:[]};
			
			project.container = angular.element(element.children()[0]);
			project.img = angular.element(project.container.children()[0]);
			project.oimg = new Image();

			if(attrs.crop)
				project.crop = angular.element(element.children()[1]);
			else
				angular.element(element.children()[1]).css({display:'none'})
			
			project.history = [];	//Each snapshot will be recorded so one can undo
			project.current = {};	//This is the live state (while events are occurring)
			project.snapshot = {};	//This is set once events are finished (on touchend & mouseup)
			project.touch = {};		
			project.mouse = {};		

			var tools = project.tools = {
				init: function(src){
					project.defer = $q.defer()
					project.promise = function(){return project.defer.promise}
					project.src = src;
					project.img[0].src = src;
					project.oimg.src = src;
					project.renderCt = 0;
					
					project.img.css({
						position:	'absolute',
					})
					project.oimg.onload = function(){
						project.img.ratio = project.oimg.height / project.oimg.width
						project.original = {
							w:		project.oimg.width,
							h:		project.oimg.height,
							ratio:	project.oimg.height / project.oimg.width,
						}
						tools.redraw()
						project.original.mult = project.oimg.width / project.container.w,
						tools.zoom(0,0,project.container.w,project.container.h, true)
						tools.crop(project.container.h, true)
						window.requestAnimationFrame(tools.render)
						window.onresize = project.tools.redraw;
						project.defer.resolve();
					}
					
					// Setup Listeners
					project.container.on("touchstart", tools.touch.start);
					project.container.on("touchmove", tools.touch.move);
					project.container.on("touchend", tools.touch.end);
					project.container.on("mousewheel", tools.cursor.scroll);
					project.container.on("DOMMouseScroll", tools.cursor.scroll);
					project.container.on("mousedown", tools.cursor.start);
					project.container.on("mousemove", tools.cursor.move);
					project.container.on("mouseup", tools.cursor.end);
					
					if(project.crop){
						project.crop.on("touchstart", tools.handlebar.start);
						project.crop.on("touchmove", tools.handlebar.move);
						project.crop.on("touchend", tools.handlebar.end);
						project.crop.on("mousedown", tools.handlebar.start);
						project.crop.on("mousemove", tools.handlebar.move);
						project.crop.on("mouseup", tools.handlebar.end);
					}
					return project.promise;
				},
				redraw: function(){
					project.offset = project.container.offset();
					if(project.container.w != project.container.parent().width()){
						project.container.w = project.container.parent().width();
						project.container.h = project.container.w * project.img.ratio;
		
						project.container.css({
							position:	'relative',
							overflow:	'hidden',
							width:		project.container.w,
							height: 	project.container.h
						})
					}
				},
				reset: function(){
					var w = project.container.w;
					var h = w*project.original.ratio;
					tools.zoom(0,0,w,h, true)
					tools.crop(h, true)
				},
				undo: function(){
					var past = project.history.pop()
					if(past && past.crop){
						project.current = angular.copy(past)
						project.snapshot = angular.copy(past)
					}
				},
				zoom: function(x,y,w,h,snapshot){
					var crop = false;
					project.current.x = x
					project.current.y = y
					project.current.w = w
					project.current.h = h
	
					if(snapshot){
						project.history.push(Object.assign({}, project.snapshot))
						project.snapshot = Object.assign({}, project.current);
					}
				},
				pan: function(x,y,snapshot){
					project.current.x = x
					project.current.y = y
					if(snapshot){
						project.history.push(Object.assign({}, project.snapshot))
						project.snapshot = Object.assign({}, project.current);
					}
				},
				crop: function(crop, snapshot){
					project.current.crop = crop;
					project.container.height(crop);
					if(snapshot){
						project.history.push(Object.assign({}, project.snapshot))
						project.snapshot = Object.assign({}, project.current);
					}
				},
				render: function(){
					project.renderCt++;
					var css = 'margin-left: '	+project.current.x+'px !important; ';
						css += 'margin-top: '	+project.current.y+'px !important; ';
						css += 'width: '		+project.current.w+'px !important; ';
						css += 'height: '		+project.current.h+'px !important; ';
					project.img.attr('style', css)
					
					project.container.height(project.current.crop)
					window.requestAnimationFrame(tools.render)
				},
				cursor: {
					scroll: function(e){
						e.preventDefault();
						
						p.sx = e.originalEvent.pageX-project.offset.left
						p.sy = e.originalEvent.pageY-project.offset.top
						p.w = project.current.w - (project.current.w*e.originalEvent.deltaY / 1100);
						p.h = p.w * project.img.ratio
						
						p.scale = project.current.w/project.container.w;
						p.zoom = p.w/project.container.w
						p.x = p.sx - (-(project.snapshot.x - (p.sx)) / project.snapshot.w * p.w);
						p.y = p.sy - (-(project.snapshot.y - (p.sy)) / project.snapshot.h * p.h);
						
						tools.zoom(p.x,p.y,p.w,p.h)
						
						//Set a timeout to capture a snapshot after scroll wheel inactivity.
						if(project.cursorSnapshot)
							$timeout.cancel(project.cursorSnapshot)
						project.cursorSnapshot = $timeout(function(){
							tools.zoom(p.x,p.y,p.w,p.h, true)
						}, 500)
					},
					start: function(e){
						e.preventDefault();
						project.mouse['Start'] = e.originalEvent;
					},
					end: function(e){
						tools.cursor.update(true);
						delete project.mouse['Start'];
						delete project.mouse['Move'];
					},
					move: function(e){
						e.preventDefault();
						project.mouse['Move'] = e.originalEvent;
						tools.cursor.update();
					},
					update: function(snapshot){
						p.s = project.mouse['Start']
						p.m = project.mouse['Move']
						if(p.s && p.m){
							p.x = project.snapshot.x - (p.s.pageX-p.m.pageX)
							p.y = project.snapshot.y - (p.s.pageY-p.m.pageY)
							tools.pan(p.x,p.y,snapshot)
						}
					}
				},
				touch: {
					start: function(event){
						event.preventDefault();
						var oect = event.originalEvent.changedTouches
						for(var i=0; i<oect.length; i++){
							project.touch['Start'+oect[i].identifier] = {pageX: oect[i].pageX, pageY: oect[i].pageY}
							p.id.push(oect[i].identifier)
							if(p.id.length > 1)
								p.zoom = true;
						}
					},
					end: function(event){
						event.preventDefault();
						tools.touch.update(true);
						var oect = event.originalEvent.changedTouches
						for(var i=0; i<oect.length; i++){
							delete project.touch['Start'+oect[i].identifier];
							delete project.touch['Move'+oect[i].identifier];
							p.id.splice(p.id.indexOf(oect[i].identifier), 1);
						}
						if(p.zoom && p.id.length==0)
							p.zoom = false;
					},
					move: function(event){
						event.preventDefault();
						
						var oect = event.originalEvent.changedTouches
						for(var i=0; i<oect.length; i++){
							project.touch['Prev'+oect[i].identifier] = project.touch['Move'+oect[i].identifier]
							project.touch['Move'+oect[i].identifier] = {pageX: oect[i].pageX, pageY: oect[i].pageY}
						}
						tools.touch.update();
					},
					update: function(snapshot){
						p.s0 = project.touch['Start'+p.id[0]]
						p.s1 = project.touch['Start'+p.id[1]]
						p.m0 = project.touch['Move'+p.id[0]]
						p.m1 = project.touch['Move'+p.id[1]]
						if(p.m0 && p.m1){
							p.sw = Math.abs(p.s0.pageX - p.s1.pageX)
							p.sh = Math.abs(p.s0.pageY - p.s1.pageY)
							p.mw = Math.abs(p.m0.pageX - p.m1.pageX)
							p.mh = Math.abs(p.m0.pageY - p.m1.pageY)
	
							p.wdiff = p.mw - p.sw;
							p.hdiff = p.mh - p.sh;
							
							p.sd = Math.sqrt(p.sw*p.sw+p.sh*p.sh)
							p.md = Math.sqrt(p.mw*p.mw+p.mh*p.mh)
	
	
							p.sxMin = Math.min(p.s0.pageX, p.s1.pageX)-project.offset.left
							p.syMin = Math.min(p.s0.pageY, p.s1.pageY)-project.offset.top
							p.mxMin = Math.min(p.m0.pageX, p.m1.pageX)-project.offset.left
							p.myMin = Math.min(p.m0.pageY, p.m1.pageY)-project.offset.top
	
							p.sxMax = Math.max(p.s0.pageX, p.s1.pageX)-project.offset.left
							p.syMax = Math.max(p.s0.pageY, p.s1.pageY)-project.offset.top
							p.mxMax = Math.max(p.m0.pageX, p.m1.pageX)-project.offset.left
							p.myMax = Math.max(p.m0.pageY, p.m1.pageY)-project.offset.top
	
							p.spx = p.sxMin + ((p.sxMax-p.sxMin)/2)
							p.spy = p.syMin + ((p.syMax-p.syMin)/2)
							p.mpx = p.mxMin + ((p.mxMax-p.mxMin)/2)
							p.mpy = p.myMin + ((p.myMax-p.myMin)/2)
							
							
							
							p.w = project.snapshot.w * (p.md/p.sd)
							p.h = p.w * project.img.ratio
							p.x = p.mpx - (-(project.snapshot.x - (p.spx)) / project.snapshot.w * p.w);
							p.y = p.mpy - (-(project.snapshot.y - (p.spy)) / project.snapshot.h * p.h);
	
							tools.zoom(p.x,p.y,p.w,p.h,snapshot)
						}else if(p.m0 && !p.zoom){
							p.xDiff = p.s0.pageX - p.m0.pageX
							p.yDiff = p.s0.pageY - p.m0.pageY
							p.mult = project.snapshot.w / project.container.w;
							p.x = project.snapshot.x - (p.xDiff);
							p.y = project.snapshot.y - (p.yDiff);
							tools.pan(p.x,p.y,snapshot)
						}
					}
				},
				handlebar: {
					start: function(event){
						event.preventDefault();
						if(event.type == 'touchstart'){
							var touch = event.originalEvent.changedTouches[0]
							project.touch['StartCrop'] = {pageX: touch.pageX, pageY: touch.pageY}
						}else{
							project.touch['StartCrop'] = event.originalEvent;
						}
					},
					end: function(event){
						event.preventDefault();
						tools.handlebar.update(true);
						delete project.touch['StartCrop'];
						delete project.touch['MoveCrop'];
					},
					move: function(event){
						event.preventDefault();
						
						if(event.type == 'touchmove'){
							var touch = event.originalEvent.changedTouches[0]
							project.touch['MoveCrop'] = {pageX: touch.pageX, pageY: touch.pageY}
						}else{
							project.touch['MoveCrop'] = event.originalEvent;
						}
						tools.handlebar.update();
					},
					update: function(snapshot){
						p.start = project.touch['StartCrop']
						p.move = project.touch['MoveCrop']
						
						if(p.start && p.move){
							var crop = project.snapshot.crop + (p.move.pageY - p.start.pageY)
							tools.crop(crop, snapshot)
						}
					}
				},
				debug: function(x,y,w,h){
					if(project.debug){
						project.debug.fillStyle="#FFF";
						project.debug.fillRect(0,0,project.canvas.width,project.canvas.height);
						project.debug.fillStyle="#000";
						project.debug.fillRect(x/project.cratio,y/project.cratio,w/project.cratio,h/project.cratio);
					}
				}
			}
			project.nextRow = function(){
				p.x = project.snapshot.x;
				p.y = project.snapshot.y-project.snapshot.crop;
				p.w = project.snapshot.w;
				p.h = project.snapshot.h;
				tools.zoom(p.x, p.y, p.w, p.h, true)
			}
			project.nextColumn = function(){
				p.x = project.snapshot.x-project.container.w;
				p.y = project.snapshot.y;
				p.w = project.snapshot.w;
				p.h = project.snapshot.h;
				tools.zoom(p.x, p.y, p.w, p.h, true)
			}
			project.getZoom = function(){
				return {
					w: (project.original.w / project.snapshot.w * project.container.w),
					h: (project.original.h / project.snapshot.h * project.snapshot.crop),
					x: -(project.original.w / project.snapshot.w * project.snapshot.x),
					y: -(project.original.h / project.snapshot.h * project.snapshot.y),
				}
			}
			project.setZoom = function(zoom, src){
				if(src)
					project.tools.init(src)
				project.promise().then(function(){
					project.tools.redraw()
					project.current.w = (project.original.w / zoom.w * project.container.w)
					project.current.h = project.current.w * project.img.ratio;
					var ratio = project.original.w / project.current.w;
					project.current.x = -(zoom.x / ratio)
					project.current.y = -(zoom.y / ratio)
					project.current.crop = (zoom.h / ratio)
					project.snapshot = Object.assign({}, project.current);
				})
			}
			project.getSrc = function(){
				return project.src;
			}
			scope.$watch(function() {return element.attr('zoom-src'); }, function(src){
				if(src)
					tools.init(src)
			})
			if(element.attr('zoom')){
				scope[element.attr('zoom')] = {
					project:	project,
					set:		project.setZoom,
					get:		project.getZoom,
					reset:		tools.reset,
					undo:		tools.undo,
					src:		project.getSrc
				}
			}
		}
	}
})

app.filter('capitalize', function() {
	return function(input, all) {
		var reg = (all) ? /([^\W_]+[^\s-]*) */g : /([^\W_]+[^\s-]*)/;
		return (!!input) ? input.replace(reg, function(txt) {
			return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
		}) : '';
	}
});