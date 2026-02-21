
import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import CampaignListView from './components/CampaignListView';
import CampaignCreationView from './components/CampaignCreationView';
import LoginView from './components/LoginView';
import TalentPoolView from './components/TalentPoolView';
import AnalyticsView from './components/AnalyticsView';
import Toast from './components/Toast';
import SettingsView from './components/SettingsView';
// Sistema GitHub imports
import { GitHubCampaignList } from './SistemaGithub/components/GitHubCampaignList';
import { GitHubCodeScan } from './SistemaGithub/components/GitHubCodeScan';
// Sistema LinkedIn imports
import DetailView from './SistemaLinkedin/components/DetailView';
// Sistema Marketplace imports
import { MarketplaceRaidDashboard } from './SistemaMarketplace/components/MarketplaceRaidDashboard';
import { CampaignDashboard as MarketplaceCampaignDashboard } from './SistemaMarketplace/components/CampaignDashboard';
import { User, Campaign } from './types';
import { supabase } from './lib/supabase';
import { CampaignService } from './lib/services';
import { TabGuard } from './lib/TabGuard';
import { initializeUnbreakableMarker } from './lib/UnbreakableExecution';

// Protected Route Wrapper
const ProtectedRoute = ({ children, user, loading }: { children: React.ReactElement, user: User | null, loading: boolean }) => {
  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-950 text-slate-500">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);
  const navigate = useNavigate();
  const currentUserIdRef = useRef<string | null>(null); // Track user ID to prevent redundant state updates

  // ─── TabGuard: Sistema anti-recarga automática ─────────────────────
  // Previene recargas cuando cambias de pestaña/ventana
  useEffect(() => {
    const guard = new TabGuard();
    guard.activate();

    // Initialize Unbreakable Execution Mode marker
    initializeUnbreakableMarker();

    return () => guard.deactivate();
  }, []);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        currentUserIdRef.current = session.user.id;
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          role: 'Recruiter',
          avatar: `https://ui-avatars.com/api/?name=${session.user.email}&background=0D8ABC&color=fff`
        });
      }
      setLoading(false);
    });

    // Listen for auth changes — DEDUPLICATE to prevent tab-switch re-renders
    // Supabase fires SIGNED_IN and TOKEN_REFRESHED on every tab visibility change,
    // which would cause setUser() → full App re-render → DetailView state reset
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Skip TOKEN_REFRESHED — these never change user data
      if (event === 'TOKEN_REFRESHED') return;

      if (session?.user) {
        // CRITICAL FIX: Skip setUser() if the same user is already set
        // Supabase fires SIGNED_IN on every tab focus via _recoverAndRefresh()
        // which would re-render the entire App and reset component local state
        if (currentUserIdRef.current === session.user.id) {
          return; // Same user, no state change needed
        }
        currentUserIdRef.current = session.user.id;
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          role: 'Recruiter',
          avatar: `https://ui-avatars.com/api/?name=${session.user.email}&background=0D8ABC&color=fff`
        });
      } else {
        // Only set null if we actually had a user (real sign-out)
        if (currentUserIdRef.current !== null) {
          currentUserIdRef.current = null;
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    navigate('/dashboard');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/');
  };

  const handleLockedClick = (moduleName: string) => {
    // Allow Marketplace Raid to unlock
    if (moduleName === 'Mercados Freelance') {
      navigate('/marketplace-raid');
      setToastMessage('¡Marketplace Raid desbloqueado!');
      setShowToast(true);
      return;
    }

    setToastMessage(`El módulo ${moduleName} está en desarrollo (Fase 2).`);
    setShowToast(true);
  };

  // Protected Route Wrapper is now defined outside to prevent continuous remounting

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-slate-500">
        <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-hidden">
      {/* Background Gradient Mesh Effect */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-900/10 rounded-full blur-[120px]"></div>
      </div>

      <Sidebar onLogout={handleLogout} />

      <main className="flex-1 relative z-10 flex flex-col h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-950 to-blue-950/20">
        {/* Top Header / Status Bar (Mobile Only) */}
        <header className="h-14 border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 md:hidden">
          <span className="font-bold text-base text-white tracking-tight">TalentScope</span>
        </header>

        {/* Scrollable Content Area with Responsive Padding */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden w-full flex justify-center">
          <div className="w-full max-w-[95%] min-h-full px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8 py-3 md:py-4">
            <Routes>
              {/* Redirect root to dashboard since we are already authenticated */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route path="/dashboard" element={
                <ProtectedRoute user={user} loading={loading}>
                  <DashboardView
                    userName={user.name.split(' ')[0] || 'User'}
                    onOpenLinkedin={() => navigate('/tablero/linkedin')}
                    onLockedClick={handleLockedClick}
                  />
                </ProtectedRoute>
              } />

              <Route path="/tablero/:platform" element={
                <ProtectedRoute user={user} loading={loading}>
                  <CampaignListWrapper navigate={navigate} />
                </ProtectedRoute>
              } />

              <Route path="/tablero/:platform/:campaignId" element={
                <ProtectedRoute user={user} loading={loading}>
                  <CampaignDetailWrapper onBack={() => navigate(-1)} />
                </ProtectedRoute>
              } />

              <Route path="/new-campaign" element={
                <ProtectedRoute user={user} loading={loading}>
                  <CampaignCreationView
                    onBack={() => navigate(-1)}
                    onCampaignCreated={() => navigate('/tablero/linkedin')}
                  />
                </ProtectedRoute>
              } />

              <Route path="/talento" element={
                <ProtectedRoute user={user} loading={loading}>
                  <TalentPoolView />
                </ProtectedRoute>
              } />

              <Route path="/analytics" element={
                <ProtectedRoute user={user} loading={loading}>
                  <AnalyticsView />
                </ProtectedRoute>
              } />

              <Route path="/settings" element={
                <ProtectedRoute user={user} loading={loading}>
                  <SettingsView
                    currentName={user.name || ''}
                    onNameChange={(newName) => {
                      setUser({ ...user, name: newName });
                      setToastMessage('Name updated successfully!');
                      setShowToast(true);
                      supabase.auth.updateUser({ data: { full_name: newName } });
                    }}
                  />
                </ProtectedRoute>
              } />

              <Route path="/marketplace-raid" element={
                <ProtectedRoute user={user} loading={loading}>
                  <MarketplaceRaidDashboard onBack={() => navigate('/dashboard')} />
                </ProtectedRoute>
              } />

              <Route path="/marketplace-raid/:campaignId" element={
                <ProtectedRoute user={user} loading={loading}>
                  <MarketplaceCampaignWrapper />
                </ProtectedRoute>
              } />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </div>
      </main>

      <Toast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
};

// Wrapper components to handle params
const CampaignListWrapper = ({ navigate }: { navigate: any }) => {
  const { platform } = useParams();

  // For GitHub, show GitHub campaign list
  if (platform === 'github') {
    return <GitHubCampaignList />;
  }

  // For LinkedIn, show standard campaign list
  return (
    <CampaignListView
      platform={platform === 'linkedin' ? 'LinkedIn' : 'Other'}
      onSelectCampaign={(campaign) => navigate(`/tablero/${platform}/${campaign.id}`)}
      onBack={() => navigate('/dashboard')}
      onCreate={() => navigate('/new-campaign')}
    />
  );
}

const CampaignDetailWrapper = ({ onBack }: { onBack: () => void }) => {
  const { campaignId, platform } = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // For GitHub campaigns, show GitHubCodeScan
  if (platform === 'github') {
    return (
      <div>
        <button
          onClick={onBack}
          className="mb-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 text-sm"
        >
          ← Volver a Campañas
        </button>
        <GitHubCodeScan campaignId={campaignId} />
      </div>
    );
  }

  // For LinkedIn campaigns, show DetailView
  useEffect(() => {
    if (!campaignId) return;
    setLoading(true);
    const fetchCampaign = async () => {
      try {
        const campaigns = await CampaignService.getAll();
        const found = campaigns.find(c => c.id === campaignId);
        if (found) {
          setCampaign(found);
        } else {
          setError('Campaign not found');
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchCampaign();
  }, [campaignId]);

  if (loading) return <div className="p-8 text-slate-400">Loading campaign...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  if (!campaign) return <div className="p-8 text-slate-400">Campaign not found</div>;

  return <DetailView campaign={campaign} onBack={onBack} />;
}

// ─── Marketplace Campaign Detail Wrapper ─────────────────────────────
const MARKETPLACE_CAMPAIGNS_KEY = 'marketplace_campaigns_v1';

const MarketplaceCampaignWrapper = () => {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem(MARKETPLACE_CAMPAIGNS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const campaign = campaigns.find((c: any) => c.id === campaignId);

  if (!campaign) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p className="mb-4">Campaña no encontrada</p>
        <button
          onClick={() => navigate('/marketplace-raid')}
          className="text-emerald-400 hover:text-emerald-300 text-sm"
        >
          ← Volver al Marketplace
        </button>
      </div>
    );
  }

  const handleUpdateCampaign = (updated: any) => {
    const newCampaigns = campaigns.map((c: any) => c.id === updated.id ? updated : c);
    setCampaigns(newCampaigns);
    localStorage.setItem(MARKETPLACE_CAMPAIGNS_KEY, JSON.stringify(newCampaigns));
  };

  return (
    <MarketplaceCampaignDashboard
      campaign={campaign}
      onUpdateCampaign={handleUpdateCampaign}
      onBack={() => navigate('/marketplace-raid')}
    />
  );
};

export default App;