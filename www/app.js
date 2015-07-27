(function () {
    var Constants = {
        MESSAGE_NAME: 'chat-message',
        ABLY_CHANNEL_NAME: 'mobile:chat'
    };

    function ChatApp(uiController) {
        var app = this;
        prepareAblyInstance(this);

        function pushPresence() {
            app.ablyChannel.presence.enterClient(app.name, uiController.onError);
        }

        function getHistory() {
            app.ablyChannel.history({limit: 50, direction: 'forwards'}, function (err, result) {
                var messageIndex = 0;
                var currentMessage = {};
                if (err) {
                    uiController.onError(err);
                    return;
                }

                if (result && result.items && result.items.length) {
                    for (messageIndex = 0; messageIndex < result.items.length; messageIndex++) {
                        currentMessage = result.items[messageIndex];
                        uiController.onMessageReceived(currentMessage);
                    }
                }
            });
        }

        function prepareAblyInstance() {
            var ably = new Ably.Realtime({authUrl: 'https://www.ably.io/ably-auth/token-request/demos'});

            ably.connection.on('connected', function () {
                var ablyChannel = ably.channels.get(Constants.ABLY_CHANNEL_NAME);

                ablyChannel.subscribe(Constants.MESSAGE_NAME, uiController.onMessageReceived);
                ablyChannel.presence.on('enter', uiController.onPresence);
                ablyChannel.presence.on('leave', uiController.onPresence);

                app.ablyChannel = ablyChannel;
            });

            ably.connection.on('failed', uiController.onError);

            return ably;
        }

        return {
            publishMessage: function (message) {
                var messageData = {
                    text: message,
                    name: app.name
                };

                app.ablyChannel.publish(Constants.MESSAGE_NAME, messageData, uiController.onError);
            },
            joinChannel: function (name) {
                app.name = name;
                pushPresence();
                getHistory();
            }
        };
    }

    window.ChatApp = ChatApp;
})();
