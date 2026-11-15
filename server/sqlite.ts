import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
// Node's maintained SQLite binding avoids a native compiler installation on Windows.
// Transactions are synchronous; no network/model work runs while holding a lock.
export class SQLite {
  private db:DatabaseSync;
  constructor(path:string){this.db=new DatabaseSync(path);}
  exec(sql:string){this.db.exec(sql);}
  pragma(sql:string){this.db.exec('PRAGMA '+sql);}
  prepare(sql:string){
    const statement=this.db.prepare(sql);
    return {run:(...args:SQLInputValue[])=>statement.run(...args),get:(...args:SQLInputValue[])=>{const row=statement.get(...args);return row?{...row}:undefined;},all:(...args:SQLInputValue[])=>statement.all(...args).map(row=>({...row}))};
  }
  transaction<T>(fn:()=>T){
    const run=(immediate:boolean)=>{
      this.db.exec(immediate?'BEGIN IMMEDIATE':'BEGIN');
      try{const result=fn();this.db.exec('COMMIT');return result;}
      catch(error){this.db.exec('ROLLBACK');throw error;}
    };
    const deferred=()=>run(false);deferred.immediate=()=>run(true);return deferred;
  }
  close(){this.db.close();}
}
