'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getNetworkId } from '@/lib/network-admin-api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

type ImportFormat = 'matrix' | 'vertical';

export default function PriceUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ imported: number; skipped?: number; created?: number; errors: string[] } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importFormat, setImportFormat] = useState<ImportFormat>('vertical');

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }

  function handleFile(selectedFile: File) {
    // Check file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      setError('Csak Excel fájlok (.xlsx, .xls) támogatottak');
      return;
    }

    setFile(selectedFile);
    setError('');
    setResult(null);
  }

  async function handleUpload() {
    if (!file) return;

    const networkId = getNetworkId();
    if (!networkId) {
      setError('Nincs bejelentkezve');
      return;
    }

    try {
      setUploading(true);
      setError('');
      setResult(null);

      const formData = new FormData();
      formData.append('file', file);

      // Choose endpoint based on format
      const endpoint = importFormat === 'vertical'
        ? `${API_URL}/operator/billing/prices/import-vertical`
        : `${API_URL}/operator/billing/prices/import`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-network-id': networkId,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Feltöltés sikertelen');
      }

      const data = await response.json();
      setResult(data);

      if (data.errors.length === 0) {
        // Success - redirect after 2 seconds
        setTimeout(() => {
          router.push('/network-admin/prices');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt a feltöltésnél');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/network-admin/prices"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          &larr; Vissza az árlistához
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Excel Feltöltés</h1>
        <p className="text-gray-500 mt-1">Árlista importálása Excel fájlból</p>
      </div>

      {/* Format selector */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
          Import formátum
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setImportFormat('vertical')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              importFormat === 'vertical'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                importFormat === 'vertical' ? 'border-primary-500' : 'border-gray-300'
              }`}>
                {importFormat === 'vertical' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900">Vertikális (soronként)</p>
                <p className="text-sm text-gray-500 mt-1">
                  Minden sor egy ár: Járműkategória | Mosástípus | Ár
                </p>
                <div className="mt-2 text-xs text-gray-400 font-mono bg-gray-50 p-2 rounded">
                  Nyerges szerelvény | HACCP külső | 39370<br />
                  Nyerges szerelvény | GYORS külső | 21811<br />
                  Gabonaszállító | GYORS külső | 19763
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setImportFormat('matrix')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              importFormat === 'matrix'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                importFormat === 'matrix' ? 'border-primary-500' : 'border-gray-300'
              }`}>
                {importFormat === 'matrix' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900">Mátrix (táblázat)</p>
                <p className="text-sm text-gray-500 mt-1">
                  Sorok: járműtípusok, Oszlopok: szolgáltatások
                </p>
                <div className="mt-2 text-xs text-gray-400 font-mono bg-gray-50 p-2 rounded">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| HACCP | GYORS<br />
                  Nyerges&nbsp;&nbsp;&nbsp;| 39370 | 21811<br />
                  Gabona&nbsp;&nbsp;&nbsp;&nbsp;| 35000 | 19763
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
          Útmutató
        </h2>
        {importFormat === 'vertical' ? (
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>Vertikális formátum:</strong></p>
            <p>• A oszlop: Járműkategória neve (pl. "Nyerges szerelvény")</p>
            <p>• B oszlop: Mosástípus neve (pl. "HACCP külső fertőtlenítés")</p>
            <p>• C oszlop: Nettó ár Ft-ban</p>
            <p className="text-gray-500 mt-4">
              Az első sor kihagyásra kerül, ha fejléc (pl. "Járműkategória", "Mosástípus", "Ár")
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>Mátrix formátum:</strong></p>
            <p>• Első sor: szolgáltatás nevek</p>
            <p>• Első oszlop: járműtípus nevek</p>
            <p>• Cellák: árak</p>
            <p className="text-gray-500 mt-4">
              Tipp: Töltsd le a jelenlegi árlistát az "Excel letöltés" gombbal, majd módosítsd azt.
            </p>
          </div>
        )}
      </div>

      {/* Upload area */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
          Fájl feltöltés
        </h2>

        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragActive
              ? 'border-primary-500 bg-primary-50'
              : file
              ? 'border-green-300 bg-green-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
          />

          {file ? (
            <div>
              <div className="text-4xl mb-2">📄</div>
              <p className="text-lg font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              <button
                onClick={() => {
                  setFile(null);
                  setResult(null);
                }}
                className="mt-4 text-sm text-red-600 hover:text-red-700"
              >
                Fájl törlése
              </button>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-2">📤</div>
              <p className="text-gray-600">
                Húzd ide a fájlt, vagy{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  válassz fájlt
                </button>
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Támogatott formátum: .xlsx, .xls
              </p>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        {/* Result message */}
        {result && (
          <div
            className={`mt-4 p-4 rounded-xl ${
              result.errors.length === 0
                ? 'bg-green-50 border border-green-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}
          >
            <p
              className={`font-medium ${
                result.errors.length === 0 ? 'text-green-700' : 'text-yellow-700'
              }`}
            >
              {result.imported} ár sikeresen importálva
              {result.created !== undefined && result.created > 0 && `, ${result.created} új mosástípus létrehozva`}
              {result.skipped !== undefined && result.skipped > 0 && `, ${result.skipped} kihagyva`}
              {result.errors.length === 0 && ' - Átirányítás...'}
            </p>
            {result.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-yellow-700 mb-1">Hibák/Figyelmeztetések:</p>
                <ul className="text-sm text-yellow-600 list-disc list-inside max-h-48 overflow-y-auto">
                  {result.errors.slice(0, 20).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {result.errors.length > 20 && (
                    <li className="font-medium">...és még {result.errors.length - 20} hiba</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Upload button */}
        <div className="mt-6 flex gap-3">
          <Link
            href="/network-admin/prices"
            className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Mégse
          </Link>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Feltöltés...' : 'Feltöltés és importálás'}
          </button>
        </div>
      </div>
    </div>
  );
}
