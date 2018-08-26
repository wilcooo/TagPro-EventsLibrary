// ==UserScript==
// @name         TagPro Events Library
// @description  Add listeners to events like caps, kisses etc.
// @author       Ko
// @version      1.0
// @downloadURL  https://github.com/wilcooo/TagPro-EventsLibrary/raw/master/tpel.lib.js
// @supportURL   https://www.reddit.com/message/compose/?to=Wilcooo
// @license      MIT
// @include      *.koalabeast.com:*
// ==/UserScript==

/* Events:

capture
grab
drop
pop
return
tag
powerup
powerdown

and more

*/
const FLACCID_DELAY = 30, // Frames
      CAPSIZE_DELAY = 30,
      BARELY_TIME = 180;

/* global tagpro */


// If another instance of TagPro Events Library is running, don't do anything:
if (tagpro.events && tagpro.events.on) return;

// These 'deep' events require more resource-heavy analysis.
var deepEvents = ['nubstep', 'showboat', 'assist', 'lead', 'save', 'bomb-return', 'double-tap', 'noobspike', 'bomb-tag', 'defuse', 'juke', 'split'];

tagpro.ready(function() {

    // Find out whether any flag has been grabbed before in this game
    var never_grabbed = false;//tagpro.players.reduce( (total, player) => total + player['s-grabs'], 0) == 0;

    // Put the exact position and velocity of a player in the player variable. For more precision.
    // (because the lx, ly, rx and ry variables namely aren't updated after the last received packet.)
    var org_getLinearVelocity = Box2D.Dynamics.b2Body.prototype.org_getLinearVelocity = Box2D.Dynamics.b2Body.prototype.GetLinearVelocity;
    Box2D.Dynamics.b2Body.prototype.GetLinearVelocity = function() {
        this.player.elx = this.m_linearVelocity.x;
        this.player.ely = this.m_linearVelocity.y;
        this.player.erx = this.m_xf.position.x;
        this.player.ery = this.m_xf.position.y;
        return this.org_getLinearVelocity();
    };

    var players = [];

    // Using rawSocket to inject our listener *before* the TagPro listener
    // That way, the tagpro.players object still contains the old values
    tagpro.rawSocket.listeners('p').unshift(function(packet) {

        try {

            if (!packet.u) return;

            var grabbers = [],
                returners = [],
                droppers = [],
                taggers = [],
                poppers = [];

            for (let playerUpdate of packet.u) {
                var player = tagpro.players[playerUpdate.id];

                if (!player) continue;

                // BASIC EVENTS

                // Grabs
                if (playerUpdate['s-grabs'] > player['s-grabs']) {
                    grabbers.push(player);
                }

                // Caps, Drops, Pops
                if (playerUpdate['s-captures'] > player['s-captures']) {
                    tagpro.events.emit('capture', {
                        subject:player,
                        barely: tagpro.gameEndsAt - new Date < BARELY_TIME/.06
                    });
                } else if (playerUpdate['s-drops'] > player['s-drops'])
                    droppers.push(player);
                else if (playerUpdate['s-pops'] > player['s-pops'])
                    poppers.push(player);

                // Returns, Tags
                for (var i=0; i < playerUpdate['s-returns'] - player['s-returns']; i++)
                    returners.push(player);
                for (; i < playerUpdate['s-tags'] - player['s-tags']; i++)
                    taggers.push(player);

                //Powerups
                if (playerUpdate.tagpro)// && !player.tagpro)
                    tagpro.events.emit('powerup', {subject:player, power:'tagpro'});

                if (playerUpdate.grip)// && !player.grip)
                    tagpro.events.emit('powerup', {subject:player, power:'juke-juice'});

                if (playerUpdate.bomb)// && !player.bomb)
                    tagpro.events.emit('powerup', {subject:player, power:'rolling-bomb'});

                //Powerdowns
                if (player.tagpro && playerUpdate.tagpro == false)
                    tagpro.events.emit('powerdown', {subject:player, power:'tagpro'});

                if (player.grip && playerUpdate.grip == false)
                    tagpro.events.emit('powerdown', {subject:player, power:'juke-juice'});

                if (player.bomb && playerUpdate.bomb == false)
                    tagpro.events.emit('powerdown', {subject:player, power:'rolling-bomb'});
            }

            // Returns, Takeovers, Kisses and Sacrifices

            returns: for (let returner of returners) {
                for (let d in droppers) if (droppers[d].team != returner.team) {
                    var dropper = droppers[d];

                    // Remove others dropper event
                    droppers.splice(d,1);

                    // The returner could also be grabbing (takeover)
                    var self_grab_id = grabbers.indexOf(returner);

                    // The returner could also be dropping (kiss)
                    var self_drop_id = droppers.indexOf(returner);

                    // The returner could also be popping (sacrifice)
                    var self_pop_id = poppers.indexOf(returner);

                    if (self_grab_id > -1) { // TODO: && (if neutral flag)

                        // Remove own grab event
                        grabbers.splice(self_grab_id, 1);

                        if (packet.time - FLACCID_DELAY < dropper.EL_lastGrab) {
                            tagpro.events.emit('flaccid', {
                                subject: returner,
                                object: dropper,
                                snipe: returner.elx > 2.5 || returner.ely > 2.5,
                                epic: (returner.elx > 2.5 || returner.ely > 2.5) && (dropper.elx > 2.5 || dropper.ely > 2.5),
                            });
                        } else {
                            tagpro.events.emit('takeover', {
                                subject: returner,
                                object: dropper,
                                snipe: returner.elx > 2.5 || returner.ely > 2.5,
                                epic: (returner.elx > 2.5 || returner.ely > 2.5) && (dropper.elx > 2.5 || dropper.ely > 2.5),
                            });
                        }


                    } else if (self_drop_id > -1) {

                        var other_return_id = returners.indexOf(dropper);
                        if (other_return_id > -1) {

                            // Remove the other returner, because we only want one kiss/capsize event.
                            returners.splice( other_return_id, 1);
                            // Remove own drop event
                            droppers.splice( self_drop_id, 1);

                            tagpro.events.emit('kiss:all', {subjects:[ returner, dropper ]});

                            if (packet.time - CAPSIZE_DELAY < returner.EL_lastGrab) {
                                tagpro.events.emit('capsize', {
                                    subject: returner,
                                    object: dropper,
                                    snipe: returner.elx > 2.5 || returner.ely > 2.5,
                                    epic: (returner.elx > 2.5 || returner.ely > 2.5) && (dropper.elx > 2.5 || dropper.ely > 2.5),
                                });

                            } else if (packet.time - CAPSIZE_DELAY < dropper.EL_lastGrab) {
                                tagpro.events.emit('capsize', {
                                    subject: dropper,
                                    object: returner,
                                    snipe: dropper.elx > 2.5 || dropper.ely > 2.5,
                                    epic: (dropper.elx > 2.5 || dropper.ely > 2.5) && (returner.elx > 2.5 || returner.ely > 2.5),
                                });

                            } else {
                                tagpro.events.emit('kiss', {subjects:[
                                    returner,
                                    dropper
                                ], flags: true});
                            }


                        } else {

                            // Because there is no other returner,
                            // this must be a return and a drop (to a spike or other player)
                            // This drop will be handled before or after this, as we don't splice it out.
                            tagpro.events.emit('return', {
                                subject: returner,
                                object: dropper,
                                snipe: returner.elx > 2.5 || returner.ely > 2.5,
                                epic: (returner.elx > 2.5 || returner.ely > 2.5) && (dropper.elx > 2.5 || dropper.ely > 2.5),
                            });

                        }

                    } else if (self_pop_id > -1) {

                        var other_tag_id = taggers.indexOf(dropper);
                        if (other_tag_id > -1) {

                            // Remove the other tagger, because we only want the sacrifice event.
                            taggers.splice( other_tag_id, 1);
                            // Remove own pop event
                            poppers.splice(self_pop_id,1)

                            tagpro.events.emit('sacrifice', {
                                subject: returner,
                                object: dropper,
                                snipe: returner.elx > 2.5 || returner.ely > 2.5,
                                epic: (returner.elx > 2.5 || returner.ely > 2.5) && (dropper.elx > 2.5 || dropper.ely > 2.5),
                            });

                        } else {

                            // Because there is no other tagger,
                            // this must be a return and a pop (to a spike or other player)
                            // This pop will be handled before or after this, as we don't splice it out.
                            tagpro.events.emit('return', {
                                subject: returner,
                                object: dropper,
                                snipe: returner.elx > 2.5 || returner.ely > 2.5,
                                epic: (returner.elx > 2.5 || returner.ely > 2.5) && (dropper.elx > 2.5 || dropper.ely > 2.5),
                            });
                        }

                    } else {
                        tagpro.events.emit('return', {
                            subject: returner,
                            object: dropper,
                            snipe: returner.elx > 2.5 || returner.ely > 2.5,
                            epic: (returner.elx > 2.5 || returner.ely > 2.5) && (dropper.elx > 2.5 || dropper.ely > 2.5),
                        });
                    }

                    continue returns;
                }

                // Somehow we couldn't find a dropper.
                // This should never happen.
                console.error('EL: A return without an object!');
                tagpro.events.emit('return', {
                    subject: returner,
                    object: undefined,
                    snipe: returner.elx > 2.5 || returner.ely > 2.5,
                    epic: undefined
                });
            }

            // The remaining droppers are dropping by themselfes.
            for (let dropper of droppers) {
                tagpro.events.emit('drop', {subject:dropper});
            }

            // The remaining grabbers grab on their own (from a base)
            for (let grabber of grabbers) {
                tagpro.events.emit('grab', {
                    subject: grabber,
                    first: never_grabbed,
                });
                never_grabbed = true;
                grabber.EL_lastGrab = packet.t;
            }

            // Tags:

            tags: for (let tagger of taggers) {
                for (let p in poppers) if (poppers[p].team != tagger.team) {

                    var popper = poppers[p];

                    // Remove others pop event
                    poppers.splice(p,1);

                    // The tagger could also be popping (tagpro's kiss)
                    let self_pop_id = droppers.indexOf(tagger);

                    // In case the other tags too
                    let other_tag_id = taggers.indexOf(popper);

                    if (self_pop_id > -1 && other_tag_id > -1) {

                        // Remove the other returner, because we only want one kiss event.
                        taggers.splice( other_tag_id, 1);
                        // Remove own pop event, since we only want the kiss
                        poppers.splice( self_pop_id, 1);

                        tagpro.events.emit('kiss', {subjects:[
                            tagger,
                            popper
                        ], flags: false});

                    } else {

                        tagpro.events.emit('tag', {
                            subject: tagger,
                            object: popper,
                            snipe: tagger.elx > 2.5 || tagger.ely > 2.5,
                            epic: (tagger.elx > 2.5 || tagger.ely > 2.5) && (popper.elx > 2.5 || popper.ely > 2.5),
                        });
                    }

                    continue tags;
                }
                tagpro.events.emit('tag', {subject:tagger});
            }

            // The remaining poppers pop by themselfes (spike, usually)
            for (let popper of poppers) {
                tagpro.events.emit('pop', {subject:popper});
            }

        } catch (e) { console.error('TagPro Events Library Error!',e) }


    });
});



if (!tagpro.events) tagpro.events = {};

tagpro.events.on = function(event, callback) {

    if (!tagpro.events[event]) tagpro.events[event] = [];

    var eventFunc = {};
    eventFunc[event] = callback;
    tagpro.events[event].push(eventFunc);

    //if (event in deepEvents) enableDeepEvents();
}

tagpro.events.emit = function(event, data) {
    if (tagpro.events[event]) for (let listener of tagpro.events[event]) {
        try { listener[event](data); }
        catch (e) {
            console.error("Unhandled tagpro.events.on('"+event+"') error. Mod makers, handle your errors!");
            console.error(e);
            console.error( listener[event]);
        }
    }
}




