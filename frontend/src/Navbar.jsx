import React, { useState, useEffect, useRef } from 'react';
import { AppBar, Toolbar, Typography, Box, Container, Link, Chip, Tooltip } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import GavelIcon from '@mui/icons-material/Gavel';

export default function Navbar() {
  const [noticias, setNoticias] = useState([]);
  const [normativas, setNormativas] = useState([]);
  const [noticiaIdx, setNoticiaIdx] = useState(0);
  const [normativaIdx, setNormativaIdx] = useState(0);
  const [fadeNews, setFadeNews] = useState(true);
  const [fadeNorm, setFadeNorm] = useState(true);
  const noticiaTimer = useRef(null);
  const normativaTimer = useRef(null);
  const paused = useRef(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/dnit/noticias').then(r => r.json()).catch(() => []),
      fetch('/api/dnit/normativas').then(r => r.json()).catch(() => []),
    ]).then(([news, norms]) => {
      if (Array.isArray(news) && news.length > 0) setNoticias(news);
      if (Array.isArray(norms) && norms.length > 0) setNormativas(norms);
    });
  }, []);

  useEffect(() => {
    if (noticias.length < 2) return;
    noticiaTimer.current = setInterval(() => {
      if (paused.current) return;
      setFadeNews(false);
      setTimeout(() => {
        setNoticiaIdx(prev => (prev + 1) % noticias.length);
        setFadeNews(true);
      }, 300);
    }, 6000);
    return () => clearInterval(noticiaTimer.current);
  }, [noticias]);

  useEffect(() => {
    if (normativas.length < 2) return;
    normativaTimer.current = setInterval(() => {
      if (paused.current) return;
      setFadeNorm(false);
      setTimeout(() => {
        setNormativaIdx(prev => (prev + 1) % normativas.length);
        setFadeNorm(true);
      }, 300);
    }, 6000);
    return () => clearInterval(normativaTimer.current);
  }, [normativas]);

  const noticiaActual = noticias[noticiaIdx];
  const normativaActual = normativas[normativaIdx];

  return (
    <>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.28), rgba(255,255,255,0.12))',
          backdropFilter: 'blur(30px) saturate(200%)',
          WebkitBackdropFilter: 'blur(30px) saturate(200%)',
          color: '#1a1a2e',
          borderBottom: '1px solid rgba(255,255,255,0.40)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
          borderRadius: 0,
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters variant="dense" sx={{ minHeight: 52, gap: 1 }}>
            <Typography
              variant="h6"
              component={RouterLink}
              to="/"
              aria-label="El Ruc - Consulta RUC Paraguay"
              sx={{
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: '#0038a8',
                textDecoration: 'none',
                letterSpacing: '-0.5px',
                fontSize: '1.25rem',
              }}
            >
              <SearchIcon sx={{ fontSize: 28 }} />
              El Ruc
              <Box component="span" sx={{ color: '#999', fontWeight: 300, mx: 0.5, display: { xs: 'none', sm: 'inline' } }}>|</Box>
              <Box component="span" sx={{ color: '#555', fontWeight: 500, fontSize: '0.85rem', display: { xs: 'none', sm: 'inline' } }}>
                Consultá RUC gratis
              </Box>
            </Typography>

            <Box
              sx={{ ml: 'auto', display: { xs: 'none', md: 'flex' }, gap: 1, alignItems: 'center' }}
              onMouseEnter={() => { paused.current = true; }}
              onMouseLeave={() => { paused.current = false; }}
            >
              {noticiaActual && (
                <Link
                  href={noticiaActual.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="none"
                  sx={{ transition: 'opacity 0.3s', opacity: fadeNews ? 1 : 0 }}
                >
                  <Tooltip title={noticiaActual.titulo}>
                    <Chip
                      icon={<NewReleasesIcon sx={{ fontSize: 16, color: '#b8860b' }} />}
                      label={noticiaActual.titulo}
                      size="small"
                      sx={{
                        bgcolor: '#ffd700', color: '#000', fontWeight: 600, fontSize: '0.75rem', maxWidth: 240,
                        '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                      }}
                    />
                  </Tooltip>
                </Link>
              )}
              {normativaActual && (
                <Link
                  href={normativaActual.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="none"
                  sx={{ transition: 'opacity 0.3s', opacity: fadeNorm ? 1 : 0 }}
                >
                  <Tooltip title={normativaActual.fecha_publicacion || normativaActual.titulo}>
                    <Chip
                      icon={<GavelIcon sx={{ fontSize: 16, color: '#4a4a6a' }} />}
                      label={normativaActual.titulo}
                      size="small"
                      sx={{
                        bgcolor: '#e0e0e0', color: '#000', fontWeight: 600, fontSize: '0.75rem', maxWidth: 240,
                        '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                      }}
                    />
                  </Tooltip>
                </Link>
              )}
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
      <Box sx={{ display: 'flex', height: '6px', width: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <Box sx={{ flex: 1, bgcolor: '#d52b1e' }} />
        <Box sx={{ flex: 1, bgcolor: '#ffffff' }} />
        <Box sx={{ flex: 1, bgcolor: '#0038a8' }} />
      </Box>
    </>
  );
}
