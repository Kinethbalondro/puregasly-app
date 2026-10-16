import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { message, title, danger, confirmLabel }
  const resolver = useRef(null);

  const confirm = useCallback((message, options = {}) => {
    setState({
      message,
      title: options.title || 'Are you sure?',
      danger: options.danger ?? true,
      confirmLabel: options.confirmLabel || 'Confirm',
    });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function handle(result) {
    setState(null);
    if (resolver.current) {
      resolver.current(result);
      resolver.current = null;
    }
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-backdrop" onClick={() => handle(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{state.title}</h3>
            <p className="muted" style={{ margin: '4px 0 18px' }}>{state.message}</p>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => handle(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={state.danger ? 'btn-danger' : 'btn-solid'}
                onClick={() => handle(true)}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

// Usage: const confirm = useConfirm(); const ok = await confirm('Remove this?');
export function useConfirm() {
  return useContext(ConfirmContext);
}
