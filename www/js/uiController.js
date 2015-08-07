(function (window) {
    "use strict";

    function UiController() {
        var controller = this;
        var $messageList = $('#message-list');
        var $loadingOverlay = $('#loading-overlay');
        var $loadingMessage = $('#loading-message');
        var $messageText = $('#message-text');
        var $membersCountLozenge = $('#main-app-view').find('.members-count');
        var $membersTypingNotification = $('#members-typing-indication');
        var $membersList = $('.members-list');
        var $membersListPopup = $('.members-list-popup');

        function showMessage(message) {
            var $li = $('<li></li>');
            $li.addClass('chat-message');
            $li.html('[' + Utils.formatDateAsLocalTime(new Date(message.timestamp)) + '] '
                + message.name
                + ': '
                + message.text);
            $messageList.append($li);
        }

        function showPresence(presence) {
            var $li = $('<li></li>');
            $li.addClass('presence-message');
            $li.html('[' + Utils.formatDateAsLocalTime(new Date(presence.timestamp)) + '] ' + presence.name + ' has ' + presence.action + ' the channel.');
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
            var text = Utils.formatTypingNotification(typingMembersNames);

            $membersCountLozenge.text(members.length);
            $membersTypingNotification.text(text);

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