import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelfCustodyWallet } from '../contexts/WalletContext';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../hooks/useToast';
import { track, AnalyticsEvents } from '../lib/analytics';

interface Employee {
  id: string;
  role: string;
  nickname: string | null;
  status: string;
  invitedAt: string;
  acceptedAt: string | null;
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    walletAddress: string;
  };
}

const ROLES = ['MANAGER', 'CASHIER', 'VIEWER'] as const;

export default function MerchantEmployeesPage() {
  const { t } = useTranslation();
  const { connected } = useSelfCustodyWallet();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [identifier, setIdentifier] = useState('');
  const [role, setRole] = useState<string>('CASHIER');
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  const roleLabel: Record<string, string> = {
    MANAGER: t('merchant.employees.roleMgr'),
    CASHIER: t('merchant.employees.roleCashier'),
    VIEWER: t('merchant.employees.roleViewer'),
  };

  const loadEmployees = useCallback(async () => {
    try {
      const data = await apiFetch<Employee[]>('/merchant/employees');
      setEmployees(data);
    } catch {
      // Failed
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected) loadEmployees();
  }, [connected, loadEmployees]);

  const resetForm = () => {
    setIdentifier('');
    setRole('CASHIER');
    setNickname('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleInvite = async () => {
    if (!identifier.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/merchant/employees', {
        method: 'POST',
        body: JSON.stringify({
          identifier: identifier.trim(),
          role,
          nickname: nickname.trim() || undefined,
        }),
      });
      track(AnalyticsEvents.MERCHANT_EMPLOYEE_INVITED, { role });
      showToast('success', t('merchant.employees.invited'));
      resetForm();
      loadEmployees();
    } catch {
      showToast('error', t('merchant.employees.failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await apiFetch(`/merchant/employees/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role,
          nickname: nickname.trim() || undefined,
        }),
      });
      showToast('success', t('merchant.employees.updated'));
      resetForm();
      loadEmployees();
    } catch {
      showToast('error', t('merchant.employees.failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm(t('merchant.employees.removeConfirm'))) return;
    try {
      await apiFetch(`/merchant/employees/${id}`, { method: 'DELETE' });
      showToast('success', t('merchant.employees.removed'));
      loadEmployees();
    } catch {
      showToast('error', t('merchant.employees.failed'));
    }
  };

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setRole(emp.role);
    setNickname(emp.nickname || '');
    setShowForm(true);
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
        <p>{t('common.connectWallet')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('merchant.employees.title')}</h1>
        {!showForm && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            {t('merchant.employees.invite')}
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="border rounded-xl p-4 space-y-3 bg-white dark:bg-gray-800 dark:border-gray-700">
          <p className="font-medium text-sm">
            {editingId ? t('merchant.employees.edit') : t('merchant.employees.inviteTitle')}
          </p>

          {!editingId && (
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={t('merchant.employees.identifierPlaceholder')}
              className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-900 dark:border-gray-700"
            />
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {t('merchant.employees.role')}
            </label>
            <div className="flex gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    role === r
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'
                  }`}
                >
                  {roleLabel[r]}
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={t('merchant.employees.nicknamePlaceholder')}
            maxLength={60}
            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-900 dark:border-gray-700"
          />

          <div className="flex gap-2">
            <button
              onClick={editingId ? handleUpdate : handleInvite}
              disabled={saving || (!editingId && !identifier.trim())}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
            >
              {saving
                ? t('merchant.employees.sending')
                : editingId
                  ? t('common.save')
                  : t('merchant.employees.sendInvite')}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-lg border dark:border-gray-700 text-sm"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Employee List */}
      {loading ? (
        <p className="text-center text-gray-500 py-8">{t('common.loading')}</p>
      ) : employees.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium">{t('merchant.employees.empty')}</p>
          <p className="text-sm">{t('merchant.employees.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {employees.map((emp) => (
            <div
              key={emp.id}
              className="flex items-center gap-3 p-3 rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-lg">
                {emp.user.displayName?.[0]?.toUpperCase() ||
                  emp.user.username?.[0]?.toUpperCase() ||
                  '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {emp.nickname ||
                    emp.user.displayName ||
                    emp.user.username ||
                    emp.user.walletAddress.slice(0, 8) + '...'}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-600 font-medium">{roleLabel[emp.role]}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      emp.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                    }`}
                  >
                    {emp.status === 'ACTIVE'
                      ? t('merchant.employees.statusActive')
                      : t('merchant.employees.statusPending')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => startEdit(emp)} className="text-xs text-blue-600 px-2 py-1">
                  {t('merchant.employees.edit')}
                </button>
                <button
                  onClick={() => handleRemove(emp.id)}
                  className="text-xs text-red-500 px-2 py-1"
                >
                  {t('merchant.employees.remove')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
