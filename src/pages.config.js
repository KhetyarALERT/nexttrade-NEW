import About from './pages/About';
import BuyWithCard from './pages/BuyWithCard';
import Contact from './pages/Contact';
import Dashboard from './pages/Dashboard';
import Futures from './pages/Futures';
import Home from './pages/Home';
import Investing from './pages/Investing';
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
import __Layout from './Layout.jsx';


export const PAGES = {
    "About": About,
    "BuyWithCard": BuyWithCard,
    "Contact": Contact,
    "Dashboard": Dashboard,
    "Futures": Futures,
    "Home": Home,
    "Investing": Investing,
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
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};