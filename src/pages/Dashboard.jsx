import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import apiClient from '../api/client.js';
import AccountSelector from '../components/AccountSelector.jsx';
import AdSetCard from '../components/AdSetCard.jsx';
import CampaignCard from '../components/CampaignCard.jsx';

export default function Dashboard() {
  const { user, logout } = useAuth();

  // Accounts
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);

  // Adsets (ABO)
  const [adsets, setAdsets] = useState([]);
  const [adsetsLoading, setAdsetsLoading] = useState(false);
  const [adsetsError, setAdsetsError] = useState(null);

  // Campaigns (CBO)
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsError, setCampaignsError] = useState(null);

  // Load accounts on mount
  useEffect(() => {
    const fetchAccounts = async () => {
      setAccountsLoading(true);
      setAccountsError(null);
      try {
        const response = await apiClient.get('/accounts');
        const data = response.data?.accounts || response.data || [];
        setAccounts(data);
      } catch (err) {
        setAccountsError(err.message || 'Error al cargar las cuentas.');
      } finally {
        setAccountsLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  // Load adsets + campaigns when account selected
  useEffect(() => {
    if (!selectedAccount) {
      setAdsets([]);
      setCampaigns([]);
      return;
    }

    const fetchData = async () => {
      // Fetch ABO adsets
      setAdsetsLoading(true);
      setAdsetsError(null);
      try {
        const response = await apiClient.get(`/accounts/${selectedAccount}/adsets`);
        setAdsets(response.data?.adsets || response.data || []);
      } catch (err) {
        setAdsetsError(err.message || 'Error al cargar los conjuntos de anuncios.');
      } finally {
        setAdsetsLoading(false);
      }

      // Fetch CBO campaigns
      setCampaignsLoading(true);
      setCampaignsError(null);
      try {
        const response = await apiClient.get(`/accounts/${selectedAccount}/campaigns`);
        setCampaigns(response.data?.campaigns || response.data || []);
      } catch (err) {
        setCampaignsError(err.message || 'Error al cargar las campañas.');
      } finally {
        setCampaignsLoading(false);
      }
    };

    fetchData();
  }, [selectedAccount]);

  const handleAdSetAction = useCallback(
    async ({ type, entityId, entityType }) => {
      if (type === 'pause') {
        const response = await apiClient.post('/actions/pause', {
          entity_id: entityId,
          entity_type: entityType || 'adset',
          ad_account_id: selectedAccount,
        });
        return response.data;
      }
    },
    [selectedAccount]
  );

  const isLoading = adsetsLoading || campaignsLoading;

  return (
    <div className="app-wrapper">
      {/* Header */}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="logo-group">
            <span className="logo-text">alquimia.</span>
            <div className="logo-line" />
            <span className="logo-subtitle">/ ads dashboard</span>
          </div>
          <nav className="header-nav">
            <Link
              to="/audit"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '5px 12px' }}
            >
              Historial
            </Link>
            <button
              onClick={logout}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '5px 12px' }}
            >
              Salir
            </button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="app-main">
        <div className="content-container">
          {/* Account Selector */}
          <div
            style={{
              backgroundColor: 'var(--color-white)',
              border: '0.5px solid var(--color-gray-mid)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              marginBottom: '24px',
            }}
          >
            {accountsError && (
              <div className="alert alert-error" style={{ marginBottom: '12px' }}>
                {accountsError}
              </div>
            )}
            <AccountSelector
              accounts={accounts}
              selectedAccount={selectedAccount}
              onSelect={setSelectedAccount}
              loading={accountsLoading}
            />
          </div>

          {/* Welcome state — no account selected */}
          {!selectedAccount && !accountsLoading && (
            <div className="empty-state">
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '32px',
                  marginBottom: '12px',
                }}
              >
                ▸
              </div>
              <p style={{ fontWeight: '700', fontSize: '14px', fontFamily: 'var(--font-mono)' }}>
                Seleccioná una cuenta para comenzar
              </p>
              <p style={{ marginTop: '6px' }}>
                Se mostrarán los conjuntos de anuncios y campañas activas.
              </p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && selectedAccount && (
            <div className="loading-center">
              <span className="spinner" />
              <span>Cargando datos de la cuenta...</span>
            </div>
          )}

          {/* Content */}
          {!isLoading && selectedAccount && (
            <>
              {/* ABO Adsets */}
              {adsetsError && (
                <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                  Conjuntos de anuncios: {adsetsError}
                </div>
              )}

              {!adsetsError && adsets.length > 0 && (
                <div>
                  <div className="section-title">
                    Conjuntos de anuncios (ABO) — {adsets.length}
                  </div>
                  {adsets.map((adset) => (
                    <AdSetCard
                      key={adset.id}
                      adset={adset}
                      onAction={handleAdSetAction}
                    />
                  ))}
                </div>
              )}

              {!adsetsError && adsets.length === 0 && !adsetsLoading && (
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--color-text-muted)',
                    marginBottom: '16px',
                  }}
                >
                  Sin conjuntos de anuncios ABO activos.
                </div>
              )}

              {/* CBO Campaigns */}
              {campaignsError && (
                <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                  Campañas: {campaignsError}
                </div>
              )}

              {!campaignsError && campaigns.length > 0 && (
                <div>
                  <div className="section-title">
                    Campañas CBO — {campaigns.length}
                  </div>
                  {campaigns.map((campaign) => (
                    <CampaignCard
                      key={campaign.id}
                      campaign={campaign}
                      onAction={() => {}}
                    />
                  ))}
                </div>
              )}

              {!campaignsError && campaigns.length === 0 && !campaignsLoading && (
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--color-text-muted)',
                    marginBottom: '16px',
                  }}
                >
                  Sin campañas CBO activas.
                </div>
              )}

              {/* Completely empty */}
              {adsets.length === 0 && campaigns.length === 0 && (
                <div className="empty-state">
                  <p style={{ fontWeight: '700' }}>No hay datos activos</p>
                  <p>No se encontraron conjuntos ni campañas activas en esta cuenta.</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>
          design by{' '}
          <span className="footer-brand">alquimia.</span>
        </p>
      </footer>
    </div>
  );
}
