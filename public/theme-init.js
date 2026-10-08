// Apply the stored preference before the app paints; storage may be unavailable.
(()=>{let theme;try{theme=localStorage.getItem('patrimonio-theme');}catch{}if(theme!=='dark'&&theme!=='light')theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;})();
