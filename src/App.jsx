import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { createPageUrl } from '@/utils';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { useLocation } from 'react-router-dom';
import { WalletConnectProvider } from '@/lib/web3/WalletConnectProvider'
import { SolanaWalletProvider } from '@/lib/web3/SolanaWalletProvider'

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();
  const location = useLocation();

  // Public routes (should remain accessible even when auth is required).
  // Include both canonical + legacy paths to avoid breaking existing links.
  const legacyPageUrl = (pageName) => '/' + String(pageName ?? '').toLowerCase().replace(/ /g, '-');

  const PUBLIC_ROUTES = new Set([
    // Canonical
    createPageUrl('PrivacyPolicy'),
    createPageUrl('TermsOfService'),

    // Legacy (pre-kebab-case)
    legacyPageUrl('PrivacyPolicy'),
    legacyPageUrl('TermsOfService'),

    // Explicit (in case external links hardcode these)
    '/privacy-policy',
    '/terms-of-service',
  ]);

  const pathname = (location?.pathname || '').replace(/\/$/, '') || '/';
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      if (!isPublicRoute) return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      if (!isPublicRoute) {
        navigateToLogin();
        return null;
      }
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route
        path="/"
        element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        }
      />

      {Object.entries(Pages).flatMap(([pageKey, Page]) => {
        const canonical = createPageUrl(pageKey);
        const legacy = '/' + String(pageKey ?? '').toLowerCase().replace(/ /g, '-');
        const original = `/${pageKey}`;

        return [
          // Canonical route
          <Route
            key={`page:${pageKey}:canonical`}
            path={canonical}
            element={
              <LayoutWrapper currentPageName={pageKey}>
                <Page />
              </LayoutWrapper>
            }
          />,

          // Back-compat: old createPageUrl behavior (e.g. /privacypolicy)
          legacy !== canonical ? (
            <Route
              key={`page:${pageKey}:legacy`}
              path={legacy}
              element={<Navigate to={canonical} replace />}
            />
          ) : null,

          // Back-compat: original generated path (e.g. /PrivacyPolicy)
          original !== canonical ? (
            <Route
              key={`page:${pageKey}:original`}
              path={original}
              element={<Navigate to={canonical} replace />}
            />
          ) : null,
        ].filter(Boolean);
      })}

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <WalletConnectProvider>
      <SolanaWalletProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <NavigationTracker />
              <AuthenticatedApp />
            </Router>
            <Toaster />
            <VisualEditAgent />
          </QueryClientProvider>
        </AuthProvider>
      </SolanaWalletProvider>
    </WalletConnectProvider>
  )
}

export default App
