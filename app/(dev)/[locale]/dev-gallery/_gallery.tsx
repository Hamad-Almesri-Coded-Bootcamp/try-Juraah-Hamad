/**
 * Shared gallery scaffolding (lead-owned). Each WP2 group renders its components inside <Section>s and
 * <Example>s on its own page under ./a ./b ./c ./d. Dev-only: literal strings are allowed here.
 */
export function GalleryPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-5)', maxInlineSize: 'var(--content-max)', marginInline: 'auto' }}>
      <h1 className="type-h1">{title}</h1>
      {children}
    </main>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section data-gallery-section={title} style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <h2 className="type-h2">{title}</h2>
      {children}
    </section>
  );
}

/** One labelled state. `caption` says what the state proves — like a wireframe state-set panel. */
export function Example({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div data-gallery-example={caption} style={{ display: 'grid', gap: 'var(--space-2)' }}>
      <p className="type-caption" style={{ color: 'var(--ink-muted)' }}>{caption}</p>
      <div style={{ background: 'var(--surface-app)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: 'var(--line) solid var(--border)' }}>{children}</div>
    </div>
  );
}
