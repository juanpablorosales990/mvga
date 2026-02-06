import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function MorePage() {
  const { t } = useTranslation();

  const menuItems = [
    { labelKey: 'more.send', path: '/send', icon: '↑', color: 'bg-blue-500' },
    { labelKey: 'more.receive', path: '/receive', icon: '↓', color: 'bg-green-500' },
    { labelKey: 'more.history', path: '/history', icon: '↺', color: 'bg-indigo-500' },
    { labelKey: 'more.grants', path: '/grants', icon: '🏦', color: 'bg-amber-500' },
    { labelKey: 'more.referral', path: '/referral', icon: '🎁', color: 'bg-pink-500' },
    { labelKey: 'more.transparency', path: '/transparency', icon: '✓', color: 'bg-emerald-500' },
    { labelKey: 'more.metrics', path: '/metrics', icon: '📊', color: 'bg-cyan-500' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('more.title')}</h1>

      <div className="grid grid-cols-2 gap-4">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="card flex flex-col items-center gap-3 py-6 hover:bg-white/10 transition"
          >
            <div
              className={`w-12 h-12 ${item.color} rounded-full flex items-center justify-center text-white text-xl font-bold`}
            >
              {item.icon}
            </div>
            <span className="font-medium">{t(item.labelKey)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
