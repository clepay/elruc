import React, { useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Container, Link, Tooltip } from '@mui/material';

export default function Footer({ simple }) {
  const currentYear = new Date().getFullYear();
  const clickCount = useRef(0);
  const clickTimer = useRef(null);
  const navigate = useNavigate();

  const handleHiddenAccess = useCallback(async () => {
    clickCount.current += 1;
    if (clickCount.current === 1) {
      clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 1000);
    }
    if (clickCount.current >= 4) {
      clearTimeout(clickTimer.current);
      clickCount.current = 0;
      try {
        const res = await fetch('/api/admin/gate', { method: 'POST', credentials: 'include' });
        if (res.ok) navigate('/admin/login');
      } catch {}
    }
  }, [navigate]);

  if (simple) {
    return (
      <Typography
        variant="body2"
        align="center"
        onClick={handleHiddenAccess}
        sx={{ py: 1.5, fontWeight: 500, color: 'text.secondary', cursor: 'default', userSelect: 'none' }}
      >
        © Copyright {currentYear} | Desarrollado por{' '}
        <Tooltip title="Visitar sitio web del desarrollador" placement="top">
          <Link
            href="https://crstudio.com.py/"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: '#5a8cff', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            CR Code Studio
          </Link>
        </Tooltip>
      </Typography>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', height: '6px', width: '100%', mt: 'auto' }}>
        <Box sx={{ flex: 1, bgcolor: '#d52b1e' }} />
        <Box sx={{ flex: 1, bgcolor: '#ffffff' }} />
        <Box sx={{ flex: 1, bgcolor: '#0038a8' }} />
      </Box>
      <Box
        component="footer"
        sx={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.30), rgba(255,255,255,0.10))',
          backdropFilter: 'blur(30px) saturate(200%)',
          WebkitBackdropFilter: 'blur(30px) saturate(200%)',
          color: '#1a1a2e',
          py: 1,
          borderTop: '1px solid rgba(255,255,255,0.40)',
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant="body2"
            align="center"
            onClick={handleHiddenAccess}
            sx={{ cursor: 'default', fontWeight: 500, userSelect: 'none' }}
          >
            © Copyright {currentYear} | Desarrollado por{' '}
            <Tooltip title="Visitar sitio web del desarrollador" placement="top">
              <Link
                href="https://crstudio.com.py/"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: '#5a8cff', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                CR Code Studio
              </Link>
            </Tooltip>
          </Typography>
          <Typography
            variant="caption"
            align="center"
            sx={{ mt: 0.5, color: '#000000', display: 'block', fontSize: { xs: '0.75rem', sm: '0.7rem' } }}
          >
            Consulta RUC Paraguay — Facturación Electrónica DNIT.
            <br />
            Datos públicos del padrón oficial de contribuyentes.
          </Typography>
        </Container>
      </Box>
    </>
  );
}
