'use client';
import { useState } from 'react';
export type LocationValue={lat:string;lng:string};
export default function LocationField({value,onChange,required=true}:{value:LocationValue;onChange:(value:LocationValue)=>void;required?:boolean}) {
 const [message,setMessage]=useState('可获取当前位置，也可手动输入经纬度。'),[busy,setBusy]=useState(false);
 function locate(){
  if(!navigator.geolocation){setMessage('浏览器不支持定位，请手动输入经纬度');return;}
  setBusy(true);
  navigator.geolocation.getCurrentPosition(position=>{onChange({lat:String(position.coords.latitude),lng:String(position.coords.longitude)});setMessage('已获取当前位置，请确认是否为记录所在地');setBusy(false);},()=>{setMessage('无法获取定位，请手动输入大致经纬度');setBusy(false);},{enableHighAccuracy:true,timeout:10000});
 }
 return <fieldset><legend>地点{required?'（必填）':'（选填）'}</legend><button type="button" className="secondary" disabled={busy} onClick={locate}>{busy?'正在定位…':'获取当前位置'}</button><p className="muted" role="status">{message}</p><div className="row"><div><label htmlFor="lat">纬度（-90 至 90）</label><input id="lat" type="number" step="any" min="-90" max="90" required={required} value={value.lat} onChange={e=>onChange({...value,lat:e.target.value})}/></div><div><label htmlFor="lng">经度（-180 至 180）</label><input id="lng" type="number" step="any" min="-180" max="180" required={required} value={value.lng} onChange={e=>onChange({...value,lng:e.target.value})}/></div></div></fieldset>;
}
