'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { platformApi, getPlatformAdmin } from '@/lib/platform-api';

interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
  role: 'PLATFORM_OWNER' | 'PLATFORM_ADMIN';
  isActive: boolean;
  recoveryEmail?: string;
  lastLoginAt?: string;
  createdAt: string;
}

export default function PlatformAdminsPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentAdmin, setCurrentAdmin] = useState<{ id: string; role: string } | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<PlatformAdmin | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'PLATFORM_ADMIN' as 'PLATFORM_OWNER' | 'PLATFORM_ADMIN',
    recoveryEmail: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Emergency token state
  const [emergencyToken, setEmergencyToken] = useState<{ token: string; expiresAt: string; message: string } | null>(null);

  useEffect(() => {
    const adminData = getPlatformAdmin();
    if (adminData) {
      setCurrentAdmin({ id: adminData.id, role: adminData.role });

      // Only OWNER can access this page
      if (adminData.role !== 'PLATFORM_OWNER') {
        router.push('/platform-admin/dashboard');
        return;
      }
    }

    loadAdmins();
  }, [router]);

  const loadAdmins = async () => {
    try {
      const data = await platformApi.listAdmins();
      setAdmins(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      await platformApi.createAdmin({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        recoveryEmail: formData.recoveryEmail || undefined,
      });

      setShowCreateModal(false);
      setFormData({ name: '', email: '', password: '', role: 'PLATFORM_ADMIN', recoveryEmail: '' });
      loadAdmins();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;

    setFormLoading(true);
    setFormError('');

    try {
      await platformApi.updateAdmin(selectedAdmin.id, {
        name: formData.name,
        role: formData.role,
        recoveryEmail: formData.recoveryEmail || undefined,
        ...(formData.password ? { password: formData.password } : {}),
      });

      setShowEditModal(false);
      setSelectedAdmin(null);
      loadAdmins();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (admin: PlatformAdmin) => {
    try {
      await platformApi.updateAdmin(admin.id, { isActive: !admin.isActive });
      loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    }
  };

  const handleDelete = async (admin: PlatformAdmin) => {
    if (!confirm(`Biztosan törlöd ${admin.name} admin fiókját?`)) return;

    try {
      await platformApi.deleteAdmin(admin.id);
      loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    }
  };

  const openEditModal = (admin: PlatformAdmin) => {
    setSelectedAdmin(admin);
    setFormData({
      name: admin.name,
      email: admin.email,
      password: '',
      role: admin.role,
      recoveryEmail: admin.recoveryEmail || '',
    });
    setFormError('');
    setShowEditModal(true);
  };

  const handleGenerateEmergencyToken = async () => {
    try {
      const result = await platformApi.generateEmergencyToken();
      setEmergencyToken(result);
      setShowEmergencyModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('hu-HU');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Adminok</h1>
          <p className="text-gray-400 mt-1">Platform szintű adminisztrátorok kezelése</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleGenerateEmergencyToken}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Emergency Token
          </button>
          <button
            onClick={() => {
              setFormData({ name: '', email: '', password: '', role: 'PLATFORM_ADMIN', recoveryEmail: '' });
              setFormError('');
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Új Admin
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg px-4 py-3 text-red-300">
          {error}
        </div>
      )}

      {/* Admins List */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Admin</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Szerepkör</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Recovery Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Utolsó belépés</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Státusz</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Műveletek</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {admins.map((admin) => (
              <tr key={admin.id} className="hover:bg-gray-750">
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-white">{admin.name}</div>
                    <div className="text-sm text-gray-400">{admin.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    admin.role === 'PLATFORM_OWNER'
                      ? 'bg-purple-900/50 text-purple-300'
                      : 'bg-blue-900/50 text-blue-300'
                  }`}>
                    {admin.role === 'PLATFORM_OWNER' ? 'Owner' : 'Admin'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">
                  {admin.recoveryEmail || <span className="text-gray-500">-</span>}
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">
                  {admin.lastLoginAt ? formatDate(admin.lastLoginAt) : <span className="text-gray-500">Még nem lépett be</span>}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    admin.isActive
                      ? 'bg-green-900/50 text-green-300'
                      : 'bg-red-900/50 text-red-300'
                  }`}>
                    {admin.isActive ? 'Aktív' : 'Inaktív'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button
                    onClick={() => openEditModal(admin)}
                    className="text-indigo-400 hover:text-indigo-300 text-sm"
                  >
                    Szerkesztés
                  </button>
                  {admin.id !== currentAdmin?.id && (
                    <>
                      <button
                        onClick={() => handleToggleActive(admin)}
                        className="text-yellow-400 hover:text-yellow-300 text-sm"
                      >
                        {admin.isActive ? 'Deaktiválás' : 'Aktiválás'}
                      </button>
                      <button
                        onClick={() => handleDelete(admin)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Törlés
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-4">Új Admin létrehozása</h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Név</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Jelszó</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Szerepkör</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'PLATFORM_OWNER' | 'PLATFORM_ADMIN' })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="PLATFORM_ADMIN">Platform Admin</option>
                  <option value="PLATFORM_OWNER">Platform Owner</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Recovery Email {formData.role === 'PLATFORM_OWNER' && <span className="text-red-400">*</span>}
                </label>
                <input
                  type="email"
                  value={formData.recoveryEmail}
                  onChange={(e) => setFormData({ ...formData, recoveryEmail: e.target.value })}
                  required={formData.role === 'PLATFORM_OWNER'}
                  placeholder="Jelszó visszaállításhoz"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {formData.role === 'PLATFORM_OWNER' && (
                  <p className="text-xs text-gray-400 mt-1">Owner jogosultsághoz kötelező megadni</p>
                )}
              </div>

              {formError && (
                <div className="text-red-400 text-sm">{formError}</div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {formLoading ? 'Létrehozás...' : 'Létrehozás'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-4">Admin szerkesztése</h2>

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={selectedAdmin.email}
                  disabled
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Név</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Új jelszó (opcionális)</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  minLength={8}
                  placeholder="Csak ha módosítani szeretnéd"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Szerepkör</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'PLATFORM_OWNER' | 'PLATFORM_ADMIN' })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="PLATFORM_ADMIN">Platform Admin</option>
                  <option value="PLATFORM_OWNER">Platform Owner</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Recovery Email {formData.role === 'PLATFORM_OWNER' && <span className="text-red-400">*</span>}
                </label>
                <input
                  type="email"
                  value={formData.recoveryEmail}
                  onChange={(e) => setFormData({ ...formData, recoveryEmail: e.target.value })}
                  required={formData.role === 'PLATFORM_OWNER'}
                  placeholder="Jelszó visszaállításhoz"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {formError && (
                <div className="text-red-400 text-sm">{formError}</div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {formLoading ? 'Mentés...' : 'Mentés'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Emergency Token Modal */}
      {showEmergencyModal && emergencyToken && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full mx-4">
            <h2 className="text-xl font-bold text-red-400 mb-4">Emergency Access Token</h2>

            <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 mb-4">
              <p className="text-red-300 text-sm mb-2">
                FIGYELEM: Ez a token egyszeri használatú és 30 napig érvényes!
              </p>
              <p className="text-red-300 text-sm">
                Mentsd el biztonságos helyre - a token a szerveren is el lett mentve fájlba.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Token</label>
                <textarea
                  value={emergencyToken.token}
                  readOnly
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Lejárat</label>
                <input
                  type="text"
                  value={formatDate(emergencyToken.expiresAt)}
                  readOnly
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>

              <div className="text-sm text-gray-400">
                {emergencyToken.message}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(emergencyToken.token);
                }}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Token másolása
              </button>
              <button
                onClick={() => {
                  setShowEmergencyModal(false);
                  setEmergencyToken(null);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Bezárás
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
