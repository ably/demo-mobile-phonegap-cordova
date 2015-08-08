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
            var dateAsLocalTime = Utils.formatDateAsLocalTime(new Date(message.timestamp));
            var $author = $('<span class="author">' + message.name + '</span>');
            var $time = $('<div class="time">' + dateAsLocalTime + '</div>');
            var $message = $('<div class="message">' + message.text + '</div>');
            var $back = $('<div class="back"></div>');
            $back.append($author, $time, $message);

            var $li = $('<div class="message-bubble"></div>');
            $li.append($back);

            if (message.isReceived) {
                $li.addClass('received');
            }
            else {
                $li.addClass('send');
            }

            $messageList.append($li);
        }

        function showPresence(presence) {
            var $text = $('<span class="text"></span>');
            var $div = $('<div class="message-presence"></div>');
            $text.html(presence.name + ' has ' + presence.action + ' the channel');

            $div.append($text);
            $messageList.append($div);
        }

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
            onMessageReceived: function (message, isReceived) {
                showMessage({
                    name: message.data.name,
                    text: message.data.text,
                    timestamp: message.timestamp,
                    isReceived: isReceived
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
            onPresence: function (presenceMessage, members, userClientId) {
                var actionText;
                updateMembers(members, userClientId);

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