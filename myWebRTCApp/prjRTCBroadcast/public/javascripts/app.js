(function($){
  var app = angular.module('myWebRTC', [], function($locationProvider){$locationProvider.html5Mode(true);});
  var client = new PeerManager();
  var mediaConfig = {
        audio:true,
        video: {
          mandatory: {},
          optional: []
        }
    };

    app.factory('camera', ['$rootScope', '$window', function($rootScope, $window){
      var camera = {};
      camera.preview = $window.document.getElementById('localVideo');
      camera.isOn = false;
      camera.start = function(){
      return requestUserMedia(mediaConfig)
      .then(function(stream){     
        attachMediaStream(camera.preview, stream);
        client.setLocalStream(stream);
        camera.stream = stream;
        camera.isOn = true;
        $rootScope.$broadcast('cameraIsOn',true);
      })
      .catch(Error('Failed to get access to local media.'));
    };
      camera.stop = function(){
        return new Promise(function(resolve, reject){     
        try {
          camera.stream.stop();
          camera.preview.src = '';
          resolve();
        } catch(error) {
          reject(error);
        }
        })
        .then(function(result){
          camera.isOn = false;
          $rootScope.$broadcast('cameraIsOn',false);
        }); 
    };
    return camera;
    }]);

    app.controller('IndexController', ['$window', '$location', function($window, $location){
      //
      var ctrl = this;
      ctrl.logout = function(){
        var logout_url = "http://" + $window.location.host + "/logout";
        $window.location.href = logout_url;
      }
    }]);

    app.controller('LoginController', ['$http', '$scope', '$window', function($http, $scope, $window){
      //
      var ctrl = this;
      ctrl['pwd'] = 'ilovetaiwan';
      ctrl['user_type'] = 'regular_user';
      ctrl.submit_login_info = function(){
        //
        if(ctrl.pwd.trim() === ''){
          alert('password is empty');
          return false;
        }
        var login_info = { pwd: ctrl.pwd.trim(),
                          user_type: ctrl.user_type.trim() };
        login_info = $.param({ 'login_info': login_info});
        //
        $("#preloader").delay(100).fadeIn("slow");

        // request
        $http({
          url: '/verify_login_info',
          method: 'POST',
          data: login_info,
          headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        }).success(function(res){
          //
          console.log(res);
          if(res.is_info_valid){
            var index_url = "http://" + $window.location.host;
            $window.location.href = index_url;
            // $location.url('/');
            // $window.location.reload();
          }else{
            $("#preloader").delay(100).fadeOut("slow");
          }
          return false;
        });
      }
    }]);

  app.controller('RemoteStreamsController', ['camera', '$location', '$http', '$window', function(camera, $location, $http, $window){
    var rtc = this;
    rtc.remoteStreams = [];
    function getStreamById(id) {
        for(var i=0; i<rtc.remoteStreams.length;i++) {
          if (rtc.remoteStreams[i].id === id) {return rtc.remoteStreams[i];}
        }
    }
    rtc.loadData = function () {
      // get list of streams from the server
      $http.get('/streams.json').success(function(data){
        // filter own stream
        var streams = data.filter(function(stream) {
              return stream.id != client.getId();
          });
          // get former state
          for(var i=0; i<streams.length;i++) {
            var stream = getStreamById(streams[i].id);
            streams[i].isPlaying = (!!stream) ? stream.isPlaying : false;
          }
          // save new streams
          rtc.remoteStreams = streams;
          console.log('update stream list...');
      });
    };
    client.add_external_mechanism('load_data', rtc.loadData);
    // end

    //
    rtc.view = function(stream){
      client.peerInit(stream.id);
      stream.isPlaying = !stream.isPlaying;
    };
    rtc.call = function(stream){
      /* If json isn't loaded yet, construct a new stream 
       * This happens when you load <serverUrl>/<socketId> : 
       * it calls socketId immediatly.
      **/
      if(!stream.id){
        stream = {id: stream, isPlaying: false};
        rtc.remoteStreams.push(stream);
      }
      if(camera.isOn){
        client.toggleLocalStream(stream.id);
        if(stream.isPlaying){
          // client.peerRenegociate(stream.id);
        } else {
          // client.peerInit(stream.id);
        }
        client.peerInit(stream.id);
        stream.isPlaying = !stream.isPlaying;
      } else {
        camera.start()
        .then(function(result) {
          client.toggleLocalStream(stream.id);
          if(stream.isPlaying){
            // client.peerRenegociate(stream.id);
          } else {
            // client.peerInit(stream.id);
          }
          client.peerInit(stream.id);
          stream.isPlaying = !stream.isPlaying;
        })
        .catch(function(err) {
          console.log(err);
        });
      }
    };

    //initial load
    rtc.loadData();
    if($location.url() != '/'){
        rtc.call($location.url().slice(1));
    };
  }]);

  app.controller('LocalStreamController',['camera', '$scope', '$window', function(camera, $scope, $window){
    var localStream = this;
    localStream.name = 'Guest';
    localStream.link = '';
    localStream.cameraIsOn = false;

    $scope.$on('cameraIsOn', function(event,data) {
        $scope.$apply(function() {
          localStream.cameraIsOn = data;
        });
    });

    // init; set user_type
    localStream.init = function(arg_user_type){
      localStream.user_type = arg_user_type;
    }

    // toggle camera
    localStream.toggleCam = function(){
      // check if username empty
      if(localStream.name.trim() === ''){
        alert('username is empty');
        return false;
      }

      if(localStream.cameraIsOn){
        camera.stop()
        .then(function(result){
          client.send('leave');
            client.setLocalStream(null);
        })
        .catch(function(err) {
          console.log(err);
        });
      } else {
        // for regular user, no need to start camera
        console.log('start camera...');
        camera.start()
        .then(function(result) {
          localStream.link = $window.location.host + '/' + client.getId();
          client.send('readyToStream', { name: localStream.name, user_type: localStream.user_type });
        })
        .catch(function(err) {
          console.log(err);
        });
      }
    }
    // incomplete
    localStream.start_recording = function(){
      //
    }
  }]);
})(jQuery);