# [Ably](https://www.ably.io) Phonegap / Cordova / Browser demo

Ably is a hugely scalable, superfast and secure hosted real-time messaging service for web-enabled devices. [Find out more about Ably](https://www.ably.io).

This Phonegap / Cordova demo uses the Ably real-time message service and provides a simple example of how to use the following features:

* Channels and publishing and subscribing to messages
* Presence, entering channels and subscribing to presence events
* Token authentication from a URL

## View demo on a mobile device

* Make sure you have [Cordova Command-Line Interface 5.1.1+](https://cordova.apache.org/docs/en/5.1.1/guide_cli_index.md.html#The%2520Command-Line%2520Interface) installed. Usually done by `npm install -g cordova`.
* Install [cordova-plugin-whitelist](https://github.com/apache/cordova-plugin-whitelist) by running `cordova plugin add cordova-plugin-whitelist` in the root folder of the project.
* [Add](https://cordova.apache.org/docs/en/5.1.1/guide_cli_index.md.html#The%20Command-Line%20Interface_add_platforms) the needed platforms (e.g. Android, iOS): `cordova platforms add android`.
The cordova CLI tool should install the whitelist plugin for the specific platform.
* Run the application on your mobile device: `cordova platforms run android`.
* Use the app.

## Debugging on a mobile device

You can use the [remote debugging feature](https://developer.chrome.com/devtools/docs/remote-debugging) of Chrome.

## View demo in your desktop / mobile browser

[bit.do/ably-demo](http://bit.do/ably-demo)

This [static site demo is hosted on Heroku](http://ably-phonegap-cordova-demo.herokuapp.com/), there is no server-side code to run this demo. If you want to run this app with a local static website server, you can use Grunt `grunt server`.  Make sure you have run `npm install` beforehand.

## View demo locally in your browser

Use the same steps as running on a mobile device, but use `browser` as a platform:

* Make sure you have Cordova CLI installed.
* Add cordova-plugin-whitelist.
* Use `cordova platforms add browser` to add a `browser` platform.
* Run in the browser: `cordova run browser`.

# Local development

In order to make changes to the app, you will need grunt to compile the `SCSS` files into `CSS`.
A grunt task has been set up to spin up a local server and watch for any changes you make, and then build the `CSS` files automatically.
You can run the grunt task as follows:

* `npm install`
* `grunt watch:server`
