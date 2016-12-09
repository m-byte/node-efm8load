/*jslint bitwise, for, node, single, this, white*/
var HID = require('node-hid');
var crc16 = require('crc16');

var devices;
var getResponse;
var loadFunc;

var command = {
  Identify: 0x30,
  Setup: 0x31,
  Erase: 0x32,
  Write: 0x33,
  Verify: 0x34,
  Lock: 0x35,
  RunApp: 0x36
};

var response = {
  Ack: new Response(0x40, 'ACK'),
  RangeError: new Response(0x41, 'Range Error'),
  BadId: new Response(0x42, "Bad Id"),
  CrcError: new Response(0x34, "CRC Error"),
  Bootloader10: new Response(0x90, "Bootloader Version 1.0")
};

var id = {
  EFM8UB10F16G_QFN28: [0x32, 0x41],
  EFM8UB10F16G_QFN20: [0x32, 0x43],
  EFM8UB11F16G_QSOP24: [0x32, 0x45],
  EFM8UB10F8G_QFN20: [0x32, 0x49]
};

function Response(value, text) {
  "use strict";
  this.equals = function(obj) {
    if (typeof obj === typeof this) {
      return obj.valueOf() === value;
    }
    return obj === value;
  };
  this.valueOf = function() {
    return value;
  };
  this.toString = function() {
    return text;
  };
};

getResponse = function(value) {
  "use strict";
  Object.keys(response).forEach(function(key) {
    if (response[key].equals(value)) {
      return response[key];
    }
  });
  return new Response(value, 'Bootloader Version (0x' + value.toString(16) + ')');
};

function EFM8Loader() {
  "use strict";
  var path;
  var callback = null;
  if (arguments.length < 1 || !arguments[0].hasOwnProperty('path')) {
    path = devices()[0].path;
  } else {
    path = arguments[0].path;
  }
  this.hid = new HID.HID(path);
  this.callback = null;
  this.hid.on("data", function(data) {
    if (callback !== null) {
      var cb = callback;
      callback = null;
      cb(null, getResponse(data[0]));
    }
  });
  this.writeFrame = function(command, data, cb) {
    if (callback === null) {
      var frame = [0x24, data.length + 1, command];
      frame.push.apply(frame, data);
      callback = cb;
      while (frame.length > 0) {
        this.hid.write(frame.splice(0, 64));
      }
    } else {
      cb(new Error('USB Busy'));
    }
  };
};

EFM8Loader.prototype.close = function() {
  "use strict";
  this.hid.close();
};

EFM8Loader.prototype.bootloaderVersion = function(callback) {
  "use strict";
  this.writeFrame(0x00, [], callback);
};

EFM8Loader.prototype.identify = function(id, callback) {
  "use strict";
  this.writeFrame(command.Identify, id, callback);
};

EFM8Loader.prototype.setup = function(callback) {
  "use strict";
  this.writeFrame(command.Setup, [0xA5, 0xF1, 0x00], callback);
};

EFM8Loader.prototype.erase = function(addr, data, callback) {
  "use strict";
  if (arguments.length < 2) {
    data = [];
  }
  if (data.length > 128) {
    throw new RangeError('Invalid chunksize (' + data.length + '). Chunksize must be < 128');
  }
  var frame = [(addr >> 8) & 0xFF, addr & 0xFF];
  frame.push.apply(frame, data);
  this.writeFrame(command.Erase, frame, callback);
};

EFM8Loader.prototype.write = function(addr, data, callback) {
  "use strict";
  if (data.length > 128) {
    throw new RangeError('Invalid chunksize (' + data.length + '). Chunksize must be < 128');
  }
  var frame = [(addr >> 8) & 0xFF, addr & 0xFF];
  frame.push.apply(frame, data);
  this.writeFrame(command.Write, frame, callback);
};

EFM8Loader.prototype.verify = function(addr, data, callback) {
  "use strict";
  var endaddr = addr + data.length - 1;
  var chcksum = crc16(new Buffer(data));
  var frame = [(addr >> 8) & 0xFF, addr & 0xFF,
    (endaddr >> 8) & 0xFF, endaddr & 0xFF,
    (chcksum >> 8) & 0xFF, chcksum & 0xFF
  ];
  this.writeFrame(command.Verify, frame, callback);
};

EFM8Loader.prototype.lock = function(signature, lock, callback) {
  "use strict";
  if (signature === undefined || !signature) {
    signature = 0xFF;
  }
  if (lock === undefined || !lock) {
    lock = 0xFF;
  }
  this.writeFrame(command.Lock, [signature, lock], callback);
};

EFM8Loader.prototype.runApp = function(callback) {
  "use strict";
  this.writeFrame(command.RunApp, [0, 0], callback);
};

loadFunc = function(device) {
  "use strict";
  return function() {
    new EFM8Loader(device);
  };
};

devices = function() {
  "use strict";
  var devs = HID.devices();
  var efm = [];
  var i;
  var device;
  for (i = 0; i < devs.length; i += 1) {
    device = devs[i];
    if (device.vendorId === 0x10C4) { // SiLabs
      if (device.productId === 0xEAC9 || device.productId === 0xEACA) { // UB1 || UB2
        device.family = device.productId === 0xEAC9 ? "EFM8UB1" : "EFM8UB2";
        device.loader = loadFunc(device);
        efm.push(device);
      }
    }
  }
  return efm;
};

exports.EFM8Loader = EFM8Loader;
exports.devices = devices;
exports.response = response;
exports.id = id;
