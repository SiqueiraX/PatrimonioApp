import React,{createContext,useContext,useLayoutEffect,useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
const ThemeContext=createContext(null);
const key='patrimonio-theme';
function preferred(){try{const saved=localStorage.getItem(key);if(saved==='light'||saved==='dark')return saved;}catch{}return window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
export function ThemeProvider({children}){
 const [theme,setTheme]=useState(preferred);
 useLayoutEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;},[theme]);
 useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const sync=()=>setTheme(preferred());const storage=e=>{if(e.key===key||e.key===null)sync();};media.addEventListener('change',sync);window.addEventListener('storage',storage);return()=>{media.removeEventListener('change',sync);window.removeEventListener('storage',storage);};},[]);
 function toggle(){const next=theme==='dark'?'light':'dark';try{localStorage.setItem(key,next);}catch{}setTheme(next);}
 return <ThemeContext.Provider value={{theme,toggle}}>{children}</ThemeContext.Provider>;
}
export default function ThemeToggle({className=''}){const {theme,toggle}=useContext(ThemeContext);const dark=theme==='dark',label=dark?'Ativar modo claro':'Ativar modo escuro';return <button type="button" className={'theme-toggle '+className} onClick={toggle} aria-label={label} aria-pressed={dark} title={label}>{dark?<Sun size={19}/>:<Moon size={19}/>}<span>{dark?'Modo claro':'Modo escuro'}</span></button>;}
