/** Small, safe inline formatting shared by the PDF and portal. No HTML is interpreted. */
export function formattedRuns(value:string):{text:string;bold:boolean;italic:boolean}[]{
 const result:{text:string;bold:boolean;italic:boolean}[]=[];
 const pattern=/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g;
 let offset=0;
 for(const match of value.matchAll(pattern)){
  if(match.index!>offset)result.push({text:value.slice(offset,match.index),bold:false,italic:false});
  const token=match[0],n=token.startsWith('***')?3:token.startsWith('**')?2:1;
  result.push({text:token.slice(n,-n),bold:n>=2,italic:n===1||n===3});offset=match.index!+token.length;
 }
 if(offset<value.length)result.push({text:value.slice(offset),bold:false,italic:false});
 return result;
}
/** Avoid cutting a formatting span across manual continuation pages. */
export function formattedChunks(value:string,max=1400):string[]{
 const tokens=value.match(/\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|\S+\s*|\s+/g)||[];
 const pages:string[]=[];let current='';
 for(const token of tokens){if(current&&current.length+token.length>max){pages.push(current);current='';}current+=token;}
 if(current)pages.push(current);return pages.length?pages:[''];
}
