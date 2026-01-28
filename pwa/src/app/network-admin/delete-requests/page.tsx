'use client';

import { useEffect, useState } from 'react';
import { networkAdminApi } from '@/lib/network-admin-api';
import { usePlatformView } from '@/contexts/PlatformViewContext';

interface DeleteRequest {
  id: string;
  washEventId: string;
  requestedBy: string;
  reason: string;
  status: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
  washEvent: {
    id: string;
    licensePlate: string;
    vehicleType: string;
    totalPrice: number;
    createdAt: string;
    location: { name: string };
    driver?: { name: string };
  };
}

export default function DeleteRequestsPage() {
  const { isPlatformView } = usePlatformView();
  const [requests, setRequests] = useState<DeleteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  // Review modal
  const [reviewModal, setReviewModal] = useState<{
    request: DeleteRequest;
    action: 'approve' | 'reject';
  } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const status = filter === 'ALL' ? undefined : filter;
      const data = await networkAdminApi.listDeleteRequests(status);
      setRequests(data);
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const openReviewModal = (request: DeleteRequest, action: 'approve' | 'reject') => {
    setReviewModal({ request, action });
    setReviewNote('');
  };

  const handleReview = async () => {
    if (!reviewModal) return;

    setReviewing(true);
    try {
      if (reviewModal.action === 'approve') {
        await networkAdminApi.approveDeleteRequest(reviewModal.request.id, reviewNote || undefined);
      } else {
        await networkAdminApi.rejectDeleteRequest(reviewModal.request.id, reviewNote || undefined);
      }
      setReviewModal(null);
      loadRequests();
    } catch (err: any) {
      alert(err.message || 'Hiba történt');
    } finally {
      setReviewing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Függőben</span>;
      case 'APPROVED':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Jóváhagyva</span>;
      case 'REJECTED':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Elutasítva</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Törlési kérelmek</h1>
        <p className="text-gray-500">{isPlatformView ? 'Operátorok által kezdeményezett mosás törlések megtekintése' : 'Operátorok által kezdeményezett mosás törlések kezelése'}</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { value: 'PENDING', label: 'Függőben', count: requests.filter(r => r.status === 'PENDING').length },
          { value: 'APPROVED', label: 'Jóváhagyva' },
          { value: 'REJECTED', label: 'Elutasítva' },
          { value: 'ALL', label: 'Mind' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value as typeof filter)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              filter === tab.value
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && filter !== tab.value && tab.count > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Requests List */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
          Betöltés...
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>Nincsenek {filter === 'PENDING' ? 'függőben lévő' : filter === 'APPROVED' ? 'jóváhagyott' : filter === 'REJECTED' ? 'elutasított' : ''} törlési kérelmek.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-xl shadow-sm p-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                {/* Request Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    {getStatusBadge(request.status)}
                    <span className="text-sm text-gray-500">
                      {formatDate(request.createdAt)}
                    </span>
                  </div>

                  {/* Wash Event Details */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Rendszám</p>
                        <p className="font-mono font-semibold text-gray-900">
                          {request.washEvent.licensePlate}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Helyszín</p>
                        <p className="font-medium text-gray-900">
                          {request.washEvent.location.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Sofőr</p>
                        <p className="font-medium text-gray-900">
                          {request.washEvent.driver?.name || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Összeg</p>
                        <p className="font-semibold text-gray-900">
                          {formatPrice(request.washEvent.totalPrice)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        Mosás időpontja: {formatDate(request.washEvent.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="mb-3">
                    <p className="text-sm text-gray-500 mb-1">Törlés indoka:</p>
                    <p className="text-gray-900 bg-yellow-50 rounded-lg px-3 py-2">
                      "{request.reason}"
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Kérelmező: {request.requestedBy}
                    </p>
                  </div>

                  {/* Review Info (if reviewed) */}
                  {request.status !== 'PENDING' && (
                    <div className="bg-gray-50 rounded-lg p-3 text-sm">
                      <p className="text-gray-500">
                        {request.status === 'APPROVED' ? 'Jóváhagyta' : 'Elutasította'}:{' '}
                        <span className="text-gray-900">{request.reviewedBy}</span>
                        {request.reviewedAt && (
                          <span className="text-gray-400"> - {formatDate(request.reviewedAt)}</span>
                        )}
                      </p>
                      {request.reviewNote && (
                        <p className="text-gray-600 mt-1">Megjegyzés: "{request.reviewNote}"</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!isPlatformView && request.status === 'PENDING' && (
                  <div className="flex gap-2 lg:flex-col">
                    <button
                      onClick={() => openReviewModal(request, 'approve')}
                      className="flex-1 lg:flex-none px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Jóváhagyás
                    </button>
                    <button
                      onClick={() => openReviewModal(request, 'reject')}
                      className="flex-1 lg:flex-none px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Elutasítás
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 rounded-xl p-4">
        <p className="text-sm text-blue-700">
          <strong>Információ:</strong> Az operátorok csak törlési kérelmet küldhetnek, a végleges törlést Önnek kell jóváhagynia.
          Jóváhagyás után a mosás véglegesen törlődik a rendszerből.
        </p>
      </div>

      {/* Review Modal */}
      {reviewModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setReviewModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {reviewModal.action === 'approve' ? 'Törlés jóváhagyása' : 'Törlés elutasítása'}
                </h2>
                <button
                  onClick={() => setReviewModal(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Wash Event Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-semibold text-gray-900">
                    {reviewModal.request.washEvent.licensePlate}
                  </span>
                  <span className="font-semibold text-gray-900">
                    {formatPrice(reviewModal.request.washEvent.totalPrice)}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {reviewModal.request.washEvent.location.name} • {formatDate(reviewModal.request.washEvent.createdAt)}
                </p>
              </div>

              {/* Warning */}
              {reviewModal.action === 'approve' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">
                    <strong>Figyelem!</strong> A jóváhagyás után a mosás véglegesen törlődik, és ez a művelet nem visszavonható!
                  </p>
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Megjegyzés (opcionális)
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={reviewModal.action === 'approve' ? 'pl. Dupla rögzítés miatt törölve' : 'pl. Nincs elegendő indok'}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setReviewModal(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Mégse
              </button>
              <button
                onClick={handleReview}
                disabled={reviewing}
                className={`flex-1 py-3 font-medium rounded-xl transition-colors disabled:bg-gray-300 ${
                  reviewModal.action === 'approve'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {reviewing ? 'Feldolgozás...' : reviewModal.action === 'approve' ? 'Jóváhagyás' : 'Elutasítás'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
