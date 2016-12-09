# node-efm8load

## Installation
```
npm install efm8load --save
```

## How to Use

### Load the module
```
var efm8load = require('efm8load');
```

### Get a list of all EFM8 USB devices in bootloader mode
```
var devices = efm8load.devices();
```

`devices` will contain an array of objects, one for each EFM8 device available.
Most important are `family`, the device family as identified by the `productId`,
and `loader`, a function that returns an `EFM8Loader` instance for the device.

Here is some sample output:
```
[ { vendorId: 4292,
    productId: 60105,
    path: '0002:0023:00',
    release: 256,
    interface: 0,
    family: 'EFM8UB1',
    loader: [Function] } ]
```

### Open a device
A device can be opened either by calling the `loader` function from the device list
or by creating an `EFM8Loader`:
```
var loader = new efm8load.EFM8Loader(device);
```
If no `device` is given, the first EFM8 USB device is opened.

### EFM8Loader
The `EFM8Loader` gives you access to all bootloader functions [documented by SiLabs](https://www.silabs.com/Support%20Documents/TechnicalDocs/AN945.pdf):

- `bootloaderVersion(callback)`
- `identify(id, callback)`
- `setup(callback)`
- `erase(addr, data, callback)`
- `write(addr, data, callback)`
- `verify(addr, data, callback)`
- `lock(signature, lock, callback)`
- `runApp(callback)`

> The function provided as `callback` is always called with the arguments `error, response`.
>
> Possible values of `id` can be found in `efm8load.id`, e.g. `efm8load.id.EFM8UB10F8G_QFN20`.
>
> `data` should be an array of bytes. 

### Full example
Here is a exmple of how to determine the type of EFM8UB1:
```
var efm8load = require('efm8load');
var async = require('async');

// Open the first EFM8
var loader = new EFM8Loader();
// Find the first matching id
async.detectSeries(efm8load.id, function(id, cb){
  loader.identify(id, function(err, response){
    cb(null, !err && response.equals(efm8load.response.Ack));
  });
}, function(err, result){
  // determine the key of result
  for(var key in efm8load.id){
    if(efm8load.id[key] === result){
      // log the device id
      console.log(key + ' (0x' + result[0].toString(16) + ', 0x' + result[1].toString(16) + ')');
    }
  }
  // close the device
  loader.close();
});
```
