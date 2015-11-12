(function (window) {
    "use strict";

    var Constants = {
        // Ably channel name
        ABLY_CHANNEL_NAME: 'mobile:chat',

        // Chat and presence messages to retrieve
        HISTORY_MESSAGES_LIMIT: 50,

        TOKEN_PATH: 'https://www.ably.io/ably-auth/token-request/demos'
    };

    MicroEvent.mixin(ChatApp);
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

        function channelStateLost() {
            // remove all listeners as we will set them up again once the connection is restored
            app.ablyChannel.unsubscribe();
            app.ablyChannel.presence.off();

            app.ably.connection.once('connected', function() {
                app.joinChannel();
            });
        }

        function attemptReconnect(duration) {
            window.setTimeout(function() {
                app.ably.connection.connect();
            }, duration);
        }

        // Initializes an Ably realtime instance using the clientId
        // * Connect using Token Request
        // * Attach channel
        // * Notify caller via success callback
        this.initialize = function (clientId) {
            app.clientId = clientId;
            view.clientId = clientId;

            app.ably = new Ably.Realtime({
                authUrl: Constants.TOKEN_PATH,
                clientId: clientId,
                log: { level: 2 }
            });

            app.ably.connection.on(function() {
                app.trigger('connection.statechange', this.event);
                app.trigger('connection.' + this.event);
            });

            // Be more aggressive in reconnect attempts, after 5s when disconnected, after 15s when suspended (connection is suspended after 120s of being disconnected)
            app.ably.connection.on('disconnected', function() { attemptReconnect(5000); });
            app.ably.connection.on('suspended',    function() { attemptReconnect(15000); });

            app.ablyChannel = app.ably.channels.get(Constants.ABLY_CHANNEL_NAME);
            app.joinChannel();
        };

        this.initialized = function() {
            return (app.clientId ? true : false);
        };

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
            var channel = app.ablyChannel,
                presence = channel.presence;

            view.resetMessages();
            channel.attach(); // if joinChannel called a second time, an explicit attach may be required

            channel.subscribe(view.showNewMessage);
            presence.on(membersChanged);

            presence.enter(function(err) {
                if (err) {
                    view.showError(err);
                    return;
                }
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
            // app.ably.connection.connect(); // channel automatically reattaches due to channelStateLost()
            // TODO: Remove this once https://github.com/ably/ably-js/issues/95 is fixed
            if (app.ably && app.ably.connection) {
                app.ably.connection.off();
            }
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
;/* Controller sets up the view and app  */

$(document).ready(function () {
    Origami.fastclick(document.body);

    var $mainAppView = $('#main-app-view'),
        $messageText = $('#message-text'),
        $nameForm = $('#name-form'),
        $joinButton = $nameForm.find('a.form-button'),
        $messageForm = $('#message-form'),
        $membersLozenge = $mainAppView.find('#members-lozenge'),
        $membersListPopup = $('#members-list-popup'),
        $dialogCloseButton = $('#dialog-close');

    var view = new View(),
        app = new ChatApp(view),
        started = false;

    // Helper to access the app from the dev console
    window.app = app;

    if (window.isRunningOnMobile) {
        // Cordova handlers for app pause and app resume
        // * disconnect when moving to background
        // * connect back to Ably when moving back to the foreground
        document.addEventListener('deviceready', function() {
            document.addEventListener('pause', function () {
                if (app.initialized()) {
                    app.disconnect();
                }
            });

            document.addEventListener('resume', function () {
                if (app.initialized()) {
                    app.reconnect();
                }
            });
        });
    }


    // Connection state change handler
    // * Disconnected / suspended: disable user input and display meaningful message
    // * Closed: disable user input and display meaningful message (closed following a request)
    // * Connected: re-enable input and hide message
    app.bind('connection.statechange', function(state) {
        console.log("Connection state change", state);

        if (state === 'disconnected' || state === 'suspended') {
            view.disableInterface("Reconnecting....");
        } else if (state === 'closed') {
            view.disableInterface('Connection is closed as a result of a user interaction');
        } else if (state === 'connecting') {
            view.disableInterface('Connecting to Ably...');
        } else if (state === 'connected') {
            if (!started) {
                started = true;
                view.joinSuccessful();
            } else {
                view.enableInterface();
            }
        }
    });

    app.bind('connection.failed', function(state) {
        view.showError("Connecting failed");
    });

    // Joins the channel using the name (clientId) entered by the user
    $nameForm.on('submit', function (ev) {
        ev.preventDefault();

        if (view.nameVal() === '') {
            return view.showNameValidationError();
        }

        view.joinAndAwaitConnect();
        app.initialize(view.nameVal());
    });

    $joinButton.on('click', function() {
        $nameForm.submit();
    });

    // Sends the message typed by the user and stops the 'user is typing' notification
    $messageForm.on('submit', function (ev) {
        ev.preventDefault();

        if ($messageText.val().trim() === '') {
            return;
        }

        app.publishMessage($messageText.val());
        $messageText.val('');
        $messageText.focus();

        app.sendTypingNotification(false);
    });

    // Sends a 'user is typing' notification, except when completing a message via the Enter key.
    $messageText.on('keydown', function (e) {
        if (e.keyCode == 13) {
            return;
        }

        app.sendTypingNotification(true);
    });

    // Sends a 'user has stopped typing' notification, after 2 seconds have passed since the last keystroke.
    $messageText.on('keyup', _.debounce(function () {
        app.sendTypingNotification(false);
    }, 5000));

    $membersLozenge.on('click', function () {
        if (!$(this).hasClass('disabled')) {
            $membersListPopup.show();
        }
    });

    $dialogCloseButton.on('click', function () {
        $membersListPopup.hide();
    });

    window.onunload = window.onbeforeunload = function () {
        if (app.initialized()) {
            app.disconnect();
        }
    };

    view.appLoaded();
});
;(function (window) {
    "use strict";

    // Avoid `console` errors in browsers that lack a console.
    (function() {
        var method;
        var noop = function () {};
        var methods = [
            'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
            'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
            'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
            'timeline', 'timelineEnd', 'timeStamp', 'trace', 'warn'
        ];
        var length = methods.length;
        var console = (window.console = window.console || {});

        while (length--) {
            method = methods[length];

            // Only stub undefined methods.
            if (!console[method]) {
                console[method] = noop;
            }
        }
    }());

    // Returns a string containing a zero-padded number
    function padZeroes(n) {
        return n < 10 ? '0' + n : n;
    }

    function leftTrim(string) {
        return string.replace(/^\s+/, "");
    }

    // Formats a Date object into a "hours:minutes:seconds" time format.
    function formatDateAsLocalTime(date) {
        return padZeroes(date.getHours()) + ":" + padZeroes(date.getMinutes()) + ":" + padZeroes(date.getSeconds());
    }

    // Creates a string showing which members are currently typing.
    function formatTypingNotification(typingMembers) {
        // Nobody is actually typing
        if (!typingMembers || typingMembers.length == 0) {
            return '';
        }

        // Single user: "Alice is typing..."
        if (typingMembers.length == 1) {
            return typingMembers[0] + ' is typing...';
        }

        // Three of less: "Alice, Bob and Carol are typing..."
        if (typingMembers.length <= 3) {
            return typingMembers.slice(0, typingMembers.length-1).join(', ') + ' and ' + typingMembers.slice(typingMembers.length-1) + ' are typing...';
        }

        // Four or more: "Alice, Bob, Carol and 3 others are typing..."
        var others = (typingMembers.length - 3);
        return typingMembers.slice(0, 3).join(', ') + ' and ' + others + ' other' + (others > 1 ? 's are' : ' is') + ' typing...';
    }

    window.Utils = {
        formatDateAsLocalTime: formatDateAsLocalTime,
        formatTypingNotification: formatTypingNotification,
        leftTrim: leftTrim
    };
}(window));
;(function (window) {
    "use strict";

    // Constructs a View, containing various functions related to the UI:
    // * Triggering loading overlay
    // * Displaying presence messages
    // * Displaying chat messages
    // * Displaying members count and mentioning
    function View() {
        var view = this,
            $nameForm = $('#name-form'),
            $nameField = $nameForm.find('input.form-text'),
            $joinButton = $nameForm.find('a.form-button'),
            $messageList = $('#message-list'),
            $loadingMessage = $('#loading-message'),
            $flashNotice = $('#flash-notice'),
            $flashNoticePusher = $('#flash-notice-page-shifter'),
            $messageFormInputs = $('#message-form :input'),
            $sendMessageButton = $('#submit-message'),
            $messageText = $('#message-text'),
            $membersLozenge = $('#members-lozenge'),
            $membersCountLozenge = $('#members-count'),
            $membersTypingNotification = $('#members-typing-indication'),
            $membersList = $('#members-list'),
            $membersListPopup = $('#members-list-popup'),

            $login = $('#js-login'),
            $messages = $('#js-messages'),
            $status = $('#js-status');

        function publishedFromSelf(message) {
            return message.clientId == view.clientId;
        }

        function messageElem(message) {
            var dateAsLocalTime = Utils.formatDateAsLocalTime(new Date(message.timestamp)),
                $author = $('<span class="author">').text(message.clientId),
                $time = $('<div class="time">').text(dateAsLocalTime),
                $message = $('<div class="message">').text(message.data),
                $back = $('<div class="back">'),
                $li = $('<div class="message-bubble">');

            $back.append($author, $time, $message);
            $li.append($back);

            if (publishedFromSelf(message)) {
                return $li.addClass('sent');
            } else {
                return $li.addClass('received');
            }
        }

        function presenceElem(presence) {
            var actionText,
                $text,
                dateAsLocalTime = Utils.formatDateAsLocalTime(new Date(presence.timestamp));

            if (presence.action === Ably.Realtime.PresenceMessage.Action.ENTER) {
                actionText = 'entered';
            } else if (presence.action === Ably.Realtime.PresenceMessage.Action.LEAVE) {
                actionText = 'left';
            } else {
                return;
            }

            $text = $('<span class="text">');
            if (publishedFromSelf(presence)) {
                $text.text('you ' + actionText + ' the channel');
            } else {
                $text.text(presence.clientId + ' has ' + actionText + ' the channel');
            }
            $text.append('<span class="time">' + dateAsLocalTime + '</span>');
            return $('<div class="message-presence">').append($text);
        }

        function addToMessageList($elem, historicalMessages) {
            if (!$elem) { return; } // ignore empty elements i.e. presence messages we won't display such as updates

            ensureNewMessagesAreVisible();

            if (historicalMessages) {
                $messageList.prepend($elem);
            } else {
                $messageList.append($elem);
            }
        }

        // If near the bottom, then scroll new message into focus automatically
        function ensureNewMessagesAreVisible(callback) {
            if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
                window.setTimeout(function() {
                    $('html, body').scrollTop($(document).height() - $(window).height());
                    if (callback) { callback(); }
                }, 50);
            }
        }

        function updateMembersTyping(members) {
            if (members.length == 0) {
                $membersTypingNotification.hide();
            } else {
                ensureNewMessagesAreVisible();
                $membersTypingNotification.text(Utils.formatTypingNotification(members)).show();
            }
        }

        // Updates the members count in the lozenge and their names in the 'Members' popup dialog
        function updateMembers(members) {
            members = members || [];

            // Typing members are users who have 'isTyping' set to true in their presence data
            var typingMembersNames = members.filter(function (member) {
                return member && member.data && member.data.isTyping && (member.clientId != view.clientId);
            }).map(function (member) {
                return member.clientId;
            });
            updateMembersTyping(typingMembersNames);

            $membersCountLozenge.text(members.length);


            // Clear the member list and replace it with a list with their names
            $membersList.html('').append(members.map(function (member) {
                var memberName = member.clientId,
                    $li = $('<li><a href="javascript:void(0)">').text(memberName);

                $li.on('click', function () {
                    $messageText.val(Utils.leftTrim($messageText.val() + ' @' + memberName + ' '));
                    $membersListPopup.hide();
                    $messageText.focus();
                });

                return $li;
            }));
        }

        view.enableInterface = function() {
            view.hideNotice();
            $messageFormInputs.prop('disabled', false);
            $membersCountLozenge.show();
            $membersLozenge.removeClass('disabled');
        }

        this.disableInterface = function(reason) {
            view.showNotice(reason);
            $messageFormInputs.prop('disabled', true);
            $membersCountLozenge.hide();
            $membersLozenge.addClass('disabled');
        }

        this.joinAndAwaitConnect = function() {
            $nameField.addClass('connecting');
            $joinButton.addClass('connecting');
        }

        this.joinSuccessful = function() {
            $login.addClass('hidden');
            $messages.removeClass('hidden');
            $status.removeClass('hidden');
        }

        this.nameVal = function() {
            return $nameField.val();
        }

        this.showNameValidationError = function() {
            $nameField.attr('placeholder', '@handle is required').addClass('validation-error');
        }

        this.showNotice = function(message) {
            ensureNewMessagesAreVisible(function() {
                $flashNoticePusher.show();
            });

            $flashNotice.text(message);
            $flashNotice.show();
        };

        this.hideNotice = function() {
            $flashNotice.hide();
            $flashNoticePusher.hide();
        };

        this.showNewMessage = function(message) {
            addToMessageList(messageElem(message));
        };

        // Receives an Ably presence message and shows it on the screen
        this.showPresenceEvent = function(presenceMessage, members) {
            addToMessageList(presenceElem(presenceMessage));
            updateMembers(members);
        };

        this.prependHistoricalMessages = function(messages) {
            var message,
                elem;

            for (var i = 0; i < messages.length; i++) {
                message = messages[i];
                if (message.action) {
                    elem = presenceElem(message);
                } else {
                    elem = messageElem(message);
                }
                addToMessageList(elem, true);
            }
        };

        // Generic error handler - alert()s an error, if one exists
        this.showError = function (err) {
            var errorMessage = "Oops, something has gone wrong. We recommend you restart this demo.";
            if (err) {
                if (err.message) {
                    errorMessage += "\n" + err.message;
                } else {
                    errorMessage += "\n" + JSON.stringify(err);
                }
            }
            alert(errorMessage);
        };

        // Clears the messages list
        this.resetMessages = function () {
            $messageList.empty();
        };

        this.appLoaded = function() {
            $login.removeClass('hidden');
        }
    }

    window.View = View;
}(window));
