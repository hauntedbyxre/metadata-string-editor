import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import '../styles/globals.css';

type Theme = 'light' | 'dark';

export default function App({ Component, pageProps }: AppProps) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <Component {...pageProps} theme={theme} setTheme={setTheme} />
    </div>
  );
}
