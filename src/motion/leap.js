let Instance = null;
let Leap = require('leapjs');
const utils = require('util');
const Emitter = require('events').EventEmitter;


function LeapMotion() {
    if(!Instance) {
        this.master = Leap;
        Instance = this;
    }

    return Instance;
}

utils.inherits(LeapMotion, Emitter);

LeapMotion.prototype.addConfig = function(config) {
    this.config = config;
};

LeapMotion.prototype.listen = function() {
    var self = this;

    self.master.loop(function(frame) {
        self.emit('frameloop', frame);
        if(frame.hands[0]) {
            self.emit('action', frame.hands[0], frame);
        } else {
            self.emit('noaction', frame);
        }
    });

    self.master.loopController.setBackground(true);
};

exports = module.exports = new LeapMotion();
