(function(window) {
    "use strict";

    function UiController($messageList, $loadingOverlay, $loadingMessage) {
        function showMessage(message) {
            var $li = $('<li></li>');
            $li.addClass('chat-message');
            $li.html('[' + new Date(message.timestamp).toISOString() + '] '
                + message.name
                + ': '
                + message.text);
            $messageList.append($li);
        }

        function showPresence(presence) {
            var $li = $('<li></li>');
            $li.addClass('presence-message');
            $li.html(presence.name + ' has ' + presence.action + ' the channel.');
            $messageList.append($li);
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
                }
            },
            onPresence: function (presenceMessage) {
                var actionText;
                if (presenceMessage.action === Ably.Realtime.PresenceMessage.Action.ENTER) {
                    actionText = 'entered';
                }
                if (presenceMessage.action === Ably.Realtime.PresenceMessage.Action.LEAVE) {
                    actionText = 'left';
                }
                showPresence({name: presenceMessage.clientId, action: actionText});
            },

            showLoadingOverlay: function (message) {
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