import Layout from "../Layout.jsx";

import About from "./About";

import Contact from "./Contact";

import Home from "./Home";

import Trading from "./Trading";

import Profile from "./Profile";

import Wallet from "./Wallet";

import ReferralRedirect from "./ReferralRedirect";

import { Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    About: About,
    
    Contact: Contact,
    
    Home: Home,
    
    Trading: Trading,
    Profile: Profile,
    Wallet: Wallet,
    
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
                
                <Route path="/Contact" element={<Contact />} />
                
                <Route path="/Home" element={<Home />} />
                
                <Route path="/Trading" element={<Trading />} />
                <Route path="/Profile" element={<Profile />} />
                <Route path="/Wallet" element={<Wallet />} />
                <Route path="/r/:code" element={<ReferralRedirect />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return <PagesContent />;
}