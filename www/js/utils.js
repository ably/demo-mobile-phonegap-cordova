(function (window) {
    "use strict";

    // Returns a string containing a zero-padded number
    function padZeroes(n) {
        return n < 10 ? '0' + n : n;
    }

    function leftTrim(string) {
        return string.replace(/^\s+/, "");
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

    window.Utils = {
        formatDateAsLocalTime: formatDateAsLocalTime,
        formatTypingNotification: formatTypingNotification,
        leftTrim: leftTrim
    };
}(window));
