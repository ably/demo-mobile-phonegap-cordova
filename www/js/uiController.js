(function (window) {
    "use strict";

    // Constructs an UiController, containing various functions related to the UI:
    // * Triggering loading overlay
    // * Displaying presence messages
    // * Displaying chat messages
    // * Displaying members count and mentioning
    function UiController() {
        var controller = this;
        var $messageList = $('#message-list');
        var $loadingOverlay = $('#loading-overlay');
        var $loadingMessage = $('#loading-message');
        var $loadingHistory = $('#loading-history');
        var $messageFormInputs = $('#message-form :input');
        var $connectionInfo = $('#connection-info');
        var $messageText = $('#message-text');
        var $membersCountLozenge = $('#main-app-view').find('.members-count');
        var $membersTypingNotification = $('#members-typing-indication');
        var $membersList = $('#members-list');
        var $membersListPopup = $('#members-list-popup');

        this.showLoadingOverlay = function(message) {
            $loadingMessage.text(message || 'Loading...');
            $loadingOverlay.show();
        }

        this.hideLoadingOverlay = function() {
            $loadingOverlay.hide();
        }

        this.showLoadingHistory = function() {
            $loadingHistory.show();
        }

        this.hideLoadingHistory = function() {
            $loadingHistory.hide();
        }

        function publishedFromSelf(message) {
            return message.clientId == controller.clientId;
        }

        function messageElem(message) {
            var dateAsLocalTime = Utils.formatDateAsLocalTime(new Date(message.timestamp));
            var $author = $('<span class="author">').text(message.clientId);
            var $time = $('<div class="time">').text(dateAsLocalTime);
            var $message = $('<div class="message">').text(message.data);
            var $back = $('<div class="back">');
            var $li = $('<div class="message-bubble">');

            $back.append($author, $time, $message);
            $li.append($back);

            if (publishedFromSelf(message)) {
                return $li.addClass('sent');
            } else {
                return $li.addClass('received');
            }
        }

        function presenceElem(presence) {
            var actionText, $text, $div;

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

            return $('<div class="message-presence">').append($text);
        }

        function addToMessageList($elem, historicalMessages) {
            if (!$elem) { return; } // ignore empty elements i.e. presence messages we won't display such as updates

            // If near the bottom, then scroll new message into focus automatically
            var shouldScrollAutomatically = $(window).scrollTop() + $(window).height() >= $(document).height() - 100;

            if (historicalMessages) {
                $messageList.prepend($elem);
            } else {
                $messageList.append($elem);
            }

            if (shouldScrollAutomatically) { window.setTimeout(scrollToBottom, 10); }
        }

        function scrollToBottom() {
            $('html, body').scrollTop($(document).height() - $(window).height());
        }

        // Updates the members count in the lozenge and their names in the 'Members' popup dialog
        function updateMembers(members) {
            members = members || [];

            // Typing members are users who have 'isTyping' set to true in their presence data
            var typingMembersNames = members.filter(function (member) {
                return member && member.data && member.data.isTyping;
            }).map(function (member) {
                return member.clientId;
            });
            var text = Utils.formatTypingNotification(typingMembersNames);

            $membersCountLozenge.text(members.length);
            $membersTypingNotification.text(text);

            // Clear the member list and replace it with a list with their names
            $membersList.html('').append(members.map(function (member) {
                var memberName = member.clientId;
                var $li = $('<li><a href="javascript:void(0)">').text(memberName);
                $li.on('click', function () {
                    $messageText.val(leftTrim($messageText.val() + ' @' + memberName + ' '));
                    $membersListPopup.hide();
                    $messageText.focus();
                });

                return $li;
            }));
        }

        // Connection change handler
        // * Disconnected: disable user input and display meaningful message
        // * Connected: reenable input and hide message
        this.onConnectionChange = function(state) {
            if (state.current === 'disconnected' || state.current === 'suspended') {
                $messageFormInputs.prop('disabled', true);
                $connectionInfo.text(state.reason.message);
            } else if (state.current === 'connected') {
                $messageFormInputs.prop('disabled', false);
                $connectionInfo.text('');
            }
        }

        // Receives an Ably message and shows it on the screen
        this.onMessageReceived = function (message) {
            addToMessageList(messageElem(message));
        };

        // Receives an Ably presence message and shows it on the screen
        this.onPresenceReceived = function (presenceMessage, members) {
            addToMessageList(presenceElem(presenceMessage));
            updateMembers(members);
        };

        this.addHistoricalMessages = function (messages) {
            var message, elem;
            for (var i = 0; i < messages.length; i++) {
                message = messages[i]
                if (message.action) {
                    elem = presenceElem(message);
                } else {
                    elem = messageElem(message);
                }
                addToMessageList(elem, true);
            }
        }

        // Generic error handler - alert()s an error, if one exists
        this.onError = function (err) {
            var errorMessage = "Oops, something has gone wrong. We recommend you restart this demo.";
            if (err) {
                if (err.message) {
                    errorMessage += "\n" + err.message;
                } else {
                    errorMessage += "\n" + JSON.stringify(err);
                }
            }
            controller.hideLoadingOverlay();
        };

        // Clears the messages list
        this.resetMessages = function () {
            $messageList.empty();
        };
    }

    window.UiController = UiController;
}(window));
