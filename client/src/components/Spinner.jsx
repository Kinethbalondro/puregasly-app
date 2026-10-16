// Small inline spinner for busy buttons. Usage: <Spinner /> Saving...
export default function Spinner({ light }) {
  return <span className={`spinner ${light ? 'light' : ''}`} aria-hidden="true" />;
}
