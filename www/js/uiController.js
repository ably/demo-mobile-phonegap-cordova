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
        var $messageFormInputs = $('#message-form :input');
        var $connectionInfo = $('#connection-info');
        var $messageText = $('#message-text');
        var $membersCountLozenge = $('#main-app-view').find('.members-count');
        var $membersTypingNotification = $('#members-typing-indication');
        var $membersList = $('.members-list');
        var $membersListPopup = $('.members-list-popup');

        function showLoadingOverlay(message) {
            message = message || 'Loading...';
            $loadingOverlay.show();
            if (message) {
                $loadingMessage.text(message);
            }
        }

        function hideLoadingOverlay() {
            $loadingOverlay.hide();
            $loadingMessage.text('');
        }

        // Creates a message bubble and displays it after the last bubble
        function showMessage(message) {
            var dateAsLocalTime = Utils.formatDateAsLocalTime(new Date(message.timestamp));
            var $author = $('<span class="author">' + message.name + '</span>');
            var $time = $('<div class="time">' + dateAsLocalTime + '</div>');
            var $message = $('<div class="message">' + message.text + '</div>');
            var $back = $('<div class="back"></div>');
            $back.append($author, $time, $message);

            var $li = $('<div class="message-bubble"></div>');
            $li.append($back);

            // Distinguish between own messages and received from somebody else
            if (message.isReceived) {
                $li.addClass('received');
            }
            else {
                $li.addClass('send');
            }

            $messageList.append($li);
        }

        // Displays a presence notification - e.g. 'user has entered/left the channel'
        function showPresence(presence) {
            var $text = $('<span class="text"></span>');
            var $div = $('<div class="message-presence"></div>');
            $text.html(presence.name + ' has ' + presence.action + ' the channel');

            $div.append($text);
            $messageList.append($div);
        }

        // Updates the members count in the lozenge and their names in the 'Members' popup dialog
        function updateMembers(members, userClientId) {
            members = members || [];

            // Typing members are users (except the current one) who have 'isTyping' set to true in their presence data.
            var typingMembers = members.filter(function (member) {
                return member &&
                    member.data &&
                    member.data.isTyping &&
                    member.clientId !== userClientId;
            });
            var typingMembersNames = typingMembers.map(function (member) {
                return member.clientId;
            });
            var text = Utils.formatTypingNotification(typingMembersNames);

            $membersCountLozenge.text(members.length);
            $membersTypingNotification.text(text);

            // Clear the member list and replace it with a list with their names
            $membersList.html('').append(members.map(function (m) {
                var memberName = m.clientId;
                var $li = $('<li><a href="javascript:void(0)">' + memberName + '</a></li>');
                $li.on('click', function () {
                    $messageText.val($messageText.val() + '@' + memberName + ' ');
                    $membersListPopup.hide();
                    $messageText.focus();
                });

                return $li;
            }));
        }

        // Connection change handler
        // * Disconnected: disable user input and display meaningful message
        // * Connected: reenable input and hide message
        function onConnectionChange(state) {
            if (state.current === 'disconnected' || state.current === 'suspended') {
                $messageFormInputs.prop('disabled', true);
                $connectionInfo.text(state.reason.message);
            }
            else if (state.current === 'connected') {
                $messageFormInputs.prop('disabled', false);
                $connectionInfo.text('');

                // hide overlay in case the app was resumed and has been connecting
                hideLoadingOverlay();
            }
        }

        // Receives an Ably message and shows it on the screen
        this.onMessageReceived = function (message, isReceived) {
            showMessage({
                name: message.data.name,
                text: message.data.text,
                timestamp: message.timestamp,
                isReceived: isReceived
            });
        };

        // Generic error handler - alert()s an error, if one exists
        this.onError = function (err) {
            if (err) {
                if (err.message) {
                    alert(err.message);
                }
                else {
                    alert(JSON.stringify(err));
                }

                controller.hideLoadingOverlay();
            }
        };

        // Receives an Ably presence message and shows it on the screen
        this.onPresence = function (presenceMessage, members, userClientId) {
            var actionText;
            updateMembers(members, userClientId);

            if (presenceMessage.action === Ably.Realtime.PresenceMessage.Action.ENTER) {
                actionText = 'entered';
            }

            if (presenceMessage.action === Ably.Realtime.PresenceMessage.Action.LEAVE) {
                actionText = 'left';
            }

            // update and sync events are not shown in the interface
            if (actionText) {
                showPresence({
                    name: presenceMessage.clientId,
                    action: actionText,
                    timestamp: presenceMessage.timestamp
                });
            }
        };

        // Clears the messages list
        this.resetMessages = function () {
            $messageList.empty();
        };

        this.onConnectionChange = onConnectionChange;
        this.showLoadingOverlay = showLoadingOverlay;
        this.hideLoadingOverlay = hideLoadingOverlay;
    }

    window.UiController = UiController;
}(window));