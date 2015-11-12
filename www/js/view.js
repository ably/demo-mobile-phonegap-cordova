(function (window) {
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
