import BuyWithCard from './pages/BuyWithCard';
import Contact from './pages/Contact';
import Dashboard from './pages/Dashboard';
import Futures from './pages/Futures';
import Home from './pages/Home';
import Investing from './pages/Investing';
import LearnEarn from './pages/LearnEarn';
import MemeCoins from './pages/MemeCoins';
import MemeCoinsNew from './pages/MemeCoinsNew';
import OnChainDeposit from './pages/OnChainDeposit';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Rewards from './pages/Rewards';
import TermsOfService from './pages/TermsOfService';
import Trading from './pages/Trading';
import index from './pages/index';
import About from './pages/About';
import OKXAdminHub from './pages/OKXAdminHub';
import Profile from './pages/Profile';
import __Layout from './Layout.jsx';


export const PAGES = {
    "BuyWithCard": BuyWithCard,
    "Contact": Contact,
    "Dashboard": Dashboard,
    "Futures": Futures,
    "Home": Home,
    "Investing": Investing,
    "LearnEarn": LearnEarn,
    "MemeCoins": MemeCoins,
    "MemeCoinsNew": MemeCoinsNew,
    "OnChainDeposit": OnChainDeposit,
    "PrivacyPolicy": PrivacyPolicy,
    "Rewards": Rewards,
    "TermsOfService": TermsOfService,
    "Trading": Trading,
    "index": index,
    "About": About,
    "OKXAdminHub": OKXAdminHub,
    "Profile": Profile,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};