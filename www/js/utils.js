(function (window) {
    "use strict";

    // Avoid `console` errors in browsers that lack a console.
    (function() {
        var method;
        var noop = function () {};
        var methods = [
            'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
            'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
            'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
            'timeline', 'timelineEnd', 'timeStamp', 'trace', 'warn'
        ];
        var length = methods.length;
        var console = (window.console = window.console || {});

        while (length--) {
            method = methods[length];

            // Only stub undefined methods.
            if (!console[method]) {
                console[method] = noop;
            }
        }
    }());

    // Returns a string containing a zero-padded number
    function padZeroes(n) {
        return n < 10 ? '0' + n : n;
    }

    function leftTrim(string) {
        return string.replace(/^\s+/, "");
    }

    // Formats a Date object into a "hours:minutes:seconds" time format.
    function formatDateAsLocalTime(date) {
        var today = new Date(),
            dayMs = 24 * 60 * 60 * 1000,
            yesterday = new Date(today.getTime() - dayMs),
            months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" "),
            datePart = date.getDate() + " " + date.getMonth();

        if (date.getDate() == today.getDate() && date.getMonth() == today.getMonth() && date.getFullYear() == today.getFullYear()) {
            datePart = "today";
        } else if (date.getDate() == yesterday.getDate() && date.getMonth() == yesterday.getMonth() && date.getFullYear() == yesterday.getFullYear()) {
            datePart = "yesterday";
        }
        return padZeroes(datePart + " at " + date.getHours()) + ":" + padZeroes(date.getMinutes()) + ":" + padZeroes(date.getSeconds());
    }

    // Creates a string showing which members are currently typing.
    function formatTypingNotification(typingMembers) {
        // Nobody is actually typing
        if (!typingMembers || typingMembers.length == 0) {
            return '';
        }

        // Single user: "Alice is typing..."
        if (typingMembers.length == 1) {
            return typingMembers[0] + ' is typing...';
        }

        // Three of less: "Alice, Bob and Carol are typing..."
        if (typingMembers.length <= 3) {
            return typingMembers.slice(0, typingMembers.length-1).join(', ') + ' and ' + typingMembers.slice(typingMembers.length-1) + ' are typing...';
        }

        // Four or more: "Alice, Bob, Carol and 3 others are typing..."
        var others = (typingMembers.length - 3);
        return typingMembers.slice(0, 3).join(', ') + ' and ' + others + ' other' + (others > 1 ? 's are' : ' is') + ' typing...';
    }

    function parseQuery(qstr) {
        var query = {};
        var a = qstr.substr(1).split('&');
        for (var i = 0; i < a.length; i++) {
            var b = a[i].split('=');
            query[decodeURIComponent(b[0])] = decodeURIComponent(b[1] || '');
        }
        return query;
    }

    window.Utils = {
        formatDateAsLocalTime: formatDateAsLocalTime,
        formatTypingNotification: formatTypingNotification,
        leftTrim: leftTrim,
        parseQuery: parseQuery
    };
}(window));
