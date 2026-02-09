import React, { useState, useEffect } from 'react';
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
import { ViewMode, User, Campaign } from './types';

import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('login'); // Start at login
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const [toastMessage, setToastMessage] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          role: 'Recruiter',
          avatar: `https://ui-avatars.com/api/?name=${session.user.email}&background=0D8ABC&color=fff`
        });
        setCurrentView('dashboard');
      }
    });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          role: 'Recruiter',
          avatar: `https://ui-avatars.com/api/?name=${session.user.email}&background=0D8ABC&color=fff`
        });
        setCurrentView('dashboard');
      } else {
        setUser(null);
        setCurrentView('login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentView('dashboard');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCurrentView('login');
  };

  const handleNavigate = (view: ViewMode) => {
    setCurrentView(view);
  };

  // 1. Dashboard click -> Opens Campaign List for that platform
  const handleOpenPlatform = (platform: string) => {
    // For demo, we only have mock data for LinkedIn, but the architecture supports others
    if (platform === 'LinkedIn') {
      setSelectedPlatform('LinkedIn');
      setCurrentView('campaign-list');
    } else {
      handleLockedClick(platform);
    }
  };

  // 2. Campaign List click -> Opens specific Campaign Detail
  const handleSelectCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setCurrentView('campaign-detail');
  };

  const handleLockedClick = (moduleName: string) => {
    setToastMessage(`El módulo ${moduleName} está en desarrollo (Fase 2).`);
    setShowToast(true);
  };

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardView
            userName={user.name.split(' ')[0]}
            onOpenLinkedin={() => handleOpenPlatform('LinkedIn')}
            onLockedClick={handleLockedClick}
          />
        );
      case 'campaign-list':
        return (
          <CampaignListView
            platform={selectedPlatform}
            onSelectCampaign={handleSelectCampaign}
            onBack={() => setCurrentView('dashboard')}
            onCreate={() => setCurrentView('campaign-create')}
          />
        );
      case 'campaign-detail':
        return selectedCampaign ? (
          <DetailView
            campaign={selectedCampaign}
            onBack={() => setCurrentView('campaign-list')}
          />
        ) : <DashboardView userName={user.name} onOpenLinkedin={() => { }} onLockedClick={() => { }} />;
      case 'talent-pool':
        return <TalentPoolView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'campaign-create':
        return <CampaignCreationView
          onBack={() => setCurrentView('campaign-list')}
          onCampaignCreated={() => setCurrentView('campaign-list')}
        />;
      case 'settings':
        return <SettingsView
          currentName={user.name}
          onNameChange={(newName) => {
            setUser({ ...user, name: newName });
            setToastMessage('Name updated successfully!');
            setShowToast(true);
            // Optionally update Supabase metadata here
            supabase.auth.updateUser({ data: { full_name: newName } });
          }}
        />;
      default:
        return (
          <DashboardView
            userName={user.name.split(' ')[0]}
            onOpenLinkedin={() => handleOpenPlatform('LinkedIn')}
            onLockedClick={handleLockedClick}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-hidden">
      {/* Background Gradient Mesh Effect */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-900/10 rounded-full blur-[120px]"></div>
      </div>

      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      <main className="flex-1 relative z-10 flex flex-col h-screen overflow-hidden">
        {/* Top Header / Status Bar (Mobile Only or Global Search placeholder) */}
        <header className="h-16 border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 md:hidden">
          <span className="font-bold text-lg text-white tracking-tight">TalentScope</span>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
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

export default App;