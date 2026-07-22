import React from 'react';

/**
 * 21-Day Sui Challenge Diagrams
 * Super minimal - just text, no fancy boxes
 */

// ============================================
// Challenge Roadmap - Text only, clean
// ============================================
export function ChallengeRoadmap() {
  return (
    <div className="my-8 font-mono text-sm">
      <div className="flex items-start gap-8 justify-center flex-wrap">
        <div className="text-center">
          <div className="text-text-muted text-xs mb-1">Week 1</div>
          <div className="text-text-primary font-medium">Foundations</div>
          <div className="text-text-muted text-xs mt-1">Days 1-7</div>
        </div>

        <div className="text-text-muted self-center">→</div>

        <div className="text-center">
          <div className="text-text-muted text-xs mb-1">Week 2</div>
          <div className="text-text-primary font-medium">Objects</div>
          <div className="text-text-muted text-xs mt-1">Days 8-14</div>
        </div>

        <div className="text-text-muted self-center">→</div>

        <div className="text-center">
          <div className="text-text-muted text-xs mb-1">Week 3</div>
          <div className="text-text-primary font-medium">Patterns</div>
          <div className="text-text-muted text-xs mt-1">Days 15-21</div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Object Model Comparison - Simple side by side
// ============================================
export function ObjectModelComparison() {
  return (
    <div className="my-8 font-mono text-sm">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-6 max-w-xl mx-auto items-start">
        {/* Ethereum */}
        <div>
          <div className="text-text-muted text-xs uppercase tracking-wide mb-2">Ethereum</div>
          <div className="text-text-primary mb-3">Global State</div>
          <div className="text-text-secondary text-xs space-y-1">
            <div>balances[0x1] = 100</div>
            <div>balances[0x2] = 50</div>
            <div className="text-text-muted">just numbers in a mapping</div>
          </div>
        </div>

        {/* VS */}
        <div className="text-text-muted text-xs self-center pt-6">vs</div>

        {/* Sui */}
        <div>
          <div className="text-text-muted text-xs uppercase tracking-wide mb-2">Sui</div>
          <div className="text-text-primary mb-3">Discrete Objects</div>
          <div className="text-text-secondary text-xs space-y-1">
            <div>Coin #0x1a → owned</div>
            <div>NFT #0x2b → owned</div>
            <div className="text-text-muted">real objects with IDs</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Workflow Cycle - Inline text
// ============================================
export function WorkflowCycle() {
  return (
    <div className="my-8 font-mono text-sm text-center">
      <div className="text-text-secondary">
        <span className="text-text-primary">Read</span>
        <span className="text-text-muted mx-2">→</span>
        <span className="text-text-primary">Code</span>
        <span className="text-text-muted mx-2">→</span>
        <span className="text-text-primary">Build</span>
        <span className="text-text-muted mx-2">→</span>
        <span className="text-text-primary">Test</span>
        <span className="text-text-muted mx-2">→</span>
        <span className="text-text-primary">Commit</span>
        <span className="text-text-muted mx-2">→</span>
        <span className="text-text-primary">Share</span>
      </div>
      <div className="text-text-muted text-xs mt-2">repeat daily</div>
    </div>
  );
}

export default {
  ChallengeRoadmap,
  ObjectModelComparison,
  WorkflowCycle,
};
