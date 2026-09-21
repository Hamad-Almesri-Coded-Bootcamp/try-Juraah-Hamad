Dev-only surfaces (the components gallery at `/[locale]/dev-gallery`, WP2). Excluded from guards 2
and 7 and from production: every page here returns `notFound()` when `NODE_ENV === 'production'`.
