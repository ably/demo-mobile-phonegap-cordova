(function (window) {
    "use strict";

    var Constants = {
        // Ably channel name
        ABLY_CHANNEL_NAME: 'mobile:chat',

        // Chat and presence messages to retrieve
        HISTORY_MESSAGES_LIMIT: 50
    };

    function ChatApp(view) {
        var app = this;

        // Represents whether the user is considered typing or not
        var isUserCurrentlyTyping = false;

        // Gets the members from the Presence object and notifies the view of a presence change
        function membersChanged(presenceMessage) {
            app.ablyChannel.presence.get(function (err, members) {
                if (err) {
                    view.showError(err);
                    return;
                }
                view.showPresenceEvent(presenceMessage, members);
            });
        }

        // Sort chat and presence messages into one list and add to messages
        function displayHistory(messages, presence) {
            var all = messages.concat(presence).sort(function (a, b) {
                return a.timestamp < b.timestamp ? 1
                    : a.timestamp == b.timestamp ? 0
                    : -1;
            });
            view.prependHistoricalMessages(all);
        }

        // Initializes an Ably realtime instance using the clientId
        // * Connect using Token Request
        // * Attach channel
        // * Notify caller via success callback
        this.initialize = function (clientId) {
            app.clientId = clientId;
            view.clientId = clientId;

            app.ably = new Ably.Realtime({
                authUrl: 'https://www.ably.io/ably-auth/token-request/demos',
                clientId: clientId,
                transports: ['web_socket'], // TODO: Do not lock into the WS transport, use any transport available
                log: { level: 4 }
            });
            app.ably.connection.on(view.updateConnectionState);
            app.ably.connection.on('failed', view.showError);

            app.ablyChannel = app.ably.channels.get(Constants.ABLY_CHANNEL_NAME);
            app.joinChannel();
        }

        // Retrieve chat messages history
        function getMessagesHistory(callback) {
            var params = {
                limit: Constants.HISTORY_MESSAGES_LIMIT,
                direction: 'backwards'
                // untilAttach: true // TODO: Reinstitute when untilAttach is working, see https://github.com/ably/ably-js/issues/93
            };

            app.ablyChannel.history(params, function (err, result) {
                if (err) {
                    view.showError(err);
                    return;
                }

                callback(result.items);
            });
        }

        // Retrieve presence messages history
        function getPresenceHistory(callback) {
            var params = {
                direction: 'backwards',
                limit: Constants.HISTORY_MESSAGES_LIMIT
                // untilAttach: true // TODO: Reinstitute when untilAttach is working, see https://github.com/ably/ably-js/issues/93
            };

            app.ablyChannel.presence.history(params, function (err, messages) {
                if (err) {
                    view.showError(err);
                    return;
                }

                callback(messages.items.slice(1)); // TODO: Remove slice once untilAttach implemented to avoid duplicate you have entered
            })
        }

        // Publishes the given message data to Ably with the clientId embedded
        this.publishMessage = function (data) {
            view.showNotice('Sending message');

            app.ablyChannel.publish({ data: data, clientId: app.clientId }, function (err) {
                if (err) {
                    view.showError(err);
                    return;
                }
                view.hideNotice();
            });
        };

        // Joins the channel and registers presence
        // Once present, history is loaded and displayed
        this.joinChannel = function () {
            var channel = app.ablyChannel;
            var presence = channel.presence;

            view.resetMessages();
            channel.attach(); // if joinChannel called a second time, an explicit attach may be required

            channel.subscribe(view.showNewMessage);
            presence.on(membersChanged);

            presence.enter(function(err) {
                if (err) {
                    view.showError(err);
                    return;
                }
                view.hideLoadingOverlay();
                view.showNotice('Hang on a sec, loading channel history...');
                app.loadHistory();
            });

            channel.once('detached', channelStateLost);
            channel.once('failed', channelStateLost);
        };

        // * Retrieve chat & presence history
        // * Notify the View
        this.loadHistory = function () {
            var messageHistory, presenceHistory;

            var displayIfReady = function() {
                if (messageHistory && presenceHistory) {
                    view.hideNotice();
                    displayHistory(messageHistory, presenceHistory);
                }
            }

            getMessagesHistory(function (messages) {
                messageHistory = messages;
                displayIfReady();
            });

            getPresenceHistory(function (presenceMessages) {
                presenceHistory = presenceMessages;
                displayIfReady();
            });
        }

        function channelStateLost() {
            // remove all listeners as we will set them up again once the connection is restored
            app.ablyChannel.unsubscribe();
            app.ablyChannel.presence.off();

            app.ably.connection.once('connected', function() {
                app.joinChannel();
            });
        }

        // Explicitly reconnect to Ably and joins channel
        this.reconnect = function () {
            view.hideLoadingOverlay();
            view.showNotice('Connecting to Ably...');
            app.ably.connection.connect(); // channel automatically reattaches due to channelStateLost()
        };

        // Leaves channel by disconnecting from Ably
        this.disconnect = function () {
            if (app.ably && app.ably.connection) {
                app.ably.connection.close();
            }
        };

        // Updates presence data for user with information whether he's currently typing
        this.sendTypingNotification = function (typing) {
            // Don't send a 'is typing' notification if user is already typing
            if (isUserCurrentlyTyping && typing) {
                return;
            }

            app.ablyChannel.presence.update({ isTyping: typing });
            isUserCurrentlyTyping = typing;
        };
    }

    window.ChatApp = ChatApp;
}(window));
