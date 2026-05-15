import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import ReactGA from 'react-ga4';
import Navbar from './Navbar.jsx';
import Home from './Home.jsx';
import Login from './Login.jsx';
import Import from './Import.jsx';
import Stats from './Stats.jsx';
import DataList from './DataList.jsx';
import NotFound from './NotFound.jsx';

import Footer from './Footer.jsx';
import fondoBandera from './fondo_pantalla_el_ruc_bandera_paraguaya.jpg';

function App() {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');

  useEffect(() => {
    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (gaId) {
      ReactGA.send({ hitType: 'pageview', page: location.pathname + location.search });
    }
  }, [location]);

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: `
        linear-gradient(135deg, rgba(255,255,255,0.92), rgba(255,255,255,0.60)),
        url(${fondoBandera}) center/cover no-repeat
      `,
      backgroundAttachment: 'fixed',
    }}>
      {!isAdminPage && <Navbar />}
      
      <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin/import" element={<Import />} />
          <Route path="/admin/stats" element={<Stats />} />
          <Route path="/admin/data" element={<DataList />} />
          <Route path="*" element={<NotFound />} />
          
        </Routes>
      </Box>

      {isAdminPage ? <Footer simple /> : <Footer />}
    </Box>
  )
}

export default App
