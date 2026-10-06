import {Pool,types} from 'pg';
import {runTransaction} from './db/postgres.mjs';
// Keep calendar dates independent of the server timezone.
types.setTypeParser(1082,value=>value);
let pool;
export async function transaction(fn,context={}){
 const connectionString=process.env.DATABASE_URL||process.env.LOCAL_DATABASE_URL;
 if(!connectionString)throw Error('Configure DATABASE_URL (ou LOCAL_DATABASE_URL no desenvolvimento). O armazenamento JSON foi removido.');
 pool ||= new Pool({connectionString,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
 return runTransaction(pool,fn,context);
}
