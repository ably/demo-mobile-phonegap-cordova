/*
 * Controller.js is responsible for setting up the View and App classes
 * and brokering all operations between all components of the app
 */
$(document).ready(function () {
    var view = new View(),
        app  = new ChatApp(view);

    // Helpers to access the app from the dev console
    window.ablyApp = app;
    window.ablyView = view;

    Origami.fastclick(document.body);

    var login = function(clientId) {
        view.joinAndAwaitConnect();
        app.initialize(clientId);
    }

    if (window.isRunningOnMobile) {
        // Cordova handlers for app pause and app resume
        // * disconnect when moving to background
        // * connect back to Ably when moving back to the foreground
        document.addEventListener('deviceready', function() {
            document.addEventListener('pause', function() {
                if (app.initialized()) {
                    app.disconnect();
                }
            });

            document.addEventListener('resume', function() {
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
    app.on('connection.statechange', function(state) {
        console.log("Connection state changed:", state);

        if ((state === 'connected') && !document.appHasJoined) {
            document.appHasJoined = true;
            return view.joinSuccessful();
        }

        /* App has not yet initialized, state changes have no interface to updae */
        if (!document.appHasJoined) { return; }

        switch(state) {
            case 'suspended':
            case 'disconnected':
                view.disableInterface("You are disconnected, we'll try and reconnect shortly...");
                break
            case 'closed':
                view.disableInterface('The connection has been closed as a result of a user action');
                break;
            case 'connecting':
                view.disableInterface('You are disconnected, tring to reconnect to Ably now...');
                break;
            case 'connected':
                view.enableInterface();
        }
    });

    app.on('connection.failed', function(state) {
        view.showError("Connecting failed");
    });

    // Joins the channel using the name (clientId) entered by the user
    view.on('login.submit', function(name) {
        if (name === '') {
            return view.showNameValidationError();
        }
        login(name);
    });

    // Sends the message typed by the user and stops the 'user is typing' notification
    view.on('message.send', function(message) {
        if (message.trim() === '') { return; }
        app.publishMessage(message);
        view.resetMessageInput();
        app.sendTypingNotification(false);
    });

    // Sends a 'user is typing' notification, except when completing a message via the Enter key.
    view.on('message.keydown', function(keyCode) {
        app.sendTypingNotification(true);
    });

    // Sends a 'user has stopped typing' notification, after 5 seconds have passed since the last keystroke.
    view.on('message.keyup', _.debounce(function () {
        app.sendTypingNotification(false);
    }, 5000));

    window.onunload = window.onbeforeunload = function () {
        if (app.initialized()) {
            app.disconnect();
        }
    };

    view.appLoaded();

    var queryParams = Utils.parseQuery(document.location.search);
    if (queryParams.autoLogin) {
        login(queryParams.autoLogin);
    }
});
