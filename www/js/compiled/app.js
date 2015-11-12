(function (window) {
    "use strict";

    var Constants = {
        // Ably channel name
        ABLY_CHANNEL_NAME: 'mobile:chat',

        // Chat and presence messages to retrieve
        HISTORY_MESSAGES_LIMIT: 50,

        TOKEN_PATH: 'https://www.ably.io/ably-auth/token-request/demos'
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
                direction: 'backwards' //, TODO: Reinstate untilAttach when working
                // untilAttach: true
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
                direction: 'backwards' //, TODO: Reinstate untilAttach when working
                // untilAttach: true
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

        function getTokenRequestUrl(clientId) {
            return Constants.TOKEN_PATH + '?clientId=' + escape(clientId);
        }

        // Initializes an Ably realtime instance using the clientId
        // * Connect using Token Request
        // * Attach channel
        // * Notify caller via success callback
        this.initialize = function (clientId) {
            app.clientId = clientId;
            view.clientId = clientId;

            app.ably = new Ably.Realtime({
                authUrl: getTokenRequestUrl(clientId),
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
            presence.on(membersChanged);

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
;/*
 * Controller.js is responsible for setting up the View and App classes
 * and brokering all operations between all components of the app
 */
$(document).ready(function () {
    var view = new View(),
        app  = new ChatApp(view);

    // Helpers to access the app from the dev console
    window.ablyApp = app;
    window.ablyView = view;

    Origami.fastclick(document.body);

    var login = function(clientId) {
        view.joinAndAwaitConnect();
        app.initialize(clientId);
    }

    if (window.isRunningOnMobile) {
        // Cordova handlers for app pause and app resume
        // * disconnect when moving to background
        // * connect back to Ably when moving back to the foreground
        document.addEventListener('deviceready', function() {
            document.addEventListener('pause', function() {
                if (app.initialized()) {
                    app.disconnect();
                }
            });

            document.addEventListener('resume', function() {
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
    app.on('connection.statechange', function(state) {
        console.log("Connection state change", state);

        if (state === 'disconnected' || state === 'suspended') {
            view.disableInterface("Reconnecting....");
        } else if (state === 'closed') {
            view.disableInterface('Connection is closed as a result of a user interaction');
        } else if (state === 'connecting') {
            if (document.appHasJoined) {
                view.disableInterface('Connecting to Ably...');
            }
        } else if (state === 'connected') {
            if (!document.appHasJoined) {
                document.appHasJoined = true;
                view.joinSuccessful();
            } else {
                view.enableInterface();
            }
        }
    });

    app.on('connection.failed', function(state) {
        view.showError("Connecting failed");
    });

    // Joins the channel using the name (clientId) entered by the user
    view.on('login.submit', function(name) {
        if (name === '') {
            return view.showNameValidationError();
        }
        login(name);
    });

    // Sends the message typed by the user and stops the 'user is typing' notification
    view.on('message.send', function(message) {
        if (message.trim() === '') { return; }
        app.publishMessage(message);
        view.resetMessageInput();
        app.sendTypingNotification(false);
    });

    // Sends a 'user is typing' notification, except when completing a message via the Enter key.
    view.on('message.keydown', function(keyCode) {
        app.sendTypingNotification(true);
    });

    // Sends a 'user has stopped typing' notification, after 5 seconds have passed since the last keystroke.
    view.on('message.keyup', _.debounce(function () {
        app.sendTypingNotification(false);
    }, 5000));

    window.onunload = window.onbeforeunload = function () {
        if (app.initialized()) {
            app.disconnect();
        }
    };

    view.appLoaded();

    var queryParams = Utils.parseQuery(document.location.search);
    if (queryParams.autoLogin) {
        login(queryParams.autoLogin);
    }
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
        var today = new Date(),
            dayMs = 24 * 60 * 60 * 1000,
            yesterday = new Date(today.getTime() - dayMs),
            months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" "),
            datePart = date.getDate() + " " + date.getMonth();

        if (date.getDate() == today.getDate() && date.getMonth() == today.getMonth() && date.getFullYear() == today.getFullYear()) {
            datePart = "today";
        } else if (date.getDate() == yesterday.getDate() && date.getMonth() == yesterday.getMonth() && date.getFullYear() == yesterday.getFullYear()) {
            datePart = "yesterday";
        }
        return padZeroes(datePart + " at " + date.getHours()) + ":" + padZeroes(date.getMinutes()) + ":" + padZeroes(date.getSeconds());
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

    function parseQuery(qstr) {
        var query = {};
        var a = qstr.substr(1).split('&');
        for (var i = 0; i < a.length; i++) {
            var b = a[i].split('=');
            query[decodeURIComponent(b[0])] = decodeURIComponent(b[1] || '');
        }
        return query;
    }

    window.Utils = {
        formatDateAsLocalTime: formatDateAsLocalTime,
        formatTypingNotification: formatTypingNotification,
        leftTrim: leftTrim,
        parseQuery: parseQuery
    };
}(window));
;(function (window) {
    "use strict";

    MicroEvent.mixin(View); /* add EventEmitter to View class i.e. bind and trigger */

    /*
     * View class is responsible for updating the HTML UI and capturing all events
     */
    function View() {
        var view = this;

        var MAX_COLORS = 8,
            NOTICE_TYPES = 'offline typing sending loading'.split(' '),
            otherUserColours = {};

        /* login elements */
        var $loginView = $('#js-login'),
            $loginForm = $loginView.find('#name-form'),
            $loginNameField = $loginView.find('input.form-text'),
            $loginButton = $loginView.find('a.form-button');

        /* messages list */
        var $messageThreadView = $('#js-messages'),
            $messagesList = $messageThreadView.find('.thread');

        /* panel that is sticky with input field for new messages and menu of users */
        var $messagePanel = $('#js-message-panel'),
            $msgPanelStatus = $messagePanel.find('.msg-status'),
            $msgPanelStatusText = $msgPanelStatus.find('.msg-status-text'),
            $msgPanelPeopleCounter = $messagePanel.find('.msg-people'),
            $msgPanelPeopleCounterText = $msgPanelPeopleCounter.find('.icon-person'),
            $msgPanelPeopleList = $messagePanel.find('.user-menu .user-list'),
            $msgPanelMenuButton = $messagePanel.find('.msg-menu a'),
            $msgPanelInput = $messagePanel.find('.form-message');

        function initialize() {
            $loginForm.on('submit', function(event) {
                event.preventDefault();
                view.trigger('login.submit', $loginNameField.val());
            });

            $loginButton.on('click', function() {
                $loginForm.submit();
            });

            $msgPanelInput.on('keydown', function(event) {
                if (event.keyCode == 13) {
                    event.preventDefault();
                    view.trigger('message.send', $msgPanelInput.val());
                } else {
                    view.trigger('message.keydown', event.keyCode);
                }
            });

            $msgPanelInput.on('keyup', function(event) {
                view.trigger('message.keyup', event.keyCode);
            });

            setupPeopleListToggler();
        }

        /* There are 8 colour slots, rotate between colours for each user and assign them an alphabetical letter */
        function getPresentationForUser(user) {
            var indexLetters = 'ABCDEFGHJIJKLMNOPQRSTUVWXYZ';

            if (otherUserColours[user]) {
                return otherUserColours[user];
            } else {
                var colourIndex = (Object.keys(otherUserColours).length + 1) % MAX_COLORS,
                    letterIndex = (Object.keys(otherUserColours).length) % indexLetters.length,
                    letter = indexLetters.slice(letterIndex, letterIndex+1);

                otherUserColours[user] = {
                    colour: colourIndex+1, /* 1-8 */
                    letter: letter
                }
                return otherUserColours[user];
            }
        }

        function togglePeopleListVisibility(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            if ($messagePanel.hasClass("show-user-menu")) {
                $(document).off("click", togglePeopleListVisibility);
            } else {
                $(document).one("click", togglePeopleListVisibility);
            }
            $messagePanel.toggleClass("show-user-menu");
        }

        /* Toggle the people list menu */
        function setupPeopleListToggler() {
            $msgPanelMenuButton.on('click', togglePeopleListVisibility);
            $msgPanelPeopleCounter.on('click', togglePeopleListVisibility);
        }

        function publishedFromSelf(message) {
            return message.clientId == view.clientId;
        }

        function messagePartial(message) {
            var dateAsLocalTime = Utils.formatDateAsLocalTime(new Date(message.timestamp)),
                $box = $('<span class="thread-box">'),
                $li = $('<li class="thread-event user">').addClass("theme-" + getPresentationForUser(message.clientId).colour);

            $box.append($('<span class="handle">').text(message.clientId));
            $box.append($('<span class="time">').text(dateAsLocalTime));
            $box.append($('<span class="text">').text(message.data));
            $li.append($box);

            if (publishedFromSelf(message)) {
                return $li.addClass('me');
            } else {
                return $li.addClass('not-me');
            }
        }

        function presencePartial(presence) {
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
                $text.text('you ' + actionText + ' the channel ' + dateAsLocalTime);
            } else {
                $text.text(presence.clientId + ' ' + actionText + ' the channel ' + dateAsLocalTime);
            }
            return $('<li class="system-event ' + actionText + '">').append($text);
        }

        function addToMessageList($elem, historicalMessages) {
            if (!$elem) { return; } // ignore empty elements i.e. presence messages we won't display such as updates

            ensureNewMessagesAreVisible();

            if (historicalMessages) {
                $messagesList.prepend($elem);
            } else {
                $messagesList.append($elem);
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
                view.hideNotice('typing');
            } else {
                ensureNewMessagesAreVisible();
                view.showNotice('typing', Utils.formatTypingNotification(members));
            }
        }

        // Updates the members count in the lozenge and their names in the 'Members' popup dialog
        function updateMembers(members) {
            members = members || [];

            var uniqueMembers = {}, member, memberSelf;
            for (var i = 0; i < members.length; i++) {
                member = members[i];
                if (!publishedFromSelf(member) && !uniqueMembers[member.clientId]) {
                    uniqueMembers[member.clientId] = member;
                } else if (publishedFromSelf(member) && !memberSelf) {
                    memberSelf = member;
                }
            }

            members = Object.keys(uniqueMembers).map(function(memberClientId) {
                return uniqueMembers[memberClientId];
            });

            // Typing members are users who have 'isTyping' set to true in their presence data
            var typingMembersNames = members.filter(function (member) {
                return member && member.data && member.data.isTyping;
            }).map(function (member) {
                return member.clientId;
            });
            updateMembersTyping(typingMembersNames);

            $msgPanelPeopleCounterText.text(members.length + (memberSelf ? 1 : 0));

            // Clear the member list and replace it with a list with their names
            $msgPanelPeopleList.html('');

            var addMember = function(member, isSelf) {
                var memberName = member.clientId,
                    $link = $('<a>').attr("href", "#" + memberName),
                    $name = $('<span>').text(memberName),
                    $li = $('<li class="user-item">'),
                    colourIndex = getPresentationForUser(memberName).colour,
                    letter = getPresentationForUser(memberName).letter;

                if (isSelf) {
                    $link.append($('<em>'));
                    $name.append('<span class="me">(me)</span>');
                } else {
                    $link.append($('<em>').text(letter));
                    $li.addClass("theme-" + colourIndex);
                }
                $link.append($name);
                $li.append($link);

                $li.one('click', function(event) {
                    event.preventDefault();
                    event.stopPropagation();

                    $msgPanelInput.val(Utils.leftTrim($msgPanelInput.val() + ' @' + memberName + ' '));
                    $msgPanelInput.focus();

                    togglePeopleListVisibility();
                });

                $msgPanelPeopleList.append($li);
            }

            for (var i = 0; i < members.length; i++) {
                addMember(members[i]);
            }

            if (memberSelf) { addMember(memberSelf, true); }
        }

        this.enableInterface = function() {
            $('body').removeClass('system-offline');
            view.hideNotice('offline');
            $msgPanelInput.prop('disabled', false);
            $msgPanelPeopleCounter.show();
            $msgPanelMenuButton.show();
        }

        this.disableInterface = function(reason) {
            $('body').addClass('system-offline');
            view.showNotice('offline', reason);
            $msgPanelInput.prop('disabled', true);
            $msgPanelPeopleCounter.hide();
            $msgPanelMenuButton.hide();
        }

        this.joinAndAwaitConnect = function() {
            $loginNameField.addClass('connecting');
            $loginButton.addClass('connecting');
        }

        this.joinSuccessful = function() {
            $loginView.addClass('hidden');
            $messageThreadView.removeClass('hidden');
            $messagePanel.removeClass('hidden');
        }

        this.showNameValidationError = function() {
            $loginNameField.attr('placeholder', '@handle is required').addClass('validation-error');
        }

        /* Keep a simple backlog of notices so that newer notices are
           shown, but when they are hidden, the older one remains */
        var noticeBacklog = [];
        function showNoticesFromBacklog() {
            var notice = noticeBacklog[noticeBacklog.length - 1];
            if (!notice) {
                $msgPanelStatus.fadeOut(200, function() {
                    NOTICE_TYPES.map(function(type) {
                        $messagePanel.removeClass("system-" + type);
                    });
                    $msgPanelStatus.show();
                });
                return;
            }

            NOTICE_TYPES.map(function(type) {
                if (type == notice.type) {
                    $messagePanel.addClass("system-" + type);
                } else {
                    $messagePanel.removeClass("system-" + type);
                }
            });
            $msgPanelStatusText.text(notice.message);
        }

        this.showNotice = function(type, message) {
            if (NOTICE_TYPES.indexOf(type) < 0) {
                throw "Invalid notice type: " + type;
            }
            noticeBacklog.push({ type: type, message: message });
            showNoticesFromBacklog();
        };

        this.hideNotice = function(type) {
            var filteredBacklog = [],
                notice;

            for (var i = noticeBacklog.length - 1; i >= 0; i--) {
                var notice = noticeBacklog[i];
                if (notice.type != type) {
                    filteredBacklog.unshift(notice);
                }
            }
            noticeBacklog = filteredBacklog;
            showNoticesFromBacklog();
        };

        this.showNewMessage = function(message) {
            addToMessageList(messagePartial(message));
        };

        // Receives an Ably presence message and shows it on the screen
        this.showPresenceEvent = function(presenceMessage, members) {
            addToMessageList(presencePartial(presenceMessage));
            updateMembers(members);
        };

        this.prependHistoricalMessages = function(messages) {
            var message,
                elem;

            for (var i = 0; i < messages.length; i++) {
                message = messages[i];
                if (message.action) {
                    elem = presencePartial(message);
                } else {
                    elem = messagePartial(message);
                }
                addToMessageList(elem, true);
            }
        };

        this.resetMessageInput = function() {
            $msgPanelInput.val('');
            $msgPanelInput.focus();
        }

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
        this.clearMessages = function () {
            $messagesList.empty();
        };

        this.appLoaded = function() {
            $loginView.removeClass('hidden');
        };

        initialize();
    }

    window.View = View;
}(window));
