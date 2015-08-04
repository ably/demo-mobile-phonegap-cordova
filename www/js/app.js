(function (window) {
    "use strict";

    var Constants = {
        MESSAGE_NAME: 'chat-message',
        ABLY_CHANNEL_NAME: 'mobile:chat',
        HISTORY_MESSAGES_LIMIT: 50
    };

    function ChatApp(uiController) {
        var app = this;

        function prepareAblyInstance(successCallback) {
            var ably = new Ably.Realtime({
                authUrl: 'https://www.ably.io/ably-auth/token-request/demos',
                transports: ['web_socket'],
                log: {
                    level: 4
                }
            });
            var successCb = successCallback || _.noop;

            ably.connection.on('connected', function (stateChange) {
                if (stateChange && stateChange.reason) {
                    uiController.onError(stateChange.reason);
                    return;
                }

                var ablyChannel = ably.channels.get(Constants.ABLY_CHANNEL_NAME);

                ablyChannel.attach(function (err) {
                    function getMembersAndCallUiController(presenceMessage) {
                        ablyChannel.presence.get(function (clientId, members) {
                            uiController.onPresence(presenceMessage, members);
                        });
                    }

                    if (err) {
                        uiController.onError(err);
                        return;
                    }

                    ablyChannel.subscribe(Constants.MESSAGE_NAME, uiController.onMessageReceived);

                    ablyChannel.presence.on('enter', getMembersAndCallUiController);
                    ablyChannel.presence.on('leave', getMembersAndCallUiController);
                    ablyChannel.presence.on('update', getMembersAndCallUiController);

                    app.ablyChannel = ablyChannel;
                    app.ably = ably;

                    successCb();
                });
            });

            ably.connection.on('failed', uiController.onError);
        }

        function pushPresence(callback) {
            try {
                app.ablyChannel.presence.enterClient(app.name, {}, callback);
            } catch (error) {
                callback(error);
            }
        }

        function getMessagesHistory(callback) {
            var params = {
                limit: Constants.HISTORY_MESSAGES_LIMIT,
                direction: 'backwards',
                untilAttach: true
            };

            app.ablyChannel.history(params, function (err, result) {
                var messageIndex = 0,
                    currentMessage = {};
                if (err) {
                    uiController.onError(err);
                    return;
                }

                /* Loop over all messages in the history and trigger uiController's .onMessageReceived() for each one */
                if (result && result.items && result.items.length > 0) {
                    for (messageIndex = result.items.length - 1; messageIndex >= 0; messageIndex--) {
                        currentMessage = result.items[messageIndex];
                        uiController.onMessageReceived(currentMessage);
                    }
                }

                callback();
            });
        }

        function getPresenceHistory() {
        }

        return {
            initialize: prepareAblyInstance,
            publishMessage: function (message) {
                var messageData = {
                    text: message,
                    name: app.name
                };

                app.ablyChannel.publish(Constants.MESSAGE_NAME, messageData, uiController.onError);
            },
            joinChannel: function (name) {
                app.name = name;
                pushPresence(function (err) {
                    if (err) {
                        uiController.onError(err);
                        return;
                    }

                    getMessagesHistory(getPresenceHistory);
                });
            },
            sendTypingNotification: function (isTyping) {
                isTyping = !!isTyping;
                app.ablyChannel.presence.updateClient(app.name, {isTyping: isTyping});
            }
        };
    }

    window.ChatApp = ChatApp;
}(window));
