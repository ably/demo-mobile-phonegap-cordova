/* Controller sets up the view and app  */

$(document).ready(function () {
    Origami.fastclick(document.body);

    var $mainAppView = $('#main-app-view'),
        $messageText = $('#message-text'),
        $nameForm = $('#name-form'),
        $joinButton = $nameForm.find('a.form-button'),
        $messageForm = $('#message-form'),
        $membersLozenge = $mainAppView.find('#members-lozenge'),
        $membersListPopup = $('#members-list-popup'),
        $dialogCloseButton = $('#dialog-close');

    var view = new View(),
        app = new ChatApp(view),
        started = false;

    // Helper to access the app from the dev console
    window.app = app;

    if (window.isRunningOnMobile) {
        // Cordova handlers for app pause and app resume
        // * disconnect when moving to background
        // * connect back to Ably when moving back to the foreground
        document.addEventListener('deviceready', function() {
            document.addEventListener('pause', function () {
                if (app.initialized()) {
                    app.disconnect();
                }
            });

            document.addEventListener('resume', function () {
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
    app.bind('connection.statechange', function(state) {
        console.log("Connection state change", state);

        if (state === 'disconnected' || state === 'suspended') {
            view.disableInterface("Reconnecting....");
        } else if (state === 'closed') {
            view.disableInterface('Connection is closed as a result of a user interaction');
        } else if (state === 'connecting') {
            view.disableInterface('Connecting to Ably...');
        } else if (state === 'connected') {
            if (!started) {
                started = true;
                view.joinSuccessful();
            } else {
                view.enableInterface();
            }
        }
    });

    app.bind('connection.failed', function(state) {
        view.showError("Connecting failed");
    });

    // Joins the channel using the name (clientId) entered by the user
    $nameForm.on('submit', function (ev) {
        ev.preventDefault();

        if (view.nameVal() === '') {
            return view.showNameValidationError();
        }

        view.joinAndAwaitConnect();
        app.initialize(view.nameVal());
    });

    $joinButton.on('click', function() {
        $nameForm.submit();
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
        if (app.initialized()) {
            app.disconnect();
        }
    };

    view.appLoaded();
});
