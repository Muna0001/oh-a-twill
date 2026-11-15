import { render, screen } from '@testing-library/react-native';

import { PaperShape, paperPath } from './PaperShape';

describe('paperPath', () => {
  it('is the same for the same seed and size', () => {
    expect(paperPath(7, 120, 90)).toBe(paperPath(7, 120, 90));
  });

  it('differs between seeds', () => {
    expect(paperPath(1, 120, 90)).not.toBe(paperPath(2, 120, 90));
  });

  it('is a closed path that stays near its box', () => {
    const d = paperPath(3, 120, 90);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const nums = d.replace(/[MLZ]/g, ' ').trim().split(/\s+/).map(Number);
    expect(nums.length).toBeGreaterThan(40);
    for (let i = 0; i < nums.length; i += 2) {
      expect(nums[i]).toBeGreaterThanOrEqual(-10);
      expect(nums[i]).toBeLessThanOrEqual(130);
      expect(nums[i + 1]).toBeGreaterThanOrEqual(-10);
      expect(nums[i + 1]).toBeLessThanOrEqual(100);
    }
  });
});

describe('PaperShape', () => {
  it('draws the same edge on every render for a seed', async () => {
    const view = await render(<PaperShape testID="paper" seed={5} width={100} height={80} />);
    const first = JSON.stringify(view.toJSON());
    await view.rerender(<PaperShape testID="paper" seed={5} width={100} height={80} />);
    expect(JSON.stringify(view.toJSON())).toBe(first);
  });

  it('is hidden from accessibility and ignores touches', async () => {
    await render(<PaperShape testID="paper" color="sky" dots />);
    expect(screen.queryByTestId('paper')).toBeNull();
    const paper = screen.getByTestId('paper', { includeHiddenElements: true });
    expect(paper.props.accessibilityElementsHidden).toBe(true);
    expect(paper.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(paper.props.pointerEvents).toBe('none');
    expect(paper).toHaveStyle({ position: 'absolute' });
  });
});
