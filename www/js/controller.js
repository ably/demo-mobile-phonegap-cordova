/* Controller sets up the view and app  */

$(document).ready(function () {
    Origami.fastclick(document.body);

    var $mainAppView = $('#main-app-view'),
        $enterNameView = $('#enter-name-view'),
        $messageText = $('#message-text'),
        $name = $('#name'),
        $nameForm = $('#name-form'),
        $messageForm = $('#message-form'),
        $membersLozenge = $mainAppView.find('#members-lozenge'),
        $membersListPopup = $('#members-list-popup'),
        $dialogCloseButton = $('#dialog-close');

    var view = new View(),
        app = new ChatApp(view);

    // Helper to access the app from the dev console
    window.app = app;

    if (window.isRunningOnMobile) {
        // Cordova handlers for app pause and app resume
        // * disconnect when moving to background
        // * connect back to Ably when moving back to the foreground
        document.addEventListener('deviceready', function() {
            document.addEventListener('pause', function () {
                app.disconnect();
            });

            document.addEventListener('resume', function () {
                app.reconnect();
            });
        });
    }

    // Joins the channel using the name (clientId) entered by the user
    $nameForm.on('submit', function (ev) {
        ev.preventDefault();

        if ($name.val() === '') {
            $name.attr('placeholder', 'Name is required').addClass('validation-error');
            return;
        }

        $enterNameView.hide();
        $mainAppView.show();

        view.showLoadingOverlay('Connecting to Ably...');
        app.initialize($name.val());
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
        app.disconnect();
    };
});
