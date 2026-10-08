import { GOOGLE_REVIEWS_URL, REVIEWS } from "@/content/reviews";

export function ReviewsBlock() {
  return (
    <section className="container-kv py-16" aria-labelledby="reviews-heading">
      <p className="eyebrow">Reviews</p>
      <h2 id="reviews-heading" className="h2 mt-2">
        Hear from people who have stored here
      </h2>
      {REVIEWS.length ? (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {REVIEWS.slice(0, 6).map((r) => (
            <figure key={r.name + r.text.slice(0, 10)} className="card p-6">
              <p className="text-kv-yellow" aria-label={`${r.rating} out of 5 stars`}>
                {"★".repeat(r.rating)}
                <span className="text-kv-line">{"★".repeat(5 - r.rating)}</span>
              </p>
              <blockquote className="mt-3 text-kv-ink">“{r.text}”</blockquote>
              <figcaption className="mt-4 text-sm font-semibold text-kv-navy">
                {r.name} · {r.location}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="card mt-8 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-kv-ink">Choosing a place for your belongings is a personal decision. Find KV Self Storage on Google to explore customer reviews.</p>
          <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer" className="btn-navy">
            Find us on Google
          </a>
        </div>
      )}
    </section>
  );
}
