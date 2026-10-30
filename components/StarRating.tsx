'use client';
import RatingStars from './RatingStars';

export default function StarRating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <fieldset>
    <legend>评分 · {value} 分</legend>
    <div className="stars"><RatingStars value={value}/></div>
    <input type="range" min={1} max={5} step={0.5} value={value}
      aria-label="评分" aria-valuetext={`${value} 分`}
      onChange={event => onChange(Number(event.target.value))}/>
  </fieldset>;
}
