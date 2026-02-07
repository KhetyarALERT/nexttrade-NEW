import Layout from "../Layout.jsx";

import About from "./About";
import BuyWithCard from "./BuyWithCard";
import Contact from "./Contact";
import Dashboard from "./Dashboard";
import FAQ from "./FAQ";
import Futures from "./Futures";
import Help from "./Help";
import HelpArticle from "./HelpArticle";
import Home from "./Home";
import Invite from "./Invite";
import Investing from "./Investing";
import LearnEarn from "./LearnEarn";
import MemeCoins from "./MemeCoins";
import MemeCoinsNew from "./MemeCoinsNew";
import OKXAdminHub from "./OKXAdminHub";
import OnChainDeposit from "./OnChainDeposit";
import PrivacyPolicy from "./PrivacyPolicy";
import Profile from "./Profile";
import Rewards from "./Rewards";
import TermsOfService from "./TermsOfService";
import Trading from "./Trading";
import Wallet from "./Wallet";

import { Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    About,
    BuyWithCard,
    Contact,
    Dashboard,
    FAQ,
    Futures,
    Help,
    HelpArticle,
    Home,
    Invite,
    Investing,
    LearnEarn,
    MemeCoins,
    MemeCoinsNew,
    OKXAdminHub,
    OnChainDeposit,
    PrivacyPolicy,
    Profile,
    Rewards,
    TermsOfService,
    Trading,
    Wallet,
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                <Route path="/" element={<Home />} />
                <Route path="/About" element={<About />} />
                <Route path="/BuyWithCard" element={<BuyWithCard />} />
                <Route path="/Contact" element={<Contact />} />
                <Route path="/Dashboard" element={<Dashboard />} />
                <Route path="/FAQ" element={<FAQ />} />
                <Route path="/Futures" element={<Futures />} />
                <Route path="/Help" element={<Help />} />
                <Route path="/HelpArticle" element={<HelpArticle />} />
                <Route path="/Home" element={<Home />} />
                <Route path="/Invite" element={<Invite />} />
                <Route path="/Investing" element={<Investing />} />
                <Route path="/LearnEarn" element={<LearnEarn />} />
                <Route path="/MemeCoins" element={<MemeCoins />} />
                <Route path="/MemeCoinsNew" element={<MemeCoinsNew />} />
                <Route path="/OKXAdminHub" element={<OKXAdminHub />} />
                <Route path="/OnChainDeposit" element={<OnChainDeposit />} />
                <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
                <Route path="/Profile" element={<Profile />} />
                <Route path="/Rewards" element={<Rewards />} />
                <Route path="/TermsOfService" element={<TermsOfService />} />
                <Route path="/Trading" element={<Trading />} />
                <Route path="/Wallet" element={<Wallet />} />
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return <PagesContent />; // v2
}