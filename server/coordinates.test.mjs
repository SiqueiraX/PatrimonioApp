import test from 'node:test';
import assert from 'node:assert/strict';
import {coordinates,hasCoordinates} from '../shared/coordinates.mjs';
test('coordinates are paired, nullable, finite and bounded for map projection',()=>{assert.deepEqual(coordinates({}),{latitude:null,longitude:null});assert.deepEqual(coordinates({latitude:'-11,8642',longitude:'-55.5031'}),{latitude:-11.8642,longitude:-55.5031});assert.ok(hasCoordinates({latitude:0,longitude:0}));for(const v of [{latitude:1},{latitude:' ',longitude:1},{latitude:91,longitude:0},{latitude:0,longitude:181},{latitude:Infinity,longitude:0},{latitude:'abc',longitude:0},{latitude:true,longitude:1}]){assert.throws(()=>coordinates(v));assert.equal(hasCoordinates(v),false);}});
