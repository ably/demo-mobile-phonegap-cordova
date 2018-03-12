# [Ably](https://www.ably.io) Phonegap / Cordova / Browser demo

Ably is a hugely scalable, superfast and secure hosted real-time messaging service for web-enabled devices. [Find out more about Ably](https://www.ably.io).

This Phonegap / Cordova demo uses the Ably real-time message service and provides a simple example of how to use the following features:

* [Channels and publishing and subscribing to messages](https://www.ably.io/documentation/realtime/channels-messages)
* [Presence, entering channels and subscribing to presence events](https://www.ably.io/documentation/realtime/presence)
* [Token authentication from a URL](https://www.ably.io/documentation/general/authentication)
* [Message and presence history](https://www.ably.io/documentation/realtime/history)

Want to try this demo now? Deploy to Heroku for free:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

_If you are deploying to Heroku, then your app by default will not have history enabled which means all chat data is lost after 2 minutes. See [enabling history below](#enabling-history)._

## View demo on a mobile device

* Run `npm install`. This will install the dependencies and the [Cordova Command-Line Interface](https://cordova.apache.org/docs/en/5.1.1/guide_cli_index.md.html#The%2520Command-Line%2520Interface).
* Install [cordova-plugin-whitelist](https://github.com/apache/cordova-plugin-whitelist) by running `./node_modules/.bin/cordova plugin add cordova-plugin-whitelist` in the root folder of the project.
* [Add](https://cordova.apache.org/docs/en/5.1.1/guide_cli_index.md.html#The%20Command-Line%20Interface_add_platforms) the needed platforms (e.g. Android, iOS): `./node_modules/.bin/cordova platforms add android`.
The cordova CLI tool should install the whitelist plugin for the specific platform.
* Run the application on your mobile device: `./node_modules/.bin/cordova platforms run android`
* Use the app.

## Debugging on a mobile device

You can use the remote debugging feature of [Chrome](https://developer.chrome.com/devtools/docs/remote-debugging), or [Safari](https://developer.apple.com/safari/tools/).

## View demo in your desktop / mobile browser

Deploy to Heroku for free:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

_If you are deploying to Heroku, then your app by default will not have history enabled which means all chat data is lost after 2 minutes. See [enabling history below](#enabling-history)._

OR access our demo app running on Heroku at:

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

## Enabling history

If your app is running on Heroku, or you have run the [Express server](./server.js) with an `ABLY_API_KEY` environment variable, then it is likely that history is not yet enabled for your application. As such, all message and presence history will be discarded by Ably after 2 minutes.

The app publishes, subscribes and registers presence on a channel named `mobile:chat`. To enable history on this channel, please see our support article [how do I enable history](https://support.ably.io/solution/articles/3000058707-how-do-i-enable-history-my-messages-are-not-being-stored-for-longer-than-a-few-minutes-).

## Configurable options via query string params

The following query string params can be appended to the app URL to change the default configuration of the demo:

* `autoLogin`: do not prompt the user for a username and log the user in automatically
* `logLevel`: configure the Ably Realtime log level: 0 is lowest, 5 is most verbose
* `key`: use this API key instead of the default end point for generating a token
* `environment`: defaults to `production`, but can be configured as `sandbox` for example
