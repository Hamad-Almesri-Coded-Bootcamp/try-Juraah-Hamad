/**
 * CR-113 — the why-data the reviewer screen reads: DDInter's own text per interaction pair plus an
 * AI draft summary, built by agents/knowledge (scripts/build-demo-index.js). Server-only: imported by
 * the 'use server' data implementations, never by a component, so it never reaches the browser.
 */
import raw from '@/agents/knowledge/data/interaction-why.json';
import type { WhyData } from './shapes/why';

export const WHY_DATA: WhyData = raw as WhyData;
