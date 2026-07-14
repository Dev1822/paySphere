const EmptyIllustration = () => (
  <svg
    viewBox="0 0 200 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-40 h-40"
    aria-hidden="true"
  >
    <circle cx="100" cy="80" r="70" fill="#EEF2FF" />
    <rect x="58" y="54" width="84" height="60" rx="10" fill="#fff" stroke="#C7D2FE" strokeWidth="3" />
    <line x1="72" y1="72" x2="128" y2="72" stroke="#C7D2FE" strokeWidth="4" strokeLinecap="round" />
    <line x1="72" y1="86" x2="112" y2="86" stroke="#E0E7FF" strokeWidth="4" strokeLinecap="round" />
    <line x1="72" y1="100" x2="120" y2="100" stroke="#E0E7FF" strokeWidth="4" strokeLinecap="round" />
    <circle cx="138" cy="46" r="16" fill="#6366F1" />
    <path d="M138 40v12M132 46h12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export default function EmptyState({ title, description, action }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center text-center py-16 px-6">
      <EmptyIllustration />

      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-400 text-sm mb-6 max-w-sm">{description}</p>

      {action}
    </div>
  );
}
