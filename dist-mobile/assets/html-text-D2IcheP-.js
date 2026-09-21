import{t as e}from"./createLucideIcon-wlqc77si.js";var t=e(`rotate-ccw`,[[`path`,{d:`M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8`,key:`1357e3`}],[`path`,{d:`M3 3v5h5`,key:`1xhq8a`}]]),n={nbsp:` `,amp:`&`,lt:`<`,gt:`>`,quot:`"`,apos:`'`,"#39":`'`,ldquo:`“`,rdquo:`”`,lsquo:`‘`,rsquo:`’`,hellip:`…`,mdash:`—`,ndash:`–`,bull:`•`,middot:`·`,deg:`°`,eacute:`é`};function r(e){return e.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,(e,t)=>{if(t.startsWith(`#x`)||t.startsWith(`#X`)){let n=parseInt(t.slice(2),16);return Number.isFinite(n)?String.fromCodePoint(n):e}if(t.startsWith(`#`)){let n=parseInt(t.slice(1),10);return Number.isFinite(n)?String.fromCodePoint(n):e}return n[t.toLowerCase()]??e})}function i(e){return r(e.replace(/<br\s*\/?>/gi,`
`).replace(/<\/(p|div|li|h[1-6]|tr)>/gi,`
`).replace(/<[^>]+>/g,` `)).replace(/\u00A0/g,` `).replace(/[ \t]+/g,` `).replace(/\s*\n\s*/g,`
`).replace(/\n{3,}/g,`

`).trim()}export{t as n,i as t};