export default function RatingStars({ value }: { value: number }) {
  return <span className="rating-stars" aria-hidden="true">
    {[1, 2, 3, 4, 5].map(star => <span className="rating-star" key={star}>
      ☆<span className="rating-star-fill" style={{ width: `${Math.min(1, Math.max(0, value - star + 1)) * 100}%` }}>★</span>
    </span>)}
  </span>;
}
