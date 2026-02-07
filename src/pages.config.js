/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import About from './pages/About';
import BuyWithCard from './pages/BuyWithCard';
import Contact from './pages/Contact';
import Dashboard from './pages/Dashboard';
import FAQ from './pages/FAQ';
import Futures from './pages/Futures';
import Help from './pages/Help';
import HelpArticle from './pages/HelpArticle';
import Home from './pages/Home';
import Invite from './pages/Invite';
import LearnEarn from './pages/LearnEarn';
import MemeCoins from './pages/MemeCoins';
import MemeCoinsNew from './pages/MemeCoinsNew';
import OKXAdminHub from './pages/OKXAdminHub';
import OnChainDeposit from './pages/OnChainDeposit';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Profile from './pages/Profile';
import Rewards from './pages/Rewards';
import TermsOfService from './pages/TermsOfService';
import Trading from './pages/Trading';
import Wallet from './pages/Wallet';
import index from './pages/index';
import Investing from './pages/Investing';
import __Layout from './Layout.jsx';


export const PAGES = {
    "About": About,
    "BuyWithCard": BuyWithCard,
    "Contact": Contact,
    "Dashboard": Dashboard,
    "FAQ": FAQ,
    "Futures": Futures,
    "Help": Help,
    "HelpArticle": HelpArticle,
    "Home": Home,
    "Invite": Invite,
    "LearnEarn": LearnEarn,
    "MemeCoins": MemeCoins,
    "MemeCoinsNew": MemeCoinsNew,
    "OKXAdminHub": OKXAdminHub,
    "OnChainDeposit": OnChainDeposit,
    "PrivacyPolicy": PrivacyPolicy,
    "Profile": Profile,
    "Rewards": Rewards,
    "TermsOfService": TermsOfService,
    "Trading": Trading,
    "Wallet": Wallet,
    "index": index,
    "Investing": Investing,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};