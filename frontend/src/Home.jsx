import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import SearchForm from './SearchForm.jsx';
import AnimatedBackgroundPhrases from './AnimatedBackgroundPhrases.jsx';
import Banners from './Banners.jsx';

export default function Home() {

  return (
    <Box
      sx={{
        position: 'relative',
        flexGrow: 1,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <AnimatedBackgroundPhrases />
      </Box>

      <Container maxWidth="md" sx={{ flexGrow: 1, display: 'flex', position: 'relative', zIndex: 1, overflow: 'auto' }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              flexGrow: 1,
              pt: 2,
              pb: 4,
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                variant="h3"
                component="h1"
                sx={{
                  color: '#0038a8',
                  fontWeight: 900,
                  fontSize: { xs: '2.8rem', sm: '4rem' },
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                  mb: 1,
                }}
              >
                RUC
              </Typography>
              <Typography
                variant="h6"
                component="h2"
                sx={{
                  color: '#000000',
                  fontWeight: 500,
                  fontSize: { xs: '1rem', sm: '1.2rem' },
                  mx: 'auto',
                }}
              >
                Verificá RUC y Razón Social para tu facturación electrónica
              </Typography>
            </Box>
            <SearchForm />
          </Box>
      </Container>
      <Banners />
    </Box>
  );
}
