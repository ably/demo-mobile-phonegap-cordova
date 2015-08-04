(function (window) {
    "use strict";

    // Formats a Date object into a "hours:minutes:seconds" time format.
    function formatDateAsLocalTime(date) {
        function padZeroes(n) {
            return n < 10 ? '0' + n : n
        }

        return padZeroes(date.getHours()) + ":" + padZeroes(date.getMinutes()) + ":" + padZeroes(date.getSeconds());
    }

    // Creates a string showing which members are currently typing.
    function formatTypingNotification(typingMembers) {
        // Nobody is actually typing
        if (!typingMembers || typingMembers.length == 0) {
            return '';
        }

        // Single user: "Alice is typing"
        if (typingMembers.length == 1) {
            return typingMembers[0] + ' is typing';
        }

        // More than one: "Alice, Bob, Carol are typing"
        if (typingMembers.length < 4) {
            return typingMembers.join(', ') + ' are typing';
        }

        // "Alice, Bob, Carol and 3 others are typing"
        return typingMembers.join(', ') + ' and ' + (typingMembers.length - 3) + ' others are typing.';
    }

    function UiController() {
        var controller = this;
        var $messageList = $('#message-list');
        var $loadingOverlay = $('#loading-overlay');
        var $loadingMessage = $('#loading-message');
        var $membersCountLozenge = $('#main-app-view').find('.members-count');
        var $membersTypingNotification = $('#members-typing-indication');

        function showMessage(message) {
            var $li = $('<li></li>');
            $li.addClass('chat-message');
            $li.html('[' + formatDateAsLocalTime(new Date(message.timestamp)) + '] '
                + message.name
                + ': '
                + message.text);
            $messageList.append($li);
        }

        function showPresence(presence) {
            var $li = $('<li></li>');
            $li.addClass('presence-message');
            $li.html('[' + formatDateAsLocalTime(new Date(presence.timestamp)) + '] ' + presence.name + ' has ' + presence.action + ' the channel.');
            $messageList.append($li);
        }

        function updateMembers(members) {
            members = members || [];

            // Typing members are those who have 'isTyping' set to true in their presence data.
            var typingMembersNames = members.filter(function (member) {
                return member && member.data && member.data.isTyping;
            }).map(function (member) {
                return member.clientId;
            });
            var text = formatTypingNotification(typingMembersNames);

            $membersCountLozenge.text(members.length);
            $membersTypingNotification.text(text);
        }

        return {
            onMessageReceived: function (message) {
                showMessage({
                    name: message.data.name,
                    text: message.data.text,
                    timestamp: message.timestamp
                });
            },
            onError: function (err) {
                if (err) {
                    if (err.message) {
                        alert(err.message);
                    }
                    else {
                        alert(JSON.stringify(err));
                    }

                    controller.hideLoadingOverlay();
                }
            },
            onPresence: function (presenceMessage, members) {
                var actionText;
                updateMembers(members);

                // Updates like "xxxx is typing" are handled in updateMembers, but not displayed like 'entered' and 'left'
                if (presenceMessage.action === Ably.Realtime.PresenceMessage.Action.UPDATE) {
                    return;
                }

                if (presenceMessage.action === Ably.Realtime.PresenceMessage.Action.ENTER) {
                    actionText = 'entered';
                }

                if (presenceMessage.action === Ably.Realtime.PresenceMessage.Action.LEAVE) {
                    actionText = 'left';
                }

                showPresence({
                    name: presenceMessage.clientId,
                    action: actionText,
                    timestamp: presenceMessage.timestamp
                });
            },

            showLoadingOverlay: function (message) {
                message = message || 'Loading...';
                $loadingOverlay.show();
                if (message) {
                    $loadingMessage.text(message);
                }
            },

            hideLoadingOverlay: function () {
                $loadingOverlay.hide();
                $loadingMessage.text('');
            }
        }
    }

    window.UiController = UiController;
}(window));