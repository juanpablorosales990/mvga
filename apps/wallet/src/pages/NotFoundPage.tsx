import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-6xl font-bold text-gold-500 mb-4">404</h1>
      <p className="text-xl text-gray-400 mb-8">{t('common.pageNotFound', 'Page not found')}</p>
      <Link to="/" className="btn-primary px-8 py-3 font-medium">
        {t('common.goHome', 'Go Home')}
      </Link>
    </div>
  );
}
