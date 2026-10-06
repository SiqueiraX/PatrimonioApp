import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBrand,publicBrand} from './branding.mjs';
import {DEFAULT_BRAND,foreground,brandVariables} from '../shared/branding.mjs';
import {execute} from './api.mjs';
import {hash} from './domain.mjs';
import {createHash} from 'node:crypto';
test('branding validates colors, bounded name and raster logo',()=>{assert.deepEqual(validateBrand(DEFAULT_BRAND),DEFAULT_BRAND);for(const v of [{name:''},{name:'x'.repeat(81)},{primaryColor:'red'},{accentColor:'#fff'},{logoUrl:'https://tracker.example/image.png'},{logoUrl:'data:image/svg+xml;base64,PHN2Zz4='}])assert.throws(()=>validateBrand({...DEFAULT_BRAND,...v}));assert.equal(validateBrand({...DEFAULT_BRAND,primaryColor:'#ABCDEF'}).primaryColor,'#abcdef');assert.equal(foreground('#ffffff'),'#102a2a');assert.equal(foreground('#000000'),'#ffffff');assert.equal(brandVariables(DEFAULT_BRAND)['--canvas'],'#f5f5f5');assert.equal('password' in publicBrand({name:'X',password:'secret'}),false);});
test('only managers may change branding, no role escalation through request',async()=>{const db={users:[{id:'b',name:'Broker',role:'Corretor',active:true,password:hash('TestPassword123')}],sessions:[{userId:'b',token:createHash('sha256').update('test').digest('hex'),expires:Date.now()+10000}],attempts:[],audit:[]};await assert.rejects(execute(db,{headers:{cookie:'lotea_session=test'}},{setHeader(){}},{action:'branding.save',data:{...DEFAULT_BRAND,role:'Gestor'}}),e=>e.status===403);});
