(function (window) {
    "use strict";

    var Constants = {
        MESSAGE_NAME: 'chat-message',
        ABLY_CHANNEL_NAME: 'mobile:chat',
        HISTORY_MESSAGES_LIMIT: 50
    };

    function ChatApp(uiController) {
        var app = this;

        var isUserCurrentlyTyping = false;

        function getMembersAndCallUiController(presenceMessage) {
            app.ablyChannel.presence.get(function (clientId, members) {
                uiController.onPresence(presenceMessage, members, app.name);
            });
        }

        function displayHistory(messages, presence) {
            // Combine both chat messages and presence messages into one array, sorted by timestamp.
            // Then enumerate and for each item call the appropriate UiController method.
            var index;
            var currentItem;
            var all = messages.concat(presence);

            // Sort
            all.sort(function (a, b) {
                return a.timestamp < b.timestamp ? -1
                    : a.timestamp == b.timestamp ? 0
                    : 1;
            });

            uiController.resetMessages();

            for (index = 0; index < all.length; index++) {
                currentItem = all[index];

                // Simple check to see if the current item is chat message or a presence message
                if (_.contains(messages, currentItem)) {
                    uiController.onMessageReceived(currentItem, currentItem.data.name !== app.name);
                }
                else if (_.contains(presence, currentItem)) {
                    uiController.onPresence(currentItem);
                }
            }
        }

        function prepareAblyInstance(successCallback) {
            var ably = new Ably.Realtime({
                authUrl: 'https://www.ably.io/ably-auth/token-request/demos',
                transports: ['web_socket'],
                log: {
                    level: 4
                }
            });
            var successCb = successCallback || _.noop;

            var connectedHandler = function (stateChange) {
                var ablyChannel = ably.channels.get(Constants.ABLY_CHANNEL_NAME);

                app.ablyChannel = ablyChannel;
                app.ably = ably;

                ablyChannel.attach(function (err) {

                    if (err) {
                        uiController.onError(err);
                        return;
                    }

                    ably.connection.off('connected', connectedHandler);
                    successCb();
                });
            };

            ably.connection.on('connected', connectedHandler);

            ably.connection.on('connected', uiController.onConnectionChange);
            ably.connection.on('disconnected', uiController.onConnectionChange);
            ably.connection.on('suspended', uiController.onConnectionChange);

            ably.connection.on('failed', uiController.onError);
        }

        function pushPresence(callback) {
            app.ablyChannel.presence.enterClient(app.name, callback);
        }

        function getMessagesHistory(callback) {
            var params = {
                limit: Constants.HISTORY_MESSAGES_LIMIT,
                direction: 'backwards'
            };

            app.ablyChannel.history(params, function (err, result) {
                if (err) {
                    uiController.onError(err);
                    return;
                }

                callback(result.items);
            });
        }

        function getPresenceHistory(callback) {
            var params = {
                direction: 'backwards',
                limit: Constants.HISTORY_MESSAGES_LIMIT
            };

            app.ablyChannel.presence.history(params, function (err, messages) {
                if (err) {
                    uiController.onError(err);
                    return;
                }

                callback(messages.items);
            })
        }

        function messageHandler(message) {
            var isReceived = message.data.name != app.name;
            uiController.onMessageReceived(message, isReceived);
        }

        this.initialize = prepareAblyInstance;
        this.publishMessage = function (message) {
            var messageData = {
                text: message,
                name: app.name
            };

            uiController.showLoadingOverlay('Sending...');

            app.ablyChannel.publish(Constants.MESSAGE_NAME, messageData, function (err) {
                if (err) {
                    uiController.onError(err);
                    return;
                }

                uiController.hideLoadingOverlay();
            });
        };
        this.joinChannel = function (name, successCallback) {
            var channel = app.ablyChannel;
            var presence = channel.presence;

            app.name = name;

            // unsubscribe from events subscribed in previous joinChannel() calls
            channel.unsubscribe(Constants.MESSAGE_NAME, messageHandler);
            presence.off('enter', getMembersAndCallUiController);
            presence.off('leave', getMembersAndCallUiController);
            presence.off('update', getMembersAndCallUiController);

            channel.attach(function (e) {
                if (e) {
                    uiController.onError(e);
                    return;
                }

                getMessagesHistory(function (messages) {
                    getPresenceHistory(function (presences) {
                        displayHistory(messages, presences);

                        channel.subscribe(Constants.MESSAGE_NAME, messageHandler);
                        presence.on('enter', getMembersAndCallUiController);
                        presence.on('leave', getMembersAndCallUiController);
                        presence.on('update', getMembersAndCallUiController);

                        pushPresence(function (err) {
                            if (err) {
                                uiController.onError(err);
                                return;
                            }

                            successCallback();
                        });
                    });
                });
            });
        };

        this.connect = function () {
            uiController.showLoadingOverlay('Connecting...');

            function onConnected() {
                app.joinChannel(app.name, uiController.hideLoadingOverlay);
                app.ably.connection.off('connected', onConnected);
            }

            app.ably.connection.on('connected', onConnected);
            app.ably.connection.connect();
        };

        this.disconnect = function () {
            if (!app.ably || !app.ably.connection || !app.ablyChannel) {
                return;
            }

            app.ablyChannel.presence.leaveClient(app.name, function () {
                app.ablyChannel.detach(function () {
                    console.log('detached channel');
                    app.ably.connection.close(function () {
                        console.log('closed connection');
                    });
                });
            });
        };

        this.sendTypingNotification = function (typing) {
            // Don't send a "typing" notification if user is already typing
            if (isUserCurrentlyTyping && typing) {
                return;
            }

            app.ablyChannel.presence.updateClient(app.name, {isTyping: typing});
            isUserCurrentlyTyping = typing;
        };
    }

    window.ChatApp = ChatApp;
}(window));
