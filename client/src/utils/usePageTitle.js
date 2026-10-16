import { useEffect } from 'react';

export default function usePageTitle(title) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} · PureGasly` : 'PureGasly';
    return () => {
      document.title = prev;
    };
  }, [title]);
}
