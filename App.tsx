
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import DetailView from './components/DetailView';
import CampaignListView from './components/CampaignListView';
import CampaignCreationView from './components/CampaignCreationView';
import LoginView from './components/LoginView';
import TalentPoolView from './components/TalentPoolView';
import AnalyticsView from './components/AnalyticsView';
import Toast from './components/Toast';
import SettingsView from './components/SettingsView';
import { GitHubScanManager } from './components/GitHubScanManager';
import { User, Campaign } from './types';
import { supabase } from './lib/supabase';
import { CampaignService } from './lib/services'; // Ensure this import exists
import { TabGuard } from './lib/TabGuard';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);
  const navigate = useNavigate();

  // ─── TabGuard: Sistema anti-recarga automática ─────────────────────
  // Previene recargas cuando cambias de pestaña/ventana
  useEffect(() => {
    const guard = new TabGuard();
    guard.activate();
    return () => guard.deactivate();
  }, []);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
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

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          role: 'Recruiter',
          avatar: `https://ui-avatars.com/api/?name=${session.user.email}&background=0D8ABC&color=fff`
        });
      } else {
        setUser(null);
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
    setToastMessage(`El módulo ${moduleName} está en desarrollo (Fase 2).`);
    setShowToast(true);
  };

  // Protected Route Wrapper
  const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
    if (loading) return <div className="flex items-center justify-center h-screen bg-slate-950 text-slate-500">Loading...</div>;
    if (!user) return <Navigate to="/" replace />;
    return children;
  };

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
        <div className="flex-1 overflow-y-auto overflow-x-hidden w-full">
            <div className="w-full min-h-full px-2 sm:px-3 md:px-5 lg:px-6 xl:px-10 2xl:px-20 py-3 md:py-4">
            <Routes>
                {/* Redirect root to dashboard since we are already authenticated */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                
                <Route path="/dashboard" element={
                <ProtectedRoute>
                    <DashboardView
                    userName={user.name.split(' ')[0] || 'User'}
                    onOpenLinkedin={() => navigate('/tablero/linkedin')}
                    onLockedClick={handleLockedClick}
                    />
                </ProtectedRoute>
                } />

                <Route path="/tablero/:platform" element={
                <ProtectedRoute>
                    <CampaignListWrapper navigate={navigate} />
                </ProtectedRoute>
                } />

                <Route path="/tablero/:platform/:campaignId" element={
                <ProtectedRoute>
                    <CampaignDetailWrapper onBack={() => navigate(-1)} />
                </ProtectedRoute>
                } />

                <Route path="/new-campaign" element={
                <ProtectedRoute>
                    <CampaignCreationView
                    onBack={() => navigate(-1)}
                    onCampaignCreated={() => navigate('/tablero/linkedin')}
                    />
                </ProtectedRoute>
                } />

                <Route path="/talento" element={
                <ProtectedRoute>
                    <TalentPoolView />
                </ProtectedRoute>
                } />

                <Route path="/analytics" element={
                <ProtectedRoute>
                    <AnalyticsView />
                </ProtectedRoute>
                } />

                <Route path="/settings" element={
                <ProtectedRoute>
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

                <Route path="/github-scan" element={
                <ProtectedRoute>
                    <GitHubScanManager />
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
  // Start with dummy implementation, assuming 'linkedin' mostly
  // We reuse CampaignListView but might need to adjust props if it expects strict types
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
  const { campaignId } = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!campaignId) return;
    setLoading(true);
    // Fetch campaign by ID. We need to implement this in CampaignService or emulate it
    // The previous error was probably because 'settings' field was being accessed when undefined?
    // Let's implement a robust fetch
    const fetchCampaign = async () => {
      // Temporary: Fetch all and find (Inefficient but works without backend changes)
      // Ideally we add getById to service
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

export default App;