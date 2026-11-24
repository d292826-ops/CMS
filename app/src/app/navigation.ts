export interface UnsavedWork {allows(to:string):boolean;discard():void}
const work=new Map<symbol,UnsavedWork>();
export function registerUnsavedWork(value:UnsavedWork){const key=Symbol();work.set(key,value);return()=>{work.delete(key);};}
export function getUnsavedWork(to:string):UnsavedWork[]{return [...work.values()].filter(w=>!w.allows(to));}
let guard:((to:string,proceed:()=>void)=>void)|null=null;
export function installNavigationGuard(value:(to:string,proceed:()=>void)=>void){guard=value;return()=>{if(guard===value)guard=null;};}
export function requestNavigation(to:string,proceed:()=>void){if(guard)guard(to,proceed);else proceed();}
export function safeInternalPath(value:string|null,fallback='/'):string{return value?.startsWith('/')&&!value.startsWith('//')&&!/[\r\n]/.test(value)?value:fallback;}
export function decodeId(value:string):string {try{return decodeURIComponent(value);}catch{return '';}}
