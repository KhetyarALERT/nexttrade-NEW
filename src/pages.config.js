import Home from './pages/Home';
import About from './pages/About';
import Trading from './pages/Trading';
import Contact from './pages/Contact';
import Profile from './pages/Profile';
import Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "About": About,
    "Trading": Trading,
    "Contact": Contact,
    "Profile": Profile,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: Layout,
};