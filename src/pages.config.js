import About from './pages/About';
import Contact from './pages/Contact';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Trading from './pages/Trading';
import index from './pages/index';
import __Layout from './Layout.jsx';


export const PAGES = {
    "About": About,
    "Contact": Contact,
    "Home": Home,
    "Profile": Profile,
    "Trading": Trading,
    "index": index,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};