import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import LanguageSwitcher from '../LanguageSwitcher';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('LanguageSwitcher', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders language selector with EN, ES, and FR options', () => {
    act(() => {
      root.render(<LanguageSwitcher />);
    });

    const select = container.querySelector('select#language-select');
    expect(select).not.toBeNull();
    const options = Array.from(select.querySelectorAll('option')).map((opt) => opt.value);
    expect(options).toEqual(['en', 'es', 'fr']);
  });

  it('calls i18n.changeLanguage when selecting a new language', async () => {
    const spy = vi.spyOn(i18n, 'changeLanguage');

    act(() => {
      root.render(<LanguageSwitcher />);
    });

    const select = container.querySelector('select#language-select');

    act(() => {
      select.value = 'fr';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(spy).toHaveBeenCalledWith('fr');
    spy.mockRestore();
  });
});
