import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InteractionAlert } from './InteractionAlert';

// @testing-library/react's auto-cleanup relies on a global `afterEach`, which this project's
// vitest.config.ts does not register (globals: false) — so every test file that renders more than
// once registers its own, explicitly.
afterEach(cleanup);

describe('InteractionAlert', () => {
  it('renders the danger variant with a heading, severity word and no dismiss control', () => {
    render(
      <InteractionAlert
        severity="danger"
        reviewStatus="pending_medical_review"
        title="Warfarin × Ibuprofen"
        description="Together these raise bleeding risk."
        drugs={['Warfarin (Marevan)', 'Ibuprofen (Brufen)']}
        titleId="ia-1"
        lang="en"
      />
    );
    const region = screen.getByRole('region');
    expect(region).toHaveClass('wsf-alert--danger');
    expect(region).toHaveAccessibleName('Warfarin × Ibuprofen');
    expect(screen.getByRole('heading', { level: 2, name: 'Warfarin × Ibuprofen' })).toBeInTheDocument();
    expect(screen.getByText('Warfarin (Marevan)')).toBeInTheDocument();
    // G1 / the do-not-dismiss rule: no button anywhere renders unless the caller supplies `actions`.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/dismiss/i)).not.toBeInTheDocument();
  });

  it('never renders a dismiss control at severity=danger + reviewStatus=pending_medical_review, even with actions supplied', () => {
    render(
      <InteractionAlert
        severity="danger"
        reviewStatus="pending_medical_review"
        title="Warfarin × Ibuprofen"
        titleId="ia-2"
        lang="en"
        actions={
          <button type="button" className="wsf-btn wsf-btn--secondary">
            Open details
          </button>
        }
      />
    );
    expect(screen.getByRole('button', { name: 'Open details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dismiss|close/i })).not.toBeInTheDocument();
  });

  it('renders warning and info severities at lower visual weight, distinct review sentences', () => {
    const { rerender } = render(
      <InteractionAlert severity="warning" reviewStatus="reviewed" title="Levothyroxine × Calcium" lang="en" titleId="w" />
    );
    expect(screen.getByRole('region')).toHaveClass('wsf-alert--warning');
    expect(screen.getByText('Checked by a medical reviewer.')).toBeInTheDocument();

    rerender(<InteractionAlert severity="info" reviewStatus="auto_cleared" title="Prednisolone" lang="en" titleId="i" />);
    expect(screen.getByRole('region')).toHaveClass('wsf-alert--info');
    expect(screen.getByText('Screened automatically. No interaction found.')).toBeInTheDocument();
  });

  it('overrides the built-in severity and review words when severityLabel/reviewLabel are given', () => {
    render(
      <InteractionAlert
        severity="danger"
        reviewStatus="reviewed"
        title="X"
        titleId="o"
        lang="en"
        severityLabel="Custom severity"
        reviewLabel="Custom review sentence"
      />
    );
    expect(screen.getByText('Custom severity')).toBeInTheDocument();
    expect(screen.getByText('Custom review sentence')).toBeInTheDocument();
  });

  it('renders no aria-labelledby when titleId is omitted, and no review panel when reviewStatus is omitted', () => {
    render(<InteractionAlert severity="info" title="No id" lang="en" />);
    const region = screen.getByRole('region');
    expect(region).not.toHaveAttribute('aria-labelledby');
    expect(screen.queryByText(/reviewer/i)).not.toBeInTheDocument();
  });
});
