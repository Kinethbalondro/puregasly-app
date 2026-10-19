import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePageTitle from '../utils/usePageTitle';

export const PRIVACY_EFFECTIVE = 'October 16, 2026';

const SECTIONS = [
  {
    title: 'What we collect',
    items: [
      'Your name, email address and password (the password is stored in a scrambled form, never as plain text).',
      'Customers: delivery addresses, contact numbers, orders, favorites and reviews.',
      'Store owners: store details (name, address, phone, hours), store photos, and the business documents you submit so we can verify your store.',
      'Employees and riders: your name, email and the deliveries or permissions assigned to you.',
      'An optional profile photo, if you upload one.',
      'Basic technical details such as your device type and IP address, used for sign-in security.',
    ],
  },
  {
    title: 'How we use it',
    items: [
      'To run your account, show stores and products, process orders and arrange deliveries.',
      'To let our admins review and approve new stores.',
      'To keep PureGasly secure, such as locking an account after repeated wrong passwords.',
      'To send you in-app notifications about your orders and store status.',
      'To email you verification codes (sign-up, password reset, changing your email) and a notice when your password or email changes.',
    ],
  },
  {
    title: 'Who can see your information',
    items: [
      'Stores see the name, contact number and delivery address of customers who order from them.',
      'The rider assigned to an order sees the customer’s name, photo, contact number and address. The customer sees the rider’s name and photo.',
      'Customers can see a store’s name, logo, photos, address, phone, hours and ratings.',
      'Reviews show the reviewer’s name and photo.',
      'Business documents can only be opened by PureGasly admins. They are never shown to customers, other stores, employees or riders.',
      'We do not sell your personal information. We only share it with the services that host PureGasly, or when the law requires it.',
    ],
  },
  {
    title: 'About photos',
    paragraphs: [
      'Profile pictures and store photos can be opened by anyone who has the exact image link. Please only upload photos you are comfortable sharing. You can replace or remove a photo at any time and the old one is deleted.',
    ],
  },
  {
    title: 'How we protect it',
    paragraphs: [
      'We use secure connections, scrambled passwords, role-based access so people only see what their role needs, limits on repeated login attempts, and sign-in sessions you can end from the Security page. No online service is perfectly secure, but we work to keep your information safe.',
    ],
  },
  {
    title: 'How long we keep it',
    paragraphs: [
      'We keep your information while your account is active. Order records may be kept longer for accounting purposes. Business documents are kept while the store is active and for a reasonable time afterward. Photos are kept until you replace or remove them.',
    ],
  },
  {
    title: 'Your rights',
    paragraphs: [
      'Under the Philippine Data Privacy Act (RA 10173), you can ask to see the information we hold about you, correct it, object to how it is used, or request that it be deleted. You may also file a complaint with the National Privacy Commission (privacy.gov.ph).',
    ],
  },
  {
    title: 'Children',
    paragraphs: ['PureGasly is for people aged 18 and older.'],
  },
  {
    title: 'Changes and contact',
    paragraphs: [
      'If we change this policy we will update the date above. For questions or to use any of your rights, contact the PureGasly team through the platform administrator.',
    ],
  },
];

export default function PrivacyPolicy() {
  usePageTitle('Privacy Policy');
  const { user } = useAuth();
  const home = user ? '/dashboard' : '/login';
  const navigate = useNavigate();
  const location = useLocation();

  // Go back to the page the person came from. If they opened this page
  // directly (no history inside the app), fall back to home.
  const goBack = (e) => {
    e.preventDefault();
    if (location.key !== 'default') navigate(-1);
    else navigate(home);
  };

  return (
    <div className="policy-page">
      <header className="policy-top">
        <Link to={home} className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <img src="/assets/logo.png" alt="PureGasly logo" />
          <span>PureGasly</span>
        </Link>
        <Link to={home} onClick={goBack} className="btn-ghost small">← Back<span className="hide-xs"> to PureGasly</span></Link>
      </header>

      <main className="policy-body">
        <h1>Privacy Policy</h1>
        <p className="muted">Effective {PRIVACY_EFFECTIVE}</p>
        <p>
          PureGasly connects customers with local LPG stores for ordering and delivery. This page explains, in plain
          words, what information we collect and how it is used.
        </p>

        {SECTIONS.map((s) => (
          <section key={s.title} className="policy-section">
            <h2>{s.title}</h2>
            {(s.paragraphs || []).map((p) => <p key={p}>{p}</p>)}
            {s.items && <ul>{s.items.map((i) => <li key={i}>{i}</li>)}</ul>}
          </section>
        ))}
      </main>
    </div>
  );
}