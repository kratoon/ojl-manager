import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';

describe('App', () => {
  it('renders the heading', () => {
    expect(renderToString(<App />)).toContain('OJL Manager');
  });
});
