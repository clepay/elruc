import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, Box, Button } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';

export default function NotFound() {
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => setSeconds(s => s - 1), 1000);
    const redirect = setTimeout(() => navigate('/'), 5000);
    return () => { clearInterval(timer); clearTimeout(redirect); };
  }, [navigate]);

  return (
    <Container maxWidth="sm" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
      <Box sx={{ textAlign: 'center', bgcolor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderRadius: 4, p: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxWidth: 420, width: '100%' }}>
        <Typography variant="h1" sx={{ fontSize: 80, fontWeight: 800, color: '#d52b1e', lineHeight: 1 }}>
          404
        </Typography>
        <Typography variant="h6" sx={{ mt: 2, fontWeight: 600, color: '#1a1a2e' }}>
          Página no encontrada
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          El contenido que buscas no está disponible o ha sido movido.
        </Typography>
        <Box sx={{ height: 4, borderRadius: 2, bgcolor: '#e0e0e0', overflow: 'hidden', maxWidth: 200, mx: 'auto', mb: 3 }}>
          <Box sx={{ height: '100%', width: `${((5 - seconds) / 5) * 100}%`, background: 'linear-gradient(90deg, #d52b1e, #0038a8)', borderRadius: 2, transition: 'width 1s linear' }} />
        </Box>
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 2 }}>
          Redirigiendo al inicio en {seconds} segundo{seconds !== 1 ? 's' : ''}...
        </Typography>
        <Button variant="contained" startIcon={<HomeIcon />} onClick={() => navigate('/')}>
          Volver al inicio
        </Button>
      </Box>
    </Container>
  );
}
