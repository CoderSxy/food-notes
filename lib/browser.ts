export async function requestJson<T>(url:string,init?:RequestInit):Promise<T> {
 const response=await fetch(url,init);
 const data=await response.json();
 if(!response.ok){if(response.status===401 && window.location.pathname!=='/login') window.location.assign('/login');throw new Error(data.error || '请求失败，请重试');}
 return data as T;
}
export function jsonBody(value:unknown):RequestInit {return {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)};}
