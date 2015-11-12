(function (window) {
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
