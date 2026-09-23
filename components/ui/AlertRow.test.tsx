import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AlertRow } from './AlertRow';

afterEach(cleanup);

describe('AlertRow', () => {
  it('renders the severity word and glyph beside the drugs and review state', () => {
    render(<AlertRow severity="danger" drugs={['Warfarin', 'Ibuprofen']} reviewStatus="pending_medical_review" lang="en" />);
    expect(screen.getByText('Serious interaction')).toBeInTheDocument();
    expect(screen.getByText('Warfarin + Ibuprofen')).toBeInTheDocument();
    expect(screen.getByText(/still checking/)).toBeInTheDocument();
  });

  it('pending_medical_review is never rendered as resolved', () => {
    const { container } = render(
      <AlertRow severity="danger" drugs={['Warfarin', 'Ibuprofen']} reviewStatus="pending_medical_review" lang="en" />
    );
    expect(container.querySelector('.jr-alert-row--danger')).toBeTruthy();
  });

  it('renders a metaLabel when given (patient/sector line for a reviewer queue)', () => {
    render(
      <AlertRow
        severity="warning"
        drugs={['Levothyroxine', 'Calcium carbonate']}
        reviewStatus="reviewed"
        metaLabel="سارة يوسف العجمي · قطاع عام"
        lang="ar"
      />
    );
    expect(screen.getByText('سارة يوسف العجمي · قطاع عام')).toBeInTheDocument();
  });

  it('lets the consumer override the headline with title', () => {
    render(<AlertRow severity="info" drugs={['Prednisolone']} reviewStatus="auto_cleared" title="Custom headline" lang="en" />);
    expect(screen.getByText('Custom headline')).toBeInTheDocument();
  });

  it('offers exactly one open control when onOpen is set', () => {
    const onOpen = vi.fn();
    render(<AlertRow severity="danger" drugs={['Warfarin', 'Ibuprofen']} reviewStatus="pending_medical_review" onOpen={onOpen} lang="en" />);
    const row = screen.getByRole('button');
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.queryAllByRole('button')).toHaveLength(1);
  });

  it('is read-only when neither href nor onOpen is set', () => {
    render(<AlertRow severity="danger" drugs={['Warfarin', 'Ibuprofen']} reviewStatus="pending_medical_review" lang="en" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

// jsdom loads no CSS, so the stylesheet is read as text (the same approach as tests/unit/bundle-css.test.ts).
const CSS = readFileSync(path.join(import.meta.dirname, 'styles/AlertRow.css'), 'utf8');

// Audit M15 — the brand book: a danger finding is not a stripe and not a coloured side border.
describe('AlertRow — no side stripe (audit M15)', () => {
  it('the row has one hairline border all round, and no inline-start override anywhere', () => {
    expect(CSS).toMatch(/\.jr-alert-row\s*\{[^}]*border:\s*var\(--line\)\s+solid\s+var\(--border\)/);
    expect(CSS).not.toMatch(/border-inline-start/);
    expect(CSS).not.toMatch(/--line-2/);
  });

  it('severity is still carried by the glyph, the word and the word’s colour — never by the border', () => {
    expect(CSS).toMatch(/\.jr-alert-row--danger \.jr-alert-row__severity\s*\{\s*color:\s*var\(--danger\)/);
    render(<AlertRow severity="danger" drugs={['Warfarin', 'Ibuprofen']} reviewStatus="pending_medical_review" lang="en" />);
    expect(screen.getByText('Serious interaction')).toBeInTheDocument();
  });
});
