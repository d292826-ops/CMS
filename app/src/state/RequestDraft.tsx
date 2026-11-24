import {createContext,useContext,useState,useEffect,useRef} from 'react';import type {ReactNode,Dispatch,SetStateAction} from 'react';import {registerUnsavedWork,getUnsavedWork} from '../app/navigation.ts';import {useDemo} from './DemoProvider.tsx';import {validateRequestFields} from '../domain/requests.ts';
export interface RequestDraft {ownerId:string|null;vehicle:string;item:string;quantity:string;comment:string;attemptId:string}
export const emptyRequestDraft=():RequestDraft=>({ownerId:null,vehicle:'',item:'',quantity:'',comment:'',attemptId:crypto.randomUUID()});
const Context=createContext<{draft:RequestDraft;setDraft(v:RequestDraft):void;errors:Record<string,string>;setErrors:Dispatch<SetStateAction<Record<string,string>>>;clear():void;dirty:boolean}|null>(null);
export function RequestDraftProvider({children}:{children:ReactNode}){
 const {state}=useDemo();const participant=state?.selected_user_id??null;const previousParticipant=useRef(participant);
 const [draft,updateDraft]=useState(emptyRequestDraft);const [errors,setErrors]=useState<Record<string,string>>({});const release=useRef<null|(()=>void)>(null);const dirty=!!(draft.vehicle||draft.item||draft.quantity||draft.comment);
 const setDraft=(next:RequestDraft)=>{const owned={...next,ownerId:draft.ownerId??participant};updateDraft(owned);if(state){const invalid=validateRequestFields(state,owned);setErrors(old=>Object.fromEntries(Object.keys(old).filter(field=>invalid[field]).map(field=>[field,invalid[field]])));}};
 const clear=()=>{release.current?.();release.current=null;updateDraft(emptyRequestDraft());setErrors({});};
 useEffect(()=>{if(previousParticipant.current!==participant){if(draft.ownerId||dirty||Object.keys(errors).length)clear();previousParticipant.current=participant;}},[participant]);
 useEffect(()=>{if(dirty)release.current=registerUnsavedWork({allows:to=>to.startsWith('/requests/new')||to.startsWith('/catalog?select=request'),discard:clear});return()=>{release.current?.();release.current=null;};},[dirty]);
 useEffect(()=>{const before=(e:BeforeUnloadEvent)=>{if(getUnsavedWork('reload').length){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',before);return()=>window.removeEventListener('beforeunload',before);},[]);
 return <Context.Provider value={{draft,setDraft,errors,setErrors,clear,dirty}}>{children}</Context.Provider>;
}
export function useRequestDraft(){const value=useContext(Context);if(!value)throw Error('DRAFT_PROVIDER_MISSING');return value;}
