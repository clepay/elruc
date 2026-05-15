import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Container, Typography, Box, Button, TextField, Card, CardContent, Alert, InputAdornment, IconButton, Avatar } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LoginIcon from '@mui/icons-material/Login';
import HomeIcon from '@mui/icons-material/Home';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        navigate('/admin/import');
      } else {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setError(data.error || 'Credenciales incorrectas');
        } catch (e) {
          if (res.status === 404) {
            setError(`Error del servidor (404): La ruta no fue encontrada.`);
          } else {
            setError(`Error del servidor (${res.status}): Revisa la terminal.`);
          }
        }
      }
    } catch (err) {
      console.error('Detalle del error de conexión:', err);
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  // Estilos modernos compartidos con el panel
  const floatingBtnStyle = {
    borderRadius: 8,
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    transition: 'all 0.3s ease',
    '&:hover': {
      boxShadow: '0 8px 15px rgba(0,0,0,0.2)',
      transform: 'translateY(-2px)'
    }
  };

  const cardStyle = {
    p: { xs: 2, sm: 3 }, 
    width: '100%', 
    borderRadius: 4, 
    boxShadow: '0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
    transition: 'all 0.3s ease',
    border: '1px solid #eaeaea',
    '&:hover': { boxShadow: '0 16px 48px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.1)', transform: 'translateY(-4px)' }
  };

  return (
    <>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
      <Container maxWidth="xs" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card sx={cardStyle}>
        <CardContent sx={{ position: 'relative' }}>

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', mb: 3 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56, mb: 1.5, boxShadow: '0 4px 10px rgba(0,56,168,0.3)' }}>
              <AdminPanelSettingsIcon />
            </Avatar>
            <Typography variant="h5" component="h1" color="primary" fontWeight="bold">
              Acceso Restringido
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Ingresa tus credenciales para administrar el sistema de consulta RUC
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={handleLogin}>
            <TextField fullWidth label="Usuario" variant="outlined" margin="normal" value={username} onChange={(e) => setUsername(e.target.value)} required sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} InputLabelProps={{ shrink: true }} />
            <TextField fullWidth label="Contraseña" type={showPassword ? 'text' : 'password'} variant="outlined" margin="normal" value={password} onChange={(e) => setPassword(e.target.value)} required sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} InputLabelProps={{ shrink: true }} InputProps={{ endAdornment: ( <InputAdornment position="end"><IconButton onClick={handleClickShowPassword} edge="end">{showPassword ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment> )}} />
            <Button fullWidth type="submit" variant="contained" color="primary" size="large" sx={{ mt: 3, py: 1.2, ...floatingBtnStyle }} disabled={loading} endIcon={<LoginIcon />}>
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </Button>
          </form>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <IconButton onClick={() => navigate('/')} sx={{ color: 'primary.main', minWidth: 44, minHeight: 44 }}>
              <HomeIcon fontSize="large" />
            </IconButton>
          </Box>
        </CardContent>
      </Card>
    </Container>
    </>
  );
}