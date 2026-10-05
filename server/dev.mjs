import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import handler from './api.mjs';
const production=process.argv.includes('--production');
const vite=production?null:await (await import('vite')).createServer({server:{middlewareMode:true},appType:'spa'});
const server=http.createServer(async(req,res)=>{if(req.url.split('?')[0]==='/api/index')return handler(req,res);if(vite)return vite.middlewares(req,res);try{let file=path.join(process.cwd(),'dist',decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(path.join(process.cwd(),'dist')+path.sep))file=path.join(process.cwd(),'dist/index.html');let data;try{data=await fs.readFile(file);}catch{file=path.join(process.cwd(),'dist/index.html');data=await fs.readFile(file);}res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);}catch{res.statusCode=500;res.end('Execute npm run build primeiro.');}});
server.listen(process.env.PORT||4173,'127.0.0.1',()=>console.log('Lotea: http://127.0.0.1:'+(process.env.PORT||4173)));
