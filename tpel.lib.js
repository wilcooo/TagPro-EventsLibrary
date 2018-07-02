// ==UserScript==
// @name         TagPro Events Library
// @description  Add listeners to events like caps, kisses etc.
// @author       Ko
// @version      0.1
// @downloadURL  https://github.com/wilcooo/TagPro-EventsLibrary/raw/master/tpel.lib.js
// @supportURL   https://www.reddit.com/message/compose/?to=Wilcooo
// @license      MIT
// ==/UserScript==

// If another instance of TagPro Events Library is running, don't do anything:
if (tagpro.events) return;

tagpro.ready(function() {

    tagpro.socket.on('sound', function(sound) {

        switch (sound.s) {

                // Friendly Grab
            case 'friendlyalert':
                emitEvent('grab', tagpro.playerId);
                break;

                // Enemy Grab
            case 'alert':
                emitEvent('grab', tagpro.playerId);
                break;

                // Friendly Cap
            case 'cheering':
                emitEvent('cap', tagpro.playerId);
                break;

                // Enemy Cap
            case 'sigh':
                emitEvent('cap', tagpro.playerId);
                break;
        }
    });

    tagpro.socket.on('p', function(p) {
    });
});




tagpro.events = {
    on: function(event, callback) {
        if (listeners[event]) listeners[event].push(callback);
        else listeners[event] = [callback];
    }
};

var listeners = {};

function emitEvent(event, data){
    if (listeners[event]) for (let callback in listeners[event]) callback(data);
}
