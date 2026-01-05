import About from './pages/About';
import Contact from './pages/Contact';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Investing from './pages/Investing';
import Profile from './pages/Profile';
import Rewards from './pages/Rewards';
import Trading from './pages/Trading';
import index from './pages/index';
import __Layout from './Layout.jsx';


export const PAGES = {
    "About": About,
    "Contact": Contact,
    "Dashboard": Dashboard,
    "Home": Home,
    "Investing": Investing,
    "Profile": Profile,
    "Rewards": Rewards,
    "Trading": Trading,
    "index": index,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};