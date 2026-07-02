import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import apiClient from '../api/client.js';
import AccountSelector from '../components/AccountSelector.jsx';
import AdSetCard from '../components/AdSetCard.jsx';
import CampaignCard from '../components/CampaignCard.jsx';

export default function Dashboard({ onBack, initialAccount, lockedAccount }) {
  const fixedAccount = lockedAccount != null ? String(lockedAccount).replace('act_', '') : null;
  const { user, logout } = useAuth();

  // Accounts
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(null);
  // Preselección si viene desde el hub de un cliente; si no, el usuario elige.
  const [selectedAccount, setSelectedAccount] = useState((lockedAccount || initialAccount) ? String(lockedAccount || initialAccount).replace('act_', '') : null);

  // Adsets (ABO)
  const [adsets, setAdsets] = useState([]);
  const [adsetsLoading, setAdsetsLoading] = useState(false);
  const [adsetsError, setAdsetsError] = useState(null);

  // Campaigns (CBO)
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsError, setCampaignsError] = useState(null);

  // Last 4 days avg spend
  const [last4Spend, setLast4Spend] = useState(null);

  // Candado del optimizador (para no pisarse entre usuarios).
  const [lease, setLease] = useState(null);
  useEffect(() => {
    if (!selectedAccount) { setLease(null); return; }
    let alive = true;
    const acquire = () => apiClient.post(`/accounts/${selectedAccount}/lease`, {})
      .then((r) => { if (alive) setLease(r.data); }).catch(() => {});
    acquire();
    const iv = setInterval(acquire, 60 * 1000); // refresca el candado mientras esté abierto
    return () => {
      alive = false; clearInterval(iv);
      apiClient.delete(`/accounts/${selectedAccount}/lease`).catch(() => {}); // lo suelta al salir
    };
  }, [selectedAccount]);
  const takeoverLease = () => apiClient.post(`/accounts/${selectedAccount}/lease`, { takeover: true })
    .then((r) => setLease(r.data)).catch(() => {});

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
      setLast4Spend(null);
      return;
    }

    const fetchData = async () => {
      setAdsetsLoading(true);
      setCampaignsLoading(true);
      setAdsetsError(null);
      setCampaignsError(null);
      try {
        const [adsetsRes, insightsRes] = await Promise.all([
          apiClient.get(`/accounts/${selectedAccount}/adsets`),
          apiClient.get(`/accounts/${selectedAccount}/insights/monthly`).catch(() => null),
        ]);
        setAdsets(adsetsRes.data?.abo || []);
        setCampaigns(adsetsRes.data?.cbo || []);
        if (insightsRes?.data?.last4Spend != null) {
          setLast4Spend(insightsRes.data.last4Spend / 4);
        }
      } catch (err) {
        setAdsetsError(err.message || 'Error al cargar los datos.');
        setCampaignsError(err.message || 'Error al cargar los datos.');
      } finally {
        setAdsetsLoading(false);
        setCampaignsLoading(false);
      }
    };

    fetchData();
  }, [selectedAccount]);

  const handleSelectAccount = (accountId) => {
    setSelectedAccount(accountId);
    if (accountId) {
      localStorage.setItem('selectedAccount', accountId);
      const account = accounts.find((a) => a.id === accountId);
      if (account) localStorage.setItem('selectedAccountName', account.name);
    } else {
      localStorage.removeItem('selectedAccount');
      localStorage.removeItem('selectedAccountName');
    }
  };

  // Total active daily budget (ABO adsets + CBO campaigns)
  const totalActiveBudget = useMemo(() => {
    const abo = adsets.reduce((sum, a) => sum + (parseFloat(a.daily_budget) || 0), 0);
    const seenCampaigns = new Set();
    const cbo = campaigns.reduce((sum, c) => {
      const id = c.campaign_id || c.id;
      if (seenCampaigns.has(id)) return sum;
      seenCampaigns.add(id);
      return sum + (parseFloat(c.campaign_budget || c.daily_budget) || 0);
    }, 0);
    return abo + cbo;
  }, [adsets, campaigns]);

  // Group ABO adsets by campaign, sort by budget within each group
  const groupedAdsets = useMemo(() => {
    if (!adsets.length) return [];
    const groups = new Map();
    for (const adset of adsets) {
      const key = adset.campaign_id || adset.campaign_name || 'Sin campaña';
      if (!groups.has(key)) {
        groups.set(key, {
          campaignName: adset.campaign_name || 'Sin campaña',
          campaignId: adset.campaign_id,
          adsets: [],
        });
      }
      groups.get(key).adsets.push(adset);
    }
    // Sort within each group by daily_budget descending
    for (const group of groups.values()) {
      group.adsets.sort((a, b) => (b.daily_budget || 0) - (a.daily_budget || 0));
    }
    // Sort groups by total 30d spend descending
    const entries = Array.from(groups.values());
    entries.sort((a, b) => {
      const spendA = a.adsets.reduce((s, ad) => s + (ad.metrics_30d?.spend || 0), 0);
      const spendB = b.adsets.reduce((s, ad) => s + (ad.metrics_30d?.spend || 0), 0);
      return spendB - spendA;
    });
    return entries;
  }, [adsets]);

  const handleAdSetAction = useCallback(
    async ({ type, entityId, entityType }) => {
      if (type === 'pause') {
        const response = await apiClient.post('/actions/pause', {
          entityId,
          entityType: entityType || 'adset',
          adAccountId: selectedAccount,
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
            {onBack && (
              <button
                onClick={onBack}
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '5px 12px' }}
              >
                ← Modos
              </button>
            )}
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
          {/* Account Selector — oculto cuando se entra con una cuenta bloqueada (desde el cliente) */}
          {!fixedAccount && (
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
                onSelect={handleSelectAccount}
                loading={accountsLoading}
              />
            </div>
          )}

          {/* Account spend stats */}
          {selectedAccount && (last4Spend !== null || totalActiveBudget > 0) && (
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              marginBottom: '20px',
            }}>
              {last4Spend !== null && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '10px',
                  backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-gray-light)',
                  borderRadius: 'var(--radius-md)', padding: '10px 16px', fontFamily: 'var(--font-mono)',
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Gasto prom. últimos 4 días
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                    {last4Spend > 0 ? `$${last4Spend.toLocaleString('es-AR', { maximumFractionDigits: 0 })} / día` : '—'}
                  </span>
                </div>
              )}
              {totalActiveBudget > 0 && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '10px',
                  backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-gray-light)',
                  borderRadius: 'var(--radius-md)', padding: '10px 16px', fontFamily: 'var(--font-mono)',
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Presupuesto diario activo
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-brand-blue)' }}>
                    ${totalActiveBudget.toLocaleString('es-AR', { maximumFractionDigits: 0 })} / día
                  </span>
                </div>
              )}
            </div>
          )}

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
              <span>
                Cargando {localStorage.getItem('selectedAccountName') || 'cuenta'}...
              </span>
            </div>
          )}

          {/* Content */}
          {!isLoading && selectedAccount && (
            <>
              {/* Candado: aviso si otra persona está optimizando esta cuenta */}
              {lease?.heldByOther && lease.holder && (
                <div style={{ background: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', fontSize: '13px' }}>
                  <span>🔒 <strong>{lease.holder.name}</strong> está optimizando esta cuenta ahora mismo. Coordiná para no pisarse — tus cambios se van a rechazar hasta que tomes el control.</span>
                  <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '5px 10px', whiteSpace: 'nowrap' }} onClick={takeoverLease}>Tomar control</button>
                </div>
              )}

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
                  {groupedAdsets.map((group) => (
                    <div key={group.campaignId || group.campaignName}>
                      {groupedAdsets.length > 1 && (
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: 'var(--color-brand-blue)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            marginBottom: '8px',
                            marginTop: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span style={{ opacity: 0.5 }}>◆</span>
                          {group.campaignName}
                          <span style={{ fontWeight: '400', color: 'var(--color-text-muted)' }}>
                            — {group.adsets.length} conjunto{group.adsets.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {group.adsets.map((adset) => (
                        <AdSetCard
                          key={adset.id}
                          adset={adset}
                          accountId={selectedAccount}
                          onAction={handleAdSetAction}
                        />
                      ))}
                    </div>
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
                      key={campaign.campaign_id || campaign.id}
                      campaign={campaign}
                      accountId={selectedAccount}
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
