(function (window) {
    "use strict";

    var isCordovaApp = !!window.cordova;

    var Constants = {
        // Ably channel name
        ABLY_CHANNEL_NAME: 'mobile:chat',

        // Chat and presence messages to retrieve
        HISTORY_MESSAGES_LIMIT: 50,
    }

    if (isCordovaApp) {
        // If running under Cordova / PhoneGap, then use a demo token provided by Ably
        Constants.TOKEN_PATH = 'https://www.ably.io/ably-auth/token-request/demos';
    } else {
        // If running locally or in Heroku, then use the local token provider
        Constants.TOKEN_PATH = '/token';
    };

    MicroEvent.mixin(ChatApp);  /* add EventEmitter to View class i.e. bind and trigger */

    /*
     *  ChatApp is the application class that provides high level functions for all
     *  application operations such as retrieve messages, publish messages, update user status,
     *  connect to Ably, emit events when connection state changes etc.
     */
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

        // Retrieve chat messages history
        function getMessagesHistory(callback) {
            var params = {
                limit: Constants.HISTORY_MESSAGES_LIMIT,
                direction: 'backwards',
                untilAttach: true
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
                limit: Constants.HISTORY_MESSAGES_LIMIT,
                direction: 'backwards',
                untilAttach: true
            };

            app.ablyChannel.presence.history(params, function (err, messages) {
                if (err) {
                    view.showError(err);
                    return;
                }

                callback(messages.items);
            })
        }

        function channelStateLost() {
            // remove all listeners as we will set them up again once the connection is restored
            app.ablyChannel.unsubscribe();
            app.ablyChannel.presence.unsubscribe();

            app.ably.connection.once('connected', function() {
                app.joinChannel();
            });
        }

        function attemptReconnect(duration) {
            window.setTimeout(function() {
                app.ably.connection.connect();
            }, duration);
        }

        function getTokenRequestUrl(clientId) {
            return Constants.TOKEN_PATH + '?clientId=' + escape(clientId);
        }

        // Initializes an Ably realtime instance using the clientId
        // * Connect using Token Request
        // * Attach channel
        // * Notify caller via success callback
        this.initialize = function(clientId) {
            var logLevel = 2,
                logLevelParam = Utils.parseQuery(document.location.search).logLevel;
            if (!isNaN(parseInt(logLevelParam))) {
                logLevel = logLevelParam;
            }

            var realtimeOptions = {
                authUrl: getTokenRequestUrl(clientId),
                clientId: clientId,
                log: { level: logLevel },
                disconnectedRetryTimeout: 5000, /* reattempt connect every 5s - default is 15s */
                suspendedRetryTimeout:    15000 /* reattempt connect when suspended every 15s - default is 30s */
            }

            var key = Utils.parseQuery(document.location.search).key;
            if (key) {
                realtimeOptions.key = key;
                delete realtimeOptions.authUrl;
            }

            var environment = Utils.parseQuery(document.location.search).environment;
            if (environment) {
                realtimeOptions.environment = environment;
            }

            app.ably = new Ably.Realtime(realtimeOptions);

            app.clientId = clientId;
            view.clientId = clientId;

            app.ably.connection.on(function() {
                app.trigger('connection.statechange', this.event);
                app.trigger('connection.' + this.event);
            });

            app.ablyChannel = app.ably.channels.get(Constants.ABLY_CHANNEL_NAME);
            app.joinChannel();
        };

        this.initialized = function() {
            return (app.clientId ? true : false);
        };

        // Publishes the given message data to Ably with the clientId embedded
        this.publishMessage = function (data) {
            view.showNotice('sending', 'Sending message');

            app.ablyChannel.publish({ data: data, clientId: app.clientId }, function (err) {
                if (err) {
                    view.showError(err);
                    return;
                }
                view.hideNotice('sending');
            });
        };

        // Joins the channel and registers presence
        // Once present, history is loaded and displayed
        this.joinChannel = function () {
            var channel = app.ablyChannel,
                presence = channel.presence;

            view.showNotice('loading', 'Hang on a sec, loading the chat history...');

            view.clearMessages();
            channel.attach(); // if joinChannel called a second time, an explicit attach may be required

            channel.subscribe(view.showNewMessage);
            presence.subscribe(membersChanged);

            presence.enter(function(err) {
                if (err) {
                    view.showError(err);
                    return;
                }
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
                    view.hideNotice('loading');
                    displayHistory(messageHistory, presenceHistory);
                }
            };

            getMessagesHistory(function (messages) {
                messageHistory = messages;
                displayIfReady();
            });

            getPresenceHistory(function (presenceMessages) {
                presenceHistory = presenceMessages;
                displayIfReady();
            });
        };

        // Explicitly reconnect to Ably and joins channel
        this.reconnect = function () {
            app.initialize(app.clientId);
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
