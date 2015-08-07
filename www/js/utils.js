(function (window) {
    "use strict";

    function padZeroes(n) {
        return n < 10 ? '0' + n : n;
    }

    // Formats a Date object into a "hours:minutes:seconds" time format.
    function formatDateAsLocalTime(date) {
        return padZeroes(date.getHours()) + ":" + padZeroes(date.getMinutes()) + ":" + padZeroes(date.getSeconds());
    }

    // Creates a string showing which members are currently typing.
    function formatTypingNotification(typingMembers) {
        // Nobody is actually typing
        if (!typingMembers || typingMembers.length == 0) {
            return '';
        }

        // Single user: "Alice is typing"
        if (typingMembers.length == 1) {
            return typingMembers[0] + ' is typing';
        }

        // More than one: "Alice, Bob, Carol are typing"
        if (typingMembers.length < 4) {
            return typingMembers.join(', ') + ' are typing';
        }

        // "Alice, Bob, Carol and 3 others are typing"
        return typingMembers.join(', ') + ' and ' + (typingMembers.length - 3) + ' others are typing.';
    }

    window.Utils = {
        formatDateAsLocalTime: formatDateAsLocalTime,
        formatTypingNotification: formatTypingNotification
    };
}(window));